/**
 * FAQ Engine Service for Maitri AI
 * 
 * Implements keyword-based FAQ search for offline mode fallback.
 * Supports all 10 Indian languages with stop word removal.
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export type LanguageCode = 'hi' | 'en' | 'ta' | 'te' | 'bn' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa';

export interface FAQEngineConfig {
  faqTableName: string;
  keywordMatchThreshold: number;
}

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  languageCode: string;
  category: string;
  keywords: string[];
}

export interface FAQSearchResult {
  match: FAQEntry | null;
  score: number;
  searchTime: number;
}

/**
 * Stop words for each supported language
 */
const STOP_WORDS: Record<LanguageCode, string[]> = {
  hi: ['है', 'हैं', 'था', 'थे', 'की', 'का', 'के', 'में', 'से', 'को', 'और', 'या', 'यह', 'वह', 'इस', 'उस'],
  en: ['the', 'is', 'are', 'was', 'were', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that'],
  ta: ['இது', 'அது', 'ஒரு', 'மற்றும்', 'அல்லது', 'என்று', 'இல்', 'உள்ள'],
  te: ['ఇది', 'అది', 'ఒక', 'మరియు', 'లేదా', 'అని', 'లో', 'ఉన్న'],
  bn: ['এই', 'সেই', 'একটি', 'এবং', 'বা', 'যে', 'মধ্যে', 'আছে'],
  mr: ['हे', 'ते', 'एक', 'आणि', 'किंवा', 'की', 'मध्ये', 'आहे'],
  gu: ['આ', 'તે', 'એક', 'અને', 'અથવા', 'કે', 'માં', 'છે'],
  kn: ['ಇದು', 'ಅದು', 'ಒಂದು', 'ಮತ್ತು', 'ಅಥವಾ', 'ಎಂದು', 'ನಲ್ಲಿ', 'ಇದೆ'],
  ml: ['ഇത്', 'അത്', 'ഒരു', 'ഒപ്പം', 'അല്ലെങ്കിൽ', 'എന്ന്', 'ൽ', 'ഉണ്ട്'],
  pa: ['ਇਹ', 'ਉਹ', 'ਇੱਕ', 'ਅਤੇ', 'ਜਾਂ', 'ਕਿ', 'ਵਿੱਚ', 'ਹੈ'],
};

/**
 * Default responses for when no FAQ match is found
 */
const DEFAULT_RESPONSES: Record<LanguageCode, string> = {
  hi: 'क्षमा करें, मुझे इस प्रश्न का उत्तर नहीं मिला। कृपया हमारी हेल्पलाइन 1800-XXX-XXXX पर संपर्क करें।',
  en: 'Sorry, I could not find an answer to your question. Please contact our helpline at 1800-XXX-XXXX.',
  ta: 'மன்னிக்கவும், உங்கள் கேள்விக்கு பதில் கிடைக்கவில்லை. தயவுசெய்து எங்கள் உதவி எண் 1800-XXX-XXXX ஐ தொடர்பு கொள்ளவும்.',
  te: 'క్షమించండి, మీ ప్రశ్నకు సమాధానం దొరకలేదు. దయచేసి మా హెల్ప్‌లైన్ 1800-XXX-XXXX కు సంప్రదించండి.',
  bn: 'দুঃখিত, আমি আপনার প্রশ্নের উত্তর খুঁজে পাইনি। অনুগ্রহ করে আমাদের হেল্পলাইন 1800-XXX-XXXX এ যোগাযোগ করুন।',
  mr: 'क्षमस्व, मला तुमच्या प्रश्नाचे उत्तर सापडले नाही. कृपया आमच्या हेल्पलाइन 1800-XXX-XXXX वर संपर्क साधा।',
  gu: 'માફ કરશો, મને તમારા પ્રશ્નનો જવાબ મળ્યો નથી. કૃપા કરીને અમારી હેલ્પલાઇન 1800-XXX-XXXX પર સંપર્ક કરો।',
  kn: 'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಉತ್ತರ ಸಿಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಮ್ಮ ಸಹಾಯವಾಣಿ 1800-XXX-XXXX ಗೆ ಸಂಪರ್ಕಿಸಿ।',
  ml: 'ക്ഷമിക്കണം, നിങ്ങളുടെ ചോദ്യത്തിന് ഉത്തരം കണ്ടെത്താനായില്ല. ദയവായി ഞങ്ങളുടെ ഹെൽപ്പ്‌ലൈൻ 1800-XXX-XXXX വിളിക്കുക.',
  pa: 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਤੁਹਾਡੇ ਸਵਾਲ ਦਾ ਜਵਾਬ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਸਾਡੀ ਹੈਲਪਲਾਈਨ 1800-XXX-XXXX ਤੇ ਸੰਪਰਕ ਕਰੋ।',
};

export class FAQEngine {
  constructor(
    private config: FAQEngineConfig,
    private docClient: DynamoDBDocumentClient
  ) {}

  /**
   * Search FAQs using keyword matching
   * 
   * Validates: Requirements 7.1, 7.2, 7.3, 7.5
   */
  async searchFAQs(query: string, languageCode: LanguageCode): Promise<FAQSearchResult> {
    const startTime = Date.now();

    // Tokenize and clean query
    const queryKeywords = this.extractKeywords(query, languageCode);

    // Fetch FAQs for the language
    const faqs = await this.fetchFAQs(languageCode);

    // Calculate keyword overlap for each FAQ
    let bestMatch: FAQEntry | null = null;
    let bestScore = 0;

    for (const faq of faqs) {
      const faqKeywords = this.extractKeywords(faq.question, languageCode);
      const score = this.calculateKeywordOverlap(queryKeywords, faqKeywords);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    // Return match only if score meets threshold (Requirement 7.3)
    const searchTime = Date.now() - startTime;

    if (bestScore >= this.config.keywordMatchThreshold) {
      return {
        match: bestMatch,
        score: bestScore,
        searchTime,
      };
    }

    return {
      match: null,
      score: bestScore,
      searchTime,
    };
  }

  /**
   * Get default response when no match is found
   * 
   * Validates: Requirement 7.4
   */
  getDefaultResponse(languageCode: LanguageCode): string {
    return DEFAULT_RESPONSES[languageCode] || DEFAULT_RESPONSES.en;
  }

  /**
   * Fetch FAQs from DynamoDB for a specific language
   */
  private async fetchFAQs(languageCode: LanguageCode): Promise<FAQEntry[]> {
    const command = new ScanCommand({
      TableName: this.config.faqTableName,
      FilterExpression: 'languageCode = :lang',
      ExpressionAttributeValues: {
        ':lang': languageCode,
      },
    });

    const response = await this.docClient.send(command);
    return (response.Items || []) as FAQEntry[];
  }

  /**
   * Extract keywords from text by removing stop words
   * 
   * Validates: Requirement 7.2
   */
  private extractKeywords(text: string, languageCode: LanguageCode): string[] {
    const stopWords = STOP_WORDS[languageCode] || [];
    
    // Tokenize text
    const tokens = text
      .toLowerCase()
      .split(/\s+/)
      .filter(token => token.length > 0);

    // Remove stop words
    const keywords = tokens.filter(token => !stopWords.includes(token));

    return keywords;
  }

  /**
   * Calculate keyword overlap percentage between query and FAQ
   * 
   * Validates: Requirement 7.2
   */
  private calculateKeywordOverlap(queryKeywords: string[], faqKeywords: string[]): number {
    if (queryKeywords.length === 0) return 0;

    const matchCount = queryKeywords.filter(keyword =>
      faqKeywords.includes(keyword)
    ).length;

    return matchCount / queryKeywords.length;
  }
}
