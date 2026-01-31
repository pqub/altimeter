/**
 * ConversationService - Shared service for conversation operations
 * Used by both VSIX extension and CLI tool
 */

import { LSClient } from '../core/LSClient';

export interface ConversationSummary {
	cascadeId: string;
	summary: string;
	lastModifiedTime: string;
	stepCount: number;
}

export class ConversationService {
	constructor(private client: LSClient) {}

	/**
	 * Fetch all conversations, sorted by lastModifiedTime (newest first)
	 */
	async fetchSortedConversations(): Promise<ConversationSummary[]> {
		const response = await this.client.getAllCascadeTrajectories();

		const summaries = response.trajectorySummaries || {};
		const items: ConversationSummary[] = [];

		for (const [_tid, summary] of Object.entries(summaries as Record<string, any>)) {
			items.push({
				cascadeId: summary.cascadeId || _tid,
				summary: summary.summary || 'N/A',
				lastModifiedTime: summary.lastModifiedTime || '',
				stepCount: parseInt(summary.stepCount || '0', 10),
			});
		}

		items.sort((a, b) => (b.lastModifiedTime || '').localeCompare(a.lastModifiedTime || ''));

		return items;
	}

	/**
	 * Get the latest (most recently modified) conversation
	 */
	async getLatestConversation(): Promise<ConversationSummary | null> {
		const items = await this.fetchSortedConversations();
		return items.length > 0 ? items[0] : null;
	}

	/**
	 * Fetch generator metadata for stats calculation
	 */
	async fetchCascadeMetadata(cascadeId: string): Promise<any> {
		return this.client.getCascadeMetadata(cascadeId);
	}
}
