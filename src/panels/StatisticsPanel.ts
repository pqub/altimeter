/**
 * StatisticsPanel - WebView Panel for token usage statistics
 *
 * Design: Singleton pattern to ensure only one panel exists.
 * Uses Chart.js for visualization via CDN.
 */

import * as vscode from 'vscode';
import { LSClient } from '../core/LSClient';
import { ProcessHunter } from '../core/ProcessHunter';
import { DailyStatsAggregator } from '../services/DailyStatsAggregator';
import { ConversationService } from '../services/ConversationService';
import { getDisplayNameColorMap, getOrderedDisplayNames } from '../shared/ModelCatalog';

export class StatisticsPanel {
	public static currentPanel: StatisticsPanel | undefined;
	private static readonly viewType = 'altimeter.statisticsPanel';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		this._panel.webview.html = this._getHtmlForWebview();

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			(message) => this._onMessage(message),
			null,
			this._disposables,
		);
	}

	public static createOrShow(extensionUri: vscode.Uri): void {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (StatisticsPanel.currentPanel) {
			StatisticsPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			StatisticsPanel.viewType,
			'Altimeter Statistics',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			},
		);

		StatisticsPanel.currentPanel = new StatisticsPanel(panel, extensionUri);
	}

	public dispose(): void {
		StatisticsPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const d = this._disposables.pop();
			if (d) {
				d.dispose();
			}
		}
	}

	private async _onMessage(message: { command: string }): Promise<void> {
		if (message.command === 'generateStats') {
			await this._generateStatistics();
		}
	}

	private async _generateStatistics(): Promise<void> {
		this._postMessage({ command: 'loading', message: 'Fetching trajectories...' });

		try {
			const client = await this._getClient();
			if (!client) {
				this._postMessage({ command: 'error', message: 'Language server not connected' });
				return;
			}

			const conversationService = new ConversationService(client);
			const cascades = await conversationService.fetchSortedConversations();

			const filtered = DailyStatsAggregator.filterByModifiedDate(cascades, 8);
			this._postMessage({
				command: 'loading',
				message: `Processing ${filtered.length} cascades...`,
			});

			const allMetadata: any[] = [];
			for (const cascade of filtered) {
				try {
					const meta = await client.getCascadeMetadata(cascade.cascadeId);
					if (meta?.generatorMetadata) {
						for (const item of meta.generatorMetadata) {
							if (!item.timestamp && cascade.lastModifiedTime) {
								item.timestamp = cascade.lastModifiedTime;
							}
							allMetadata.push(item);
						}
					}
				} catch {
					// Skip failed metadata fetches
				}
			}

			const dailyStats = DailyStatsAggregator.aggregateByDay(allMetadata, 8);
			this._postMessage({ command: 'statsReady', data: dailyStats });
		} catch (error: any) {
			this._postMessage({ command: 'error', message: error.message || 'Unknown error' });
		}
	}

	private async _getClient(): Promise<LSClient | null> {
		const hunter = new ProcessHunter();
		const result = await hunter.scanEnvironment();
		if (!result) {
			return null;
		}
		return new LSClient(result.connectPort, result.csrfToken);
	}

	private _postMessage(message: any): void {
		this._panel.webview.postMessage(message);
	}

	private _getHtmlForWebview(): string {
		const colorsJson = JSON.stringify(getDisplayNameColorMap());
		const orderJson = JSON.stringify(getOrderedDisplayNames());
		const csp = `default-src 'none'; img-src https:; script-src https: 'unsafe-inline'; style-src https: 'unsafe-inline';`;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<title>Altimeter Statistics</title>
	<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
	<style>
		body {
			font-family: var(--vscode-font-family);
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			padding: 20px;
			margin: 0;
		}
		.header { margin-bottom: 20px; }
		.header h1 { margin: 0 0 10px 0; font-size: 1.5em; }
		.header p { margin: 0; opacity: 0.8; font-size: 0.9em; }
		.generate-btn {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			border: none;
			padding: 10px 20px;
			cursor: pointer;
			font-size: 14px;
			border-radius: 4px;
			margin-top: 15px;
		}
		.generate-btn:hover { background: var(--vscode-button-hoverBackground); }
		.generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
		.loading { padding: 20px; text-align: center; }
		.error { color: var(--vscode-errorForeground); padding: 20px; }
		.charts { display: none; }
		.chart-container { margin-bottom: 40px; }
		.chart-container h2 { font-size: 1.1em; margin-bottom: 15px; opacity: 0.9; }
		canvas { max-height: 350px; }
		
		.table-section { margin-bottom: 30px; }
		.table-title { 
			font-size: 1.0em; 
			font-weight: 600; 
			margin-bottom: 8px; 
			color: var(--vscode-keywords-foreground);
			display: flex;
			align-items: center;
			gap: 8px;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			font-size: 0.85em;
			background: var(--vscode-editor-background);
			border: 1px solid var(--vscode-panel-border);
		}
		th, td {
			padding: 8px 12px;
			text-align: right;
			border-bottom: 1px solid var(--vscode-panel-border);
		}
		th:first-child, td:first-child { text-align: left; }
		th { 
			background: var(--vscode-editor-inactiveSelectionBackground); 
			cursor: pointer;
			user-select: none;
		}
		th:hover { background: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-selectionForeground); }
		tr:hover { background: var(--vscode-list-hoverBackground); }
		.grand-total { font-weight: bold; background: var(--vscode-editor-inactiveSelectionBackground); }
		.notice {
			margin: 15px 0;
			font-size: 0.9em;
			opacity: 0.8;
			font-style: italic;
			color: var(--vscode-descriptionForeground);
		}
		.notice b { color: var(--vscode-button-background); }
		.total-tag {
			font-size: 0.8em;
			font-weight: normal;
			opacity: 0.8;
			margin-left: 10px;
			background: var(--vscode-badge-background);
			color: var(--vscode-badge-foreground);
			padding: 2px 8px;
			border-radius: 10px;
		}
	</style>
