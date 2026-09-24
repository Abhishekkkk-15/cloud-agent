import { useState } from "react"
import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const langMatch = /language-(\w+)/.exec(className || "")
  const language = langMatch ? langMatch[1] : ""
  const codeText = String(children).replace(/\n$/, "")

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border bg-muted/50 dark:bg-muted/30">
      <div className="flex h-8 items-center justify-between border-b bg-muted/80 px-3 text-[11px] font-mono text-muted-foreground">
        <span>{language || "text"}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-6 text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground">
        <code>{children}</code>
      </pre>
    </div>
  )
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>,
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-base font-semibold text-foreground first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2.5 text-xs font-semibold text-foreground first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5 text-xs leading-relaxed">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 bg-muted/20 pl-3 py-1 text-xs italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-")
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary font-medium">
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  hr: () => <hr className="my-3 border-border" />,
}

export function ChatMarkdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div className={cn("text-xs leading-relaxed text-foreground/90 selection:bg-primary/20", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
