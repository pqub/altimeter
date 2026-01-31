import * as vscode from 'vscode';
import { ProcessHunter } from './core/ProcessHunter';
import { LSClient } from './core/LSClient';
import { CacheManager } from './core/CacheManager';
import { logger } from './core/Logger';
import { StatsService } from './services/StatsService';
import { ConversationService } from './services/ConversationService';
import { AggregatedStats } from './shared/types';

let client: LSClient | undefined;
const cache = new CacheManager();

const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4'];

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar WebviewViewProvider - Pure Vanilla JS (No React)
// ─────────────────────────────────────────────────────────────────────────────
class AltimeterViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'altimeter.mainView';
	private _view?: vscode.WebviewView;
	private _refreshInterval?: NodeJS.Timeout;

	constructor(private readonly _extensionUri: vscode.Uri) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext, // eslint-disable-line @typescript-eslint/no-unused-vars
		_token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		// Set initial loading state
		this._updateHtml({ loading: true });

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'refresh') {
				await this._fetchCurrentSessionStats();
			}
		});

		// When view becomes visible
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				this._startAutoRefresh();
			} else {
				this._stopAutoRefresh();
			}
		});

		// Initial fetch
		this._fetchCurrentSessionStats();
		this._startAutoRefresh();

		// Cleanup on dispose
		webviewView.onDidDispose(() => {
			this._stopAutoRefresh();
		});
	}

	private _startAutoRefresh() {
		this._stopAutoRefresh();
		this._refreshInterval = setInterval(() => {
			this._fetchCurrentSessionStats();
		}, 30000);
	}

	private _stopAutoRefresh() {
		if (this._refreshInterval) {
			clearInterval(this._refreshInterval);
			this._refreshInterval = undefined;
		}
	}

	public triggerRefresh() {
		logger.info('[Sidebar] Manual refresh triggered');
		this._fetchCurrentSessionStats();
	}

	private async _fetchCurrentSessionStats() {
		if (!this._view) { return; }

		try {
			if (!client) {
				const hunter = new ProcessHunter();
				const result = await hunter.scanEnvironment();
				if (!result) {
					this._updateHtml({ error: 'Language Server not found' });
					return;
				}
				client = new LSClient(result.connectPort, result.csrfToken);
				logger.info(`[Sidebar] Connected on port ${result.connectPort}`);
			}

			logger.info('[Sidebar] Fetching latest conversation...');
			const conversationService = new ConversationService(client);
			const latest = await conversationService.getLatestConversation();

			if (!latest) {
				logger.error('[Sidebar] No latest conversation found');
				this._updateHtml({ error: 'No active session found' });
				return;
			}

			logger.info(`[Sidebar] Latest conversation: ${latest.cascadeId}`);

			// Check cache validity
			if (cache.isValid(latest.cascadeId, latest.lastModifiedTime)) {
				const cachedStats = cache.get();
				if (cachedStats) {
					logger.info(`[Sidebar] Using cached stats (${cache.getInfo()})`);
					this._updateHtml({ stats: cachedStats });
					return;
				}
			}

			logger.info(`[Sidebar] Fetching metadata for ${latest.cascadeId}...`);
			const response = await client.getCascadeMetadata(latest.cascadeId);
			const stats = StatsService.calculateStats(response.generatorMetadata || []);
			logger.info(`[Sidebar] Stats: ${stats.totalCalls} calls`);

			// Store in cache
			cache.set(latest.cascadeId, latest.lastModifiedTime, stats);

			this._updateHtml({ stats });

		} catch (e: any) {
			logger.error(`[Sidebar] Error: ${e.message}`);
			this._updateHtml({ error: e.message });
		}
	}

	private _updateHtml(state: { loading?: boolean; error?: string; stats?: AggregatedStats }) {
		if (!this._view) { return; }

		let content = '';

		if (state.loading) {
			content = '<div class="center">Loading...</div>';
		} else if (state.error) {
			content = `
				<div class="center">
					<p>${state.error}</p>
					<button id="retry">Retry</button>
				</div>`;
		} else if (state.stats) {
			const s = state.stats;
			const totalInput = s.totalInput + s.totalCacheRead;
			const cacheEff = totalInput > 0 ? ((s.totalCacheRead / totalInput) * 100).toFixed(1) : '0';

			const modelsHtml = s.modelBreakdown.map((m, idx) => {
				const mInput = m.input + m.cacheRead;
				const mEff = mInput > 0 ? ((m.cacheRead / mInput) * 100).toFixed(1) : '0';
				return `
					<div class="model-row">
						<span class="dot" style="background:${COLORS[idx % COLORS.length]}"></span>
						<div class="model-info">
							<span class="model-name">${m.displayName}</span>
							<div class="model-details">
								${m.calls} calls · ${mInput.toLocaleString()} in · ${m.output.toLocaleString()} out
							</div>
							<div class="model-meta">Cache: ${mEff}%</div>
						</div>
					</div>`;
			}).join('');

			content = `
				<div class="section">
					<div class="row"><span>Input Tokens</span><span class="value">${totalInput.toLocaleString()}</span></div>
					<div class="row"><span>Output Tokens</span><span class="value">${s.totalOutput.toLocaleString()}</span></div>
					<div class="row"><span>API Calls</span><span class="value">${s.totalCalls.toLocaleString()}</span></div>
				</div>
				<div class="section">
					<div class="row"><span>Context</span><span class="value">${s.lastContextSize.toLocaleString()}</span></div>
					<div class="row"><span>Cache Efficiency</span><span class="value">${cacheEff}%</span></div>
				</div>
				<div class="section">
					<div class="section-title">Models</div>
					${modelsHtml}
				</div>`;
		}

		this._view.webview.html = this._getHtml(content);
	}

	private _getHtml(content: string): string {
		const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';`;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<style>
		body {
			font-family: var(--vscode-font-family);
			font-size: 12px;
			color: var(--vscode-foreground);
			padding: 8px 12px;
			margin: 0;
		}
		.center {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 100px;
			gap: 8px;
		}
		.section {
			margin-bottom: 12px;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		.section-title {
			font-size: 11px;
			opacity: 0.7;
			margin-bottom: 6px;
		}
		.row {
			display: flex;
			justify-content: space-between;
			padding: 2px 0;
		}
		.value {
			font-weight: 600;
			color: var(--vscode-textLink-foreground);
		}
		.model-row {
			display: flex;
			align-items: flex-start;
			gap: 8px;
			margin-bottom: 8px;
		}
		.dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			margin-top: 4px;
			flex-shrink: 0;
		}
		.model-info { display: flex; flex-direction: column; min-width: 0; }
		.model-name { font-weight: 500; }
		.model-details { font-size: 10px; opacity: 0.8; }
		.model-meta { font-size: 10px; opacity: 0.6; }
	</style>
</head>
<body>
	${content}
	<script>
		const vscode = acquireVsCodeApi();
		document.addEventListener('click', (e) => {
			if (e.target.id === 'refresh' || e.target.id === 'retry') {
				vscode.postMessage({ command: 'refresh' });
			}
		});
	</script>
</body>
</html>`;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension Activation
// ─────────────────────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
	logger.init();
	logger.info('Altimeter is now active!');

	const provider = new AltimeterViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AltimeterViewProvider.viewType, provider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('altimeter.refresh', () => {
			provider.triggerRefresh();
		})
	);
}

export function deactivate() { }
