# Deployment Topology Specification

## Purpose

Single-origin Docker Compose deployment (nginx + Next.js + FastAPI + Postgres) on the Hostinger VPS, preserving every legacy-path contract external systems depend on.

## Requirements

### Requirement: Single-origin Compose stack
The system MUST deploy nginx, Next.js, FastAPI, and Postgres as a Docker Compose stack behind a single origin (no cross-origin CORS needed between frontend and API).

#### Scenario: Frontend calls the API
- GIVEN the stack is running
- WHEN the Next.js frontend calls a backend endpoint
- THEN the call MUST go through the same origin (via nginx), with no CORS preflight required

### Requirement: TLS termination
nginx MUST terminate TLS for `servicios.animalcenter.com.co` (or its successor domain) and proxy to the internal services.

#### Scenario: HTTPS request
- GIVEN a client requests the site over HTTPS
- WHEN nginx receives the connection
- THEN it MUST terminate TLS and route to the correct internal service

### Requirement: Preserved redirect stubs
`chat/` and `dashboard.html` MUST continue responding at their exact original paths indefinitely, because approved Meta WhatsApp templates deep-link to them and template edits are rate-limited to 1 per 24 hours.

#### Scenario: WhatsApp template link is opened
- GIVEN a client taps a template button linking to `/chat/`
- WHEN the request reaches the new stack
- THEN `/chat/` MUST resolve and redirect as before

### Requirement: Waiting-room screen path preserved
`pantalla/` MUST remain reachable at its current path, because the unrelated `extension-musica` Chrome extension depends on it continuing to exist there.

#### Scenario: Extension checks for the waiting-room page
- GIVEN `extension-musica` polls for `pantalla/`
- WHEN it requests the path on the new stack
- THEN the page MUST be reachable at the same path

### Requirement: Container image rollback capability
Each deployed slice MUST be tagged so any individual service (nginx/frontend/backend) can be rolled back to its previous image independent of the DNS-level rollback window.

#### Scenario: A bad backend deploy needs reverting
- GIVEN a new backend image causes errors
- WHEN operators roll back
- THEN they MUST be able to redeploy the previous tagged backend image without touching DNS

### Requirement: Environment/secret isolation
Database credentials, WABA credentials, Vetesoft credentials, and TTS keys MUST be supplied via environment configuration outside the image/source tree, never hard-coded in the repository.

#### Scenario: A new image is built
- GIVEN a fresh build of the backend image
- WHEN it starts in the deployed environment
- THEN it MUST read secrets from environment configuration, not from files committed to the repo
