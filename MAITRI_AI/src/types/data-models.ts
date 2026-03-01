/**
 * Data Models for Maitri AI Voice Assistant
 * 
 * These interfaces define the structure of data stored in DynamoDB tables
 * and used throughout the system.
 */

/**
 * Language detection history entry
 */
export interface LanguageDetection {
  languageCode: string;
  timestamp: number;
}

/**
 * User profile record stored in DynamoDB Users table
 * 
 * Validates: Requirements 11.2
 * - userId: Unique identifier (partition key)
 * - phoneNumber: Encrypted phone number
 * - preferredLanguage: ISO 639-1 language code
 * - createdAt: Unix timestamp of profile creation
 */
export interface UserRecord {
  // Partition key
  userId: string;              // Format: "user#{phoneNumber}"
  
  // Required attributes (per Requirement 11.2)
  phoneNumber: string;         // Encrypted with KMS
  preferredLanguage: string;   // ISO 639-1 code
  createdAt: number;           // Unix timestamp
  
  // Additional attributes
  lastInteractionAt: number;   // Unix timestamp
  languageDetectionHistory: LanguageDetection[];
  voiceEnabled: boolean;       // User preference for voice responses
  textOnlyMode: boolean;       // Low-bandwidth mode flag
  
  // Metadata
  version: number;
  updatedAt: number;
}
/**
 * FAQ record stored in DynamoDB FAQ table
 * 
 * Validates: Requirements 5.2, 7.2
 * - faqId: Unique identifier (partition key)
 * - languageCode: ISO 639-1 code (sort key)
 * - question: FAQ question text
 * - answer: FAQ answer text
 * - embedding: 1536-dimensional vector for semantic search
 */
export interface FAQRecord {
  // Partition key
  faqId: string;               // Format: "faq#{category}#{id}"
  
  // Sort key
  languageCode: string;        // ISO 639-1 code
  
  // Attributes
  question: string;
  answer: string;
  category: string;            // e.g., "agriculture", "health", "education"
  keywords: string[];          // For keyword matching
  embedding: number[];         // 1536-dimensional vector from Titan
  source: string;              // e.g., "government_api", "manual"
  lastUpdated: number;         // Unix timestamp
  accessCount: number;         // For caching priority
  
  // Metadata
  version: number;
  createdAt: number;
}

/**
 * Reminder record stored in DynamoDB Reminders table
 * 
 * Validates: Requirements 10.2, 10.3
 * - reminderId: Unique identifier (partition key)
 * - userId: Reference to Users table
 * - scheduledTime: Unix timestamp for reminder delivery
 * - status: Current reminder status
 */
export interface ReminderRecord {
  // Partition key
  reminderId: string;          // Format: "reminder#{uuid}"
  
  // Attributes
  userId: string;              // Reference to Users table
  phoneNumber: string;         // Encrypted with KMS
  reminderText: string;
  scheduledTime: number;       // Unix timestamp
  createdAt: number;           // Unix timestamp
  status: 'pending' | 'delivered' | 'cancelled' | 'failed';
  languageCode: string;
  eventBridgeRuleName: string; // ARN of EventBridge rule
  deliveryAttempts: number;
  lastAttemptAt?: number;
  
  // TTL for automatic cleanup
  ttl: number;                 // scheduledTime + 7 days
}

/**
 * WhatsApp incoming message structure
 * 
 * Validates: Requirements 1.1, 1.2
 * - Represents the webhook payload from WhatsApp Business API
 */
export interface WhatsAppIncomingMessage {
  object: 'whatsapp_business_account';
  entry: [{
    id: string;
    changes: [{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: [{
          profile: {
            name: string;
          };
          wa_id: string;
        }];
        messages: [{
          from: string;
          id: string;
          timestamp: string;
          type: 'text' | 'audio';
          text?: {
            body: string;
          };
          audio?: {
            mime_type: string;
            sha256: string;
            id: string;
          };
        }];
      };
      field: 'messages';
    }];
  }];
}

/**
 * WhatsApp outgoing message structure
 * 
 * Validates: Requirements 9.1, 9.2
 * - Represents the message payload sent to WhatsApp Business API
 */
export interface WhatsAppOutgoingMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'audio';
  text?: {
    preview_url: boolean;
    body: string;
  };
  audio?: {
    link: string;
  };
}

/**
 * Processing context for internal request tracking
 * 
 * Validates: Requirements 3.6, 16.1
 * - Tracks the complete lifecycle of a request
 * - Used for logging, metrics, and debugging
 */
export interface ProcessingContext {
  requestId: string;
  userId: string;
  phoneNumber: string;
  timestamp: number;
  
  // Input
  inputType: 'text' | 'voice';
  inputText: string;
  audioUrl?: string;
  
  // Language
  detectedLanguage: string;
  languageConfidence: number;
  
  // Processing
  mode: 'online' | 'offline';
  isReminderRequest: boolean;
  
  // Response
  responseText: string;
  responseAudioUrl?: string;
  
