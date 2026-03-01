/**
 * Voice Processor Lambda Handler
 * 
 * Main entry point for the Voice Processor Lambda function.
 * Handles speech-to-text and text-to-speech operations.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.6
 */

import { TranscriptionService } from './transcription-service';
import { TextToSpeechService } from './text-to-speech-service';
import {
  TranscribeRequest,
  TranscriptionResult,
  AudioResult,
  LanguageCode,
} from '../types/voice-processor';

/**
 * Lambda event for voice processing requests
 */
export interface VoiceProcessorEvent {
  action: 'transcribe' | 'synthesize';
  // For transcribe action
  audioUrl?: string;
  // For synthesize action
  text?: string;
  // Common fields
  languageCode: LanguageCode;
  userId: string;
}

/**
 * Transcription event type
 */
interface TranscriptionEvent extends VoiceProcessorEvent {
  action: 'transcribe';
  audioUrl: string;
}

/**
 * Synthesis event type
 */
interface SynthesisEvent extends VoiceProcessorEvent {
  action: 'synthesize';
  text: string;
}

/**
 * Lambda response
 */
export interface LambdaResponse {
  statusCode: number;
  body: string;
}

/**
 * Initialize services (outside handler for reuse)
 */
const transcriptionService = new TranscriptionService({
  region: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.S3_VOICE_BUCKET || '',
});

const textToSpeechService = new TextToSpeechService({
  region: process.env.AWS_REGION || 'us-east-1',
  s3Bucket: process.env.S3_VOICE_BUCKET || '',
  bitrate: 64, // 64 kbps for low bandwidth
  expirationHours: 48, // 48-hour expiration
});

/**
 * Lambda handler for voice processing operations
 * 
 * @param event - Lambda event containing voice processing request
 * @returns Lambda response with processing result
 */
export async function handler(event: VoiceProcessorEvent): Promise<LambdaResponse> {
  console.log('Voice Processor Lambda invoked', { event });

  try {
    // Validate required environment variables
    if (!process.env.S3_VOICE_BUCKET) {
      throw new Error('S3_VOICE_BUCKET environment variable is required');
    }

    // Validate event
    if (!event.action) {
      return createErrorResponse(400, 'Missing action in event');
    }

    // Handle transcription action
    if (event.action === 'transcribe') {
      return await handleTranscription(event as TranscriptionEvent);
    }

    // Handle synthesis action
    if (event.action === 'synthesize') {
      return await handleSynthesis(event as SynthesisEvent);
    }

    return createErrorResponse(400, `Unknown action: ${event.action}`);
  } catch (error) {
    console.error('Error processing voice request:', error);
    return createErrorResponse(
      500,
      `Internal server error: ${(error as Error).message}`
    );
  }
}

/**
 * Handle transcription request
 */
async function handleTranscription(event: TranscriptionEvent): Promise<LambdaResponse> {
  // Validate required fields
  if (!event.audioUrl) {
    return createErrorResponse(400, 'Missing audioUrl in event');
  }
  if (!event.languageCode) {
    return createErrorResponse(400, 'Missing languageCode in event');
  }
  if (!event.userId) {
    return createErrorResponse(400, 'Missing userId in event');
  }

  try {
    console.log('Starting transcription', {
      audioUrl: event.audioUrl,
      languageCode: event.languageCode,
      userId: event.userId,
    });

    // Perform transcription
    const result: TranscriptionResult = await transcriptionService.transcribeAudio(
      event.audioUrl,
      event.languageCode,
      event.userId
    );

    console.log('Transcription completed', {
      textLength: result.text.length,
      confidence: result.confidence,
      languageCode: result.languageCode,
      timestamp: result.timestamp,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result,
      }),
    };
  } catch (error) {
    console.error('Transcription failed:', error);
    
    // Check if this is a retry exhaustion error
    if ((error as Error).message.includes('failed after')) {
      return createErrorResponse(
        503,
        'Transcription service temporarily unavailable. Please try again later.'
      );
    }

    return createErrorResponse(
      500,
      `Transcription failed: ${(error as Error).message}`
    );
  }
}

/**
 * Handle synthesis request
 */
async function handleSynthesis(event: SynthesisEvent): Promise<LambdaResponse> {
  // Validate required fields
  if (!event.text) {
    return createErrorResponse(400, 'Missing text in event');
  }
  if (!event.languageCode) {
    return createErrorResponse(400, 'Missing languageCode in event');
  }
  if (!event.userId) {
    return createErrorResponse(400, 'Missing userId in event');
  }

  try {
    console.log('Starting text-to-speech synthesis', {
      textLength: event.text.length,
      languageCode: event.languageCode,
      userId: event.userId,
    });

    // Perform synthesis
    const result: AudioResult = await textToSpeechService.synthesizeSpeech(
      event.text,
      event.languageCode,
      event.userId
    );

    console.log('Synthesis completed', {
      audioUrl: result.audioUrl,
      duration: result.duration,
      format: result.format,
      expiresAt: result.expiresAt,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result,
      }),
    };
  } catch (error) {
    console.error('Synthesis failed:', error);
    
    return createErrorResponse(
      500,
      `Synthesis failed: ${(error as Error).message}`
    );
  }
}

/**
 * Create error response
 */
function createErrorResponse(statusCode: number, message: string): LambdaResponse {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}
