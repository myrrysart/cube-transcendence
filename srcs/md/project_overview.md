# OVERVIEW.md - Project Transcendence: Infinite Canvas & Cube Challenge

## 1. Project Vision
We are building a multi-user collaborative drawing software featuring an infinite canvas and an embedded perspective-drawing game (Cube Challenge). 
* The core application fulfills the mandatory requirement of supporting multiple users interacting simultaneously without conflicts or performance issues.
* The web-based game acts as our primary interactive component with clear rules and win/loss conditions.

## 2. Tech Stack & Architecture (The "Get Hired" Stack)
This stack was deliberately chosen to maximize our grading potential while perfectly aligning with the most dominant technologies in the global and Finnish IT markets (e.g., Reaktor, Solita, Futurice, and AAA gaming studios like Remedy). 

* **Frontend**: React (JSX) + TypeScript + Tailwind CSS. 
  * **Market Fit:** React and TypeScript represent the undisputed global standard for modern web development.
  * **Project Fit:** React fulfills the strict project definition of a frontend framework. Tailwind strictly satisfies the mandatory technical requirement to use a CSS framework or styling solution to ensure responsiveness.
* **Backend**: Node.js (Express or NestJS) + TypeScript. 
  * **Market Fit:** TypeScript is the most active language on GitHub, and Node.js remains the dominant backend runtime for modern SaaS.
  * **Project Fit:** Explicitly validated as a backend framework. Combining this with React easily secures a Major module (2 points).
* **Database**: PostgreSQL with Prisma ORM. 
  * **Market Fit:** PostgreSQL is the #1 most used database globally among professional developers. 
  * **Project Fit:** Fulfills the strict requirement that the database must have a clear schema and well-defined relations. Using Prisma guarantees an extra Minor module (1 point).
* **Core Engine**: Custom C++ compiled to WebAssembly (Wasm). 
  * **Architecture:** To achieve true infinity without floating-point precision loss and to ensure deterministic network syncing, the canvas is divided into a hierarchical grid using a Sector-Based Coordinate System (Floating Origin).
  * **Project Fit:** This highly technical engine will serve as our Major module of choice (2 points).
* **AI Tooling Advantage**: Because React, TypeScript, Node, and Postgres represent the most widely used stack on the internet, AI coding assistants (Claude, Copilot) are overwhelmingly trained on them. This ensures maximum efficiency and minimum hallucinations during our strict 50-day sprint.

## 3. Directory Structure & AI Policy
To manage complexity and safely integrate agentic coding, we are enforcing strict repository conventions.

* `srcs/`: The main source directory housing all permanent code and intent.
  * `srcs/md/`: Holds architectural decisions, source-level specifications, and data models to prevent spooky "specification at a distance".
  * `srcs/frontend/`: React application.
  * `srcs/backend/`: Node.js application.
  * `srcs/core/`: C++ Wasm engine.
* `.scratch/tmp/` & `.scratch/plan/`: Ephemeral staging grounds for AI prompting sessions and raw generated code. Decisions made here must be manually promoted to `srcs/md/` for human review.
* `tasks/`: Task tracking files managed strictly via `tatr`.
* `setup/` & `build/`: Docker/Podman configuration. The evaluation explicitly requires that the entire application must be deployed using a containerization solution via a single command.
* `docs/`: Higher-level project management documentation.
* `AGENTS.md` (Root): A file containing instructions for AI tools to act as a strict coding partner. This ensures developers must read and understand the code, preventing them from falling into "The Sorcerer's Apprentice Trap".

## 4. Mandatory Root Files
Evaluators will immediately check the root of the repository for specific files.
* `README.md`: Must contain the italicized 42 curriculum header, project description, team members with assigned roles, module justifications, and the database schema.
* `.env.example`: A template for environment variables.
* `.gitignore`: Must explicitly block the actual `.env` file, as leaking sensitive credentials will result in immediate project failure.

## 5. Task Breakdown (`tatr` Backlog)
These are the immediate tasks to distribute among the team to ensure a safe project baseline.

* **Task 1: Role Assignment**. Officially assign the mandatory roles: Product Owner, Project Manager (Scrum Master), Technical Lead, and Developers.
* **Task 2: Repository Setup**. Initialize Git and `tatr`. Ensure every team member makes early, meaningful commits to prove proper work distribution across the team.
* **Task 3: Containerization Baseline**. Scaffold the `setup/` folder to ensure the empty monorepo (React, Node, DB) spins up via a single Docker/Podman command.
* **Task 4: Database Schema**. Define the initial PostgreSQL schema via Prisma to satisfy the clear schema and relations requirement.
* **Task 5: Documentation Baseline**. Draft the root `README.md` and create easily accessible, non-empty pages for the Privacy Policy and Terms of Service, as missing these guarantees a rejection.