  // Metrics
  processingStartTime: number;
  processingEndTime: number;
  componentTimings: Record<string, number>;
}

/**
 * System configuration interface
 * 
 * Validates: Requirements 17.1
 * - Defines all system-wide configuration settings
 * - Used for deployment and runtime configuration
 */
export interface SystemConfiguration {
  // AWS Resources
  aws: {
    region: string;
    accountId: string;
    s3Bucket: string;
    dynamodbTables: {
      users: string;
      faq: string;
      reminders: string;
    };
    kmsKeyId: string;
    secretsManagerSecrets: {
      whatsappApiKey: string;
      governmentApiKeys: Record<string, string>;
    };
  };
  
  // Service Configuration
  services: {
    transcribe: {
      supportedLanguages: string[];
      maxRetries: number;
      retryBackoff: number;
    };
    polly: {
      voiceMapping: Record<string, string>;
      outputFormat: string;
      bitrate: number;
    };
    bedrock: {
      haikuModelId: string;
      sonnetModelId: string;
      maxTokens: number;
      temperature: number;
    };
    rag: {
      embeddingDimension: number;
      similarityThreshold: number;
      maxResults: number;
      cacheTTL: number;
    };
  };
  
  // Timeouts and Limits
  limits: {
    maxAudioFileSize: number;
    maxMessageLength: number;
    requestsPerMinutePerUser: number;
    onlineModeTimeout: number;
    offlineModeTimeout: number;
    governmentApiTimeout: number;
  };
  
  // Feature Flags
  features: {
    voiceResponsesEnabled: boolean;
    governmentApiEnabled: boolean;
    reminderServiceEnabled: boolean;
    lowBandwidthOptimization: boolean;
  };
}

/**
 * Audio content structure for WhatsApp messages
 */
export interface AudioContent {
  mimeType: string;
  url: string;
  size: number;
}

/**
 * Send result for WhatsApp message delivery
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Transcription result from Voice Processor
 * 
 * Validates: Requirements 2.1, 2.6
 */
export interface TranscriptionResult {
  text: string;
  confidence: number;
  languageCode: string;
  timestamp: number;
}

/**
 * Audio result from Voice Processor
 * 
 * Validates: Requirements 8.3, 8.4
 */
export interface AudioResult {
  audioUrl: string;
  duration: number;
  format: string;
  expiresAt: number;
}

/**
 * Language detection result
 * 
 * Validates: Requirements 3.1, 3.2, 3.3
 */
export interface LanguageResult {
  languageCode: string;  // ISO 639-1 code
  confidence: number;    // 0.0 to 1.0
  source: 'detected' | 'preference' | 'default';
}

/**
 * AI Engine request
 * 
 * Validates: Requirements 4.1, 4.3
 */
export interface AIRequest {
  userInput: string;
  languageCode: string;
  userId: string;
  conversationHistory?: Message[];
}

/**
 * AI Engine response
 * 
 * Validates: Requirements 4.4, 4.5
 */
export interface AIResponse {
  text: string;
  mode: 'online' | 'offline';
  confidence: number;
  sources?: string[];
  processingTime: number;
}

/**
 * Message in conversation history
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * Context result from RAG System
 * 
 * Validates: Requirements 5.3, 5.4
 */
export interface ContextResult {
  entries: FAQEntry[];
  relevanceScores: number[];
  retrievalTime: number;
}

/**
 * FAQ entry for RAG System
 * 
 * Validates: Requirements 5.2
 */
export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  languageCode: string;
  category: string;
  embedding: number[];
  metadata: Record<string, any>;
}

/**
 * FAQ search result from FAQ Engine
 * 
 * Validates: Requirements 7.3, 7.4
 */
export interface FAQSearchResult {
  match: FAQEntry | null;
  score: number;
  searchTime: number;
}

/**
 * Reminder request
 * 
 * Validates: Requirements 10.1
 */
export interface ReminderRequest {
  userId: string;
  phoneNumber: string;
  reminderText: string;
  scheduledTime: number;  // Unix timestamp
  languageCode: string;
}

/**
 * Reminder result
 * 
 * Validates: Requirements 10.2, 10.3
 */
export interface ReminderResult {
  reminderId: string;
  scheduledTime: number;
  success: boolean;
  error?: string;
}

/**
 * Reminder object
 * 
 * Validates: Requirements 10.4
 */
export interface Reminder {
  reminderId: string;
  userId: string;
  phoneNumber: string;
  reminderText: string;
  scheduledTime: number;
  createdAt: number;
  status: 'pending' | 'delivered' | 'cancelled';
  languageCode: string;
}

/**
 * Incoming request from WhatsApp or PWA
 */
export interface IncomingRequest {
  requestId: string;
  userId: string;
  phoneNumber: string;
  type: 'text' | 'voice';
  content: string | AudioContent;
  timestamp: number;
}

/**
 * Webhook request structure
 */
export interface WebhookRequest {
  from: string;           // Phone number
  messageId: string;
  timestamp: number;
  type: 'text' | 'audio';
  content: string | AudioContent;
}
