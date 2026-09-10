import { useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Circle,
  Database,
  Globe,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Item {
  id: string
  title: string
  description?: string
  completed: boolean
  category: 'feature' | 'bug' | 'task'
  createdAt: string
}

interface HealthResponse {
  status: string
  uptime: number
  database: string
}

export function App() {
  const [items, setItems] = useState<Item[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [healthRes, itemsRes] = await Promise.all([
        fetch('/api/health').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/items').then((r) => (r.ok ? r.json() : [])),
      ])
      setHealth(healthRes)
      setItems(itemsRes)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemTitle.trim()) return

    try {
      setAdding(true)
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newItemTitle.trim(),
          category: 'feature',
        }),
      })
      if (res.ok) {
        const item = await res.json()
        setItems((prev) => [item, ...prev])
        setNewItemTitle('')
      }
    } catch (error) {
      console.error('Failed to create item:', error)
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      })
    } catch (error) {
      console.error('Failed to toggle item:', error)
      fetchData()
    }
  }

  const handleDeleteItem = async (id: string) => {
    try {
      setItems((prev) => prev.filter((it) => it.id !== id))
      await fetch(`/api/items/${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Failed to delete item:', error)
      fetchData()
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10 font-sans">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="size-6 text-primary animate-pulse" />
              <h1 className="text-2xl font-bold tracking-tight">Fullstack Sandbox</h1>
              <Badge variant="outline" className="border-primary/40 text-primary">
                pnpm
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Vite + React (Port 4000) &bull; Express API (Port 3000) &bull; Mocked DB
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync Status
          </Button>
        </header>

        {/* System Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Frontend Server</CardTitle>
              <Globe className="size-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">Port 4000</div>
              <p className="text-xs text-muted-foreground mt-1">
                React 18 &bull; Vite HMR &bull; Tailwind CSS
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Backend API</CardTitle>
              <Server className="size-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-400">Port 3000</div>
              <p className="text-xs text-muted-foreground mt-1">
                Express.js &bull; TypeScript (tsx) &bull; /api/*
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Database Layer</CardTitle>
              <Database className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">Mock DB</span>
                <Badge variant="secondary" className="text-xs">
                  {health?.database ?? 'Connecting...'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                In-Memory CRUD with simulated async latency
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Live CRUD Demo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Live Fullstack Data Flow</CardTitle>
                <CardDescription>
                  Data fetched from Express API (Port 3000) and stored in the Mock Database.
                </CardDescription>
              </div>
              <Badge variant="outline" className="gap-1.5 py-1">
                <Activity className="size-3 text-emerald-400 animate-pulse" />
                {items.length} records
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Form */}
            <form onSubmit={handleAddItem} className="flex gap-2">
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Add a new task or feature to the database..."
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button type="submit" disabled={adding || !newItemTitle.trim()}>
                <Plus className="size-4 mr-1.5" />
                Add Item
              </Button>
            </form>

            {/* List */}
            <div className="divide-y rounded-md border">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 hover:bg-card/50 transition-colors"
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => handleToggleItem(item.id, item.completed)}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                    <span
                      className={`text-sm ${
                        item.completed ? 'line-through text-muted-foreground' : 'font-medium'
                      }`}
                    >
                      {item.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {item.category}
                    </Badge>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteItem(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}

              {items.length === 0 && !loading && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No records found in database. Add one above!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App
