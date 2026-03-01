# Implementation Plan: Maitri AI Voice Assistant

## Overview

This implementation plan breaks down the Maitri AI voice assistant into discrete, testable tasks. The system is a production-ready multilingual voice and text AI assistant for India, accessible via WhatsApp and PWA, built on AWS serverless architecture. Implementation follows an incremental approach where each task builds on previous work, with property-based tests integrated throughout to validate correctness.

## Implementation Language

TypeScript (Node.js 20.x runtime for Lambda functions)

## Tasks

- [x] 1. Set up AWS infrastructure foundation with CDK
  - Initialize CDK project with TypeScript
  - Create KMS encryption key with automatic rotation
  - Set up S3 bucket for voice files with lifecycle policies (24h input, 48h output)
  - Configure bucket encryption, CORS, and access policies
  - Create DynamoDB tables: Users, FAQ, Reminders with encryption and GSIs
  - Set up Secrets Manager for WhatsApp and Government API credentials
  - Configure CloudWatch log groups with 30-day retention
  - _Requirements: 13.1, 13.3, 14.1, 14.2, 16.5_

- [ ] 2. Implement core data models and validation
  - [x] 2.1 Create TypeScript interfaces for all data models
    - Define UserRecord, FAQRecord, ReminderRecord interfaces
    - Define WhatsApp message request/response interfaces
    - Define ProcessingContext and internal service interfaces
    - Create SystemConfiguration interface
    - _Requirements: 11.2, 17.1_

  - [x] 2.2 Write property test for data model interfaces
    - **Property 42: User Profile Field Completeness**
    - **Validates: Requirements 11.2**

- [ ] 3. Implement WhatsApp Gateway webhook handler
  - [x] 3.1 Create Lambda function for WhatsApp webhook
    - Implement webhook signature verification using SHA-256 HMAC
    - Parse incoming WhatsApp messages (text and audio)
    - Validate phone numbers against E.164 format
    - Store audio files in S3 with correct path structure
    - Forward requests to orchestrator Lambda
    - _Requirements: 1.1, 1.2, 1.3, 13.2_

  - [x] 3.2 Write property tests for WhatsApp Gateway
    - **Property 1: Voice Note Storage**
    - **Validates: Requirements 1.1**
    - **Property 2: Text Message Forwarding**
    - **Validates: Requirements 1.2**
    - **Property 3: Audio Format Support**
    - **Validates: Requirements 1.3**

  - [x] 3.3 Implement webhook verification endpoint (GET /webhook)
    - Handle hub.mode, hub.verify_token, hub.challenge parameters
    - Echo back challenge string for WhatsApp setup
    - _Requirements: 13.2_


- [ ] 4. Implement Voice Processor Lambda
  - [x] 4.1 Create speech-to-text functionality
    - Implement Amazon Transcribe integration
    - Support all 10 Indian languages (hi, en, ta, te, bn, mr, gu, kn, ml, pa)
    - Implement retry logic with exponential backoff (2 attempts)
    - Download audio from S3 and start transcription jobs
    - Poll for transcription completion and extract text
    - Add timestamp metadata to transcription results
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 4.2 Write property tests for transcription
    - **Property 4: Transcription Invocation**
    - **Validates: Requirements 2.1**
    - **Property 5: Language Support Parity**
    - **Validates: Requirements 2.2, 3.4, 7.6**
    - **Property 6: Transcription Retry Behavior**
    - **Validates: Requirements 2.3**
    - **Property 7: Transcription Metadata Completeness**
    - **Validates: Requirements 2.6**

  - [x] 4.3 Create text-to-speech functionality
    - Implement Amazon Polly integration with neural voices
    - Map language codes to appropriate Polly voice IDs
    - Generate OGG Vorbis audio at 64 kbps for low bandwidth
    - Store generated audio in S3 with 48-hour expiration
    - Return audio URL and metadata
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 19.2_

  - [x] 4.4 Write property tests for text-to-speech
    - **Property 25: Text-to-Speech Invocation**
    - **Validates: Requirements 8.1**
    - **Property 26: Neural Voice Selection**
    - **Validates: Requirements 8.2**
    - **Property 27: Audio Format Consistency**
    - **Validates: Requirements 8.3**
    - **Property 28: Voice Preference Respect**
    - **Validates: Requirements 8.6**

  - [x] 4.4 Implement audio file cleanup
    - Create scheduled Lambda to delete expired voice files
    - Delete input files after 24 hours
    - Delete output files after 48 hours
    - _Requirements: 2.5, 14.4_

