import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * LaTeX Math Regex Patterns
 */
export const LATEX_PATTERNS = {
  // Matches both inline ($...$) and block ($$...$$) LaTeX
  MATH: /(\$\$[^$]+\$\$|\$[^$]+\$)/g,
  // Block math only
  BLOCK: /\$\$(.*?)\$\$/g,
  // Inline math only
  INLINE: /\$([^$]+)\$/g,
  // Escaped dollar signs
  ESCAPED: /\\\$/g,
} as const;

/**
 * Parse message content to identify LaTeX segments
 */
export interface ParsedSegment {
  type: "text" | "inline-math" | "block-math";
  content: string;
}

export function parseLatex(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;

  // Find all math segments
  const mathMatches = Array.from(content.matchAll(LATEX_PATTERNS.MATH));

  mathMatches.forEach((match) => {
    const fullMatch = match[0];
    const index = match.index!;

    // Add text before this math segment
    if (index > lastIndex) {
      segments.push({
        type: "text",
        content: content.substring(lastIndex, index),
      });
    }

    // Determine if block or inline math
    const isBlock = fullMatch.startsWith("$$");
    segments.push({
      type: isBlock ? "block-math" : "inline-math",
      content: isBlock
        ? fullMatch.slice(2, -2).trim()
        : fullMatch.slice(1, -1).trim(),
    });

    lastIndex = index + fullMatch.length;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.substring(lastIndex),
    });
  }

  return segments;
}

/**
 * Session storage keys
 */
export const STORAGE_KEYS = {
  CONVERSATION: "socratex_conversation",
  HINT_STATE: "socratex_hint_state",
  CURRENT_PROBLEM: "socratex_current_problem",
} as const;

/**
 * Store conversation in localStorage
 */
export function saveToLocalStorage<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

/**
 * Load conversation from localStorage
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
    return null;
  }
}

/**
 * Clear conversation from localStorage
 */
export function clearFromLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear from localStorage:", error);
  }
}
