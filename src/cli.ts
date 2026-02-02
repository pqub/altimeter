#!/usr/bin/env ts-node
/**
 * Altimeter CLI - Verification & Testing Tool
 * Uses shared services for consistency with VSIX extension
 *
 * Usage:
 *   pnpm run test:cli list             # List all conversations
 *   pnpm run test:cli list --latest    # Show latest conversation only
 *   pnpm run test:cli stats --latest   # Calculate stats for latest conversation
 *   pnpm run test:cli stats --id <ID>  # Calculate stats for specific conversation
 */

import { ProcessHunter } from './core/ProcessHunter';
import { LSClient } from './core/LSClient';
import { logger } from './core/Logger';
import { ConversationService } from './services/ConversationService';
import { StatsService } from './services/StatsService';
import { DailyStatsAggregator } from './services/DailyStatsAggregator';
import { DailyModelStats } from './shared/types';
import { getOrderedDisplayNames } from './shared/ModelCatalog';
import { StatsFormatter, TrendRow } from './services/StatsFormatter';

// Initialize logger for console output
logger.info = (msg: string) => console.log(`[INFO] ${msg}`);
logger.error = (msg: string) => console.error(`[ERROR] ${msg}`);
logger.warn = (msg: string) => console.warn(`[WARN] ${msg}`);
logger.debug = (msg: string) => console.debug(`[DEBUG] ${msg}`);

async function discoverClient(): Promise<LSClient> {
	const hunter = new ProcessHunter();
	const result = await hunter.scanEnvironment();
	if (!result) {
		throw new Error('Could not discover Language Server. Is Windsurf running?');
	}
	logger.info(`✅ Connected on port ${result.connectPort}`);
	return new LSClient(result.connectPort, result.csrfToken);
}

function printStats(metadata: any[], steps: any[] = []): void {
	if ((!metadata || metadata.length === 0) && (!steps || steps.length === 0)) {
		console.log('  No generation metadata or steps found.');
		return;
	}

	// Use the shared StatsService for calculation
	const stats = StatsService.calculateStats(metadata, steps); // Updated to accept steps

	console.log('\n📊 Token Usage by Model:');
	console.log('─'.repeat(80));
	console.log(
		`${'Model'.padEnd(35)} | ${'Calls'.padStart(6)} | ` +
			`${'Input'.padStart(10)} | ${'Output'.padStart(10)} | ${'Cache'.padStart(8)}`,
	);
	console.log('─'.repeat(80));

	for (const model of stats.modelBreakdown) {
		const totalObserved = model.input + model.cacheRead;
		const efficiency = totalObserved > 0 ? Math.round((model.cacheRead / totalObserved) * 100) : 0;
		console.log(
			`${model.displayName.substring(0, 34).padEnd(35)} | ` +
				`${model.calls.toString().padStart(6)} | ` +
				`${totalObserved.toLocaleString().padStart(10)} | ` +
				`${model.output.toLocaleString().padStart(10)} | ` +
				`${efficiency.toString().padStart(7)}%`,
		);
	}
	console.log('─'.repeat(80));
	const grandTotalObserved = stats.totalInput + stats.totalCacheRead;
	const totalEff =
		grandTotalObserved > 0 ? Math.round((stats.totalCacheRead / grandTotalObserved) * 100) : 0;
	console.log(
		`${'TOTAL'.padEnd(35)} | ` +
			`${stats.totalCalls.toString().padStart(6)} | ` +
			`${grandTotalObserved.toLocaleString().padStart(10)} | ` +
			`${stats.totalOutput.toLocaleString().padStart(10)} | ` +
			`${totalEff.toString().padStart(7)}%`,
	);
}

function printTrend(title: string, rows: TrendRow[]): void {
	console.log(StatsFormatter.formatTrendTable(title, rows));
}

