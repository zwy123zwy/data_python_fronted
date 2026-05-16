## Why

当前 `data-agent-fronted` 项目是空壳，需要构建一个完整的 React + TypeScript 前端，对齐 Java 版 `DataAgent/data-agent-frontend`（Vue 3 实现）的全部能力。后端 `python-agent-v2` 已通过协议对齐可与前端联调，但缺少可用的前端界面。React 版将作为首选的 Web UI，提供给用户完整的智能体管理、数据源配置、知识库管理、流式对话、人工反馈、报告查看等全链路功能。

## What Changes

- 从零搭建 React + TypeScript + Vite 工程，替换 Vue 3 技术栈
- 实现 6 大能力模块：Agent 管理、Agent 配置、模型配置、流式对话、人工反馈、报告渲染
- 保持与后端 API 协议完全兼容（SSE 流式协议、RESTful API、会话管理）
- 复用现有后端 `GET /api/stream/search` 的 SSE `GraphNodeResponse` 协议，无需修改后端
- 保持与 Java 版前端一致的功能范围和用户体验

## Capabilities

### New Capabilities

- `agent-management`: Agent 目录列表、创建、详情/编辑、删除、发布/下线、API Key 管理
- `agent-configuration`: Agent 配置页卡（数据源绑定与选表、知识库管理、业务术语、语义模型、Prompt 模板、预设问题）
- `model-config`: AI 模型供应商配置（CRUD、激活、连通性测试、就绪检查）
- `chat-streaming`: SSE 流式对话界面（多会话管理、消息保存/加载、会话标题流式更新、停止生成、报告下载）
- `human-feedback`: 人工审核工作流（审批/拒绝计划、重新规划、多次拒绝超限处理）
- `report-rendering`: 报告与结果渲染（Markdown/HTML 报告、ECharts 图表、SQL 结果集表格、代码语法高亮）

### Modified Capabilities

<!-- 首次构建，无已有能力需要修改 -->

## Impact

- **新建工程**: `data-agent-fronted/` 目录下完整的前端工程
- **技术栈**: React 19 + TypeScript + Vite + React Router v6 + UI 库 + Zustand
- **依赖**: axios (HTTP), ECharts (图表), markdown-it (Markdown), highlight.js (代码高亮), DOMPurify (HTML 净化)
- **后端协议**: 复用 `python-agent-v2` 的 `/api/*` 接口，无需修改后端
- **开发端口**: 3000 (Vite dev server)，proxy → 后端 8100
