# Waiting Room Display Specification

## Purpose

The TV screen (`pantalla/`) showing the now-calling card and upcoming list, with chime and voice announcement, and a confirmation loop back to the server so doctors know the announcement actually played.

## Requirements

### Requirement: Now-calling card and upcoming list
The display MUST show the currently called turno(s) prominently and a list of upcoming/waiting turnos, updated in near-real-time (replacing the legacy 2s-version-poll / 30s-full-refresh baseline with WebSocket/SSE push).

#### Scenario: New call arrives
- GIVEN a doctor calls a patient
- WHEN the display receives the update
- THEN it MUST show that turno as now-calling faster than the legacy 2-second poll baseline

### Requirement: Chime plus voice announcement with fallback
On a new call, the display MUST play a chime and announce the turno via server-side TTS (Google Cloud TTS); if server-side TTS is unavailable, the display MUST fall back to browser-native TTS, and the chime MUST still play either way.

#### Scenario: Server TTS unavailable
- GIVEN the server-side TTS service is down
- WHEN a new turno is called
- THEN the display MUST still announce it via browser TTS, and MUST still play the chime

### Requirement: Announcement-confirmation loop
After the display actually plays a chime+announcement for a given turno+call-timestamp pair, it MUST confirm this back to the server. The server MUST deduplicate confirmations by (turno, call-timestamp) scoped to the current day, so a repeated confirmation never re-triggers doctor-visible state or a second sound.

#### Scenario: Display confirms it played the announcement
- GIVEN a turno was just announced
- WHEN the display finishes playing it
- THEN it MUST notify the server, and the doctor's UI MUST reflect "announced in room" without triggering a second sound

#### Scenario: Duplicate confirmation
- GIVEN the display already confirmed turno C-03 called at 10:00:05
- WHEN the display (e.g., after a reconnect) sends that same confirmation again
- THEN the server MUST treat it as a no-op, not a new event

#### Scenario: Confirmation map resets daily
- GIVEN the confirmation record was created yesterday
- WHEN a turno with the same code is called today
- THEN it MUST be treated as a fresh, unconfirmed announcement

### Requirement: Server clock sync
The display MUST periodically resync its clock against the server (legacy: every 5 minutes) to keep any locally-displayed times accurate.

#### Scenario: Client clock drifts
- GIVEN the display's local clock has drifted
- WHEN the periodic resync runs
- THEN the display MUST correct its reference time from the server
