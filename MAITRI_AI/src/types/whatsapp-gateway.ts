/**
 * WhatsApp Gateway Data Models
 * 
 * These interfaces define the structure of WhatsApp webhook requests,
 * responses, and internal processing data.
 */

/**
 * Audio content from WhatsApp message
 */
export interface AudioContent {
  mimeType: string;
  url: string;
  size: number;
}

/**
 * Webhook request from WhatsApp Business API
 */
export interface WebhookRequest {
  from: string;           // Phone number
  messageId: string;
  timestamp: number;
  type: 'text' | 'audio';
  content: string | AudioContent;
}

/**
 * Result of sending a message via WhatsApp
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * S3 storage result for voice notes
 */
export interface S3StorageResult {
  bucket: string;
  key: string;
  url: string;
  size: number;
  format: string;
}

/**
 * WhatsApp Gateway interface
 */
export interface WhatsAppGateway {
  // Webhook handler for incoming messages
  handleIncomingMessage(request: WebhookRequest): Promise<void>;
  
  // Send text message
  sendTextMessage(phoneNumber: string, text: string): Promise<SendResult>;
  
  // Send audio message
  sendAudioMessage(phoneNumber: string, audioUrl: string): Promise<SendResult>;
  
  // Verify webhook signature
  verifySignature(payload: string, signature: string): boolean;
  
  // Store audio file in S3
  storeAudioInS3(audio: AudioContent, userId: string, messageId: string): Promise<S3StorageResult>;
}

/**
 * Supported audio formats
 */
export const SUPPORTED_AUDIO_FORMATS = ['ogg', 'mp3', 'aac'] as const;
export type AudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

/**
 * Maximum audio file size (16MB)
 */
export const MAX_AUDIO_SIZE = 16 * 1024 * 1024; // 16MB in bytes
