# Staff Authentication Specification

## Purpose

Every mutating staff action (doctor, reception, admin) MUST be attributable to an authenticated identity. This is NEW behavior — the legacy system has no real staff auth (a "doctor" is a name picked from a dropdown, stored in `localStorage`) and only the commissions module has any secret (a plaintext 4-digit PIN). Client-facing anamnesis submission and the per-visit review link stay unauthenticated.

## Requirements

### Requirement: Per-staff credentials with server-side hashing
The system MUST store one credential record per staff member (doctor, reception, admin) with a server-side salted hash (bcrypt/argon2 or equivalent). Legacy plaintext PINs MUST NOT exist as active credentials in the new system.

#### Scenario: Doctor logs in with a hashed credential
- GIVEN a doctor has a provisioned credential record
- WHEN they submit correct credentials
- THEN the system issues a session/JWT and MUST NOT expose or log the raw secret

### Requirement: No legacy credential is carried forward
Legacy commissions PINs MUST NOT be imported, in any form — not as plaintext, and not as a hash. The ETL MUST NOT read the legacy PIN column into the new system at all. Every staff account MUST be provisioned with a freshly issued credential.

#### Scenario: ETL encounters the legacy PIN column
- GIVEN the legacy `Medicos` sheet contains a plaintext PIN column
- WHEN the ETL imports doctor records
- THEN it MUST skip that column entirely, and no credential material derived from it may reach the new database

#### Scenario: Staff account provisioned at cutover
- GIVEN a staff member (doctor, reception, or admin), whether or not they had a legacy commissions PIN
- WHEN their account is provisioned for the new system
- THEN they MUST receive a newly issued credential via a first-login credential-setup flow, and MUST NOT be granted a blank, default, or legacy-derived password

#### Scenario: Legacy PIN offers no access after cutover
- GIVEN a staff member who knows their old 4-digit commissions PIN
- WHEN they attempt to authenticate with it against the new system
- THEN authentication MUST fail — the old secret has no validity in the new system

### Requirement: Role-scoped identity
The system MUST distinguish `doctor`, `reception`, and `admin` roles. Every mutating endpoint MUST record the authenticated actor's stable ID and role on the affected record.

#### Scenario: Doctor calls a patient
- GIVEN an authenticated doctor session
- WHEN the doctor calls the next patient
- THEN the queue record MUST store that doctor's stable ID as the actor, never a free-text name

### Requirement: Session invalidation on credential change
The system MUST invalidate all previously issued sessions/tokens for a staff member the moment their credential changes (equivalent to the legacy epoch-bump scheme).

#### Scenario: Credential changed while logged in elsewhere
- GIVEN a doctor is logged in on two devices
- WHEN they change their credential on device A
- THEN device B's session MUST be rejected on its next authenticated request

### Requirement: Brute-force lockout
The system MUST lock out an identity+role after 5 consecutive failed attempts, for a cooldown period (legacy default: 10 minutes), tracked durably and independent of any client-controlled field.

#### Scenario: Repeated failed logins
- GIVEN 5 failed attempts for the same account within the cooldown period
- WHEN a 6th attempt is made before cooldown expires
- THEN the system MUST reject it without checking the credential, with a generic "too many attempts" error

### Requirement: Client-facing endpoints remain unauthenticated
The public anamnesis submission form and the per-visit review link MUST NOT require staff authentication.

#### Scenario: Client submits the anamnesis form
- GIVEN a client with no account
- WHEN they submit the public anamnesis form
- THEN the system MUST accept the submission without requiring login
