import { expect } from 'chai';
import { getModelDisplayName, MODEL_CATALOG } from '../shared/ModelCatalog';

suite('ModelCatalog Test Suite', () => {
    test('should resolve known models correctly', () => {
        expect(getModelDisplayName('MODEL_PLACEHOLDER_M18')).to.equal('Gemini 3 Flash');
        expect(getModelDisplayName('MODEL_CLAUDE_4_5_SONNET_THINKING')).to.equal('Claude Sonnet 4.5 (Thinking)');
    });

    test('should fall back to original key for unknown models', () => {
        const unknownModel = 'MODEL_SECRET_X_999';
        expect(getModelDisplayName(unknownModel)).to.equal(unknownModel);
    });

    test('should have the core mapping', () => {
        expect(MODEL_CATALOG).to.have.property('MODEL_PLACEHOLDER_M8', 'Gemini 3 Pro (High)');
        expect(MODEL_CATALOG).to.have.property('MODEL_OPENAI_GPT_OSS_120B_MEDIUM', 'GPT-OSS 120B (Medium)');
    });
});

