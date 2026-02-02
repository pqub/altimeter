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
	 * Fetch generator metadata for stats calculation (legacy single call)
	 */
	async fetchCascadeMetadata(cascadeId: string): Promise<any> {
		return this.client.getCascadeMetadata(cascadeId);
	}

	/**
	 * Fetch ALL metadata and steps for a cascade ID, handling pagination.
	 */
	/**
	 * Fetch metadata and steps starting from specific offsets.
	 * Returns new items and the next expected offsets.
	 */
	async fetchSessionData(
		cascadeId: string,
		startMetaOffset: number = 0,
		startStepOffset: number = 0,
	): Promise<{
		metadata: any[];
		steps: any[];
		nextMetaOffset: number;
		nextStepOffset: number;
		apiCalls: number;
	}> {
		let apiCalls = 0;
		const metadata: any[] = [];
		const steps: any[] = [];

		// 1. Fetch Metadata (Loop)
		let metaOffset = startMetaOffset;
		while (true) {
			apiCalls++;
			const res = await this.client.getCascadeMetadata(cascadeId, metaOffset);
			const batch = res.generatorMetadata || [];
			if (batch.length === 0) {
				break;
			}
			metadata.push(...batch);
			metaOffset += batch.length;
		}

		// 2. Fetch Steps (Loop)
		let stepOffset = startStepOffset;
		while (true) {
			apiCalls++;
			const res = await this.client.getCascadeSteps(cascadeId, stepOffset);
			const batch = res.steps || [];
			if (batch.length === 0) {
				break;
			}
			steps.push(...batch);
			stepOffset += batch.length;
		}

		return {
			metadata,
			steps,
			nextMetaOffset: metaOffset,
			nextStepOffset: stepOffset,
			apiCalls,
		};
	}

	/**
	 * Legacy Wrapper for fetching everything from scratch
	 */
	async fetchAllData(
		cascadeId: string,
	): Promise<{ metadata: any[]; steps: any[]; apiCalls: number }> {
		const res = await this.fetchSessionData(cascadeId, 0, 0);
		return { metadata: res.metadata, steps: res.steps, apiCalls: res.apiCalls };
	}
}
