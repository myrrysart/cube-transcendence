# ft_transcendence — Requirements Reference

> This is a working, rigorous restatement of the supplied **ft_transcendence Surprise, version 19.0** subject and evaluation checklist. The official subject and evaluation criteria remain authoritative. Update this document if those sources change.

## 1. Pass/fail conditions

The project must satisfy **all mandatory requirements** and demonstrate at least **14 validated module points**. A claimed module has value only when it is complete, demonstrable, and meets every stated condition. A non-functional or incomplete module is worth **0 points**.

The evaluation may also reject the project for a missing mandatory requirement, including an inadequate Privacy Policy or Terms of Service, insecure credential handling, a non-functioning deployment, or an insufficient multi-user implementation.

## 2. Team and collaboration requirements

### 2.1 Team size and participation

- The project is for **4–5 people**.
- Every member must contribute meaningfully to the mandatory part and chosen modules.
- The Git history must show commits from all team members, meaningful commit messages, and credible work distribution.
- All members must be present at evaluation and be able to explain their role, contributions, one feature/module they implemented, and the project as a whole.

### 2.2 Required roles

Document these roles in `README.md`. A four-person team may combine roles.

| Role | Required responsibility |
| --- | --- |
| Product Owner | Defines vision, prioritizes work, maintains backlog, validates completed work, communicates with stakeholders. |
| Project Manager / Scrum Master | Organizes meetings, tracks progress and risks, removes blockers, maintains team communication. |
| Technical Lead / Architect | Defines architecture and stack, safeguards code quality, reviews important changes. |
| Developers | Implement, test, document, and review assigned work. All team members are developers. |

### 2.3 Evidence to retain

- issue board/backlog and task ownership;
- meeting/decision notes;
- code review evidence where practical;
- a clean, attributable Git history;
- an accurate per-person contribution record in the README.

## 3. Mandatory application requirements

### 3.1 Architecture

The delivered application must contain and run all three parts:

1. **Frontend** — clear, responsive, and accessible across devices.
2. **Backend** — application logic and secure server-side handling.
3. **Database** — a clear schema with well-defined relations.

The frontend must use a CSS framework or styling solution, such as Tailwind CSS, Bootstrap, Material UI, or styled components. Plain unstructured CSS alone does not meet this requirement.

### 3.2 Browser and deployment

- Support the latest stable **Google Chrome**.
- Show no browser-console errors or warnings attributable to the project.
- Deploy the whole application with a containerization solution (Docker, Podman, or equivalent) using **one command**.
- Use **HTTPS for all backend connections**. WebSocket connections from an HTTPS page must therefore use `wss://`.

### 3.3 Credentials and configuration

- Put credentials, API keys, and environment-specific settings in a local `.env` file.
- Add `.env` to `.gitignore`.
- Provide `.env.example` with variable names and safe example values.
- Never commit secrets or production credentials.

### 3.4 Authentication and input security

At minimum, implement secure email/password signup and login:

- passwords must be salted and hashed; never stored or logged in plaintext;
- all forms and inputs must be validated in **both** frontend and backend;
- backend validation is authoritative and must reject malformed, unauthorized, XSS-like, injection-like, or otherwise invalid input.

The evaluation can test empty values, invalid formats, SQL injection attempts, and XSS attempts. Use parameterized database queries/ORM APIs, context-appropriate output escaping, authorization checks, and rate limits where relevant.

### 3.5 Multi-user support

The application must support simultaneous users without corruption or unacceptable conflicts:

- multiple users can be logged in and active at once;
- concurrent actions are correctly handled;
- real-time updates reach connected users where applicable;
- no race condition or data corruption is caused by concurrent work.

For a game, the server should be authoritative: clients submit intended input; the server owns canonical state, scores, and outcomes.

### 3.6 Legal pages

Provide meaningful, project-specific and easily reachable pages for:

- **Privacy Policy**;
- **Terms of Service**.

Footer links are a suitable access point. Placeholder, empty, or irrelevant pages can cause rejection.

## 4. README requirements

The root `README.md` must begin with this italicized exact form (with actual logins):

```markdown
*This project has been created as part of the 42 curriculum by <login1>[, <login2>[, <login3>[...]]].*
```

It must include:

