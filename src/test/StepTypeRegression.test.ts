import { expect } from 'chai';
import { StatsService } from '../services/StatsService';
import { DailyStatsAggregator } from '../services/DailyStatsAggregator';

suite('Step Type Regression Test Suite', () => {
	const mockModelUsage = {
		model: 'MODEL_PLACEHOLDER_M18',
		inputTokens: 1000,
		outputTokens: 500,
		cacheReadTokens: 200,
	};

	const testStepTypes = [
		'CORTEX_STEP_TYPE_CHECKPOINT',
		'CORTEX_STEP_TYPE_BROWSER_SUBAGENT',
		'CORTEX_STEP_TYPE_CODE_ACTION',
		'CORTEX_STEP_TYPE_TERMINAL_ACTION',
		'CORTEX_STEP_TYPE_SEARCH_ACTION',
	];

	test('StatsService should capture model usage from ANY step type', () => {
		const steps = testStepTypes.map((type) => ({
			type,
			modelUsage: mockModelUsage,
		}));

		const stats = StatsService.calculateStats([], steps);

		// 5 step types * 1000 input tokens = 5000 total input
		expect(stats.totalInput).to.equal(5000);
		expect(stats.totalCalls).to.equal(5);
		expect(stats.modelBreakdown).to.have.lengthOf(1);
		expect(stats.modelBreakdown[0].displayName).to.equal('Gemini 3 Flash');
	});

	test('DailyStatsAggregator should aggregate model usage from ANY step type', () => {
		const today = new Date().toISOString();
		const steps = testStepTypes.map((type) => ({
			type,
			metadata: { createdAt: today },
			modelUsage: mockModelUsage,
		}));

		const stats = DailyStatsAggregator.aggregateByDay([], steps, 1);

		expect(stats).to.have.lengthOf(1);
		const day = stats[0];
		expect(day.totals.inputTokens).to.equal(5000);
		expect(day.models['Gemini 3 Flash'].calls).to.equal(5);
	});

	test('Should handle mixed metadata and various step types correctly', () => {
		const metadata = [
			{
				chatModel: {
					model: 'MODEL_PLACEHOLDER_M8', // Gemini 3 Pro (High)
					usage: { inputTokens: 5000, outputTokens: 100 },
				},
			},
		];

		const steps = [
			{
				type: 'CORTEX_STEP_TYPE_BROWSER_SUBAGENT',
				modelUsage: {
					model: 'MODEL_GOOGLE_GEMINI_2_5_FLASH',
					inputTokens: 2000,
				},
			},
			{
				type: 'CORTEX_STEP_TYPE_CHECKPOINT',
				metadata: {
					modelUsage: { model: 'MODEL_GOOGLE_GEMINI_2_5_FLASH_LITE', inputTokens: 1000 },
				},
			},
		];

		const stats = StatsService.calculateStats(metadata, steps);

		expect(stats.totalCalls).to.equal(3);
		expect(
			stats.modelBreakdown.find((m) => m.displayName === 'Gemini 3 Pro (High)')?.input,
		).to.equal(5000);
		expect(stats.modelBreakdown.find((m) => m.displayName === 'Gemini 2.5 Flash')?.input).to.equal(
			2000,
		);
		expect(
			stats.modelBreakdown.find((m) => m.displayName === 'Gemini 2.5 Flash Lite')?.input,
		).to.equal(1000);
	});
});
