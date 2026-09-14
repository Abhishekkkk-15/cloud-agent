import { Router, type Request, type Response } from 'express'
import { db } from '../db/mockDb'

export const apiRouter = Router()

// Health check with DB status
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: db.isConnected() ? 'connected (mock)' : 'disconnected',
  })
})

// Database statistics & status
apiRouter.get('/db/stats', (_req: Request, res: Response) => {
  res.json(db.getStats())
})

// Get all items
apiRouter.get('/items', async (_req: Request, res: Response) => {
  try {
    const items = await db.collection('items').find()
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' })
  }
})

// Create new item
apiRouter.post('/items', async (req: Request, res: Response) => {
  try {
    const { title, description, category = 'task' } = req.body
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title is required' })
      return
    }

    const newItem = await db.collection('items').create({
      title: title.trim(),
      description: description ? String(description).trim() : undefined,
      category,
      completed: false,
    })

    res.status(201).json(newItem)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create item' })
  }
})

// Update item (e.g., toggle complete or edit title)
apiRouter.put('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updated = await db.collection('items').update(id, req.body)
    if (!updated) {
      res.status(404).json({ error: 'Item not found' })
      return
    }
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' })
  }
})

// Delete item
apiRouter.delete('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const success = await db.collection('items').delete(id)
    if (!success) {
      res.status(404).json({ error: 'Item not found' })
      return
    }
    res.json({ success: true, deletedId: id })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' })
  }
})
