import type {
  ChatMessage,
  FileNode,
  Project,
  TerminalLine,
  User,
} from "@cloud-agent/shared"

export const mockUser: User = {
  id: "user_1",
  name: "Alex Rivera",
  email: "alex@cloudagent.dev",
  username: "alexrivera",
  avatarUrl: null,
  plan: "hacker",
}

export const mockProjects: Project[] = [
  {
    id: "proj_1",
    name: "neon-dashboard",
    description: "Realtime analytics dashboard with WebSocket feeds.",
    language: "typescript",
    visibility: "public",
    starCount: 128,
    isStarred: true,
    updatedAt: "2026-08-20T14:22:00.000Z",
    createdAt: "2026-07-01T09:00:00.000Z",
    ownerUsername: "alexrivera",
  },
  {
    id: "proj_2",
    name: "flask-notes-api",
    description: "Lightweight notes API with JWT auth and SQLite.",
    language: "python",
    visibility: "private",
    starCount: 12,
    isStarred: false,
    updatedAt: "2026-08-19T18:05:00.000Z",
    createdAt: "2026-06-12T11:30:00.000Z",
    ownerUsername: "alexrivera",
  },
  {
    id: "proj_3",
    name: "edge-router",
    description: "Tiny Go reverse proxy with hot-reload config.",
    language: "go",
    visibility: "public",
    starCount: 64,
    isStarred: false,
    updatedAt: "2026-08-18T08:41:00.000Z",
    createdAt: "2026-05-03T16:20:00.000Z",
    ownerUsername: "alexrivera",
  },
  {
    id: "proj_4",
    name: "portfolio-site",
    description: "Static personal site with dark theme and blog.",
    language: "html",
    visibility: "public",
    starCount: 31,
    isStarred: true,
    updatedAt: "2026-08-15T21:10:00.000Z",
    createdAt: "2026-04-22T10:00:00.000Z",
    ownerUsername: "alexrivera",
  },
  {
    id: "proj_5",
    name: "chat-widget",
    description: "Embeddable React chat widget for support desks.",
    language: "javascript",
    visibility: "private",
    starCount: 8,
    isStarred: false,
    updatedAt: "2026-08-12T12:00:00.000Z",
    createdAt: "2026-08-01T08:00:00.000Z",
    ownerUsername: "alexrivera",
  },
  {
    id: "proj_6",
    name: "wasm-playground",
    description: "Experiment with Rust + WASM in the browser.",
    language: "rust",
    visibility: "public",
    starCount: 97,
    isStarred: false,
    updatedAt: "2026-08-10T07:55:00.000Z",
    createdAt: "2026-03-14T13:45:00.000Z",
    ownerUsername: "alexrivera",
  },
]

export const mockFileTrees: Record<string, FileNode[]> = {
  proj_1: [
    {
      id: "f_root_src",
      name: "src",
      type: "folder",
      children: [
        {
          id: "f_app",
          name: "App.tsx",
          type: "file",
          language: "typescript",
          content: `import { useEffect, useState } from "react"
import { MetricsPanel } from "./components/MetricsPanel"
import { fetchMetrics } from "./lib/api"

export default function App() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState([])

  useEffect(() => {
    fetchMetrics()
      .then(setMetrics)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading metrics…</p>

  return (
    <main className="p-6">
      <h1>Neon Dashboard</h1>
      <MetricsPanel data={metrics} />
    </main>
  )
}
`,
        },
        {
          id: "f_main",
          name: "main.tsx",
          type: "file",
          language: "typescript",
          content: `import { createRoot } from "react-dom/client"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(<App />)
`,
        },
        {
          id: "f_api",
          name: "lib",
          type: "folder",
          children: [
            {
              id: "f_api_ts",
              name: "api.ts",
              type: "file",
              language: "typescript",
              content: `export async function fetchMetrics() {
  const res = await fetch("/api/metrics")
  if (!res.ok) throw new Error("Failed to load metrics")
  return res.json()
}
`,
            },
          ],
        },
        {
          id: "f_comp",
          name: "components",
          type: "folder",
          children: [
            {
              id: "f_metrics",
              name: "MetricsPanel.tsx",
              type: "file",
              language: "typescript",
              content: `type Metric = { label: string; value: number }

export function MetricsPanel({ data }: { data: Metric[] }) {
  return (
    <ul>
      {data.map((m) => (
        <li key={m.label}>
          {m.label}: {m.value}
        </li>
      ))}
    </ul>
  )
}
`,
            },
          ],
        },
      ],
    },
    {
      id: "f_pkg",
      name: "package.json",
      type: "file",
      language: "json",
      content: `{
  "name": "neon-dashboard",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
`,
    },
    {
      id: "f_readme",
      name: "README.md",
      type: "file",
      language: "markdown",
      content: `# neon-dashboard

Realtime analytics dashboard scaffolded in Cloud Agent.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`
`,
    },
  ],
  default: [
    {
      id: "d_src",
      name: "src",
      type: "folder",
      children: [
        {
          id: "d_index",
          name: "index.ts",
          type: "file",
          language: "typescript",
          content: `console.log("Hello from Cloud Agent")
`,
        },
      ],
    },
    {
      id: "d_readme",
      name: "README.md",
      type: "file",
      language: "markdown",
      content: `# New Project

Start building in the cloud.
`,
    },
  ],
}

export const mockTerminalBoot: TerminalLine[] = [
  {
    id: "t1",
    type: "info",
    text: "Cloud Agent runtime ready · node 22.14.0",
    timestamp: new Date().toISOString(),
  },
  {
    id: "t2",
    type: "command",
    text: "$ npm install",
    timestamp: new Date().toISOString(),
  },
  {
    id: "t3",
    type: "stdout",
    text: "added 186 packages in 4.2s",
    timestamp: new Date().toISOString(),
  },
]

export const mockChatSeed: ChatMessage[] = [
  {
    id: "c1",
    role: "assistant",
    content:
      "I'm your Cloud Agent copilot. Ask me to explain code, fix bugs, or scaffold new files.",
    createdAt: new Date().toISOString(),
  },
]

export const languageLabels: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  rust: "Rust",
  html: "HTML",
}

export const templateOptions = [
  { value: "blank", label: "Blank" },
  { value: "react-vite", label: "React + Vite" },
  { value: "express-api", label: "Express API" },
  { value: "python-flask", label: "Python Flask" },
  { value: "static-html", label: "Static HTML" },
] as const
