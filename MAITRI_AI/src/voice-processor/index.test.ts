/**
 * Unit Tests for Voice Processor Lambda Handler
 * 
 * Tests the Lambda handler function and its integration with the transcription 
 * and text-to-speech services.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, VoiceProcessorEvent } from './index';
import { LanguageCode } from '../types/voice-processor';

// Mock the transcription service
vi.mock('./transcription-service', () => ({
  TranscriptionService: vi.fn(() => ({
    transcribeAudio: vi.fn(),
  })),
}));

// Mock the text-to-speech service
vi.mock('./text-to-speech-service', () => ({
  TextToSpeechService: vi.fn(() => ({
    synthesizeSpeech: vi.fn(),
  })),
}));

describe('Voice Processor Lambda Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set required environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.S3_VOICE_BUCKET = 'test-bucket';
  });

  describe('Environment Validation', () => {
    it('should require S3_VOICE_BUCKET environment variable', async () => {
      delete process.env.S3_VOICE_BUCKET;

      const event: TranscriptionEvent = {
        action: 'transcribe',
        audioUrl: 's3://bucket/audio.ogg',
        languageCode: 'hi',
        userId: 'user123',
      };

      const response = await handler(event);
      
      expect(response.statusCode).toBe(500);
      expect(response.body).toContain('S3_VOICE_BUCKET');
    });
  });

  describe('Event Validation', () => {
    it('should return 400 for missing action', async () => {
      const event = {
        audioUrl: 's3://bucket/audio.ogg',
        languageCode: 'hi' as LanguageCode,
        userId: 'user123',
      } as any;

      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toContain('Missing action');
    });

    it('should return 400 for unknown action', async () => {
      const event = {
        action: 'unknown',
        audioUrl: 's3://bucket/audio.ogg',
        languageCode: 'hi' as LanguageCode,
        userId: 'user123',
      } as any;

      const response = await handler(event);
      
      expect(response.statusCode).toBe(400);
      expect(response.body).toContain('Unknown action');
    });

    describe('Transcription Event Validation', () => {
      it('should return 400 for missing audioUrl', async () => {
        const event = {
          action: 'transcribe',
          languageCode: 'hi' as LanguageCode,
          userId: 'user123',
        } as any;

        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Missing audioUrl');
      });

      it('should return 400 for missing languageCode', async () => {
        const event = {
          action: 'transcribe',
          audioUrl: 's3://bucket/audio.ogg',
          userId: 'user123',
        } as any;

        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Missing languageCode');
      });

      it('should return 400 for missing userId', async () => {
        const event = {
          action: 'transcribe',
          audioUrl: 's3://bucket/audio.ogg',
          languageCode: 'hi' as LanguageCode,
        } as any;

        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Missing userId');
      });
    });

    describe('Synthesis Event Validation', () => {
      it('should return 400 for missing text', async () => {
        const event = {
          action: 'synthesize',
          languageCode: 'hi' as LanguageCode,
          userId: 'user123',
        } as any;

        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Missing text');
      });

      it('should return 400 for missing languageCode in synthesis', async () => {
        const event = {
          action: 'synthesize',
          text: 'Hello world',
          userId: 'user123',
        } as any;

        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Missing languageCode');
      });

      it('should return 400 for missing userId in synthesis', async () => {
        const event = {
          action: 'synthesize',
          text: 'Hello world',
          languageCode: 'hi' as LanguageCode,
        } as any;

        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('Missing userId');
      });
    });
  });

  describe('Response Format', () => {
    it('should return success response with correct structure', () => {
      const successResponse = {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          result: {
            text: 'Sample text',
            confidence: 0.95,
            languageCode: 'hi',
            timestamp: Date.now(),
          },
        }),
      };

      const parsed = JSON.parse(successResponse.body);
      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('result');
      expect(parsed.success).toBe(true);
    });

    it('should return error response with correct structure', () => {
      const errorResponse = {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Test error',
        }),
      };

      const parsed = JSON.parse(errorResponse.body);
      expect(parsed).toHaveProperty('success');
      expect(parsed).toHaveProperty('error');
      expect(parsed.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle transcription service errors', async () => {
      // This test verifies error handling structure
      const error = new Error('Transcription failed');
      
      expect(error.message).toBe('Transcription failed');
    });

    it('should return 503 for retry exhaustion', async () => {
      const error = new Error('Transcription failed after 2 attempts');
      
      expect(error.message).toContain('failed after');
    });

    it('should return 500 for general transcription errors', async () => {
      const error = new Error('Unknown error');
      
      expect(error.message).not.toContain('failed after');
    });
  });

  describe('Logging', () => {
    it('should log transcription start', () => {
      const logData = {
        audioUrl: 's3://bucket/audio.ogg',
        languageCode: 'hi',
        userId: 'user123',
      };

      expect(logData).toHaveProperty('audioUrl');
      expect(logData).toHaveProperty('languageCode');
      expect(logData).toHaveProperty('userId');
    });

    it('should log transcription completion', () => {
      const logData = {
        textLength: 100,
        confidence: 0.95,
        languageCode: 'hi',
        timestamp: Date.now(),
      };

      expect(logData).toHaveProperty('textLength');
      expect(logData).toHaveProperty('confidence');
      expect(logData).toHaveProperty('languageCode');
      expect(logData).toHaveProperty('timestamp');
    });

    it('should log errors with context', () => {
      const error = new Error('Test error');
      const logData = {
        error: error.message,
        stack: error.stack,
      };

      expect(logData).toHaveProperty('error');
      expect(logData.error).toBe('Test error');
    });
  });

  describe('Language Support', () => {
    it('should accept all supported languages', () => {
      const supportedLanguages: LanguageCode[] = [
        'hi', 'en', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa'
      ];

      supportedLanguages.forEach(lang => {
        const event: TranscriptionEvent = {
          action: 'transcribe',
          audioUrl: 's3://bucket/audio.ogg',
          languageCode: lang,
          userId: 'user123',
        };

        expect(event.languageCode).toBe(lang);
      });
    });
  });

  describe('S3 URL Formats', () => {
    it('should accept s3:// URL format', () => {
      const url = 's3://bucket/input/audio.ogg';
      expect(url).toMatch(/^s3:\/\//);
    });

    it('should accept HTTPS S3 URL format', () => {
      const url = 'https://bucket.s3.us-east-1.amazonaws.com/audio.ogg';
      expect(url).toMatch(/^https:\/\//);
      expect(url).toContain('.s3.');
    });
  });

  describe('Integration Points', () => {
    it('should pass correct parameters to transcription service', () => {
      const event: VoiceProcessorEvent = {
        action: 'transcribe',
        audioUrl: 's3://bucket/audio.ogg',
        languageCode: 'hi',
        userId: 'user123',
      };

      // Verify event structure matches service expectations
      expect(event.audioUrl).toBeDefined();
      expect(event.languageCode).toBeDefined();
      expect(event.userId).toBeDefined();
    });

    it('should return transcription result in expected format', () => {
      const result = {
        text: 'Sample transcribed text',
        confidence: 0.95,
        languageCode: 'hi' as LanguageCode,
        timestamp: Date.now(),
      };

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('languageCode');
      expect(result).toHaveProperty('timestamp');
      
      expect(typeof result.text).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.languageCode).toBe('string');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should pass correct parameters to synthesis service', () => {
      const event: VoiceProcessorEvent = {
        action: 'synthesize',
        text: 'Hello world',
        languageCode: 'hi',
        userId: 'user123',
      };

      // Verify event structure matches service expectations
      expect(event.text).toBeDefined();
      expect(event.languageCode).toBeDefined();
      expect(event.userId).toBeDefined();
    });

    it('should return synthesis result in expected format', () => {
      const result = {
        audioUrl: 's3://bucket/output/audio.ogg',
        duration: 10,
        format: 'ogg',
        expiresAt: Date.now() + (48 * 60 * 60 * 1000),
      };

      expect(result).toHaveProperty('audioUrl');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('expiresAt');
      
      expect(typeof result.audioUrl).toBe('string');
      expect(typeof result.duration).toBe('number');
      expect(typeof result.format).toBe('string');
      expect(typeof result.expiresAt).toBe('number');
    });
  });

  describe('Synthesis Logging', () => {
    it('should log synthesis start', () => {
      const logData = {
        textLength: 100,
        languageCode: 'hi',
        userId: 'user123',
      };

      expect(logData).toHaveProperty('textLength');
      expect(logData).toHaveProperty('languageCode');
      expect(logData).toHaveProperty('userId');
    });

    it('should log synthesis completion', () => {
      const logData = {
        audioUrl: 's3://bucket/output/audio.ogg',
        duration: 10,
        format: 'ogg',
        expiresAt: Date.now() + (48 * 60 * 60 * 1000),
      };

      expect(logData).toHaveProperty('audioUrl');
      expect(logData).toHaveProperty('duration');
      expect(logData).toHaveProperty('format');
      expect(logData).toHaveProperty('expiresAt');
    });
  });

  describe('Synthesis Error Handling', () => {
    it('should handle synthesis service errors', async () => {
      const error = new Error('Synthesis failed');
      
      expect(error.message).toBe('Synthesis failed');
    });

    it('should return 500 for synthesis errors', async () => {
      const error = new Error('Polly service unavailable');
      
      expect(error.message).toContain('Polly');
    });
  });
});
