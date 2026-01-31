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

function printStats(metadata: any[]): void {
	if (!metadata || metadata.length === 0) {
		console.log('  No generation metadata found.');
		return;
	}

	// Use the shared StatsService for calculation
	const stats = StatsService.calculateStats(metadata);

	console.log('\n📊 Token Usage by Model:');
	console.log('─'.repeat(90));
	console.log(
		`${'Model'.padEnd(35)} | ${'Calls'.padStart(6)} | ` +
			`${'Input'.padStart(10)} | ${'Output'.padStart(10)} | ${'Cache'.padStart(10)}`,
	);
	console.log('─'.repeat(90));

	for (const model of stats.modelBreakdown) {
		console.log(
			`${model.displayName.substring(0, 34).padEnd(35)} | ` +
				`${model.calls.toString().padStart(6)} | ` +
				`${model.input.toLocaleString().padStart(10)} | ` +
				`${model.output.toLocaleString().padStart(10)} | ` +
				`${model.cacheRead.toLocaleString().padStart(10)}`,
		);
	}
	console.log('─'.repeat(90));
	console.log(
		`${'TOTAL'.padEnd(35)} | ` +
			`${stats.totalCalls.toString().padStart(6)} | ` +
			`${stats.totalInput.toLocaleString().padStart(10)} | ` +
			`${stats.totalOutput.toLocaleString().padStart(10)} | ` +
			`${stats.totalCacheRead.toLocaleString().padStart(10)}`,
	);
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
			const data = await conversationService.fetchCascadeMetadata(cascadeId);
			printStats(data.generatorMetadata || []);
		} else {
			console.log('Available commands: list, stats');
			console.log('  list [--latest]');
			console.log('  stats --latest | --id <cascade_id>');
		}
	} catch (e: any) {
		logger.error(e.message);
		process.exit(1);
	}
}

main();
