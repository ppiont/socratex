"use client";

import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  disabled?: boolean;
}

/**
 * ImageUpload component for uploading math problem images
 * Supports JPG, PNG, and PDF formats up to 4MB
 */
export function ImageUpload({ onUploadComplete, disabled }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { startUpload } = useUploadThing("imageUploader", {
    onClientUploadComplete: (files) => {
      if (files && files[0]) {
        onUploadComplete(files[0].url);
        setIsUploading(false);
        setError(null);
      }
    },
    onUploadError: (error: Error) => {
      console.error("Upload error:", error);
      setError(error.message || "Failed to upload image");
      setIsUploading(false);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (4MB)
    if (file.size > 4 * 1024 * 1024) {
      setError("File size must be less than 4MB");
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setError("Only JPG, PNG, and PDF files are supported");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      await startUpload([file]);
    } catch (err) {
      setError("Failed to upload image");
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        id="image-upload"
        accept="image/jpeg,image/jpg,image/png,application/pdf"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
      />
      <label
        htmlFor="image-upload"
        className={`
          flex h-12 w-12 cursor-pointer items-center justify-center
          rounded-xl border-2 border-gray-300 bg-white text-gray-600
          transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600
          dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400
          dark:hover:border-blue-500 dark:hover:bg-gray-700 dark:hover:text-blue-400
          ${disabled || isUploading ? "cursor-not-allowed opacity-50" : ""}
        `}
        title="Upload image of math problem"
      >
        {isUploading ? (
          <svg
            className="h-5 w-5 animate-spin"
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
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        )}
      </label>

      {error && (
        <div className="absolute left-0 top-14 z-10 w-64 rounded-lg bg-red-50 p-2 text-xs text-red-600 shadow-lg dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
