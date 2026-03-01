/**
 * Transcription Service for Maitri AI Voice Assistant
 * 
 * Implements Amazon Transcribe integration for speech-to-text conversion
 * with retry logic and support for 10 Indian languages.
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.6
 */

import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  TranscriptionJob,
  LanguageCode as TranscribeLanguageCode,
} from '@aws-sdk/client-transcribe';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  TranscriptionResult,
  LanguageCode,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from '../types/voice-processor';

/**
 * Maps our language codes to Amazon Transcribe language codes
 */
const LANGUAGE_CODE_MAP: Record<LanguageCode, TranscribeLanguageCode> = {
  'hi': 'hi-IN' as TranscribeLanguageCode, // Hindi
  'en': 'en-IN' as TranscribeLanguageCode, // English (India)
  'ta': 'ta-IN' as TranscribeLanguageCode, // Tamil
  'te': 'te-IN' as TranscribeLanguageCode, // Telugu
  'bn': 'bn-IN' as TranscribeLanguageCode, // Bengali
  'mr': 'mr-IN' as TranscribeLanguageCode, // Marathi
  'gu': 'gu-IN' as TranscribeLanguageCode, // Gujarati
  'kn': 'kn-IN' as TranscribeLanguageCode, // Kannada
  'ml': 'ml-IN' as TranscribeLanguageCode, // Malayalam
  'pa': 'pa-IN' as TranscribeLanguageCode, // Punjabi
};

/**
 * Configuration for the transcription service
 */
export interface TranscriptionServiceConfig {
  region: string;
  s3Bucket: string;
  retryConfig?: RetryConfig;
}

/**
 * Service for handling speech-to-text transcription using Amazon Transcribe
 */
export class TranscriptionService {
  private transcribeClient: TranscribeClient;
  private s3Client: S3Client;
  private config: TranscriptionServiceConfig;
  private retryConfig: RetryConfig;

  constructor(config: TranscriptionServiceConfig) {
    this.config = config;
    this.retryConfig = config.retryConfig || DEFAULT_RETRY_CONFIG;
    
    this.transcribeClient = new TranscribeClient({ region: config.region });
    this.s3Client = new S3Client({ region: config.region });
  }

  /**
   * Transcribe audio from S3 URL to text
   * 
   * Validates: Requirements 2.1, 2.2, 2.3, 2.6
   * 
   * @param audioUrl - S3 URL of the audio file
   * @param languageCode - Language code for transcription
   * @param userId - User ID for tracking
   * @returns TranscriptionResult with text, confidence, language, and timestamp
   */
  async transcribeAudio(
    audioUrl: string,
    languageCode: LanguageCode,
    userId: string
  ): Promise<TranscriptionResult> {
    // Validate language code
    if (!LANGUAGE_CODE_MAP[languageCode]) {
      throw new Error(`Unsupported language code: ${languageCode}`);
    }

    // Extract S3 key from URL
    const s3Key = this.extractS3KeyFromUrl(audioUrl);
    
    // Start transcription with retry logic
    const transcriptionJob = await this.startTranscriptionWithRetry(
      s3Key,
      languageCode,
      userId
    );

    // Poll for completion
    const completedJob = await this.pollTranscriptionJob(transcriptionJob.TranscriptionJobName!);

    // Extract and return results
    return await this.extractTranscriptionResult(completedJob, languageCode);
  }

