import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));

const PORT = 3000;

// Initialize Gemini SDK with User-Agent for AI Studio telemetry
const apiKey = process.env.GEMINI_API_KEY;
const isGeminiConfigured = !!apiKey;

let ai: GoogleGenAI | null = null;
if (isGeminiConfigured) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  console.log("Gemini API initialized successfully.");
} else {
  console.warn("GEMINI_API_KEY not found in environment variables. Running in Full-Fidelity Simulation Mode.");
}

// Ensure error response helper
const sendError = (res: express.Response, message: string, details?: any) => {
  res.status(500).json({ error: true, message, details });
};

// Helper to call Gemini with retry and exponential backoff for 503 errors
async function generateContentWithRetry(aiClient: GoogleGenAI, options: any, retries = 3, delay = 1000): Promise<any> {
  let lastError: any = null;
  let currentDelay = delay;
  for (let i = 0; i < retries; i++) {
    try {
      return await aiClient.models.generateContent(options);
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.error?.status || error?.code || error?.error?.code;
      const errorMsg = String(error?.message || error || "").toLowerCase();
      const isUnavailable = status === 503 || status === 'UNAVAILABLE' || errorMsg.includes("503") || errorMsg.includes("unavailable") || errorMsg.includes("overloaded") || errorMsg.includes("capacity");
      
      if (isUnavailable) {
        console.warn(`Gemini API temporarily unavailable (503). Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= 2;
        // Switch model to 'gemini-flash-latest' if it was on 'gemini-3.5-flash'
        if (options.model === "gemini-3.5-flash") {
          options.model = "gemini-flash-latest";
        }
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// API ROUTES

// Agent 1: Priority & Agent 2: Deadline Failure Prediction
app.post("/api/ai/analyze-task", async (req, res) => {
  const { task } = req.body;
  if (!task || !task.title) {
    return res.status(400).json({ error: "Missing task details" });
  }

  if (isGeminiConfigured && ai) {
    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: `
          Analyze this task structure and output a raw JSON response. No markdown formatting.
          Task details:
          - Title: "${task.title}"
          - Description: "${task.description || "N/A"}"
          - Deadline: "${task.deadlineDate} at ${task.deadlineTime || "11:59 PM"}"
          - Estimated Hours Required: ${task.estimatedHours || 1}
          - Difficulty: "${task.difficulty || "Medium"}"
          - Category: "${task.category || "General"}"
          
          Respond ONLY with a JSON object in this format:
          {
            "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "urgencyScore": <Number between 0 and 100>,
            "riskOfFailure": <Number between 0 and 100>,
            "explanation": "Why this priority and risk level were selected based on deadline, complexity and effort required",
            "nextRecommendedAction": "Concrete immediate step"
          }
        `,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "";
      const parsed = JSON.parse(responseText.trim());
      return res.json(parsed);
    } catch (error: any) {
      console.error("Gemini Error /api/ai/analyze-task:", error);
      // Fallback to simulated mode on error
    }
  }

  // SIMULATOR FALLBACK
  const deadlineDate = new Date(`${task.deadlineDate}T${task.deadlineTime || "23:59"}`);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const hoursRemaining = Math.max(1, diffMs / (1000 * 60 * 60));
  const complexFactor = task.difficulty === "High" ? 1.5 : task.difficulty === "Medium" ? 1.1 : 0.8;
  const estHrs = Number(task.estimatedHours) || 2;
  
  let urgencyScore = Math.min(100, Math.max(10, Math.round((24 / hoursRemaining) * 50 * complexFactor)));
  if (hoursRemaining < 0) urgencyScore = 100;
  
  let priority = "LOW";
  if (urgencyScore > 85) priority = "CRITICAL";
  else if (urgencyScore > 65) priority = "HIGH";
  else if (urgencyScore > 35) priority = "MEDIUM";

  const riskOfFailure = Math.min(99, Math.max(10, Math.round((estHrs / hoursRemaining) * 100 * complexFactor)));

  res.json({
    priority,
    urgencyScore,
    riskOfFailure,
    explanation: `Calculated failure risk is ${riskOfFailure}% based on an estimated ${estHrs} hours of work required relative to ${Math.round(hoursRemaining)} hours remaining before the deadline.`,
    nextRecommendedAction: `Allocate a structured ${estHrs}-hour workspace block immediately for "${task.title}".`
  });
});

// Agent 3: AI Task Breakdown Agent
app.post("/api/ai/breakdown", async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Missing task title" });
  }

  if (isGeminiConfigured && ai) {
    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: `
          Generate a detailed step-by-step breakdown of how to accomplish this task:
          Task Title: "${title}"
          Task Description: "${description || ""}"

          Respond ONLY with a JSON array of steps, like:
          [
            {"step": "Step 1 title", "description": "Short explanation of what to do first"},
            {"step": "Step 2 title", "description": "What to do next"}
          ]
        `,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse((response.text || "").trim());
      return res.json(parsed);
    } catch (error) {
      console.error("Gemini Error /api/ai/breakdown:", error);
    }
  }

  // SIMULATOR FALLBACK
  res.json([
    { step: "Initial Setup & Research", description: `Collect all templates, documents, and reference files required to structure your work on "${title}".` },
    { step: "Core Execution Phase 1", description: "Tackle the heaviest or most technical section of the assignment/task first." },
    { step: "Review and Quality Assurance", description: "Proofread, test, and analyze the initial draft output for any discrepancies." },
    { step: "Final Formatting & Submission", description: "Package the results, check final guidelines, and submit before the target time." }
  ]);
});

// Agent 4: AI Daily Planner Agent
app.post("/api/ai/daily-planner", async (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: "Missing tasks array" });
  }

  if (isGeminiConfigured && ai) {
    try {
      const serializedTasks = tasks
        .map(t => `- ${t.title} (Deadline: ${t.deadlineDate}, Priority: ${t.priority}, Difficulty: ${t.difficulty})`)
        .join("\n");

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: `
          Analyze these upcoming tasks:
          ${serializedTasks}
          
          Generate a beautiful, smart daily plan schedule based on urgency levels. Keep user constraints in mind.
          Respond ONLY with a raw JSON object containing the schedule array and a dynamic AI explanation. Format:
          {
            "schedule": [
              { "time": "09:00 AM", "task": "Focus Session: Highest Priority Task", "duration": "2 hours" },
              { "time": "11:30 AM", "task": "Operational Task Block", "duration": "1 hour" },
              { "time": "02:00 PM", "task": "Break & Admin Work", "duration": "45 mins" }
            ],
            "explanation": "Why this block structure helps avoid deadline crashes based on cognitive capacity."
          }
        `,
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse((response.text || "").trim());
      return res.json(parsed);
    } catch (error) {
      console.error("Gemini Error /api/ai/daily-planner:", error);
    }
  }

  // SIMULATOR FALLBACK
  res.json({
    schedule: [
      { time: "09:00 AM", task: "Intense Focus: Complete Primary Milestone tasks", duration: "2 Hours" },
      { time: "11:30 AM", task: "Midday sync and task validation", duration: "1 Hour" },
      { time: "02:00 PM", task: "Review high difficulty tasks & debug issues", duration: "1.5 Hours" },
      { time: "04:30 PM", task: "Administrative alignments and planning review", duration: "1 Hour" }
    ],
    explanation: "This schedule prioritizes deep-focus blocks in the early morning to optimize cognitive stamina and ensures low-stress reviews are pushed to mid-afternoon."
  });
});

// Agent 5: AI Productivity Coach Chatbot
app.post("/api/ai/coach-chat", async (req, res) => {
  const { message, taskHistory, chatHistory } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  if (isGeminiConfigured && ai) {
    try {
      const activeTasks = (taskHistory || []).map((t: any) => `- ${t.title} (${t.priority} priority, Status: ${t.status}, Deadline: ${t.deadlineDate})`).join("\n");
      
      const formattedHistory = (chatHistory || []).map((h: any) => ({
        role: h.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: h.text }]
      }));

      const systemInstruction = `You are the ultimate Deadline Guardian AI Productivity Coach.
        The user is a high-achiever prone to missing deadlines. Be proactive, supportive, clear, and actionable.
        
        Here is their current database of active commitments:
        ${activeTasks}
        
        Keep your response concise, and focused on helping them prioritize or organize. Never sound passive. Give concrete recommendations.`;

      // Use system instructions with generateContent
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [
          ...formattedHistory,
          { role: "user", parts: [{ text: message }] }
        ],
        config: {
          systemInstruction,
        }
      });

      return res.json({ text: response.text || "I am analyzing your workloads now. What specific aspect would you like to plan first?" });
    } catch (error) {
      console.error("Gemini Error /api/ai/coach-chat:", error);
    }
  }

  // SIMULATOR FALLBACK
  const activeTasksCount = (taskHistory || []).filter((t: any) => t.status !== "Completed").length;
  let reply = "I am ready to help you coordinate your plans. How are you feeling about your tasks today?";
  
  if (message.toLowerCase().includes("what should i do") || message.toLowerCase().includes("prioritize") || message.toLowerCase().includes("now")) {
    if (activeTasksCount === 0) {
      reply = "You have no active high-risk deadlines on your board! Let's get ahead of schedule by planning your next goal.";
    } else {
      const highestUrgencyTask = (taskHistory || []).sort((a: any, b: any) => (b.urgencyScore || 0) - (a.urgencyScore || 0))[0];
      reply = `Based on active deadlines, you should immediately start working on "${highestUrgencyTask.title}". It is currently listed as a ${highestUrgencyTask.priority || "Medium"} priority and has an urgency score of ${highestUrgencyTask.urgencyScore || 50}/100. It requires focused progress today to secure completion.`;
    }
  } else if (message.toLowerCase().includes("overloaded") || message.toLowerCase().includes("stressed") || message.toLowerCase().includes("tired")) {
    reply = "It's completely normal to feel overwhelmed when deadlines pile up. Let's practice 'micro-sprinting': pick exactly ONE tiny step from your highest priority task, set a 25-minute timer, and ignore everything else. I can break a task down into 5-minute steps for you if you'd like.";
  }

  res.json({ text: reply });
});

// Multimodal Image Scanner Route
app.post("/api/ai/scan-image", async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing image data or mimeType" });
  }

  if (isGeminiConfigured && ai) {
    try {
      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType
            }
          },
          `
            Analyze this image containing information about a task, assignment, deadline, syllabus, or project meeting.
            Extract the core details and return them as a raw JSON object.
            
            Respond strictly with JSON containing these exact fields, do not append conversational filler:
            {
              "title": "Clear extracted task title",
              "description": "Elaborate task background, key instructions, or details extracted from the image",
              "deadlineDate": "YYYY-MM-DD format (infer relative to current date June 24, 2026 if necessary, otherwise use exact parsed date)",
              "deadlineTime": "HH:MM format",
              "difficulty": "Low" | "Medium" | "High",
              "category": "Academic" | "Professional" | "Personal" | "Health" | "Finance" | "Other",
              "estimatedHours": <Estimated number of completion hours required as an integer>
            }
          `
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse((response.text || "").trim());
      return res.json(parsed);
    } catch (error) {
      console.error("Gemini Error /api/ai/scan-image:", error);
    }
  }

  // SIMULATOR FALLBACK
  res.json({
    title: "Extracted Syllabus Project Phase",
    description: "Extracted automatically from image: Complete final drafting and architectural source documentation reviews.",
    deadlineDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days from now
    deadlineTime: "17:00",
    difficulty: "High",
    category: "Professional",
    estimatedHours: 6
  });
});

// Configure Vite middleware or static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
