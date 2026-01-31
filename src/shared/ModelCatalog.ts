/**
 * Model Catalog - Maps API model IDs to human-readable names
 */

export const MODEL_CATALOG: Record<string, string> = {
	MODEL_PLACEHOLDER_M18: 'Gemini 3 Flash',
	MODEL_PLACEHOLDER_M8: 'Gemini 3 Pro (High)',
	MODEL_PLACEHOLDER_M7: 'Gemini 3 Pro (Low)',
	MODEL_PLACEHOLDER_M12: 'Claude Opus 4.5 (Thinking)',
	MODEL_CLAUDE_4_5_SONNET: 'Claude Sonnet 4.5',
	MODEL_CLAUDE_4_5_SONNET_THINKING: 'Claude Sonnet 4.5 (Thinking)',
	MODEL_OPENAI_GPT_OSS_120B_MEDIUM: 'GPT-OSS 120B (Medium)',
};

/**
 * Resolves a model ID to its human-readable display name.
 * Falls back to the original ID if no mapping exists.
 */
export function getModelDisplayName(modelId: string): string {
	return MODEL_CATALOG[modelId] || modelId;
}
