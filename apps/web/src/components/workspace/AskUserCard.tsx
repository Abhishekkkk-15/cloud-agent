import { useState } from "react"
import { CheckIcon, KeyRoundIcon, HelpCircleIcon, EyeIcon, EyeOffIcon, SendHorizontalIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { AskUserPayload, AskUserQuestion } from "@/types/agent-ws-events"

interface AskUserCardProps {
  payload: AskUserPayload
  answered?: boolean
  onSubmit: (answers: Record<string, unknown>) => void
}

export function AskUserCard({ payload, answered = false, onSubmit }: AskUserCardProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {}
    for (const q of payload.questions) {
      if (q.default !== undefined) {
        initial[q.id] = q.default
      } else if (q.type === "confirm") {
        initial[q.id] = true
      } else if (q.type === "multiselect") {
        initial[q.id] = []
      } else {
        initial[q.id] = ""
      }
    }
    return initial
  })

  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const handleFieldChange = (id: string, value: unknown) => {
    if (answered) return
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const handleCheckboxToggle = (id: string, option: string) => {
    if (answered) return
    setAnswers((prev) => {
      const currentList = Array.isArray(prev[id]) ? [...(prev[id] as string[])] : []
      const idx = currentList.indexOf(option)
      if (idx > -1) {
        currentList.splice(idx, 1)
      } else {
        currentList.push(option)
      }
      return { ...prev, [id]: currentList }
    })
  }

  const toggleSecretVisibility = (id: string) => {
    setShowSecrets((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (answered) return
    onSubmit(answers)
  }

  const hasSecrets = payload.questions.some((q) => q.type === "secret")

  return (
    <Card className="my-2 border-border/80 bg-card/95 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {hasSecrets ? (
            <KeyRoundIcon className="size-4 text-amber-500" />
          ) : (
            <HelpCircleIcon className="size-4 text-primary" />
          )}
          <CardTitle className="text-sm font-semibold">{payload.title}</CardTitle>
          {answered && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
              <CheckIcon className="size-3" />
              Answered
            </span>
          )}
        </div>
        {payload.description && (
          <CardDescription className="text-xs text-muted-foreground mt-1">
            {payload.description}
          </CardDescription>
        )}
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-1 pb-4">
          {payload.questions.map((q: AskUserQuestion) => {
            const currentVal = answers[q.id]

            return (
              <div key={q.id} className="space-y-1.5 text-sm">
                <div className="flex items-baseline justify-between">
                  <Label className="font-medium text-xs text-foreground/90">
                    {q.question}
                    {q.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                </div>

                {/* Question Type: TEXT */}
                {q.type === "text" && (
                  <Input
                    disabled={answered}
                    type="text"
                    placeholder={q.placeholder || "Enter value..."}
                    value={(currentVal as string) || ""}
                    onChange={(e) => handleFieldChange(q.id, e.target.value)}
                    className="h-8 text-xs bg-background/50"
                  />
                )}

                {/* Question Type: SECRET */}
                {q.type === "secret" && (
                  <div className="relative flex items-center">
                    <Input
                      disabled={answered}
                      type={showSecrets[q.id] ? "text" : "password"}
                      placeholder={q.placeholder || "Enter secret or API key..."}
                      value={(currentVal as string) || ""}
                      onChange={(e) => handleFieldChange(q.id, e.target.value)}
                      className="h-8 pr-8 text-xs font-mono bg-background/50"
                    />
                    <button
                      type="button"
                      disabled={answered}
                      onClick={() => toggleSecretVisibility(q.id)}
                      className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors"
                      title={showSecrets[q.id] ? "Hide secret" : "Show secret"}
                    >
                      {showSecrets[q.id] ? (
                        <EyeOffIcon className="size-3.5" />
                      ) : (
                        <EyeIcon className="size-3.5" />
                      )}
                    </button>
                  </div>
                )}

                {/* Question Type: SELECT */}
                {q.type === "select" && (
                  <Select
                    disabled={answered}
                    value={(currentVal as string) || ""}
                    onValueChange={(val) => handleFieldChange(q.id, val)}
                  >
                    <SelectTrigger className="h-8 w-full text-xs bg-background/50">
                      <SelectValue placeholder={q.placeholder || "Select an option..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options || []).map((opt) => (
                        <SelectItem key={opt} value={opt} className="text-xs">
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Question Type: MULTISELECT */}
                {q.type === "multiselect" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/50 bg-background/30 p-2.5">
                    {(q.options || []).map((opt) => {
                      const selectedList = Array.isArray(currentVal) ? currentVal : []
                      const checked = selectedList.includes(opt)

                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-2 cursor-pointer select-none text-xs text-foreground/80 hover:text-foreground"
                        >
                          <Checkbox
                            disabled={answered}
                            checked={checked}
                            onCheckedChange={() => handleCheckboxToggle(q.id, opt)}
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Question Type: CONFIRM */}
                {q.type === "confirm" && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <Button
                      type="button"
                      disabled={answered}
                      size="xs"
                      variant={currentVal === true ? "default" : "outline"}
                      onClick={() => handleFieldChange(q.id, true)}
                      className="text-xs px-3"
                    >
                      Yes
                    </Button>
                    <Button
                      type="button"
                      disabled={answered}
                      size="xs"
                      variant={currentVal === false ? "default" : "outline"}
                      onClick={() => handleFieldChange(q.id, false)}
                      className="text-xs px-3"
                    >
                      No
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>

        {!answered && (
          <CardFooter className="flex justify-end gap-2 border-t border-border/50 bg-muted/20 px-4 py-2.5">
            <Button type="submit" size="xs" className="gap-1.5 text-xs font-medium">
              <SendHorizontalIcon className="size-3.5" />
              Submit Answers
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  )
}