- [-] 5. Implement Language Detector Lambda
  - [ ] 5.1 Create language detection logic
    - Analyze text using character sets and word patterns
    - Calculate confidence scores for each language
    - Return detected language if confidence >= 85%
    - Fall back to user's preferred language from User_Store if confidence < 85%
    - Default to Hindi if no preference exists
    - Store detected language in request context
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ] 5.2 Write property tests for language detection
    - **Property 8: Language Detection Confidence**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - **Property 9: Language Context Storage**
    - **Validates: Requirements 3.6**

  - [ ] 5.3 Implement language preference tracking
    - Track language usage per user
    - Update preferred language after 3 consecutive uses of same language
    - Store preference in User_Store
    - _Requirements: 11.3_

  - [ ] 5.4 Write property test for language preference updates
    - **Property 43: Language Preference Update**
    - **Validates: Requirements 11.3**

- [ ] 6. Implement RAG System Lambda
  - [ ] 6.1 Create embedding generation service
    - Integrate with Amazon Titan Embeddings
    - Generate 1536-dimensional embedding vectors
    - Implement embedding cache using ElastiCache Redis (1-hour TTL)
    - Hash text for cache keys
    - _Requirements: 5.1, 5.6_

  - [ ] 6.2 Write property tests for embeddings
    - **Property 14: Embedding Generation**
    - **Validates: Requirements 5.1**
    - **Property 18: Embedding Cache Behavior**
    - **Validates: Requirements 5.6**

  - [ ] 6.3 Implement semantic search functionality
    - Query DynamoDB FAQ table with embedding vectors
    - Calculate cosine similarity scores
    - Filter results by similarity threshold (>= 0.7)
    - Return top 5 most relevant FAQ entries
    - Complete search within 500ms
    - _Requirements: 5.2, 5.3, 5.5_

  - [ ] 6.4 Write property tests for semantic search
    - **Property 15: Similarity Threshold Enforcement**
    - **Validates: Requirements 5.2**
    - **Property 16: Result Limit Enforcement**
    - **Validates: Requirements 5.3**
    - **Property 17: Context Passing to AI Engine**
    - **Validates: Requirements 5.4**


- [ ] 7. Implement FAQ Engine Lambda
  - [ ] 7.1 Create keyword-based search functionality
    - Tokenize user queries and FAQ questions
    - Remove stop words for each supported language
    - Calculate keyword overlap percentage
    - Return FAQ with highest overlap if >= 70%
    - Return default response if no match found
    - Complete search within 500ms
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 7.2 Write property tests for FAQ Engine
    - **Property 22: FAQ Engine Activation**
    - **Validates: Requirements 7.1**
    - **Property 23: Keyword Matching Algorithm**
    - **Validates: Requirements 7.2**
    - **Property 24: FAQ Match Threshold**
    - **Validates: Requirements 7.3**

  - [ ] 7.3 Create default response templates
    - Define default messages in all 10 languages
    - Include helpline contact information
    - _Requirements: 7.4_

