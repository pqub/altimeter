/**
 * Model Catalog - Maps API model IDs to display names and chart colors
 */

interface ModelInfo {
	displayName: string;
	color: string;
	order: number;
}

/**
 * Unified model catalog with display names, colors, and sort order.
 */
export const MODEL_CATALOG: Record<string, ModelInfo> = {
	MODEL_PLACEHOLDER_M18: { displayName: 'Gemini 3 Flash', color: '#8AB4F8', order: 1 },
	MODEL_PLACEHOLDER_M8: { displayName: 'Gemini 3 Pro (High)', color: '#185ABC', order: 2 },
	MODEL_PLACEHOLDER_M7: { displayName: 'Gemini 3 Pro (Low)', color: '#1A73E8', order: 3 },
	MODEL_PLACEHOLDER_M12: { displayName: 'Claude Opus 4.5 (Thinking)', color: '#FF6B35', order: 4 },
	MODEL_CLAUDE_4_5_SONNET_THINKING: {
		displayName: 'Claude Sonnet 4.5 (Thinking)',
		color: '#E37400',
		order: 5,
	},
	MODEL_CLAUDE_4_5_SONNET: { displayName: 'Claude Sonnet 4.5', color: '#F9AB00', order: 6 },
	MODEL_OPENAI_GPT_OSS_120B_MEDIUM: {
		displayName: 'GPT-OSS 120B (Medium)',
		color: '#10B981',
		order: 7,
	},
	MODEL_GOOGLE_GEMINI_2_5_FLASH: {
		displayName: 'Gemini 2.5 Flash',
		color: '#4285F4',
		order: 8,
	},
	MODEL_GOOGLE_GEMINI_2_5_FLASH_LITE: {
		displayName: 'Gemini 2.5 Flash Lite',
		color: '#81C995',
		order: 9,
	},
};

/** Default color for unknown models */
const DEFAULT_COLOR = '#6B7280';

/**
 * Resolves a model ID to its human-readable display name.
 */
export function getModelDisplayName(modelId: string): string {
	return MODEL_CATALOG[modelId]?.displayName || modelId;
}

/**
 * Gets the chart color for a model ID.
 */
export function getModelColor(modelId: string): string {
	return MODEL_CATALOG[modelId]?.color || DEFAULT_COLOR;
}

/**
 * Returns a map of display name -> color for use in webviews
 */
export function getDisplayNameColorMap(): Record<string, string> {
	const map: Record<string, string> = {};
	for (const info of Object.values(MODEL_CATALOG)) {
		map[info.displayName] = info.color;
	}
	return map;
}

/**
 * Returns the sort order for a given display name.
 */
export function getModelOrder(displayName: string): number {
	for (const info of Object.values(MODEL_CATALOG)) {
		if (info.displayName === displayName) {
			return info.order;
		}
	}
	return 999;
}

/**
 * Returns a list of display names sorted by their defined order.
 */
export function getOrderedDisplayNames(): string[] {
	return Object.values(MODEL_CATALOG)
		.sort((a, b) => a.order - b.order)
		.map((info) => info.displayName);
}
