"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  text: string;
  messageId: string;
  className?: string;
}

export function AudioPlayer({ text, messageId, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Add small delay before revoking to prevent race condition
      if (audioUrlRef.current) {
        const urlToRevoke = audioUrlRef.current;
        setTimeout(() => {
          try {
            URL.revokeObjectURL(urlToRevoke);
          } catch (e) {
            // URL already revoked or invalid
          }
        }, 100);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = async () => {
    if (isPlaying) {
      // Stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    // Start playback
    try {
      setIsLoading(true);
      setError(null);

      // If we already have audio loaded, just play it
      if (audioRef.current && audioUrlRef.current) {
        audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
        return;
      }

      // Generate audio
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate speech");
      }

      // Get audio blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      // Create audio element
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // Set up event listeners
      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = () => {
        setError("Failed to play audio");
        setIsPlaying(false);
      };

      // Play audio
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error("TTS error:", err);
      }
      setError("Failed to generate speech");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePlayPause}
        disabled={isLoading}
        className="h-7 gap-1.5 px-2 text-xs"
        title={isPlaying ? "Stop reading" : "Read aloud"}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isPlaying ? (
          <VolumeX className="h-3.5 w-3.5" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
        {isPlaying ? "Stop" : "Read aloud"}
      </Button>

      {error && (
        <div className="absolute top-full left-0 mt-1 z-10 rounded-md bg-destructive/10 border border-destructive px-2 py-1 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