- [ ] 8. Implement AI Engine Lambda with Bedrock integration
  - [ ] 8.1 Create Bedrock client and model invocation
    - Initialize Bedrock client with proper IAM permissions
    - Implement Claude 3 Haiku invocation for simple queries
    - Implement Claude 3 Sonnet invocation for complex reasoning
    - Add model selection logic based on query complexity
    - Set timeout to 2 seconds for response generation
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ] 8.2 Write property tests for AI Engine
    - **Property 10: Model Selection for Online Mode**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 11: RAG Context Retrieval**
    - **Validates: Requirements 4.3**
    - **Property 12: Response Language Consistency**
    - **Validates: Requirements 4.4**

  - [ ] 8.3 Integrate RAG System for context retrieval
    - Invoke RAG System Lambda before generating responses
    - Include retrieved context in Bedrock prompts
    - Format context appropriately for Claude models
    - _Requirements: 4.3, 5.4_

  - [ ] 8.4 Implement Government API integration
    - Create clients for government service APIs (PM-KISAN, Ayushman Bharat, etc.)
    - Retrieve credentials from Secrets Manager
    - Query APIs when scheme information is requested
    - Implement 2-second timeout with fallback to cached data
    - Refresh cached data every 24 hours
    - Log errors and continue with available data
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 8.5 Write property tests for Government API integration
    - **Property 19: Government API Invocation**
    - **Validates: Requirements 6.1**
    - **Property 20: Government API Timeout Fallback**
    - **Validates: Requirements 6.3**
    - **Property 21: Government API Error Handling**
    - **Validates: Requirements 6.6**

  - [ ] 8.6 Implement circuit breaker pattern
    - Track failure rate over 1-minute windows
    - Open circuit at 50% failure threshold
    - Transition to half-open state after 30 seconds
    - Test with 3 requests before closing circuit
    - Fall back to FAQ Engine when circuit is open
    - _Requirements: 4.6, 20.6_

  - [ ] 8.7 Write property test for circuit breaker
    - **Property 13: Offline Mode Fallback**
    - **Validates: Requirements 4.6, 20.2**

- [ ] 9. Implement Reminder Service Lambda
  - [ ] 9.1 Create reminder parsing logic
    - Parse natural language datetime expressions
    - Support relative times ("tomorrow", "in 2 days", "next Monday")
    - Support absolute dates ("15th August 2024")
    - Extract reminder text from user input
    - Validate scheduled time is within 1 year
    - _Requirements: 10.1, 10.5_

  - [ ] 9.2 Write property tests for reminder parsing
    - **Property 35: Reminder Parsing**
    - **Validates: Requirements 10.1**
    - **Property 39: Reminder Time Range Validation**
    - **Validates: Requirements 10.5**

  - [ ] 9.3 Implement reminder storage and scheduling
    - Store reminders in DynamoDB Reminders table
    - Create EventBridge rules for each reminder
    - Set TTL for automatic cleanup (scheduled time + 7 days)
    - Encrypt phone numbers with KMS
    - _Requirements: 10.2, 10.3_

  - [ ] 9.4 Write property tests for reminder storage
    - **Property 36: Reminder Storage**
    - **Validates: Requirements 10.2**
    - **Property 37: Reminder Scheduling**
    - **Validates: Requirements 10.3**

  - [ ] 9.5 Implement reminder delivery
    - Handle EventBridge trigger events
    - Retrieve reminder details from DynamoDB
    - Send reminder via WhatsApp Gateway
    - Update reminder status to 'delivered'
    - Track delivery attempts
    - _Requirements: 10.4_

  - [ ] 9.6 Write property test for reminder delivery
    - **Property 38: Reminder Delivery**
    - **Validates: Requirements 10.4**

  - [ ] 9.7 Implement reminder cancellation
    - Accept cancellation requests from users
    - Delete reminder from DynamoDB
    - Remove EventBridge rule
    - _Requirements: 10.6_

  - [ ] 9.8 Write property test for reminder cancellation
    - **Property 40: Reminder Cancellation**
    - **Validates: Requirements 10.6**


