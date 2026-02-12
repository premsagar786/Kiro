# Maitri AI - System Design Document

## 1. Architecture Summary
Maitri AI follows a modular pipeline architecture:

1. User interacts via WhatsApp or Mobile App
2. Input Handler captures voice/text
3. Language Processing detects language and performs STT if needed
4. Decision Layer checks connectivity
5. Routes request to:
   - Offline Module (cached FAQs, reminders, local commands)
   - Online AI Module (LLM + APIs + knowledge base)
6. Response Generation creates text and voice response (TTS)
7. Response delivered back to user

---

## 2. High-Level Workflow
### Step-by-step Flow
1. User sends voice/text query.
2. System receives input from WhatsApp Business API / Mobile App Backend.
3. Input Handler normalizes request format.
4. Language Detection identifies language.
5. If input is voice → STT converts speech to text.
6. Connectivity check:
   - If internet available → Online AI pipeline
   - Else → Offline pipeline
7. Generate response:
   - Text response
   - Optional TTS voice response
8. Send response back to WhatsApp or Mobile App.

---

## 3. System Components

### 3.1 Client Layer
#### WhatsApp Channel
- WhatsApp Business API used as communication interface.
- Supports voice notes, text, media.

#### Mobile App
- Android-first design.
- Voice button + text chat interface.
- Offline cache stored locally.

---

### 3.2 Backend Gateway Layer
A gateway service receives all incoming requests and routes them into processing pipeline.

**Responsibilities**
- Authentication & request validation
- Standardizing input payload format
- Logging request metadata
- Routing to processing service

---

### 3.3 Input Handler Service
**Responsibilities**
- Voice capture handling
- Text sanitization and normalization
- Media format conversion if required

**Outputs**
- Clean text query OR audio file ready for STT

---

### 3.4 Language Processing Layer
#### Language Detection Module
Detects language from:
- Text query (fast language classifier)
- STT output (post-processing)

#### Speech-to-Text (STT)
Converts audio to text.
- Online STT: Cloud STT APIs
- Offline STT: optional lightweight on-device model

---

### 3.5 Decision Layer (Connectivity Check)
This layer determines whether system should run in online or offline mode.

**Logic**
- Ping server or check network interface
- If API calls possible → Online mode
- Else → Offline mode

---

## 4. Offline Module Design
Offline module is designed for rural/no-internet conditions.

### 4.1 Cached FAQ Engine
- Stored locally in mobile app OR in edge gateway
- Uses keyword + intent matching
- Predefined categories:
  - government schemes
  - emergency helpline
  - ration card info
  - agriculture tips

### 4.2 Reminders Engine
- Reminder creation via voice/text
- Stored in local DB (mobile) or backend DB (WhatsApp users)
- Triggers notifications using scheduler

### 4.3 Local Commands Processor
Supports command-based actions like:
- set reminder
- list reminders
- repeat response
- language change

---

## 5. Online AI Module Design
Online AI module provides advanced intelligence.

### 5.1 LLM Layer (Cloud)
- Query sent to cloud LLM
- Response generated using system prompt + user context
- Includes safety filters and guardrails

### 5.2 Government & Info APIs
Integrations include:
- scheme eligibility APIs
- weather forecast APIs
- mandi price APIs
- citizen grievance portals

### 5.3 Knowledge Base / RAG Layer
- Verified documents stored in vector database
- Retrieval-Augmented Generation ensures factual responses
- Avoids hallucinations by citing trusted sources

---

## 6. Response Generation Layer

### 6.1 Text Response Generator
- Produces short, simple, easy-to-understand answers
- Supports local language translation if needed

### 6.2 Voice Output Generator (TTS)
- Converts final text to speech
- Sends audio response file back to user

---

## 7. Data Storage Design

### 7.1 Databases
#### User DB (Relational or Document)
Stores:
- user_id (whatsapp number / app id)
- preferred language
- consent flags
- last interaction timestamp

#### Reminders DB
Stores:
- reminder_id
- user_id
- reminder_text
- scheduled_time
- status (pending/completed)

#### Cached FAQs Store
- JSON / SQLite for mobile
- Redis cache for backend

#### Logs Store
- request logs
- error logs
- analytics events

---

## 8. Suggested Tech Stack

### 8.1 Backend
- Node.js / FastAPI (Python)
- REST API + Webhooks for WhatsApp
- Redis for caching
- PostgreSQL / MongoDB for storage

### 8.2 AI & NLP
- Whisper / Google STT for speech-to-text
- GPT / Claude / open-source LLM for reasoning
- IndicTrans / translation APIs for language conversion
- Vector DB: Pinecone / Weaviate / FAISS

### 8.3 TTS
- Google TTS / Azure Speech / Coqui TTS
- Indic language voice support required

### 8.4 Mobile App
- Flutter / React Native
- Local DB: SQLite
- Offline cache stored locally

### 8.5 Infrastructure
- AWS / GCP / Azure
- Docker + Kubernetes (for scaling)
- API Gateway + Load Balancer
- Cloud Storage for voice files

---

## 9. Security Design

### 9.1 Data Security
- HTTPS/TLS encryption mandatory
- Token-based authentication for mobile app
- WhatsApp webhook signature validation

### 9.2 Privacy Controls
- Voice files auto-deleted after processing (default)
- Store only consent-based user data
- Mask phone numbers in logs

### 9.3 Access Control
- Admin dashboard restricted with RBAC
- API key rotation and secret vault storage

---

## 10. Failure Handling

### 10.1 Online Module Failure
If LLM/API fails:
- fallback to cached FAQ engine
- respond with a friendly error message

### 10.2 STT Failure
If voice transcription fails:
- request user to resend voice or type text

### 10.3 TTS Failure
If voice generation fails:
- send only text response

---

## 11. Observability & Monitoring
- Request tracing per user session
- Metrics:
  - average response time
  - online/offline ratio
  - most requested FAQs
- Alerts for:
  - API downtime
  - STT failures
  - LLM quota exhaustion

---

## 12. API Design (Proposed)

### 12.1 WhatsApp Webhook Endpoint
POST `/webhook/whatsapp`
Payload:
- sender_id
- message_type (text/voice)
- message_content

### 12.2 Mobile App Chat Endpoint
POST `/api/chat`
Payload:
- user_id
- input_type
- content

### 12.3 Reminder Endpoint
POST `/api/reminder/create`
GET `/api/reminder/list`

### 12.4 FAQ Sync Endpoint
GET `/api/faqs/sync`

---

## 13. Future Enhancements
- OCR for documents (ration card, Aadhaar related info)
- Human agent escalation support
- On-device lightweight LLM for offline Q/A
- Personalization using user interaction history
- Regional dialect support

---

## 14. Summary
Maitri AI is designed as a multilingual, voice-first assistant optimized for Bharat’s connectivity challenges.  
Its decision-based architecture ensures continuous support through offline caching and rule-based processing while leveraging powerful cloud AI when internet is available.
