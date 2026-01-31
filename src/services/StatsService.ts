import { getModelDisplayName } from '../shared/ModelCatalog';
import { AggregatedStats, ModelStats } from '../shared/types';

export class StatsService {
	static calculateStats(metadata: any[]): AggregatedStats {
		const modelStats: Record<string, ModelStats> = {};
		const total: AggregatedStats = {
			totalCalls: 0,
			totalInput: 0,
			totalOutput: 0,
			totalCacheRead: 0,
			lastContextSize: 0,
			modelBreakdown: [],
		};

		metadata.forEach((item, index) => {
			const chatModel = item.chatModel || {};
			const usage = chatModel.usage || {};

			const rawModel = usage.model || chatModel.model || 'Unknown';
			const displayName = getModelDisplayName(rawModel);

			if (!modelStats[displayName]) {
				modelStats[displayName] = {
					displayName,
					calls: 0,
					input: 0,
					output: 0,
					cacheRead: 0,
				};
			}

			const stats = modelStats[displayName];
			stats.calls++;
			stats.input += parseInt(usage.inputTokens, 10) || 0;
			stats.output += parseInt(usage.outputTokens, 10) || 0;
			stats.cacheRead += parseInt(usage.cacheReadTokens, 10) || 0;

			// The last item in metadata is the most recent call
			if (index === metadata.length - 1) {
				const ctx =
					chatModel.chatStartMetadata?.contextWindowMetadata?.estimatedTokensUsed ||
					chatModel.usage?.contextTokens ||
					0;
				total.lastContextSize = parseInt(ctx, 10) || 0;
			}

			// Global totals
			total.totalCalls++;
			total.totalInput += parseInt(usage.inputTokens, 10) || 0;
			total.totalOutput += parseInt(usage.outputTokens, 10) || 0;
			total.totalCacheRead += parseInt(usage.cacheReadTokens, 10) || 0;
		});

		total.modelBreakdown = Object.values(modelStats).sort((a, b) => b.input - a.input);

		return total;
	}
}