- [ ] 10. Implement Request Orchestrator Lambda
  - [ ] 10.1 Create main request processing workflow
    - Route incoming requests from WhatsApp Gateway
    - Coordinate multi-step processing pipeline
    - Handle voice message transcription flow
    - Handle text message flow
    - Detect reminder requests and route to Reminder Service
    - Implement timeout handling for each component
    - _Requirements: 1.5, 1.6_

  - [ ] 10.2 Implement online/offline mode switching
    - Try AI Engine first (online mode)
    - Detect AI Engine failures and switch to FAQ Engine (offline mode)
    - Track mode usage metrics
    - _Requirements: 4.6, 7.1, 20.2_

  - [ ] 10.3 Implement response aggregation and delivery
    - Aggregate text responses from AI Engine or FAQ Engine
    - Request TTS conversion if voice is enabled
    - Create Response_Package with text and audio
    - Send via WhatsApp Gateway with proper ordering (text first, then audio)
    - Include timestamps in responses
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 10.4 Write property tests for response delivery
    - **Property 29: Response Package Completeness**
    - **Validates: Requirements 9.1**
    - **Property 30: Message Delivery Order**
    - **Validates: Requirements 9.2**
    - **Property 31: Response Timestamp Inclusion**
    - **Validates: Requirements 9.3**

  - [ ] 10.5 Implement retry logic for WhatsApp delivery
    - Retry failed deliveries up to 3 times
    - Use 5-second intervals between retries
    - Log all delivery attempts to CloudWatch
    - Track delivery status in User_Store
    - _Requirements: 9.4, 9.5, 9.6_

  - [ ] 10.6 Write property tests for delivery retry
    - **Property 32: Delivery Retry Behavior**
    - **Validates: Requirements 9.4**
    - **Property 33: Delivery Logging**
    - **Validates: Requirements 9.5**
    - **Property 34: Delivery Status Tracking**
    - **Validates: Requirements 9.6**

  - [ ] 10.7 Implement metrics tracking
    - Log request duration, component timings
    - Track online vs offline mode usage
    - Record error counts by type
    - Publish custom CloudWatch metrics
    - _Requirements: 16.1, 16.2_

- [ ] 11. Implement User Profile Management
  - [ ] 11.1 Create user profile operations
    - Implement user lookup by phone number
    - Create new user profiles on first interaction
    - Encrypt phone numbers using KMS
    - Store userId, phone_number, preferred_language, creation_timestamp
    - Update last interaction timestamp
    - _Requirements: 11.1, 11.2, 11.4_

  - [ ] 11.2 Write property tests for user profiles
    - **Property 41: User Profile Creation**
    - **Validates: Requirements 11.1**
    - **Property 44: Phone Number Encryption**
    - **Validates: Requirements 11.4**

  - [ ] 11.3 Implement user data deletion
    - Accept data deletion requests
    - Remove all user data from DynamoDB
    - Delete associated reminders
    - Complete deletion within 48 hours
    - _Requirements: 11.5, 11.6_

  - [ ] 11.4 Write property test for data deletion
    - **Property 45: User Data Deletion**
    - **Validates: Requirements 11.5, 11.6**

- [ ] 12. Checkpoint - Ensure core backend services are functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement rate limiting and security
  - [ ] 13.1 Create rate limiter service
    - Implement per-user rate limiting (10 requests/minute)
    - Store request counts in DynamoDB with TTL
    - Return HTTP 429 with Retry-After header when exceeded
    - _Requirements: 13.6_

  - [ ] 13.2 Write property test for rate limiting
    - **Property 46: Rate Limit Enforcement**
    - **Validates: Requirements 13.6**

  - [ ] 13.3 Implement API Gateway throttling
    - Configure throttle limits (10 req/sec per API key)
    - Set burst limit to 20 requests
    - Set daily quota to 10,000 requests per user
    - _Requirements: 13.6_

  - [ ] 13.4 Implement secrets rotation
    - Create Lambda for automatic secret rotation
    - Configure 90-day rotation schedule
    - Set up SNS notifications for rotation failures
    - _Requirements: 13.4_

  - [ ] 13.5 Write property test for secrets rotation
    - **Property 47: Secrets Rotation**
    - **Validates: Requirements 13.4**

  - [ ] 13.6 Implement HTTPS enforcement
    - Configure API Gateway to enforce HTTPS
    - Set up TLS 1.2 minimum version
    - Use ACM certificates for custom domains
    - _Requirements: 13.5_


