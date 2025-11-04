# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical Rules

**ALWAYS use bun/bunx instead of npm/npx for all package management and script execution commands.**
- Use `bun install` instead of `npm install`
- Use `bunx` instead of `npx`
- Use `bun run` instead of `npm run`
- Use `bun add` instead of `npm install <package>`

## Project Overview

**Socratex** is an AI math tutor that uses the Socratic method to guide students through problem-solving without providing direct answers. Students can submit math problems via text or image upload, and the AI asks probing questions to help them discover solutions independently.

**Timeline**: 3-5 days for core features + optional stretch features
**Target**: K-12 through undergraduate mathematics

## Recommended Technology Stack

Based on the PRD analysis, the recommended architecture is:

### Frontend
- **Framework**: Next.js 15 with App Router
- **UI Library**: React with TypeScript
- **Styling**: Tailwind CSS
- **Math Rendering**: KaTeX via `react-katex` (faster than MathJax, 78KB gzipped)
- **Chat Interface**: Vercel AI SDK (`useChat` hook for streaming, message history, file attachments)

### Backend
- **API Routes**: Next.js API routes in `app/api/` (auto-deploy as serverless functions)
- **LLM for Development**: Gemini 2.0 Flash (free tier: 1,500 requests/day, 15/min)
- **LLM for Production**: Claude 3.5 Sonnet or Sonnet 4.5 (superior Socratic reasoning, $3 input/$15 output per million tokens)
- **Vision OCR**: GPT-4o Vision (~$0.003-0.004 per image, 92-95% accuracy on printed math, 82-90% on handwritten)
- **File Upload**: UploadThing (Next.js-native, free tier: 2GB storage + 2GB bandwidth)
- **Storage**: Vercel KV (Upstash Redis) for conversation persistence (10,000 free commands/day)

### Deployment
- **Platform**: Vercel (zero-config Next.js deployment, free Hobby tier for development)
- **Hosting**: Serverless functions, automatic scaling
- **Domain**: Custom domain support with automatic HTTPS

## Project Structure

```
socratex/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── chat/route.ts         # Main chat endpoint with Socratic prompt
│   │   ├── extract-math/route.ts # Vision OCR for image parsing
│   │   └── uploadthing/          # File upload configuration
│   ├── components/
│   │   ├── ChatInterface.tsx     # Main chat UI with streaming
│   │   ├── ImageUpload.tsx       # Image upload button
│   │   └── MathRenderer.tsx      # KaTeX wrapper for LaTeX rendering
│   ├── page.tsx                  # Main application page
│   └── layout.tsx                # Root layout with KaTeX CSS
├── lib/
│   ├── prompts.ts                # Socratic system prompts
│   └── utils.ts                  # LaTeX parsing, hint tracking
├── public/                       # Static assets
├── .env.local                    # API keys (not committed)
└── package.json
```

## Core Commands

### Development
```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

# Start production server
bun start

# Type checking
bun run type-check
```

### Testing
```bash
# Run tests (when implemented)
bun test

# Test specific math domains
bun run test:algebra
bun run test:calculus
bun run test:geometry
```

### Deployment
```bash
# Deploy to Vercel
bunx vercel

# Deploy to production
bunx vercel --prod
```

## Critical Implementation Requirements

### 1. Socratic Teaching Principles

**NEVER provide direct answers.** The system must guide through questions only.

**Three-tier progressive hint system:**
- **Tier 1** (initial attempts): Guiding questions ("What do we know about...?")
- **Tier 2** (after 2 failed attempts): Partial information ("Remember that [concept] applies here...")
- **Tier 3** (after 3 failed attempts): Worked example of simpler problem, then ask student to apply

**System prompt must enforce:**
- Ask questions instead of giving answers
- Validate reasoning process, not just final answers
- Provide encouraging, patient language
- Use LaTeX notation for all math: `$x^2$` (inline), `$$\frac{a}{b}$$` (block)
- Reference earlier attempts to maintain context

### 2. Math Rendering

**Parse LaTeX from LLM responses:**
- Regex pattern: `/(\$\$[^$]+\$\$|\$[^$]+\$)/g`
- Inline math: `$...$` → `<InlineMath math="..." />`
- Block math: `$$...$$` → `<BlockMath math="..." />`
- KaTeX CSS must be imported: `import 'katex/dist/katex.min.css'`

**Handle edge cases:**
- Escaped dollar signs: `\$` should not trigger math rendering
- Nested delimiters: Use greedy matching
- Invalid LaTeX: Catch errors and display raw text as fallback

### 3. Image OCR Flow

