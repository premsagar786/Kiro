/**
 * FAQ Engine Lambda Handler
 * 
 * Provides offline fallback using keyword-based search
 * when AI Engine is unavailable.
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { FAQEngine, FAQEngineConfig } from './faq-engine-service';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const config: FAQEngineConfig = {
  faqTableName: process.env.FAQ_TABLE_NAME || 'MaitriFAQ',
  keywordMatchThreshold: 0.7,
};

const faqEngine = new FAQEngine(config, docClient);

export interface FAQRequest {
  query: string;
  languageCode: string;
}

export interface FAQResponse {
  match: {
    id: string;
    question: string;
    answer: string;
    category: string;
  } | null;
  score: number;
  searchTime: number;
}

export const handler = async (event: FAQRequest): Promise<FAQResponse> => {
  try {
    const result = await faqEngine.searchFAQs(event.query, event.languageCode);
    
    return {
      match: result.match ? {
        id: result.match.id,
        question: result.match.question,
        answer: result.match.answer,
        category: result.match.category,
      } : null,
      score: result.score,
      searchTime: result.searchTime,
    };
  } catch (error) {
    console.error('FAQ engine error:', error);
    throw error;
  }
};