- [ ] 14. Implement error handling and retry logic
  - [ ] 14.1 Create RetryHandler utility class
    - Implement exponential backoff algorithm
    - Support configurable max attempts, delays, and retryable errors
    - Calculate delays with backoff multiplier
    - _Requirements: 20.5_

  - [ ] 14.2 Write property test for retry handler
    - **Property 48: Exponential Backoff Retry**
    - **Validates: Requirements 20.5**

  - [ ] 14.3 Implement error message localization
    - Create error message templates in all 10 languages
    - Define messages for common errors (transcription failed, audio too large, rate limit, service unavailable)
    - Return user-friendly error messages in detected language
    - _Requirements: 20.4_

  - [ ] 14.4 Write property test for error localization
    - **Property 49: Error Message Localization**
    - **Validates: Requirements 20.4**

  - [ ] 14.5 Implement structured error logging
    - Create ErrorLogger class with CloudWatch integration
    - Log errors with full context (requestId, userId, component, stack trace)
    - Publish error metrics to CloudWatch
    - Send SNS alerts for critical errors
    - _Requirements: 16.1, 20.1_

  - [ ] 14.6 Write property test for error logging
    - **Property 50: Error Logging Completeness**
    - **Validates: Requirements 16.1, 20.1**

  - [ ] 14.7 Implement fallback mechanisms
    - Create multi-level fallback strategy (Bedrock → Semantic Search → Keyword Matching → Default Response)
    - Implement FallbackHandler class
    - Track fallback usage in metrics
    - _Requirements: 20.2, 20.3_

  - [ ] 14.8 Write property test for fallback mechanisms
    - **Property 51: Fallback Chain Execution**
    - **Validates: Requirements 20.2, 20.3**

- [ ] 15. Implement performance optimizations
  - [ ] 15.1 Set up ElastiCache Redis for embedding cache
    - Deploy Redis cluster (cache.t3.micro for dev, cache.r6g.large for prod)
    - Enable encryption in-transit and at-rest
    - Configure 1-hour TTL for embeddings
    - _Requirements: 5.6_

  - [ ] 15.2 Set up DynamoDB DAX for FAQ caching
    - Deploy DAX cluster with 2 nodes (dax.t3.small)
    - Configure 5-minute TTL for FAQ queries
    - Enable write-through caching
    - _Requirements: Performance optimization_

  - [ ] 15.3 Implement response compression
    - Enable gzip compression in API Gateway
    - Set minimum compression size to 1 KB
    - Implement Lambda response compression utility
    - _Requirements: 19.1_

  - [ ] 15.4 Write property test for compression
    - **Property 52: Response Compression**
    - **Validates: Requirements 19.1**

  - [ ] 15.5 Implement low-bandwidth optimizations
    - Create BandwidthDetector class
    - Detect connection type from headers
    - Enable text-only mode for 2G/slow connections
    - Generate audio at 64 kbps bitrate
    - _Requirements: 19.2, 19.5, 19.6_

  - [ ] 15.6 Write property tests for bandwidth optimization
    - **Property 53: Audio Bitrate Optimization**
    - **Validates: Requirements 19.2**
    - **Property 54: Text-Only Mode Activation**
    - **Validates: Requirements 19.5, 19.6**

  - [ ] 15.7 Optimize Lambda cold starts
    - Configure provisioned concurrency (Orchestrator: 10, AI Engine: 5, Voice Processor: 5)
    - Initialize AWS clients outside handler functions
    - Create Lambda layers for shared dependencies
    - Implement connection pooling with keep-alive
    - _Requirements: 15.1, 15.2_

