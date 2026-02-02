import { expect } from 'chai';
import { DailyStatsAggregator } from '../services/DailyStatsAggregator';

suite('DailyStatsAggregator Test Suite', () => {
	test('should filter cascades by modified date', () => {
		const now = new Date();
		const old = new Date();
		old.setDate(old.getDate() - 10);

		const cascades = [
			{ cascadeId: 'recent', lastModifiedTime: now.toISOString() },
			{ cascadeId: 'old', lastModifiedTime: old.toISOString() },
		];

		const filtered = DailyStatsAggregator.filterByModifiedDate(cascades, 8);
		expect(filtered).to.have.lengthOf(1);
		expect(filtered[0].cascadeId).to.equal('recent');
	});

	test('should aggregate metadata by day', () => {
		const today = new Date().toISOString();
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString();

		const metadata = [
			{
				timestamp: today,
				chatModel: {
					model: 'MODEL_PLACEHOLDER_M18',
					usage: { inputTokens: 100, outputTokens: 50, cacheReadTokens: 20 },
				},
			},
			{
				timestamp: yesterdayStr,
				chatModel: {
					model: 'MODEL_PLACEHOLDER_M18',
					usage: { inputTokens: 200, outputTokens: 100, cacheReadTokens: 40 },
				},
			},
		];

		const stats = DailyStatsAggregator.aggregateByDay(metadata, [], 2);
		expect(stats).to.have.lengthOf(2);

		const todayStats = stats.find((s) => s.date === today.split('T')[0]);
		expect(todayStats?.totals.inputTokens).to.equal(100);
		// formula: 20 / (100 + 20) = 16.66% -> 17%
		expect(todayStats?.cacheEfficiency).to.equal(17);

		const yesterdayStats = stats.find((s) => s.date === yesterdayStr.split('T')[0]);
		expect(yesterdayStats?.totals.inputTokens).to.equal(200);
		// formula: 40 / (200 + 40) = 16.66% -> 17%
		expect(yesterdayStats?.cacheEfficiency).to.equal(17);
	});

	test('should handle missing metadata fields gracefully', () => {
		const metadata = [
			{
				timestamp: new Date().toISOString(),
				chatModel: {
					model: 'unknown',
					// usage missing
				},
			},
		];

		const stats = DailyStatsAggregator.aggregateByDay(metadata, [], 1);
		expect(stats[0].totals.inputTokens).to.equal(0);
		expect(stats[0].models['unknown']).to.exist;
	});

	test('should fallback to chatStartMetadata.createdAt when timestamp is missing', () => {
		const specificDate = '2026-01-20T10:53:04Z';
		const dateStr = '2026-01-20';
		const metadata = [
			{
				chatModel: {
					model: 'MODEL_PLACEHOLDER_M18',
					usage: { inputTokens: 500 },
					chatStartMetadata: {
						createdAt: specificDate,
					},
				},
			},
		];

		// We need to ensure the initialization range includes this date, or it might be filtered out
		// Depending on current date, we'll just check if it finds it.
		// For the test, let's just use aggregateByDay and check if '2026-01-20' exists in the map
		// if we mock enough days.
		const stats = DailyStatsAggregator.aggregateByDay(metadata, [], 100);
		const targetStats = stats.find((s) => s.date === dateStr);
		expect(targetStats).to.exist;
		expect(targetStats?.totals.inputTokens).to.equal(500);
	});

	test('should bucket items with no date into "Unknown Date"', () => {
		const metadata = [
			{
				chatModel: {
					model: 'Ghost Model',
					usage: { inputTokens: 999 },
				},
			},
		];

		const stats = DailyStatsAggregator.aggregateByDay(metadata, [], 1);
		const unknown = stats.find((s) => s.date === 'Unknown Date');
		expect(unknown).to.exist;
		expect(unknown?.totals.inputTokens).to.equal(999);
	});

	test('should use local date components instead of UTC ISO string', () => {
		// Create a date that might differ between local and UTC
		// e.g., 2026-02-01 01:00 AM in a GMT+2 timezone is still 2026-02-01 local.
		// In UTC it would be 2026-01-31 11:00 PM.
		const localDate = new Date(2026, 1, 1, 1, 0, 0); // Feb 1st 2026, 01:00 local
		const dateStr = '2026-02-01'; // locally formatted

		// @ts-expect-error - accessing private for testing
		const formatted = DailyStatsAggregator.formatDate(localDate);
		expect(formatted).to.equal(dateStr);
	});

	test('should aggregate checkpoint steps by day', () => {
		const today = new Date();
		const dateStr = today.toISOString().split('T')[0];

		const steps = [
			{
				type: 'CORTEX_STEP_TYPE_CHECKPOINT',
				metadata: { createdAt: today.toISOString() },
				modelUsage: {
					model: 'MODEL_GOOGLE_GEMINI_2_5_FLASH_LITE',
					inputTokens: 1000,
					outputTokens: 500,
				},
			},
		];

		const stats = DailyStatsAggregator.aggregateByDay([], steps, 1);
		const target = stats.find((s) => s.date === dateStr);
		expect(target).to.exist;
		// Gemni 2.5 Flash Lite display name
		expect(target?.models['Gemini 2.5 Flash Lite']).to.exist;
		expect(target?.models['Gemini 2.5 Flash Lite'].inputTokens).to.equal(1000);
	});
});
