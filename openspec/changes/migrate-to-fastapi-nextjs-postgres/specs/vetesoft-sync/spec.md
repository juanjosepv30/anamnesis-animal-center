# Vetesoft Sync Specification

## Purpose

Vetesoft remains the system of record for patients/owners. The system MUST preserve the nightly full-pull pattern into a local searchable cache. Per-request proxying is explicitly NOT an acceptable substitute, because Vetesoft has no partial/full-text search API.

## Requirements

### Requirement: Nightly full pull
The system MUST run a scheduled job (legacy: daily 04:00 `America/Bogota`) that pulls the full Vetesoft patient/owner dataset (~43k records) into a Postgres cache table, replacing the prior cached set for search purposes.

#### Scenario: Nightly sync runs
- GIVEN it is 04:00 `America/Bogota`
- WHEN the sync job runs
- THEN the Postgres cache table MUST reflect the full current Vetesoft dataset by the time it completes

### Requirement: Fuzzy search over the cache
The system MUST expose fuzzy/partial-text search over the cached dataset for both client-facing and staff-facing patient lookup, without calling Vetesoft per keystroke.

#### Scenario: Reception searches by partial owner name
- GIVEN the cache is populated
- WHEN reception types a partial owner name
- THEN matching patients are returned from the Postgres cache, not from a live Vetesoft call

### Requirement: Vetesoft remains system of record
The system MUST treat cached patient/owner data as read-only/derived; any correction to patient/owner data MUST be made in Vetesoft, not in the local cache.

#### Scenario: Owner phone number is wrong
- GIVEN a client's Vetesoft owner phone is incorrect
- WHEN staff need to correct it
- THEN the correction MUST be made in Vetesoft, to be picked up by the next nightly sync

### Requirement: Sync failure does not corrupt the previous cache
If a nightly sync run fails partway, the system MUST NOT leave the cache in a partially-overwritten state — the previous complete cache MUST remain queryable until a sync fully succeeds.

#### Scenario: Sync job crashes mid-run
- GIVEN the nightly sync fails after pulling half the records
- WHEN staff search the next morning
- THEN they see yesterday's complete cache, not a half-populated one

### Requirement: No per-request Vetesoft proxying
The system MUST NOT implement patient/owner search by proxying live requests to Vetesoft per user keystroke or per API call.

#### Scenario: Search request arrives
- GIVEN a staff member searches for a patient
- WHEN the search executes
- THEN it MUST query the local Postgres cache, never Vetesoft directly in the request path
