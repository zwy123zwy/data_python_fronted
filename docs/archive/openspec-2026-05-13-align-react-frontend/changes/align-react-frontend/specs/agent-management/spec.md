## ADDED Requirements

### Requirement: Agent list with filter and search

The system SHALL display all agents in a card grid with statistics summary (total, published, draft, offline counts). Users MUST be able to filter agents by status (all/published/draft/offline) and search by keyword (name/description).

#### Scenario: View agent directory
- **WHEN** user navigates to /agents
- **THEN** system displays a statistics bar (total, published, draft, offline counts) and a grid of agent cards with name, description, status badge, category, and update time

#### Scenario: Filter by status
- **WHEN** user clicks a status filter tab (e.g., "Published")
- **THEN** system reloads agent list showing only agents with that status

#### Scenario: Search agents
- **WHEN** user types a keyword in the search box
- **THEN** system filters agents whose name or description contains the keyword

### Requirement: Create new agent

The system SHALL provide an agent creation form with fields: name, category, description, prompt, tags, and status. An optional avatar image can be uploaded. On success, navigates to the agent detail page.

#### Scenario: Create agent with required fields
- **WHEN** user fills in name, category, and description, then submits
- **THEN** system creates a new agent and navigates to /agent/:id

#### Scenario: Create agent with avatar
- **WHEN** user uploads an avatar image before submitting the form
- **THEN** system uploads the avatar file via POST /api/upload and includes it in the create request

### Requirement: Agent detail and editing

The system SHALL display agent detail as a tabbed page with sections: Base Setting, Data Source, Prompt, Knowledge, Business Knowledge, Semantics, Presets, and API Access. Basic metadata (name, description, category, tags, status) MUST be editable inline.

#### Scenario: View agent tabs
- **WHEN** user navigates to /agent/:id
- **THEN** system loads agent data and renders tabbed configuration interface with all 8 config sections

#### Scenario: Edit basic settings
- **WHEN** user switches to editing mode in the Base Setting tab and modifies agent metadata
- **THEN** system saves changes via PUT /api/agent/:id

### Requirement: Delete agent

The system SHALL allow deleting an agent with confirmation dialog. After deletion, navigates back to the agent list.

#### Scenario: Delete agent with confirmation
- **WHEN** user clicks delete button and confirms the dialog
- **THEN** system deletes the agent via DELETE /api/agent/:id and redirects to /agents

### Requirement: Publish and offline agent

The system SHALL allow publishing a draft agent or taking a published agent offline.

#### Scenario: Publish draft agent
- **WHEN** user clicks "Publish" on an agent with status "draft"
- **THEN** system calls publish API and updates the status badge to "Published"

#### Scenario: Take agent offline
- **WHEN** user clicks "Offline" on a published agent
- **THEN** system calls offline API and updates the status badge to "Offline"

### Requirement: API key management

The system SHALL allow viewing, generating, resetting, and deleting an agent's API key. The key MUST be masked by default with a toggle to reveal.

#### Scenario: Generate API key
- **WHEN** user clicks "Generate API Key" on an agent without a key
- **THEN** system calls POST /api/agent/:id/api-key and displays the new key

#### Scenario: Reset API key
- **WHEN** user clicks "Reset" on an existing API key
- **THEN** system regenerates the key and displays the new value

#### Scenario: Toggle API key visibility
- **WHEN** user clicks the visibility toggle on the API key field
- **THEN** system shows or masks the key string

### Requirement: Route guard for model readiness

The system SHALL check model configuration readiness before entering any page. If chat model or embedding model is not configured, redirect to /model-config.

#### Scenario: Redirect when model not ready
- **WHEN** user navigates to /agents or any agent page and the model is not ready
- **THEN** system redirects to /model-config

#### Scenario: Allow access when model ready
- **WHEN** user navigates to any page and the model is ready (chat model + embedding model configured)
- **THEN** system allows normal navigation
