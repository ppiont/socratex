import type { Message } from "@ai-sdk/react";
import type { ChatSession, SessionGroup } from "./types";

const SESSIONS_KEY = "socratex-sessions";
const CURRENT_SESSION_KEY = "socratex-current-session";

export function getAllSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (!stored) return [];

    const sessions = JSON.parse(stored);
    // Convert date strings back to Date objects
    return sessions.map((s: ChatSession) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    }));
  } catch (error) {
    console.error("Failed to load sessions:", error);
    return [];
  }
}

export function saveSession(session: ChatSession): void {
  if (typeof window === "undefined") return;

  try {
    const sessions = getAllSessions();
    const index = sessions.findIndex((s) => s.id === session.id);

    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.unshift(session); // Add new session at the beginning
    }

    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save session:", error);
  }
}

export function deleteSession(sessionId: string): void {
  if (typeof window === "undefined") return;

  try {
    const sessions = getAllSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to delete session:", error);
  }
}

export function updateSessionTitle(sessionId: string, title: string): void {
  if (typeof window === "undefined") return;

  try {
    const sessions = getAllSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (session) {
      session.title = title;
      session.updatedAt = new Date();
      saveSession(session);
    }
  } catch (error) {
    console.error("Failed to update session title:", error);
  }
}

export function getCurrentSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return localStorage.getItem(CURRENT_SESSION_KEY);
  } catch (error) {
    console.error("Failed to get current session:", error);
    return null;
  }
}

export function setCurrentSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
  } catch (error) {
    console.error("Failed to set current session:", error);
  }
}

export function generateSessionTitle(messages: Message[]): string {
  // Find the first user message
  const firstUserMessage = messages.find((m) => m.role === "user");

  if (!firstUserMessage) {
    return "New Chat";
  }

  // Get first text part
  const textPart = firstUserMessage.parts.find((p) => p.type === "text");
  if (!textPart || !textPart.text) {
    return "New Chat";
  }

  // Truncate to first 50 characters
  const text = textPart.text.trim();
  return text.length > 50 ? text.substring(0, 50) + "..." : text;
}

export function groupSessionsByDate(sessions: ChatSession[]): SessionGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  const groups: SessionGroup[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Last 7 Days", sessions: [] },
    { label: "Last 30 Days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  sessions.forEach((session) => {
    const sessionDate = new Date(session.updatedAt);

    if (sessionDate >= today) {
      groups[0].sessions.push(session);
    } else if (sessionDate >= yesterday) {
      groups[1].sessions.push(session);
    } else if (sessionDate >= lastWeek) {
      groups[2].sessions.push(session);
    } else if (sessionDate >= lastMonth) {
      groups[3].sessions.push(session);
    } else {
      groups[4].sessions.push(session);
    }
  });

  // Filter out empty groups
  return groups.filter((g) => g.sessions.length > 0);
}
