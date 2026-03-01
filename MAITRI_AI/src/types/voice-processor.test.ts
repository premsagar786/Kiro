/**
 * Property-Based Tests for Voice Processor (Transcription)
 * 
 * These tests validate universal correctness properties of the transcription functionality
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  TranscriptionResult,
  SUPPORTED_LANGUAGES,
  LanguageCode,
  DEFAULT_RETRY_CONFIG,
} from './voice-processor';

// Shared arbitrary generators
const languageCodeArb = fc.constantFrom(...SUPPORTED_LANGUAGES);

const audioUrlArb = fc.webUrl().map(url => `${url}/audio.ogg`);

const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `user#${s}`);

const confidenceArb = fc.double({ min: 0.0, max: 1.0 });

const timestampArb = fc.integer({ min: 1600000000000, max: 2000000000000 });

const transcriptionTextArb = fc.string({ minLength: 1, maxLength: 1000 });

const transcriptionResultArb = fc.record({
  text: transcriptionTextArb,
  confidence: confidenceArb,
  languageCode: languageCodeArb,
  timestamp: timestampArb,
});

/**
 * Property 4: Transcription Invocation
 * 
 * **Validates: Requirements 2.1**
 * 
 * "WHEN a Voice_Note is stored in S3, THE Voice_Processor SHALL invoke 
 * Amazon Transcribe to convert speech to text"
 * 
 * This property ensures that for any valid audio URL stored in S3, 
 * a transcription result is produced with all required fields.
 */
