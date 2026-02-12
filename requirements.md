# Maitri AI - Requirements Document

## 1. Project Overview
Maitri AI is a voice + text assistant designed for Bharat (India), accessible via WhatsApp and a Mobile App.  
The system supports multilingual input, works in both online and offline environments, and generates responses via text and voice (TTS).

The core goal is to provide citizens (farmers, elderly, rural users, etc.) with an easy conversational interface for accessing government services, FAQs, reminders, and local commands.

---

## 2. Goals & Objectives
### Primary Goals
- Provide voice-based interaction for low-literacy users.
- Support WhatsApp as a primary access channel.
- Provide offline support when internet is unavailable.
- Enable multilingual input/output.
- Integrate government data and APIs for verified information.

### Secondary Goals
- Provide reminders and alerts.
- Provide cached FAQs for faster response.
- Ensure low latency response generation.

---

## 3. Stakeholders
- **End Users:** Farmers, elderly people, rural citizens, general public
- **Admin Team:** Maintains FAQ database and reminder templates
- **Developers:** Maintain AI pipeline and API integrations
- **Government/Service Providers:** Provide data sources & APIs

---

## 4. User Personas
### Persona 1: Farmer (Rural User)
- Uses WhatsApp voice notes
- Needs info about schemes, weather, subsidies
- Often has low bandwidth internet

### Persona 2: Elderly Woman
- Uses mobile app voice interaction
- Needs reminders, pension info, healthcare schemes

### Persona 3: Semi-Urban Youth
- Uses text input
- Needs government form guidance, document requirements

---

## 5. Functional Requirements

### 5.1 Access Channels
#### FR-1: WhatsApp Integration
- System must accept messages via WhatsApp.
- Must support both voice notes and text messages.

#### FR-2: Mobile App Integration
- Mobile app must allow voice and text input.
- Must display responses in chat-style UI.

---

### 5.2 Input Handler
#### FR-3: Voice Capture
- System must accept voice input from WhatsApp and mobile app.
- Voice file formats supported: `.ogg`, `.mp3`, `.wav` (minimum requirement).

#### FR-4: Text Input
- System must accept text messages in multiple Indian languages.

---

### 5.3 Language Processing
#### FR-5: Language Detection
- System must detect the language of the input automatically.
- Must support at least: Hindi, English, Marathi, Tamil, Telugu, Bengali.

#### FR-6: Speech-to-Text (STT)
- System must convert voice input to text.
- STT should work online and optionally offline (fallback).

---

### 5.4 Decision Layer (Connectivity Check)
#### FR-7: Internet Availability Check
- System must check if internet connectivity is available.
- If internet is unavailable, it must switch to offline module.

---

### 5.5 Offline Module
#### FR-8: Cached FAQs
- Must store a set of preloaded FAQs locally.
- FAQs must be searchable by keywords and intent.

#### FR-9: Reminders
- Must allow creation of reminders.
- Must notify user via WhatsApp/app notification when reminder triggers.

#### FR-10: Local Commands
- Must support offline commands like:
  - "Set reminder"
  - "Show saved schemes"
  - "Repeat last answer"
  - "Help menu"

---

### 5.6 Online AI Module
#### FR-11: Cloud LLM Integration
- Must send processed user query to a cloud LLM for reasoning.
- Must provide contextual responses.

#### FR-12: Government & Info APIs
- Must support integration with:
  - Government schemes databases
  - Weather APIs
  - Agriculture market prices
  - Public service portals

#### FR-13: Knowledge Base Search
- Must support retrieval-based responses from stored verified knowledge.

---

### 5.7 Response Generation
#### FR-14: Text Response
- Must generate text output in the user’s language.

#### FR-15: Voice Output (TTS)
- Must generate speech output using Text-to-Speech.
- Voice output must support Indian languages.

---

### 5.8 Output Delivery
#### FR-16: WhatsApp Output
- Must send back:
  - Text reply
  - Voice reply (optional if requested)

#### FR-17: Mobile App Output
- Must display response as text.
- Must play audio response if enabled.

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Average response time online: <= 3 seconds
- Offline response time: <= 1 second
- Must handle minimum 100 concurrent requests (scalable design)

### 6.2 Reliability
- Offline module must work even with 0 internet.
- Online module must gracefully fallback if LLM fails.

### 6.3 Scalability
- Architecture must support scaling for millions of users.
- Stateless services should be preferred.

### 6.4 Security
- Must encrypt user data in transit (HTTPS).
- Must store minimal user personal data.
- API keys must be secured via secret manager.

### 6.5 Privacy
- Must not store voice recordings unless user consent is provided.
- Must comply with Indian data privacy guidelines.

### 6.6 Usability
- Simple conversation interface.
- Must support voice-first design.
- Must work well for low literacy users.

### 6.7 Availability
- Online services should have >= 99.5% uptime.
- Offline features must always be available on device.

---

## 7. System Constraints
- Must support low bandwidth environments.
- Must support low-end Android devices.
- Must minimize compute usage in offline mode.

---

## 8. Assumptions
- WhatsApp Business API will be available.
- Government APIs provide stable access endpoints.
- Mobile app users allow microphone access.

---

## 9. Out of Scope (Initial Version)
- Video-based interaction
- AI-generated legal/medical advice without disclaimers
- Real-time human agent call support
- Full document OCR pipeline (future enhancement)

---

## 10. Acceptance Criteria
- User can send a voice message via WhatsApp and receive a text reply.
- If internet is off, system returns an offline FAQ answer.
- Multilingual voice input is correctly converted to text.
- User can request a voice reply (TTS) and receive it.
- Reminders can be created and triggered successfully.
