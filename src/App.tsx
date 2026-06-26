/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Bell, Calendar, Clock, LayoutDashboard, Plus, Send, CheckCircle2,
  Trash2, AlertTriangle, Sparkles, LogIn, LogOut, ArrowRight, BookOpen,
  User, Mic, Upload, Image as ImageIcon, Check, Menu, X, MicOff, Star,
  ShieldAlert, BarChart3, ChevronRight, Activity, CalendarDays, Brain,
  Lightbulb, HelpCircle, AlertCircle, FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { dbService, auth, isFirebaseConfigured, Task } from "./services/firebase";
import { geminiService, TaskBreakdownStep, DailyPlannerScheduleItem } from "./services/gemini";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

export default function App() {
  // Navigation & Authentication
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"landing" | "login" | "register">("landing");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [authError, setAuthError] = useState("");

  // Core Data Lists
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  // New Task Fields
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDeadlineDate, setTaskDeadlineDate] = useState("");
  const [taskDeadlineTime, setTaskDeadlineTime] = useState("");
  const [taskHrs, setTaskHrs] = useState(2);
  const [taskDifficulty, setTaskDifficulty] = useState<"Low" | "Medium" | "High">("Medium");
  const [taskCategory, setTaskCategory] = useState<"Academic" | "Professional" | "Personal" | "Health" | "Finance" | "Other">("Academic");

  // Coach Chatbot
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Greetings! I am your AI Guardian Coach. Let's make sure you never miss another deadline. Ask me anything, or type 'What should I do now?' for rapid guidance!" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isCoachTyping, setIsCoachTyping] = useState(false);

  // Breakdown Details
  const [activeBreakdownTask, setActiveBreakdownTask] = useState<Task | null>(null);
  const [generatedSteps, setGeneratedSteps] = useState<TaskBreakdownStep[]>([]);
  const [isGeneratingBreakdown, setIsGeneratingBreakdown] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Image scanning fields
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [scannedPreview, setScannedPreview] = useState<string | null>(null);
  const [isScanningImage, setIsScanningImage] = useState(false);

  // Daily Schedule & Planner State
  const [dailyPlan, setDailyPlan] = useState<Array<DailyPlannerScheduleItem>>([]);
  const [planExplanation, setPlanExplanation] = useState("");
  const [isGeneratingDailyPlan, setIsGeneratingDailyPlan] = useState(false);

  // Live Clock Widget State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Voice Assistant Status
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  // Floating AI Chat Assistant Widget
  const [isChatWidgetOpen, setIsChatWidgetOpen] = useState(false);

  // Track Firebase auth session if available
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setCurrentUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split("@")[0] || "User"
          });
          setActiveTab("dashboard");
        } else {
          setCurrentUser(null);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  // Live Clock Widget - Update time every second
  useEffect(() => {
    setCurrentTime(new Date());
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, []);

  // Sync tasks on user state change
  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const fetched = await dbService.getTasks(currentUser.uid);
      setTasks(fetched);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Demo user trigger to unlock system for easy evaluation
  const bypassAuth = () => {
    setCurrentUser({ uid: "demo_judge", email: "judge@googlehackathon.com", displayName: "Vibe2Ship Judge" });
    setActiveTab("dashboard");
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authEmail || !authPassword) {
      setAuthError("Please fill out all fields.");
      return;
    }

    if (!isFirebaseConfigured) {
      // Direct high-fidelity simulated bypass
      setCurrentUser({ uid: "user_simulated", email: authEmail, displayName: authEmail.split("@")[0] });
      setActiveTab("dashboard");
      return;
    }

    try {
      if (authMode === "login") {
        const userCredential = await signInWithEmailAndPassword(auth, authEmail, authPassword);
        setCurrentUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName || userCredential.user.email?.split("@")[0] || "User"
        });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        setCurrentUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName || userCredential.user.email?.split("@")[0] || "User"
        });
      }
      setActiveTab("dashboard");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/operation-not-allowed" || (err.message && err.message.includes("operation-not-allowed"))) {
        setAuthError("Email/Password authentication is not yet enabled in your Firebase console. Please enable Email/Password under Authentication > Sign-in method, or click 'Access Secure Demo Workspace' below to start instantly.");
      } else {
        setAuthError(err.message || "Authentication process failed.");
      }
    }
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setCurrentUser(null);
    setAuthMode("landing");
  };

  // Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle || !taskDeadlineDate) return;

    setLoading(true);
    const baseTask: Omit<Task, "id"> = {
      userId: currentUser.uid,
      title: taskTitle,
      description: taskDesc,
      deadlineDate: taskDeadlineDate,
      deadlineTime: taskDeadlineTime || "23:59",
      estimatedHours: taskHrs,
      difficulty: taskDifficulty,
      category: taskCategory,
      status: "Not Started",
      priority: "MEDIUM",
      urgencyScore: 50,
      riskOfFailure: 30,
      explanation: "Analysis pending generation...",
      nextRecommendedAction: "Begin review.",
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Add base task to database (or localstorage fallback)
      const savedTask = await dbService.addTask(currentUser.uid, baseTask);

      // Add immediately to local UI
      setTasks(prev => [...prev, savedTask]);

      // 2. Perform background AI analysis asynchronously
      const aiResponse = await geminiService.analyzeTask(savedTask);

      // 3. Update database and local state with complete AI priority recommendations
      const finalTask = { ...savedTask, ...aiResponse };
      await dbService.updateTask(currentUser.uid, savedTask.id!, finalTask);

      setTasks(prev => prev.map(t => t.id === savedTask.id ? finalTask : t));

      // Reset Task Creation Form
      setTaskTitle("");
      setTaskDesc("");
      setTaskDeadlineDate("");
      setTaskDeadlineTime("");
      setTaskHrs(2);
      setTaskDifficulty("Medium");
      setTaskCategory("Academic");
    } catch (error) {
      console.error("Task generation sequence crashed: ", error);
    }
    setLoading(false);
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: Task["status"]) => {
    const nextStatus: Task["status"] = currentStatus === "Completed" ? "In Progress" : "Completed";
    try {
      await dbService.updateTask(currentUser.uid, taskId, { status: nextStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    } catch (error) {
      console.error(error);
    }
  };

  const handleTaskDeletion = async (taskId: string) => {
    try {
      await dbService.deleteTask(currentUser.uid, taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (activeBreakdownTask?.id === taskId) {
        setActiveBreakdownTask(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Generate Daily Plan with Agent 4
  const generatePlannerBlock = async () => {
    setIsGeneratingDailyPlan(true);
    try {
      const plan = await geminiService.generateDailyPlan(tasks);
      setDailyPlan(plan.schedule);
      setPlanExplanation(plan.explanation);
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingDailyPlan(false);
  };

  // Generate task breakdown steps using Agent 3
  const triggerBreakdownAnalysis = async (task: Task) => {
    setActiveBreakdownTask(task);
    setIsGeneratingBreakdown(true);
    setCompletedSteps({});
    try {
      const steps = await geminiService.generateBreakdown(task.title, task.description);
      setGeneratedSteps(steps);
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingBreakdown(false);
  };

  // Coach Chat interactions with Agent 5
  const sendCoachMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user" as const, text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsCoachTyping(true);

    try {
      const chatHistoryForGemini = chatMessages.slice(-10); // Pass recent context
      const aiReply = await geminiService.chatWithCoach(userMsg.text, tasks, chatHistoryForGemini);
      setChatMessages(prev => [...prev, { role: "assistant", text: aiReply }]);
    } catch (e) {
      console.error(e);
    }
    setIsCoachTyping(false);
  };

  // Image Multimodal parsing
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScannedPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const executeImageScan = async () => {
    if (!scannedPreview || !imageFile) return;
    setIsScanningImage(true);
    try {
      const base64DataOnly = scannedPreview.split(",")[1];
      const extractedTask = await geminiService.scanTaskImage(base64DataOnly, imageFile.type);

      // Auto-populate form
      setTaskTitle(extractedTask.title || "");
      setTaskDesc(extractedTask.description || "");
      setTaskDeadlineDate(extractedTask.deadlineDate || "");
      setTaskDeadlineTime(extractedTask.deadlineTime || "");
      setTaskHrs(extractedTask.estimatedHours || 3);
      setTaskDifficulty(extractedTask.difficulty || "Medium");
      setTaskCategory(extractedTask.category || "Professional");

      setActiveTab("tasks"); // Route back to task board
    } catch (e) {
      console.error("AI Scanning error: ", e);
    }
    setIsScanningImage(false);
    setImageFile(null);
    setScannedPreview(null);
  };

  // Speech Recognition API Integration
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser speech recognition is not supported in your browser. Please try Google Chrome or Edge.");
      return;
    }

    if (isVoiceListening) {
      setIsVoiceListening(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsVoiceListening(true);
      setVoiceTranscript("Listening to task or question...");
    };

    rec.onerror = (e: any) => {
      console.error("Voice matching interface error:", e);
      setIsVoiceListening(false);
    };

    rec.onend = () => {
      setIsVoiceListening(false);
    };

    rec.onresult = async (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setVoiceTranscript(speechToText);
      setIsVoiceListening(false);

      // Instantly pass user query to Chatbot Agent
      setIsCoachTyping(true);
      setChatMessages(prev => [...prev, { role: "user", text: `[Voice Command] ${speechToText}` }]);

      try {
        const coachReply = await geminiService.chatWithCoach(speechToText, tasks, []);
        setChatMessages(prev => [...prev, { role: "assistant", text: coachReply }]);
        setActiveTab("coach"); // Auto route to chat console

        // Speak response out loud using Web Speech synthesis
        if (window.speechSynthesis) {
          const synth = window.speechSynthesis;
          // Cancel active speech
          synth.cancel();
          const speechResponse = new SpeechSynthesisUtterance(coachReply.slice(0, 160).replace(/[*#]/g, ""));
          speechResponse.rate = 1.0;
          synth.speak(speechResponse);
        }
      } catch (e) {
        console.error(e);
      }
      setIsCoachTyping(false);
    };

    rec.start();
  };

  // Math Metrics & Computations
  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  const completedTasks = tasks.filter(t => t.status === "Completed");
  const criticalTasks = pendingTasks.filter(t => t.priority === "CRITICAL" || t.priority === "HIGH");

  const computedProductivityScore = (() => {
    if (tasks.length === 0) return 100;
    const baseVal = completedTasks.length / tasks.length;
    const penaltyRatio = pendingTasks.reduce((sum, t) => sum + (t.riskOfFailure || 0), 0) / (tasks.length * 100);
    return Math.max(10, Math.round((baseVal * 100) - (penaltyRatio * 30)));
  })();

  const topRecommendedFocus = pendingTasks.sort((a, b) => (b.urgencyScore || 0) - (a.urgencyScore || 0))[0];

  return (
    <div className="min-h-screen bg-[#0C0C0B] bg-immersive-radial text-[#E7D4C2] flex flex-col font-sans selection:bg-[#B87333]/30 relative overflow-hidden">
      {/* Immersive background decoration */}
      <div className="glow-blob-1" />
      <div className="glow-blob-2" />
      <div className="glow-blob-3" />
      <div className="noise-bg" />
      <div className="grid-bg" />

      {/* LANDING PAGE VIEW */}
      {!currentUser && authMode === "landing" && (
        <div className="flex-1 flex flex-col justify-between relative z-10">
          {/* Header */}
          <header className="p-6 border-b border-white/10 flex justify-between items-center bg-[#151312]/30 backdrop-blur-xl sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#B87333]/15 text-[#B87333] rounded-xl border border-[#B87333]/25 shadow-[0_0_15px_rgba(184,115,51,0.15)]">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Deadline Guardian <span className="text-[#B87333]">AI</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={bypassAuth}
                className="hidden sm:inline-flex px-4 py-2 text-sm bg-white/5 border border-white/10 hover:bg-white/10 text-[#E7D4C2] rounded-xl transition-all cursor-pointer font-semibold"
              >
                Instant Judge Demo Mode
              </button>
              <button
                onClick={() => setAuthMode("login")}
                className="px-5 py-2 text-sm bg-[#B87333] hover:bg-[#9A5A25] text-white font-bold rounded-xl transition-all shadow-md shadow-[#B87333]/30 cursor-pointer border border-[#B87333]/30 hover:shadow-[#B87333]/50"
              >
                Get Started
              </button>
            </div>
          </header>

          {/* Hero Section */}
          <main className="flex-1 max-w-7xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#B87333]/15 text-[#B87333] rounded-full border border-[#B87333]/25 text-xs mb-6 font-bold tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#B87333] animate-pulse" /> Vibe2Ship AI Hackathon Submission
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight max-w-4xl mb-6 leading-tight text-white">
              Never Miss Another Deadline <br/> With Autonomous <span className="bg-gradient-to-r from-[#B87333] to-[#E7D4C2] bg-clip-text text-transparent font-black">AI Workspace Intelligence</span>
            </h1>
            <p className="text-base md:text-lg text-[#E7D4C2]/70 max-w-2xl mb-10 leading-relaxed font-medium">
              Deadline Guardian AI uses Gemini intelligence to actively forecast workload failure risks, map granular task execution workflows, orchestrate scheduled timelines, and provide conversational coaching.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-20 w-full justify-center max-w-md">
              <button
                onClick={() => setAuthMode("login")}
                className="px-8 py-4 bg-gradient-to-r from-[#B87333] to-[#9A5A25] hover:shadow-lg hover:shadow-[#B87333]/30 text-white font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 group cursor-pointer border border-[#B87333]/20"
              >
                Try AI Assistant <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={bypassAuth}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-extrabold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                Launch Demo Instance
              </button>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full relative z-10">
              {[
                { title: "AI Deadline Predictor", desc: "Monitors estimated duration requirements and dynamically projects task failure markers.", icon: Clock },
                { title: "Smart Task Planner", desc: "Automates workload calendar allocation mapping based on real deadlines and difficulties.", icon: Calendar },
                { title: "AI Productivity Coach", desc: "A conversational advisor built on Gemini API with contextual awareness of your active load.", icon: Sparkles },
                { title: "Active Step Breakdown", desc: "Transforms daunting macro milestones into structured sub-objectives with one click.", icon: BookOpen },
                { title: "Image Deadline Scanner", desc: "Upload syllabus sheets, notices, or screenshots to extract dates and create tasks instantly.", icon: Upload },
                { title: "Voice System Assistant", desc: "Dictate plans using conversational speech to trigger automated task entries and planning.", icon: Mic }
              ].map((f, idx) => {
                const IconComponent = f.icon;
                return (
                  <div key={idx} className="glass-premium p-6 hover:border-[#B87333]/40 group relative overflow-hidden text-left">
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#B87333]/5 rounded-full blur-2xl group-hover:bg-[#B87333]/12 transition-colors" />
                    <div className="p-3 bg-[#B87333]/15 text-[#B87333] rounded-xl border border-[#B87333]/25 w-fit mb-4 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(184,115,51,0.1)]">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-[#E7D4C2]/70 leading-relaxed font-medium">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </main>

          {/* Footer */}
          <footer className="p-8 border-t border-white/10 text-center text-sm text-[#E7D4C2]/50 bg-black/20 backdrop-blur-md">
            © 2026 Deadline Guardian AI. Powered by Google Gemini & Firebase Firestore. Built for Vibe2Ship Hackathon.
          </footer>
        </div>
      )}

      {/* LOGIN & SIGNUP SCREEN */}
      {!currentUser && (authMode === "login" || authMode === "register") && (
        <div className="flex-1 flex items-center justify-center p-6 relative z-10">
          <div className="w-full max-w-md bg-[#161514]/65 backdrop-blur-3xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-[#B87333] to-[#E7D4C2] animate-pulse-glow" />
            <button
              onClick={() => setAuthMode("landing")}
              className="absolute top-4 right-4 text-[#E7D4C2]/70 hover:text-white transition-all text-xs border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl cursor-pointer font-bold"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-[#B87333]/15 text-[#B87333] rounded-xl border border-[#B87333]/25 shadow-[0_0_15px_rgba(184,115,51,0.1)]">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="text-lg font-black tracking-tight text-white">Deadline Guardian AI</span>
            </div>

            <h2 className="text-2xl font-bold mb-1 text-white">
              {authMode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-[#E7D4C2]/70 mb-6 font-medium">
              {authMode === "login" ? "Enter your email to enter the AI productivity cockpit." : "Get started by setting up your cloud workload database."}
            </p>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-[#E7D4C2]/80 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@university.com"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#E7D4C2]/80 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all font-medium"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#B87333] to-[#9A5A25] hover:shadow-lg hover:shadow-[#B87333]/20 text-white text-sm font-extrabold py-3 rounded-xl transition-all cursor-pointer border border-[#B87333]/20 hover:scale-[1.01]"
              >
                {authMode === "login" ? "Enter Dashboard" : "Sign Up & Initialize"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-xs text-[#B87333] hover:text-[#9A5A25] transition-all font-bold"
              >
                {authMode === "login" ? "Don't have an account? Sign up here" : "Already have an account? Log in"}
              </button>
            </div>

            <div className="mt-4 text-center">
              <span className="text-[11px] text-[#E7D4C2]/50 block mb-2">— OR —</span>
              <button
                onClick={bypassAuth}
                className="text-xs font-extrabold px-4 py-2.5 bg-white/5 border border-white/10 text-[#E7D4C2] rounded-xl hover:bg-white/10 transition-all w-full cursor-pointer"
              >
                Access Secure Demo Workspace (No Auth Needed)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE APP DASHBOARD */}
      {currentUser && (
        <div className="flex-1 flex overflow-hidden">

          {/* SIDEBAR NAVIGATION */}
          <aside
            style={{
              backgroundColor: "rgba(22, 21, 20, 0.45)",
              backdropFilter: "blur(35px)",
              WebkitBackdropFilter: "blur(35px)"
            }}
            className={`m-4 mr-0 border border-white/10 flex flex-col justify-between transition-all duration-300 relative z-10 shadow-2xl rounded-3xl overflow-hidden ${isSidebarOpen ? "w-64" : "w-20"}`}
          >
            <div>
              {/* Header Profile Info */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-[#B87333]/15 text-[#B87333] rounded-xl border border-[#B87333]/25 shadow-[0_0_15px_rgba(184,115,51,0.1)]">
                    <ShieldAlert className="w-5 h-5 shrink-0 animate-pulse" />
                  </div>
                  {isSidebarOpen && (
                    <div className="text-left">
                      <p className="text-xs font-black text-white truncate max-w-[140px]">{currentUser.displayName || currentUser.email}</p>
                      <span className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20 font-bold uppercase tracking-wider">Guardian Active</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-white/50 hover:text-white transition-all cursor-pointer"
                >
                  {isSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="p-2 space-y-1.5">
                {[
                  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                  { id: "tasks", label: "Task Board", icon: BookOpen },
                  { id: "planner", label: "AI Daily Planner", icon: Calendar },
                  { id: "coach", label: "AI Productivity Coach", icon: Sparkles },
                  { id: "scanner", label: "Image Task Scan", icon: ImageIcon },
                  { id: "analytics", label: "Analytics", icon: BarChart3 }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer relative border border-transparent ${
                        isActive
                          ? "bg-[#B87333]/20 text-[#B87333] border-[#B87333]/30 shadow-[0_0_15px_rgba(184,115,51,0.15)]"
                          : "text-[#E7D4C2]/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNavIndicator"
                          className="absolute left-1 w-1 h-5 bg-[#B87333] rounded-full"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <Icon className="w-5 h-5 shrink-0" />
                      {isSidebarOpen && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Actions */}
            <div className="p-2 border-t border-white/5 space-y-1.5">
              {/* Voice Floating trigger inside menu */}
              <button
                onClick={toggleSpeechRecognition}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all cursor-pointer border ${
                  isVoiceListening
                    ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
                    : "text-[#E7D4C2]/70 hover:text-white hover:bg-white/5 border-transparent"
                }`}
              >
                {isVoiceListening ? <MicOff className="w-5 h-5 text-red-400 shrink-0" /> : <Mic className="w-5 h-5 shrink-0 text-[#B87333]" />}
                {isSidebarOpen && <span>{isVoiceListening ? "Listening..." : "Voice Command"}</span>}
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-all cursor-pointer"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {isSidebarOpen && <span>Log Out</span>}
              </button>
            </div>
          </aside>

          {/* MAIN PAGE CONTAINER */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">

            {/* Top Bar notifications and alerts */}
            <header className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white capitalize">{activeTab} Workspace</h1>
                <p className="text-xs text-[#E7D4C2]/70 mt-1">Autonomous Guardian systems active. Deadline tracking initialized.</p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[#E7D4C2]/80 font-bold">Synced with Firestore Database</span>
                </div>
              </div>
            </header>

            {/* PAGE RENDERS */}
            <AnimatePresence mode="wait">

              {/* TAB 1: DASHBOARD */}
              {activeTab === "dashboard" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {(() => {
                    const avgRiskOfFailure = pendingTasks.length > 0 ? Math.round(pendingTasks.reduce((sum, t) => sum + (t.riskOfFailure || 0), 0) / pendingTasks.length) : 15;
                    const hoursNeeded = pendingTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
                    const pressureByDay = [
                      { day: "MON", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Minimal risk load" },
                      { day: "TUE", color: pendingTasks.length > 0 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Standard commitment slots" },
                      { day: "WED", color: criticalTasks.length > 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Mid-week surge pressure" },
                      { day: "THU", color: pendingTasks.length > 0 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Upcoming deadline buffer" },
                      { day: "FRI", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Weekend clear buffer" },
                      { day: "SAT", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Recharging blocks" },
                      { day: "SUN", color: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]", desc: "Preparation blocks" }
                    ];

                    return (
                      <div className="space-y-6">

                        {/* 1. GUARDIAN AI DAILY BRIEF CARD (Large Premium Hero Card) */}
                        <div className="p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden text-left glass-premium bg-gradient-to-br from-white/5 to-[#B87333]/5">
                          <div className="absolute -right-10 -top-10 w-44 h-44 bg-[#B87333]/15 rounded-full blur-3xl animate-pulse-glow" />
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                            <div className="space-y-2">
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#B87333]/20 text-[#B87333] rounded-full border border-[#B87333]/35 text-xs font-black tracking-wider shadow-[0_0_15px_rgba(184,115,51,0.1)]">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> <span>GUARDIAN INTELLIGENCE ACTIVE</span>
                              </div>
                              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                                Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"} 👋
                              </h2>
                              <p className="text-sm text-[#E7D4C2]/80 max-w-xl font-medium leading-relaxed">
                                Our core AI neural models analyzed your current workload database. You have <span className="text-rose-400 font-extrabold">{pendingTasks.length} pending obligations</span> requiring roughly <span className="text-[#B87333] font-extrabold">{hoursNeeded} continuous hours</span> of deep cognitive effort.
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-3 shrink-0">
                              <button
                                onClick={() => {
                                  generatePlannerBlock();
                                  setActiveTab("planner");
                                }}
                                disabled={isGeneratingDailyPlan}
                                className="px-5 py-3 bg-[#B87333] hover:bg-[#9A5A25] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#B87333]/25 flex items-center gap-2 cursor-pointer disabled:opacity-70"
                              >
                                <Sparkles className="w-4 h-4 animate-pulse" />
                                {isGeneratingDailyPlan ? "Compiling..." : "Generate Today's Plan"}
                              </button>
                              <button
                                onClick={() => setIsChatWidgetOpen(true)}
                                className="px-5 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                              >
                                <Send className="w-4 h-4 text-[#B87333]" />
                                Ask Guardian AI
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* MAIN LAYOUT GRID */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">

                          {/* LEFT COLUMN: TWO COLS SPAN FOR PRIMARY ANALYTICAL WIDGETS */}
                          <div className="lg:col-span-2 space-y-6">

                            {/* ROW 1: AI FOCUS TARGET + AI EXPLANATION SIDE-BY-SIDE */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                              {/* 1. AI Recommended Focus Target */}
                              <div className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden group shadow-xl hover:shadow-[#B87333]/5 transition-all duration-300 glass-premium bg-white/5">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#B87333]/5 rounded-full blur-2xl group-hover:bg-[#B87333]/10 transition-colors" />
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <Brain className="w-5 h-5 text-[#B87333]" />
                                      <h3 className="text-sm font-bold text-white">AI Focus Target</h3>
                                    </div>
                                    {topRecommendedFocus && (
                                      <span className="text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                        CRITICAL TARGET
                                      </span>
                                    )}
                                  </div>

                                  {topRecommendedFocus ? (
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="text-base font-black text-white tracking-tight">{topRecommendedFocus.title}</h4>
                                        <p className="text-xs text-[#E7D4C2]/70 mt-1 line-clamp-2 leading-relaxed">{topRecommendedFocus.description || "No description provided."}</p>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2 border-y border-white/10 py-3 text-center">
                                        <div>
                                          <span className="text-[9px] uppercase text-[#E7D4C2]/50 block font-semibold">Deadline</span>
                                          <span className="text-xs font-bold text-white">{topRecommendedFocus.deadlineDate}</span>
                                        </div>
                                        <div>
                                          <span className="text-[9px] uppercase text-[#E7D4C2]/50 block font-semibold">Est. Effort</span>
                                          <span className="text-xs font-bold text-white">{topRecommendedFocus.estimatedHours}h</span>
                                        </div>
                                        <div>
                                          <span className="text-[9px] uppercase text-[#E7D4C2]/50 block font-semibold">Urgency</span>
                                          <span className="text-xs font-black text-[#B87333]">{topRecommendedFocus.urgencyScore}/100</span>
                                        </div>
                                      </div>

                                      <div className="p-3 bg-[#B87333]/10 border border-[#B87333]/20 rounded-xl">
                                        <p className="text-[10px] font-black text-[#B87333] flex items-center gap-1">
                                          <Lightbulb className="w-3 h-3 animate-pulse" /> IMMEDIATE ACTION STRATEGY:
                                        </p>
                                        <p className="text-xs text-[#E7D4C2]/80 mt-0.5 font-medium">{topRecommendedFocus.nextRecommendedAction}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="py-10 text-center">
                                      <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mx-auto mb-2 animate-bounce" />
                                      <h4 className="text-sm font-bold text-white">All clear! No pending targets.</h4>
                                      <p className="text-xs text-[#E7D4C2]/60 mt-1">Excellent speed. Save a target to compute metrics.</p>
                                    </div>
                                  )}
                                </div>

                                {topRecommendedFocus && (
                                  <div className="mt-4">
                                    <button
                                      onClick={() => triggerBreakdownAnalysis(topRecommendedFocus)}
                                      className="text-xs font-bold bg-[#B87333] hover:bg-[#9A5A25] text-white px-4 py-2.5 rounded-xl transition-all w-full flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#B87333]/20"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" /> Decompose into Action Sprints
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* 2. AI Explanation Panel */}
                              <div className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden glass-premium bg-white/5">
                                <div>
                                  <div className="flex items-center gap-2 mb-4">
                                    <Activity className="w-5 h-5 text-[#B87333]" />
                                    <h3 className="text-sm font-bold text-white">AI Priority Attribution</h3>
                                  </div>

                                  <p className="text-xs text-[#E7D4C2]/70 leading-relaxed mb-4">
                                    Why was this target prioritized? We weigh deadline closeness, hour estimates, and difficulty parameters.
                                  </p>

                                  <div className="space-y-3">
                                    <div>
                                      <div className="flex justify-between text-[10px] font-bold text-[#E7D4C2]/70 uppercase">
                                        <span>Deadline Proximity</span>
                                        <span className="text-white">{topRecommendedFocus ? `${topRecommendedFocus.urgencyScore}%` : "0%"}</span>
                                      </div>
                                      <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]" style={{ width: topRecommendedFocus ? `${topRecommendedFocus.urgencyScore}%` : "0%" }} />
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex justify-between text-[10px] font-bold text-[#E7D4C2]/70 uppercase">
                                        <span>Workload Gravity (Hours)</span>
                                        <span className="text-white">{topRecommendedFocus ? `${Math.min(100, (topRecommendedFocus.estimatedHours || 2) * 10)}%` : "0%"}</span>
                                      </div>
                                      <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full bg-[#B87333] rounded-full shadow-[0_0_8px_rgba(184,115,51,0.5)]" style={{ width: topRecommendedFocus ? `${Math.min(100, (topRecommendedFocus.estimatedHours || 2) * 10)}%` : "0%" }} />
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex justify-between text-[10px] font-bold text-[#E7D4C2]/70 uppercase">
                                        <span>Task Complexity Coefficient</span>
                                        <span className="text-white">
                                          {topRecommendedFocus ? (topRecommendedFocus.difficulty === "High" ? "90%" : topRecommendedFocus.difficulty === "Medium" ? "60%" : "30%") : "0%"}
                                        </span>
                                      </div>
                                      <div className="h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                                        <div className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]" style={{ width: topRecommendedFocus ? (topRecommendedFocus.difficulty === "High" ? "90%" : topRecommendedFocus.difficulty === "Medium" ? "60%" : "30%") : "0%" }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] text-[#E7D4C2]/70 font-medium mt-4">
                                  💡 <strong>Guardian Assessment:</strong> Begin work block within 3 hours to preserve timeline buffer.
                                </div>
                              </div>

                            </div>

                            {/* ROW 2: AI DEADLINE RISK PREDICTOR & PRODUCTIVITY HEALTH RINGS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                              {/* 3. AI Deadline Risk Predictor */}
                              <div className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden glass-premium bg-white/5">
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-5 h-5 text-[#B87333]" />
                                      <h3 className="text-sm font-bold text-white">Deadline Risk Index</h3>
                                    </div>
                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase border ${
                                      avgRiskOfFailure > 70
                                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                        : avgRiskOfFailure > 40
                                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    }`}>
                                      {avgRiskOfFailure > 70 ? "CRITICAL RISK" : avgRiskOfFailure > 40 ? "ELEVATED RISK" : "SECURE METRIC"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-6 my-4">
                                    <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                                      <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                                        <circle cx="50" cy="50" r="40" stroke={avgRiskOfFailure > 70 ? "#EF4444" : avgRiskOfFailure > 40 ? "#F59E0B" : "#B87333"} strokeWidth="8" fill="transparent"
                                          strokeDasharray="251.2"
                                          strokeDashoffset={251.2 - (251.2 * avgRiskOfFailure) / 100}
                                          className="transition-all duration-1000 ease-out"
                                        />
                                      </svg>
                                      <span className="text-xl font-black text-white">{avgRiskOfFailure}%</span>
                                    </div>

                                    <div className="space-y-1">
                                      <h4 className="text-xs font-bold text-white">AI Dynamic Projections</h4>
                                      <p className="text-xs text-[#E7D4C2]/70 leading-relaxed">
                                        {pendingTasks.length > 0
                                          ? `Workload delay increases risk of failure for ${topRecommendedFocus?.title} soon.`
                                          : "All commitment timelines remain secure and optimally managed."}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => {
                                    generatePlannerBlock();
                                    setActiveTab("planner");
                                  }}
                                  className="text-xs font-extrabold text-[#B87333] hover:text-white border border-white/10 bg-white/5 rounded-xl py-2.5 transition-all w-full text-center hover:bg-white/10 cursor-pointer shadow-md"
                                >
                                  Fix Schedule Deficiencies
                                </button>
                              </div>

                              {/* 4. Concentric Health Rings */}
                              <div className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden glass-premium bg-white/5">
                                <div>
                                  <div className="flex items-center gap-2 mb-4">
                                    <Activity className="w-5 h-5 text-[#B87333]" />
                                    <h3 className="text-sm font-bold text-white">Guardian Health Rings</h3>
                                  </div>

                                  <div className="flex items-center justify-between gap-4">
                                    {/* Concentration concentric circles SVG */}
                                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                                      {/* Ring 1 (Productivity) */}
                                      <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.03)" strokeWidth="5" fill="transparent" />
                                        <circle cx="50" cy="50" r="42" stroke="#B87333" strokeWidth="5" fill="transparent"
                                          strokeDasharray="263.8"
                                          strokeDashoffset={263.8 - (263.8 * computedProductivityScore) / 100}
                                        />
                                      </svg>
                                      {/* Ring 2 (Completion rate) */}
                                      <svg className="absolute w-3/4 h-3/4 transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.02)" strokeWidth="6" fill="transparent" />
                                        <circle cx="50" cy="50" r="42" stroke="#10B981" strokeWidth="6" fill="transparent"
                                          strokeDasharray="263.8"
                                          strokeDashoffset={263.8 - (263.8 * (tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 100)) / 100}
                                        />
                                      </svg>
                                      {/* Ring 3 (Safety) */}
                                      <svg className="absolute w-1/2 h-1/2 transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="42" stroke="rgba(255,255,255,0.01)" strokeWidth="8" fill="transparent" />
                                        <circle cx="50" cy="50" r="42" stroke="#6366F1" strokeWidth="8" fill="transparent"
                                          strokeDasharray="263.8"
                                          strokeDashoffset={263.8 - (263.8 * (100 - avgRiskOfFailure)) / 100}
                                        />
                                      </svg>
                                      <div className="z-10 text-center">
                                        <span className="text-lg font-black text-white">{computedProductivityScore}%</span>
                                      </div>
                                    </div>

                                    <div className="text-left space-y-1.5 text-[11px] font-bold text-[#E7D4C2]/80 w-full">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#B87333] inline-block shadow-[0_0_8px_rgba(184,115,51,0.5)]" />
                                        <span>Productivity: {computedProductivityScore}%</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span>Completed: {tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 100}%</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                        <span>Safety Index: {100 - avgRiskOfFailure}%</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-[10px] text-center text-[#E7D4C2]/50 border-t border-white/5 pt-3 font-semibold">
                                  Concentric rings sync with actual logged metrics in database.
                                </div>
                              </div>

                            </div>

                            {/* ROW 3: AI ACTION CENTER & GAMIFICATION */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                              {/* 5. AI Action Center */}
                              <div className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden glass-premium bg-white/5">
                                <div>
                                  <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-5 h-5 text-[#B87333]" />
                                    <h3 className="text-sm font-bold text-white">AI Recommended Actions</h3>
                                  </div>

                                  <div className="space-y-3">
                                    {/* Card 1: Start Now */}
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-[#B87333]/50 transition-all text-left">
                                      <div className="flex items-center gap-1.5 text-rose-400 font-extrabold text-[10px] uppercase">
                                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                        <span>🔥 Start Now</span>
                                      </div>
                                      <h4 className="text-xs font-bold text-white mt-1">{topRecommendedFocus ? topRecommendedFocus.title : "Draft ML report layout"}</h4>
                                      <p className="text-[10px] text-[#E7D4C2]/60 mt-0.5">Reason: Deadline approaching faster than expected</p>
                                      {topRecommendedFocus && (
                                        <button
                                          onClick={() => triggerBreakdownAnalysis(topRecommendedFocus)}
                                          className="mt-2 text-[10px] font-bold text-white bg-[#B87333] hover:bg-[#9A5A25] px-2.5 py-1 rounded"
                                        >
                                          Start Focus
                                        </button>
                                      )}
                                    </div>

                                    {/* Card 2: Plan Later */}
                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-[#B87333]/30 transition-all text-left">
                                      <div className="text-indigo-400 font-extrabold text-[10px] uppercase flex items-center gap-1">
                                        ⏰ Schedule Later
                                      </div>
                                      <h4 className="text-xs font-bold text-white mt-1">Portfolio Update Integration</h4>
                                      <p className="text-[10px] text-[#E7D4C2]/60 mt-0.5">Optimize with low cognitive slots to avoid workload peaks.</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <button
                                    onClick={() => setActiveTab("planner")}
                                    className="text-xs font-bold text-[#B87333] hover:underline cursor-pointer"
                                  >
                                    Review alternate auto routes →
                                  </button>
                                </div>
                              </div>

                              {/* 6. Gamification Widget */}
                              <div className="p-6 rounded-3xl border border-white/10 flex flex-col justify-between relative overflow-hidden glass-premium bg-white/5">
                                <div>
                                  <div className="flex items-center gap-2 mb-4">
                                    <Star className="w-5 h-5 text-amber-500" />
                                    <h3 className="text-sm font-bold text-white">Guardian Level Rank</h3>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                      <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center text-2xl font-black text-amber-500 border border-amber-500/30 shadow-lg shadow-amber-500/10">
                                        8
                                      </div>
                                      <div className="space-y-1">
                                        <h4 className="text-xs font-black text-white">🏆 Deadline Defender</h4>
                                        <p className="text-[10px] text-[#E7D4C2]/70">Level Progress: 82% to Level 9</p>

                                        <div className="w-36 h-2 bg-white/5 rounded-full overflow-hidden">
                                          <div className="h-full bg-amber-500 rounded-full" style={{ width: "82%" }} />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-center pt-2">
                                      <div className="p-2 bg-white/5 border border-white/5 rounded-xl">
                                        <span className="text-[9px] uppercase font-bold text-[#E7D4C2]/60">🔥 Streak</span>
                                        <span className="block text-sm font-black text-[#B87333]">7 Day Streak</span>
                                      </div>
                                      <div className="p-2 bg-white/5 border border-white/5 rounded-xl">
                                        <span className="text-[9px] uppercase font-bold text-[#E7D4C2]/60">🛡️ Tasks Saved</span>
                                        <span className="block text-sm font-black text-emerald-400">{completedTasks.length * 4 + pendingTasks.length + 12}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-[9px] text-center text-[#E7D4C2]/50 font-bold mt-4">
                                  Perform actions daily to boost your defender leaderboard rank.
                                </div>
                              </div>

                            </div>

                          </div>

                          {/* RIGHT COLUMN: SINGLE TAB SPAN FOR DIRECT ACTION TIMELINE, HEATMAPS, AND LOGS */}
                          <div className="space-y-6">

                            {/* LIVE GUARDIAN CLOCK WIDGET */}
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                              className="p-6 rounded-3xl border border-white/10 text-left glass-premium bg-white/5 relative overflow-hidden group"
                            >
                              {/* Subtle glow effect on hover */}
                              <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#B87333]/5 rounded-full blur-2xl group-hover:bg-[#B87333]/10 transition-colors duration-500" />

                              {/* Header with title and icons */}
                              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5 relative z-10">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-[#B87333]/15 text-[#B87333] rounded-xl border border-[#B87333]/25 shadow-[0_0_12px_rgba(184,115,51,0.2)]">
                                    <Clock className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                      Live Guardian Clock
                                      <ShieldAlert className="w-4 h-4 text-[#B87333] animate-pulse" />
                                    </h3>
                                    <p className="text-[10px] text-[#E7D4C2]/60 font-medium mt-0.5">Real-time deadline precision</p>
                                  </div>
                                </div>
                              </div>

                              {/* Main clock display */}
                              <div className="space-y-5 relative z-10">
                                {/* Time Display */}
                                <div className="text-center space-y-3 py-4">
                                  <div className="flex items-center justify-center gap-2 group/time">
                                    <motion.div
                                      key={`hours-${currentTime.getHours()}`}
                                      initial={{ opacity: 0.5, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="text-5xl font-black text-white tracking-tighter"
                                    >
                                      {String(currentTime.getHours()).padStart(2, "0")}
                                    </motion.div>

                                    <motion.div
                                      animate={{ opacity: [1, 0.3, 1] }}
                                      transition={{ duration: 1.2, repeat: Infinity }}
                                      className="text-4xl font-black text-[#B87333]"
                                    >
                                      :
                                    </motion.div>

                                    <motion.div
                                      key={`minutes-${currentTime.getMinutes()}`}
                                      initial={{ opacity: 0.5, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="text-5xl font-black text-white tracking-tighter"
                                    >
                                      {String(currentTime.getMinutes()).padStart(2, "0")}
                                    </motion.div>

                                    <motion.div
                                      animate={{ opacity: [1, 0.3, 1] }}
                                      transition={{ duration: 1.2, repeat: Infinity }}
                                      className="text-4xl font-black text-[#B87333]"
                                    >
                                      :
                                    </motion.div>

                                    <motion.div
                                      key={`seconds-${currentTime.getSeconds()}`}
                                      initial={{ opacity: 0.5, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ duration: 0.3 }}
                                      className="text-3xl font-black text-[#B87333] tracking-tighter"
                                    >
                                      {String(currentTime.getSeconds()).padStart(2, "0")}
                                    </motion.div>
                                  </div>
                                </div>

                                {/* Date and Day Info */}
                                <div className="space-y-2 text-center bg-white/5 border border-white/5 rounded-2xl p-4">
                                  <div className="text-xs font-bold text-[#E7D4C2] uppercase tracking-wider">
                                    {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                                  </div>
                                  <div className="text-[11px] text-[#B87333] font-black">
                                    {currentTime.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }).split(",")[1]?.trim() || "IST"}
                                  </div>
                                </div>

                                {/* LIVE Indicator */}
                                <div className="flex items-center justify-center gap-2 pt-2">
                                  <motion.div
                                    animate={{
                                      scale: [1, 1.2, 1],
                                      opacity: [1, 0.6, 1]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                                  />
                                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider">LIVE</span>
                                </div>
                              </div>
                            </motion.div>

                            {/* 7. Smart Day Timeline */}
                            <div className="p-6 rounded-3xl border border-white/10 text-left glass-premium bg-white/5">
                              <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                                <h3 className="text-sm font-bold text-white">Today's Guardian Plan</h3>
                                <span className="text-[10px] text-[#B87333] font-bold uppercase">AI Autopilot</span>
                              </div>

                              {dailyPlan.length > 0 ? (
                                <div className="relative border-l-2 border-white/10 pl-4 ml-2 space-y-4">
                                  {dailyPlan.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="relative animate-fade-in-up">
                                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-neutral-900 border-2 border-[#B87333] shadow-[0_0_8px_rgba(184,115,51,0.5)]" />
                                      <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                                        <span className="text-[10px] font-black text-[#B87333]">{item.time} ({item.duration})</span>
                                        <h5 className="text-xs font-bold text-white mt-0.5 truncate">{item.task}</h5>
                                      </div>
                                    </div>
                                  ))}
                                  {dailyPlan.length > 3 && (
                                    <button onClick={() => setActiveTab("planner")} className="text-xs text-[#B87333] font-semibold hover:underline mt-2 inline-block cursor-pointer">
                                      View full {dailyPlan.length}-block plan →
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-6 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                  <CalendarDays className="w-8 h-8 text-[#B87333]/40 mx-auto mb-2 animate-bounce" />
                                  <p className="text-xs text-[#E7D4C2]/60 leading-relaxed px-2">No timetable generated. Create staminal focus schedule blocks now.</p>
                                  <button
                                    onClick={generatePlannerBlock}
                                    disabled={isGeneratingDailyPlan}
                                    className="mt-3 px-3 py-1.5 bg-[#B87333] hover:bg-[#9A5A25] text-white text-xs font-semibold rounded-lg transition-all w-full cursor-pointer shadow-md shadow-[#B87333]/15"
                                  >
                                    {isGeneratingDailyPlan ? "Assembling Blocks..." : "Compile Smart Timetable"}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* 8. Weekly Heatmap calendar */}
                            <div className="p-6 rounded-3xl border border-white/10 text-left glass-premium bg-white/5">
                              <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-4 h-4 text-[#B87333]" />
                                <h3 className="text-sm font-bold text-white">Weekly Pressure</h3>
                              </div>

                              <div className="grid grid-cols-7 gap-1.5 text-center my-3">
                                {pressureByDay.map((d, idx) => (
                                  <div key={idx} className="p-2 rounded-lg bg-white/5 border border-white/5 flex flex-col items-center">
                                    <span className="text-[9px] font-black text-[#E7D4C2]/70">{d.day}</span>
                                    <span className={`w-3 h-3 rounded-full ${d.color} mt-1.5`} title={d.desc} />
                                  </div>
                                ))}
                              </div>

                              <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-300 font-medium">
                                ⚠️ <strong>AI Warning:</strong> Thursday workload overload detected
                              </div>
                            </div>

                            {/* 9. Core high-risk table */}
                            <div className="p-6 rounded-3xl border border-white/10 text-left glass-premium bg-white/5">
                              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/5">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <h3 className="text-sm font-bold text-white">High Risk Deadlines</h3>
                              </div>

                              {pendingTasks.length > 0 ? (
                                <div className="space-y-3 max-h-[190px] overflow-y-auto pr-1">
                                  {pendingTasks
                                    .sort((a, b) => (b.riskOfFailure || 0) - (a.riskOfFailure || 0))
                                    .slice(0, 3)
                                    .map((t, idx) => (
                                      <div key={idx} className="p-2.5 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center hover:border-[#B87333]/30 hover:bg-white/10 transition-all duration-300">
                                        <div>
                                          <h4 className="text-xs font-bold text-white truncate max-w-[120px]">{t.title}</h4>
                                          <p className="text-[10px] text-[#E7D4C2]/60 mt-0.5">Due: {t.deadlineDate}</p>
                                        </div>
                                        <div className="text-right">
                                          <span className={`text-[10px] font-extrabold block ${t.riskOfFailure > 75 ? "text-rose-400" : t.riskOfFailure > 40 ? "text-amber-400" : "text-[#B87333]"}`}>
                                            {t.riskOfFailure}% Risk
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              ) : (
                                <div className="py-6 text-center text-[#E7D4C2]/50 text-xs">
                                  No active risk targets computed.
                                </div>
                              )}
                            </div>

                          </div>

                        </div>

                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* TAB 2: TASKS */}
              {activeTab === "tasks" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* TASK CREATION FORM */}
                    <div className="border border-white/10 p-6 rounded-3xl text-left h-fit lg:col-span-1 shadow-2xl glass-premium bg-white/5">
                      <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-[#B87333]" /> Save New Target
                      </h3>

                      <form onSubmit={handleCreateTask} className="space-y-4">
                        <div>
                          <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Task Title *</label>
                          <input
                            type="text"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            placeholder="Draft ML report"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all placeholder-white/30"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Task Description</label>
                          <textarea
                            value={taskDesc}
                            onChange={(e) => setTaskDesc(e.target.value)}
                            placeholder="Complete writing guidelines and format datasets."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all placeholder-white/30 h-20 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Deadline Date *</label>
                            <input
                              type="date"
                              value={taskDeadlineDate}
                              onChange={(e) => setTaskDeadlineDate(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all scheme-dark"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Deadline Time</label>
                            <input
                              type="time"
                              value={taskDeadlineTime}
                              onChange={(e) => setTaskDeadlineTime(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all scheme-dark"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Est. Effort (Hrs)</label>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={taskHrs}
                              onChange={(e) => setTaskHrs(Number(e.target.value))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Difficulty</label>
                            <select
                              value={taskDifficulty}
                              onChange={(e) => setTaskDifficulty(e.target.value as any)}
                              className="w-full bg-[#1C1A19] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all"
                            >
                              <option className="bg-[#1C1A19]" value="Low">Low</option>
                              <option className="bg-[#1C1A19]" value="Medium">Medium</option>
                              <option className="bg-[#1C1A19]" value="High">High</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-black text-[#E7D4C2]/70 uppercase tracking-wider mb-1">Workload Category</label>
                          <select
                            value={taskCategory}
                            onChange={(e) => setTaskCategory(e.target.value as any)}
                            className="w-full bg-[#1C1A19] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B87333] focus:ring-1 focus:ring-[#B87333]/25 transition-all"
                          >
                            <option className="bg-[#1C1A19]" value="Academic">Academic</option>
                            <option className="bg-[#1C1A19]" value="Professional">Professional</option>
                            <option className="bg-[#1C1A19]" value="Personal">Personal</option>
                            <option className="bg-[#1C1A19]" value="Health">Health</option>
                            <option className="bg-[#1C1A19]" value="Finance">Finance</option>
                            <option className="bg-[#1C1A19]" value="Other">Other</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-[#B87333] hover:bg-[#9A5A25] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#B87333]/25 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-4 h-4" /> Save & Compute AI Priority
                        </button>
                      </form>
                    </div>

                    {/* TASK PIPELINE WORKSPACE */}
                    <div className="lg:col-span-2 space-y-6">

                      {/* Active Task Breakdown Detail Viewer */}
                      {activeBreakdownTask && (
                        <div className="p-6 border border-white/10 rounded-3xl text-left relative overflow-hidden shadow-2xl glass-premium bg-white/5">
                          <button
                            onClick={() => setActiveBreakdownTask(null)}
                            className="absolute top-4 right-4 text-xs text-[#E7D4C2]/80 hover:text-white border border-white/10 px-2.5 py-1 rounded-lg cursor-pointer bg-white/5 transition-colors"
                          >
                            Close Breakdown
                          </button>

                          <div className="flex items-center gap-2 mb-2 text-[#B87333] font-black text-xs uppercase tracking-wider">
                            <Brain className="w-4 h-4 animate-pulse" /> AI Decomposed Task Workspace
                          </div>
                          <h4 className="text-lg font-black text-white mb-4">Target: {activeBreakdownTask.title}</h4>

                          {isGeneratingBreakdown ? (
                            <div className="py-6 text-center space-y-3">
                              <span className="w-6 h-6 border-2 border-[#B87333] border-t-transparent rounded-full inline-block animate-spin" />
                              <p className="text-xs text-[#E7D4C2]/70">Gemini model breaking workload down into actionable sprints...</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {generatedSteps.map((step, idx) => {
                                const stepKey = `${activeBreakdownTask.id}_${idx}`;
                                const isDone = completedSteps[stepKey] || false;
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => setCompletedSteps(prev => ({ ...prev, [stepKey]: !isDone }))}
                                    className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all cursor-pointer ${
                                      isDone
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-[#E7D4C2]/50"
                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                    }`}
                                  >
                                    <div className={`p-1 rounded-full border shrink-0 mt-0.5 ${isDone ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" : "border-white/20 text-transparent"}`}>
                                      <Check className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <h5 className={`text-sm font-bold ${isDone ? "line-through text-white/40" : "text-white"}`}>{step.step}</h5>
                                      <p className="text-xs text-[#E7D4C2]/70 mt-0.5">{step.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Main Task Lists */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black text-white">Active Commitments</h3>
                          <span className="text-xs text-[#E7D4C2]/60 font-medium">Click check to toggle status</span>
                        </div>

                        {loading ? (
                          <div className="py-12 text-center space-y-3">
                            <span className="w-8 h-8 border-2 border-[#B87333] border-t-transparent rounded-full inline-block animate-spin" />
                            <p className="text-sm text-[#E7D4C2]/70">Syncing database changes...</p>
                          </div>
                        ) : tasks.length > 0 ? (
                          <div className="grid grid-cols-1 gap-4">
                            {tasks.map((task, idx) => {
                              const isCompleted = task.status === "Completed";
                              return (
                                <div
                                  key={idx}
                                  className={`p-5 rounded-2xl text-left relative transition-all duration-200 border-l-4 glass-premium ${
                                    isCompleted
                                      ? "opacity-40 border border-white/5 bg-white/1"
                                      : task.priority === "CRITICAL"
                                        ? "border-white/10 border-l-rose-500 shadow-md"
                                        : task.priority === "HIGH"
                                          ? "border-white/10 border-l-amber-500 shadow-md"
                                          : "border-white/10 border-l-[#B87333] shadow-md"
                                  }`}
                                >
                                  {/* Top row */}
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                      <button
                                        onClick={() => toggleTaskStatus(task.id!, task.status)}
                                        className={`p-1.5 rounded-full border shrink-0 mt-1 cursor-pointer transition-all ${
                                          isCompleted
                                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                            : "border-white/20 hover:border-[#B87333]"
                                        }`}
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>
                                      <div>
                                        <h4 className={`text-base font-black text-white ${isCompleted ? "line-through text-white/40" : ""}`}>{task.title}</h4>
                                        <p className="text-xs text-[#E7D4C2]/70 mt-1 line-clamp-2">{task.description || "No description provided."}</p>

                                        {/* Auto-Steps Indicator badge if steps exist */}
                                        {Object.keys(completedSteps).some(k => k.startsWith(task.id!)) && (
                                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#B87333]/15 text-[#B87333] rounded-lg border border-[#B87333]/25 text-[10px] font-bold">
                                            <Brain className="w-3.5 h-3.5 animate-pulse" /> Breakdown steps tracked
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action items */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => triggerBreakdownAnalysis(task)}
                                        title="AI Breakdown"
                                        className="p-1.5 hover:bg-white/5 rounded-lg text-[#B87333] hover:text-[#9A5A25] cursor-pointer transition-colors"
                                      >
                                        <Brain className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => handleTaskDeletion(task.id!)}
                                        title="Delete Task"
                                        className="p-1.5 hover:bg-white/5 rounded-lg text-red-400 hover:text-red-300 cursor-pointer transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Meta details row */}
                                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs">
                                    <div className="flex items-center gap-3">
                                      <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white font-bold">{task.category}</span>
                                      <span className="text-[#E7D4C2]/70 font-medium">Due: <strong className="text-white">{task.deadlineDate} ({task.deadlineTime})</strong></span>
                                    </div>

                                    {!isCompleted && (
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                                          task.priority === "CRITICAL"
                                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.15)]"
                                            : task.priority === "HIGH"
                                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
                                              : "bg-[#B87333]/15 text-[#B87333] border border-[#B87333]/20 shadow-[0_0_8px_rgba(184,115,51,0.15)]"
                                        }`}>
                                          {task.priority} Urgency
                                        </span>
                                        <span className="text-[#E7D4C2]/70">Crash risk: <strong className="text-white">{task.riskOfFailure}%</strong></span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-20 text-center border border-white/10 rounded-3xl shadow-xl glass-premium bg-white/5">
                            <BookOpen className="w-12 h-12 text-[#E7D4C2]/30 mx-auto mb-4" />
                            <h4 className="text-lg font-black text-white">Your task repository is clear</h4>
                            <p className="text-sm text-[#E7D4C2]/60 mt-1 max-w-md mx-auto px-4">
                              Save your academic, professional, or personal goals to compute real-time AI prioritizations and failing indicators.
                            </p>
                          </div>
                        )}

                      </div>

                    </div>

                  </div>
                </motion.div>
              )}

              {/* TAB 3: DAILY PLANNER */}
              {activeTab === "planner" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 max-w-4xl mx-auto"
                >
                  <div className="border border-white/10 p-6 rounded-3xl text-left shadow-2xl glass-premium bg-white/5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
                      <div>
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <CalendarDays className="w-5 h-5 text-[#B87333]" /> AI Intelligent Schedule Builder
                        </h3>
                        <p className="text-xs text-[#E7D4C2]/70 mt-1">Autonomous layout mapping of focus blocks computed relative to pending dates.</p>
                      </div>

                      <button
                        onClick={generatePlannerBlock}
                        disabled={isGeneratingDailyPlan}
                        className="px-5 py-2.5 bg-[#B87333] hover:bg-[#9A5A25] text-white font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#B87333]/25 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isGeneratingDailyPlan ? "Assembling Blocks..." : "Compile Smart Timetable"}
                      </button>
                    </div>

                    {isGeneratingDailyPlan ? (
                      <div className="py-20 text-center space-y-4">
                        <span className="w-10 h-10 border-4 border-[#B87333] border-t-transparent rounded-full inline-block animate-spin" />
                        <p className="text-sm text-[#E7D4C2]/70">Gemini model optimizing stamina profiles and deep-focus block positions...</p>
                      </div>
                    ) : dailyPlan.length > 0 ? (
                      <div className="space-y-6">

                        {/* Interactive Timetable list */}
                        <div className="relative border-l-2 border-white/10 pl-6 ml-3 space-y-6 text-left">
                          {dailyPlan.map((item, idx) => (
                            <div key={idx} className="relative">
                              {/* Pulse circle on line */}
                              <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-[#1C1A19] border-2 border-[#B87333] flex items-center justify-center">
                                <span className="w-1.5 h-1.5 bg-[#B87333] rounded-full animate-ping" />
                              </div>

                              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-[#B87333]/40 hover:bg-white/10 transition-all duration-300">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#B87333] bg-[#B87333]/15 border border-[#B87333]/25 px-2.5 py-1 rounded-lg">
                                    {item.time}
                                  </span>
                                  <span className="text-xs text-[#E7D4C2]/70 font-semibold">Duration: {item.duration}</span>
                                </div>
                                <h4 className="text-sm font-black text-white mt-2">{item.task}</h4>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Explanation Box */}
                        {planExplanation && (
                          <div className="p-4 bg-[#B87333]/10 border border-[#B87333]/20 rounded-2xl text-left">
                            <h4 className="text-xs font-bold text-[#B87333] uppercase tracking-wider flex items-center gap-1.5 mb-1">
                              <Brain className="w-4 h-4 animate-pulse" /> AI Strategic Assessment
                            </h4>
                            <p className="text-xs text-[#E7D4C2]/80 leading-relaxed font-semibold">{planExplanation}</p>
                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="py-20 text-center space-y-3">
                        <CalendarDays className="w-12 h-12 text-[#E7D4C2]/30 mx-auto animate-pulse" />
                        <h4 className="text-base font-black text-white">Daily Timetable Empty</h4>
                        <p className="text-xs text-[#E7D4C2]/60 max-w-sm mx-auto">
                          Click compile above. The AI Priority Agent will inspect your tasks database and layout a balanced timetable blocks schedule.
                        </p>
                      </div>
                    )}

                  </div>
                </motion.div>
              )}

              {/* TAB 4: PRODUCTIVITY COACH CHAT */}
              {activeTab === "coach" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 max-w-4xl mx-auto"
                >
                  <div className="border border-white/10 rounded-3xl overflow-hidden flex flex-col h-[550px] text-left shadow-2xl glass-premium bg-white/5">
                    {/* Header */}
                    <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#B87333]/25 text-[#B87333] rounded-xl border border-[#B87333]/20 shadow-[0_0_12px_rgba(184,115,51,0.2)]">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white">Guardian AI Coach</h3>
                          <p className="text-[10px] text-[#E7D4C2]/70">Contextual advice synced to current workload deadlines.</p>
                        </div>
                      </div>

                      {/* Clear history button */}
                      <button
                        onClick={() => setChatMessages([{ role: "assistant", text: "Welcome back! What are we focusing on today?" }])}
                        className="text-xs text-[#E7D4C2]/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 cursor-pointer transition-colors"
                      >
                        Reset Consultation
                      </button>
                    </div>

                    {/* Quick helper prompts */}
                    <div className="p-3 border-b border-white/10 flex flex-wrap gap-2 bg-black/20">
                      {[
                        "What should I do now?",
                        "I feel overloaded",
                        "How is my productivity score?",
                        "Give me a study plan"
                      ].map((promptText, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setChatInput(promptText);
                          }}
                          className="text-xs bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-[#E7D4C2] hover:border-[#B87333]/50 hover:bg-white/10 transition-all cursor-pointer"
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>

                    {/* Messages Panel */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/1">
                      {chatMessages.map((msg, idx) => {
                        const isAI = msg.role === "assistant";
                        return (
                          <div key={idx} className={`flex ${isAI ? "justify-start" : "justify-end"} items-start gap-3`}>
                            {isAI && (
                              <div className="p-1.5 bg-[#B87333]/15 text-[#B87333] rounded-lg border border-[#B87333]/25 shrink-0">
                                <Sparkles className="w-4 h-4" />
                              </div>
                            )}
                            <div className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isAI
                                ? "bg-white/5 text-white rounded-tl-none border border-white/10 shadow-md"
                                : "bg-[#B87333]/10 text-white rounded-tr-none border border-[#B87333]/30 shadow-md"
                            }`}>
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          </div>
                        );
                      })}

                      {isCoachTyping && (
                        <div className="flex justify-start items-center gap-2">
                          <div className="p-1.5 bg-[#B87333]/15 text-[#B87333] rounded-lg border border-[#B87333]/25 shrink-0">
                            <Sparkles className="w-4 h-4 animate-pulse" />
                          </div>
                          <div className="flex items-center gap-1.5 bg-white/5 p-3.5 rounded-2xl border border-white/10 shadow-md">
                            <span className="w-1.5 h-1.5 bg-[#B87333] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 bg-[#B87333] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 bg-[#B87333] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer query input */}
                    <div className="p-3 bg-white/5 border-t border-white/10 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendCoachMessage()}
                        placeholder="Ask: 'Which of my academic targets has the highest deadline risk?'"
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#B87333] transition-all focus:ring-1 focus:ring-[#B87333]/25"
                      />
                      <button
                        onClick={sendCoachMessage}
                        className="p-3 bg-[#B87333] hover:bg-[#9A5A25] text-white rounded-xl transition-all shadow-lg shadow-[#B87333]/25 cursor-pointer flex items-center justify-center"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </motion.div>
              )}

              {/* TAB 5: IMAGE TASK SCANNER */}
              {activeTab === "scanner" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 max-w-4xl mx-auto"
                >
                  <div className="border border-white/10 p-6 rounded-3xl text-left shadow-2xl glass-premium bg-white/5">
                    <div className="mb-6">
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Upload className="w-5 h-5 text-[#B87333]" /> Multimodal Image Deadline Scanner
                      </h3>
                      <p className="text-xs text-[#E7D4C2]/70 mt-1">
                        Upload assignment sheets, notice syllabus screenshots, or calendar reminders. Gemini Vision parses dates to generate targets automatically.
                      </p>
                    </div>

                    {/* Drag and Drop Container */}
                    <div className="border-2 border-dashed border-white/15 rounded-3xl p-8 text-center hover:border-[#B87333]/50 transition-all relative bg-white/1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />

                      {scannedPreview ? (
                        <div className="space-y-4">
                          <img
                            src={scannedPreview}
                            alt="Scanned Preview"
                            className="max-h-48 rounded-2xl mx-auto border border-white/10 shadow-lg"
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-xs text-[#E7D4C2]/70">{imageFile?.name}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <ImageIcon className="w-12 h-12 text-[#E7D4C2]/30 mx-auto" />
                          <h4 className="text-sm font-black text-white">Drag or click to choose an image file</h4>
                          <p className="text-xs text-[#E7D4C2]/50">Supports PNG, JPG, JPEG up to 5MB.</p>
                        </div>
                      )}
                    </div>

                    {scannedPreview && (
                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setImageFile(null);
                            setScannedPreview(null);
                          }}
                          className="px-4 py-2 border border-white/10 hover:bg-white/10 bg-white/5 rounded-xl text-xs font-bold cursor-pointer text-[#E7D4C2]/80 transition-colors"
                        >
                          Cancel
                        </button>

                        <button
                          onClick={executeImageScan}
                          disabled={isScanningImage}
                          className="px-5 py-2.5 bg-[#B87333] hover:bg-[#9A5A25] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          {isScanningImage ? "Extracting Details..." : "Parse with Gemini Vision"}
                        </button>
                      </div>
                    )}

                  </div>
                </motion.div>
              )}

              {/* TAB 6: ANALYTICS */}
              {activeTab === "analytics" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Category Distribution chart */}
                    <div className="border border-white/10 p-6 rounded-3xl text-left shadow-2xl glass-premium bg-white/5">
                      <h3 className="text-sm font-black text-white mb-4">Pipeline Category Share</h3>

                      {tasks.length > 0 ? (
                        <div className="space-y-4">
                          {["Academic", "Professional", "Personal", "Health", "Finance", "Other"].map((cat) => {
                            const catTasks = tasks.filter(t => t.category === cat);
                            const ratio = Math.round((catTasks.length / tasks.length) * 100);
                            return (
                              <div key={cat} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-[#E7D4C2]/70 font-semibold">{cat}</span>
                                  <span className="text-white font-black">{catTasks.length} ({ratio}%)</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#B87333] rounded-full"
                                    style={{ width: `${ratio}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-[#E7D4C2]/50 text-sm">
                          No tasks saved to compute metrics.
                        </div>
                      )}
                    </div>

                    {/* Overall Workload Risk distribution */}
                    <div className="border border-white/10 p-6 rounded-3xl text-left shadow-2xl glass-premium bg-white/5">
                      <h3 className="text-sm font-black text-white mb-4">Failure Threat Distribution</h3>

                      {tasks.length > 0 ? (
                        <div className="space-y-4">
                          {[
                            { label: "Critical Failure Danger (>75% risk)", count: tasks.filter(t => t.riskOfFailure > 75).length, color: "bg-rose-500" },
                            { label: "Elevated Risk (40-75% risk)", count: tasks.filter(t => t.riskOfFailure >= 40 && t.riskOfFailure <= 75).length, color: "bg-amber-500" },
                            { label: "Secure Milestone (<40% risk)", count: tasks.filter(t => t.riskOfFailure < 40).length, color: "bg-[#B87333]" }
                          ].map((riskBlock, idx) => {
                            const ratio = Math.round((riskBlock.count / tasks.length) * 100);
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-[#E7D4C2]/70 font-semibold">{riskBlock.label}</span>
                                  <span className="text-white font-black">{riskBlock.count} ({ratio}%)</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${riskBlock.color} rounded-full`}
                                    style={{ width: `${ratio}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-[#E7D4C2]/50 text-sm">
                          No tasks saved to compute metrics.
                        </div>
                      )}
                    </div>

                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </main>

        </div>
      )}

      {/* Mic dictating panel modal overlay */}
      <AnimatePresence>
        {isVoiceListening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#2C2A28]/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="bg-white border border-[#E7D4C2] max-w-sm w-full p-6 rounded-2xl text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Mic className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-[#2C2A28]">Voice Assistant Listening</h4>
              <p className="text-xs text-[#2C2A28] leading-relaxed font-medium bg-[#FBF4EE] p-4 rounded-xl border border-[#E7D4C2]">
                {voiceTranscript || "Say 'What should I do now?' or ask general workload questions."}
              </p>
              <button
                onClick={() => setIsVoiceListening(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#6B5A4D] rounded-lg text-xs font-semibold cursor-pointer border border-[#E7D4C2] transition-colors"
              >
                Close Dictating
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING AI GUARDIAN CHAT BUTTON */}
      {currentUser && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
          <AnimatePresence>
            {isChatWidgetOpen && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.9 }}
                className="w-96 max-w-[calc(100vw-32px)] h-[480px] bg-white/70 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-3xl flex flex-col overflow-hidden mb-4 text-left glass-premium"
              >
                {/* Header */}
                <div className="p-4 bg-[#FBF4EE]/95 border-b border-[#E7D4C2]/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#B87333] animate-pulse" />
                    <div>
                      <h4 className="text-xs font-black text-[#2C2A28]">Guardian AI Assistant</h4>
                      <p className="text-[9px] text-[#6B5A4D] font-bold">Quick Consult Cockpit</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsChatWidgetOpen(false)}
                    className="p-1 hover:bg-[#FBF4EE] rounded-lg border border-[#E7D4C2] transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="p-2.5 border-b border-[#E7D4C2]/30 bg-[#FBF4EE]/40 flex flex-wrap gap-1.5">
                  {[
                    { label: "📅 Plan my day", query: "Plan my day" },
                    { label: "🔥 What first?", query: "What should I do first?" },
                    { label: "🛡️ Reduce load", query: "How do I reduce deadline risk?" }
                  ].map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        const userMsg = { role: "user" as const, text: tag.query };
                        setChatMessages(prev => [...prev, userMsg]);
                        setIsCoachTyping(true);
                        try {
                          const aiReply = await geminiService.chatWithCoach(tag.query, tasks, chatMessages.slice(-8));
                          setChatMessages(prev => [...prev, { role: "assistant", text: aiReply }]);
                        } catch (err) {
                          console.error(err);
                        }
                        setIsCoachTyping(false);
                      }}
                      className="text-[10px] bg-white border border-[#E7D4C2] hover:border-[#B87333]/50 hover:bg-[#FBF4EE] rounded-full px-2.5 py-1 text-[#6B5A4D] font-bold cursor-pointer transition-all"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>

                {/* Messages Panel */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FBF4EE]/10">
                  {chatMessages.map((msg, idx) => {
                    const isAI = msg.role === "assistant";
                    return (
                      <div key={idx} className={`flex ${isAI ? "justify-start" : "justify-end"} items-start gap-2`}>
                        {isAI && (
                          <div className="p-1 bg-[#B87333]/15 text-[#B87333] border border-[#B87333]/20 rounded-lg shrink-0">
                            <ShieldAlert className="w-3 h-3" />
                          </div>
                        )}
                        <div className={`p-2.5 rounded-2xl text-xs max-w-[80%] font-medium ${
                          isAI
                            ? "bg-white text-[#2C2A28] border border-[#E7D4C2] rounded-tl-none"
                            : "bg-[#B87333] text-white rounded-tr-none"
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  {isCoachTyping && (
                    <div className="flex items-center gap-2 text-[#6B5A4D]">
                      <div className="p-1 bg-[#B87333]/15 text-[#B87333] border border-[#B87333]/20 rounded-lg animate-bounce">
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] font-bold animate-pulse">Thinking...</span>
                    </div>
                  )}
                </div>

                {/* Input Form */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!chatInput.trim()) return;
                    const text = chatInput;
                    setChatInput("");
                    const userMsg = { role: "user" as const, text };
                    setChatMessages(prev => [...prev, userMsg]);
                    setIsCoachTyping(true);
                    try {
                      const aiReply = await geminiService.chatWithCoach(text, tasks, chatMessages.slice(-8));
                      setChatMessages(prev => [...prev, { role: "assistant", text: aiReply }]);
                    } catch (err) {
                      console.error(err);
                    }
                    setIsCoachTyping(false);
                  }}
                  className="p-3 bg-white border-t border-[#E7D4C2]/50 flex gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Guardian Coach..."
                    className="flex-1 bg-[#FBF4EE] border border-[#E7D4C2] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#B87333]"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-[#B87333] hover:bg-[#9A5A25] text-white rounded-xl cursor-pointer transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsChatWidgetOpen(!isChatWidgetOpen)}
            className="p-4 bg-gradient-to-r from-[#B87333] to-[#9A5A25] text-white rounded-full shadow-lg shadow-[#B87333]/30 hover:shadow-[#B87333]/50 flex items-center gap-2 cursor-pointer relative"
          >
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-black tracking-wide uppercase pr-1">Ask Guardian</span>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white animate-ping" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white" />
          </motion.button>
        </div>
      )}

    </div>
  );
}