1. **Description** — project name, goal, overview, key features.
2. **Instructions** — prerequisites, versions, `.env` setup, installation/build/run steps.
3. **Resources** — classic references plus an honest description of AI use: what tasks and which parts.
4. **Team Information** — each member’s role(s) and responsibilities.
5. **Project Management** — work organization, task tool, meetings, communication channels.
6. **Technical Stack** — frontend, backend, database, major libraries, and rationale.
7. **Database Schema** — diagram or precise description of tables/relations/key fields/types.
8. **Features List** — every feature, functionality, and contributor(s).
9. **Modules** — claimed modules, point calculation, implementation method, contributors, and custom-module justification where applicable.
10. **Individual Contributions** — detailed work by each person, including challenges and solutions.

The README is part of the evaluated deliverable, not an optional postscript.

## 5. Module scoring rules

- Major module: **2 points**.
- Minor module: **1 point**.
- Minimum validated total: **14 points**.
- Plan a buffer above 14 because a claimed module that cannot be demonstrated earns 0.
- Respect dependencies: e.g. tournament/AI/statistics require a functional game; advanced chat requires basic chat; SSR is incompatible with ICP backend.
- Do not claim modules whose rubric criteria are not fully met.

## 6. Relevant module requirements

This section lists the modules most relevant to the proposed game/social application. The complete subject remains the source for every other module.

### 6.1 Web

| Module | Value | Demonstrable requirements |
| --- | ---: | --- |
| Frontend + backend frameworks | 2 | Use qualifying frameworks for both sides; a full-stack framework may count for both only when both capabilities are used. |
| Frontend framework | 1 | Use a frontend framework such as React, Vue, Angular, or Svelte. |
| Backend framework | 1 | Use a backend framework such as Express, Fastify, NestJS, Django, or Flask. |
| Real-time features | 2 | Real-time cross-client updates, graceful connect/disconnect handling, efficient broadcast. |
| User interaction | 2 | Basic chat, user profiles, and friends (add/remove/list). |
| ORM | 1 | Use an ORM for the database. |
| Notification system | 1 | Complete notifications for creation, update, and deletion actions. |
| Design system | 1 | Custom reusable system with color palette, typography, icons, and at least 10 reusable components. |

**Important stack interpretation:** htmx is an HTML enhancement library, not clearly a frontend framework under the subject’s framework definition. It can satisfy the mandatory frontend requirement, but should not be claimed as the frontend-framework module without a defensible framework-level architecture.

### 6.2 User management

| Module | Value | Demonstrable requirements |
| --- | ---: | --- |
| Standard user management | 2 | Editable profile, avatar upload with default fallback, friends with online status, profile page. |
| Game statistics/history | 1 | Functional game prerequisite; track statistics, history, progression/achievements, and leaderboard integration. |
| OAuth 2.0 | 1 | Remote authentication provider. |
| Advanced permissions | 2 | User CRUD, roles, and role-specific views/actions. |
| 2FA | 1 | Complete two-factor authentication. |

### 6.3 Gaming and user experience

| Module | Value | Demonstrable requirements |
| --- | ---: | --- |
| Complete web game | 2 | Live user-vs-user game with clear rules and win/loss state. |
| Remote players | 2 | Two separate computers, real-time shared game, latency/disconnect handling, reconnection logic. |
| Multiplayer 3+ | 2 | Three or more simultaneous players, fair synchronized play. |
| AI opponent | 2 | Functional game prerequisite; challenging but imperfect/human-like, explainable implementation. |
| Tournament | 1 | Functional game prerequisite; registration, bracket/match order, tracking, matchmaking/management. |
| Customization | 1 | Functional game prerequisite; power-ups/abilities, maps/themes, or settings, plus defaults. |
| Advanced chat | 1 | Basic chat prerequisite; blocking, game invites, notifications, profile access, persisted history, typing/read receipts. |
| Spectator mode | 1 | Functional game prerequisite; watch live matches with real-time updates. |

## 7. Evaluation preparation checklist

Before submitting, rehearse and verify:

- clone into an empty directory, configure `.env`, and start with one documented command;
- demonstrate HTTPS and a clean Chrome console;
- demonstrate two or more simultaneous users;
- demonstrate every claimed module one by one using a written script;
- explain password hashing, sessions/tokens, validation, authorization, schema relations, and concurrent game state;
- show required legal pages and README sections;
- show Git history and per-person contributions;
- be ready for a small, quick modification request in an area each team member understands.
