# Database-Driven Podcast Architecture Design

## Overview
This document outlines the data architecture for the AIVoiceCast platform, transitioning from hardcoded static files to a scalable, database-driven model using Google Firebase (Firestore) and client-side IndexedDB.

The system uses a **Hybrid Storage Strategy**:
1.  **Firestore (Cloud)**: Acts as the "Control Plane" and "Public Registry". Stores Channel metadata, User profiles, Group relationships, and Social interactions (comments, likes).
2.  **IndexedDB (Local)**: Acts as the "Data Plane" and "Cache". Stores heavy media assets (generated audio blobs) and personalized lecture scripts to minimize bandwidth and latency.

---

## 1. Cloud Database Schema (Firestore)

### `users` Collection
Stores user profiles and global settings.
- **Document ID**: `uid` (from Firebase Auth)
- **Fields**:
  - `displayName`: string
  - `email`: string
  - `photoURL`: string
  - `groups`: string[] (Array of Group IDs the user belongs to)
  - `apiUsageCount`: number
  - `lastLogin`: timestamp

### `channels` Collection
The core registry of podcasts.
- **Document ID**: `channelId` (UUID)
- **Fields**:
  - `title`: string
  - `description`: string
  - `author`: string
  - `ownerId`: string (UID of creator)
  - `visibility`: 'public' | 'private' | 'group'
  - `groupId`: string (Optional, if visibility is 'group')
  - `voiceName`: string (Gemini Voice ID)
  - `systemInstruction`: string (The AI Persona prompt)
  - `tags`: string[]
  - `imageUrl`: string
  - `likes`: number
  - `chapters`: Array (The Curriculum Structure)
    - `id`: string
    - `title`: string
    - `subTopics`: Array
      - `id`: string
      - `title`: string

#### Sub-collection: `channels/{channelId}/lectures`
Stores the actual generated content (scripts) for each lesson. This separates heavy text content from the lightweight channel metadata list.
- **Document ID**: `subTopicId` (Sanitized)
- **Fields**:
  - `topic`: string
  - `professorName`: string
  - `studentName`: string
  - `sections`: Array
    - `speaker`: 'Teacher' | 'Student'
    - `text`: string
    - `discussionId`: string (Optional link to a community discussion)

#### Sub-collection: `channels/{channelId}/comments`
User engagement on the channel.
- **Document ID**: `commentId`
- **Fields**:
  - `userId`: string
  - `text`: string
  - `timestamp`: number
  - `attachments`: Array (Images/Videos)

### `discussions` Collection
Stores transcripts of live sessions and community chats.
- **Document ID**: `discussionId`
- **Fields**:
  - `channelId`: string
  - `lectureId`: string
  - `userId`: string
  - `transcript`: Array (Role/Text/Timestamp)
  - `designDoc`: string (Markdown content generated from the discussion)

### `groups` Collection
Manages collaboration workspaces.
- **Document ID**: `groupId`
- **Fields**:
  - `name`: string
  - `ownerId`: string
  - `memberIds`: string[]

---

## 2. Local Caching Schema (IndexedDB)

Database Name: `AIVoiceCast_AudioCache`

### Store: `user_channels`
- Stores private channels created by the user that haven't been synced or published yet.
- Enables offline creation and editing.

### Store: `lecture_scripts`
- **Key**: `lecture_{channelId}_{lectureId}_{language}`
- **Value**: JSON Object (GeneratedLecture)
- **Purpose**: Prevents re-generating text content via LLM API if it was already viewed.

### Store: `audio_segments`
- **Key**: `VoiceID:TextHash` (SHA-256 of the text content)
- **Value**: ArrayBuffer (Raw Audio Data)
- **Purpose**:
  - This is the most critical cache. TTS is expensive and slow.
  - By hashing the text sentence-by-sentence, we deduplicate common phrases.
  - Enables instant playback for previously listened segments without network calls.

---

## 3. Data Flow & Synchronization

### Podcast Discovery
1.  **Public**: App subscribes to `db.collection('channels').where('visibility', '==', 'public')`. Real-time listeners update the UI instantly when a new channel is published.
2.  **Private**: App queries IndexedDB `user_channels`.
3.  **Group**: App queries `db.collection('channels').where('groupId', 'in', userGroupIds)`.

### Content Generation
1.  **Curriculum**: User prompt -> Gemini 3.0 Pro -> JSON -> Saved to `channels` doc (Firestore or IDB).
2.  **Lecture Script**: User clicks lesson -> Gemini 2.5 Flash -> JSON -> Saved to `channels/{id}/lectures` (Firestore) AND `lecture_scripts` (IDB).
3.  **Audio**: Script -> Split into sentences -> Check `audio_segments` (IDB) -> If miss, Call Gemini Audio API -> Save to IDB -> Play.

### Seeding Strategy
To bootstrap the "Database Driven" nature, the Admin Dashboard (Inspector) includes a **Seed DB** function.
- Iterates over `HANDCRAFTED_CHANNELS` (legacy static data).
- Uploads Channel Metadata to `channels/{id}`.
- Iterates over `SPOTLIGHT_DATA` and `OFFLINE_LECTURES`.
- Uploads Lecture Scripts to `channels/{id}/lectures/{subTopicId}`.
- Sets visibility to `public`.

This effectively migrates the hardcoded application state into a dynamic, cloud-hosted state.
