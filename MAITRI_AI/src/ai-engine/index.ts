/**
 * AI Engine Lambda Handler
 * 
 * Orchestrates AI-powered response generation using Amazon Bedrock
 * with Claude models, RAG context retrieval, and circuit breaker pattern.
 * 
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1-6.6
 */

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { AIEngine, AIEngineConfig } from './ai-engine-service';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

const config: AIEngineConfig = {
  haikuModelId: 'anthropic.claude-3-haiku-20240307-v1:0',
  sonnetModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  maxTokens: 1024,
  temperature: 0.7,
  responseTimeout: 2000,
  governmentApiTimeout: 2000,
  governmentApiSecretName: process.env.GOVERNMENT_API_SECRET_NAME || 'maitri/government-apis/credentials',
  circuitBreakerThreshold: 0.5,
  circuitBreakerWindowMs: 60000,
  circuitBreakerResetMs: 30000,
};

const aiEngine = new AIEngine(config, bedrockClient, secretsClient);

export interface AIRequest {
  userInput: string;
  languageCode: string;
  userId: string;
  ragContext?: Array<{
    question: string;
    answer: string;
    category: string;
  }>;
}

export interface AIResponse {
  text: string;
  mode: 'online' | 'offline';
  confidence: number;
  sources?: string[];
  processingTime: number;
}

export const handler = async (event: AIRequest): Promise<AIResponse> => {
  try {
    const result = await aiEngine.generateResponse(event);
    return result;
  } catch (error) {
    console.error('AI Engine error:', error);
    throw error;
  }
};
