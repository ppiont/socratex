"use client";

import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { parseLatex, type ParsedSegment } from "@/lib/utils";

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * MathRenderer component that parses text content and renders LaTeX math notation
 * using KaTeX. Supports both inline ($...$) and block ($$...$$) math.
 */
export function MathRenderer({ content, className }: MathRendererProps) {
  const segments = parseLatex(content);

  return (
    <div className={className}>
      {segments.map((segment, index) => (
        <MathSegment key={index} segment={segment} />
      ))}
    </div>
  );
}

/**
 * Renders a single parsed segment (text, inline math, or block math)
 */
function MathSegment({ segment }: { segment: ParsedSegment }) {
  try {
    switch (segment.type) {
      case "text":
        return <span>{segment.content}</span>;

      case "inline-math":
        return <InlineMath math={segment.content} />;

      case "block-math":
        return (
          <div className="my-2">
            <BlockMath math={segment.content} />
          </div>
        );

      default:
        return <span>{segment.content}</span>;
    }
  } catch (error) {
    // Fallback to raw text if LaTeX parsing fails
    console.error("LaTeX rendering error:", error);
    return (
      <span className="text-red-500" title="LaTeX rendering error">
        {segment.type === "text"
          ? segment.content
          : `$${segment.content}$`}
      </span>
    );
  }
}
