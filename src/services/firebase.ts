import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBWUOAH_aGDrSIfxclur9cJBxY-ZzYgomg",
  authDomain: "deadline-guardian-ai-455c1.firebaseapp.com",
  projectId: "deadline-guardian-ai-455c1",
  storageBucket: "deadline-guardian-ai-455c1.firebasestorage.app",
  messagingSenderId: "26113563744",
  appId: "1:26113563744:web:448273de009f0a119eb705",
  measurementId: "G-D7HVXXQ97M"
};

const databaseId = "default";

let app;
let auth: any;
let db: any;
let isFirebaseConfigured = false;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app, databaseId);
  isFirebaseConfigured = true;
  console.log("Firebase client initialized successfully on database:", databaseId);
} catch (error) {
  console.error("Firebase client initialization failed. Falling back to local storage simulation mode.", error);
}

export { auth, db, isFirebaseConfigured };

export interface Task {
  id?: string;
  userId: string;
  title: string;
  description: string;
  deadlineDate: string;
  deadlineTime: string;
  estimatedHours: number;
  difficulty: "Low" | "Medium" | "High";
  category: "Academic" | "Professional" | "Personal" | "Health" | "Finance" | "Other";
  status: "Not Started" | "In Progress" | "Completed";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  urgencyScore: number;
  riskOfFailure: number;
  explanation: string;
  nextRecommendedAction: string;
  createdAt: string;
}

// Data interaction layer
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  // Print highly structured error payload starting with 'Firestore Error: ' as required by Diagnostic Protocol
  console.error('Firestore Error: ' + JSON.stringify(errInfo));
}

function isPermissionError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("permission") || msg.includes("insufficient");
  }
  const str = String(error).toLowerCase();
  return str.includes("permission") || str.includes("insufficient");
}

export const dbService = {
  async getTasks(userId: string): Promise<Task[]> {
    if (isFirebaseConfigured && db && auth?.currentUser && auth.currentUser.uid === userId) {
      try {
        const q = query(collection(db, "tasks"), where("userId", "==", userId));
        const querySnapshot = await getDocs(q);
        const tasks: Task[] = [];
        querySnapshot.forEach((docSnap) => {
          tasks.push({ id: docSnap.id, ...docSnap.data() } as Task);
        });
        return tasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.GET, "tasks");
        }
        console.error("Firestore getTasks error, falling back to local storage:", err);
      }
    }
    // LocalStorage Fallback DB
    const local = localStorage.getItem(`tasks_${userId}`) || "[]";
    return JSON.parse(local);
  },

  async addTask(userId: string, taskData: Omit<Task, "id">): Promise<Task> {
    if (isFirebaseConfigured && db && auth?.currentUser && auth.currentUser.uid === userId) {
      try {
        const docRef = await addDoc(collection(db, "tasks"), { ...taskData, userId });
        return { id: docRef.id, ...taskData, userId };
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, "tasks");
        }
        console.error("Firestore addTask error, falling back to local storage:", err);
      }
    }
    const local = JSON.parse(localStorage.getItem(`tasks_${userId}`) || "[]");
    const newTask = { id: `mock_${Date.now()}`, ...taskData, userId };
    local.push(newTask);
    localStorage.setItem(`tasks_${userId}`, JSON.stringify(local));
    return newTask;
  },

  async updateTask(userId: string, taskId: string, updatedFields: Partial<Task>): Promise<Partial<Task>> {
    if (isFirebaseConfigured && db && auth?.currentUser && auth.currentUser.uid === userId && !taskId.startsWith("mock_")) {
      try {
        const docRef = doc(db, "tasks", taskId);
        await updateDoc(docRef, updatedFields as any);
        return { id: taskId, ...updatedFields };
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.WRITE, `tasks/${taskId}`);
        }
        console.error("Firestore updateTask error, falling back to local storage:", err);
      }
    }
    const local = JSON.parse(localStorage.getItem(`tasks_${userId}`) || "[]");
    const updated = local.map((t: any) => t.id === taskId ? { ...t, ...updatedFields } : t);
    localStorage.setItem(`tasks_${userId}`, JSON.stringify(updated));
    return { id: taskId, ...updatedFields };
  },

  async deleteTask(userId: string, taskId: string): Promise<string> {
    if (isFirebaseConfigured && db && auth?.currentUser && auth.currentUser.uid === userId && !taskId.startsWith("mock_")) {
      try {
        await deleteDoc(doc(db, "tasks", taskId));
        return taskId;
      } catch (err) {
        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
        }
        console.error("Firestore deleteTask error, falling back to local storage:", err);
      }
    }
    const local = JSON.parse(localStorage.getItem(`tasks_${userId}`) || "[]");
    const filtered = local.filter((t: any) => t.id !== taskId);
    localStorage.setItem(`tasks_${userId}`, JSON.stringify(filtered));
    return taskId;
  }
};
