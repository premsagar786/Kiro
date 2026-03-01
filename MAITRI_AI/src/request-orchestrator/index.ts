/**
 * Request Orchestrator Lambda Handler
 * 
 * Central coordinator that manages the request lifecycle,
 * routes requests to appropriate services, and handles mode switching.
 * 
 * Validates: Requirements 1.5, 1.6, 4.6, 7.1, 9.1-9.6, 16.1, 16.2, 20.2
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { RequestOrchestrator, OrchestratorConfig } from './orchestrator-service';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const cloudWatchClient = new CloudWatchClient({ region: process.env.AWS_REGION });

const config: OrchestratorConfig = {
  voiceProcessorFunctionName: process.env.VOICE_PROCESSOR_FUNCTION || 'voice-processor',
  languageDetectorFunctionName: process.env.LANGUAGE_DETECTOR_FUNCTION || 'language-detector',
  aiEngineFunctionName: process.env.AI_ENGINE_FUNCTION || 'ai-engine',
  ragSystemFunctionName: process.env.RAG_SYSTEM_FUNCTION || 'rag-system',
  faqEngineFunctionName: process.env.FAQ_ENGINE_FUNCTION || 'faq-engine',
  reminderServiceFunctionName: process.env.REMINDER_SERVICE_FUNCTION || 'reminder-service',
  whatsappGatewayFunctionName: process.env.WHATSAPP_GATEWAY_FUNCTION || 'whatsapp-webhook-handler',
  componentTimeouts: {
    voiceProcessor: 30000,
    languageDetector: 5000,
    aiEngine: 5000,
    ragSystem: 2000,
    faqEngine: 2000,
    reminderService: 5000,
  },
  maxDeliveryRetries: 3,
  retryIntervalMs: 5000,
};

const orchestrator = new RequestOrchestrator(config, lambdaClient, cloudWatchClient);

export interface IncomingRequest {
  requestId: string;
  userId: string;
  phoneNumber: string;
  type: 'text' | 'voice';
  content: string | { url: string; mimeType: string };
  timestamp: number;
}

export const handler = async (event: IncomingRequest): Promise<void> => {
  try {
    await orchestrator.processRequest(event);
  } catch (error) {
    console.error('Orchestrator error:', error);
    throw error;
  }
};
