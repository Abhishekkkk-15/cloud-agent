import { useEffect, useState, type FormEvent } from "react"
import {
  Activity,
  CheckCircle2,
  Circle,
  Database,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wifi,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Item {
  id: string
  title: string
  description?: string
  completed: boolean
  category: "feature" | "bug" | "task"
  createdAt: string
}

interface HealthResponse {
  status: string
  uptime: number
  database: string
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        ok ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-muted-foreground/40"
      )}
    />
  )
}

export function App() {
  const [items, setItems] = useState<Item[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [newItemTitle, setNewItemTitle] = useState("")
  const [adding, setAdding] = useState(false)
  const [apiOnline, setApiOnline] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [healthRes, itemsRes] = await Promise.all([
        fetch("/api/health").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/items").then((r) => (r.ok ? r.json() : [])),
      ])
      setHealth(healthRes)
      setApiOnline(Boolean(healthRes))
      setItems(Array.isArray(itemsRes) ? itemsRes : [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setApiOnline(false)
      toast.error("Could not reach the API")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const handleAddItem = async (e: FormEvent) => {
    e.preventDefault()
    if (!newItemTitle.trim()) return

    try {
      setAdding(true)
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newItemTitle.trim(),
          category: "task",
        }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems((prev) => [item, ...prev])
        setNewItemTitle("")
        toast.success("Item added")
      } else {
        toast.error("Failed to add item")
      }
    } catch (error) {
      console.error("Failed to create item:", error)
      toast.error("Failed to add item")
    } finally {
      setAdding(false)
    }
  }

  const handleToggleItem = async (id: string, completed: boolean) => {
    try {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, completed: !completed } : it))
      )
      await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      })
    } catch (error) {
      console.error("Failed to toggle item:", error)
      toast.error("Could not update item")
      void fetchData()
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      setItems((prev) => prev.filter((it) => it.id !== id))
      await fetch(`/api/items/${id}`, { method: "DELETE" })
      toast.success("Item removed")
    } catch (error) {
      console.error("Failed to delete item:", error)
      toast.error("Could not delete item")
      void fetchData()
    }
  }

  const completedCount = items.filter((i) => i.completed).length
  const dbLabel = health?.database ?? (loading ? "…" : "offline")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Welcome to your workspace
                </h1>
                <p className="text-sm text-muted-foreground">
                  A starter React app with a live API and sample data.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">App</CardTitle>
              <Wifi className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <StatusDot ok />
                Online
              </div>
              <p className="text-xs text-muted-foreground">Vite + React preview</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">API</CardTitle>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <StatusDot ok={apiOnline} />
                {apiOnline ? "Connected" : "Offline"}
              </div>
              <p className="text-xs text-muted-foreground">
                {health?.status
                  ? `Health: ${health.status}`
                  : "Waiting for backend"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Data</CardTitle>
              <Database className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <StatusDot ok={Boolean(health?.database)} />
                {dbLabel}
              </div>
              <p className="text-xs text-muted-foreground">In-memory store</p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Tasks</CardTitle>
                <CardDescription>
                  Create, complete, and delete items through the API.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <Activity className="size-3" />
                {items.length} total
                {completedCount > 0 ? ` · ${completedCount} done` : null}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <form onSubmit={handleAddItem} className="flex gap-2">
              <Input
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="What should we build next?"
                disabled={adding}
              />
              <Button type="submit" disabled={adding || !newItemTitle.trim()}>
                <Plus className="size-4" />
                Add
              </Button>
            </form>

            <div className="overflow-hidden rounded-lg border border-border">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-accent/40",
                    index > 0 && "border-t border-border"
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => void handleToggleItem(item.id, item.completed)}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        "truncate text-sm",
                        item.completed
                          ? "text-muted-foreground line-through"
                          : "font-medium"
                      )}
                    >
                      {item.title}
                    </span>
                    <Badge variant="outline" className="hidden shrink-0 capitalize sm:inline-flex">
                      {item.category}
                    </Badge>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => void handleDeleteItem(item.id)}
                    aria-label={`Delete ${item.title}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}

              {items.length === 0 && !loading && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <p className="text-sm font-medium">No tasks yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add your first item above to see the fullstack flow.
                  </p>
                </div>
              )}

              {loading && items.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="border-t border-border text-xs text-muted-foreground">
            Edit this app in the workspace — changes hot-reload in the preview.
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default App
