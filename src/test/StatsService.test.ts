import * as assert from 'assert';
import { StatsService } from '../services/StatsService';
import { MOCK_TRAJECTORY_DATA } from './mocks/data';

suite('StatsService Test Suite', () => {
	test('Calculates aggregated stats correctly', () => {
		const stats = StatsService.calculateStats(MOCK_TRAJECTORY_DATA.generatorMetadata);

		// Total Input: 100 + 200 = 300
		assert.strictEqual(stats.totalInput, 300);

		// Total Output: 50 + 100 = 150
		assert.strictEqual(stats.totalOutput, 150);

		// Cache Read: 20 + 50 = 70
		assert.strictEqual(stats.totalCacheRead, 70);
	});

	test('Maps model names correctly', () => {
		const stats = StatsService.calculateStats(MOCK_TRAJECTORY_DATA.generatorMetadata);
		const models = stats.modelBreakdown; // Should be a map or list

		// MODEL_PLACEHOLDER_M18 -> Gemini 3 Flash (based on model catalog mapping)
		assert.ok(models.find((m) => m.displayName.includes('Gemini 3 Flash')));
	});
});
