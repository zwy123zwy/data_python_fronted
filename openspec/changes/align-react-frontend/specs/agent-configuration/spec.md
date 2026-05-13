## ADDED Requirements

### Requirement: Data source binding and table selection

The system SHALL display all data sources available for an agent, with the ability to add, remove, activate/deactivate data sources, and select which tables to include. Users MUST be able to initialize schema from a data source and view table lists.

#### Scenario: View bound data sources
- **WHEN** user opens the Data Source tab on an agent
- **THEN** system displays a table of bound data sources showing name, type, host, database name, active status, and selected tables

#### Scenario: Bind a new data source
- **WHEN** user clicks "Add" and selects a data source from the list
- **THEN** system calls POST /api/agent/:agentId/datasources with the selected datasourceId

#### Scenario: Remove a data source binding
- **WHEN** user clicks "Remove" on a bound data source
- **THEN** system calls DELETE /api/agent/:agentId/datasources for that datasourceId

#### Scenario: Toggle data source active state
- **WHEN** user toggles the active switch for a data source
- **THEN** system calls PUT to toggle active status

#### Scenario: Select tables for a data source
- **WHEN** user opens table selection dialog and checks/unchecks tables
- **THEN** system saves selected tables via PUT with updateSelectedTables body

#### Scenario: Initialize schema
- **WHEN** user clicks "Initialize Schema" for a data source
- **THEN** system calls POST /api/agent/:agentId/datasources/init-schema

### Requirement: Data source management

The system SHALL provide CRUD for data sources, including testing connections and browsing table lists.

#### Scenario: Create data source
- **WHEN** user opens the add data source dialog and fills in connection details (name, type, host, port, database, username, password)
- **THEN** system calls POST /api/datasource and the new data source appears in the add list

#### Scenario: Test data source connection
- **WHEN** user clicks "Test Connection" on a data source
- **THEN** system calls POST /api/datasource/:id/test and displays success or failure

### Requirement: Logical relation configuration

The system SHALL allow defining logical foreign key relationships between tables across data sources, supporting 1:1, 1:N, and N:1 relation types.

#### Scenario: View logical relations
- **WHEN** user opens the logical relations dialog for a data source
- **THEN** system displays existing relations with source table/column, target table/column, and relation type

#### Scenario: Add logical relation
- **WHEN** user adds a relation between two table columns with a relation type
- **THEN** system calls POST to create the relation

#### Scenario: Batch save logical relations
- **WHEN** user modifies multiple relations and clicks save
- **THEN** system calls batch save with all relations

### Requirement: Knowledge base management

The system SHALL allow agents to have knowledge entries of types: Document (DOCUMENT), Question & Answer (QA), and FAQ. Knowledge entries MUST support embedding retry and recall toggle.

#### Scenario: View knowledge list
- **WHEN** user opens the Knowledge tab
- **THEN** system displays a paginated table of knowledge entries with title, type, embedding status, recall status, and creation time

#### Scenario: Create document knowledge
- **WHEN** user opens create dialog, selects type "Document", fills in title and content
- **THEN** system calls POST /api/agent-knowledge with the form data

#### Scenario: Create QA knowledge
- **WHEN** user opens create dialog, selects type "QA", fills in question and answer (content)
- **THEN** system creates a QA knowledge entry

#### Scenario: Retry embedding
- **WHEN** a knowledge entry has failed embedding status and user clicks "Retry"
- **THEN** system calls POST to retry embedding for that entry

#### Scenario: Toggle recall
- **WHEN** user toggles the recall switch on a knowledge entry
- **THEN** system calls PUT to update recall status

### Requirement: Business knowledge configuration

The system SHALL allow defining business terminology with synonyms and recall toggle. Users MUST be able to refresh the vector store for the business knowledge index.

#### Scenario: Add business term
- **WHEN** user creates a business term with name, description, and synonyms
- **THEN** system calls POST /api/business-knowledge

#### Scenario: Edit business term
- **WHEN** user modifies a business term's description or synonyms
- **THEN** system calls PUT /api/business-knowledge/:id

#### Scenario: Refresh vector store
- **WHEN** user clicks "Refresh Vector Store"
- **THEN** system calls POST to rebuild the vector index for this agent's business terms

### Requirement: Semantic model configuration

The system SHALL allow mapping database columns to business names with synonyms and descriptions. Users MUST be able to batch import (JSON/Excel), batch delete, batch enable/disable, and download Excel template.

#### Scenario: View semantic models
- **WHEN** user opens the Semantics tab
- **THEN** system displays a table of column-to-business-name mappings with table name, column name, business name, data type, and status

#### Scenario: Create semantic mapping
- **WHEN** user creates a mapping for a table column with business name and description
- **THEN** system calls POST /api/semantic-model

#### Scenario: Batch import from JSON
- **WHEN** user pastes JSON data and imports
- **THEN** system calls batch import API with the JSON array

#### Scenario: Import from Excel file
- **WHEN** user uploads an Excel file and imports
- **THEN** system calls the Excel import API

#### Scenario: Download Excel template
- **WHEN** user clicks "Download Template"
- **THEN** system downloads an Excel template file

#### Scenario: Batch enable/disable
- **WHEN** user selects multiple rows and clicks "Enable" or "Disable"
- **THEN** system calls batch enable/disable API with selected IDs

#### Scenario: Batch delete
- **WHEN** user selects multiple rows and clicks "Delete"
- **THEN** system shows confirmation dialog, then calls batch delete API

### Requirement: Prompt template configuration

The system SHALL allow viewing, adding, editing, deleting prompt templates for different prompt types (report-generator and other types). Users MUST be able to enable/disable individual prompts and batch enable/disable.

#### Scenario: View prompts by type
- **WHEN** user opens the Prompt tab with a selected prompt type
- **THEN** system displays a list of prompt templates with content preview, priority, sort order, and enabled state

#### Scenario: Create prompt template
- **WHEN** user opens create dialog and fills in content, priority, and sort order
- **THEN** system calls POST /api/prompt-config/save

#### Scenario: Toggle prompt enabled state
- **WHEN** user clicks enable/disable on a prompt entry
- **THEN** system calls the enable/disable API for that prompt

### Requirement: Preset questions configuration

The system SHALL allow defining preset questions that appear as clickable chips in the chat interface for quick user input.

#### Scenario: View preset questions
- **WHEN** user opens the Presets tab
- **THEN** system displays a list of preset questions with question text, sort order, and active state

#### Scenario: Add preset question
- **WHEN** user opens dialog and enters a question text
- **THEN** system adds the question to the list

#### Scenario: Batch save preset questions
- **WHEN** user reorders, adds, or edits multiple questions and clicks save
- **THEN** system calls batch save API for all questions

#### Scenario: Delete preset question
- **WHEN** user clicks delete on a preset question
- **THEN** system removes it via DELETE API
