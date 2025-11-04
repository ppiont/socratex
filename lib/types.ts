import type { Message } from "@ai-sdk/react";

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionGroup {
  label: string;
  sessions: ChatSession[];
}
