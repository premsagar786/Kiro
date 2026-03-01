/**
 * Language Detector Service for Maitri AI
 * 
 * Detects language from text using character sets and word patterns.
 * Manages user language preferences based on usage patterns.
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 11.3
 */

import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export type LanguageCode = 'hi' | 'en' | 'ta' | 'te' | 'bn' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa';

export interface LanguageResult {
  languageCode: LanguageCode;
  confidence: number;
  source: 'detected' | 'preference' | 'default';
}

export interface LanguageDetectorConfig {
  usersTableName: string;
  confidenceThreshold: number;
  consecutiveUsesForPreference: number;
}

interface LanguageDetection {
  languageCode: LanguageCode;
  timestamp: number;
}

interface UserRecord {
  userId: string;
  preferredLanguage?: LanguageCode;
  languageDetectionHistory?: LanguageDetection[];
}

/**
 * Unicode ranges for Indian language scripts
 */
const LANGUAGE_PATTERNS: Record<LanguageCode, { unicodeRange: RegExp; commonWords: string[] }> = {
  hi: {
    unicodeRange: /[\u0900-\u097F]/,
    commonWords: ['है', 'का', 'की', 'के', 'में', 'से', 'को', 'और', 'यह', 'वह'],
  },
  en: {
    unicodeRange: /[a-zA-Z]/,
    commonWords: ['the', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for'],
  },
  ta: {
    unicodeRange: /[\u0B80-\u0BFF]/,
    commonWords: ['இது', 'அது', 'என்ன', 'எப்படி', 'எங்கே', 'யார்', 'எப்போது'],
  },
  te: {
    unicodeRange: /[\u0C00-\u0C7F]/,
    commonWords: ['ఇది', 'అది', 'ఏమి', 'ఎలా', 'ఎక్కడ', 'ఎవరు', 'ఎప్పుడు'],
  },
  bn: {
    unicodeRange: /[\u0980-\u09FF]/,
    commonWords: ['এই', 'সেই', 'কি', 'কীভাবে', 'কোথায়', 'কে', 'কখন'],
  },
  mr: {
    unicodeRange: /[\u0900-\u097F]/,
    commonWords: ['हे', 'ते', 'काय', 'कसे', 'कुठे', 'कोण', 'केव्हा'],
  },
  gu: {
    unicodeRange: /[\u0A80-\u0AFF]/,
    commonWords: ['આ', 'તે', 'શું', 'કેવી', 'ક્યાં', 'કોણ', 'ક્યારે'],
  },
  kn: {
    unicodeRange: /[\u0C80-\u0CFF]/,
    commonWords: ['ಇದು', 'ಅದು', 'ಏನು', 'ಹೇಗೆ', 'ಎಲ್ಲಿ', 'ಯಾರು', 'ಯಾವಾಗ'],
  },
  ml: {
    unicodeRange: /[\u0D00-\u0D7F]/,
    commonWords: ['ഇത്', 'അത്', 'എന്ത്', 'എങ്ങനെ', 'എവിടെ', 'ആര്', 'എപ്പോൾ'],
  },
  pa: {
    unicodeRange: /[\u0A00-\u0A7F]/,
    commonWords: ['ਇਹ', 'ਉਹ', 'ਕੀ', 'ਕਿਵੇਂ', 'ਕਿੱਥੇ', 'ਕੌਣ', 'ਕਦੋਂ'],
  },
};

export class LanguageDetector {
  constructor(
    private config: LanguageDetectorConfig,
    private docClient: DynamoDBDocumentClient
  ) {}

  /**
   * Detect language from text with confidence scoring
   * 
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  async detectLanguage(text: string, userId: string): Promise<LanguageResult> {
    // Analyze text to detect language
    const detectionScores = this.analyzeText(text);
    
    // Find language with highest confidence
    const topLanguage = this.getTopLanguage(detectionScores);
    
    // If confidence is high enough, use detected language
    if (topLanguage.confidence >= this.config.confidenceThreshold) {
      // Update user's language history
      await this.updateLanguageHistory(userId, topLanguage.languageCode);
      
      return {
        languageCode: topLanguage.languageCode,
        confidence: topLanguage.confidence,
        source: 'detected',
      };
    }
    
    // Confidence is low, check user preference
    const userPreference = await this.getUserPreference(userId);
    
    if (userPreference) {
      return {
        languageCode: userPreference,
        confidence: topLanguage.confidence,
        source: 'preference',
      };
    }
    
    // No preference, default to Hindi
    return {
      languageCode: 'hi',
      confidence: topLanguage.confidence,
      source: 'default',
    };
  }

  /**
   * Analyze text and calculate confidence scores for each language
   */
  private analyzeText(text: string): Record<LanguageCode, number> {
    const scores: Record<LanguageCode, number> = {
      hi: 0, en: 0, ta: 0, te: 0, bn: 0, mr: 0, gu: 0, kn: 0, ml: 0, pa: 0,
    };

    const normalizedText = text.toLowerCase();
    const words = normalizedText.split(/\s+/);

    // Calculate scores based on character sets and word matching
    for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
      const languageCode = lang as LanguageCode;
      
      // Character set matching (70% weight)
      const charMatches = (text.match(pattern.unicodeRange) || []).length;
      const charScore = Math.min(charMatches / text.length, 1.0) * 0.7;
      
      // Common word matching (30% weight)
      const wordMatches = words.filter(word => 
        pattern.commonWords.some(commonWord => 
          word.includes(commonWord.toLowerCase())
        )
      ).length;
      const wordScore = Math.min(wordMatches / words.length, 1.0) * 0.3;
      
      scores[languageCode] = charScore + wordScore;
    }

    return scores;
  }

  /**
   * Get language with highest confidence score
   */
  private getTopLanguage(scores: Record<LanguageCode, number>): { languageCode: LanguageCode; confidence: number } {
    let topLanguage: LanguageCode = 'hi';
    let topScore = 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > topScore) {
        topScore = score;
        topLanguage = lang as LanguageCode;
      }
    }

    return { languageCode: topLanguage, confidence: topScore };
  }

  /**
   * Get user's preferred language from User_Store
   */
  private async getUserPreference(userId: string): Promise<LanguageCode | null> {
    try {
      const command = new GetCommand({
        TableName: this.config.usersTableName,
        Key: { userId },
      });

      const response = await this.docClient.send(command);
      const user = response.Item as UserRecord | undefined;

      return user?.preferredLanguage || null;
    } catch (error) {
      console.error('Error fetching user preference:', error);
      return null;
    }
  }

  /**
   * Update user's language detection history
   * Update preferred language after 3 consecutive uses
   * 
   * Validates: Requirement 11.3
   */
  private async updateLanguageHistory(userId: string, languageCode: LanguageCode): Promise<void> {
    try {
      // Get current user record
      const getCommand = new GetCommand({
        TableName: this.config.usersTableName,
        Key: { userId },
      });

      const response = await this.docClient.send(getCommand);
      const user = response.Item as UserRecord | undefined;

      const history = user?.languageDetectionHistory || [];
      
      // Add new detection to history
      const newDetection: LanguageDetection = {
        languageCode,
        timestamp: Date.now(),
      };
      
      const updatedHistory = [...history, newDetection].slice(-10); // Keep last 10

      // Check if last 3 detections are the same language
      const lastThree = updatedHistory.slice(-this.config.consecutiveUsesForPreference);
      const allSameLanguage = lastThree.length === this.config.consecutiveUsesForPreference &&
        lastThree.every(d => d.languageCode === languageCode);

      // Update user record
      const updateCommand = new UpdateCommand({
        TableName: this.config.usersTableName,
        Key: { userId },
        UpdateExpression: allSameLanguage
          ? 'SET languageDetectionHistory = :history, preferredLanguage = :lang, lastInteractionAt = :timestamp'
          : 'SET languageDetectionHistory = :history, lastInteractionAt = :timestamp',
        ExpressionAttributeValues: allSameLanguage
          ? {
              ':history': updatedHistory,
              ':lang': languageCode,
              ':timestamp': Date.now(),
            }
          : {
              ':history': updatedHistory,
              ':timestamp': Date.now(),
            },
      });

      await this.docClient.send(updateCommand);
    } catch (error) {
      console.error('Error updating language history:', error);
      // Don't throw - this is not critical
    }
  }
}
