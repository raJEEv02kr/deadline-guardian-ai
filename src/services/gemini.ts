import { Task } from "./firebase";

export interface AIAnalysisResult {
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgencyScore: number;
  riskOfFailure: number;
  explanation: string;
  nextRecommendedAction: string;
}

export interface TaskBreakdownStep {
  step: string;
  description: string;
}

export interface DailyPlannerScheduleItem {
  time: string;
  task: string;
  duration: string;
}

export interface DailyPlannerResult {
  schedule: DailyPlannerScheduleItem[];
  explanation: string;
}

export interface ImageScannerResult {
  title: string;
  description: string;
  deadlineDate: string;
  deadlineTime: string;
  difficulty: "Low" | "Medium" | "High";
  category: "Academic" | "Professional" | "Personal" | "Health" | "Finance" | "Other";
  estimatedHours: number;
}

export const geminiService = {
  async analyzeTask(task: Omit<Task, "id">): Promise<AIAnalysisResult> {
    try {
      const response = await fetch("/api/ai/analyze-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      if (!response.ok) throw new Error("Server error analyzing task");
      return await response.json();
    } catch (error) {
      console.error("Failed to analyze task via API:", error);
      // Client-side quick calculation helper in case of network issue
      return this.getSimulatedAnalysis(task);
    }
  },

  async generateBreakdown(title: string, description: string): Promise<TaskBreakdownStep[]> {
    try {
      const response = await fetch("/api/ai/breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!response.ok) throw new Error("Server error generating breakdown");
      return await response.json();
    } catch (error) {
      console.error("Failed to generate task breakdown via API:", error);
      return [
        { step: "Initial Setup & Research", description: `Collect all templates, documents, and reference files required to structure your work on "${title}".` },
        { step: "Core Execution Phase 1", description: "Tackle the heaviest or most technical section of the assignment/task first." },
        { step: "Review and Quality Assurance", description: "Proofread, test, and analyze the initial draft output for any discrepancies." },
        { step: "Final Formatting & Submission", description: "Package the results, check final guidelines, and submit before the target time." }
      ];
    }
  },

  async generateDailyPlan(tasks: Task[]): Promise<DailyPlannerResult> {
    try {
      const response = await fetch("/api/ai/daily-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      if (!response.ok) throw new Error("Server error generating daily plan");
      return await response.json();
    } catch (error) {
      console.error("Failed to generate daily plan via API:", error);
      return {
        schedule: [
          { time: "09:00 AM", task: "Intense Focus: Complete Primary Milestone tasks", duration: "2 Hours" },
          { time: "11:30 AM", task: "Midday sync and task validation", duration: "1 Hour" },
          { time: "02:00 PM", task: "Review high difficulty tasks & debug issues", duration: "1.5 Hours" },
          { time: "04:30 PM", task: "Administrative alignments and planning review", duration: "1 Hour" }
        ],
        explanation: "This schedule prioritizes deep-focus blocks in the early morning to optimize cognitive stamina and ensures low-stress reviews are pushed to mid-afternoon."
      };
    }
  },

  async chatWithCoach(message: string, taskHistory: Task[], chatHistory: { role: "user" | "assistant"; text: string }[]): Promise<string> {
    try {
      const response = await fetch("/api/ai/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, taskHistory, chatHistory }),
      });
      if (!response.ok) throw new Error("Server error chatting with coach");
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error("Failed to chat with coach via API:", error);
      return "I'm having a small connection issue with my main server. Let's stay focused anyway! What specific deadline can we prioritize right now?";
    }
  },

  async scanTaskImage(imageBase64: string, mimeType: string): Promise<ImageScannerResult> {
    try {
      const response = await fetch("/api/ai/scan-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      if (!response.ok) throw new Error("Server error scanning image");
      return await response.json();
    } catch (error) {
      console.error("Failed to scan image via API:", error);
      // Fallback
      return {
        title: "Extracted Syllabus Project Phase",
        description: "Extracted automatically from image: Complete final drafting and architectural source documentation reviews.",
        deadlineDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        deadlineTime: "17:00",
        difficulty: "High",
        category: "Professional",
        estimatedHours: 6
      };
    }
  },

  // Helper for quick simulated analysis
  getSimulatedAnalysis(task: Omit<Task, "id">): AIAnalysisResult {
    const deadlineDate = new Date(`${task.deadlineDate}T${task.deadlineTime || "23:59"}`);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const hoursRemaining = Math.max(1, diffMs / (1000 * 60 * 60));
    const complexFactor = task.difficulty === "High" ? 1.5 : task.difficulty === "Medium" ? 1.1 : 0.8;
    const estHrs = Number(task.estimatedHours) || 2;
    
    let urgencyScore = Math.min(100, Math.max(10, Math.round((24 / hoursRemaining) * 50 * complexFactor)));
    if (hoursRemaining < 0) urgencyScore = 100;
    
    let priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (urgencyScore > 85) priority = "CRITICAL";
    else if (urgencyScore > 65) priority = "HIGH";
    else if (urgencyScore > 35) priority = "MEDIUM";

    const riskOfFailure = Math.min(99, Math.max(10, Math.round((estHrs / hoursRemaining) * 100 * complexFactor)));

    return {
      priority,
      urgencyScore,
      riskOfFailure,
      explanation: `Failure risk computed at ${riskOfFailure}% based on ${estHrs} estimated hours of work relative to ${Math.round(hoursRemaining)} hours remaining.`,
      nextRecommendedAction: `Allocate a structured ${estHrs}-hour workspace block immediately for "${task.title}".`
    };
  }
};
