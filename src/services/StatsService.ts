import { getModelDisplayName, getModelOrder } from '../shared/ModelCatalog';
import { AggregatedStats, ModelStats } from '../shared/types';

export class StatsService {
	static createEmptyStats(): AggregatedStats {
		return {
			totalCalls: 0,
			totalInput: 0,
			totalOutput: 0,
			totalCacheRead: 0,
			lastContextSize: 0,
			modelBreakdown: [],
		};
	}

	static mergeStats(base: AggregatedStats, delta: AggregatedStats): AggregatedStats {
		const merged = this.createEmptyStats();

		// 1. Sum scalar totals
		merged.totalCalls = base.totalCalls + delta.totalCalls;
		merged.totalInput = base.totalInput + delta.totalInput;
		merged.totalOutput = base.totalOutput + delta.totalOutput;
		merged.totalCacheRead = base.totalCacheRead + delta.totalCacheRead;

		// 2. Handle Context Window
		// The 'delta' (newest) has the latest context size.
		merged.lastContextSize =
			delta.totalInput > 0 || delta.totalCalls > 0 ? delta.lastContextSize : base.lastContextSize;

		// 3. Merge Model Breakdowns
		const modelMap: Record<string, ModelStats> = {};

		const mergeModel = (m: ModelStats) => {
			if (!modelMap[m.displayName]) {
				modelMap[m.displayName] = { ...m };
			} else {
				const existing = modelMap[m.displayName];
				existing.calls += m.calls;
				existing.input += m.input;
				existing.output += m.output;
				existing.cacheRead += m.cacheRead;
			}
		};

		base.modelBreakdown.forEach(mergeModel);
		delta.modelBreakdown.forEach(mergeModel);

		merged.modelBreakdown = Object.values(modelMap).sort(
			(a, b) => getModelOrder(a.displayName) - getModelOrder(b.displayName),
		);

		return merged;
	}

	static calculateStats(metadata: any[], steps: any[] = []): AggregatedStats {
		const modelStats: Record<string, ModelStats> = {};
		const total = this.createEmptyStats();

		// 1. Process Metadata (Standard Stats)
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

		// 2. Process Steps (All types with model usage)
		if (steps && steps.length > 0) {
			steps.forEach((step) => {
				const usage = step.modelUsage || step.metadata?.modelUsage;
				if (usage) {
					const raw = usage.model || 'Unknown';
					const displayName = getModelDisplayName(raw);

					if (!modelStats[displayName]) {
						modelStats[displayName] = {
							displayName,
							calls: 0,
							input: 0,
							output: 0,
							cacheRead: 0,
						};
					}
					const s = modelStats[displayName];
					s.calls++;
					const inp = parseInt(usage.inputTokens, 10) || 0;
					const out = parseInt(usage.outputTokens, 10) || 0;
					const cache = parseInt(usage.cacheReadTokens, 10) || 0;

					s.input += inp;
					s.output += out;
					s.cacheRead += cache;

					total.totalCalls++;
					total.totalInput += inp;
					total.totalOutput += out;
					total.totalCacheRead += cache;
				}
			});
		}

		total.modelBreakdown = Object.values(modelStats).sort(
			(a, b) => getModelOrder(a.displayName) - getModelOrder(b.displayName),
		);

		return total;
	}
}
