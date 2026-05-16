# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Frontend Development Rules

Claude Code must follow these rules when changing this frontend project:

- Keep single source files under 500 lines whenever practical. If a file is approaching that size, split logic into smaller components, hooks, services, or utility modules.
- Do not place large CSS blocks inline in TSX. Prefer `src/styles/global.css`, existing class names, or a dedicated stylesheet/module when styles are component-specific.
- Inline styles are acceptable only for truly dynamic values that cannot be represented cleanly with classes, such as calculated dimensions, runtime colors, or third-party component escape hatches.
- Prefer existing project patterns before adding new abstractions. Reuse the service layer in `src/services/`, shared types in `src/types/`, and existing component structure under `src/components/`.
- Keep components focused on rendering and user interaction. Move API calls, data shaping, and reusable business logic out of large page components when it improves clarity.
- Avoid adding new dependencies unless the project cannot reasonably solve the problem with the current stack.
- Keep changes scoped to the requested feature or fix. Do not refactor unrelated files while implementing a small change.
- Before considering a code change complete, run the relevant checks, usually `npm run type-check` and `npm run build`.
- 修改完成后准备提交，每完成一个独立的功能或修复就创建一个 commit。累计 10 次 commit 后统一推送到远程仓库。

## Commands

```bash
npm run dev          # Start Vite dev server (port 3000, proxies /api→localhost:8100)
npm run build        # TypeScript check + production build
npm run preview      # Preview production build
npm run lint         # ESLint with auto-fix
npm run lint:check   # ESLint without fix (for CI)
npm run format       # Prettier format
npm run format:check # Prettier check (for CI)
npm run type-check   # TypeScript type checking (tsc --noEmit)
```

## Architecture

This is a React + TypeScript rewrite of the Vue 3 `data-agent-frontend`, serving as the web UI for the "数据智能体平台" (Data Agent Platform). Backend is `python-agent-v2` on port 8100 (or `DataAgent` Java backend on 8065).

### Routing & Page Flow

React Router v7 with `createBrowserRouter`, lazy-loaded pages, and a **model readiness guard**: before entering agent pages, the router's `loader` checks `GET /api/model-config/check-ready` — if no active chat/embedding model is configured, the user is redirected to `/model-config`.

```
/ → redirect → /agents (AgentList)
/agent/create (AgentCreate)
/agent/:id (AgentDetail — tabbed config: data sources, knowledge, semantics, prompts, presets)
/agent/:id/run (AgentRun — SSE chat interface)
/model-config (ModelConfig)
```

### SSE Streaming Protocol

Chat streaming uses `GET /api/stream/search` via browser `EventSource` (defined in `src/services/graph.ts`). The response is a stream of `GraphNodeResponse` JSON objects:

- **`onmessage`** — each chunk has `nodeName`, `textType` (SQL/JSON/PYTHON/HTML/MARK_DOWN/RESULT_SET/TEXT), `text`, `error`, `complete`
- **`error` event** — application-level error (JSON payload with error text)
- **`complete` event** — stream finished normally
- **`paused` event** — workflow paused for human feedback (contains `threadId`)

Resuming after human feedback: resend the same request with `humanFeedback: true`, `rejectedPlan: true/false`, `humanFeedbackContent`, and the saved `threadId`.

### Session State Isolation

Zustand store (`src/stores/sessionStateStore.ts`) manages per-session runtime state keyed by `sessionId`. Each session tracks: `isStreaming`, `nodeBlocks` (streaming chunks), `closeStream` (abort function), `lastRequest` (for feedback replay), `htmlReportContent`/`markdownReportContent` (accumulated report), `rejectCount`, `showHumanFeedback`. This design mirrors Vue's `sessionStateManager` reactive Map.

### Component Organization for AgentRun (~500 line page)

The chat page (`src/views/AgentRun.tsx`) orchestrates:
- `ChatSessionSidebar` — session list CRUD (left sidebar)
- `PresetQuestions` — quick-start question chips
- `HumanFeedback` — approve/reject plan with feedback text
- `ResultSetDisplay` — SQL result table with pagination and chart toggle
- `ReportHtmlView` — HTML report via DOMPurify + iframe sandbox
- `markdown/` — markdown-it plugins for ECharts fenced blocks and highlight.js
- `ChartFactory` — ECharts React wrapper

### API Service Layer

All services use the shared `request.ts` (axios instance) which:
- Normalizes bare backend responses into `{ data: ... }` shape
- Unwraps `{ success, data, message }` envelopes — treats `success: false` as error
- Handles 500/network errors with antd `message` toasts

Services map to backend endpoint groups: `agentService`, `chatService`, `modelConfigService`, `datasourceService`, `graphService` (SSE streaming), etc.

### Agent Configuration Tabs (AgentDetail)

Each tab under `/agent/:id` is a component in `src/components/agent/`:
- **BaseSetting** — name, description, avatar, status
- **DataSourceConfig** — bind/unbind datasources, table selection
- **AgentKnowledgeConfig** — knowledge base (DOCUMENT/QA/FAQ)
- **BusinessKnowledgeConfig** — business terms + synonyms
- **SemanticsConfig** — semantic model (column-level business names/descriptions)
- **PromptConfig** — prompt templates
- **PresetsConfig** — preset questions
- **AccessApi** — API key management

### Design System

A CSS custom property system (`src/styles/global.css`) defines tokens for colors, spacing (4px base), typography, shadows, z-index stack, and component classes (`.btn`, `.card`, `.badge`, `.form-control`, `.table`). Dark mode and reduced-motion media queries are included. Ant Design's `ConfigProvider` with `zhCN` locale wraps the app.

### Alignment with Java Frontend

This project aims for 100% feature parity with `DataAgent/data-agent-frontend` (Vue 3 + Element Plus). Key differences:
- Ant Design 5 replaces Element Plus
- Zustand replaces Vue `reactive()` for session state
- `dangerouslySetInnerHTML` replaces `v-html` (with DOMPurify)
- Module exports replace Vue's `window.*` global functions
