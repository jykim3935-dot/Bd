# CLAUDE.md

This file provides guidance for AI assistants (including Claude Code) working in this repository.

## Repository Overview

- **Repository**: `jykim3935-dot/bd`
- **Status**: Newly initialized — this is the foundational setup for the project.

## Project Structure

```
/
├── CLAUDE.md          # AI assistant guidance (this file)
└── .git/              # Git metadata
```

As the project grows, update this section to reflect the directory layout, key modules, and entry points.

## Development Workflow

### Branch Conventions

- **Main branch**: `main`
- Feature branches should use descriptive names (e.g., `feature/add-auth`, `fix/login-bug`)
- Claude Code branches follow the pattern: `claude/<description>-<id>`

### Commit Messages

- Use clear, descriptive commit messages
- Start with a verb in imperative mood (e.g., "Add", "Fix", "Update", "Remove")
- Keep the subject line under 72 characters
- Add a body for non-trivial changes explaining the "why"

### Pull Requests

- PRs should have a clear title and description
- Include a summary of changes and a test plan when applicable

## Build & Run

_No build system configured yet._ Update this section when dependencies, scripts, or tooling are added (e.g., `package.json`, `Makefile`, `requirements.txt`).

## Testing

_No test framework configured yet._ Update this section when tests are introduced, including how to run them and any conventions (file naming, location, coverage expectations).

## Code Style & Conventions

_No linter or formatter configured yet._ Update this section when code style tools are added (e.g., ESLint, Prettier, Black, Ruff).

## Key Guidelines for AI Assistants

1. **Read before editing** — Always read a file before modifying it.
2. **Minimal changes** — Only change what is necessary to accomplish the task. Do not refactor surrounding code or add unnecessary abstractions.
3. **No speculative features** — Do not add error handling, configuration, or features beyond what was requested.
4. **Security first** — Avoid introducing vulnerabilities (injection, XSS, etc.). Never commit secrets or credentials.
5. **Test your changes** — Run the project's test suite after making changes, when one exists.
6. **Keep this file updated** — When adding significant infrastructure (CI, testing, build tools, major modules), update the relevant section of this file.
