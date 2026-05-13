## ADDED Requirements

### Requirement: Markdown report rendering

The system SHALL render Markdown content from SSE stream output and saved messages. Markdown MUST support ECharts code blocks (fenced code blocks with "echarts" language tag rendered as interactive charts), syntax-highlighted code blocks (SQL, Python, JSON), tables, and standard Markdown formatting.

#### Scenario: Render Markdown with ECharts
- **WHEN** SSE stream contains a Markdown block with an \`\`\`echarts fenced code block
- **THEN** the ECharts block is rendered as an interactive ECharts chart using the provided chart option JSON

#### Scenario: Render SQL code block with highlighting
- **WHEN** Markdown contains a \`\`\`sql fenced code block
- **THEN** the SQL code is syntax-highlighted using highlight.js and displays a copy button

#### Scenario: Render Python code block with highlighting
- **WHEN** Markdown contains a \`\`\`python fenced code block
- **THEN** the Python code is syntax-highlighted with a copy button

### Requirement: HTML report with sanitization

The system SHALL render HTML reports using DOMPurify for sanitization to prevent XSS attacks. HTML reports MUST be displayed in a sandboxed iframe for isolation.

#### Scenario: Display HTML report in iframe
- **WHEN** SSE stream produces an HTML report (messageType "html-report")
- **THEN** system creates a sandboxed iframe with the sanitized HTML content

#### Scenario: Fullscreen report view
- **WHEN** user clicks "Fullscreen" on a report
- **THEN** system opens the report in a fullscreen modal overlay

### Requirement: Result set table display

The system SHALL display SQL query result sets as paginated HTML tables with column headers and data rows. Client-side pagination MUST be supported.

#### Scenario: Display result set as table
- **WHEN** SSE stream sends a result set with columns and data rows
- **THEN** system renders a styled table with column headers and paginated data (pageSize configurable, default 100 rows per page)

#### Scenario: Paginate through result set
- **WHEN** user clicks next/previous page or enters a page number
- **THEN** system shows the corresponding page of data without re-fetching from server

#### Scenario: Copy result set cell
- **WHEN** user clicks on a cell in the result set table
- **THEN** the cell's text content is copied to clipboard

### Requirement: Result set chart toggle

The system SHALL allow toggling between table view and chart view for result sets that include display style metadata (bar, column, line, pie). Chart view MUST render an ECharts chart using the result data.

#### Scenario: Toggle to chart view
- **WHEN** a result set has displayStyle metadata and user switches to chart view
- **THEN** system renders an ECharts bar/line/pie/column chart based on the displayStyle configuration

#### Scenario: Toggle back to table view
- **WHEN** user switches from chart view back to table view
- **THEN** the paginated table display returns

#### Scenario: Result set without display style defaults to table
- **WHEN** a result set has no displayStyle metadata
- **THEN** table view is the default and chart toggle is not available

### Requirement: Report download as standalone HTML

The system SHALL allow downloading a complete standalone HTML report that embeds all CSS, JS (marked.js, ECharts via CDN), and content for offline viewing.

#### Scenario: Download standalone report
- **WHEN** user clicks "Download Report" for a session with report content
- **THEN** system generates a self-contained HTML file with embedded CDN dependencies and triggers download

### Requirement: Chat message type rendering

The system SHALL render different message types with appropriate components based on the messageType field: "text" as plain text, "sql" as syntax-highlighted code, "result-set" as paginated table/chart, "html-report" as HTML iframe, "markdown-report" as Markdown with ECharts, "html" as sanitized HTML.

#### Scenario: Render each message type
- **WHEN** loading historical messages of various types from GET /api/sessions/:sessionId/messages
- **THEN** each message is rendered with its appropriate component based on messageType
