export interface ProcessInfo {
	pid: number;
	extensionPort: number;
	csrfToken: string;
}

export interface EnvironmentScanResult {
	extensionPort: number;
	connectPort: number;
	csrfToken: string;
}

export interface ScanDiagnostics {
	scan_method: 'process_name' | 'keyword' | 'unknown';
	target_process: string;
	attempts: number;
	found_candidates: number;
	ports?: number[];
	verified_port?: number | null;
	verification_success?: boolean;
}

export interface PlatformStrategy {
	getProcessListCommand(processName: string): string;
	parseProcessInfo(stdout: string): ProcessInfo[];
	getPortListCommand(pid: number): string;
	parseListeningPorts(stdout: string): number[];
	getDiagnosticCommand(): string;
	getErrorMessages(): {
		processNotFound: string;
		commandNotAvailable: string;
		requirements: string[];
	};
}
