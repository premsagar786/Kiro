/**
 * RAG System Lambda Handler
 * 
 * Implements Retrieval-Augmented Generation using semantic search
 * with Amazon Titan Embeddings and DynamoDB.
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { RAGSystem, RAGSystemConfig } from './rag-system-service';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const config: RAGSystemConfig = {
  faqTableName: process.env.FAQ_TABLE_NAME || 'MaitriFAQ',
  embeddingModelId: 'amazon.titan-embed-text-v1',
  similarityThreshold: 0.7,
  maxResults: 5,
  cacheTTL: 3600000, // 1 hour in milliseconds
};

const ragSystem = new RAGSystem(config, bedrockClient, docClient);

export interface RAGRequest {
  query: string;
  languageCode: string;
}

export interface RAGResponse {
  entries: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    relevanceScore: number;
  }>;
  retrievalTime: number;
}

export const handler = async (event: RAGRequest): Promise<RAGResponse> => {
  try {
    const result = await ragSystem.retrieveContext(event.query, event.languageCode);
    
    return {
      entries: result.entries.map((entry, index) => ({
        id: entry.id,
        question: entry.question,
        answer: entry.answer,
        category: entry.category,
        relevanceScore: result.relevanceScores[index],
      })),
      retrievalTime: result.retrievalTime,
    };
  } catch (error) {
    console.error('RAG system error:', error);
    throw error;
  }
};
