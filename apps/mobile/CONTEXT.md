# apps/mobile — Architectural Context

`apps/mobile` is the React Native / Expo cross-platform mobile client for Cloud Agent. It gives developers total autonomous control over their multi-node agent fleet directly from iOS and Android.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   apps/mobile                          │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │              Zustand Global Store              │   │
│   │             (stores/useDaemonStore)            │   │
│   └───────▲───────────────────────────────▲────────┘   │
│           │                               │            │
│   ┌───────────────────────────────────────────────┐   │
│   │       Gateway WebSocket RPC Relay Client      │   │
│   │              (lib/p2p-client.ts)              │   │
│   └───────────────────────▲───────────────────────┘   │
│           │                               │            │
│   ┌───────┴───────────────────────────────┴────────┐   │
│   │                 UI Layer                       │   │
│   │  • AgentTurnScreen (Default chat & turn stream)│   │
│   │  • SidebarDrawer (Workspace tree & fleet list) │   │
│   │  • PairMachineModal (Camera QR & code pair)    │   │
│   │  • MachineSwitcherModal (Multi-VPS switcher)   │   │
│   │  • ApprovalsModal (Command permission gates)   │   │
│   │  • AutoHealerModal (Git diff & PR review)      │   │
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 🔑 Core Subsystems & Directory Structure

```
apps/mobile/src/
├── screens/
│   ├── AgentTurnScreen.tsx      # Main screen: live turns, thought stream, prompt pill, tool trays
│   ├── AuthScreen.tsx           # Google OAuth and developer authentication
│   └── SessionsListScreen.tsx   # Fleet overview & workspace browser
├── components/
│   ├── SidebarDrawer.tsx        # Slide drawer: nested workspace tree, session dots, user profile
│   ├── PairMachineModal.tsx     # Camera QR scanner (expo-camera) & 6-character code pair
│   ├── MachineSwitcherModal.tsx # Active machine picker with ping latency tags
│   ├── FolderPickerModal.tsx    # Remote filesystem directory browser
│   ├── NewChatWorkspaceSheet.tsx# Bottom sheet for initiating chats in specific folders
│   ├── ApprovalsModal.tsx       # Real-time permission confirmation dialog
│   ├── Icons.tsx                # Lucide icon wrappers
│   └── MarkdownText.tsx         # Agent tool output, code syntax, and markdown renderer
├── stores/
│   └── useDaemonStore.ts        # Central Zustand state (auth, machines, sessions, turns, artifacts)
├── lib/
│   ├── p2p-client.ts            # Persistent WebSocket RPC client (mobileP2P)
│   └── notifications.ts         # Expo notifications and Android high-importance channels
└── theme/
    └── tokens.ts                # Design tokens (Pacific Azure Blue #0077b6, canvas, typography)
```

---

## 🎨 UI Component Stack & PanelUI-Native Architecture

`apps/mobile` is built on **PanelUI** (`panelui-native`), an accessible component ecosystem styled via Tailwind CSS v4 (**Uniwind**) and animated on the UI thread via **React Native Reanimated**:

- **Component-First Invariant**: All screens and dialogs use `panelui-native` primitives (`Drawer`, `Tree`, `Message`, `Reasoning`, `CodeBlock`, `BottomSheet`, `Kpi`, `LineChart`, `Button`, `Input`). Custom components are only permitted when `panelui-native` genuinely lacks an equivalent.
- **Root Provider**: `<PanelUIProvider>` in `src/App.tsx` supplies the global gesture root (`GestureHandlerRootView`), overlay portals (`PortalHost`), and in-app toasts (`ToastViewport`).
- **Tailwind v4 / Uniwind Pipeline**: Ahead-of-time compilation via `withUniwindConfig` in `metro.config.js` scanning `src/global.css` and `panelui-native/src`.
- **Theme Palette**: Strictly follows the official default PanelUI Dark (`#141414` background, `#191919` card, `#1e1e1e` surface, `#f5f5f5` text) and White (`#ffffff` background, `#f7f7f7` surface, `#262626` text) tokens.

---

## ⚡ Runtime Data Flow

1. **Authentication**: Handled via Google OAuth redirect (`cloud-agent://auth`) or developer token. Profile and credentials persisted via `AsyncStorage`.
2. **Machine Discovery & Connectivity**: Connects to Gateway over persistent WebSocket (`/client/ws`), receives list of online machines, and routes RPCs dynamically by `machineId`.
3. **Turn Streaming**: Prompts are sent via Gateway RPC. Real-time chunks (`text_chunk`, `thought`, `tool_call`, `tool_result`) progressively update the chat state without blocking.
4. **Tool Visualizers**: Shell commands, file edits, git actions, and web fetches are categorized and visually formatted into expandable tool cards.
