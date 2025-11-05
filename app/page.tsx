"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MathRenderer } from "./components/MathRenderer";
import { AttachmentMenu } from "./components/AttachmentMenu";
import { Sidebar } from "./components/Sidebar";
import { VoiceInput } from "./components/VoiceInput";
import { AudioPlayer } from "./components/AudioPlayer";
import { WhiteboardModal } from "./components/WhiteboardModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MessageActions } from "./components/MessageActions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Pi, Menu, ChevronDown, Pencil, Square, RotateCcw } from "lucide-react";
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
  const [currentSessionId, setCurrentSessionIdState] = useState<string | null>(null);
  const [activeStreamingSessionId, setActiveStreamingSessionId] = useState<string | null>(null);

  // Use a stable ID for the chat hook to prevent stream cancellation when switching sessions
  const chatHelpers = useChat({
    id: "socratex-active-chat",
  });
  const { messages: streamMessages, setMessages: setStreamMessages, stop: stopGeneration } = chatHelpers;

  // Display messages - either from the active stream or loaded from a session
  const [displayMessages, setDisplayMessages] = useState<typeof streamMessages>([]);
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLoading = chatHelpers.status === "streaming" || chatHelpers.status === "submitted";

  const [isExtracting, setIsExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);

  // Initialize sessions and current session on mount
  useEffect(() => {
    const allSessions = getAllSessions();
    setSessions(allSessions);

    const savedSessionId = getCurrentSessionId();
    if (savedSessionId) {
      const session = allSessions.find((s) => s.id === savedSessionId);
      if (session) {
        setCurrentSessionIdState(savedSessionId);
        setDisplayMessages(session.messages);
        setStreamMessages(session.messages);
      }
    }
  }, [setStreamMessages]);

  // Sync stream messages to display when viewing the active streaming session
  useEffect(() => {
    // If we're viewing the session that's currently streaming, show live updates
    if (activeStreamingSessionId && currentSessionId === activeStreamingSessionId) {
      setDisplayMessages(streamMessages);
    }
  }, [streamMessages, activeStreamingSessionId, currentSessionId]);

  // Clear active streaming session when stream completes
  useEffect(() => {
    if (!isLoading && activeStreamingSessionId) {
      // Stream has completed, clear the active streaming flag
      setActiveStreamingSessionId(null);
    }
  }, [isLoading, activeStreamingSessionId]);

  // Save streaming session whenever stream messages change
  useEffect(() => {
    if (streamMessages.length === 0) return;
    if (!activeStreamingSessionId) return;

    const session: ChatSession = {
      id: activeStreamingSessionId,
      title: generateSessionTitle(streamMessages),
      messages: streamMessages,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    saveSession(session);

    // Update sessions list
    const allSessions = getAllSessions();
    setSessions(allSessions);

    // If viewing this session, update display
    if (currentSessionId === activeStreamingSessionId) {
      setDisplayMessages(streamMessages);
    }
  }, [streamMessages, activeStreamingSessionId, currentSessionId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [displayMessages]);

  // Handle scroll to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [messagesContainerRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + L: Focus input
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        inputRef.current?.focus();
      }

      // Cmd/Ctrl + N: New chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        // Inline the new session logic to avoid dependency issues
        setInput("");
        setDisplayMessages([]);
        setStreamMessages([]);
        setCurrentSessionIdState(null);
        setCurrentSessionId("");
        setActiveStreamingSessionId(null);
        setSidebarOpen(false);
      }

      // Escape: Stop generation if loading
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        stopGeneration();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, stopGeneration, setStreamMessages]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const messageContent = input.trim();
    setInput("");

    // Create or use current session for this message
    const sessionId = currentSessionId || `session-${Date.now()}`;
    if (!currentSessionId) {
      setCurrentSessionIdState(sessionId);
      setCurrentSessionId(sessionId);
    }

    // Mark this session as actively streaming
    setActiveStreamingSessionId(sessionId);

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

  const handleImageUpload = async (base64: string) => {
    setIsExtracting(true);

    try {
      // Call OCR endpoint to extract math from image with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch("/api/extract-math", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64 }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error("Image processing is busy. Please try again.");
      }

      const data = await response.json();

      if (data.success && data.latex) {
        // Create or use current session
        const sessionId = currentSessionId || `session-${Date.now()}`;
        if (!currentSessionId) {
          setCurrentSessionIdState(sessionId);
          setCurrentSessionId(sessionId);
        }
        setActiveStreamingSessionId(sessionId);

        // Automatically send the extracted problem to the chat
        const message = `I have this math problem: ${data.latex}\n\nCan you help me solve it?`;
        await chatHelpers.sendMessage({
          parts: [{ type: "text", text: message }],
        });
      } else {
        // Fallback if OCR fails - just notify user
        if (process.env.NODE_ENV === 'development') {
          console.error("OCR failed:", data.error);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        alert("Image extraction timeout. Please try again.");
      } else if (process.env.NODE_ENV === 'development') {
        console.error("Failed to extract math:", error);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleWhiteboardSave = async (imageData: string) => {
    try {
      // Create or use current session
      const sessionId = currentSessionId || `session-${Date.now()}`;
      if (!currentSessionId) {
        setCurrentSessionIdState(sessionId);
        setCurrentSessionId(sessionId);
      }
      setActiveStreamingSessionId(sessionId);

      // Send whiteboard image directly to vision model for visual understanding
      // This allows geometric diagrams, graphs, and visual concepts - not just equations
      await chatHelpers.sendMessage({
        parts: [
          {
            type: "text",
            text: "Here's my whiteboard drawing. Can you help me understand this math concept?"
          },
          {
            type: "file",
            mediaType: "image/png",
            url: imageData, // data URL is supported by AI SDK
          },
        ],
      });
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to send whiteboard:", error);
      }
      alert("Failed to send whiteboard. Please try again.");
    }
  };

  const handleNewSession = () => {
    // Clear all state when starting a new session
    setInput("");
    setDisplayMessages([]);
    setStreamMessages([]);
    setCurrentSessionIdState(null);
    setCurrentSessionId("");
    setActiveStreamingSessionId(null);
    setSidebarOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      // Clear any ongoing input before switching
      setInput("");
      setCurrentSessionIdState(sessionId);
      setCurrentSessionId(sessionId);

      // If this is the actively streaming session, show stream messages
      // Otherwise, load the saved session messages
      if (sessionId === activeStreamingSessionId) {
        setDisplayMessages(streamMessages);
      } else {
        setDisplayMessages(session.messages);
      }

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

  const handleRegenerateResponse = async (messageIndex: number) => {
    // Find messages up to but not including the assistant message we're regenerating
    const messagesUpToIndex = displayMessages.slice(0, messageIndex);

    // Update messages to remove the assistant response
    setStreamMessages(messagesUpToIndex);

    // Mark this session as actively streaming
    if (currentSessionId) {
      setActiveStreamingSessionId(currentSessionId);
    }

    // Find the last user message parts
    const lastUserMessage = messagesUpToIndex.filter(m => m.role === "user").pop();
    if (lastUserMessage && lastUserMessage.parts.length > 0) {
      // Resend the user message using sendMessage
      await chatHelpers.sendMessage({
        parts: lastUserMessage.parts,
      });
    }
  };

  const sessionGroups = groupSessionsByDate(sessions);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-background">
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
        <div className="relative flex flex-1 flex-col min-h-0">
          {/* Mobile menu button - floating */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden absolute top-4 left-4 z-50"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Messages Container - Takes full remaining space */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-w-0">
            <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-32">
              {displayMessages.length === 0 ? (
                <div className="flex min-h-[60vh] items-center justify-center text-center">
                  <div className="space-y-6 max-w-md">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                      <Pi className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold text-foreground">
                        Welcome to Socratex
                      </h2>
                      <p className="text-muted-foreground">
                        I&apos;m your AI math tutor. Share a problem and I&apos;ll guide you through solving it using the Socratic method.
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
                  {displayMessages.map((message, index) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3 group",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role === "assistant" && (
                        <Avatar className="h-12 w-12 shrink-0 border border-border">
                          <AvatarImage src="/socrates.png" alt="Socrates" />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            AI
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex flex-col gap-2 max-w-[90%] md:max-w-[75%]">
                        <div
                          className={cn(
                            "rounded-2xl overflow-hidden relative",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border border-border text-card-foreground"
                          )}
                        >
                          {/* Copy button inside bubble - top right */}
                          <MessageActions
                            content={message.parts
                              .filter((part) => part.type === "text")
                              .map((part) => part.text)
                              .join("\n")}
                            className="absolute top-2 right-2 z-10"
                          />

                          {message.parts.map((part, i) => {
                            if (part.type === "text") {
                              return (
                                <div key={i} className="px-4 py-3 pr-12">
                                  <MathRenderer
                                    content={part.text}
                                    className="text-sm leading-relaxed"
                                  />
                                </div>
                              );
                            } else if (part.type === "file") {
                              return (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={i}
                                  src={part.url}
                                  alt={part.filename || "Whiteboard drawing"}
                                  className="w-full max-w-md rounded"
                                />
                              );
                            }
                            return null;
                          })}
                        </div>
                        <div className="flex items-center gap-2 px-2">
                          {message.role === "assistant" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRegenerateResponse(index)}
                                className="h-7 w-7 hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Regenerate response"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                              <AudioPlayer
                                text={message.parts
                                  .filter((part) => part.type === "text")
                                  .map((part) => part.text)
                                  .join(" ")}
                                messageId={message.id}
                              />
                            </>
                          )}
                          <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                            {new Date().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      {message.role === "user" && (
                        <Avatar className="h-12 w-12 shrink-0 border border-border">
                          <AvatarFallback className="bg-accent/10 text-accent">
                            You
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))}

                  {/* Typing indicator - only show before streaming starts */}
                  {isLoading &&
                    displayMessages.length > 0 &&
                    displayMessages[displayMessages.length - 1]?.role !== "assistant" && (
                      <div className="flex gap-3">
                        <Avatar className="h-12 w-12 shrink-0 border border-border">
                          <AvatarImage src="/socrates.png" alt="Socrates" />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            AI
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2 max-w-[75%]">
                          <div className="rounded-2xl overflow-hidden bg-card border border-border text-card-foreground px-4 py-3">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]"></div>
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]"></div>
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </main>
          </div>

          {/* Scroll to bottom button */}
          {showScrollButton && displayMessages.length > 0 && (
            <div className="absolute bottom-32 right-8 z-20">
              <Button
                onClick={scrollToBottom}
                size="icon"
                className="rounded-full shadow-lg hover:shadow-xl transition-all bg-card border border-border hover:bg-secondary"
                aria-label="Scroll to bottom"
              >
                <ChevronDown className="h-5 w-5 text-foreground" />
              </Button>
            </div>
          )}

          {/* Absolutely positioned floating input with gradient */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            {/* Gradient fade */}
            <div className="h-24 bg-linear-to-t from-background to-transparent" />

            {/* Input area */}
            <div className="bg-background/80 backdrop-blur-sm px-6 pb-6">
              <div className="mx-auto w-full max-w-4xl pointer-events-auto">
                {isExtracting && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 p-3 text-sm text-accent">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    <span>Extracting math from image...</span>
                  </div>
                )}
                <form onSubmit={handleSubmit} className="relative">
                  <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-lg transition-all focus-within:border-primary/50 focus-within:shadow-xl">
                    <AttachmentMenu
                      onUploadComplete={handleImageUpload}
                      disabled={isLoading || isExtracting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setWhiteboardOpen(true)}
                      disabled={isLoading || isExtracting}
                      className="shrink-0 h-8 w-8"
                      aria-label="Open whiteboard"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="What do you want to know?"
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[20px] max-h-[200px]"
                      rows={1}
                      disabled={isLoading}
                    />
                    {isLoading ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={stopGeneration}
                        className="shrink-0 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Stop generating"
                      >
                        <Square className="h-4 w-4 fill-current" />
                      </Button>
                    ) : (
                      <VoiceInput
                        onTranscript={(text) => {
                          setInput(text);
                        }}
                        disabled={isLoading || isExtracting}
                      />
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Whiteboard Modal */}
        <WhiteboardModal
          open={whiteboardOpen}
          onClose={() => setWhiteboardOpen(false)}
          onSave={handleWhiteboardSave}
        />
      </div>
    </ErrorBoundary>
  );
}
