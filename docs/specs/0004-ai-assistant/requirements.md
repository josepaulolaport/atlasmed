# Spec 0004: AI Assistant Requirements

## User Story

As an Atlasmed user, I want an AI assistant that can answer questions and perform allowed actions across CRM, territory, analytics, and workflow data, so that I can work faster while preserving privacy, security, and auditability.

## Acceptance Criteria

1. WHEN a user asks a question THEN the AI assistant SHALL only use data the user is authorized to access.
2. WHEN the AI assistant proposes an action THEN the system SHALL verify permissions before executing the action.
3. WHEN the AI assistant executes an action THEN the system SHALL record an audit log with actor, tool/action, inputs summary, result, and timestamp.
4. WHEN an action is high-impact THEN the system SHALL require confirmation or approval before execution.
5. WHEN AI-generated reminders are created THEN the system SHALL label them as AI-generated and allow user review.
6. IF retrieved data includes healthcare-sensitive information THEN the system SHALL apply tenant, role, and scope filters before the AI model receives context.
7. WHEN an admin reviews AI governance settings THEN the system SHALL expose usage, actions, failures, and policy controls.
