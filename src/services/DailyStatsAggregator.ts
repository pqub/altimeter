/**
 * DailyStatsAggregator - Aggregates token usage statistics by day
 *
 * Design: Pure business logic, no I/O. Takes raw metadata and returns
 * aggregated daily stats for chart visualization.
 */

import { getModelDisplayName } from '../shared/ModelCatalog';
import { DailyModelStats } from '../shared/types';

interface CascadeTrajectory {
	cascadeId: string;
	lastModifiedTime?: string;
}

interface MetadataItem {
	chatModel?: {
		model?: string;
		usage?: {
			model?: string;
			inputTokens?: string | number;
			outputTokens?: string | number;
			cacheReadTokens?: string | number;
		};
		chatStartMetadata?: {
			createdAt?: string;
		};
	};
	timestamp?: string;
}

export class DailyStatsAggregator {
	/**
	 * Filters cascades to only those modified within the cutoff period.
	 */
	static filterByModifiedDate(
		cascades: CascadeTrajectory[],
		dayCount: number,
	): CascadeTrajectory[] {
		const cutoffDate = new Date();
		// If we want 8 days including today, the oldest day is Today - 7 days.
		cutoffDate.setDate(cutoffDate.getDate() - (dayCount - 1));
		cutoffDate.setHours(0, 0, 0, 0);

		return cascades.filter((c) => {
			if (!c.lastModifiedTime) {
				return false;
			}
			const modified = new Date(c.lastModifiedTime);
			return modified >= cutoffDate;
		});
	}

	/**
	 * Aggregates metadata items into daily stats grouped by model.
	 */
	/**
	 * Aggregates metadata items into daily stats grouped by model.
	 */
	static aggregateByDay(
		allMetadata: MetadataItem[],
		steps: any[] = [],
		dayCount: number = 8,
	): DailyModelStats[] {
		const dailyMap = new Map<string, DailyModelStats>();
		const today = new Date();

		// Initialize days
		for (let i = 0; i < dayCount; i++) {
			const date = new Date(today);
			date.setDate(today.getDate() - i);
			const dateStr = this.formatDate(date);
			dailyMap.set(dateStr, this.createEmptyDayStats(dateStr));
		}

		// Bucket for unknown dates
		const unknownDateStr = 'Unknown Date';
		if (!dailyMap.has(unknownDateStr)) {
			dailyMap.set(unknownDateStr, this.createEmptyDayStats(unknownDateStr));
		}

		// Process each metadata item
		for (const item of allMetadata) {
			let dateStr = this.extractDateFromItem(item);
			if (!dateStr) {
				dateStr = unknownDateStr;
			}

			if (!dailyMap.has(dateStr)) {
				// If date is outside range (older than 8 days), usually we skip.
				// But if user wants ALL stats, we might lose them here if we strictly filter.
				// However, 'aggregateByDay' implies filtering by the days initialized.
				// To preserve "global statistics" as requested, we might need a catch-all for "Older"?
				// For now, let's treat "Unknown" as a specific valid bucket.
				// Older VALID timestamps are strictly filtered by 'Daily' visualization nature.
				// But 'null' timestamps are truly lost without this.
				if (dateStr === unknownDateStr) {
					// Fallthrough to add to Unknown
				} else {
					continue;
				}
			}

			const dayStats = dailyMap.get(dateStr)!;
			this.addItemToDay(dayStats, item);
		}

		// Process Steps (All types with model usage)
		if (steps && steps.length > 0) {
			for (const step of steps) {
				const usage = step.modelUsage || step.metadata?.modelUsage;
				if (usage) {
					let dateStr = this.extractDateFromStep(step);
					if (!dateStr) {
						dateStr = unknownDateStr;
					}

					if (dailyMap.has(dateStr)) {
						const dayStats = dailyMap.get(dateStr)!;
						this.addStepToDay(dayStats, usage);
					}
				}
			}
		}

		// Remove Unknown Date if empty
		const unknownStats = dailyMap.get(unknownDateStr);
		if (
			unknownStats &&
			unknownStats.totals.inputTokens === 0 &&
			unknownStats.totals.outputTokens === 0
		) {
			dailyMap.delete(unknownDateStr);
		}

		// Calculate cache efficiency and sort by date descending
		const result = Array.from(dailyMap.values());
		for (const day of result) {
			day.cacheEfficiency = this.calculateCacheEfficiency(day);
		}

		return result.sort((a, b) => {
			// Ensure Unknown is always last
			if (a.date === unknownDateStr) {
				return 1;
			}
			if (b.date === unknownDateStr) {
				return -1;
			}
			return b.date.localeCompare(a.date);
		});
	}

	private static formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private static createEmptyDayStats(date: string): DailyModelStats {
		return {
			date,
			models: {},
			totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
			cacheEfficiency: 0,
		};
	}

	private static extractDateFromItem(item: MetadataItem): string | null {
		const timestamp = item.timestamp || item.chatModel?.chatStartMetadata?.createdAt;
		if (!timestamp) {
			return null;
		}
		try {
			const date = new Date(timestamp);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		} catch {
			return null;
		}
	}

	private static addItemToDay(day: DailyModelStats, item: MetadataItem): void {
		const usage = item.chatModel?.usage || {};
		const rawModel = usage.model || item.chatModel?.model || 'Unknown';
		const displayName = getModelDisplayName(rawModel);

		const input = this.toNumber(usage.inputTokens);
		const output = this.toNumber(usage.outputTokens);
		const cacheRead = this.toNumber(usage.cacheReadTokens);

		// Update model stats
		if (!day.models[displayName]) {
			day.models[displayName] = {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				calls: 0,
			};
		}
		const modelStats = day.models[displayName];
		modelStats.inputTokens += input;
		modelStats.outputTokens += output;
		modelStats.cacheReadTokens += cacheRead;
		modelStats.calls++;

		// Update totals
		day.totals.inputTokens += input;
		day.totals.outputTokens += output;
		day.totals.cacheReadTokens += cacheRead;
	}

	private static toNumber(val: string | number | undefined): number {
		if (typeof val === 'number') {
			return val;
		}
		if (typeof val === 'string') {
			return parseInt(val, 10) || 0;
		}
		return 0;
	}

	private static extractDateFromStep(step: any): string | null {
		// Try step.metadata.createdAt
		const timestamp = step.metadata?.createdAt;
		if (!timestamp) {
			return null;
		}

		try {
			const date = new Date(timestamp);
			return this.formatDate(date);
		} catch {
			return null;
		}
	}

	private static addStepToDay(day: DailyModelStats, usage: any): void {
		const rawModel = usage.model || 'Unknown';
		const displayName = getModelDisplayName(rawModel);

		const input = this.toNumber(usage.inputTokens);
		const output = this.toNumber(usage.outputTokens);
		const cacheRead = this.toNumber(usage.cacheReadTokens);

		if (!day.models[displayName]) {
			day.models[displayName] = {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				calls: 0,
			};
		}
		const modelStats = day.models[displayName];
		modelStats.inputTokens += input;
		modelStats.outputTokens += output;
		modelStats.cacheReadTokens += cacheRead;
		modelStats.calls++;

		day.totals.inputTokens += input;
		day.totals.outputTokens += output;
		day.totals.cacheReadTokens += cacheRead;
	}

	private static calculateCacheEfficiency(day: DailyModelStats): number {
		const totalInput = day.totals.inputTokens;
		const cacheRead = day.totals.cacheReadTokens;
		const totalObservedInput = totalInput + cacheRead;
		if (totalObservedInput === 0) {
			return 0;
		}
		return Math.round((cacheRead / totalObservedInput) * 100);
	}
}
