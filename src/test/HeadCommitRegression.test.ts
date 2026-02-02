import * as assert from 'assert';
import { StatsService } from '../services/StatsService';
import { AggregatedStats } from '../shared/types';

suite('Head Commit Regression Suite', () => {
	test('StatsService.mergeStats - overlapping models', () => {
		const base: AggregatedStats = {
			totalCalls: 10,
			totalInput: 1000,
			totalOutput: 200,
			totalCacheRead: 100,
			lastContextSize: 500,
			modelBreakdown: [
				{ displayName: 'Model A', calls: 10, input: 1000, output: 200, cacheRead: 100 },
			],
		};

		const delta: AggregatedStats = {
			totalCalls: 5,
			totalInput: 500,
			totalOutput: 50,
			totalCacheRead: 50,
			lastContextSize: 800,
			modelBreakdown: [
				{ displayName: 'Model A', calls: 5, input: 500, output: 50, cacheRead: 50 },
				{ displayName: 'Model B', calls: 5, input: 300, output: 30, cacheRead: 20 },
			],
		};

		const merged = StatsService.mergeStats(base, delta);

		assert.strictEqual(merged.totalCalls, 15);
		assert.strictEqual(merged.totalInput, 1500);
		assert.strictEqual(merged.lastContextSize, 800);

		const modelA = merged.modelBreakdown.find((m) => m.displayName === 'Model A');
		assert.strictEqual(modelA?.calls, 15);
		assert.strictEqual(modelA?.input, 1500);

		const modelB = merged.modelBreakdown.find((m) => m.displayName === 'Model B');
		assert.strictEqual(modelB?.calls, 5);
		assert.strictEqual(modelB?.input, 300);
	});

	test('StatsService.mergeStats - keep old context window if delta empty', () => {
		const base = {
			totalCalls: 1,
			totalInput: 1,
			lastContextSize: 500,
			modelBreakdown: [],
			totalOutput: 0,
			totalCacheRead: 0,
		};
		const delta = {
			totalCalls: 0,
			totalInput: 0,
			lastContextSize: 0,
			modelBreakdown: [],
			totalOutput: 0,
			totalCacheRead: 0,
		};

		const merged = StatsService.mergeStats(base as any, delta as any);
		assert.strictEqual(merged.lastContextSize, 500);
	});

	test('StatsService.mergeStats - empty delta', () => {
		const base: AggregatedStats = {
			totalCalls: 1,
			totalInput: 10,
			totalOutput: 5,
			totalCacheRead: 2,
			lastContextSize: 100,
			modelBreakdown: [{ displayName: 'A', calls: 1, input: 10, output: 5, cacheRead: 2 }],
		};
		const delta = StatsService.createEmptyStats();

		const merged = StatsService.mergeStats(base, delta);
		assert.strictEqual(merged.totalCalls, 1);
		assert.strictEqual(merged.lastContextSize, 100);
		assert.strictEqual(merged.modelBreakdown.length, 1);
	});

	test('StatsService.calculateStats - sorting by catalog order', () => {
		// Catalog: Flash (1), Pro High (2)...
		const metadata = [
			{ chatModel: { model: 'MODEL_PLACEHOLDER_M8', usage: { inputTokens: 10 } } }, // Pro High (Order 2)
			{ chatModel: { model: 'MODEL_PLACEHOLDER_M18', usage: { inputTokens: 10 } } }, // Flash (Order 1)
		];

		const stats = StatsService.calculateStats(metadata);
		assert.strictEqual(stats.modelBreakdown[0].displayName, 'Gemini 3 Flash');
		assert.strictEqual(stats.modelBreakdown[1].displayName, 'Gemini 3 Pro (High)');
	});
});
