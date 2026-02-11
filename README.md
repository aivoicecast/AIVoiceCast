# 🌈 Neural Prism Platform (v12.9.5-TELEMETRY)

**The Sovereign Intelligence Hub: Refracting Super-Intelligence into Human Utility.**

Neural Prism is a high-fidelity, multi-model orchestration platform built on 100% Google Gemini infrastructure. It collapses fragmented application verticals into a single refractive substrate, ensuring data sovereignty through personal cloud integration.

---

## 🚀 Developer & Deployment Guide

This guide provides a zero-to-live workflow for deploying your own sovereign instance.

### 1. Prerequisites (Installation)

Before running the platform, install these core components:

#### A. Node.js & npm
- **Install**: [nodejs.org](https://nodejs.org/) (v20+ recommended).
- **Verify**: `node -v` and `npm -v`.

#### B. Google Cloud SDK (gcloud CLI)
- **Install**: [Cloud SDK Installation Guide](https://cloud.google.com/sdk/docs/install).
- **Initialize**: `gcloud init` to log in and select your project.

#### C. Firebase CLI (Optional but Recommended)
- **Install**: `npm install -g firebase-tools`.

---

### 2. Infrastructure Setup (Mandatory)

The platform requires a **Google Firebase** project for Authentication, NoSQL storage, and Binary Vaulting.

1.  **Create Project**: Go to [Firebase Console](https://console.firebase.google.com/).
2.  **Enable Auth**: Turn on **Google Sign-In** in the Authentication section.
3.  **Enable Firestore**: Create a database in **Native Mode**.
4.  **Enable Storage**: Initialize a storage bucket.
5.  **Configure App**: 
    - Copy your `firebaseConfig` object from Project Settings.
    - Paste it into `services/private_keys.ts` OR use the **Firebase Setup** modal within the app (Flame icon in header).

---

### 3. Local Development

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/aivoicecast/AIVoiceCast.git
    cd AIVoiceCast
    npm install
    ```

2.  **Environment Variables**:
    Create a `.env` file in the root:
    ```bash
    VITE_GEMINI_API_KEY=your_gemini_key_here
    ```

3.  **Launch**:
    ```bash
    npm run dev
    ```
    Access at `http://localhost:5173`.

---

### 4. Sovereign Deployment (Google Cloud)

Deploying to your own cloud prevents `PERMISSION_DENIED` errors and ensures 100% privacy.

#### Step A: Configure Project
```bash
# Login to your Google account
gcloud auth login

# Create your project (Replace 'my-unique-prism' with your name)
gcloud projects create my-unique-prism
gcloud config set project my-unique-prism

# Enable necessary APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com
```

#### Step B: Execute the Refraction
Ensure your `VITE_GEMINI_API_KEY` is exported in your terminal, then:
```bash
# 1. Compile locally to catch errors
npm run build

# 2. Deploy to Cloud Run (Production)
npm run deploy

# 3. Deploy with a custom name/suffix (Dev)
npm run deploy:dev
```

---

## 🛠️ Common Pitfalls (Troubleshooting)

- **`PERMISSION_DENIED`**: Ensure you have linked a **Billing Account** to your Google Cloud project. Cloud Build and Cloud Run require a valid billing method (even if you stay within the free tier).
- **`Firebase Auth: Domain Not Authorized`**: You must add your Cloud Run URL (e.g., `https://...run.app`) to the "Authorized Domains" list in the **Firebase Console > Authentication > Settings**.
- **`Gemini API 403`**: Ensure your API key has the "Generative Language API" enabled in the [Google AI Studio Settings](https://aistudio.google.com/app/apikey).

---

## 🏗️ Architectural Deep Dive

### The Binary Chunking Protocol (BCP v2)
To bypass the **1MB document wall** of Cloud Firestore while staying serverless, we implemented BCP. Shards are stored as deterministic **750,000-byte segments**.

### Heuristic Logic Tracing (Builder Studio)
The IDE bypasses physical compilers by using Gemini 3 Flash as a **Digital Twin** of a POSIX terminal, predicting STDOUT/STDERR with >98% accuracy.

**Built for Humanity. Refracted by Neural Prism.**
*Thanks to Google Gemini for the light.*
