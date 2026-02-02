/**
 * CacheManager - In-memory cache for session statistics
 *
 * Avoids redundant API calls by storing the last fetched stats
 * and validating against cascadeId + lastModifiedTime.
 */

import { AggregatedStats } from '../shared/types';

interface CacheEntry {
	cascadeId: string;
	lastModifiedTime: string;
	stats: AggregatedStats;
	timestamp: number;
	nextMetaOffset: number;
	nextStepOffset: number;
}

export class CacheManager {
	private cache: CacheEntry | null = null;

	/**
	 * Check if cached session matches the current one.
	 */
	isValid(cascadeId: string): boolean {
		if (!this.cache) {
			return false;
		}
		return this.cache.cascadeId === cascadeId;
	}

	/**
	 * Get cached entry if available.
	 */
	getEntry(): CacheEntry | null {
		return this.cache;
	}

	/**
	 * Get cached stats if available.
	 */
	get(): AggregatedStats | null {
		return this.cache?.stats || null;
	}

	/**
	 * Store stats in cache with validation metadata and offsets.
	 */
	set(
		cascadeId: string,
		lastModifiedTime: string,
		stats: AggregatedStats,
		nextMetaOffset: number,
		nextStepOffset: number,
	): void {
		this.cache = {
			cascadeId,
			lastModifiedTime,
			stats,
			timestamp: Date.now(),
			nextMetaOffset,
			nextStepOffset,
		};
	}

	/**
	 * Clear the cache.
	 */
	invalidate(): void {
		this.cache = null;
	}

	/**
	 * Get cache info for logging.
	 */
	getInfo(): string {
		if (!this.cache) {
			return 'Cache: empty';
		}
		const age = Math.round((Date.now() - this.cache.timestamp) / 1000);
		return `Cache: ${this.cache.cascadeId.substring(0, 8)}... (${age}s old)`;
	}
}
