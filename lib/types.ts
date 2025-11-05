import type { UIMessage } from "@ai-sdk/react";

export interface ChatSession {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionGroup {
  label: string;
  sessions: ChatSession[];
}
