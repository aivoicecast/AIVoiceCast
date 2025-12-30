
import { CommunityDiscussion } from '../types';

export const APP_COMPARISON_DOC: CommunityDiscussion = {
  id: 'system-doc-001',
  lectureId: 'system-architecture',
  channelId: 'system',
  userId: 'system',
  userName: 'System Architect',
  transcript: [],
  createdAt: 1766016000000, // Dec 18, 2025
  isManual: true,
  title: "Design Doc: Document Studio vs. Community Blog",
  designDoc: `
# Design Specification: Knowledge Pillars

**Status:** Draft | **Author:** Engineering Team | **Date:** Dec 18, 2025

## 1. Executive Summary
The AIVoiceCast platform bifurcates long-form content into two distinct engines: the **Document Studio** and the **Community Blog**. This document outlines the technical and philosophical differences between these two modules.

## 2. Comparison Matrix

| Feature | Document Studio | Community Blog |
| :--- | :--- | :--- |
| **Primary Intent** | Knowledge capture & technical archiving | Social storytelling & public updates |
| **Input Source** | Live Transcripts, AI Analysis, Design notes | Human-authored articles & opinion pieces |
| **Default Privacy** | Private / Restricted (Team Access) | Public (Community Feed) |
| **Structure** | Technical Markdown, Tables, Code Blocks | Narrative Prose, Media embeds, Excerpts |
| **Output Formats** | **Google Docs**, PDF, JSZip Package | Web Feed, Social Share, Comments |
| **AI Role** | Synthesizes transcripts into Design Docs | Suggests titles, tags, and proofreads |

## 3. Behavioral Architecture

### The Document Studio (Workflow Engine)
The Studio is designed for "Work-in-Progress" and "Institutional Memory." 
- **The Lifecycle:** A Live Session (Audio) → Transcription → **AI Analysis** → Design Document.
- **Integration:** Deeply linked to **Google Drive**. It allows users to export a synthesized meeting summary directly into their professional workspace as a formal Google Doc.

### The Community Blog (Social Engine)
The Blog is designed for "Audience Reach" and "Community Engagement."
- **The Lifecycle:** Concept → Editor Draft → Peer Review (Optional) → **Published to Feed**.
- **Engagement:** Focuses on Likes, Comments, and Follower growth. It is the "Social Identity" of a creator.

## 4. Technical Constraints
- **Documents** require explicit sharing tokens for external viewing to maintain security for technical specifications.
- **Blog Posts** are automatically indexed by the Public Registry for discovery.

## 5. Conclusion
Use the **Document Studio** when you are building and need to remember *how* or *why*. Use the **Blog** when you have something to say to the *world*.
`
};
