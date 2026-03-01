/**
 * Language Detector Lambda Handler
 * 
 * Identifies the language of user input and manages language preferences.
 * Supports 10 Indian languages with confidence scoring.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.3
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LanguageDetector, LanguageDetectorConfig } from './language-detector-service';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const config: LanguageDetectorConfig = {
  usersTableName: process.env.USERS_TABLE_NAME || 'MaitriUsers',
  confidenceThreshold: 0.85,
  consecutiveUsesForPreference: 3,
};

const languageDetector = new LanguageDetector(config, docClient);

export interface LanguageDetectionEvent {
  text: string;
  userId: string;
}

export interface LanguageDetectionResponse {
  languageCode: string;
  confidence: number;
  source: 'detected' | 'preference' | 'default';
}

export const handler = async (event: LanguageDetectionEvent): Promise<LanguageDetectionResponse> => {
  try {
    const result = await languageDetector.detectLanguage(event.text, event.userId);
    return result;
  } catch (error) {
    console.error('Language detection error:', error);
    throw error;
  }
};