**Two-stage process:**
1. Upload image via UploadThing → get CDN URL
2. Send URL to vision model with prompt: "Extract all mathematical notation from this image and return it in LaTeX format. Identify the specific problem to be solved."

**Confirmation workflow:**
- Display parsed LaTeX back to student
- Ask: "Is this correct?"
- If incorrect, allow re-upload or manual text entry
- This catches 82-90% accuracy handwritten OCR errors

**Handle failures gracefully:**
- Poor image quality → prompt for better lighting/clearer writing
- Ambiguous notation → ask clarifying questions
- OCR timeout → fall back to text input

### 4. Conversation Context Management

**Message history:**
- Include full conversation history in each LLM API call
- Claude 3.5 Sonnet: 200K token context (handles 2-3 hour sessions)
- Track hint tier level per problem in conversation state
- Reset hint tier when student moves to new problem

**Session persistence:**
- Initially: Browser localStorage (MVP)
- Production: Vercel KV with session IDs
- Store: `session:${userId}` → JSON stringified messages
- TTL: 24 hours (86400 seconds)

### 5. Error Handling

**API errors:**
- LLM rate limits → show friendly "high demand" message, retry with backoff
- Vision OCR failure → fall back to text input
- Upload errors → clear error messages with retry button
- Network timeouts → graceful degradation

**Input validation:**
- Max image size: 4MB (UploadThing limit)
- Allowed formats: JPG, PNG, PDF
- Text input length: reasonable limits to prevent abuse
- Rate limiting: Track requests per IP/session

## Development Workflow

### Day 1: Foundation (4-6 hours)
1. Initialize Next.js project with TypeScript and Tailwind
2. Install dependencies: `ai`, `@ai-sdk/openai`, `katex`, `react-katex`
3. Build basic chat interface using `useChat` hook
4. Integrate LLM with Socratic system prompt
5. Deploy to Vercel and verify streaming works

**Milestone**: Working chatbot that asks guiding questions instead of giving answers

### Day 2: Image & Math (4-6 hours)
1. Set up UploadThing for image uploads
2. Integrate vision OCR (GPT-4o or Gemini)
3. Implement LaTeX parsing and KaTeX rendering
4. Update system prompt to output LaTeX notation
5. Test OCR with various image qualities

**Milestone**: Image upload + OCR + math rendering functional

### Day 3-4: Enhanced Tutoring (8-12 hours)
1. Implement three-tier progressive hint system
2. Add hint level tracking per problem
3. Enhance response validation (process vs. answer checking)
4. Extend conversation context management
5. Add edge case handling and error boundaries
6. Test across math domains (algebra, calculus, geometry)

**Milestone**: Full Socratic tutoring with robust hint progression

### Day 5: Polish (4-6 hours)
1. UI refinement and mobile responsiveness
2. Add "New Session" button, loading states
3. Systematic testing across problem types
4. Documentation and deployment
5. Create demo video

**Milestone**: Production-ready application

## Socratic System Prompt Template

```typescript
const SOCRATIC_PROMPT = `You are an upbeat, encouraging math tutor who helps students understand concepts through Socratic questioning. Never provide direct answers or complete solutions.

RULES:
1. Ask guiding questions instead of giving answers
2. When students answer, ask them to explain their reasoning
3. Validate reasoning process, not just correctness
4. If approach is correct but calculation wrong: "Your method is right! Check step 3..."
5. If approach is flawed: "What if we considered this from [different angle]?"

HINT PROGRESSION:
- Tier 1 (initial): "Let's think step by step. What do we know about [concept]?"
- Tier 2 (after 2 attempts): "Remember that [key principle]. How might that help?"
- Tier 3 (after 3 attempts): Show similar simpler problem, ask them to apply approach

FORMATTING:
- Use LaTeX for all math: inline $x^2$, block $$\\frac{a}{b}$$
- Always end with a question that prompts thinking
- Reference earlier attempts: "Building on what you tried before..."

Start by understanding what they already know about the topic.`;
```

## Testing Strategy

### Manual Test Suite
Create test problems across domains:
- Linear equations (e.g., `2x + 5 = 13`)
- Quadratic equations (e.g., `x^2 - 5x + 6 = 0`)
- Derivatives (e.g., `d/dx(x^3 + 2x)`)
- Integrals (e.g., `∫x^2 dx`)
- Geometry proofs
- Word problems

### Test Flows
For each problem, verify:
1. Problem input (text + image variants)
2. Initial tutor response asks guiding question (no direct answer)
3. Incorrect student answer → appropriate hint escalation
4. Hint tier progresses correctly (Tier 1 → 2 → 3)
5. Correct answer → follow-up to check understanding
6. Context maintained across 20-30 message exchanges

