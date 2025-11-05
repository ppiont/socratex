"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Pi, Menu, ChevronDown, Pencil, Square, RotateCcw, Check, X, Lightbulb, Image, Target, PanelLeftOpen } from "lucide-react";
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
  const [sidebarSize, setSidebarSize] = useState(20); // Default to 20% of screen width
  const [shouldToggle, setShouldToggle] = useState(false); // Flag to trigger programmatic resize
  const isLoading = chatHelpers.status === "streaming" || chatHelpers.status === "submitted";
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isResizingRef = useRef(false);
  const sidebarPanelRef = useRef<React.ComponentRef<typeof ResizablePanel> | null>(null);

  // Persist sidebar size in localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-size");
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      setSidebarSize(parsed);
    }
  }, []);

  // Collapse threshold - when sidebar is less than 8% of screen, consider it collapsed
  const isCollapsed = sidebarSize < 8;

  // Update panel size programmatically when toggling (without remounting)
  useEffect(() => {
    if (shouldToggle && !isResizingRef.current && sidebarPanelRef.current) {
      const panel = sidebarPanelRef.current as { resize?: (size: number) => void; collapse?: () => void; expand?: () => void };
      if (isCollapsed && panel.collapse) {
        panel.collapse();
      } else if (!isCollapsed && sidebarSize > 0 && panel.resize) {
        panel.resize(sidebarSize);
      }
      setShouldToggle(false); // Reset flag
    }
  }, [shouldToggle, isCollapsed, sidebarSize]);

  // Optimized resize handler with snap-to-collapse behavior
  const handleResize = useCallback((size: number) => {
    if (!isResizingRef.current) {
      isResizingRef.current = true;
    }

    // Snap threshold: if dragged below 8%, snap to 0 (collapsed)
    const SNAP_THRESHOLD = 8;

    // Update state immediately during drag
    setSidebarSize(size);

    // Clear existing timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // After drag ends, check if we need to snap
    resizeTimeoutRef.current = setTimeout(() => {
      // If we ended below threshold, snap to collapsed
      if (size < SNAP_THRESHOLD && size > 0) {
        setSidebarSize(0);
        localStorage.setItem("sidebar-size", JSON.stringify(0));
      } else {
        localStorage.setItem("sidebar-size", JSON.stringify(size));
      }
      isResizingRef.current = false;
    }, 100); // Short timeout for quick snap after drag ends
  }, []);

  const toggleSidebar = () => {
    if (isCollapsed) {
      // Expand to default size
      setSidebarSize(20);
    } else {
      // Collapse to minimum
      setSidebarSize(0);
    }
    // Trigger programmatic resize via useEffect
    setShouldToggle(true);
  };

  const [isExtracting, setIsExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

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
    // Modern AI chat behavior (like ChatGPT, Claude, Gemini, Grok):
    // - User message stays in original position
    // - Remove assistant response and everything after it
    // - Regenerate response in place

    // Step 1: Get all messages up to (but not including) the assistant response
    const messagesUpToUser = displayMessages.slice(0, messageIndex);

    // Step 2: Find the last user message in this slice
    const lastUserMessage = messagesUpToUser.filter(m => m.role === "user").pop();
    if (!lastUserMessage) return;

    // Step 3: Find the index of this user message
    const userMessageIndex = messagesUpToUser.lastIndexOf(lastUserMessage);

    // Step 4: Set messages to everything BEFORE the user message
    // This removes the user message so sendMessage can append it cleanly
    const messagesBeforeUser = messagesUpToUser.slice(0, userMessageIndex);
    setStreamMessages(messagesBeforeUser);

    // Step 5: Mark session as actively streaming
    if (currentSessionId) {
      setActiveStreamingSessionId(currentSessionId);
    }

    // Step 6: Use sendMessage to append the user message again
    // This triggers the AI SDK to generate a response
    await chatHelpers.sendMessage({
      parts: lastUserMessage.parts,
    });
  };

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = editTextareaRef.current;
    if (textarea && editingMessageId) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      // Set height to scrollHeight to fit all content
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editingText, editingMessageId]);

  const handleEditMessage = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (messageIndex: number) => {
    if (!editingText.trim()) return;

    // Get messages up to (but not including) the one being edited
    const messagesBeforeEdit = displayMessages.slice(0, messageIndex);
    const editedMessage = displayMessages[messageIndex];

    // Update the message with new text
    const updatedMessage = {
      ...editedMessage,
      parts: [{ type: 'text' as const, text: editingText.trim() }],
    };

    // Set messages to everything BEFORE the edited message
    // This removes the old version so sendMessage can append the updated version
    setStreamMessages(messagesBeforeEdit);

    // Clear editing state
    setEditingMessageId(null);
    setEditingText("");

    // Mark session as actively streaming
    if (currentSessionId) {
      setActiveStreamingSessionId(currentSessionId);
    }

    // Send the updated message (it will be appended cleanly)
    // This also generates a new AI response, and removes everything after (branching)
    await chatHelpers.sendMessage({
      parts: updatedMessage.parts,
    });
  };

  const sessionGroups = groupSessionsByDate(sessions);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile Sidebar - Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <Sidebar
              sessions={sessionGroups}
              currentSessionId={currentSessionId}
              onNewSession={handleNewSession}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
              onToggle={toggleSidebar}
              isCollapsed={isCollapsed}
            />
          </SheetContent>
        </Sheet>

        {/* Desktop Layout with Resizable Sidebar */}
        <ResizablePanelGroup
          direction="horizontal"
          className="hidden md:flex h-screen"
        >
          <ResizablePanel
            ref={sidebarPanelRef}
            defaultSize={sidebarSize || 20}
            minSize={8}
            maxSize={40}
            collapsible
            collapsedSize={0}
            onResize={handleResize}
          >
            <div className="h-full overflow-hidden border-r border-border">
              <Sidebar
                sessions={sessionGroups}
                currentSessionId={currentSessionId}
                onNewSession={handleNewSession}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onRenameSession={handleRenameSession}
                onToggle={toggleSidebar}
                isCollapsed={isCollapsed}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle className="hidden md:flex" />

          <ResizablePanel defaultSize={isCollapsed ? 100 : 100 - sidebarSize} minSize={60}>
            {/* Main Content */}
            <div className="relative flex flex-1 flex-col min-h-0 h-full">
              {/* Sidebar toggle button - Desktop (top left when collapsed) */}
              {isCollapsed && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex absolute top-4 left-4 z-50"
                  onClick={toggleSidebar}
                  aria-label="Show sidebar"
                >
                  <PanelLeftOpen className="h-5 w-5" />
                </Button>
              )}

              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden absolute top-4 left-4 z-50"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {/* Messages Container - Takes full remaining space */}
              <div ref={messagesContainerRef} className="relative flex-1 overflow-y-auto min-w-0">
                {displayMessages.length === 0 && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* Animated gradient background - full width */}
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-3xl animate-float"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "1s" }}></div>
                  </div>
                )}
                <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-32">
                  {displayMessages.length === 0 ? (
                    <div className="relative flex min-h-[60vh] items-center justify-center text-center">
                      <div className="relative space-y-12 max-w-xl animate-scale-in">
                        {/* Enhanced Pi icon with glow */}
                        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm border border-primary/30 shadow-2xl shadow-primary/20 animate-float">
                          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/30 to-accent/30 blur-xl animate-glow-pulse"></div>
                          <Pi className="relative h-12 w-12 text-primary drop-shadow-lg" />
                        </div>

                        {/* Enhanced heading with gradient text */}
                        <div className="space-y-4">
                          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent leading-tight">
                            Welcome to Socratex
                          </h1>
                          <p className="text-muted-foreground text-lg leading-relaxed">
                            I&apos;m your AI math tutor. Share a problem and I&apos;ll guide you through solving it using the Socratic method.
                          </p>
                        </div>

                        {/* Feature cards */}
                        <div className="grid gap-4 max-w-sm mx-auto">
                          <div className="flex items-start gap-3 rounded-lg bg-card/70 backdrop-blur-sm border border-border shadow-md p-4 text-left">
                            <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-muted-foreground">Ask questions to help you think</p>
                          </div>
                          <div className="flex items-start gap-3 rounded-lg bg-card/70 backdrop-blur-sm border border-border shadow-md p-4 text-left">
                            <Image className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-muted-foreground">Upload images of problems</p>
                          </div>
                          <div className="flex items-start gap-3 rounded-lg bg-card/70 backdrop-blur-sm border border-border shadow-md p-4 text-left">
                            <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-muted-foreground">Build understanding step-by-step</p>
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
                            <Avatar className="h-12 w-12 shrink-0 border-2 border-border shadow-lg shadow-black/10">
                              <AvatarImage src="/socrates.png" alt="Socrates" />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-primary text-sm font-semibold">
                                AI
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className={cn(
                            "flex flex-col gap-2 max-w-[90%] md:max-w-[75%]",
                            // Expand to max-width when editing
                            editingMessageId === message.id && "w-full"
                          )}>
                            <div
                              className={cn(
                                "rounded-2xl overflow-hidden relative transition-all duration-200",
                                message.role === "user"
                                  ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25"
                                  : "bg-card border border-border text-card-foreground shadow-md hover:shadow-lg backdrop-blur-sm",
                                // Expand to full available width when editing
                                editingMessageId === message.id && "w-full"
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
                                  // Check if this message is being edited
                                  const isEditing = editingMessageId === message.id;

                                  return (
                                    <div key={i} className="px-4 py-3 pr-12">
                                      {isEditing && message.role === "user" ? (
                                        <textarea
                                          ref={editTextareaRef}
                                          value={editingText}
                                          onChange={(e) => setEditingText(e.target.value)}
                                          className="w-full bg-transparent text-sm leading-relaxed resize-none focus:outline-none overflow-hidden"
                                          autoFocus
                                          rows={1}
                                        />
                                      ) : (
                                        <MathRenderer
                                          content={part.text}
                                          className="text-sm leading-relaxed"
                                        />
                                      )}
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
                              {message.role === "user" && editingMessageId === message.id ? (
                                // Show save/cancel buttons when editing
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSaveEdit(index)}
                                    className="h-7 w-7 hover:bg-secondary text-green-600"
                                    aria-label="Save edit"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCancelEdit}
                                    className="h-7 w-7 hover:bg-secondary text-red-600"
                                    aria-label="Cancel edit"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : message.role === "user" ? (
                                // Show edit button for user messages
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditMessage(
                                    message.id,
                                    message.parts.find(p => p.type === "text")?.text || ""
                                  )}
                                  className="h-7 w-7 hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                                  aria-label="Edit message"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                // Show regenerate and audio player for assistant messages
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
                            <Avatar className="h-12 w-12 shrink-0 border-2 border-border shadow-lg shadow-black/10">
                              <AvatarFallback className="bg-gradient-to-br from-accent/20 to-primary/10 text-accent font-semibold">
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
                          <div className="flex gap-3 animate-scale-in">
                            <Avatar className="h-12 w-12 shrink-0 border-2 border-border shadow-lg shadow-black/10">
                              <AvatarImage src="/socrates.png" alt="Socrates" />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-primary text-sm font-semibold">
                                AI
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-2 max-w-[75%]">
                              <div className="rounded-2xl overflow-hidden bg-card border border-border text-card-foreground px-4 py-3 shadow-md">
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
                <div className="absolute bottom-32 right-8 z-20 animate-scale-in">
                  <Button
                    onClick={scrollToBottom}
                    size="icon"
                    className="rounded-full shadow-2xl shadow-black/30 hover:shadow-2xl hover:shadow-primary/15 hover:scale-110 transition-all duration-300 bg-card/80 backdrop-blur-xl border border-border/50 hover:bg-secondary hover:border-primary/50"
                    aria-label="Scroll to bottom"
                  >
                    <ChevronDown className="h-5 w-5 text-foreground" />
                  </Button>
                </div>
              )}

              {/* Absolutely positioned floating input with gradient */}
              <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
                {/* Enhanced gradient fade */}
                <div className="h-32 bg-gradient-to-t from-background via-background/80 to-transparent" />

                {/* Input area */}
                <div className="bg-background/90 backdrop-blur-md px-6 pb-6">
                  <div className="mx-auto w-full max-w-4xl pointer-events-auto">
                    {isExtracting && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg glass p-3 text-sm text-accent shadow-lg animate-scale-in">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                        <span>Extracting math from image...</span>
                      </div>
                    )}
                    <form onSubmit={handleSubmit} className="relative">
                      <div className="flex items-center gap-3 rounded-full border border-border/50 bg-card/80 backdrop-blur-xl px-5 py-3 shadow-2xl shadow-black/20 transition-all duration-300 focus-within:border-primary/50 focus-within:shadow-2xl focus-within:shadow-primary/10 hover:shadow-2xl hover:shadow-black/30">
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
          </ResizablePanel>
        </ResizablePanelGroup>

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
