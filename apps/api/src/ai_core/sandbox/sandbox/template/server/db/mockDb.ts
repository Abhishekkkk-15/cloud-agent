import { initialItems, initialUsers } from './seed'
import type { BaseRecord, DatabaseState, Item, User } from './schema'

class MockDatabase {
  private connected = true
  private latencyMs = 10 // Simulates realistic async DB network hop

  private state: DatabaseState = {
    items: [...initialItems],
    users: [...initialUsers],
  }

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
    }
  }

  public isConnected(): boolean {
    return this.connected
  }

  public async connect(): Promise<void> {
    await this.simulateLatency()
    this.connected = true
    console.log('[MockDB] Connected to in-memory database instance.')
  }

  public async disconnect(): Promise<void> {
    await this.simulateLatency()
    this.connected = false
    console.log('[MockDB] Disconnected from database.')
  }

  public collection<K extends keyof DatabaseState>(name: K) {
    type RecordType = DatabaseState[K][number]

    return {
      find: async (filter?: Partial<RecordType>): Promise<RecordType[]> => {
        await this.simulateLatency()
        const records = this.state[name] as RecordType[]
        if (!filter) return [...records]

        return records.filter((item) =>
          Object.entries(filter).every(
            ([key, value]) => (item as Record<string, unknown>)[key] === value
          )
        )
      },

      findById: async (id: string): Promise<RecordType | null> => {
        await this.simulateLatency()
        const records = this.state[name] as RecordType[]
        const found = records.find((item) => item.id === id)
        return found ? { ...found } : null
      },

      create: async (
        data: Omit<RecordType, keyof BaseRecord> & Partial<BaseRecord>
      ): Promise<RecordType> => {
        await this.simulateLatency()
        const now = new Date().toISOString()
        const newRecord = {
          ...data,
          id: data.id || `${String(name)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: data.createdAt || now,
          updatedAt: now,
        } as RecordType

        ;(this.state[name] as RecordType[]).unshift(newRecord)
        return { ...newRecord }
      },

      update: async (
        id: string,
        data: Partial<Omit<RecordType, 'id' | 'createdAt'>>
      ): Promise<RecordType | null> => {
        await this.simulateLatency()
        const records = this.state[name] as RecordType[]
        const index = records.findIndex((item) => item.id === id)
        if (index === -1) return null

        const updated = {
          ...records[index],
          ...data,
          updatedAt: new Date().toISOString(),
        }
        records[index] = updated
        return { ...updated }
      },

      delete: async (id: string): Promise<boolean> => {
        await this.simulateLatency()
        const records = this.state[name] as RecordType[]
        const initialLength = records.length
        this.state[name] = records.filter((item) => item.id !== id) as DatabaseState[K]
        return this.state[name].length < initialLength
      },

      count: async (): Promise<number> => {
        await this.simulateLatency()
        return (this.state[name] as RecordType[]).length
      },
    }
  }

  public getStats() {
    return {
      status: this.connected ? 'connected' : 'disconnected',
      type: 'MockDatabase (In-Memory)',
      collections: {
        items: this.state.items.length,
        users: this.state.users.length,
      },
      latencyMs: this.latencyMs,
    }
  }
}

export const mockDb = new MockDatabase()
export const db = mockDb
