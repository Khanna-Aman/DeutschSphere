# 📋 DeutschSphere Task Backlog & Sprint Tracker

This `task.md` file is a dynamic, living document used to organize, track, and execute development sprints for the **DeutschSphere** SPA. When starting a new feature branch, bugfix session, or optimization phase, clear out the previous entries and populate the sections below to maintain a systematic execution history.

---

## 🚀 Active Sprint: [Sprint Name / Target Feature]
> **Status**: [🔴 Not Started / 🟡 In Progress / 🟢 Complete]  
> **Target Branch / Scope**: `[e.g., feat/fsrs-graphs or bugfix/viewport-jitter]`  
> **Goal Description**: [Provide a concise, 1-2 sentence description of what this sprint achieves.]

### 🛠️ Execution Checklist

- [ ] **Phase 1: Research & Planning**
  - [ ] Inspect relevant codebase files and review system architecture in [GEMINI.md](file:///d:/Aman/_________Projects/A1-B1_German/GEMINI.md)
  - [ ] Draft an implementation plan and seek user approval before modifying code

- [ ] **Phase 2: Core Engineering & Implementation**
  - [ ] Implement features or fixes (ensure no partial files or lazy comments are left behind)
  - [ ] Apply semantic prefix guidelines for any file changes

- [ ] **Phase 3: Validation, Styling, & UI Auditing**
  - [ ] Validate responsive layouts across both desktop and mobile viewports
  - [ ] Run the Playwright E2E automation suite to ensure 100% clean test passes
  - [ ] Take screenshots/recordings of any UI/UX changes for verification

- [ ] **Phase 4: Documentation Sync & Semantic Commit**
  - [ ] Update all relevant markdown documentation (no documentation rot!)
  - [ ] Stage and commit code with atomic semantic commit messages (e.g., `feat(ui): ...`, `fix(srs): ...`)

---

## 📝 Progress Notation Guidelines

Use these standard Markdown checkboxes to communicate state to developers and orchestration agents:
- `[ ]` **Uncompleted / Queued**: Task is defined but work has not commenced.
- `[/]` **In Progress**: Active execution is underway. Focus on one `[/]` item at a time.
- `[x]` **Completed**: Done, tested, and ready for staging/commit.

---

## ⚙️ Non-Negotiable Engineering Directives
1. **Deliberate Pacing (Anti-Rate-Limiting)**: Take your time. Execute tool calls sequentially with precision. Excellent engineering is measured by correctness and foresight, not speed.
2. **Zero Code Placeholders**: Never write comments like `// Rest of code unchanged...`. Provide fully intact, runnable files to avoid paste/file corruption.
3. **Atomic Commit Containment**: Commit each logical phase as soon as it's verified. Never bundle independent features into a single massive commit.
