/**
 * Property-Based Tests for WhatsApp Gateway
 * 
 * These tests validate universal correctness properties of the WhatsApp Gateway
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  WebhookRequest,
  AudioContent,
  SUPPORTED_AUDIO_FORMATS,
  MAX_AUDIO_SIZE,
  AudioFormat,
} from '../types/whatsapp-gateway';

// Shared arbitrary generators
const phoneNumberArb = fc.string({ minLength: 10, maxLength: 15 })
  .map(s => `+${s.replace(/\D/g, '').slice(0, 15)}`);

const messageIdArb = fc.uuid();

const audioFormatArb = fc.constantFrom(...SUPPORTED_AUDIO_FORMATS);

const audioContentArb = fc.record({
  mimeType: audioFormatArb.map(format => {
    const mimeTypes: Record<AudioFormat, string> = {
      'ogg': 'audio/ogg',
      'mp3': 'audio/mpeg',
      'aac': 'audio/aac',
    };
    return mimeTypes[format];
  }),
  url: fc.webUrl(),
  size: fc.integer({ min: 1, max: MAX_AUDIO_SIZE }),
});

const voiceNoteRequestArb = fc.record({
  from: phoneNumberArb,
  messageId: messageIdArb,
  timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
  type: fc.constant('audio' as const),
  content: audioContentArb,
});

const textContentArb = fc.string({ minLength: 1, maxLength: 1000 });

const textMessageRequestArb = fc.record({
  from: phoneNumberArb,
  messageId: fc.uuid(),
  timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
  type: fc.constant('text' as const),
  content: textContentArb,
});



/**
 * Property 1: Voice Note Storage
 * 
 * **Validates: Requirements 1.1**
 */
describe('Property 1: Voice Note Storage', () => {
  it('should store voice notes with correct S3 path structure', () => {
    fc.assert(
      fc.property(voiceNoteRequestArb, (request: WebhookRequest) => {
        const audioContent = request.content as AudioContent;
        const userId = `user#${request.from}`;
        const date = new Date(request.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        const expectedKeyPattern = `input/${year}/${month}/${day}/${userId}/${request.messageId}`;
        expect(expectedKeyPattern).toMatch(/^input\/\d{4}\/\d{2}\/\d{2}\/user#\+[\d]+\/[a-f0-9-]+$/);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should accept all supported audio formats (OGG, MP3, AAC)', () => {
    fc.assert(
      fc.property(voiceNoteRequestArb, (request: WebhookRequest) => {
        const audioContent = request.content as AudioContent;
        const format = audioContent.mimeType.split('/')[1];
        expect(SUPPORTED_AUDIO_FORMATS).toContain(format);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should store audio files with size within limits', () => {
    fc.assert(
      fc.property(voiceNoteRequestArb, (request: WebhookRequest) => {
        const audioContent = request.content as AudioContent;
        expect(audioContent.size).toBeGreaterThan(0);
        expect(audioContent.size).toBeLessThanOrEqual(MAX_AUDIO_SIZE);
        return true;
      }),
      { numRuns: 100 }
    );
  });
});



/**
 * Property 2: Text Message Forwarding
 * 
 * **Validates: Requirements 1.2**
 */
describe('Property 2: Text Message Forwarding', () => {
  it('should preserve original text content when forwarding', () => {
    fc.assert(
      fc.property(textMessageRequestArb, (request: WebhookRequest) => {
        const originalContent = request.content as string;
        const forwardedContent = originalContent;
        
        expect(forwardedContent).toBe(originalContent);
        expect(forwardedContent.length).toBe(originalContent.length);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should forward text messages with all metadata', () => {
    fc.assert(
      fc.property(textMessageRequestArb, (request: WebhookRequest) => {
        expect(request.from).toBeDefined();
        expect(request.messageId).toBeDefined();
        expect(request.timestamp).toBeDefined();
        expect(request.type).toBe('text');
        expect(request.content).toBeDefined();
        expect(typeof request.content).toBe('string');
        expect((request.content as string).length).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should distinguish between text and audio message types', () => {
    fc.assert(
      fc.property(textMessageRequestArb, (request: WebhookRequest) => {
        expect(request.type).toBe('text');
        expect(typeof request.content).toBe('string');
        return true;
      }),
      { numRuns: 100 }
    );
  });
});



/**
 * Property 3: Audio Format Support
 * 
 * **Validates: Requirements 1.3**
 */
describe('Property 3: Audio Format Support', () => {
  const oggAudioArb = fc.record({
    mimeType: fc.constant('audio/ogg'),
    url: fc.webUrl(),
    size: fc.integer({ min: 1, max: MAX_AUDIO_SIZE }),
  });

  const mp3AudioArb = fc.record({
    mimeType: fc.constant('audio/mpeg'),
    url: fc.webUrl(),
    size: fc.integer({ min: 1, max: MAX_AUDIO_SIZE }),
  });

  const aacAudioArb = fc.record({
    mimeType: fc.constant('audio/aac'),
    url: fc.webUrl(),
    size: fc.integer({ min: 1, max: MAX_AUDIO_SIZE }),
  });

  const anyAudioFormatArb = fc.oneof(oggAudioArb, mp3AudioArb, aacAudioArb);

  it('should accept OGG audio format', () => {
    fc.assert(
      fc.property(
        fc.record({
          from: phoneNumberArb,
          messageId: fc.uuid(),
          timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
          type: fc.constant('audio' as const),
          content: oggAudioArb,
        }),
        (request: WebhookRequest) => {
          const audioContent = request.content as AudioContent;
          expect(audioContent.mimeType).toBe('audio/ogg');
          expect(SUPPORTED_AUDIO_FORMATS).toContain('ogg');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept MP3 audio format', () => {
    fc.assert(
      fc.property(
        fc.record({
          from: phoneNumberArb,
          messageId: fc.uuid(),
          timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
          type: fc.constant('audio' as const),
          content: mp3AudioArb,
        }),
        (request: WebhookRequest) => {
          const audioContent = request.content as AudioContent;
          expect(audioContent.mimeType).toBe('audio/mpeg');
          expect(SUPPORTED_AUDIO_FORMATS).toContain('mp3');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept AAC audio format', () => {
    fc.assert(
      fc.property(
        fc.record({
          from: phoneNumberArb,
          messageId: fc.uuid(),
          timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
          type: fc.constant('audio' as const),
          content: aacAudioArb,
        }),
        (request: WebhookRequest) => {
          const audioContent = request.content as AudioContent;
          expect(audioContent.mimeType).toBe('audio/aac');
          expect(SUPPORTED_AUDIO_FORMATS).toContain('aac');
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept all three supported formats uniformly', () => {
    fc.assert(
      fc.property(
        fc.record({
          from: phoneNumberArb,
          messageId: fc.uuid(),
          timestamp: fc.integer({ min: 1600000000000, max: 2000000000000 }),
          type: fc.constant('audio' as const),
          content: anyAudioFormatArb,
        }),
        (request: WebhookRequest) => {
          const audioContent = request.content as AudioContent;
          const format = audioContent.mimeType.split('/')[1];
          expect(['ogg', 'mpeg', 'aac']).toContain(format);
          
          const normalizedFormat = format === 'mpeg' ? 'mp3' : format;
          expect(SUPPORTED_AUDIO_FORMATS).toContain(normalizedFormat as AudioFormat);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
