export interface ConversationDescription {
    id: string;
    summary: string;
    lastModified: string;
    stepCount?: number;
}

export interface ModelStats {
    displayName: string;
    calls: number;
    input: number;
    output: number;
    cacheRead: number;
}

export interface AggregatedStats {
    totalCalls: number;
    totalInput: number;
    totalOutput: number;
    totalCacheRead: number;
    lastContextSize: number;
    modelBreakdown: ModelStats[];
}

export type WebviewMessage =
    | { command: 'status', data: { user: string, connected: boolean } }
    | { command: 'conversations', data: ConversationDescription[] }
    | { command: 'stats', data: AggregatedStats }
    | { command: 'error', message: string };

export type ExtensionMessage =
    | { command: 'refresh' }
    | { command: 'selectConversation', id: string };
