"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MathRenderer } from "./components/MathRenderer";
import { ImageUpload } from "./components/ImageUpload";

export default function Home() {
  const chatHelpers = useChat();
  const { messages, setMessages } = chatHelpers;

  const [input, setInput] = useState("");
  const isLoading = chatHelpers.status === "streaming" || chatHelpers.status === "submitted";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_extractedProblem, setExtractedProblem] = useState<{
    problem: string;
    latex: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    setUploadedImageUrl(url);
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
        setExtractedProblem({
          problem: data.problem,
          latex: data.latex,
        });
        // Show confirmation message - would need to be handled differently with useChat
        // For now, just let user type their question
        alert(`Extracted: ${data.latex}\n\nNow type your question about this problem.`);
      } else {
        // Fallback if OCR fails
        alert(`OCR failed. Please describe the problem from the image.`);
      }
    } catch (error) {
      console.error("Failed to extract math:", error);
      alert(`Failed to extract math. Please describe the problem.`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleNewSession = () => {
    if (
      messages.length > 0 &&
      !confirm(
        "Are you sure you want to start a new session? This will clear all conversation history."
      )
    ) {
      return;
    }
    setMessages([]);
    setUploadedImageUrl(null);
    setExtractedProblem(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Socratex
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your AI Math Tutor - Learn through guided questioning
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleNewSession}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      {/* Messages Container */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-hidden px-4 py-6">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <div className="space-y-4">
                <div className="text-4xl">📐</div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Welcome to Socratex!
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Share a math problem and I&apos;ll guide you through solving it
                  together.
                  <br />
                  Let&apos;s learn by exploring!
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white"
                  )}
                >
                  {message.parts
                    .filter((part) => part.type === "text")
                    .map((part, i) => (
                      <MathRenderer
                        key={i}
                        content={part.text}
                        className="whitespace-pre-wrap wrap-break-word"
                      />
                    ))}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3 dark:bg-gray-800">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-500"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white pt-4 dark:border-gray-700 dark:bg-gray-900">
          {isExtracting && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              <svg
                className="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Extracting math from image...</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <ImageUpload
              onUploadComplete={handleImageUpload}
              disabled={isLoading || isExtracting}
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your math question or upload an image... (Shift+Enter for new line)"
              className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
              rows={2}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </form>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Press Enter to send</span>
            <span>•</span>
            <span>Shift+Enter for new line</span>
          </div>
        </div>
      </main>
    </div>
  );
}
