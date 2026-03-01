/**
 * Unit tests for Language Detector Service
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LanguageDetector, LanguageDetectorConfig } from './language-detector-service';

// Mock DynamoDB client
const mockSend = vi.fn();
const mockDocClient = {
  send: mockSend,
} as unknown as DynamoDBDocumentClient;

const config: LanguageDetectorConfig = {
  usersTableName: 'TestUsersTable',
  confidenceThreshold: 0.85,
  consecutiveUsesForPreference: 3,
};

describe('LanguageDetector', () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    vi.clearAllMocks();
    detector = new LanguageDetector(config, mockDocClient);
  });

  describe('detectLanguage', () => {
    it('should detect Hindi with high confidence', async () => {
      // Mock user with no preference
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      const result = await detector.detectLanguage(
        'यह एक परीक्षण संदेश है। मुझे सरकारी योजनाओं के बारे में जानकारी चाहिए।',
        'user#123'
      );

      expect(result.languageCode).toBe('hi');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.source).toBe('detected');
    });

    it('should detect English with high confidence', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      const result = await detector.detectLanguage(
        'This is a test message. I need information about government schemes.',
        'user#123'
      );

      expect(result.languageCode).toBe('en');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.source).toBe('detected');
    });

    it('should detect Tamil with high confidence', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      const result = await detector.detectLanguage(
        'இது ஒரு சோதனை செய்தி. எனக்கு அரசாங்க திட்டங்கள் பற்றி தகவல் தேவை.',
        'user#123'
      );

      expect(result.languageCode).toBe('ta');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.source).toBe('detected');
    });

    it('should detect Telugu with high confidence', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      const result = await detector.detectLanguage(
        'ఇది ఒక పరీక్ష సందేశం. నాకు ప్రభుత్వ పథకాల గురించి సమాచారం కావాలి.',
        'user#123'
      );

      expect(result.languageCode).toBe('te');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.source).toBe('detected');
    });

    it('should detect Bengali with high confidence', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      const result = await detector.detectLanguage(
        'এটি একটি পরীক্ষা বার্তা। আমার সরকারি প্রকল্প সম্পর্কে তথ্য প্রয়োজন।',
        'user#123'
      );

      expect(result.languageCode).toBe('bn');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.source).toBe('detected');
    });

    it('should fall back to user preference when confidence is low', async () => {
      // Mock user with Tamil preference
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user#123',
          preferredLanguage: 'ta',
        },
      });

      const result = await detector.detectLanguage(
        'abc xyz 123',
        'user#123'
      );

      expect(result.languageCode).toBe('ta');
      expect(result.confidence).toBeLessThan(0.85);
      expect(result.source).toBe('preference');
    });

    it('should default to Hindi when no preference and low confidence', async () => {
      // Mock user with no preference
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const result = await detector.detectLanguage(
        'abc xyz 123',
        'user#123'
      );

      expect(result.languageCode).toBe('hi');
      expect(result.source).toBe('default');
    });

    it('should update language history on successful detection', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      await detector.detectLanguage(
        'This is a test message.',
        'user#123'
      );

      // Verify UpdateCommand was called
      const updateCalls = mockSend.mock.calls.filter(
        call => call[0] instanceof UpdateCommand
      );
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    it('should update preferred language after 3 consecutive detections', async () => {
      // Mock user with existing history of 2 English detections
      mockSend.mockResolvedValueOnce({
        Item: {
          userId: 'user#123',
          languageDetectionHistory: [
            { languageCode: 'en', timestamp: Date.now() - 2000 },
            { languageCode: 'en', timestamp: Date.now() - 1000 },
          ],
        },
      });
      mockSend.mockResolvedValueOnce({});

      await detector.detectLanguage(
        'This is the third English message.',
        'user#123'
      );

      // Verify UpdateCommand includes preferredLanguage
      const updateCall = mockSend.mock.calls.find(
        call => call[0] instanceof UpdateCommand
      );
      expect(updateCall).toBeDefined();
      const updateCommand = updateCall![0] as UpdateCommand;
      expect(updateCommand.input.UpdateExpression).toContain('preferredLanguage');
      expect(updateCommand.input.ExpressionAttributeValues?.[':lang']).toBe('en');
    });

    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));
      mockSend.mockResolvedValueOnce({});

      // Should not throw, should default to Hindi
      const result = await detector.detectLanguage(
        'abc xyz 123',
        'user#123'
      );

      expect(result.languageCode).toBe('hi');
      expect(result.source).toBe('default');
    });

    it('should complete detection within 200ms', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const startTime = Date.now();
      await detector.detectLanguage(
        'This is a test message for performance.',
        'user#123'
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should support all 10 Indian languages', async () => {
      const languages = [
        { code: 'hi', text: 'यह एक परीक्षण है' },
        { code: 'en', text: 'This is a test' },
        { code: 'ta', text: 'இது ஒரு சோதனை' },
        { code: 'te', text: 'ఇది ఒక పరీక్ష' },
        { code: 'bn', text: 'এটি একটি পরীক্ষা' },
        { code: 'mr', text: 'हे एक चाचणी आहे' },
        { code: 'gu', text: 'આ એક પરીક્ષણ છે' },
        { code: 'kn', text: 'ಇದು ಒಂದು ಪರೀಕ್ಷೆ' },
        { code: 'ml', text: 'ഇത് ഒരു പരീക്ഷണം' },
        { code: 'pa', text: 'ਇਹ ਇੱਕ ਟੈਸਟ ਹੈ' },
      ];

      for (const lang of languages) {
        mockSend.mockResolvedValueOnce({ Item: undefined });
        mockSend.mockResolvedValueOnce({ Item: undefined });
        mockSend.mockResolvedValueOnce({});

        const result = await detector.detectLanguage(lang.text, 'user#123');
        expect(result.languageCode).toBe(lang.code);
      }
    });

    it('should store detected language in request context', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({ Item: undefined });
      mockSend.mockResolvedValueOnce({});

      const result = await detector.detectLanguage(
        'This is a test message.',
        'user#123'
      );

      // Verify the result contains all required context information
      expect(result).toHaveProperty('languageCode');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('source');
    });
  });
});
