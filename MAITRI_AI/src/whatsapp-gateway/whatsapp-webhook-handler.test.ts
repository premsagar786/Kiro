/**
 * Unit tests for WhatsApp Webhook Handler
 * 
 * Tests webhook signature verification, phone number validation,
 * audio storage, and request forwarding.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import {
  handler,
  verifySignature,
  validatePhoneNumber,
  storeAudioInS3
} from './whatsapp-webhook-handler';
import { AudioContent, WhatsAppIncomingMessage } from '../types/whatsapp-gateway';

// Mock AWS SDK clients
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({
    send: vi.fn()
  })),
  PutObjectCommand: vi.fn()
}));

vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: vi.fn(() => ({
    send: vi.fn()
  })),
  InvokeCommand: vi.fn()
}));

describe('WhatsApp Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variables
    process.env.AWS_REGION = 'us-east-1';
    process.env.S3_VOICE_BUCKET = 'test-bucket';
    process.env.ORCHESTRATOR_FUNCTION = 'test-orchestrator';
    process.env.WEBHOOK_SECRET = 'test-secret';
  });

  describe('verifySignature', () => {
    it('should verify valid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const result = verifySignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signature = 'sha256=invalid-signature';

      const result = verifySignature(payload, signature, secret);
      expect(result).toBe(false);
    });

    it('should reject missing signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';

      const result = verifySignature(payload, '', secret);
      expect(result).toBe(false);
    });

    it('should reject empty payload', () => {
      const secret = 'my-secret';
      const signature = 'sha256=test';

      const result = verifySignature('', signature, secret);
      expect(result).toBe(false);
    });

    it('should handle signature without sha256= prefix', () => {
      const payload = '{"test": "data"}';
      const secret = 'my-secret';
      const signatureHash = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const result = verifySignature(payload, signatureHash, secret);
      expect(result).toBe(true); // Should succeed - we handle both formats
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate correct E.164 phone numbers', () => {
      const validNumbers = [
        '+919876543210',  // India
        '+14155552671',   // USA
        '+442071838750',  // UK
        '+861234567890',  // China
        '+5511987654321'  // Brazil
      ];

      validNumbers.forEach(number => {
        expect(validatePhoneNumber(number)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '919876543210',      // Missing +
        '+91 9876543210',    // Contains space
        '+91-9876543210',    // Contains hyphen
        '9876543210',        // No country code
        '+0123456789',       // Starts with 0
        '+1234567890123456', // Too long (>15 digits)
        'invalid',           // Not a number
        ''                   // Empty string
      ];

      invalidNumbers.forEach(number => {
        expect(validatePhoneNumber(number)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validatePhoneNumber('+1')).toBe(false); // Too short
      expect(validatePhoneNumber('+12')).toBe(true);  // Minimum valid
      expect(validatePhoneNumber('+123456789012345')).toBe(true); // Maximum valid
    });
  });

  describe('storeAudioInS3', () => {
    it('should generate correct S3 path structure', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/ogg',
        url: 'https://example.com/audio.ogg',
        size: 1024
      };
      const userId = '+919876543210';
      const messageId = 'msg123';

      const result = await storeAudioInS3(audio, userId, messageId);

      // Check path structure: input/{year}/{month}/{day}/{userId}/{messageId}.{format}
      expect(result.key).toMatch(/^input\/\d{4}\/\d{2}\/\d{2}\/\d+\/msg123\.ogg$/);
      expect(result.bucket).toBe('test-bucket');
      expect(result.format).toBe('ogg');
    });

    it('should support OGG format', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/ogg',
        url: 'https://example.com/audio.ogg',
        size: 1024
      };

      const result = await storeAudioInS3(audio, '+919876543210', 'msg123');
      expect(result.format).toBe('ogg');
      expect(result.key).toContain('.ogg');
    });

    it('should support MP3 format', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/mpeg',
        url: 'https://example.com/audio.mp3',
        size: 1024
      };

      const result = await storeAudioInS3(audio, '+919876543210', 'msg123');
      expect(result.format).toBe('mp3');
      expect(result.key).toContain('.mp3');
    });

    it('should support AAC format', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/aac',
        url: 'https://example.com/audio.aac',
        size: 1024
      };

      const result = await storeAudioInS3(audio, '+919876543210', 'msg123');
      expect(result.format).toBe('aac');
      expect(result.key).toContain('.aac');
    });

    it('should reject unsupported audio format', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/wav',
        url: 'https://example.com/audio.wav',
        size: 1024
      };

      await expect(
        storeAudioInS3(audio, '+919876543210', 'msg123')
      ).rejects.toThrow('Unsupported audio format');
    });

    it('should reject audio exceeding 16MB', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/ogg',
        url: 'https://example.com/audio.ogg',
        size: 17 * 1024 * 1024 // 17MB
      };

      await expect(
        storeAudioInS3(audio, '+919876543210', 'msg123')
      ).rejects.toThrow('exceeds maximum size');
    });

    it('should sanitize userId in path', async () => {
      const audio: AudioContent = {
        mimeType: 'audio/ogg',
        url: 'https://example.com/audio.ogg',
        size: 1024
      };
      const userId = '+91-9876-543210'; // Contains special characters

      const result = await storeAudioInS3(audio, userId, 'msg123');
      
      // Should remove + and - characters
      expect(result.key).not.toContain('+');
      expect(result.key).not.toContain('-');
      expect(result.key).toContain('919876543210');
    });
  });

  describe('handler - webhook verification', () => {
    it('should verify webhook with correct token', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-secret',
          'hub.challenge': 'challenge-string'
        }
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('challenge-string');
    });

    it('should reject webhook with incorrect token', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge-string'
        }
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
    });

    it('should reject webhook with incorrect mode', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          'hub.mode': 'unsubscribe',
          'hub.verify_token': 'test-secret',
          'hub.challenge': 'challenge-string'
        }
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(403);
    });
  });

  describe('handler - message processing', () => {
    it('should reject request with invalid signature', async () => {
      const payload: WhatsAppIncomingMessage = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'entry123',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '+919876543210',
                phone_number_id: 'phone123'
              },
              contacts: [{
                profile: { name: 'Test User' },
                wa_id: '919876543210'
              }],
              messages: [{
                from: '+919876543210',
                id: 'msg123',
                timestamp: '1234567890',
                type: 'text',
                text: { body: 'Hello' }
              }]
            },
            field: 'messages'
          }]
        }]
      };

      const event = {
        httpMethod: 'POST',
        headers: {
          'x-hub-signature-256': 'sha256=invalid-signature'
        },
        body: JSON.stringify(payload)
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body).error).toBe('Invalid signature');
    });

    it('should return 400 for invalid HTTP method', async () => {
      const event = {
        httpMethod: 'PUT',
        headers: {},
        body: '{}'
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing headers gracefully', async () => {
      const event = {
        httpMethod: 'POST',
        headers: {},
        body: '{}'
      };

      const result = await handler(event);

      expect(result.statusCode).toBe(401);
    });

    it('should handle malformed JSON payload', async () => {
      const secret = 'test-secret';
      const payload = 'invalid json';
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const event = {
        httpMethod: 'POST',
        headers: {
          'x-hub-signature-256': signature
        },
        body: payload
      };

      const result = await handler(event);

      // Should fail at JSON parsing, returning 500
      expect(result.statusCode).toBe(500);
    });
  });
});
