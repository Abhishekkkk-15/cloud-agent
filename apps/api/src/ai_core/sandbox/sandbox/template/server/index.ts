import express from 'express'
import cors from 'cors'
import { apiRouter } from './routes/api'
import { db } from './db/mockDb'

const app = express()
const PORT = process.env.PORT || 3000
const HOST = '0.0.0.0'

app.use(cors())
app.use(express.json())

// Mount API routes
app.use('/api', apiRouter)

// Root fallback
app.get('/', (_req, res) => {
  res.json({
    message: 'Fullstack API Server is running',
    endpoints: ['/api/health', '/api/db/stats', '/api/items'],
  })
})

app.listen(Number(PORT), HOST, () => {
  console.log(`[API Server] Running on http://${HOST}:${PORT}`)
  console.log(`[Database] Status: ${db.isConnected() ? 'ONLINE (Mock)' : 'OFFLINE'}`)
})
