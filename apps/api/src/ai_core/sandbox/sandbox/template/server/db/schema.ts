export interface BaseRecord {
  id: string
  createdAt: string
  updatedAt: string
}

export interface Item extends BaseRecord {
  title: string
  description?: string
  completed: boolean
  category: 'feature' | 'bug' | 'task'
}

export interface User extends BaseRecord {
  name: string
  email: string
  role: 'admin' | 'developer' | 'user'
}

export interface DatabaseState {
  items: Item[]
  users: User[]
}
