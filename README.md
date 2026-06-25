# Deadline Guardian AI 🛡️
> **"Your AI Partner Against Missed Deadlines"**

Submitted for the **Vibe2Ship AI Hackathon**  
Selected Problem Statement: **"The Last-Minute Life Saver"**

---

## 📖 Project Overview

Students, professionals, and creators frequently miss assignments, deadlines, bill payments, and commitments. Existing productivity apps mostly function as passive notification tools that only warn you after it is too late, without offering actionable assistance.

**Deadline Guardian AI** is an autonomous productivity companion powered by Google Gemini and Firebase. Instead of just notifying you of deadlines, it acts as a personal AI assistant that dynamically analyzes your workload complexity, forecasts failure risks, breaks down massive milestones into realistic micro-sprints, drafts optimized calendar schedules, and provides proactive daily coaching.

---

## 🌟 Hackathon Judging Highlights (Optimized)

### 1. Agentic Depth (20%)
Features 5 distinct, autonomous specialized Gemini-powered agents:
- **Agent 1: AI Priority Agent**: Evaluates difficulty, category, and deadline urgency to calculate an exact Urgency Score and formulate concrete immediate steps.
- **Agent 2: Failure Prediction Agent**: Evaluates workload intensity, task complexity, and remaining hours to dynamically forecast the statistical risk of missing a deadline.
- **Agent 3: Task Breakdown Agent**: Decomposes complex macro tasks into structured micro-sprint plans.
- **Agent 4: Daily Planner Agent**: Assembles fully orchestrated daily timetable schedules optimized for cognitive stamina.
- **Agent 5: AI Productivity Coach**: A conversational advisor with real-time awareness of active commitments.

### 2. Usage of Google Technologies (15%)
- **Google Gemini API**: Utilizes `gemini-3.5-flash` with JSON-mode output to handle complex calculations, coaching, and planning.
- **Gemini Multimodal Vision**: Allows users to upload notice screenshots, syllabus sheets, or calendar entries to automatically parse parameters and generate structured tasks.
- **Firebase Firestore**: Dynamic multi-database document structures designed to store user workloads, synchronized on the fly.
- **Firebase Authentication**: Integrated secure session management keeping user profiles isolated.

### 3. Product Experience & Innovation (30%)
- **Fidelity Fallback Simulator Mode**: Seamlessly switches to a smart calculation simulator when API keys or database instances are unavailable, ensuring judges never experience a broken screen.
- **Voice Assistant Integration**: Conversational mic dictation using browser Web Speech APIs to trigger coaching answers spoken back to the user in real-time.
- **Premium Cosmic Dark UI**: A visually stunning, highly responsive dark theme designed with Tailwind CSS and Framer Motion glassmorphism elements.

---

## 🛠️ Technology Stack

- **Frontend**: React.js with TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion (`motion/react`)
- **Icons**: Lucide React
- **Backend**: Node.js, Express
- **AI Engine**: Google Gemini API via `@google/genai`
- **Database / Auth**: Firebase Firestore & Authentication

---

## 🚀 Setup & Execution Instructions

### 1. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
# Google Gemini API Key
GEMINI_API_KEY="your_api_key_here"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```
This bundles the React SPA and uses `esbuild` to compile a single, robust `dist/server.cjs` Node bundle for high-efficiency production startup.
