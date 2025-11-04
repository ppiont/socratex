"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Your browser doesn't support audio recording");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);

        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm;codecs=opus'
        });

        console.log("Audio recorded:", audioBlob.size, "bytes");

        // Send to API
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (data.success && data.text) {
            onTranscript(data.text);
            setError(null);
          } else {
            console.error("Transcription failed:", data.error);
            setError(data.error || "Failed to transcribe audio");
          }
        } catch (error) {
          console.error("Error sending audio:", error);
          setError("Network error. Please try again.");
        } finally {
          setIsProcessing(false);
        }

        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      console.log("Recording started");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setError("Microphone access denied. Please allow microphone access.");
        } else if (error.name === "NotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else {
          setError("Could not access microphone: " + error.message);
        }
      } else {
        setError("Could not access microphone");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log("Recording stopped");
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size="icon"
        disabled={disabled || isProcessing}
        onClick={isRecording ? stopRecording : startRecording}
        className={cn(
          "h-10 w-10 shrink-0 rounded-full transition-all",
          isRecording && "bg-destructive hover:bg-destructive/90 animate-pulse"
        )}
        title={isRecording ? "Stop recording" : "Start voice input"}
      >
        {isProcessing ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
        ) : isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {error && (
        <div className="absolute bottom-full left-0 mb-2 z-10 w-64 rounded-lg bg-destructive/10 border border-destructive p-3 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
