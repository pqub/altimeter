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
}

export class CacheManager {
	private cache: CacheEntry | null = null;

	/**
	 * Check if cached data is still valid for the given session.
	 */
	isValid(cascadeId: string, lastModifiedTime: string): boolean {
		if (!this.cache) {
			return false;
		}
		return this.cache.cascadeId === cascadeId && this.cache.lastModifiedTime === lastModifiedTime;
	}

	/**
	 * Get cached stats if available.
	 */
	get(): AggregatedStats | null {
		return this.cache?.stats || null;
	}

	/**
	 * Store stats in cache with validation metadata.
	 */
	set(cascadeId: string, lastModifiedTime: string, stats: AggregatedStats): void {
		this.cache = {
			cascadeId,
			lastModifiedTime,
			stats,
			timestamp: Date.now(),
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
