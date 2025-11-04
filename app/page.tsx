"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MathRenderer } from "./components/MathRenderer";
import { AttachmentMenu } from "./components/AttachmentMenu";
import { Sidebar } from "./components/Sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Mic, Send, Sparkles, Menu } from "lucide-react";
import {
  getAllSessions,
  saveSession,
  deleteSession,
  updateSessionTitle,
  getCurrentSessionId,
  setCurrentSessionId,
  generateSessionTitle,
  groupSessionsByDate,
} from "@/lib/session-storage";
import type { ChatSession } from "@/lib/types";

export default function Home() {
  const chatHelpers = useChat({
    id: "socratex-session",
  });
  const { messages, setMessages } = chatHelpers;

  const [input, setInput] = useState("");
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoading = chatHelpers.status === "streaming" || chatHelpers.status === "submitted";

  const [isExtracting, setIsExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize sessions and current session on mount
  useEffect(() => {
    const allSessions = getAllSessions();
    setSessions(allSessions);

    const savedSessionId = getCurrentSessionId();
    if (savedSessionId) {
      const session = allSessions.find((s) => s.id === savedSessionId);
      if (session) {
        setCurrentSessionIdState(savedSessionId);
        setMessages(session.messages);
      }
    }
  }, [setMessages]);

  // Save current session whenever messages change
  useEffect(() => {
    if (messages.length === 0) return;

    const sessionId = currentSessionId || `session-${Date.now()}`;

    if (!currentSessionId) {
      setCurrentSessionIdState(sessionId);
      setCurrentSessionId(sessionId);
    }

    const session: ChatSession = {
      id: sessionId,
      title: generateSessionTitle(messages),
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    saveSession(session);

    // Update sessions list
    const allSessions = getAllSessions();
    setSessions(allSessions);
  }, [messages, currentSessionId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageContent = input.trim();
    setInput("");

    await chatHelpers.sendMessage({
      parts: [{ type: "text", text: messageContent }],
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter, newline on Shift+Enter
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageUpload = async (url: string) => {
    setIsExtracting(true);

    try {
      // Call OCR endpoint to extract math from image
      const response = await fetch("/api/extract-math", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });

      const data = await response.json();

      if (data.success && data.latex) {
        // Automatically send the extracted problem to the chat
        const message = `I have this math problem: ${data.latex}\n\nCan you help me solve it?`;
        await chatHelpers.sendMessage({
          parts: [{ type: "text", text: message }],
        });
      } else {
        // Fallback if OCR fails - just notify user
        console.error("OCR failed:", data.error);
      }
    } catch (error) {
      console.error("Failed to extract math:", error);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setCurrentSessionIdState(null);
    setCurrentSessionId("");
    setSidebarOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionIdState(sessionId);
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setSidebarOpen(false);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    const allSessions = getAllSessions();
    setSessions(allSessions);

    // If deleting current session, clear it
    if (sessionId === currentSessionId) {
      handleNewSession();
    }
  };

  const handleRenameSession = (sessionId: string, title: string) => {
    updateSessionTitle(sessionId, title);
    const allSessions = getAllSessions();
    setSessions(allSessions);
  };

  const sessionGroups = groupSessionsByDate(sessions);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0">
        <Sidebar
          sessions={sessionGroups}
          currentSessionId={currentSessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar
            sessions={sessionGroups}
            currentSessionId={currentSessionId}
            onNewSession={handleNewSession}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    Socratex
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    AI Math Tutor
                  </p>
                </div>
              </div>
            </div>
            {messages.length > 0 && (
              <Button
                onClick={handleNewSession}
                variant="ghost"
                size="sm"
                className="text-sm"
              >
                New Chat
              </Button>
            )}
          </div>
        </header>

      {/* Messages Container */}
      <ScrollArea className="flex-1">
        <main className="mx-auto w-full max-w-4xl px-6 py-8">
          {messages.length === 0 ? (
            <div className="flex min-h-[60vh] items-center justify-center text-center">
              <div className="space-y-6 max-w-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Welcome to Socratex
                  </h2>
                  <p className="text-muted-foreground">
                    I'm your AI math tutor. Share a problem and I'll guide you through solving it using the Socratic method.
                  </p>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="rounded-lg bg-card border border-border p-3 text-left">
                    <p className="text-muted-foreground">💡 Ask questions to help you think</p>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3 text-left">
                    <p className="text-muted-foreground">📸 Upload images of problems</p>
                  </div>
                  <div className="rounded-lg bg-card border border-border p-3 text-left">
                    <p className="text-muted-foreground">🎯 Build understanding step-by-step</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0 border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-card-foreground"
                    )}
                  >
                    {message.parts
                      .filter((part) => part.type === "text")
                      .map((part, i) => (
                        <MathRenderer
                          key={i}
                          content={part.text}
                          className="text-sm leading-relaxed"
                        />
                      ))}
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-8 w-8 shrink-0 border border-border">
                      <AvatarFallback className="bg-accent/10 text-accent text-xs">
                        You
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8 shrink-0 border border-border">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl bg-card border border-border px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]"></div>
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>
      </ScrollArea>

      {/* Input Area - Fixed at bottom */}
      <div className="shrink-0 bg-background px-6 py-4">
        <div className="mx-auto w-full max-w-4xl">
          {isExtracting && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 p-3 text-sm text-accent">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span>Extracting math from image...</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-sm transition-all focus-within:border-primary/50 focus-within:shadow-md">
              <AttachmentMenu
                onUploadComplete={handleImageUpload}
                disabled={isLoading || isExtracting}
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What do you want to know?"
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[20px] max-h-[200px]"
                rows={1}
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                className="h-8 shrink-0 gap-1 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <Sparkles className="h-3 w-3" />
                Auto
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
              >
                <Mic className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
