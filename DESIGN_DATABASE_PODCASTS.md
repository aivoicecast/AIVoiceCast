# Neural Prism: Database-Driven Activity Architecture

## Overview
This document outlines the data architecture for the Neural Prism Platform, transitioning to a scalable, activity-centric model using Google Firebase and client-side IndexedDB.

The system uses a **Refractive Storage Strategy**:
1.  **Firestore (Cloud Control Plane)**: Stores Activity metadata, User profiles, Community relationships, and the Global Neural Ledger.
2.  **IndexedDB (Local Data Plane)**: Acts as the "Prism Cache". Stores heavy media assets (generated audio/video fragments) and session-specific logic to minimize latency and ensure offline resilience.

---

## 1. Cloud Database Schema (Firestore)

### `users` Collection
Stores user profiles and holographic identity.
- **Document ID**: `uid` (from Firebase Auth)
- **Fields**:
  - `displayName`: string
  - `email`: string
  - `groups`: string[] (Communities the user contributes to)
  - `coinBalance`: number (VoiceCoin Ledger)
  - `publicKey`: string (Cryptographic Identity)

### `channels` Collection (Activity Spectrum)
The registry of Neural Prism tools and interactive podcasts.
- **Document ID**: `activityId` (UUID)
- **Fields**:
  - `title`: string
  - `description`: string
  - `visibility`: 'public' | 'private' | 'group'
  - `chapters`: Array (The Curriculum/Workflow Structure)

### `discussions` Collection (Knowledge Artifacts)
Stores transcripts and generated specifications from AI-Human sessions.

---

## 2. Local Refraction Schema (IndexedDB)

Database Name: `NeuralPrism_Cache`

### Store: `audio_segments`
- **Key**: `VoiceID:TextHash` (SHA-256)
- **Purpose**:
  - TTS is computationally expensive.
  - Hashing text allows for the deduplication of common technical phrases across different activities.
  - Enables instant, skip-free audio playback.

---

## 3. Data Flow

### Activity Discovery
1.  **Community Hub**: Real-time subscription to the `channels` collection.
2.  **Personal Workshop**: Private tools stored in IndexedDB and backed up to the user's private **Google Drive**.

### Content Synthesis
1.  **Refraction**: Raw request -> Neural Prism -> Structured activity path.
2.  **Simulation**: Code execution is imagined via Heuristic Tracing in Code Studio.
3.  **Persistence**: Final artifacts (PDFs, Source Code) are pushed to the user's Google Drive via OAuth.