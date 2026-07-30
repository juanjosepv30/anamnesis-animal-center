# Scheduling Specification

## Purpose

Covers appointments (`Citas`), doctor weekly availability (`Horarios`), unavailability blocks (`Bloqueos`), and the waitlist (`Interesados`). The legacy code has TWO DISTINCT approval-artifact rules that must not be conflated: a block-override approval photo, and a payment-proof photo for one specific doctor's specialized service.

## Requirements

### Requirement: Appointment overlap guard
The system MUST reject a new/edited appointment that overlaps an existing non-cancelled appointment for the same doctor.

#### Scenario: Double-booking attempt
- GIVEN doctor D has an appointment 10:00–10:30
- WHEN a new appointment for doctor D at 10:15–10:45 is submitted
- THEN it MUST be rejected with the conflicting time reported

### Requirement: Unavailability-block guard, overridable with approval photo
The system MUST reject booking a slot the doctor marked unavailable (`Bloqueos`) unless an explicit override flag is set. When overridden, the system MUST require an uploaded approval photo (the doctor's authorization to book over the block) and MUST fail the booking before any write if that upload fails.

#### Scenario: Booking over a blocked slot without override
- GIVEN doctor D blocked 14:00–16:00 today
- WHEN an appointment is requested at 14:30 without an override
- THEN it MUST be rejected as blocked

#### Scenario: Booking over a blocked slot with override
- GIVEN doctor D blocked 14:00–16:00 today
- WHEN reception submits an appointment at 14:30 with override=true and an approval photo
- THEN the appointment MUST be created and the approval-photo URL stored, only if the upload succeeded

### Requirement: Payment-proof gate (independent of blocks)
Booking a specialized consultation/control with the flagged doctor MUST require an uploaded payment-proof photo, regardless of whether the slot is blocked. This is a SEPARATE rule from the block-override approval photo above; the two artifacts and their errors MUST NOT be merged into one field or one error code.

#### Scenario: Specialized booking without payment proof
- GIVEN the flagged-doctor + specialized-service combination
- WHEN an appointment is requested without a payment-proof upload
- THEN it MUST be rejected with a "missing payment proof" error distinct from the block-guard error

#### Scenario: Specialized booking on a non-blocked slot still requires payment proof
- GIVEN the flagged-doctor + specialized-service combination on a slot with no block
- WHEN an appointment is requested without a payment-proof upload
- THEN it MUST still be rejected — the payment-proof rule does not depend on `Bloqueos` at all

### Requirement: Weekly schedule and turno-window guard
The system MUST reject an appointment outside the doctor's configured weekly working hours for that weekday unless overridden.

#### Scenario: Booking outside working hours
- GIVEN doctor D works 08:00–12:00 on Mondays
- WHEN an appointment is requested for Monday 13:00 without override
- THEN it MUST be rejected as outside the doctor's turno

### Requirement: Waitlist
The system MUST support recording interested clients (`Interesados`) independent of the appointment/queue flow, without requiring a confirmed slot.

#### Scenario: Client wants to be notified of an opening
- GIVEN no slot is currently available
- WHEN a client is added to the waitlist for a doctor/service
- THEN the waitlist record is created without an appointment being created

### Requirement: Arrival links back to appointment
When a scheduled-appointment patient arrives, the queue record MUST reference the originating appointment.

#### Scenario: Scheduled patient checks in
- GIVEN an appointment exists for today
- WHEN the patient arrives and is registered
- THEN the appointment record MUST be updated with the resulting turno reference
