import type { Item, User } from './schema'

export const initialItems: Item[] = [
  {
    id: 'item-1',
    title: 'Initialize fullstack architecture',
    description: 'Vite React frontend connected to Express API backend',
    completed: true,
    category: 'feature',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'item-2',
    title: 'Setup Mocked Database layer',
    description: 'Simulate async database queries with in-memory persistence',
    completed: true,
    category: 'feature',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'item-3',
    title: 'Build user-requested feature',
    description: 'Let the AI agent modify components and backend routes',
    completed: false,
    category: 'task',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const initialUsers: User[] = [
  {
    id: 'user-1',
    name: 'Sandbox Developer',
    email: 'dev@cloud-agent.local',
    role: 'developer',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
