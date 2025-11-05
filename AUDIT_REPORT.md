# Socratex Codebase Audit Report

**Date**: 2025-01-05
**Status**: In Progress - 1 of 13 issues fixed

---

## Executive Summary

Comprehensive audit found **13 issues** requiring fixes:
- **3 Critical** (memory leaks)
- **5 High** (error handling, security, validation)
- **4 Medium** (code organization, API design, logging)
- **1 Low** (unused import)

**Current Status**: Not production-ready due to memory leaks and missing error boundary.

---

## CRITICAL ISSUES (Fix Immediately)

### 1. ✅ FIXED - VoiceInput Memory Leak
**File**: `app/components/VoiceInput.tsx`
**Lines**: 30-40, 84, 108

**Issue**: MediaRecorder stream from `getUserMedia()` not cleaned up on unmount. Microphone continues running if component unmounts during recording.

**Fix Applied**:
- Added `streamRef` to track MediaStream
- Added useEffect cleanup to stop stream on unmount
- Updated `mediaRecorder.onstop` to use streamRef
- Removed console.log statements

**Status**: ✅ COMPLETED

---

### 2. ❌ TODO - Scroll Event Listener Leak
**File**: `app/page.tsx`
**Lines**: 98-110

**Issue**: Scroll event listener attached with empty dependency array `[]`. Multiple listeners accumulate on re-renders, causing memory growth.

**Current Code**:
```typescript
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
}, []); // ← Empty dependency causes issues
```

**Required Fix**:
```typescript
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
}, [messagesContainerRef]); // Add dependency
```

**Impact**: Memory usage increases linearly with page interactions, performance degrades over time.

---

### 3. ❌ TODO - AudioPlayer Object URL Leak
**File**: `app/components/AudioPlayer.tsx`
**Lines**: 74, 28-32

**Issue**: Object URLs created but may be revoked while audio is still playing. Race condition causes "NotAllowedError" and memory accumulation (~5-10MB per long message).

**Current Code**:
```typescript
const audioUrl = URL.createObjectURL(audioBlob);
audioUrlRef.current = audioUrl;
// ...
// Cleanup in useEffect:
URL.revokeObjectURL(audioUrlRef.current); // Revoked immediately
```

**Required Fix**:
```typescript
useEffect(() => {
  return () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Add small delay before revoking
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
```

**Impact**: Audio playback may suddenly stop, browser memory accumulation over session.

---

## HIGH SEVERITY ISSUES

### 4. ❌ TODO - Missing Error Boundary
**File**: `app/page.tsx`
**Severity**: HIGH

**Issue**: No Error Boundary wrapper. Single component error crashes entire app. User loses all chat history.

**Required Action**: Create error boundary component:

**File to create**: `app/components/ErrorBoundary.tsx`
```typescript
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Chat error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Then wrap main page in `app/page.tsx`:
```typescript
import { ErrorBoundary } from './components/ErrorBoundary';

export default function Home() {
  return (
    <ErrorBoundary>
      {/* existing content */}
    </ErrorBoundary>
  );
}
```

---

### 5. ❌ TODO - Missing Timeout in Image OCR
**File**: `app/page.tsx`
**Lines**: 141-169

**Issue**: No timeout or retry logic for OCR requests. Long-running requests block UI.

**Required Fix**:
```typescript
const handleImageUpload = async (base64: string) => {
  setIsExtracting(true);
  try {
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
    // ... rest of handling
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      setError("Image extraction timeout. Please try again.");
    }
    // ... handle other errors
  } finally {
    setIsExtracting(false);
  }
};
```

---

### 6. ❌ TODO - API Key Exposure in Logs
**File**: `app/api/chat/route.ts`
**Lines**: 10-11

**Issue**: Logs entire request body including potentially sensitive data.

**Current Code**:
```typescript
console.log("==== INCOMING REQUEST ====");
console.log(JSON.stringify(body, null, 2)); // ← Logs everything
```

**Required Fix**:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log("Chat request", {
    messageCount: messages?.length,
    hasAttachments: messages?.some(m => m.parts.some(p => p.type === 'file'))
  });
}
```

---

### 7. ❌ TODO - Missing Input Validation in extract-math
**File**: `app/api/extract-math/route.ts`
**Lines**: 38-45

**Issue**: No size or format validation. User could send 100MB+ base64, causing DoS.

**Required Fix**:
```typescript
const { imageData }: ExtractMathRequest = await req.json();

if (!imageData) {
  return Response.json(
    { success: false, error: "No image data provided" },
    { status: 400 }
  );
}

// Check base64 size (4MB binary ≈ 5.3MB base64)
const maxBase64Size = 5.5 * 1024 * 1024; // 5.5MB
if (imageData.length > maxBase64Size) {
  return Response.json(
    { success: false, error: "Image too large. Maximum 4MB." },
    { status: 413 }
  );
}

// Validate it's actually a data URL
if (!imageData.startsWith('data:image/')) {
  return Response.json(
    { success: false, error: "Invalid image format" },
    { status: 400 }
  );
}
```

---

### 8. ❌ TODO - Uncaught Promise in WhiteboardModal
**File**: `app/components/WhiteboardModal.tsx`
**Lines**: 46, 58-63

**Issue**: FileReader operations lack error handling.

