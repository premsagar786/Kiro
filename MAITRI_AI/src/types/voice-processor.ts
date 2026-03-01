/**
 * Voice Processor Types for Maitri AI Voice Assistant
 * 
 * These interfaces define the structure for speech-to-text and text-to-speech operations.
 */

/**
 * Supported languages for transcription and synthesis
 * ISO 639-1 language codes for 10 Indian languages
 */
export const SUPPORTED_LANGUAGES = [
  'hi', // Hindi
  'en', // English
  'ta', // Tamil
  'te', // Telugu
  'bn', // Bengali
  'mr', // Marathi
  'gu', // Gujarati
  'kn', // Kannada
  'ml', // Malayalam
  'pa', // Punjabi
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

/**
 * Transcription result from Amazon Transcribe
 * 
 * Validates: Requirements 2.1, 2.6
 * - text: The transcribed text from speech
 * - confidence: Confidence score (0.0 to 1.0)
 * - languageCode: Detected language
 * - timestamp: Unix timestamp when transcription was completed
 */
export interface TranscriptionResult {
  text: string;
  confidence: number;
  languageCode: string;
  timestamp: number;
}

/**
 * Audio result from Amazon Polly
 * 
 * Validates: Requirements 8.1, 8.3, 8.4
 * - audioUrl: S3 URL of the generated audio file
 * - duration: Duration of audio in seconds
 * - format: Audio format (ogg, mp3, etc.)
 * - expiresAt: Unix timestamp when the audio file expires
 */
export interface AudioResult {
  audioUrl: string;
  duration: number;
  format: string;
  expiresAt: number;
}

/**
 * Request to transcribe audio
 */
export interface TranscribeRequest {
  audioUrl: string;
  languageCode?: string;
  userId: string;
}

/**
 * Request to synthesize speech
 */
export interface SynthesizeRequest {
  text: string;
  languageCode: string;
  userId: string;
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration for transcription
 * Validates: Requirements 2.3 (2 retries with exponential backoff)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
};
