# Voice Processor Module

This module implements speech-to-text functionality for the Maitri AI Voice Assistant using Amazon Transcribe.

## Features

- **Speech-to-Text Conversion**: Converts audio files to text using Amazon Transcribe
- **Multi-Language Support**: Supports 10 Indian languages (Hindi, English, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi)
- **Retry Logic**: Implements exponential backoff retry (2 attempts) for failed transcriptions
- **Audio Format Support**: Handles OGG, MP3, AAC, WAV, FLAC formats
- **Metadata Tracking**: Includes timestamp and confidence scores in results

## Requirements Validated

- **Requirement 2.1**: Invokes Amazon Transcribe when voice note is stored in S3
- **Requirement 2.2**: Supports all 10 Indian languages
- **Requirement 2.3**: Retries up to 2 times with exponential backoff
- **Requirement 2.6**: Produces transcription with timestamp metadata

## Architecture

### Components

1. **TranscriptionService** (`transcription-service.ts`)
   - Core service for Amazon Transcribe integration
   - Handles job creation, polling, and result extraction
   - Implements retry logic with exponential backoff

2. **Lambda Handler** (`index.ts`)
   - Entry point for Lambda function
   - Validates requests and environment
   - Orchestrates transcription workflow

### Language Code Mapping

The service maps ISO 639-1 language codes to Amazon Transcribe language codes:

| Language | Code | Transcribe Code |
|----------|------|-----------------|
| Hindi | hi | hi-IN |
| English | en | en-IN |
| Tamil | ta | ta-IN |
| Telugu | te | te-IN |
| Bengali | bn | bn-IN |
| Marathi | mr | mr-IN |
| Gujarati | gu | gu-IN |
| Kannada | kn | kn-IN |
| Malayalam | ml | ml-IN |
| Punjabi | pa | pa-IN |

## Usage

### Lambda Event Format

```typescript
{
  "action": "transcribe",
  "audioUrl": "s3://bucket/input/audio.ogg",
  "languageCode": "hi",
  "userId": "user#1234567890"
}
```

### Lambda Response Format

**Success Response:**
```typescript
{
  "statusCode": 200,
  "body": {
    "success": true,
    "result": {
      "text": "Transcribed text content",
      "confidence": 0.95,
      "languageCode": "hi",
      "timestamp": 1704067200000
    }
  }
}
```

**Error Response:**
```typescript
{
  "statusCode": 400,
  "body": {
    "success": false,
    "error": "Error message"
  }
}
```

## Environment Variables

- `AWS_REGION`: AWS region for Transcribe and S3 (default: us-east-1)
- `S3_VOICE_BUCKET`: S3 bucket name for audio files (required)

## Retry Configuration

Default retry configuration:
- **Max Attempts**: 2
- **Initial Delay**: 1000ms
- **Backoff Multiplier**: 2

Retry delays:
- Attempt 1: 1000ms
- Attempt 2: 2000ms

## Error Handling

The service handles the following error scenarios:

1. **Unsupported Language**: Returns 400 error
2. **Invalid S3 URL**: Returns 500 error
3. **Transcription Job Failed**: Retries with exponential backoff
4. **Retry Exhaustion**: Returns 503 error
5. **Timeout**: Returns 500 error after max polling attempts

## Testing

### Unit Tests

Run unit tests:
```bash
npm test src/voice-processor
```

### Property-Based Tests

Property-based tests are located in `src/types/voice-processor.test.ts` and validate:
- Property 4: Transcription Invocation
- Property 5: Language Support Parity
- Property 6: Transcription Retry Behavior
- Property 7: Transcription Metadata Completeness

Run property tests:
```bash
npm run test:property
```

## Implementation Details

### Transcription Workflow

1. **Validate Input**: Check language code and S3 URL format
2. **Extract S3 Key**: Parse S3 URL to get bucket and key
3. **Start Job**: Create transcription job with retry logic
4. **Poll for Completion**: Check job status every 2 seconds (max 60 attempts)
5. **Download Results**: Fetch transcript JSON from S3
6. **Parse Results**: Extract text and calculate confidence
7. **Return Result**: Include timestamp metadata

### Polling Strategy

- **Poll Interval**: 2 seconds
- **Max Attempts**: 60 (2 minutes total)
- **Job Statuses**:
  - `IN_PROGRESS`: Continue polling
  - `COMPLETED`: Extract results
  - `FAILED`: Throw error with failure reason

### Confidence Calculation

The service calculates average confidence across all transcribed items:

```typescript
confidence = sum(item_confidences) / count(items)
```

## AWS Permissions Required

The Lambda execution role needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::voice-bucket/*"
    }
  ]
}
```

## Future Enhancements

- Text-to-speech functionality (Amazon Polly integration)
- Audio file cleanup (24-hour lifecycle)
- Custom vocabulary support for domain-specific terms
- Real-time streaming transcription
- Speaker identification for multi-speaker audio
