## ADDED Requirements

### Requirement: Model configuration list

The system SHALL display all configured AI models in a table showing provider, model name, model type (Chat/Embedding), active status, and base URL. Users MUST be able to add, edit, and delete model configurations.

#### Scenario: View model list
- **WHEN** user navigates to /model-config
- **THEN** system displays a table of configured models with columns: provider, model name, type, active status, base URL, and action buttons

#### Scenario: Add model configuration
- **WHEN** user clicks "Add Model" and fills in provider, API key, base URL, model name, model type, temperature, max tokens
- **THEN** system calls POST /api/model-config and the new model appears in the list

#### Scenario: Edit model configuration
- **WHEN** user clicks "Edit" on a model and modifies settings in the dialog
- **THEN** system calls PUT /api/model-config with updated values

#### Scenario: Delete model configuration
- **WHEN** user clicks "Delete" on a model and confirms
- **THEN** system calls DELETE /api/model-config/:id

### Requirement: Model activation

The system SHALL allow activating one chat model and one embedding model at a time. Only one model of each type can be active simultaneously.

#### Scenario: Activate model
- **WHEN** user clicks "Activate" on an inactive model
- **THEN** system calls POST /api/model-config/:id/activate and the model's status changes to active; previously active model of same type becomes inactive

### Requirement: Model connectivity test

The system SHALL provide a connection test button for each model configuration, displaying test result (success/failure with message).

#### Scenario: Test model connection
- **WHEN** user clicks "Test Connection" on a model configuration
- **THEN** system calls POST /api/model-config/test and displays a success or error notification with the response message

### Requirement: Model readiness check

The system SHALL expose a model readiness check that indicates whether a chat model and an embedding model are both configured and active. This check is used by the route guard.

#### Scenario: Check model readiness
- **WHEN** the application loads or navigates between routes
- **THEN** system calls GET /api/model-config/check-ready and stores the readiness state (chatModelReady, embeddingModelReady, ready)

#### Scenario: Route blocked when model not ready
- **WHEN** model readiness check returns ready=false and user is not on /model-config
- **THEN** system redirects to /model-config

#### Scenario: Model config page always accessible
- **WHEN** user navigates to /model-config
- **THEN** system does NOT redirect even if models are not ready

### Requirement: Proxy configuration support

The system SHALL support model-level proxy configuration with host, port, and optional authentication.

#### Scenario: Configure proxy for a model
- **WHEN** user enables proxy in the model edit dialog and fills in host, port, username, password
- **THEN** system saves proxy settings as part of the model configuration
