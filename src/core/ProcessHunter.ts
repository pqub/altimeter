/**
 * Based on local server interaction parts from:
 * https://github.com/jlcodes99/vscode-antigravity-cockpit.git
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';
import { WindowsStrategy, UnixStrategy } from './strategies';
import { logger } from './Logger';
import { EnvironmentScanResult, PlatformStrategy, ProcessInfo, ScanDiagnostics } from './types';
import { TIMING, PROCESS_NAMES, LS_ENDPOINTS } from './constants';

const execAsync = promisify(exec);

export class ProcessHunter {
    private strategy: PlatformStrategy;
    private targetProcess: string;
    private execFn: any;
    private lastDiagnostics: ScanDiagnostics = {
        scan_method: 'unknown',
        target_process: '',
        attempts: 0,
        found_candidates: 0,
    };

    constructor(injectedExec?: any) {
        this.execFn = injectedExec || execAsync;
        logger.debug(`Initializing ProcessHunter. Platform: ${process.platform}, Arch: ${process.arch}`);

        if (process.platform === 'win32') {
            this.strategy = new WindowsStrategy();
            this.targetProcess = PROCESS_NAMES.windows;
        } else if (process.platform === 'darwin') {
            this.strategy = new UnixStrategy('darwin');
            this.targetProcess = process.arch === 'arm64'
                ? PROCESS_NAMES.darwin_arm
                : PROCESS_NAMES.darwin_x64;
        } else {
            this.strategy = new UnixStrategy('linux');
            this.targetProcess = PROCESS_NAMES.linux;
        }
    }

    async scanEnvironment(maxAttempts: number = 3): Promise<EnvironmentScanResult | null> {
        logger.info(`Scanning environment, max attempts: ${maxAttempts}`);

        let result = await this.scanByProcessName(maxAttempts);
        if (result) { return result; }

        if (process.platform === 'win32' && this.strategy instanceof WindowsStrategy) {
            result = await this.scanByKeyword();
            if (result) { return result; }
        }

        await this.runDiagnostics();
        return null;
    }

    private async scanByProcessName(maxAttempts: number): Promise<EnvironmentScanResult | null> {
        this.lastDiagnostics = {
            scan_method: 'process_name',
            target_process: this.targetProcess,
            attempts: maxAttempts,
            found_candidates: 0,
        };

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const cmd = this.strategy.getProcessListCommand(this.targetProcess);
                const { stdout } = await this.execFn(cmd, { timeout: TIMING.PROCESS_CMD_TIMEOUT_MS });

                if (!stdout || !stdout.trim()) { continue; }

                const candidates = this.strategy.parseProcessInfo(stdout);
                if (candidates.length > 0) {
                    this.lastDiagnostics.found_candidates = candidates.length;
                    for (const info of candidates) {
                        const result = await this.verifyAndConnect(info);
                        if (result) { return result; }
                    }
                }
            } catch (e: any) {
                logger.error(`Attempt ${i + 1} failed: ${e.message}`);
                // Simple retry delay
                if (i < maxAttempts - 1) {
                    await new Promise(r => setTimeout(r, TIMING.PROCESS_SCAN_RETRY_MS));
                }
            }
        }
        return null;
    }

    private async scanByKeyword(): Promise<EnvironmentScanResult | null> {
        if (!(this.strategy instanceof WindowsStrategy)) { return null; }

        try {
            const cmd = this.strategy.getProcessByKeywordCommand();
            const { stdout } = await this.execFn(cmd, { timeout: TIMING.PROCESS_CMD_TIMEOUT_MS });
            const candidates = this.strategy.parseProcessInfo(stdout);

            for (const info of candidates) {
                const result = await this.verifyAndConnect(info);
                if (result) { return result; }
            }
        } catch (e: any) {
            logger.error(`Keyword search failed: ${e.message}`);
        }
        return null;
    }

    private async verifyAndConnect(info: ProcessInfo): Promise<EnvironmentScanResult | null> {
        const ports = await this.identifyPorts(info.pid);
        if (ports.length > 0) {
            const validPort = await this.verifyConnection(ports, info.csrfToken);
            if (validPort) {
                logger.info(`✅ Verified connection on port ${validPort}`);
                return {
                    extensionPort: info.extensionPort,
                    connectPort: validPort,
                    csrfToken: info.csrfToken,
                };
            }
        }
        return null;
    }

    private async identifyPorts(pid: number): Promise<number[]> {
        try {
            if (this.strategy instanceof UnixStrategy) {
                await this.strategy.ensurePortCommandAvailable();
            }
            const cmd = this.strategy.getPortListCommand(pid);
            const { stdout } = await this.execFn(cmd);
            return this.strategy.parseListeningPorts(stdout);
        } catch (e: any) {
            logger.error(`Port ID failed: ${e.message}`);
            return [];
        }
    }

    private async verifyConnection(ports: number[], token: string): Promise<number | null> {
        for (const port of ports) {
            if (await this.pingPort(port, token)) { return port; }
        }
        return null;
    }

    private pingPort(port: number, token: string): Promise<boolean> {
        return new Promise(resolve => {
            const options: https.RequestOptions = {
                hostname: '127.0.0.1',
                port,
                path: '/' + LS_ENDPOINTS.GET_UNLEASH_DATA,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Codeium-Csrf-Token': token,
                    'Connect-Protocol-Version': '1',
                },
                rejectUnauthorized: false,
                timeout: 5000,
                agent: false,
            };

            const req = https.request(options, res => resolve(res.statusCode === 200));
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.write(JSON.stringify({ wrapper_data: {} }));
            req.end();
        });
    }

    private async runDiagnostics(): Promise<void> {
        try {
            const cmd = this.strategy.getDiagnosticCommand();
            const { stdout } = await execAsync(cmd, { timeout: 5000 });
            logger.info(`Diagnostics:\n${stdout}`);
        } catch (e: any) {
            logger.error(`Diagnostics failed: ${e.message}`);
        }
    }
}