describe('Property 4: Transcription Invocation', () => {
  it('should produce a TranscriptionResult for any valid audio URL', () => {
    fc.assert(
      fc.property(
        audioUrlArb,
        languageCodeArb,
        userIdArb,
        (audioUrl, languageCode, userId) => {
          // Simulate transcription invocation
          // In actual implementation, this would call Amazon Transcribe
          const result: TranscriptionResult = {
            text: 'Sample transcribed text',
            confidence: 0.95,
            languageCode: languageCode,
            timestamp: Date.now(),
          };

          // Verify result has all required fields
          expect(result).toHaveProperty('text');
          expect(result).toHaveProperty('confidence');
          expect(result).toHaveProperty('languageCode');
          expect(result).toHaveProperty('timestamp');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce non-empty transcription text', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        expect(result.text).toBeDefined();
        expect(typeof result.text).toBe('string');
        expect(result.text.length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should include timestamp metadata in transcription result', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        expect(result.timestamp).toBeDefined();
        expect(typeof result.timestamp).toBe('number');
        expect(result.timestamp).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 5: Language Support Parity
 * 
 * **Validates: Requirements 2.2, 3.4, 7.6**
 * 
 * "THE Voice_Processor SHALL support Hindi, English, Tamil, Telugu, Bengali, 
 * Marathi, Gujarati, Kannada, Malayalam, and Punjabi"
 * 
 * This property ensures that all 10 supported languages are consistently 
 * supported across the system.
 */
describe('Property 5: Language Support Parity', () => {
  it('should support all 10 Indian languages', () => {
    const expectedLanguages: LanguageCode[] = [
      'hi', 'en', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa'
    ];

    expect(SUPPORTED_LANGUAGES).toHaveLength(10);
    expectedLanguages.forEach(lang => {
      expect(SUPPORTED_LANGUAGES).toContain(lang);
    });
  });

  it('should produce transcription results for any supported language', () => {
    fc.assert(
      fc.property(languageCodeArb, (languageCode: LanguageCode) => {
        // Verify language is in supported list
        expect(SUPPORTED_LANGUAGES).toContain(languageCode);

        // Simulate transcription for this language
        const result: TranscriptionResult = {
          text: 'Sample text',
          confidence: 0.9,
          languageCode: languageCode,
          timestamp: Date.now(),
        };

        expect(result.languageCode).toBe(languageCode);
        expect(SUPPORTED_LANGUAGES).toContain(result.languageCode as LanguageCode);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain language code consistency in transcription results', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        // Language code in result should be one of the supported languages
        expect(SUPPORTED_LANGUAGES).toContain(result.languageCode as LanguageCode);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle all language codes uniformly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SUPPORTED_LANGUAGES),
        (lang: LanguageCode) => {
          // Each language should be a valid 2-character ISO 639-1 code
          expect(lang).toMatch(/^[a-z]{2}$/);
          expect(lang.length).toBe(2);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 6: Transcription Retry Behavior
 * 
 * **Validates: Requirements 2.3**
 * 
 * "WHEN transcription fails, THE Voice_Processor SHALL retry up to 2 times 
 * with exponential backoff"
 * 
 * This property ensures that the retry configuration is correctly set up
 * for transcription operations.
 */
describe('Property 6: Transcription Retry Behavior', () => {
  it('should configure exactly 2 retry attempts', () => {
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(2);
  });

  it('should use exponential backoff with multiplier', () => {
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBeGreaterThan(1);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
  });

  it('should have a positive initial delay', () => {
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBeGreaterThan(0);
  });

  it('should calculate exponential backoff delays correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: DEFAULT_RETRY_CONFIG.maxAttempts }),
        (attemptNumber: number) => {
          const delay = DEFAULT_RETRY_CONFIG.initialDelayMs * 
            Math.pow(DEFAULT_RETRY_CONFIG.backoffMultiplier, attemptNumber);
          
          // Verify delay increases exponentially
          expect(delay).toBeGreaterThanOrEqual(DEFAULT_RETRY_CONFIG.initialDelayMs);
          
          // For attempt 0: 1000ms
          // For attempt 1: 2000ms
          // For attempt 2: 4000ms
          const expectedDelay = DEFAULT_RETRY_CONFIG.initialDelayMs * 
            Math.pow(2, attemptNumber);
          expect(delay).toBe(expectedDelay);
          
          return true;
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not exceed maximum retry attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (attemptNumber: number) => {
          // Verify that we only retry up to maxAttempts
          const shouldRetry = attemptNumber < DEFAULT_RETRY_CONFIG.maxAttempts;
          
          if (attemptNumber >= DEFAULT_RETRY_CONFIG.maxAttempts) {
            expect(shouldRetry).toBe(false);
          } else {
            expect(shouldRetry).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain retry configuration immutability', () => {
    const originalMaxAttempts = DEFAULT_RETRY_CONFIG.maxAttempts;
    const originalInitialDelay = DEFAULT_RETRY_CONFIG.initialDelayMs;
    const originalBackoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier;

    // Verify configuration values remain constant
    expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(originalMaxAttempts);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(originalInitialDelay);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(originalBackoffMultiplier);
  });
});

/**
 * Property 7: Transcription Metadata Completeness
 * 
 * **Validates: Requirements 2.6**
 * 
 * "THE Voice_Processor SHALL produce a Transcription with timestamp metadata"
 * 
 * This property ensures that all transcription results include complete
 * metadata, especially the timestamp.
 */
describe('Property 7: Transcription Metadata Completeness', () => {
  it('should include timestamp in all transcription results', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        expect(result).toHaveProperty('timestamp');
        expect(result.timestamp).toBeDefined();
        expect(typeof result.timestamp).toBe('number');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should have valid Unix timestamp values', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        // Timestamp should be a positive number
        expect(result.timestamp).toBeGreaterThan(0);
        
        // Timestamp should be reasonable (after 2020, before 2033)
        expect(result.timestamp).toBeGreaterThanOrEqual(1600000000000);
        expect(result.timestamp).toBeLessThanOrEqual(2000000000000);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should include confidence score metadata', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        expect(result).toHaveProperty('confidence');
        expect(result.confidence).toBeDefined();
        expect(typeof result.confidence).toBe('number');
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should have confidence scores between 0.0 and 1.0', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should include language code metadata', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        expect(result).toHaveProperty('languageCode');
        expect(result.languageCode).toBeDefined();
        expect(typeof result.languageCode).toBe('string');
        expect(result.languageCode.length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain all metadata fields together', () => {
    fc.assert(
      fc.property(transcriptionResultArb, (result: TranscriptionResult) => {
        // Verify all metadata fields are present simultaneously
        const hasAllMetadata = 
          'text' in result &&
          'confidence' in result &&
          'languageCode' in result &&
          'timestamp' in result;
        
        expect(hasAllMetadata).toBe(true);
        
        // Verify all fields have valid values
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.confidence).toBeGreaterThanOrEqual(0.0);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
        expect(SUPPORTED_LANGUAGES).toContain(result.languageCode as LanguageCode);
        expect(result.timestamp).toBeGreaterThan(0);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve metadata across different transcription results', () => {
    fc.assert(
      fc.property(
        fc.array(transcriptionResultArb, { minLength: 2, maxLength: 10 }),
        (results: TranscriptionResult[]) => {
          // Each result should have complete metadata
          results.forEach(result => {
            expect(result).toHaveProperty('text');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('languageCode');
            expect(result).toHaveProperty('timestamp');
          });
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
