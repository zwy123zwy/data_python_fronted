## Context

当前项目 `data-agent-fronted` 为空壳工程。参考前端 `DataAgent/data-agent-frontend` 是基于 Vue 3 + Element Plus + TypeScript 的完整实现，后端 `python-agent-v2` 已通过 SSE 流式协议对齐（参见 `python-agent-v2/openspec/changes/archive/2026-05-05-align-java-agent-execution-and-frontend-contract/`）。本设计决定 React 版前端的技术选型和架构，目标是与 Vue 版功能完全对齐，且无需修改后端。

## Goals / Non-Goals

**Goals:**
- 从零搭建完整的 React + TypeScript 前端工程
- 实现与 Vue 版 100% 的功能对齐（6 大能力模块，见 proposal）
- 保持与后端 `python-agent-v2` API 协议完全兼容
- 提供良好的开发体验（HMR、TypeScript 严格模式、ESLint）
- 组件化设计，特别是将 Vue 版 `AgentRun.vue`（~800 行）拆分为多个可维护的 React 组件

**Non-Goals:**
- 不修改后端任何接口或协议
- 不改变现有 API 路径或 SSE 格式
- 不引入新的后端依赖
- 不在此阶段优化或重构后端协议

## Decisions

### 1. UI 组件库: Ant Design 5

**选择**: Ant Design 5

**替代方案**:
- Element Plus (React 版): 社区力度弱，API 与 Vue 版差异大
- MUI (Material UI): 过重，Google Material 风格与现有设计不匹配
- shadcn/ui: 定制性强但开发效率低，需要手动组装大量组件
- Ant Design: 企业级组件丰富（Table、Form、Modal、Menu、Upload），与 Element Plus 组件映射直接，中文生态完善

**理由**: Vue 版使用 Element Plus 提供了大量开箱即用的企业级组件（el-table、el-dialog、el-form、el-upload 等）。Ant Design 是 React 生态中最接近的对应选择，组件覆盖度最高，迁移成本最低。

### 2. 状态管理: Zustand

**选择**: Zustand（轻量级全局状态）

**替代方案**:
- Redux Toolkit: 过于重量级，样板代码多
- React Context: 适合局部状态，不适合跨页面共享（如 session 流式状态）
- Jotai/Recoil: 原子化状态，学习成本高

**理由**: Vue 版未使用 Pinia/Vuex，大部分状态是组件本地 `ref()`/`reactive()`，仅有 `sessionStateManager` 跨组件共享 session 流式状态。Zustand 足够轻量，API 简洁，适合按需创建小型 store（sessions、modelConfig 就绪状态等）。

### 3. SSE 流式处理: EventSource + fetch ReadableStream 双模式

**选择**: 主链路使用 `EventSource`（与 Vue 版一致），备选 `fetch` + `ReadableStream` 用于需要 POST body 的场景

**替代方案**:
- 仅 EventSource: GET 请求，无法传递复杂 body（对当前 API 够用）
- 仅 fetch ReadableStream: 灵活但对 SSE 语义支持弱，需手动解析 `event:` 和 `data:` 行
- WebSocket: 后端不提供 WS 接口

**理由**: 后端 `GET /api/stream/search` 使用标准 SSE（query 参数传递），`EventSource` 是浏览器原生 API，自动重连，API 简洁。保留 fetch 作为备选以支持 `POST /api/query/stream`（Python 扩展接口）。

### 4. Markdown/ECharts 渲染

**选择**: 复用 `markdown-it` + 自定义插件（移植 Vue 版的 `markdown-plugin-echarts.ts` 和 `markdown-plugin-highlight.ts`）

**替代方案**:
- react-markdown: React 原生方案但不支持 markdown-it 插件系统
- markdown-it + dangerouslySetInnerHTML: 与 Vue 版 v-html 对应，插件可直接移植
- ECharts 封装为 React 组件（useRef + useEffect）

**理由**: Vue 版的 markdown-it 插件（ECharts fenced code block 检测、highlight.js 集成、复制按钮）是核心渲染逻辑。通过 `dangerouslySetInnerHTML` + DOMPurify 净化可以安全移植，插件代码几乎可以直接复用（纯 JS，无 Vue/React 依赖）。

### 5. 路由策略

**选择**: React Router v6 (createBrowserRouter)

```
/ → redirect to /agents
/agents → AgentList
/agent/:id → AgentDetail (tabs)
/agent/:id/run → AgentRun (chat)
/model-config → ModelConfig
/* → NotFound
```

**全局导航守卫**: 使用 React Router `loader` 或 wrapper 组件检查模型就绪状态，未就绪时重定向到 `/model-config`。

### 6. Session 流式状态隔离

**选择**: Zustand store + sessionId key 隔离

Vue 版使用 `sessionStateManager` (reactive Map<string, SessionRuntimeState>) 按 sessionId 隔离流式状态（isStreaming、nodeBlocks、reportContent 等），确保切换会话时各自状态不受影响。

React 版使用 Zustand store 实现相同模式：
```ts
interface SessionStateStore {
  states: Record<string, SessionRuntimeState>;
  getState: (sessionId: string) => SessionRuntimeState;
  setState: (sessionId: string, state: SessionRuntimeState) => void;
  deleteState: (sessionId: string) => void;
}
```

### 7. AgentRun 页面组件拆分

Vue 版 `AgentRun.vue` 约 800 行，拆分策略：

```
views/AgentRun/
├── index.tsx               # 主容器（~200 行）
├── ChatMessageList.tsx      # 消息列表 + 自动滚动
├── ChatInput.tsx            # 输入框 + 发送/停止按钮
├── StreamingResponse.tsx    # 流式节点输出渲染
├── ReportViewer.tsx         # HTML/Markdown 报告全屏查看
├── ResultSetViewer.tsx      # SQL 结果集表格/图表切换
└── components/
    ├── ChatSessionSidebar.tsx
    ├── HumanFeedback.tsx
    └── PresetQuestions.tsx
```

### 8. 全局 CSS 设计系统

Vue 版 `global.css` (~1500 行) 使用 CSS 自定义属性，可以直接复用。通过 Vite 的 CSS import 引入，配合 Ant Design 的 ConfigProvider 主题定制覆盖关键 token。

### 9. 构建工具: Vite 5

与 Vue 版一致使用 Vite，proxy 配置：
```ts
// vite.config.ts
proxy: {
  '/api': 'http://localhost:8100',
  '/nl2sql': 'http://localhost:8100',
  '/uploads': 'http://localhost:8100',
}
```

## Risks / Trade-offs

- **[风险] Ant Design Bundle Size 较大** → 按需导入（tree-shaking），Vite 自动处理
- **[风险] dangerouslySetInnerHTML + markdown-it 存在 XSS 风险** → DOMPurify 净化所有 HTML 内容
- **[风险] EventSource 在 Firefox 上有连接数限制** → 单页面最多 2 个 EventSource（chat stream + session title stream），在限制内
- **[风险] ECharts 实例管理在 React 严格模式（StrictMode）下双重 mount** → useRef + useEffect cleanup 正确 dispose 实例
- **[取舍] 不复用 Vue 版的 window 全局函数（window.copyTextToClipboard、window.handleResultSetPagination）** → 改为模块导出，更符合 React 最佳实践