function printDailyStats(dailyStats: DailyModelStats[]): void {
	if (!dailyStats || dailyStats.length === 0) {
		console.log('  No daily statistics found.');
		return;
	}

	// 1. Identify all unique models
	const allModels = new Set<string>();
	for (const day of dailyStats) {
		for (const model of Object.keys(day.models)) {
			allModels.add(model);
		}
	}

	const order = getOrderedDisplayNames();
	const sortedModels = Array.from(allModels).sort((a, b) => {
		const ia = order.indexOf(a);
		const ib = order.indexOf(b);
		return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
	});

	// 2. Print trend for each model
	for (const model of sortedModels) {
		const rows = dailyStats
			.map((day) => {
				const stats = day.models[model];
				if (!stats) {
					return null;
				}
				return {
					date: day.date,
					input: stats.inputTokens + stats.cacheReadTokens,
					output: stats.outputTokens,
					cache: stats.cacheReadTokens,
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		if (rows.length > 0) {
			printTrend(`Model: ${model}`, rows);
		}
	}

	// 3. Print Daily Totals (aggregated across models)
	const totalRows = dailyStats.map((day) => ({
		date: day.date,
		input: day.totals.inputTokens + day.totals.cacheReadTokens,
		output: day.totals.outputTokens,
		cache: day.totals.cacheReadTokens,
	}));
	printTrend('DAILY TOTALS (Aggregated)', totalRows);
}

async function main() {
	const args = process.argv.slice(2);
	const command = args[0] || 'list';

	console.log('🚀 Altimeter CLI\n');

	try {
		const client = await discoverClient();
		const conversationService = new ConversationService(client);

		if (command === 'list') {
			const latest = args.includes('--latest');

			if (latest) {
				const conv = await conversationService.getLatestConversation();
				if (!conv) {
					console.log('No conversations found.');
					return;
				}
				console.log('Latest Conversation:');
				console.log(JSON.stringify(conv, null, 2));
			} else {
				const conversations = await conversationService.fetchSortedConversations();

				if (conversations.length === 0) {
					console.log('No conversations found.');
					return;
				}

				console.log(`\nFound ${conversations.length} conversations (newest first):\n`);
				console.log(
					`${'Time'.padEnd(25)} | ${'Steps'.padStart(5)} | ${'Cascade ID'.padEnd(38)} | Summary`,
				);
				console.log('─'.repeat(110));
				for (const c of conversations) {
					const timeStr = c.lastModifiedTime ? c.lastModifiedTime.substring(0, 23) : 'N/A';
					console.log(
						`${timeStr.padEnd(25)} | ` +
							`${c.stepCount.toString().padStart(5)} | ` +
							`${c.cascadeId.padEnd(38)} | ` +
							`${c.summary.substring(0, 30)}`,
					);
				}
			}
		} else if (command === 'stats') {
			let cascadeId: string | undefined;

			if (args.includes('--latest')) {
				const conv = await conversationService.getLatestConversation();
				if (!conv) {
					console.log('No conversations found.');
					return;
				}
				cascadeId = conv.cascadeId;
				console.log(`Latest Conversation: ${cascadeId} (${conv.stepCount} steps)`);
			} else {
				const idIndex = args.indexOf('--id');
				if (idIndex !== -1 && args[idIndex + 1]) {
					cascadeId = args[idIndex + 1];
				}
			}

			if (!cascadeId) {
				console.log('Usage: stats --latest OR stats --id <cascade_id>');
				return;
			}

			console.log(`Fetching stats for: ${cascadeId}`);
			console.log(`Fetching stats for: ${cascadeId}`);
			// Use new offset fetcher
			const {
				metadata,
				steps,
				apiCalls: lspRequests,
			} = await conversationService.fetchAllData(cascadeId);
			// Calculate stats to get parsed calls
			const stats = StatsService.calculateStats(metadata, steps);

			console.log(`LSP Requests: ${lspRequests}`);
			console.log(`Model Calls (Parsed): ${stats.totalCalls}`);
			console.log(`Metadata items: ${metadata.length}, Steps: ${steps.length}`);
			printStats(metadata, steps);
		} else if (command === 'daily') {
			console.log('Gathering daily statistics for the last 8 days...');

			const cascades = await conversationService.fetchSortedConversations();

			// Filter to last 8 days (matches WebView)
			const filtered = DailyStatsAggregator.filterByModifiedDate(cascades, 8);
			console.log(`Processing metadata for ${filtered.length} recent conversations...`);

			const allMetadata: any[] = [];
			const allSteps: any[] = []; // Store steps for daily aggregation
			let totalApi = 0;

			for (const cascade of filtered) {
				try {
					// Use fetchAllData to get hidden stats
					const { metadata, steps, apiCalls } = await conversationService.fetchAllData(
						cascade.cascadeId,
					);
					totalApi += apiCalls;

					if (metadata) {
						for (const item of metadata) {
							if (!item.timestamp && cascade.lastModifiedTime) {
								item.timestamp = cascade.lastModifiedTime;
							}
							allMetadata.push(item);
						}
					}
					if (steps) {
						allSteps.push(...steps);
					}
				} catch (e: any) {
					logger.warn(`Skipping metadata for ${cascade.cascadeId}: ${e.message}`);
				}
			}
			console.log(`\nTotal LSP Requests: ${totalApi}`);

			// Calculate aggregate for total model calls
			const finalStats = StatsService.calculateStats(allMetadata, allSteps);
			console.log(`Total Model Calls (Parsed): ${finalStats.totalCalls}`);

			const dailyStats = DailyStatsAggregator.aggregateByDay(allMetadata, allSteps, 8);
			printDailyStats(dailyStats);
		} else {
			console.log('Available commands: list, stats, daily');
			console.log('  list [--latest]');
			console.log('  stats --latest | --id <cascade_id>');
			console.log('  daily');
		}
	} catch (e: any) {
		logger.error(e.message);
		process.exit(1);
	}
}

main();