- [ ] 16. Implement monitoring and alerting
  - [ ] 16.1 Create CloudWatch dashboard
    - Add widgets for request volume, response time, error rate
    - Show online vs offline mode distribution
    - Display language distribution
    - Show Lambda concurrent executions
    - Show DynamoDB consumed capacity
    - Display active reminders count
    - Add log insights queries for recent errors
    - _Requirements: 16.6_

  - [ ] 16.2 Set up CloudWatch alarms
    - Create high error rate alarm (>5% over 5 minutes)
    - Create high latency alarm (avg >5 seconds over 5 minutes)
    - Create AI Engine failure alarm (>10 errors in 5 minutes)
    - Create Lambda throttling alarm (>0 throttles in 1 minute)
    - Create DynamoDB throttling alarm (>5 errors in 5 minutes)
    - Configure SNS topic for alert notifications
    - _Requirements: 16.3, 16.4_

  - [ ] 16.3 Write property tests for monitoring
    - **Property 55: Metrics Publishing**
    - **Validates: Requirements 16.2**
    - **Property 56: Alert Triggering**
    - **Validates: Requirements 16.3, 16.4**

  - [ ] 16.4 Implement custom metrics
    - Publish RequestCount, RequestDuration metrics
    - Publish OnlineModeRequests, OfflineModeRequests
    - Publish component-specific duration metrics
    - Publish error counts by type
    - Publish business metrics (ActiveUsers, ReminderCreated, LanguageDistribution)
    - _Requirements: 16.2_


- [ ] 17. Implement PWA Backend API
  - [ ] 17.1 Create authentication endpoints
    - Set up Cognito User Pool for PWA users
    - Implement POST /api/auth/login with phone number and OTP
    - Implement OTP generation and SMS sending via SNS
    - Generate JWT access tokens (1-hour expiry) and refresh tokens (30-day expiry)
    - Implement POST /api/auth/logout
    - _Requirements: 12.1, 13.1_

  - [ ] 17.2 Write property tests for authentication
    - **Property 57: JWT Token Generation**
    - **Validates: Requirements 13.1**
    - **Property 58: Token Expiration**
    - **Validates: Requirements 13.1**

  - [ ] 17.3 Create chat endpoints
    - Implement POST /api/chat/message for text input
    - Implement POST /api/chat/voice for voice input (multipart form data)
    - Integrate with Request Orchestrator Lambda
    - Return responses with text, audioUrl, mode, and processingTime
    - _Requirements: 12.1_

  - [ ] 17.4 Create reminder management endpoints
    - Implement GET /api/reminders to list user reminders
    - Implement POST /api/reminders to create reminders
    - Implement DELETE /api/reminders/:id to cancel reminders
    - _Requirements: 12.4_

  - [ ] 17.5 Create user preferences endpoints
    - Implement GET /api/user/preferences
    - Implement PUT /api/user/preferences
    - Support preferredLanguage, voiceEnabled, textOnlyMode settings
    - _Requirements: 12.1_

  - [ ] 17.6 Create FAQ sync endpoint
    - Implement GET /api/faq/sync with language filter
    - Support incremental sync with lastSyncTime parameter
    - Return FAQ data for offline caching
    - _Requirements: 12.5_

