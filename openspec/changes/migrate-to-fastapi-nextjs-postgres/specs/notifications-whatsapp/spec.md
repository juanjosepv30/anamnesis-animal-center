# WhatsApp Notifications Specification

## Purpose

Preserves every legacy WhatsApp Cloud API notification flow and its scheduled triggers, pinned to `America/Bogota`, plus feature-flag/test-mode overrides. Template creation/editing remains a manual admin operation (Meta rate-limits template edits to 1 per 24h) — the system MUST NOT attempt to automate template edits.

## Requirements

### Requirement: Notification flows
The system MUST send: a new-patient alert to on-duty doctors on arrival; a "your turn is called, room X" message to the client on first call only; an appointment-booked confirmation; an unclosed-visit nag to the assigned doctor; and a post-visit review invite that fires only after real attendance (per `queue-management`).

#### Scenario: Patient arrives
- GIVEN a new arrival is registered
- WHEN the doctor(s) on duty for that service are determined
- THEN each MUST receive a WhatsApp alert naming the patient and turno

### Requirement: Scheduled jobs pinned to America/Bogota
The system MUST run these notification jobs on their legacy cadence, computed with a real TZ-aware library (never string-slicing):

| Job | Schedule | Purpose |
|---|---|---|
| Waiting-too-long / unclosed-visit reminder | every 5 min | notify the assigned doctor about their longest-waiting un-notified patient, and nag on visits left open |
| Day-before appointment reminder | daily 18:00 | remind clients of tomorrow's appointment |
| 1-hour-before appointment reminder | every 15 min | remind clients of imminent appointments |
| Doctor daily agenda digest | daily 06:00 | send each doctor their day's appointments |

Two further legacy scheduled jobs are NOT WhatsApp jobs and belong to other capabilities: the end-of-day queue cleanup (22:30, see `queue-management`) and the nightly Vetesoft pull (04:00, see `vetesoft-sync`).

#### Scenario: Reminder cooldown
- GIVEN a doctor was already notified about their longest-waiting patient within the cooldown window
- WHEN the 5-minute job runs again
- THEN no duplicate notification is sent for that doctor until the cooldown expires

### Requirement: Test-mode and feature-flag overrides
The system MUST support a test-mode override that redirects/copies outbound messages to a designated test number, and per-flow feature flags that can disable a notification flow without a deploy.

#### Scenario: Test mode enabled
- GIVEN test-mode is enabled
- WHEN any notification flow fires
- THEN the message MUST be redirected/copied to the test number instead of (or in addition to) the real recipient

### Requirement: Template management stays manual
The system MUST NOT programmatically create or edit Meta message templates at runtime; template changes remain an explicit, manual admin action outside the API surface.

#### Scenario: Admin needs to change a template
- GIVEN a template needs wording changes
- WHEN the admin performs the change
- THEN it MUST be done via a manual out-of-band admin workflow, not an automated runtime call

### Requirement: Delivery failure does not block the underlying action
A WhatsApp send failure MUST NOT roll back or block the queue/appointment action that triggered it; the system MUST record the failure so staff can see the notification did not go out.

#### Scenario: WhatsApp API is down when a patient arrives
- GIVEN the WhatsApp Cloud API is unreachable
- WHEN a new patient arrives and registration completes
- THEN the arrival MUST still be recorded successfully, with the notification marked as failed/undelivered
