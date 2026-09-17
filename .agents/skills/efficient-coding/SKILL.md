---
name: efficient-coding
description: Enforces token-efficient coding habits, surgical file reading, batched editing, and preventing redundant tool loops.
---

# Efficient Coding & Token Optimization

Guidelines for minimizing context bloat, avoiding unnecessary LLM round-trips, and executing clean code modifications.

## 1. Surgical Reading
- **Use `grep` before reading**: When searching for functions, components, or variables, run `grep` first to pinpoint exact line numbers.
- **Always specify `offset` and `limit`**: Keep `limit` between 20–60 lines. Never read entire files when inspecting or modifying specific sections.
- **Do not read files sequentially**: Avoid reading chunk 1-100, then 101-200, then 201-300 in separate tool calls if `grep` can take you directly to the target.

## 2. No Redundant Re-Reading
- **Trust your edits**: Do not re-read a file immediately after calling `edit` or `write` to "double check" your change.
- **Verify with builds, not reads**: If verification is needed, run `npm run build` or `vite build` via `docker_bash`. Only re-read code if a compiler or runtime error provides a specific stack trace.
- **Do not re-read static setup files**: Never re-read `AGENT.md`, `CONTEXT.md`, or configuration files if they were already read earlier in the conversation history.

## 3. Batched Modifications
- **Plan before editing**: Identify all files and sections that need modification before making the first edit.
- **Combine edits**: Use a single `edit` call with multiple items in the `edits` array rather than triggering 10 individual `edit` tool round-trips.
- **Write whole new components**: If creating a new component or rewriting a file substantially, use `write` once instead of a dozen small `edit` operations.

## 4. Efficient Multi-Step Execution
- Complete all code changes first, then run tests/builds once at the end.
- Avoid the anti-pattern: `read` $\rightarrow$ `edit 3 lines` $\rightarrow$ `read` $\rightarrow$ `edit 3 lines` $\rightarrow$ `build` $\rightarrow$ `read` $\rightarrow$ `edit 3 lines`.
