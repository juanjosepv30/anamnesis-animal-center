# Reviews Specification

## Purpose

Post-visit star rating plus comment, reached via a per-visit link, unauthenticated.

## Requirements

### Requirement: Per-visit review link
The system MUST generate a unique, unauthenticated link per finalized visit that opens a review form scoped to that visit only.

#### Scenario: Client opens their review link
- GIVEN a visit was finalized and a review link was sent
- WHEN the client opens the link
- THEN they see a review form for that specific visit, not any other

### Requirement: Star rating and comment submission
The system MUST accept a required star rating and an optional free-text comment, once per visit.

#### Scenario: Client submits a review
- GIVEN a valid, unused review link
- WHEN the client submits a rating and comment
- THEN the review MUST be stored linked to that visit

### Requirement: Single submission per visit
The system MUST reject a second review submission for the same visit link.

#### Scenario: Client resubmits
- GIVEN a review was already submitted for this visit
- WHEN the same link is used to submit again
- THEN the system MUST reject the second submission

### Requirement: Review triggered only on real attendance
A review invite MUST be sent only for visits that actually passed through `atendiendo` (per `queue-management`), never for visits closed without attendance.

#### Scenario: Visit closed without attendance
- GIVEN a visit was marked `atendido` without ever being `atendiendo`
- WHEN visit-close processing runs
- THEN no review link MUST be generated or sent
