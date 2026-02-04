import * as vscode from 'vscode';
import { ProcessHunter } from './core/ProcessHunter';
import { LSClient } from './core/LSClient';
import { CacheManager } from './core/CacheManager';
import { logger } from './core/Logger';
import { StatsService } from './services/StatsService';
import { ConversationService } from './services/ConversationService';
import { StatisticsPanel } from './panels/StatisticsPanel';
import { AggregatedStats } from './shared/types';
import { getDisplayNameColorMap } from './shared/ModelCatalog';
import { TemplateEngine } from './shared/TemplateEngine';
import sidebarHtml from './panels/templates/sidebar.html';

let client: LSClient | undefined;
const cache = new CacheManager();
const colorMap = getDisplayNameColorMap();
const DEFAULT_MODEL_COLOR = '#6B7280';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar WebviewViewProvider - Pure Vanilla JS (No React)
// ─────────────────────────────────────────────────────────────────────────────
class AltimeterViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'altimeter.mainView';
	private _view?: vscode.WebviewView;
	private _refreshInterval?: NodeJS.Timeout;
	private _chartsExpanded: boolean = false;

	constructor(private readonly _extensionUri: vscode.Uri) {
		// Initialize local state from config
		this._chartsExpanded = vscode.workspace
			.getConfiguration('altimeter')
			.get<boolean>('chartsExpanded', false);

		// Listen for configuration changes to keep local state in sync (e.g. manual settings edit)
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('altimeter.chartsExpanded')) {
				this._chartsExpanded = vscode.workspace
					.getConfiguration('altimeter')
					.get<boolean>('chartsExpanded', false);
				logger.info(
					`[Sidebar] Configuration changed externally. _chartsExpanded: ${this._chartsExpanded}`,
				);
				// Trigger a re-render if the view is visible
				if (this._view && this._view.visible) {
					this._fetchCurrentSessionStats(false);
				}
			}
		});
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext, // eslint-disable-line @typescript-eslint/no-unused-vars
		_token: vscode.CancellationToken, // eslint-disable-line @typescript-eslint/no-unused-vars
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri],
		};

		// Set initial loading state
		this._updateHtml({ loading: true });

		// Handle messages from webview
		webviewView.webview.onDidReceiveMessage(async (message) => {
			if (message.command === 'refresh') {
				await this._fetchCurrentSessionStats();
			} else if (message.command === 'toggleCharts') {
				this._chartsExpanded = message.expanded;
				const config = vscode.workspace.getConfiguration('altimeter');
				await config.update('chartsExpanded', message.expanded, vscode.ConfigurationTarget.Global);
				logger.info(
					`[Sidebar] Charts expanded state updated synchronously to: ${message.expanded}`,
				);
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
		}, 60000);
	}

	private _stopAutoRefresh() {
		if (this._refreshInterval) {
			clearInterval(this._refreshInterval);
			this._refreshInterval = undefined;
		}
	}

	public triggerRefresh() {
		logger.info('[Sidebar] Manual refresh triggered');
		this._fetchCurrentSessionStats(true);
	}

	private async _fetchCurrentSessionStats(force: boolean = false) {
		if (!this._view) {
			return;
		}

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

			if (force) {
				logger.info('[Sidebar] Forced refresh...');
			} else {
				logger.info('[Sidebar] Fetching latest conversation...');
			}
			const conversationService = new ConversationService(client);
			const latest = await conversationService.getLatestConversation();

			if (!latest) {
				logger.error('[Sidebar] No latest conversation found');
				this._updateHtml({ error: 'No active session found' });
				return;
			}

			if (force) {
				logger.info(`[Sidebar] Forced refresh for ${latest.cascadeId}`);
			} else {
				logger.info(`[Sidebar] Latest conversation: ${latest.cascadeId}`);
			}

			// 1. Check if we have a valid cache entry for this cascade
			const cachedEntry = cache.getEntry();

			let finalStats: AggregatedStats;
			let isNew = false;

			// If cached entry matches current cascade
			if (cachedEntry && cachedEntry.cascadeId === latest.cascadeId) {
				// Optimization: If lastModifiedTime matches exactly and NOT forced, no new data can exist
				if (!force && cachedEntry.lastModifiedTime === latest.lastModifiedTime) {
					logger.info(`[Sidebar] Cache is up to date (${latest.lastModifiedTime})`);
					finalStats = cachedEntry.stats;
				} else {
					if (force) {
						logger.info(`[Sidebar] Forced delta fetch despite timestamp.`);
					} else {
						logger.info(`[Sidebar] Found cached session but timestamp updated. Fetching delta...`);
					}

					// Fetch only new items
					const delta = await conversationService.fetchSessionData(
						latest.cascadeId,
						cachedEntry.nextMetaOffset,
						cachedEntry.nextStepOffset,
					);

					if (delta.metadata.length > 0 || delta.steps.length > 0) {
						if (delta.steps.some((s: any) => s.type === 'CORTEX_STEP_TYPE_CHECKPOINT')) {
							logger.info(`[Sidebar] Detected checkpoint operations in delta.`);
						}
						isNew = true;

						// Calculate stats for the delta
						const deltaStats = StatsService.calculateStats(delta.metadata, delta.steps);

						// Merge with cached stats
						finalStats = StatsService.mergeStats(cachedEntry.stats, deltaStats);

						// Update cache
						cache.set(
							latest.cascadeId,
							latest.lastModifiedTime,
							finalStats,
							delta.nextMetaOffset,
							delta.nextStepOffset,
						);
					} else {
						logger.info(`[Sidebar] No new items found despite updated timestamp.`);
						finalStats = cachedEntry.stats;
						// Update timestamp in cache so we don't try delta again for the same timestamp
						cache.set(
							latest.cascadeId,
							latest.lastModifiedTime,
							finalStats,
							cachedEntry.nextMetaOffset,
							cachedEntry.nextStepOffset,
						);
					}
				}
			} else {
				// No cache or switched conversation -> Fetch all
				logger.info(`[Sidebar] Fetching fresh data for ${latest.cascadeId}...`);
				const res = await conversationService.fetchSessionData(latest.cascadeId, 0, 0);
				isNew = true;

				finalStats = StatsService.calculateStats(res.metadata, res.steps);

				// Initialize cache
				cache.set(
					latest.cascadeId,
					latest.lastModifiedTime,
					finalStats,
					res.nextMetaOffset,
					res.nextStepOffset,
				);
			}

			if (isNew) {
				logger.info(`[Sidebar] Stats Update: ${finalStats.totalCalls} calls`);
			}
			this._updateHtml({ stats: finalStats });
		} catch (e: any) {
			logger.error(`[Sidebar] Error: ${e.message}`);
			this._updateHtml({ error: e.message });
		}
	}

	private _updateHtml(state: { loading?: boolean; error?: string; stats?: AggregatedStats }) {
		if (!this._view) {
			return;
		}

		let content = '';
		let chartData = null;

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

			// Prepare Chart Data
			const inputData = s.modelBreakdown
				.map((m) => ({
					label: m.displayName,
					value: m.input + m.cacheRead,
					color: colorMap[m.displayName] || DEFAULT_MODEL_COLOR,
				}))
				.filter((d) => d.value > 0);
			// Reverse for stacking order (optional, but usually better visual)
			inputData.reverse();

			const outputData = s.modelBreakdown
				.map((m) => ({
					label: m.displayName,
					value: m.output,
					color: colorMap[m.displayName] || DEFAULT_MODEL_COLOR,
				}))
				.filter((d) => d.value > 0);
			outputData.reverse();

			chartData = { input: inputData, output: outputData };

			const modelsHtml = s.modelBreakdown
				.map((m) => {
					const mInput = m.input + m.cacheRead;
					const mEff = mInput > 0 ? ((m.cacheRead / mInput) * 100).toFixed(1) : '0';
					const color = colorMap[m.displayName] || DEFAULT_MODEL_COLOR;
					return `
					<div class="model-row">
						<span class="dot" style="background:${color}"></span>
						<div class="model-info">
							<span class="model-name">${m.displayName}</span>
							<div class="model-details">
								${m.calls} calls · ${mInput.toLocaleString()} in · ${m.output.toLocaleString()} out
							</div>
							<div class="model-meta">Cache: ${mEff}%</div>
						</div>
					</div>`;
				})
				.join('');

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
				</div>

				<div class="section" style="border-bottom: none">
					<div class="section-title collapsible" id="toggle-charts">
						<span>Token Distribution</span>
						<span id="chevron" class="chevron">▶</span>
					</div>
					
					<div id="charts-container" class="hidden">
						<div class="header-row">
							<span class="chart-label">Input Distribution</span>
						</div>
						<div class="chart-wrapper pie-container">
							<canvas id="inputPieChart"></canvas>
						</div>

						<div class="header-row" style="margin-top: 20px">
							<span class="chart-label">Output Distribution</span>
						</div>
						<div class="chart-wrapper pie-container">
							<canvas id="outputPieChart"></canvas>
						</div>
					</div>
				</div>`;
		}

		// Use local tracked state to avoid lag from config.update propagation
		const chartsExpanded = this._chartsExpanded;
		logger.info(`[Sidebar] Rendering with chartsExpanded: ${chartsExpanded}`);

		const webview = this._view!.webview;
		const chartJsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'resources', 'libs', 'chart.min.js'),
		);
		const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src https:;`;

		const chartScript = chartData
			? `
			<script>
				const ctxIn = document.getElementById('inputPieChart').getContext('2d');
				const ctxOut = document.getElementById('outputPieChart').getContext('2d');
				
				const pieConfig = (title, data) => {
					const total = data.reduce((sum, d) => sum + d.value, 0);
					return {
						type: 'pie',
						data: {
							labels: data.map(d => d.label),
							datasets: [{
								data: data.map(d => d.value),
								backgroundColor: data.map(d => d.color),
								borderWidth: 1,
								borderColor: 'rgba(255,255,255,0.1)'
							}]
						},
						options: {
							animation: false,
							responsive: true,
							maintainAspectRatio: true,
							plugins: {
								legend: { display: false },
								tooltip: {
									displayColors: false,
									callbacks: {
										title: () => '',
										label: (ctx) => {
											const val = ctx.raw;
											const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
											return ctx.label + ': ' + pct + '%';
										}
									}
								}
							}
						}
					};
				};

				new Chart(ctxIn, pieConfig('Input', ${JSON.stringify(chartData.input)}));
				new Chart(ctxOut, pieConfig('Output', ${JSON.stringify(chartData.output)}));
			</script>`
			: '';

		const initialScript = `
			<script>
				(function() {
					const chartsContainer = document.getElementById('charts-container');
					const chevron = document.getElementById('chevron');
					const toggleCharts = document.getElementById('toggle-charts');
					let isExpanded = ${chartsExpanded};

					function updateUI() {
						if (!chartsContainer || !chevron) return;
						if (isExpanded) {
							chartsContainer.classList.remove('hidden');
							chevron.innerText = '▼';
						} else {
							chartsContainer.classList.add('hidden');
							chevron.innerText = '▶';
						}
					}

					// Apply initial state
					updateUI();

					if (toggleCharts) {
						toggleCharts.addEventListener('click', () => {
							isExpanded = !isExpanded;
							updateUI();
							console.log('Sidebar toggleCharts:', isExpanded);
							window.vscode.postMessage({ 
								command: 'toggleCharts', 
								expanded: isExpanded 
							});
						});
					}
				})();
			</script>`;

		this._view.webview.html = TemplateEngine.render(sidebarHtml, {
			csp,
			chartJsUri: chartJsUri.toString(),
			content,
			chartScript: chartScript || '',
			initialScript,
		});
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
		vscode.window.registerWebviewViewProvider(AltimeterViewProvider.viewType, provider),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('altimeter.refresh', () => {
			provider.triggerRefresh();
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('altimeter.openStatistics', () => {
			StatisticsPanel.createOrShow(context.extensionUri);
		}),
	);
}

export function deactivate() {}