- [ ] 18. Implement PWA Frontend
  - [ ] 18.1 Set up React + Vite project
    - Initialize project with TypeScript
    - Configure Vite build tool
    - Set up Material-UI or Tailwind CSS
    - Configure React Router for navigation
    - _Requirements: 12.1_

  - [ ] 18.2 Create authentication components
    - Build login form with phone number input
    - Build OTP verification form
    - Implement JWT token storage (access token in memory, refresh token in HttpOnly cookie)
    - Create AuthContext for state management
    - _Requirements: 12.1_

  - [ ] 18.3 Create chat interface components
    - Build ChatInterface with message list and input
    - Build MessageInput with text and voice recording
    - Integrate Web Speech API for voice input (SpeechRecognition)
    - Build VoiceRecorder component with recording controls
    - Display messages with timestamps
    - _Requirements: 12.1, 12.2_

  - [ ] 18.4 Create reminder components
    - Build ReminderList to display active reminders
    - Build ReminderForm for creating new reminders
    - Build ReminderCard for individual reminder display
    - Implement reminder dashboard
    - _Requirements: 12.4_

  - [ ] 18.5 Create settings components
    - Build LanguageSelector with manual language toggle
    - Build PreferencesForm for voice/text-only settings
    - Build ProfileSettings component
    - _Requirements: 12.3_

  - [ ] 18.6 Implement offline functionality
    - Set up IndexedDB using Dexie.js
    - Create database schema for FAQs, messages, reminders
    - Implement offline FAQ search
    - Queue unsent messages for sync when online
    - _Requirements: 12.5, 12.6_

  - [ ] 18.7 Write property tests for offline sync
    - **Property 59: Offline FAQ Search**
    - **Validates: Requirements 12.5**
    - **Property 60: Message Queue Sync**
    - **Validates: Requirements 12.6**

  - [ ] 18.8 Implement Service Worker with Workbox
    - Precache static assets
    - Cache FAQ API responses (CacheFirst, 24-hour expiry)
    - Use NetworkFirst for chat API with 3-second timeout
    - Cache images (CacheFirst, 7-day expiry)
    - _Requirements: 12.5_

  - [ ] 18.9 Create PWA manifest
    - Define app name, icons, theme colors
    - Configure standalone display mode
    - Set portrait orientation
    - Add icons for all required sizes (72x72 to 512x512)
    - _Requirements: 12.1_

  - [ ] 18.10 Implement lazy loading and optimization
    - Lazy load images and non-critical resources
    - Implement code splitting for routes
    - Optimize bundle size
    - _Requirements: 19.3_

  - [ ] 18.11 Write property test for lazy loading
    - **Property 61: Resource Lazy Loading**
    - **Validates: Requirements 19.3**


- [ ] 19. Checkpoint - Ensure PWA and backend integration works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Implement scalability features
  - [ ] 20.1 Configure Lambda auto-scaling
    - Set reserved concurrency for critical functions
    - Configure maximum concurrency limits
    - Enable auto-scaling based on utilization
    - _Requirements: 15.1, 15.2_

  - [ ] 20.2 Write property tests for scalability
    - **Property 62: Lambda Concurrent Execution Scaling**
    - **Validates: Requirements 15.1, 15.2**
    - **Property 63: Response Time Under Load**
    - **Validates: Requirements 15.3, 15.4**

  - [ ] 20.3 Configure DynamoDB on-demand pricing
    - Enable on-demand billing mode for all tables
    - Verify automatic capacity scaling
    - _Requirements: 15.6_

  - [ ] 20.4 Implement traffic spike handling
    - Configure API Gateway throttling for burst traffic
    - Test system with 5x normal load
    - Verify no degradation in response times
    - _Requirements: 15.5_

  - [ ] 20.5 Write property test for traffic spikes
    - **Property 64: Traffic Spike Handling**
    - **Validates: Requirements 15.5**

- [ ] 21. Implement data privacy and compliance
  - [ ] 21.1 Verify encryption at rest
    - Confirm KMS encryption for DynamoDB tables
    - Confirm KMS encryption for S3 buckets
    - Test key rotation
    - _Requirements: 14.1_

  - [ ] 21.2 Write property tests for encryption
    - **Property 65: Data Encryption at Rest**
    - **Validates: Requirements 14.1**
    - **Property 66: Data Encryption in Transit**
    - **Validates: Requirements 14.2**

  - [ ] 21.3 Implement PII minimization
    - Verify only phone numbers are collected
    - Confirm voice files are deleted after 24 hours
    - Verify no conversation history is stored beyond current session
    - _Requirements: 14.3, 14.4, 14.5_

  - [ ] 21.4 Write property tests for PII protection
    - **Property 67: Voice File Deletion**
    - **Validates: Requirements 14.4**
    - **Property 68: PII Minimization**
    - **Validates: Requirements 14.3**

  - [ ] 21.5 Implement compliance features
    - Add data retention policies
    - Implement user consent tracking
    - Create audit logs for data access
    - _Requirements: 14.6_

  - [ ] 21.6 Write property test for compliance
    - **Property 69: Data Retention Policy Enforcement**
    - **Validates: Requirements 14.6**

