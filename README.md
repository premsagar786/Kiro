# Kiro 
# Maitri AI 🇮🇳🤖  
# "Voice-first AI Assistant for Bharat with Offline + Online Intelligence"
### Voice Assistant for Bharat (WhatsApp + Mobile App)

Maitri AI is a multilingual **voice + text assistant** designed for citizens across Bharat, especially users in rural and low-connectivity regions. It supports interaction through **WhatsApp** and a **Mobile Application**, enabling users to ask queries using voice notes or text messages.

The system includes **Speech-to-Text (STT)**, **Language Detection**, **Text-to-Speech (TTS)**, and an intelligent **connectivity-based decision layer** that switches between **Online AI Mode** and **Offline Mode** depending on internet availability.

In **Online Mode**, Maitri AI connects to a cloud LLM and government/public APIs for accurate answers.  
In **Offline Mode**, it provides support using cached FAQs, reminders, and local commands.

---

## 🚀 Features
- WhatsApp + Mobile App support
- Voice note handling + text chat
- Automatic language detection
- Speech-to-text conversion (STT)
- Text-to-speech responses (TTS)
- Offline mode support (cached FAQs, reminders, commands)
- Online AI mode (LLM + Government APIs + Knowledge Base)
- Scalable architecture for large user base
- Secure and privacy-friendly design

---

## 📌 Use Cases
- Government scheme eligibility checks
- Pension, ration card, and document guidance
- Weather forecasting and mandi price info
- Reminders for medicines, payments, farming tasks
- Offline support for remote areas

---

## 🏗️ System Architecture

### 📍 High Level Flow
1. User sends voice/text message (WhatsApp / Mobile App)
2. Input handler processes query
3. Language detection + STT (if voice)
4. Internet check (Decision Layer)
5. Online AI module OR Offline module executes
6. Response is generated (text + optional voice)
7. Response delivered back to user

---

## 🧩 ER Diagram (Mermaid)

```mermaid
erDiagram
    USER ||--o{ INTERACTION : has
    USER ||--o{ REMINDER : creates
    USER ||--o{ PREFERENCE : sets
    FAQ ||--o{ FAQ_CATEGORY : belongs_to

    USER {
        string user_id
        string name
        string phone_number
        string access_channel
        datetime created_at
    }

    INTERACTION {
        string interaction_id
        string user_id
        string input_type
        string input_text
        string detected_language
        string response_text
        boolean internet_used
        datetime timestamp
    }

    REMINDER {
        string reminder_id
        string user_id
        string reminder_text
        datetime scheduled_time
        string status
    }

    PREFERENCE {
        string preference_id
        string user_id
        string preferred_language
        boolean voice_reply_enabled
    }

    FAQ {
        string faq_id
        string question
        string answer
        string keywords
    }

    FAQ_CATEGORY {
        string category_id
        string category_name
    }
