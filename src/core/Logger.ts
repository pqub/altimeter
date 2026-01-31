export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

class Logger {
	private outputChannel: any | null = null;
	private logLevel: LogLevel = LogLevel.INFO;

	init(): void {
		try {
			// Lazy load vscode to allow unit testing outside of extension host
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const vscode = require('vscode');
			this.outputChannel = vscode.window.createOutputChannel('Altimeter');
		} catch {
			// Not in VS Code environment - fallback to console only
		}
	}

	private log(level: LogLevel, levelStr: string, message: string): void {
		if (level < this.logLevel) {
			return;
		}
		const timestamp = new Date().toISOString();
		const msg = `[${timestamp}] [${levelStr}] ${message}`;
		this.outputChannel?.appendLine(msg);
		console.log(msg);
	}

	debug(message: string): void {
		this.log(LogLevel.DEBUG, 'DEBUG', message);
	}
	info(message: string): void {
		this.log(LogLevel.INFO, 'INFO', message);
	}
	warn(message: string): void {
		this.log(LogLevel.WARN, 'WARN', message);
	}
	error(message: string): void {
		this.log(LogLevel.ERROR, 'ERROR', message);
	}
}

export const logger = new Logger();
