import { useEffect, useRef, useState } from "react"
import Editor, { type OnMount } from "@monaco-editor/react"

import { useTheme } from "@/components/theme-provider"
import { Skeleton } from "@/components/ui/skeleton"

function resolveMonacoTheme(theme: "dark" | "light" | "system") {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "vs-dark"
      : "light"
  }
  return theme === "dark" ? "vs-dark" : "light"
}

const extensionLanguageMap: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  py: "python",
  go: "go",
  rs: "rust",
  html: "html",
  css: "css",
  scss: "scss",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
  bash: "shell",
}

export function languageFromFile(name: string, language?: string) {
  const known = new Set([
    "typescript",
    "javascript",
    "json",
    "markdown",
    "python",
    "go",
    "rust",
    "html",
    "css",
    "scss",
    "yaml",
    "shell",
    "plaintext",
  ])
  if (language && known.has(language)) return language
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return extensionLanguageMap[ext] ?? "plaintext"
}

type MonacoEditorProps = {
  fileId: string
  fileName: string
  language?: string
  value: string
  onChange: (value: string, fileId: string) => void
}

export function MonacoEditor({
  fileId,
  fileName,
  language,
  value,
  onChange,
}: MonacoEditorProps) {
  const { theme } = useTheme()
  const fileIdRef = useRef(fileId)
  fileIdRef.current = fileId

  const monacoLanguage = languageFromFile(fileName, language)
  const [monacoTheme, setMonacoTheme] = useState(() =>
    resolveMonacoTheme(theme)
  )

  useEffect(() => {
    setMonacoTheme(resolveMonacoTheme(theme))
    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => setMonacoTheme(resolveMonacoTheme("system"))
    media.addEventListener("change", handler)
    return () => media.removeEventListener("change", handler)
  }, [theme])

  const handleMount: OnMount = (editor) => {
    editor.focus()
  }

  return (
    <Editor
      key={fileId}
      height="100%"
      language={monacoLanguage}
      theme={monacoTheme}
      value={value}
      loading={<Skeleton className="size-full rounded-none" />}
      onMount={handleMount}
      onChange={(next) => {
        if (typeof next !== "string") return
        onChange(next, fileIdRef.current)
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        wordWrap: "off",
        tabSize: 2,
        padding: { top: 12 },
        renderLineHighlight: "line",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8,
        },
      }}
    />
  )
}
