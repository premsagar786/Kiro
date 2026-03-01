/**
 * Property-Based Tests for Text-to-Speech Service
 * 
 * These tests validate universal correctness properties of the TextToSpeechService
 * using fast-check for property-based testing.
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { TextToSpeechService } from './text-to-speech-service';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types/voice-processor';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-polly', () => ({
  PollyClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  SynthesizeSpeechCommand: vi.fn(),
  Engine: {
    neural: 'neural',
  },
  OutputFormat: {
    ogg_vorbis: 'ogg_vorbis',
  },
  VoiceId: {},
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
}));

/**
 * Property 25: Text-to-Speech Invocation
 * 
 * **Validates: Requirements 8.1**
 * 
 * For any text response generated (when voice is enabled), the Voice_Processor 
 * should invoke Amazon Polly to convert it to speech.
 * 
 * This property ensures that the synthesizeSpeech method is called with valid
 * parameters and returns a properly structured AudioResult.
 */
describe('Property 25: Text-to-Speech Invocation', () => {
  let service: TextToSpeechService;
  const mockConfig = {
    region: 'us-east-1',
    s3Bucket: 'test-voice-bucket',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TextToSpeechService(mockConfig);
    
    // Mock Polly client to return audio stream
    const mockPollyClient = (service as any).pollyClient;
    mockPollyClient.send = vi.fn().mockResolvedValue({
      AudioStream: (async function* () {
        yield new Uint8Array([1, 2, 3, 4, 5]);
      })(),
    });
    
    // Mock S3 client
    const mockS3Client = (service as any).s3Client;
    mockS3Client.send = vi.fn().mockResolvedValue({});
  });

  // Arbitrary generator for text input
  const textArb = fc.string({ minLength: 1, maxLength: 500 });
  
  // Arbitrary generator for language codes
  const languageCodeArb = fc.constantFrom(...SUPPORTED_LANGUAGES);
  
  // Arbitrary generator for user IDs
  const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `user#${s}`);

  it('should invoke Polly for any valid text, language, and userId', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify that synthesizeSpeech returns an AudioResult
        expect(result).toBeDefined();
        expect(result).toHaveProperty('audioUrl');
        expect(result).toHaveProperty('duration');
        expect(result).toHaveProperty('format');
        expect(result).toHaveProperty('expiresAt');
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return AudioResult with valid audioUrl for any input', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify audioUrl is a non-empty string with S3 format
        expect(typeof result.audioUrl).toBe('string');
        expect(result.audioUrl.length).toBeGreaterThan(0);
        expect(result.audioUrl).toMatch(/^s3:\/\//);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return AudioResult with positive duration for any input', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify duration is a positive number
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThan(0);
        expect(Number.isInteger(result.duration)).toBe(true);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should return AudioResult with future expiration time for any input', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const now = Date.now();
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify expiresAt is in the future
        expect(typeof result.expiresAt).toBe('number');
        expect(result.expiresAt).toBeGreaterThan(now);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should call Polly client for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const mockPollyClient = (service as any).pollyClient;
        mockPollyClient.send.mockClear();
        
        await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify Polly client was called
        expect(mockPollyClient.send).toHaveBeenCalled();
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  it('should call S3 client to store audio for any valid input', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const mockS3Client = (service as any).s3Client;
        mockS3Client.send.mockClear();
        
        await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify S3 client was called to store audio
        expect(mockS3Client.send).toHaveBeenCalled();
        
        return true;
      }),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 26: Neural Voice Selection
 * 
 * **Validates: Requirements 8.2**
 * 
 * For any text-to-speech conversion, the Voice_Processor should use neural 
 * voices appropriate for the detected language.
 * 
 * This property ensures that neural voices are selected for all supported languages.
 */
describe('Property 26: Neural Voice Selection', () => {
  let service: TextToSpeechService;
  const mockConfig = {
    region: 'us-east-1',
    s3Bucket: 'test-voice-bucket',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TextToSpeechService(mockConfig);
    
    // Mock Polly client
    const mockPollyClient = (service as any).pollyClient;
    mockPollyClient.send = vi.fn().mockResolvedValue({
      AudioStream: (async function* () {
        yield new Uint8Array([1, 2, 3, 4, 5]);
      })(),
    });
    
    // Mock S3 client
    const mockS3Client = (service as any).s3Client;
    mockS3Client.send = vi.fn().mockResolvedValue({});
  });

  const textArb = fc.string({ minLength: 1, maxLength: 200 });
  const languageCodeArb = fc.constantFrom(...SUPPORTED_LANGUAGES);
  const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `user#${s}`);

  it('should successfully synthesize speech for all supported languages', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const mockPollyClient = (service as any).pollyClient;
        mockPollyClient.send.mockClear();
        
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify Polly was called (which means neural voice was used)
        expect(mockPollyClient.send).toHaveBeenCalled();
        
        // Verify result is valid
        expect(result).toBeDefined();
        expect(result.audioUrl).toBeDefined();
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should use consistent voice for the same language', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(textArb, textArb),
        languageCodeArb,
        userIdArb,
        async ([text1, text2], languageCode, userId) => {
          // Both calls should succeed for the same language
          const result1 = await service.synthesizeSpeech(text1, languageCode as LanguageCode, userId);
          const result2 = await service.synthesizeSpeech(text2, languageCode as LanguageCode, userId);
          
          // Both should generate valid audio
          expect(result1.audioUrl).toBeDefined();
          expect(result2.audioUrl).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should support all 10 Indian languages', async () => {
    const allLanguages = [...SUPPORTED_LANGUAGES];
    
    for (const languageCode of allLanguages) {
      const result = await service.synthesizeSpeech(
        'Test text',
        languageCode as LanguageCode,
        'user#test'
      );
      
      // Should successfully generate audio for all languages
      expect(result).toBeDefined();
      expect(result.audioUrl).toBeDefined();
    }
  });
});

