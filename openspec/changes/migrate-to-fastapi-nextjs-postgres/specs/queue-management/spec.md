# Queue Management Specification

## Purpose

Reproduces the legacy `Anamnesis`-sheet queue (client intake → arrival → doctor call/attend/finish) with stable PKs, real DB transactions, and TZ-aware daily turno numbering. This is the core capability — every scenario below is grounded in observed `apps-script/Code.js` behavior, not a redesign.

## Queue states

| State | Meaning | Set by |
|---|---|---|
| `llenando` | Row created, client filling anamnesis via WhatsApp link | arrival registration (has phone) |
| `esperando` | Waiting to be called | client submit, phone-less arrival, failed link send |
| `llamando` | Doctor called the patient | doctor call / direct-call |
| `atendiendo` | In consultation | doctor attend / auto-sweep / reception override |
| `atendido` | Visit closed | doctor finish / direct-call auto-close / auto-sweep / end-of-day sweep |
| `ausente` | Marked no-show | manual reception/doctor action |
| `cancelada` | Administratively cancelled | manual/admin only — no automatic code path sets it |

Legal transitions: `llenando`→`esperando`→`llamando`→`atendiendo`→`atendido`; `llamando`→`atendiendo` also occurs via the auto-sweep; any non-`atendido` state may move to `ausente`.

## Requirements

### Requirement: Stable-ID addressing
Every queue mutation endpoint MUST address the record by a stable primary key (UUID), never a row/array index.

#### Scenario: Doctor calls a patient
- GIVEN a queue record with a stable ID
- WHEN a doctor calls it
- THEN the endpoint MUST accept the stable ID, not a positional index

### Requirement: Daily turno numbering
The system MUST assign a turno code `{PREFIX}-{NN}` per service, where the sequence resets when the calendar day changes in `America/Bogota`, and never reuses a number within the same day even if earlier rows are deleted (next number = highest-observed-N-today + 1, not a row count).

#### Scenario: First patient of the day
- GIVEN no consultation-service turno exists yet today
- WHEN a new consultation patient registers
- THEN they receive `C-01`

#### Scenario: Concurrent registrations don't collide
- GIVEN two arrivals for the same service are submitted at nearly the same instant
- WHEN both are processed
- THEN they MUST receive two different sequential turno numbers — the concurrency guarantee previously provided by `LockService.getScriptLock()` MUST be preserved via a DB transaction or equivalent serializing mechanism

#### Scenario: Turno numbers never repeat mid-day after a deletion
- GIVEN turno `C-05` was assigned then its row deleted
- WHEN the next consultation patient registers the same day
- THEN they receive `C-06`, not `C-05`

### Requirement: Arrival registration with existing-row linking
If a same-day queue row already exists for the arriving patient, the system MUST update that row rather than create a duplicate. An authoritative scheduled-appointment arrival MUST overwrite any doctor preference left by a prior walk-in link on the same row.

#### Scenario: Client already filling the form, reception marks arrival
- GIVEN a row exists today in `llenando` for this patient
- WHEN reception registers the arrival
- THEN the same row is updated (not duplicated), and the caller is told the client is still filling the form

#### Scenario: Scheduled appointment overrides walk-in preference
- GIVEN a row was created as a walk-in with doctor preference X
- WHEN a scheduled-appointment arrival for the same patient/day names doctor Y
- THEN the row's doctor preference MUST become Y

### Requirement: Duplicate walk-in suppression
The system MUST suppress duplicate rows from rapid double-submits: if an open row with the same pet+owner+service was created within the last 120 seconds, the system MUST return that row's existing turno instead of creating a new one.

#### Scenario: Double-click on the arrival button
- GIVEN a walk-in was registered 5 seconds ago and is still open
- WHEN the identical registration is submitted again
- THEN the response MUST return the same turno with a duplicate flag, and no new row is created

### Requirement: Doctor call/attend/finish lifecycle
Calling a patient (`llamando`) MUST timestamp the call only on the first call and notify the client's WhatsApp only on that first call — repeats MUST be idempotent. Attending (`atendiendo`) MUST allow a doctor to hold more than one active patient at once (no auto-close of a prior `atendiendo`). Finishing (`atendido`) MUST timestamp the close only on the first transition into `atendido` (idempotent on retried requests), and MUST trigger the post-visit review invite only if the record actually passed through `atendiendo`.

#### Scenario: Doctor's client retries the call action
- GIVEN a patient is already `llamando`, called 30 seconds ago
- WHEN a retried call request arrives after a network blip
- THEN the call timestamp MUST NOT change and no second WhatsApp notification is sent

#### Scenario: No-show marked without ever being attended
- GIVEN a patient was called but never entered `atendiendo`
- WHEN reception marks them `atendido` directly
- THEN no review-invite WhatsApp MUST be sent

### Requirement: Direct-call with same-doctor auto-close
Calling a patient directly (bypassing the wait order) MUST immediately transition any other `llamando` record already assigned to the same doctor today to `atendido`, and MUST be idempotent for retries by the same doctor within a short window (no duplicate call timestamp or notification on retry).

#### Scenario: Doctor direct-calls a new patient while another is still "llamando"
- GIVEN doctor D has patient A in `llamando`
- WHEN doctor D direct-calls patient B
- THEN patient A transitions to `atendido`, and patient B transitions to `llamando`

### Requirement: Unattended-call auto-sweep
A distinct scheduled sweep MUST transition any record stuck in `llamando` for more than 2 minutes without doctor action to `atendiendo`, and — when the doctor is known — auto-close (`atendido`) that doctor's other active `atendiendo` record, so an automatic transition never leaves a doctor appearing to attend two patients at once. This sweep MUST run on a fixed schedule (legacy: every 5 minutes) and MAY additionally run opportunistically, throttled to at most once per minute, when clients poll/subscribe for queue state. This is a SEPARATE mechanism from direct-call auto-close (which is immediate, not grace-timed).

#### Scenario: Doctor never explicitly attends a called patient
- GIVEN patient A has been `llamando` for 3 minutes
- WHEN the sweep runs
- THEN patient A transitions to `atendiendo` automatically

### Requirement: End-of-day cleanup
A scheduled job (legacy: daily 22:30 `America/Bogota`) MUST transition any record still `atendiendo` to `atendido`, closing out the day.

#### Scenario: Patient left in consultation at close
- GIVEN a record is `atendiendo` at 22:30
- WHEN the end-of-day sweep runs
- THEN it transitions to `atendido`

### Requirement: Reception overrides
Reception MUST be able to assign/reassign a doctor, edit the patient identity on a record without losing its turno/position/arrival time, and resend the anamnesis-form link. The anamnesis content on that record MUST be cleared when the patient identity is edited.

#### Scenario: Wrong patient linked to a turno
- GIVEN reception picked the wrong patient from Vetesoft for a turno
- WHEN reception edits the turno to the correct patient
- THEN the turno number and arrival time are unchanged, and the old anamnesis content is cleared
