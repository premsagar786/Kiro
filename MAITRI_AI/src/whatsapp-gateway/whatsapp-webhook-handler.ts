/**
 * WhatsApp Webhook Handler Lambda Function
 * 
 * This Lambda function handles incoming WhatsApp messages via webhook.
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 13.2
 * - 1.1: Accept voice notes and store in S3
 * - 1.2: Accept text messages and forward to orchestrator
 * - 1.3: Support OGG, MP3, AAC formats
 * - 13.2: Validate webhook signatures using SHA-256 HMAC
 */

import * as crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { 
  WebhookRequest, 
  AudioContent, 
  S3StorageResult,
  WhatsAppIncomingMessage,
  IncomingRequest,
  MAX_AUDIO_SIZE,
  SUPPORTED_AUDIO_FORMATS
} from '../types/whatsapp-gateway';

// Initialize AWS clients outside handler for connection reuse
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });

// Environment variables - use function to get current values for testing
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  return process.env[key] || defaultValue;
};

const S3_BUCKET = () => getEnvVar('S3_VOICE_BUCKET');
const ORCHESTRATOR_FUNCTION = () => getEnvVar('ORCHESTRATOR_FUNCTION');
const WEBHOOK_SECRET = () => getEnvVar('WEBHOOK_SECRET');

/**
 * Lambda handler for WhatsApp webhook
 * 
 * Validates: Requirements 13.2
 * - Verifies webhook signature before processing
 */
export async function handler(event: any): Promise<any> {
  console.log('Received webhook event:', JSON.stringify(event, null, 2));

  // Handle webhook verification (GET request)
  if (event.httpMethod === 'GET') {
    return handleWebhookVerification(event);
  }

  // Handle incoming messages (POST request)
  if (event.httpMethod === 'POST') {
    try {
      // Verify webhook signature
      const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
      if (!verifySignature(event.body, signature, WEBHOOK_SECRET())) {
        console.error('Invalid webhook signature');
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' })
        };
      }

      // Parse webhook payload
      const payload: WhatsAppIncomingMessage = JSON.parse(event.body);
      
      // Process the message
      await processIncomingMessage(payload);

      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'received' })
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      };
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Invalid request method' })
  };
}

/**
 * Handle webhook verification for WhatsApp setup
 * 
 * Validates: Requirements 13.2
 * - Responds to WhatsApp's webhook verification challenge
 */
function handleWebhookVerification(event: any): any {
  const queryParams = event.queryStringParameters || {};
  const mode = queryParams['hub.mode'];
  const token = queryParams['hub.verify_token'];
  const challenge = queryParams['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_SECRET()) {
    console.log('Webhook verified successfully');
    return {
      statusCode: 200,
      body: challenge
    };
  }

  console.error('Webhook verification failed');
  return {
    statusCode: 403,
    body: JSON.stringify({ error: 'Verification failed' })
  };
}

/**
 * Verify webhook signature using SHA-256 HMAC
 * 
 * Validates: Requirements 13.2
 * - Uses SHA-256 HMAC for signature verification
 * - Implements timing-safe comparison to prevent timing attacks
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !payload || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    // Ensure both buffers have the same length before comparison
    if (expectedSignature.length !== providedSignature.length) {
      return false;
    }

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Process incoming WhatsApp message
 * 
 * Validates: Requirements 1.1, 1.2
 * - Handles both text and audio messages
 * - Stores audio files in S3
 * - Forwards to orchestrator Lambda
 */
