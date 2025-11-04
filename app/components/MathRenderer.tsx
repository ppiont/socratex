"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
}

/**
 * MathRenderer component that renders markdown with LaTeX math notation
 * Supports markdown formatting (bold, italic, lists, etc.) and math (inline $...$ and block $$...$$)
 */
export function MathRenderer({ content, className = "" }: MathRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Inline code blocks
          code: ({ children }) => (
            <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">
              {children}
            </code>
          ),
          // Block code
          pre: ({ children }) => (
            <pre className="bg-gray-200 dark:bg-gray-700 p-2 rounded my-2 overflow-x-auto">
              {children}
            </pre>
          ),
          // Paragraphs
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          // Strong/bold
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          // Emphasis/italic
          em: ({ children }) => <em className="italic">{children}</em>,
          // Lists
          ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
