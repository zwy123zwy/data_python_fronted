## ADDED Requirements

### Requirement: Display plan for human review

The system SHALL display the execution plan in a review card when the SSE stream pauses at the HumanFeedbackNode. The plan MUST show each step (SQL/Python/Report) with step number and description. Users MUST see Approve and Reject buttons.

#### Scenario: Stream pauses for human feedback
- **WHEN** the SSE stream reaches HumanFeedbackNode and sends the plan data
- **THEN** system displays a HumanFeedback review card showing the plan steps, an Approve button, and a Reject button with optional feedback text area

#### Scenario: Approve plan
- **WHEN** user reviews the plan and clicks "Approve"
- **THEN** system resumes the SSE stream with the same threadId, humanFeedbackContent (optional feedback text), and rejectedPlan=false

#### Scenario: Reject plan
- **WHEN** user reviews the plan, enters feedback text explaining what needs to change, and clicks "Reject"
- **THEN** system resumes the SSE stream with the same threadId, humanFeedbackContent, and rejectedPlan=true

### Requirement: Plan rejection and replanning

The system SHALL handle plan rejection by sending the stream to the Planner for regeneration. If the user rejects too many times (exceeds max retries), the system MUST display an appropriate error message.

#### Scenario: Successful replan after rejection
- **WHEN** user rejects a plan and the backend regenerates a new plan
- **THEN** the SSE stream pauses again at HumanFeedbackNode with the new plan, and the reject count is incremented

#### Scenario: Exceed max rejections
- **WHEN** user rejects the plan and the backend has exceeded the maximum retry count
- **THEN** system displays an error notification indicating the plan cannot be regenerated further

### Requirement: Display plan rejection feedback

The system SHALL display the current rejection count and any previous feedback when showing the human review card.

#### Scenario: Show rejection context on re-review
- **WHEN** the stream pauses at HumanFeedbackNode after a previous rejection
- **THEN** the review card shows the rejection count (e.g., "Rejection 2 of 3") and the previously submitted feedback text

### Requirement: Session threadId for resume

The system SHALL track the threadId from SSE responses for resuming the stream with human feedback. The threadId MUST be persisted in session state.

#### Scenario: Resume stream with threadId
- **WHEN** user submits human feedback (approve or reject)
- **THEN** system sends a new SSE request with threadId=<current threadId>, humanFeedbackContent, and rejectedPlan parameters

### Requirement: Human feedback toggle

The system SHALL allow enabling human feedback mode per query via a toggle switch in the chat input area.

#### Scenario: Enable human feedback for a query
- **WHEN** user toggles "Human Review" to ON and sends a query
- **THEN** the SSE request includes humanFeedback=true and the stream pauses at planning stage for review
