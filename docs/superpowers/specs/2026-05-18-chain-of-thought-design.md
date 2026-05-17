# 思维链（Chain of Thought）展示设计

## 问题

旧版节点展示采用独立卡片（card block）模式：每个 `GraphNodeResponse[]` 渲染为一个 `<div class="agent-response-block">`，标题是原始 Java 节点名如 `IntentRecognitionNode`，内容是代码块/TEXT 文本。

| 旧版问题 | 说明 |
|----------|------|
| 节点名是技术名 | `SchemaRecallNode`、`SemanticConsistencyNode` 对用户无意义 |
| 无时间线感 | 用户看不出执行到哪一步、还剩几步 |
| 全展开 | 所有节点内容默认展示，信息密度高，淹没关键结果 |
| 无执行态 | 完成/进行中节点视觉无区分 |

## 设计：Timeline + 折叠 + 语义化标签

### 视觉布局

```
┌─────────────────────────────────────────────┐
│  ◉ 思考中...                                │  ← 头部状态指示
│                                             │
│  ✓  分析用户意图  IntentRecognitionNode  ▲   │  ← 中文标签 + 原名 + 折叠箭头
│  │  正在进行意图识别...                       │
│  │  意图识别完成！                            │
│                                             │
│  ✓  检索知识库  EvidenceRecallNode  ▲        │
│  │  [SQL 代码块]                            │
│                                             │
│  ◉  分析数据表结构  SchemaRecallNode  (展开)  │  ← 最后一个节点自动展开
│  │  正在加载数据库表结构...找到 5 张表         │
│                                             │
│  点击步骤标题可展开/折叠详情                   │
└─────────────────────────────────────────────┘
```

### 映射表

16 个节点 → 中文标签 + Ant Design 语义图标：

| Java nodeName | 中文标签 | 图标 |
|---------------|---------|------|
| `IntentRecognitionNode` | 分析用户意图 | `SearchOutlined` |
| `EvidenceRecallNode` | 检索知识库 | `BookOutlined` |
| `SchemaRecallNode` | 分析数据表结构 | `DatabaseOutlined` |
| `TableRelationNode` | 分析表关系 | `LinkOutlined` |
| `QueryEnhanceNode` | 优化查询 | `ThunderboltOutlined` |
| `PlannerNode` | 制定执行计划 | `ScheduleOutlined` |
| `FeasibilityAssessmentNode` | 评估可行性 | `CheckCircleOutlined` |
| `HumanFeedbackNode` | 等待人工确认 | `UserSwitchOutlined` |
| `SqlGenerateNode` | 生成 SQL | `ConsoleSqlOutlined` |
| `SqlExecuteNode` | 执行 SQL | `BranchesOutlined` |
| `SemanticConsistencyNode` | 语义一致性检查 | `LinkOutlined` |
| `PythonGenerateNode` | 生成分析代码 | `CodeOutlined` |
| `PythonExecuteNode` | 执行分析代码 | `RocketOutlined` |
| `PythonAnalyzeNode` | 分析执行结果 | `BarChartOutlined` |
| `PlanExecutorNode` | 执行计划 | `ControlOutlined` |
| `ReportGeneratorNode` | 生成报告 | `FileTextOutlined` |

### 展开/折叠规则

```
最后一个节点 (=streaming 进行中) → 始终展开，dot = ◉ LoadingOutlined 蓝色
RESULT_SET 节点                  → 始终展开
ReportGeneratorNode + MARK_DOWN  → 始终展开
其他已完成节点                    → 默认折叠，dot = ✓ 绿色 CheckCircleFilled
                                  → 点击标题可手动展开/折叠
```

### 头部状态

| 状态 | 图标 | 文案 |
|------|------|------|
| 流式进行中 | `<LoadingOutlined spin>` 蓝色 | "思考中..." |
| 全部完成 | `<CheckCircleFilled>` 绿色 | "思考完成" |

## 涉及文件

| 文件 | 角色 |
|------|------|
| `src/components/run/ChainOfThought.tsx` | NEW — 思维链组件，Timeline + NODE_META + 折叠逻辑 |
| `src/components/run/ChatMessages.tsx` | MODIFIED — 用 `<ChainOfThought>` 替代旧的 `generateNodeHtml(nodeBlock)` |
| `src/utils/nodeFormat.ts` | 不变 — `formatNodeContent()` 仍被 ChainOfThought 调用来渲染代码块内容 |

## 数据流

```
SSE data: {nodeName: "SqlGenerateNode", textType: "SQL", text: "SELECT ..."}
  → streamRequest.ts onMessage
  → nodeBlocks.push([...])  按 nodeName 分组
  → ChatMessages 渲染 <ChainOfThought nodeBlocks={...} />
  → ChainOfThought: nodeBlocks.map → timeline items
     → NODE_META[nodeName] → 中文标签 + 图标
     → formatNodeContent(block) → HTML 渲染代码/TEXT/MARKDOWN
```

## 向后兼容

历史消息（`ChatMessage.messageType === 'html'`）仍用 `dangerouslySetInnerHTML` 渲染旧版 card block HTML，无需数据迁移。
