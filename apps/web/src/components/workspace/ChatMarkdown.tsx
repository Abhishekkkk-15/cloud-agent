import type { Components } from "react-markdown"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { cn } from "@/lib/utils"

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 text-lg font-medium last:mb-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-base font-medium last:mb-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 text-sm font-medium last:mb-0">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-")
    if (isBlock) {
      return (
        <code className="block font-mono text-[13px] leading-6">{children}</code>
      )
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-3 last:mb-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-2 py-1 font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1 align-top">{children}</td>
  ),
}

type ChatMarkdownProps = {
  content: string
  streaming?: boolean
  className?: string
}

export function ChatMarkdown({
  content,
  streaming = false,
  className,
}: ChatMarkdownProps) {
  const trimmed = content.trim()

  if (!trimmed && !streaming) return null

  return (
    <div
      className={cn(
        "text-[15px] leading-7 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {trimmed ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      ) : null}
      {streaming ? (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-text-bottom" />
      ) : null}
    </div>
  )
}