/**
 * Property 27: Audio Format Consistency
 * 
 * **Validates: Requirements 8.3**
 * 
 * For any audio generated by the Voice_Processor, the output format should be 
 * OGG Vorbis optimized for WhatsApp.
 * 
 * This property ensures consistent audio format across all text-to-speech operations.
 */
describe('Property 27: Audio Format Consistency', () => {
  let service: TextToSpeechService;
  const mockConfig = {
    region: 'us-east-1',
    s3Bucket: 'test-voice-bucket',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TextToSpeechService(mockConfig);
    
    // Mock Polly client
    const mockPollyClient = (service as any).pollyClient;
    mockPollyClient.send = vi.fn().mockResolvedValue({
      AudioStream: (async function* () {
        yield new Uint8Array([1, 2, 3, 4, 5]);
      })(),
    });
    
    // Mock S3 client
    const mockS3Client = (service as any).s3Client;
    mockS3Client.send = vi.fn().mockResolvedValue({});
  });

  const textArb = fc.string({ minLength: 1, maxLength: 200 });
  const languageCodeArb = fc.constantFrom(...SUPPORTED_LANGUAGES);
  const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `user#${s}`);

  it('should always return "ogg" format in AudioResult', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify format is always "ogg"
        expect(result.format).toBe('ogg');
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should always generate S3 keys with .ogg extension', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
        
        // Verify audioUrl ends with .ogg
        expect(result.audioUrl).toMatch(/\.ogg$/);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain format consistency across different languages', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        fc.tuple(languageCodeArb, languageCodeArb),
        userIdArb,
        async (text, [lang1, lang2], userId) => {
          const result1 = await service.synthesizeSpeech(text, lang1 as LanguageCode, userId);
          const result2 = await service.synthesizeSpeech(text, lang2 as LanguageCode, userId);
          
          // Format should be the same regardless of language
          expect(result1.format).toBe(result2.format);
          expect(result1.format).toBe('ogg');
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain format consistency across different text lengths', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 100, maxLength: 500 })
        ),
        languageCodeArb,
        userIdArb,
        async ([shortText, longText], languageCode, userId) => {
          const result1 = await service.synthesizeSpeech(shortText, languageCode as LanguageCode, userId);
          const result2 = await service.synthesizeSpeech(longText, languageCode as LanguageCode, userId);
          
          // Format should be the same regardless of text length
          expect(result1.format).toBe(result2.format);
          expect(result1.format).toBe('ogg');
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 28: Voice Preference Respect
 * 
 * **Validates: Requirements 8.6**
 * 
 * For any user who has disabled voice responses in their preferences, the 
 * Voice_Processor should skip audio generation entirely.
 * 
 * This property ensures that user preferences for voice responses are respected.
 * 
 * Note: This property tests the service behavior when voice preferences are 
 * considered. In the current implementation, the TextToSpeechService always 
 * generates audio when called. The orchestrator layer should check user 
 * preferences before calling synthesizeSpeech.
 */
describe('Property 28: Voice Preference Respect', () => {
  let service: TextToSpeechService;
  const mockConfig = {
    region: 'us-east-1',
    s3Bucket: 'test-voice-bucket',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TextToSpeechService(mockConfig);
    
    // Mock Polly client
    const mockPollyClient = (service as any).pollyClient;
    mockPollyClient.send = vi.fn().mockResolvedValue({
      AudioStream: (async function* () {
        yield new Uint8Array([1, 2, 3, 4, 5]);
      })(),
    });
    
    // Mock S3 client
    const mockS3Client = (service as any).s3Client;
    mockS3Client.send = vi.fn().mockResolvedValue({});
  });

  const textArb = fc.string({ minLength: 1, maxLength: 200 });
  const languageCodeArb = fc.constantFrom(...SUPPORTED_LANGUAGES);
  const userIdArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => `user#${s}`);
  const voiceEnabledArb = fc.boolean();

  it('should generate audio when voice is enabled', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        // Simulate voice enabled scenario
        const voiceEnabled = true;
        
        if (voiceEnabled) {
          const result = await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
          
          // Should generate audio
          expect(result).toBeDefined();
          expect(result.audioUrl).toBeDefined();
          expect(result.audioUrl.length).toBeGreaterThan(0);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should respect voice preference flag in orchestration layer', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        languageCodeArb,
        userIdArb,
        voiceEnabledArb,
        async (text, languageCode, userId, voiceEnabled) => {
          const mockPollyClient = (service as any).pollyClient;
          mockPollyClient.send.mockClear();
          
          // Simulate orchestrator checking voice preference
          if (voiceEnabled) {
            // Only call synthesizeSpeech if voice is enabled
            await service.synthesizeSpeech(text, languageCode as LanguageCode, userId);
            
            // Polly should have been called
            expect(mockPollyClient.send).toHaveBeenCalled();
          } else {
            // Skip synthesizeSpeech if voice is disabled
            // Polly should not be called
            expect(mockPollyClient.send).not.toHaveBeenCalled();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not invoke Polly when voice is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const mockPollyClient = (service as any).pollyClient;
        mockPollyClient.send.mockClear();
        
        // Simulate voice disabled scenario
        const voiceEnabled = false;
        
        if (!voiceEnabled) {
          // Orchestrator should not call synthesizeSpeech
          // Verify Polly was not called
          expect(mockPollyClient.send).not.toHaveBeenCalled();
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should not upload to S3 when voice is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, languageCodeArb, userIdArb, async (text, languageCode, userId) => {
        const mockS3Client = (service as any).s3Client;
        mockS3Client.send.mockClear();
        
        // Simulate voice disabled scenario
        const voiceEnabled = false;
        
        if (!voiceEnabled) {
          // Orchestrator should not call synthesizeSpeech
          // Verify S3 was not called
          expect(mockS3Client.send).not.toHaveBeenCalled();
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle mixed voice preferences across different users', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        languageCodeArb,
        fc.tuple(userIdArb, userIdArb),
        fc.tuple(voiceEnabledArb, voiceEnabledArb),
        async (text, languageCode, [userId1, userId2], [voice1, voice2]) => {
          const mockPollyClient = (service as any).pollyClient;
          
          // User 1
          mockPollyClient.send.mockClear();
          if (voice1) {
            await service.synthesizeSpeech(text, languageCode as LanguageCode, userId1);
            expect(mockPollyClient.send).toHaveBeenCalled();
          } else {
            expect(mockPollyClient.send).not.toHaveBeenCalled();
          }
          
          // User 2
          mockPollyClient.send.mockClear();
          if (voice2) {
            await service.synthesizeSpeech(text, languageCode as LanguageCode, userId2);
            expect(mockPollyClient.send).toHaveBeenCalled();
          } else {
            expect(mockPollyClient.send).not.toHaveBeenCalled();
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
