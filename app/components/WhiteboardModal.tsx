"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import dynamic from "next/dynamic";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import "@excalidraw/excalidraw/index.css";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading whiteboard...</p>
      </div>
    ),
  }
);

interface WhiteboardModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (imageData: string, elements: ExcalidrawElement[]) => void;
}

export function WhiteboardModal({ open, onClose, onSave }: WhiteboardModalProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  const handleSave = useCallback(async () => {
    if (!excalidrawAPI) return;

    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) {
      // No drawing, just close
      onClose();
      return;
    }

    const appState = excalidrawAPI.getAppState();

    // Dynamically import exportToBlob to avoid SSR issues
    const { exportToBlob } = await import("@excalidraw/excalidraw");

    // Export as PNG - what you see is what you get
    const blob = await exportToBlob({
      elements,
      appState,
      files: excalidrawAPI.getFiles(),
      mimeType: "image/png",
    });

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      onSave(base64data, elements);
      onClose();
    };
    reader.readAsDataURL(blob);
  }, [excalidrawAPI, onSave, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-background">
        <h2 className="text-lg font-semibold text-foreground">
          Whiteboard
        </h2>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} size="sm" className="gap-2">
            <Check className="h-4 w-4" />
            Save to Chat
          </Button>
          <Button onClick={onClose} variant="ghost" size="icon">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Excalidraw Canvas - Full screen minus header */}
      <div className="absolute top-[73px] bottom-0 left-0 right-0">
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme="light"
          initialData={{
            appState: {
              viewBackgroundColor: "#ffffff",
            },
          }}
        />
      </div>
    </div>
  );
}
