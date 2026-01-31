/**
 * Based on local server interaction parts from:
 * https://github.com/jlcodes99/vscode-antigravity-cockpit.git
 */

import { logger } from './Logger';
import { PlatformStrategy, ProcessInfo } from './types';
import * as process from 'process';

export class WindowsStrategy implements PlatformStrategy {
	private isAntigravityProcess(commandLine: string): boolean {
		if (!commandLine.includes('--extension_server_port')) {
			return false;
		}
		if (!commandLine.includes('--csrf_token')) {
			return false;
		}
		return /--app_data_dir\s+antigravity\b/i.test(commandLine);
	}

	getProcessListCommand(processName: string): string {
		const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
		return `chcp 65001 >nul && powershell -NoProfile -Command "${utf8Header}Get-CimInstance Win32_Process -Filter 'name=''${processName}''' | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
	}

	getProcessByKeywordCommand(): string {
		const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
		return `chcp 65001 >nul && powershell -NoProfile -Command "${utf8Header}Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'csrf_token' } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json"`;
	}

	parseProcessInfo(stdout: string): ProcessInfo[] {
		logger.debug('[WindowsStrategy] Parsing JSON process info...');
		try {
			const jsonStart = stdout.indexOf('[');
			const jsonObjectStart = stdout.indexOf('{');
			let cleanStdout = stdout;

			if (jsonStart >= 0 || jsonObjectStart >= 0) {
				const start =
					jsonStart >= 0 && jsonObjectStart >= 0
						? Math.min(jsonStart, jsonObjectStart)
						: Math.max(jsonStart, jsonObjectStart);
				cleanStdout = stdout.substring(start);
			}

			let data = JSON.parse(cleanStdout.trim());
			if (!Array.isArray(data)) {
				data = [data];
			}
			if (data.length === 0) {
				return [];
			}

			const candidates: ProcessInfo[] = [];

			for (const item of data) {
				const commandLine = item.CommandLine || '';
				if (!commandLine || !this.isAntigravityProcess(commandLine)) {
					continue;
				}

				const pid = item.ProcessId;
				if (!pid) {
					continue;
				}

				const portMatch = commandLine.match(/--extension_server_port[=\s]+(\d+)/);
				const tokenMatch = commandLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);

				if (!tokenMatch?.[1]) {
					continue;
				}

				const extensionPort = portMatch?.[1] ? parseInt(portMatch[1], 10) : 0;
				const csrfToken = tokenMatch[1];
				candidates.push({ pid, extensionPort, csrfToken });
			}
			return candidates;
		} catch {
			return [];
		}
	}

	getPortListCommand(pid: number): string {
		const utf8Header = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ';
		return `chcp 65001 >nul && powershell -NoProfile -NonInteractive -Command "${utf8Header}$ports = Get-NetTCPConnection -State Listen -OwningProcess ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort; if ($ports) { $ports | Sort-Object -Unique }"`;
	}

	parseListeningPorts(stdout: string): number[] {
		const ports = new Set<number>();
		const matches = stdout.match(/\b\d{1,5}\b/g) || [];
		for (const value of matches) {
			const port = parseInt(value, 10);
			if (port > 0 && port <= 65535) {
				ports.add(port);
			}
		}
		return Array.from(ports).sort((a, b) => a - b);
	}

	getErrorMessages() {
		return {
			processNotFound: 'language_server process not found',
			commandNotAvailable: 'PowerShell command failed',
			requirements: ['Antigravity running', 'language_server_windows_x64 running'],
		};
	}

	getDiagnosticCommand(): string {
		return `powershell -NoProfile -Command "Get-Process | Where-Object { $_.ProcessName -match 'language|antigravity' } | Select-Object Id,ProcessName,Path | Format-Table -AutoSize"`;
	}
}

export class UnixStrategy implements PlatformStrategy {
	private platform: string;
	private availablePortCommand: 'lsof' | 'ss' | 'netstat' | null = null;
	private portCommandChecked = false;
	private targetPid = 0;

	constructor(platform: string) {
		this.platform = platform;
	}

	private async detectAvailablePortCommand(): Promise<void> {
		if (this.portCommandChecked) {
			return;
		}
		this.portCommandChecked = true;

		try {
			const { exec } = await import('child_process');
			const { promisify } = await import('util');
			const execAsync = promisify(exec);
			const commands = ['lsof', 'ss', 'netstat'];

			for (const cmd of commands) {
				try {
					await execAsync(`which ${cmd}`, { timeout: 3000 });
					this.availablePortCommand = cmd as any;
					return;
				} catch {} // eslint-disable-line no-empty
			}
		} catch {} // eslint-disable-line no-empty
	}

	private isAntigravityProcess(commandLine: string): boolean {
		if (!commandLine.includes('--extension_server_port')) {
			return false;
		}
		if (!commandLine.includes('--csrf_token')) {
			return false;
		}
		return /--app_data_dir\s+antigravity\b/i.test(commandLine);
	}

	getProcessListCommand(processName: string): string {
		return `ps -ww -eo pid,ppid,args | grep "${processName}" | grep -v grep`;
	}

	parseProcessInfo(stdout: string): ProcessInfo[] {
		const lines = stdout.split('\n').filter((line) => line.trim());
		const currentPid = process.pid;
		const candidates: Array<{
			pid: number;
			ppid: number;
			extensionPort: number;
			csrfToken: string;
		}> = [];

		for (const line of lines) {
			const parts = line.trim().split(/\s+/);
			if (parts.length < 3) {
				continue;
			}

			const pid = parseInt(parts[0], 10);
			const ppid = parseInt(parts[1], 10);
			const cmd = parts.slice(2).join(' ');

			if (isNaN(pid)) {
				continue;
			}

			const portMatch = cmd.match(/--extension_server_port[=\s]+(\d+)/);
			const tokenMatch = cmd.match(/--csrf_token[=\s]+([a-zA-Z0-9-]+)/i);

			if (tokenMatch?.[1] && this.isAntigravityProcess(cmd)) {
				const extensionPort = portMatch?.[1] ? parseInt(portMatch[1], 10) : 0;
				const csrfToken = tokenMatch[1];
				candidates.push({ pid, ppid, extensionPort, csrfToken });
			}
		}

		return candidates.sort((a, b) => {
			if (a.ppid === currentPid) {
				return -1;
			}
			if (b.ppid === currentPid) {
				return 1;
			}
			return 0;
		});
	}

	getPortListCommand(pid: number): string {
		this.targetPid = pid;
		if (this.platform === 'darwin') {
			return `lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null | grep -E "^\\S+\\s+${pid}\\s"`;
		}

		// Linux fallback chain
		return `ss -tlnp 2>/dev/null | grep "pid=${pid}," || lsof -nP -a -iTCP -sTCP:LISTEN -p ${pid} 2>/dev/null | grep -E "^\\S+\\s+${pid}\\s" || netstat -tulpn 2>/dev/null | grep ${pid}`;
	}

	async ensurePortCommandAvailable(): Promise<void> {
		await this.detectAvailablePortCommand();
	}

	parseListeningPorts(stdout: string): number[] {
		const ports: number[] = [];
		if (this.platform === 'darwin') {
			const lines = stdout.split('\n');
			for (const line of lines) {
				if (!line.includes('(LISTEN)')) {
					continue;
				}
				const portMatch = line.match(/[*\d.:]+:(\d+)\s+\(LISTEN\)/);
				if (portMatch) {
					const port = parseInt(portMatch[1], 10);
					if (!ports.includes(port)) {
						ports.push(port);
					}
				}
			}
		} else {
			// Linux parsing for ss/lsof/netstat mixed output
			const ssRegex = /LISTEN\s+\d+\s+\d+\s+(?:\*|[\d.]+|\[[\da-f:]*\]):(\d+)/gi;
			let match;
			while ((match = ssRegex.exec(stdout)) !== null) {
				const p = parseInt(match[1], 10);
				if (!ports.includes(p)) {
					ports.push(p);
				}
			}
			if (ports.length === 0) {
				const lsofRegex = /(?:TCP|UDP)\s+(?:\*|[\d.]+|\[[\da-f:]+\]):(\d+)\s+\(LISTEN\)/gi;
				while ((match = lsofRegex.exec(stdout)) !== null) {
					const p = parseInt(match[1], 10);
					if (!ports.includes(p)) {
						ports.push(p);
					}
				}
			}
		}
		return ports.sort((a, b) => a - b);
	}

	getErrorMessages() {
		return {
			processNotFound: 'Process not found',
			commandNotAvailable: 'Command check failed',
			requirements: ['lsof or netstat or ss'],
		};
	}

	getDiagnosticCommand(): string {
		return "ps aux | grep -E 'language|antigravity' | grep -v grep";
	}
}
