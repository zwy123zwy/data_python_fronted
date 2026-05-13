# TODO: Align React Frontend

## Phase 1. 工程搭建

- [x] 1.1 使用 Vite 6 创建 React + TypeScript 工程（Vite 仍是纯前端 SPA 的最佳选择：CRA 已废弃，Next.js 过重）
- [x] 1.2 安装核心依赖：react, react-dom, react-router-dom, antd, @ant-design/icons, axios, echarts, markdown-it, highlight.js, dompurify, marked, zustand
- [x] 1.3 安装开发依赖：typescript, @types/react, @types/react-dom, @types/dompurify, @types/markdown-it, vite, @vitejs/plugin-react, eslint, prettier
- [x] 1.4 配置 tsconfig.json（strict mode, path aliases @/ → src/）
- [x] 1.5 配置 vite.config.ts（proxy /api、/nl2sql、/uploads → localhost:8100, port 3000）
- [x] 1.6 配置 ESLint + Prettier
- [x] 1.7 复制 global.css 设计系统（CSS 自定义属性、工具类）并适配 Ant Design ConfigProvider 主题 token

## Phase 2. 基础架构

- [x] 2.1 定义 TypeScript 类型（Agent, Datasource, ChatSession, ChatMessage, GraphNodeResponse, TextType, ModelConfig, etc.）
- [x] 2.2 实现 API 服务层（agent.ts, chat.ts, graph.ts, modelConfig.ts, datasource.ts, agentDatasource.ts, agentKnowledge.ts, businessKnowledge.ts, semanticModel.ts, presetQuestion.ts, logicalRelation.ts, fileUpload.ts）
- [x] 2.3 创建 Zustand stores（sessionStateStore - 按 sessionId 隔离流式状态）
- [x] 2.4 搭建路由框架（React Router v7 createBrowserRouter，路由配置 /, /agents, /agent/create, /agent/:id, /agent/:id/run, /model-config, /*）
- [x] 2.5 实现模型就绪检查路由守卫（loader 检查 chatModelReady + embeddingModelReady，未就绪重定向 /model-config）
- [x] 2.6 创建 BaseLayout 组件（header + sidebar + content 布局）

## Phase 3. Agent 管理

- [x] 3.1 实现 AgentList 页面（统计卡片 + 状态筛选 tab + 搜索框 + Agent 卡片网格）
- [x] 3.2 实现 AgentCreate 页面（表单：name, category, description, prompt, tags, status + 头像上传）
- [x] 3.3 实现 AgentDetail 页面（Tab 切换容器，读取/编辑 basic metadata）
- [x] 3.4 实现 Agent 删除功能（确认弹窗 + 删除后跳转）
- [x] 3.5 实现 Agent 发布/下线功能
- [x] 3.6 实现 AccessApi 组件（API Key 查看/生成/重置/删除/开关 + 可见性切换）

## Phase 4. Agent 配置

- [x] 4.1 实现 DataSourceConfig 组件（数据源绑定列表 + 添加/移除 + 激活开关 + 选表弹窗 + 初始化 Schema）
- [x] 4.2 实现数据源管理子功能（CRUD + 测试连接 + 浏览表列表）
- [x] 4.3 实现 LogicalRelation 弹窗（逻辑外键关系编辑 + batch save）
- [x] 4.4 实现 AgentKnowledgeConfig 组件（知识列表分页 + 过滤 + 创建/编辑/删除 + 类型选择 Document/QA/FAQ + 嵌入重试 + recall 切换）
- [x] 4.5 实现 BusinessKnowledgeConfig 组件（业务术语 CRUD + 同义词 + recall 切换 + 向量库刷新）
- [x] 4.6 实现 SemanticsConfig 组件（语义模型表 + 创建/编辑/删除 + 批量导入 JSON/Excel + 批量启用/禁用/删除 + 下载 Excel 模板）
- [x] 4.7 实现 PromptConfig 组件（Prompt 模板列表 + 创建/编辑/删除 + 启用/禁用 + 批量启用/禁用 + 优先级别调整）
- [x] 4.8 实现 PresetsConfig 组件（预设问题 CRUD + batch save）

## Phase 5. 模型配置

- [x] 5.1 实现 ModelConfig 页面（模型配置表格 + 添加/编辑/删除）
- [x] 5.2 实现模型测试连接功能（测试按钮 + 结果通知）
- [x] 5.3 实现模型激活功能（设置当前活跃的 chat/embedding 模型）
- [x] 5.4 实现代理配置支持（host, port, username, password）

## Phase 6. 流式对话核心

- [x] 6.1 实现 graph.ts SSE 流式请求（EventSource → GET /api/stream/search，onmessage/onerror/oncomplete/onpaused 回调）
- [x] 6.2 实现 ChatSessionSidebar 组件（会话列表 + 新建/切换/重命名/置顶/删除）
- [x] 6.3 实现会话标题 SSE 监听（GET /api/agent/:agentId/sessions/stream → event: title-updated，自动重连）
- [x] 6.4 实现 AgentRun 主页面（chat 布局：sidebar + 消息区 + 输入区 + toggle 栏）
- [x] 6.5 实现 ChatMessageList（消息气泡列表 + 自动滚动，集成在 AgentRun 页面中）
- [x] 6.6 实现 ChatInput（输入框 + 发送/停止按钮 + nl2sql/humanFeedback toggle，集成在 AgentRun 页面中）
- [x] 6.7 实现 StreamingResponse（按 nodeName 分组展示流式输出块，根据 textType 选择渲染方式，集成在 AgentRun 中）
- [x] 6.8 实现消息历史加载和保存（GET 加载 + POST 保存，messageType 映射）
- [x] 6.9 实现会话状态隔离（Zustand store 按 sessionId 保存 nodeBlocks、isStreaming、reportContent、threadId）
- [x] 6.10 实现停止生成功能（EventSource.close() + 保存部分消息）
- [x] 6.11 实现 HTML 报告下载（POST /api/sessions/:sessionId/reports/html → blob download）
- [x] 6.12 实现 PresetQuestions 组件（预设问题 chips，点击自动填入并发送）

## Phase 7. 人工反馈

- [x] 7.1 实现 HumanFeedback 组件（审批卡片：plan 步骤列表 + 反馈文本框 + Approve/Reject 按钮）
- [x] 7.2 实现 approve 流程（携带 threadId + humanFeedbackContent + rejectedPlan=false 恢复 SSE）
- [x] 7.3 实现 reject 流程（携带 threadId + humanFeedbackContent + rejectedPlan=true 恢复 SSE）
- [x] 7.4 实现多次拒绝超限提示
- [x] 7.5 实现暂停事件前端识别（event: paused → 显示 HumanFeedback 组件，不弹出连接错误）

## Phase 8. 报告渲染

- [x] 8.1 实现 markdown-it 集成（createMarkdownIt 工厂函数 + highlight.js + ECharts 插件）
- [x] 8.2 移植 markdown-plugin-echarts.ts（ECharts fenced code block → 交互式图表）
- [x] 8.3 移植 markdown-plugin-highlight.ts（代码块语法高亮 + 复制按钮）
- [x] 8.4 实现 ChartComponent（useRef + useEffect 管理 ECharts 实例，resize 响应）
- [x] 8.5 实现 ChartFactory（createChartOption 生成 Bar/Line/Pie ECharts option）
- [x] 8.6 实现 ResultSetDisplay 组件（分页表格 + chart/table 切换）
- [x] 8.7 实现 ReportHtmlView 组件（sandboxed iframe + DOMPurify 净化 + 全屏模式）
- [x] 8.8 实现 report-html-template.ts（构建自包含 HTML 报告：CDN marked.js + ECharts）

## Phase 9. 收尾与质量

- [x] 9.1 实现 NotFound 页面（404 提示 + 返回首页链接）
- [x] 9.2 全局样式微调（响应式适配、Ant Design 主题 token 调优）
- [x] 9.3 确保 TypeScript 类型检查通过（tsc --noEmit 通过）
- [x] 9.4 ESLint 检查通过（0 errors, 11 warnings 均为一致的 react-hooks/exhaustive-deps 设计选择）
- [x] 9.5 生产构建验证（vite build 无错误）
- [ ] 9.6 与 python-agent-v2 后端联调验证（6 大能力模块端到端测试）
  - [ ] 9.6.1 Agent CRUD + API Key
  - [ ] 9.6.2 数据源绑定 + 知识库 + 语义模型 + Prompt + 预设问题
  - [ ] 9.6.3 模型配置 CRUD + 激活 + 测试连接
  - [ ] 9.6.4 SSE 流式对话 + 多会话管理 + 消息历史
  - [ ] 9.6.5 HumanFeedback approve/reject 全流程
  - [ ] 9.6.6 Markdown/HTML 报告 + ECharts 图表 + 结果集表格 + 报告下载
