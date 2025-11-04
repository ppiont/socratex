"use client";

import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Paperclip,
  Image as ImageIcon,
  FileText,
  Clock
} from "lucide-react";

interface AttachmentMenuProps {
  onUploadComplete: (url: string) => void;
  disabled?: boolean;
}

export function AttachmentMenu({ onUploadComplete, disabled }: AttachmentMenuProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const { startUpload } = useUploadThing("imageUploader", {
    onClientUploadComplete: (files) => {
      if (files && files[0]) {
        onUploadComplete(files[0].url);
        setIsUploading(false);
        setError(null);
        setIsOpen(false);
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

    // Reset input
    e.target.value = "";
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

      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || isUploading}
            className="h-10 w-10 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          side="top"
          className="w-64 bg-card p-2"
        >
          <DropdownMenuItem
            onClick={() => document.getElementById("image-upload")?.click()}
            className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer"
          >
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Upload an image</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled
            className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer opacity-50"
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Add text content</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled
            className="flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer opacity-50"
          >
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Recent</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <div className="absolute bottom-full left-0 mb-2 z-10 w-64 rounded-lg bg-destructive/10 border border-destructive p-3 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
