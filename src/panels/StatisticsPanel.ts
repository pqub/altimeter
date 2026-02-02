/**
 * StatisticsPanel - WebView Panel for token usage statistics
 *
 * Design: Singleton pattern to ensure only one panel exists.
 * Uses Chart.js for visualization via local bundle.
 */

import * as vscode from 'vscode';
import { LSClient } from '../core/LSClient';
import { ProcessHunter } from '../core/ProcessHunter';
import { DailyStatsAggregator } from '../services/DailyStatsAggregator';
import { ConversationService } from '../services/ConversationService';
import { getDisplayNameColorMap, getOrderedDisplayNames } from '../shared/ModelCatalog';
import { TemplateEngine } from '../shared/TemplateEngine';
import htmlTemplate from './templates/statistics.html';

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
				message: `Processing ${filtered.length} conversations...`,
			});

			const allMetadata: any[] = [];
			const allSteps: any[] = [];

			for (const cascade of filtered) {
				try {
					const res = await conversationService.fetchAllData(cascade.cascadeId);
					allMetadata.push(...res.metadata);
					allSteps.push(...res.steps);
				} catch {
					// Skip failed fetches
				}
			}

			const dailyStats = DailyStatsAggregator.aggregateByDay(allMetadata, allSteps, 8);
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
		const webview = this._panel.webview;
		const chartJsUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._extensionUri, 'resources', 'libs', 'chart.min.js'),
		);

		const colorsJson = JSON.stringify(getDisplayNameColorMap());
		const orderJson = JSON.stringify(getOrderedDisplayNames());

		// More strict CSP: use webview.cspSource for local assets
		const csp = `default-src 'none'; img-src https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src 'unsafe-inline';`;

		return TemplateEngine.render(htmlTemplate, {
			csp,
			chartJsUri: chartJsUri.toString(),
			colorsJson,
			orderJson,
		});
	}
}
