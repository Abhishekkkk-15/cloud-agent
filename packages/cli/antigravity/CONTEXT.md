# packages/cli/antigravity — Architectural Context

`packages/cli/antigravity` is the official CLI adapter integrating the **Google Antigravity CLI** (`agy`) into the Cloud Agent ecosystem. It implements the `ICliAdapter` interface from `@cloud-agent/cli-interface`.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│             @cloud-agent/cli-antigravity               │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │              AntigravityAdapter                │   │
│   │                                                │   │
│   │  • checkAvailability(): Finds 'agy' in PATH    │   │
│   │  • listSessions(): Reads native JSONL logs     │   │
│   │  • getSession(): Streams messages with offset  │   │
│   │  • run(): Persistent warm child process pool   │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │ stdin/stdout NDJSON stream  │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │       Google Antigravity Executable ('agy')    │   │
│   │      (~/.gemini/antigravity-cli/brain/...)     │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Invariants

1. **Warm Persistent Process Pool**: Workers are kept warm with an open `stdin` pipe to avoid re-reading massive transcript files from disk on every chat turn.
2. **Permission Bypass**: Commands are invoked with `--dangerously-skip-permissions` so headless processes never freeze waiting for interactive TTY prompts.
3. **Native Brain Storage**: Reads transcripts directly from `~/.gemini/antigravity-cli/brain/<conversation-id>/.system_generated/logs/transcript.jsonl`.
