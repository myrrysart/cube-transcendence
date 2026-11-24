# Privacy Policy

<!-- DOC_META: status=review version=2 -->
<!-- DOC_SYNC: Review after changes to collected data, sharing, cookies, retention or hosting. -->
<!-- HUMAN_CHECK: PRIVACY_EFFECTIVE_DATE — verify this local-demo policy date before evaluation. -->
Effective date: 24 November 2026.

Cube Challenge Multiplayer is a 42 educational perspective-drawing game. This
policy describes the current local/school-network version operated by the project
team on the computer hosting the game. It is not a publicly hosted service.

## Data collected and its purpose

- Accounts: email, display name, account identifier and creation time, used for registration, authentication and identifying players. Passwords are processed for login and stored only as salted scrypt hashes.
- Sessions: a hash of the session token, account reference, session kind and expiry, used to authenticate requests. The browser receives the original token in an essential cookie; it is not returned in account JSON.
- Multiplayer: room membership, readiness, last-seen time, round participants and timestamps, submitted drawing points, submission times, scores, rankings and results, used to run and score games and recover completed results.
- Operations: requests expose the connection address and browser headers to the server. Authentication rate limits retain the connecting address temporarily in process memory. Process/error logs may contain technical diagnostics; HTTP access logging is not enabled by this setup.

## What other players can see

Room members can see display names, readiness and presence. Unsubmitted drawing
strokes stay in browser memory. Accepted drawings are saved on the host and remain
private during the round. After closure, that round's participants can see the
published final drawings, feedback, scores and rankings. Room access requires a
session and membership; do not treat a shared room ID as a password.

Creator studio and browser-only solo practice do not send drawings to the backend.
The Multiplayer and Backend practice screens do use the backend. Development
guests are disabled in the default HTTPS stack. No profiles, avatars, advertising
trackers or third-party analytics are implemented.

## Cookies and security

The essential cube_session cookie authenticates the user. It expires after 24
hours, is HttpOnly, SameSite=Strict, restricted to /api and marked Secure in the
default HTTPS stack. Signing out revokes the current session and clears its cookie.
There are no optional analytics or advertising cookies to consent to.

Browser connections use HTTPS and WSS with a locally issued certificate. Players
must trust the host's local certificate authority. The internal Docker API/database
connections remain on the host's private container network. Password hashing,
session-token hashing and access checks reduce risk; no system guarantees absolute
security. Do not use sensitive drawings or reuse a password from another service.

## Storage, retention and sharing

<!-- HUMAN_CHECK: PRIVACY_RETENTION_AND_HOSTING — verify the host and retention description for the actual evaluation session. -->
The game database is stored in a Docker volume on the computer hosting the local
session. It survives ordinary container restarts and shutdowns. Accounts, submitted
drawings, rooms and results remain there until the operator manually removes the
data; no automatic account/game-data retention cleanup is implemented. Expired
sessions cannot authenticate, but their database rows are not automatically purged.
The Compose setup has no automatic remote backups or external analytics service.

Project operators with access to the host/database can access stored data. Other
players receive only the authorized game views described above. The application
does not sell data or send gameplay data to advertising services.
<!-- DOC_TODO: PRIVACY_RETENTION_REVIEW — have the operator approve a concrete demo-data deletion schedule and document it before evaluation or broader use. -->

## Access, correction, deletion and questions

<!-- HUMAN_CHECK: PRIVACY_CONTACT — verify the supplied mailbox is monitored by the team. -->
Contact student@hive.fi or speak directly to the teammate hosting the game to ask
about your stored data, correction or deletion. Do not send passwords or session
tokens. The operator must verify that a request concerns your account before
acting. There is no self-service account deletion/export endpoint, and signing out
does not delete game records. Linked multiplayer records require operator review
when handling a deletion request; this policy does not promise an automated GDPR
feature that the application does not implement.
<!-- DOC_TODO: PRIVACY_OPERATOR_REVIEW — verify the contact mailbox, request-handling procedure and applicable privacy obligations before evaluation or use beyond the local educational demo. -->

Policy changes will be published on this page with an updated date. Review the
policy again if the host, collected data or application features change.