- [ ] 22. Implement deployment pipeline
  - [ ] 22.1 Create GitHub Actions workflow
    - Set up test job (unit, integration, property-based tests)
    - Create deploy-dev job for develop branch
    - Create deploy-prod job for main branch
    - Configure AWS credentials
    - Run smoke tests after production deployment
    - _Requirements: Deployment automation_

  - [ ] 22.2 Implement rollback strategy
    - Create rollback script for CloudFormation stacks
    - Implement Lambda version management with aliases
    - Configure API Gateway stages for blue-green deployment
    - _Requirements: Deployment safety_

  - [ ] 22.3 Set up environment configurations
    - Create development environment config (lower memory, no provisioned concurrency)
    - Create production environment config (higher memory, provisioned concurrency)
    - Configure feature flags per environment
    - _Requirements: Environment management_

- [ ] 23. Create deployment documentation
  - [ ] 23.1 Write infrastructure setup guide
    - Document AWS account prerequisites
    - Document IAM permissions required
    - Document CDK deployment steps
    - Document secrets setup process
    - _Requirements: Documentation_

  - [ ] 23.2 Write API documentation
    - Document WhatsApp webhook endpoints
    - Document PWA REST API endpoints
    - Include request/response examples
    - Document error codes and messages
    - _Requirements: Documentation_

  - [ ] 23.3 Write operations runbook
    - Document monitoring and alerting setup
    - Document troubleshooting procedures
    - Document rollback procedures
    - Document scaling procedures
    - _Requirements: Documentation_

- [ ] 24. Implement remaining property-based tests
  - [ ] 24.1 Write property tests for configuration parsing
    - **Property 70: Configuration Parser Round-Trip**
    - **Validates: Requirements 17.1, 17.5, 17.6**

  - [ ] 24.2 Write property tests for API response parsing
    - **Property 71: API Response Parser Round-Trip**
    - **Validates: Requirements 18.1, 18.4, 18.5**

- [ ] 25. Final integration testing
  - [ ] 25.1 Run end-to-end integration tests
    - Test complete WhatsApp voice message flow
    - Test complete WhatsApp text message flow
    - Test PWA chat functionality
    - Test reminder creation and delivery
    - Test offline mode fallback
    - Test all 10 language paths
    - Test error scenarios and recovery

  - [ ] 25.2 Run load testing
    - Test with 100 concurrent users
    - Verify response times under load
    - Verify auto-scaling behavior
    - Test traffic spike handling (5x normal load)

  - [ ] 25.3 Run security testing
    - Verify webhook signature validation
    - Test rate limiting enforcement
    - Verify encryption at rest and in transit
    - Test IAM role permissions (least privilege)
    - Verify secrets rotation

- [ ] 26. Final checkpoint - Production readiness verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties from the design document
- Unit tests and integration tests validate specific examples and edge cases
- Implementation uses TypeScript with Node.js 20.x runtime for all Lambda functions
- AWS CDK is used for infrastructure as code
- All 71 correctness properties from the design document are covered in property-based test tasks
- Checkpoints ensure incremental validation at key milestones
- The system supports 10 Indian languages: Hindi, English, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Punjabi
- Security and privacy are built-in from the start with encryption, rate limiting, and PII minimization
- The architecture is serverless and auto-scaling to handle variable load
- Offline mode ensures reliability in poor connectivity areas