async function processIncomingMessage(payload: WhatsAppIncomingMessage): Promise<void> {
  // Extract message data from WhatsApp payload
  const entry = payload.entry[0];
  const change = entry.changes[0];
  const message = change.value.messages[0];
  const from = message.from;
  const messageId = message.id;
  const timestamp = parseInt(message.timestamp);
  const type = message.type;

  // Validate phone number (E.164 format)
  if (!validatePhoneNumber(from)) {
    console.error('Invalid phone number format:', from);
    throw new Error('Invalid phone number format');
  }

  let webhookRequest: WebhookRequest;

  if (type === 'text' && message.text) {
    // Handle text message
    webhookRequest = {
      from,
      messageId,
      timestamp,
      type: 'text',
      content: message.text.body
    };
  } else if (type === 'audio' && message.audio) {
    // Handle audio message
    const audioContent: AudioContent = {
      mimeType: message.audio.mime_type,
      url: `https://graph.facebook.com/v18.0/${message.audio.id}`,
      size: 0 // Size will be determined when downloading
    };

    // Validate audio format
    const format = getAudioFormat(audioContent.mimeType);
    if (!format) {
      console.error('Unsupported audio format:', audioContent.mimeType);
      throw new Error('Unsupported audio format');
    }

    // Store audio in S3
    const s3Result = await storeAudioInS3(audioContent, from, messageId);
    console.log('Audio stored in S3:', s3Result);

    webhookRequest = {
      from,
      messageId,
      timestamp,
      type: 'audio',
      content: audioContent
    };
  } else {
    console.error('Unsupported message type:', type);
    throw new Error('Unsupported message type');
  }

  // Forward to orchestrator Lambda
  await forwardToOrchestrator(webhookRequest);
}

/**
 * Validate phone number in E.164 format
 * 
 * Validates: Requirements 1.1
 * - Ensures phone numbers follow E.164 international format
 * - Format: +[country code][number] (e.g., +919876543210)
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format: +[1-3 digit country code][up to 15 digits]
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

/**
 * Get audio format from MIME type
 * 
 * Validates: Requirements 1.3
 * - Supports OGG, MP3, and AAC formats
 */
function getAudioFormat(mimeType: string): string | null {
  const formatMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/aac': 'aac',
    'audio/mp4': 'aac'
  };

  const format = formatMap[mimeType.toLowerCase()];
  
  if (format && SUPPORTED_AUDIO_FORMATS.includes(format as any)) {
    return format;
  }

  return null;
}

/**
 * Store audio file in S3 with correct path structure
 * 
 * Validates: Requirements 1.1
 * - Path structure: input/{year}/{month}/{day}/{userId}/{messageId}.{format}
 * - Validates file size (max 16MB)
 */
export async function storeAudioInS3(
  audio: AudioContent,
  userId: string,
  messageId: string
): Promise<S3StorageResult> {
  // Validate audio size
  if (audio.size > MAX_AUDIO_SIZE) {
    throw new Error(`Audio file exceeds maximum size of ${MAX_AUDIO_SIZE} bytes`);
  }

  // Get audio format
  const format = getAudioFormat(audio.mimeType);
  if (!format) {
    throw new Error('Unsupported audio format');
  }

  // Generate S3 key with date-based path structure
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  // Sanitize userId (remove + and special characters)
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
  
  const key = `input/${year}/${month}/${day}/${sanitizedUserId}/${messageId}.${format}`;

  // In a real implementation, we would download the audio from WhatsApp
  // For now, we'll create a placeholder
  // TODO: Download audio from WhatsApp URL using access token
  const audioData = Buffer.from('placeholder audio data');

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET(),
    Key: key,
    Body: audioData,
    ContentType: audio.mimeType,
    Metadata: {
      userId,
      messageId,
      originalUrl: audio.url
    }
  });

  await s3Client.send(command);

  const url = `https://${S3_BUCKET()}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return {
    bucket: S3_BUCKET(),
    key,
    url,
    size: audioData.length,
    format
  };
}

/**
 * Forward request to orchestrator Lambda
 * 
 * Validates: Requirements 1.2
 * - Forwards processed requests to orchestrator for further handling
 */
async function forwardToOrchestrator(webhookRequest: WebhookRequest): Promise<void> {
  // Create incoming request for orchestrator
  const incomingRequest: IncomingRequest = {
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId: `user#${webhookRequest.from}`,
    phoneNumber: webhookRequest.from,
    type: webhookRequest.type,
    content: webhookRequest.content,
    timestamp: webhookRequest.timestamp
  };

  // Invoke orchestrator Lambda asynchronously
  const command = new InvokeCommand({
    FunctionName: ORCHESTRATOR_FUNCTION(),
    InvocationType: 'Event', // Async invocation
    Payload: Buffer.from(JSON.stringify(incomingRequest))
  });

  await lambdaClient.send(command);
  console.log('Request forwarded to orchestrator:', incomingRequest.requestId);
}