</head>
<body>
	<div id="initialState">
		<div class="header">
			<h1>📊 Token Usage Statistics</h1>
			<p>Analyze your token usage breakdown across all models for the last 8 days.</p>
			<div class="notice">
				Note: To refresh the data, please close and re-open this tab.
				<br><br>
				Statistics rely on available local conversation history. Frequent switching may limit historical data availability (e.g., full 8-day history might not be available).
			</div>
		</div>
		<button class="generate-btn" id="generateBtn" onclick="generateStats()">
			Generate Statistics
		</button>
	</div>

	<div id="loadingState" class="loading" style="display: none;">
		<p>⏳ <span id="loadingMessage">Loading...</span></p>
	</div>

	<div id="errorState" class="error" style="display: none;">
		<p>❌ <span id="errorMessage"></span></p>
		<button class="generate-btn" onclick="generateStats()">Retry</button>
	</div>

	<div id="chartsState" class="charts">
		<div class="chart-container">
			<h2 id="inputHeader">📥 Input Tokens</h2>
			<canvas id="inputChart"></canvas>
		</div>
		<div class="chart-container">
			<h2 id="outputHeader">📤 Output Tokens</h2>
			<canvas id="outputChart"></canvas>
		</div>
		
		<div id="tablesContainer"></div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const MODEL_COLORS = ${colorsJson};
		const MODEL_ORDER = ${orderJson};
		let inputChart = null;
		let outputChart = null;

		function generateStats() {
			document.getElementById('initialState').style.display = 'none';
			document.getElementById('loadingState').style.display = 'block';
			document.getElementById('errorState').style.display = 'none';
			document.getElementById('chartsState').style.display = 'none';
			document.getElementById('generateBtn').disabled = true;
			vscode.postMessage({ command: 'generateStats' });
		}

		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.command) {
				case 'loading':
					document.getElementById('loadingMessage').textContent = message.message;
					break;
				case 'statsReady':
					showStats(message.data);
					break;
				case 'error':
					showError(message.message);
					break;
			}
		});

		function showError(msg) {
			document.getElementById('loadingState').style.display = 'none';
			document.getElementById('errorState').style.display = 'block';
			document.getElementById('errorMessage').textContent = msg;
			document.getElementById('generateBtn').disabled = false;
		}

		function showStats(data) {
			document.getElementById('loadingState').style.display = 'none';
			document.getElementById('chartsState').style.display = 'block';

			renderCharts(data);
			renderTables(data);
		}

		function renderCharts(data) {
			const labels = data.map(d => d.date).reverse();
			const allModels = [...new Set(data.flatMap(d => Object.keys(d.models)))];

			// Calculate Totals for Headers
			let totalIn = 0, totalOut = 0, totalCache = 0;
			data.forEach(d => {
				totalIn += d.totals.inputTokens + d.totals.cacheReadTokens;
				totalOut += d.totals.outputTokens;
				totalCache += d.totals.cacheReadTokens;
			});
			const totalEff = totalIn > 0 ? Math.round((totalCache / totalIn) * 100) : 0;

			// Update Headers
			document.getElementById('inputHeader').innerHTML = '📥 Input Tokens <span class="total-tag">' + formatNumber(totalIn) + ' (Cache: ' + totalEff + '%)</span>';
			document.getElementById('outputHeader').innerHTML = '📤 Output Tokens <span class="total-tag">' + formatNumber(totalOut) + '</span>';

			// Sort models by defined order
			allModels.sort((a, b) => {
				const ia = MODEL_ORDER.indexOf(a);
				const ib = MODEL_ORDER.indexOf(b);
				return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
			});

			const createDataset = (isInput) => allModels.map(model => {
				const values = data.map(d => {
					const m = d.models[model];
					return isInput 
						? (m?.inputTokens || 0) + (m?.cacheReadTokens || 0)
						: (m?.outputTokens || 0);
				}).reverse();
				
				const cachePercentages = isInput ? data.map(d => {
					const m = d.models[model];
					if (!m) return 0;
					const total = (m.inputTokens || 0) + (m.cacheReadTokens || 0);
					return total > 0 ? Math.round((m.cacheReadTokens / total) * 100) : 0;
				}).reverse() : null;

				return {
					label: model,
					data: values,
					cacheData: cachePercentages,
					backgroundColor: MODEL_COLORS[model] || '#6B7280',
					borderWidth: 0,
				};
			});

			const chartConfig = {
				type: 'bar',
				options: {
					indexAxis: 'y', // Horizontal bars
					responsive: true,
					maintainAspectRatio: false,
					plugins: { 
						legend: { position: 'bottom' },
						tooltip: {
							callbacks: {
								label: function(context) {
									let label = context.dataset.label || '';
									if (label) label += ': ';
									label += formatNumber(context.parsed.x);
									const cacheData = context.dataset.cacheData;
									if (cacheData && cacheData[context.dataIndex] !== undefined) {
										label += ' (Cache: ' + cacheData[context.dataIndex] + '%)';
									}
									return label;
								}
							}
						}
					},
					scales: {
						x: { 
							stacked: true,
							beginAtZero: true, 
							ticks: { callback: v => formatNumber(v) } 
						},
						y: { stacked: true }
					}
				}
			};

			if (inputChart) inputChart.destroy();
			inputChart = new Chart(document.getElementById('inputChart'), {
				...chartConfig,
				data: { labels, datasets: createDataset(true) }
			});

			if (outputChart) outputChart.destroy();
			outputChart = new Chart(document.getElementById('outputChart'), {
				...chartConfig,
				data: { labels, datasets: createDataset(false) }
			});
		}

		function renderTables(data) {
			const container = document.getElementById('tablesContainer');
			container.innerHTML = '';
			const allModels = new Set();
			data.forEach(d => Object.keys(d.models).forEach(m => allModels.add(m)));

			// Sort models by defined order
			const sortedModels = Array.from(allModels).sort((a, b) => {
				const ia = MODEL_ORDER.indexOf(a);
				const ib = MODEL_ORDER.indexOf(b);
				return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
			});

			// 1. Model Tables
			sortedModels.forEach(model => {
				const rows = [];
				let totalIn = 0, totalOut = 0, totalCache = 0, totalCalls = 0;

				data.forEach(day => {
					if (day.models[model]) {
						const s = day.models[model];
						const input = s.inputTokens + s.cacheReadTokens;
						const eff = input > 0 ? Math.round((s.cacheReadTokens / input) * 100) : 0;

						rows.push({
							date: day.date,
							input,
							output: s.outputTokens,
							cache: eff,
							calls: s.calls
						});

						totalIn += input;
						totalOut += s.outputTokens;
						totalCache += s.cacheReadTokens;
						totalCalls += s.calls;
					}
				});

				if (rows.length > 0) {
					const totalEff = totalIn > 0 ? Math.round((totalCache / totalIn) * 100) : 0;
					createTable(container, \`<span style="color:\${MODEL_COLORS[model]}">●</span> \${model}\`, rows, {
						date: 'TOTAL',
						input: totalIn,
						output: totalOut,
						cache: totalEff,
						calls: totalCalls
					});
				}
			});

			// 2. Daily Totals Table
			const dailyRows = data.map(day => {
				const input = day.totals.inputTokens + day.totals.cacheReadTokens;
				const eff = input > 0 ? Math.round((day.totals.cacheReadTokens / input) * 100) : 0;
				// Calculate total calls for the day across all models
				const dayCalls = Object.values(day.models).reduce((sum, model) => sum + (model.calls || 0), 0);
				return {
					date: day.date,
					input,
					output: day.totals.outputTokens,
					cache: eff,
					calls: dayCalls
				};
			});
			
			// Calculate Grand Total
			let gIn = 0, gOut = 0, gCache = 0, gCalls = 0;
			data.forEach(d => {
				gIn += d.totals.inputTokens + d.totals.cacheReadTokens;
				gOut += d.totals.outputTokens;
				gCache += d.totals.cacheReadTokens;
				gCalls += Object.values(d.models).reduce((sum, model) => sum + (model.calls || 0), 0);
			});
			const gEff = gIn > 0 ? Math.round((gCache / gIn) * 100) : 0;

			createTable(container, '📊 DAILY TOTALS (Aggregated)', dailyRows, {
				date: 'GRAND TOTAL',
				input: gIn,
				output: gOut,
				cache: gEff,
				calls: gCalls
			});
		}

function createTable(container, title, rows, totalRow) {
	const section = document.createElement('div');
	section.className = 'table-section';
	const tableId = 'tbl-' + Math.random().toString(36).substr(2, 9);

	let html = \`
				<div class="table-title">\${title}</div>
				<table id="\${tableId}">
					<thead>
						<tr>
							<th onclick="sortTable('\${tableId}', 0)">Date ↕</th>
							<th onclick="sortTable('\${tableId}', 1)">Input ↕</th>
							<th onclick="sortTable('\${tableId}', 2)">Output ↕</th>
							<th onclick="sortTable('\${tableId}', 3)">Cache % ↕</th>
							<th onclick="sortTable('\${tableId}', 4)">API Calls ↕</th>
						</tr>
					</thead>
					<tbody>\`;

			rows.forEach(row => {
				html += \`
					<tr>
						<td>\${row.date}</td>
						<td>\${formatNumber(row.input)}</td>
						<td>\${formatNumber(row.output)}</td>
						<td>\${row.cache}%</td>
						<td>\${formatNumber(row.calls || 0)}</td>
					</tr>\`;
			});

			html += \`
					<tr class="grand-total">
						<td>\${totalRow.date}</td>
						<td>\${formatNumber(totalRow.input)}</td>
						<td>\${formatNumber(totalRow.output)}</td>
						<td>\${totalRow.cache}%</td>
						<td>\${formatNumber(totalRow.calls || 0)}</td>
					</tr>
					</tbody>
				</table>\`;

			section.innerHTML = html;
			container.appendChild(section);
		}

		function sortTable(tableId, n) {
			var table, rows, switching, i, x, y, shouldSwitch, dir, switchcount = 0;
			table = document.getElementById(tableId);
			switching = true;
			dir = "asc"; 
			
			while (switching) {
				switching = false;
				rows = table.rows;
				// Loop through all table rows (except first, which contains table headers, and last which is total):
				for (i = 1; i < (rows.length - 2); i++) {
					shouldSwitch = false;
					x = rows[i].getElementsByTagName("TD")[n];
					y = rows[i + 1].getElementsByTagName("TD")[n];
					
					let xVal = x.innerHTML.toLowerCase();
					let yVal = y.innerHTML.toLowerCase();
					
					// Parse numbers tailored for K/M format if needed, but for now simple string compare might fail for K/M
					// Let's rely on simple string compare for Dates, but for numbers we should ideally parse.
					// Quick fix: remove K/M/% and parse float
					const parse = (val) => {
						let v = val.replace(/[KMB%]/g, '');
						let mult = 1;
						if (val.includes('K')) mult = 1000;
						if (val.includes('M')) mult = 1000000;
						return parseFloat(v) * mult;
					};

					if (n > 0) { // Number columns
						xVal = parse(x.innerText);
						yVal = parse(y.innerText);
					}

					if (dir == "asc") {
						if (xVal > yVal) { shouldSwitch = true; break; }
					} else if (dir == "desc") {
						if (xVal < yVal) { shouldSwitch = true; break; }
					}
				}
				if (shouldSwitch) {
					rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
					switching = true;
					switchcount ++;      
				} else {
					if (switchcount == 0 && dir == "asc") {
						dir = "desc";
						switching = true;
					}
				}
			}
		}

		function formatNumber(n) {
			if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
			if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
			return n.toString();
		}
	</script>
</body>
</html>`;
	}
}