  /**
   * Start transcription job with exponential backoff retry
   * 
   * Validates: Requirement 2.3 (retry up to 2 times with exponential backoff)
   */
  private async startTranscriptionWithRetry(
    s3Key: string,
    languageCode: LanguageCode,
    userId: string
  ): Promise<TranscriptionJob> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.retryConfig.maxAttempts; attempt++) {
      try {
        return await this.startTranscriptionJob(s3Key, languageCode, userId);
      } catch (error) {
        lastError = error as Error;
        
        // If this is not the last attempt, wait before retrying
        if (attempt < this.retryConfig.maxAttempts - 1) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    throw new Error(
      `Transcription failed after ${this.retryConfig.maxAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Start a transcription job
   */
  private async startTranscriptionJob(
    s3Key: string,
    languageCode: LanguageCode,
    userId: string
  ): Promise<TranscriptionJob> {
    const jobName = this.generateJobName(userId);
    const transcribeLanguageCode = LANGUAGE_CODE_MAP[languageCode];

    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: transcribeLanguageCode,
      Media: {
        MediaFileUri: `s3://${this.config.s3Bucket}/${s3Key}`,
      },
      MediaFormat: this.detectMediaFormat(s3Key),
      OutputBucketName: this.config.s3Bucket,
    });

    const response = await this.transcribeClient.send(command);
    
    if (!response.TranscriptionJob) {
      throw new Error('Failed to start transcription job');
    }

    return response.TranscriptionJob;
  }

  /**
   * Poll for transcription job completion
   */
  private async pollTranscriptionJob(
    jobName: string,
    maxAttempts: number = 60,
    pollIntervalMs: number = 2000
  ): Promise<TranscriptionJob> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const command = new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName,
      });

      const response = await this.transcribeClient.send(command);
      const job = response.TranscriptionJob;

      if (!job) {
        throw new Error(`Transcription job not found: ${jobName}`);
      }

      const status = job.TranscriptionJobStatus;

      if (status === 'COMPLETED') {
        return job;
      } else if (status === 'FAILED') {
        throw new Error(
          `Transcription job failed: ${job.FailureReason || 'Unknown reason'}`
        );
      }

      // Job is still in progress, wait before polling again
      await this.sleep(pollIntervalMs);
    }

    throw new Error(`Transcription job timed out after ${maxAttempts} attempts`);
  }

  /**
   * Extract transcription result from completed job
   * 
   * Validates: Requirement 2.6 (timestamp metadata)
   */
  private async extractTranscriptionResult(
    job: TranscriptionJob,
    languageCode: LanguageCode
  ): Promise<TranscriptionResult> {
    if (!job.Transcript?.TranscriptFileUri) {
      throw new Error('Transcription result URI not found');
    }

    // Download transcription result from S3
    const transcriptData = await this.downloadTranscriptFile(
      job.Transcript.TranscriptFileUri
    );

    // Parse transcript JSON
    const transcript = JSON.parse(transcriptData);
    const results = transcript.results;

    if (!results || !results.transcripts || results.transcripts.length === 0) {
      throw new Error('No transcription results found');
    }

    // Extract text and confidence
    const text = results.transcripts[0].transcript;
    const confidence = this.calculateAverageConfidence(results);

    // Return result with timestamp metadata
    return {
      text,
      confidence,
      languageCode,
      timestamp: Date.now(), // Current timestamp when transcription completed
    };
  }

  /**
   * Download transcript file from S3
   */
  private async downloadTranscriptFile(uri: string): Promise<string> {
    // Extract bucket and key from URI
    const match = uri.match(/s3:\/\/([^\/]+)\/(.+)/);
    if (!match) {
      throw new Error(`Invalid S3 URI: ${uri}`);
    }

    const [, bucket, key] = match;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    // Convert stream to string
    return await response.Body.transformToString();
  }

  /**
   * Calculate average confidence score from transcription results
   */
  private calculateAverageConfidence(results: any): number {
    if (!results.items || results.items.length === 0) {
      return 0.0;
    }

    const confidenceScores = results.items
      .filter((item: any) => item.alternatives && item.alternatives[0])
      .map((item: any) => parseFloat(item.alternatives[0].confidence || '0'));

    if (confidenceScores.length === 0) {
      return 0.0;
    }

    const sum = confidenceScores.reduce((acc: number, score: number) => acc + score, 0);
    return sum / confidenceScores.length;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attemptNumber: number): number {
    return (
      this.retryConfig.initialDelayMs *
      Math.pow(this.retryConfig.backoffMultiplier, attemptNumber)
    );
  }

  /**
   * Extract S3 key from full S3 URL
   */
  private extractS3KeyFromUrl(url: string): string {
    // Handle both s3:// and https:// URLs
    if (url.startsWith('s3://')) {
      const parts = url.replace('s3://', '').split('/');
      return parts.slice(1).join('/');
    } else if (url.includes('.s3.') || url.includes('.s3-')) {
      // HTTPS URL format
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    }
    
    throw new Error(`Invalid S3 URL format: ${url}`);
  }

  /**
   * Detect media format from file extension
   */
  private detectMediaFormat(s3Key: string): string {
    const extension = s3Key.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'ogg':
        return 'ogg';
      case 'mp3':
        return 'mp3';
      case 'mp4':
        return 'mp4';
      case 'wav':
        return 'wav';
      case 'flac':
        return 'flac';
      case 'aac':
        return 'mp4'; // AAC is typically in MP4 container
      default:
        return 'mp3'; // Default fallback
    }
  }

  /**
   * Generate unique job name
   */
  private generateJobName(userId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `transcription-${userId}-${timestamp}-${random}`;
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
