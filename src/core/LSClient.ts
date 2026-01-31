/**
 * Based on local server interaction parts from:
 * https://github.com/jlcodes99/vscode-antigravity-cockpit.git
 */

/**
 * LSClient - Thin HTTP wrapper for Language Server API
 *
 * Design: This is a low-level API client. It provides:
 * - HTTP transport configuration (HTTPS, CSRF token, etc.)
 * - Generic makeRequest() for any API method
 * - Typed convenience methods for commonly used endpoints
 *
 * Business logic (data transformation, aggregation) belongs in Services.
 */

import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { LS_ENDPOINTS, TIMING } from './constants';

export class LSClient {
	private client: AxiosInstance;
	public readonly port: number;
	public readonly token: string;

	constructor(port: number, token: string) {
		this.port = port;
		this.token = token;

		this.client = axios.create({
			baseURL: `https://127.0.0.1:${port}`,
			headers: {
				'X-Codeium-Csrf-Token': token,
				'Connect-Protocol-Version': '1',
				'Content-Type': 'application/json',
			},
			httpsAgent: new https.Agent({ rejectUnauthorized: false }),
			timeout: TIMING.HTTP_TIMEOUT_MS,
		});
	}

	/**
	 * Generic request method for any Language Server API endpoint.
	 */
	async makeRequest(method: string, payload: object = {}): Promise<any> {
		console.log(`[LSClient] Making request: ${method}`);
		try {
			const response = await this.client.post(`/${method}`, payload);
			console.log(`[LSClient] Success: ${method}`);
			return response.data;
		} catch (error: any) {
			console.error(`[LSClient] Request Error (${method}):`, error.message);
			throw error;
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Convenience Methods for Common Endpoints
	// ─────────────────────────────────────────────────────────────────────────

	async getAllCascadeTrajectories(): Promise<any> {
		return this.makeRequest(LS_ENDPOINTS.GET_ALL_CASCADE_TRAJECTORIES, {});
	}

	async getCascadeMetadata(cascadeId: string): Promise<any> {
		return this.makeRequest(LS_ENDPOINTS.GET_CASCADE_METADATA, {
			cascade_id: cascadeId,
		});
	}
}