### OCR Testing
Test image conditions:
- Clear textbook photos (expect 95%+ accuracy)
- Handwritten on lined paper (expect 82-90%)
- Angled photos, poor lighting (verify graceful degradation)
- Complex notation with fractions, radicals, matrices

### Edge Cases
- Student explicitly asks for answer → refuse politely, ask guiding question
- Off-topic messages → redirect to math
- Malformed LaTeX → catch rendering errors
- Session exceeds context window → implement summarization
- API errors → show user-friendly messages

## Cost Estimates

### Development (Free Tier)
- Gemini 2.0 Flash: $0 (1,500 requests/day)
- UploadThing: $0 (2GB storage + bandwidth)
- Vercel: $0 (Hobby tier)

### Production (100 daily active users)
- Claude 3.5 Sonnet: ~$3.24/month (~30K sessions × 6K tokens × $0.018/1M)
- GPT-4o Vision: ~$20/month (~5K images × $0.004)
- UploadThing Paid: $10/month (10GB)
- Vercel Pro: $20/month (1TB bandwidth)
- **Total**: ~$53/month for 100 DAU

### Scaling
- 1,000 DAU: ~$250/month
- 10,000 DAU: ~$2,000/month (implement prompt caching for 80% cost reduction)

## Environment Variables

Required in `.env.local`:
```bash
# LLM APIs
OPENAI_API_KEY=sk-...              # For GPT-4o Vision
ANTHROPIC_API_KEY=sk-ant-...       # For Claude 3.5 Sonnet
GOOGLE_API_KEY=...                 # For Gemini (development)

# File Upload (UploadThing v7)
# Get from: https://uploadthing.com/dashboard -> API Keys -> V7 tab
UPLOADTHING_TOKEN=...

# Storage (production)
KV_URL=...                         # Vercel KV
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

## Stretch Features (Optional)

### Interactive Whiteboard
- Library: Excalidraw (free, open-source)
- Use case: Geometry problems, visual explanations
- Implementation: 1-2 days

### Voice Interface
- Development: Web Speech API (free, built into browsers)
- Production: OpenAI Whisper STT ($0.006/min) + Cartesia Sonic TTS ($0.06/min)
- Use case: Hands-free tutoring
- Implementation: 1-2 days

### Step Visualization
- Animate problem-solving steps with highlighting
- Requires structured LLM responses with step markers
- Implementation: 2-3 days

### Problem Generation
- LLM generates practice problems at adaptive difficulty
- Use SymPy for validation of solvability
- Track performance to adjust difficulty
- Implementation: 1-2 days

## Key Architectural Decisions

### Why Next.js + Vercel AI SDK?
- Pre-built chat hooks eliminate months of UI development
- Built-in streaming response handling
- API routes as serverless functions (zero DevOps)
- Vercel deployment in <10 minutes

### Why KaTeX over MathJax?
- 78KB gzipped vs. 150KB+
- Synchronous rendering (no page reflow)
- Covers 95% of K-12 to undergraduate notation
- Only 2x faster than MathJax v3, but simpler API

### Why Claude over GPT-4o for tutoring?
- Superior instruction-following for pedagogical guardrails
- More natural teaching voice
- 200K context window (vs. 128K)
- Better at maintaining Socratic method constraints

### Why Server-Sent Events over WebSockets?
- No special server infrastructure needed
- Works over standard HTTP
- Automatic reconnection built into browsers
- Perfect for one-way streaming (server → client)

### Why localStorage then Vercel KV?
- MVP: Zero setup, instant persistence
- Production: KV provides server-side storage, rate limiting
- Avoids premature database complexity

## Success Criteria

The application succeeds when it:
1. **Never gives direct answers** regardless of how students phrase requests
2. **Maintains conversation context** across 20+ message turns
3. **Adapts hint complexity** based on student struggle (3-tier system)
4. **Parses images accurately** with confirmation workflow catching errors
5. **Renders math beautifully** with inline and block LaTeX
6. **Guides effectively** across 5+ problem types (algebra, calculus, geometry, word problems)
7. **Validates reasoning** not just final answers

## References

- **Khan Academy Khanmigo**: OpenAI partnership demonstrating effective AI tutoring
- **Vercel AI SDK**: https://ai-sdk.dev/docs/introduction
- **UploadThing**: https://docs.uploadthing.com/getting-started/appdir
- **KaTeX**: https://katex.org/docs/
- **Example**: mathtutor-on-groq (GitHub) for voice-enabled reference
- **PRD**: See [PRD.md](PRD.md) for comprehensive technical specification
- **Project Description**: See [.human/Project Description.md](.human/Project%20Description.md) for timeline and evaluation criteria

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