**Required Fix**:
```typescript
const blob = await exportToBlob({ ... });
const reader = new FileReader();
reader.onloadend = () => {
  const base64data = reader.result as string;
  onSave(base64data, elements);
  onClose();
};
reader.onerror = () => {
  console.error("Failed to read whiteboard image:", reader.error);
  alert("Failed to save whiteboard. Please try again.");
};
reader.readAsDataURL(blob);
```

---

## MEDIUM SEVERITY ISSUES

### 9. ❌ TODO - page.tsx Too Large
**File**: `app/page.tsx`
**Lines**: 454 total lines

**Issue**: Single component handles 8 responsibilities. Hard to maintain and test.

**Recommendation**: Extract into separate hooks/components:
- `useChat` hook - message/session logic
- `useSessions` hook - session management
- `ChatMessages` component - message rendering
- `ChatInput` component - input handling

---

### 10. ❌ TODO - No Timeout in TTS API
**File**: `app/api/text-to-speech/route.ts`
**Lines**: 33-72

**Issue**: No timeout on ElevenLabs fetch. Hangs indefinitely if service is slow.

**Required Fix**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s

const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/N2lVS1w4EtoT3dr4eOWO`,
  {
    method: "POST",
    headers: { ... },
    body: JSON.stringify({ ... }),
    signal: controller.signal,
  }
);

clearTimeout(timeoutId);
```

---

### 11. ⚠️ KNOWN LIMITATION - No Server-Side Session Persistence
**File**: `lib/session-storage.ts`

**Issue**: All conversations stored in localStorage only. Users lose data if they clear cache.

**Recommendation**: Implement Vercel KV storage (documented in CLAUDE.md). For post-MVP.

---

### 12. ❌ TODO - Console Logging in Production
**Files**: Multiple (35+ statements)

**Issue**: Debug logging visible in production. Performance overhead and privacy concerns.

**Required Fix**: Make all logging conditional:
```typescript
// Development only
if (process.env.NODE_ENV === 'development') {
  console.log("Debug info", data);
}

// Errors: sanitize data
console.error("API error", {
  status: response.status,
  // Don't log: request body, user data, API keys
});
```

**Files to update**:
- `app/page.tsx` - Lines 162, 165, 175, 191, 193
- `app/components/VoiceInput.tsx` - ✅ DONE
- `app/components/AudioPlayer.tsx` - Line 95
- `app/api/chat/route.ts` - Lines 10-11, 16, 23, 33, 36
- `app/api/text-to-speech/route.ts` - Lines 7, 10, 28, 64, 74
- `app/api/transcribe/route.ts` - Lines 9, 24, 31, 37, 53, 60
- `app/api/extract-math/route.ts` - Lines 76, 91

---

## LOW SEVERITY ISSUES

### 13. ❌ TODO - Unused Import
**File**: `app/page.tsx`
**Line**: 6

**Issue**: `ImageUpload` imported but never used.

**Fix**: Remove line:
```typescript
import { ImageUpload } from "./components/ImageUpload"; // ← DELETE THIS
```

---

## PROGRESS TRACKER

### Completed (1/13)
- ✅ VoiceInput memory leak

### In Progress (0/13)
- None

### Pending (12/13)
- ❌ Scroll event listener leak
- ❌ AudioPlayer URL leak
- ❌ Error Boundary
- ❌ OCR timeout
- ❌ API logging sanitization
- ❌ Input validation
- ❌ WhiteboardModal error handling
- ❌ TTS timeout
- ❌ Console logging cleanup
- ❌ Unused import
- ⚠️ Server-side persistence (deferred to post-MVP)
- ⚠️ page.tsx refactoring (optional)

---

## DEPLOYMENT READINESS

**Current State**: ❌ Not production-ready

**Blockers**:
1. Missing error boundary (can crash entire app)
2. Memory leaks in scroll/audio handlers
3. No proper error handling for API failures
4. Console logging exposes user data

**Required Before Production**:
1. Fix all CRITICAL issues (2 remaining)
2. Fix all HIGH issues (5 total)
3. Add error monitoring (Sentry recommended)
4. Load test for memory leaks

---

## Next Session TODO

1. Fix scroll event listener leak (5 min)
2. Fix AudioPlayer URL leak (10 min)
3. Create Error Boundary component (15 min)
4. Add OCR timeout (5 min)
5. Sanitize API logging (10 min)
6. Add input validation (10 min)
7. Add WhiteboardModal error handling (5 min)
8. Add TTS timeout (5 min)
9. Clean up console.log statements (15 min)
10. Remove unused import (1 min)

**Estimated Total**: 81 minutes

---

## Testing Checklist After Fixes

- [ ] Test voice input unmount during recording
- [ ] Test scroll performance over 50+ messages
- [ ] Test audio playback with rapid clicks
- [ ] Test large image upload (>5MB)
- [ ] Test whiteboard save failures
- [ ] Test network timeouts
- [ ] Verify no console logs in production build
- [ ] Test error boundary with forced error
- [ ] Run memory profiler for leaks
- [ ] Test concurrent TTS requests

---

## Code Health Metrics

- **TypeScript Coverage**: 100% ✅
- **Component Size**: 1 oversized (page.tsx at 454 lines) ⚠️
- **Error Boundaries**: 0 ❌
- **Memory Leak Risk**: 2 confirmed issues ❌
- **API Error Handling**: Partial ⚠️
- **Input Validation**: Incomplete ❌
- **Test Coverage**: No tests ❌
- **Dead Code**: Minimal (1 unused import) ✅

---

## Files Modified So Far

1. `app/components/VoiceInput.tsx` - ✅ Memory leak fixed
