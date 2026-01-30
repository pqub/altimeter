export const MOCK_TRAJECTORY_DATA = {
    generatorMetadata: [
        {
            chatModel: {
                model: 'MODEL_PLACEHOLDER_M18',
                timeToFirstToken: '0.5s',
                streamingDuration: '2.0s',
                usage: {
                    model: 'MODEL_PLACEHOLDER_M18',
                    inputTokens: '100',
                    outputTokens: '50',
                    thinkingOutputTokens: '10',
                    responseOutputTokens: '40',
                    cacheReadTokens: '20'
                }
            }
        },
        {
            chatModel: {
                model: 'MODEL_PLACEHOLDER_M18',
                timeToFirstToken: '0.4s',
                streamingDuration: '2.0s',
                usage: {
                    model: 'MODEL_PLACEHOLDER_M18',
                    inputTokens: '200',
                    outputTokens: '100',
                    thinkingOutputTokens: '0',
                    responseOutputTokens: '100',
                    cacheReadTokens: '50'
                }
            }
        }
    ]
};
