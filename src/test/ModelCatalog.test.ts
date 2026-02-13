import { expect } from 'chai';
import { getModelDisplayName, MODEL_CATALOG } from '../shared/ModelCatalog';

suite('ModelCatalog Test Suite', () => {
	test('should resolve known models correctly', () => {
		expect(getModelDisplayName('MODEL_PLACEHOLDER_M18')).to.equal('Gemini 3 Flash');
		expect(getModelDisplayName('MODEL_CLAUDE_4_5_SONNET_THINKING')).to.equal(
			'Claude Sonnet 4.5 (Thinking)',
		);
		expect(getModelDisplayName('MODEL_PLACEHOLDER_M26')).to.equal('Claude Opus 4.6 (Thinking)');
	});

	test('should fall back to original key for unknown models', () => {
		const unknownModel = 'MODEL_SECRET_X_999';
		expect(getModelDisplayName(unknownModel)).to.equal(unknownModel);
	});

	test('should have the core mapping with displayName and color', () => {
		expect(MODEL_CATALOG['MODEL_PLACEHOLDER_M8']).to.deep.equal({
			displayName: 'Gemini 3 Pro (High)',
			color: '#185ABC',
			order: 2,
		});
		expect(MODEL_CATALOG['MODEL_OPENAI_GPT_OSS_120B_MEDIUM']).to.deep.equal({
			displayName: 'GPT-OSS 120B (Medium)',
			color: '#10B981',
			order: 8,
		});
		expect(MODEL_CATALOG['MODEL_PLACEHOLDER_M26']).to.deep.equal({
			displayName: 'Claude Opus 4.6 (Thinking)',
			color: '#D94A2F',
			order: 5,
		});
	});
});
