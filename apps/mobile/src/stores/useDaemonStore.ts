import { create } from 'zustand';
import { mobileP2P, ConnectionState, DaemonStatusResult } from '../lib/p2p-client';

export interface MachineInfo {
  machineId: string;
  name: string;
  platform: string;
  arch: string;
  isOnline: boolean;
  status: string;
}

export interface RealSessionItem {
  id: string;
  title: string;
  workspacePath: string;
  workspaceName: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model?: string;
  status?: string;
}

export interface RealMessageItem {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  reasoning?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: any }>;
  toolCallId?: string;
}

export interface ApprovalRequest {
  id: string;
  tool: string;
  command: string;
  description: string;
  requestedAt: string;
  targetNode: string;
  caller: string;
  riskLevel: 'high' | 'medium' | 'low';
}

interface DaemonStoreState {
  apiUrl: string;
  gatewayUrl: string;
  token: string | null;
  activeMachine: MachineInfo | null;
  connectionState: ConnectionState;
  daemonStatus: DaemonStatusResult | null;
  pingRtt: string;
  sessions: RealSessionItem[];
  selectedWorkspace: string;
  workspaces: string[];
  activeSession: RealSessionItem | null;
  sessionMessages: RealMessageItem[];
  isLoadingSessions: boolean;
  isSendingPrompt: boolean;
  pendingApproval: ApprovalRequest | null;
  decisionTrail: Array<{
    id: string;
    command: string;
    approved: boolean;
    timestamp: string;
    details: string;
  }>;

  // Actions
  init: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  selectSession: (session: RealSessionItem) => Promise<void>;
  sendPrompt: (promptText: string) => Promise<void>;
  respondApproval: (allowed: boolean) => Promise<void>;
  pingHeartbeat: () => Promise<void>;
  setSelectedWorkspace: (ws: string) => void;
}

export const useDaemonStore = create<DaemonStoreState>((set, get) => ({
  apiUrl: 'http://127.0.0.1:8000',
  gatewayUrl: 'http://localhost:8080',
  token: null,
  activeMachine: null,
  connectionState: 'disconnected',
  daemonStatus: null,
  pingRtt: '14ms',
  sessions: [],
  selectedWorkspace: 'all',
  workspaces: [],
  activeSession: null,
  sessionMessages: [],
  isLoadingSessions: false,
  isSendingPrompt: false,
  pendingApproval: null,
  decisionTrail: [],

  setSelectedWorkspace: (ws: string) => {
    set({ selectedWorkspace: ws });
  },

  init: async () => {
    const { apiUrl, gatewayUrl } = get();

    // Subscribe to connection state
    mobileP2P.onStateChange((state) => {
      set({ connectionState: state });
      if (state === 'connected') {
        get().refreshStatus();
        get().fetchSessions();
      }
    });

    // Subscribe to live agent events
    mobileP2P.onEvent((event) => {
      if (!event) return;

      if (event.type === 'tool_approval_required' || event.type === 'ask_user' || event.type === 'permission_request') {
        const data = event.data || event;
        set({
          pendingApproval: {
            id: event.approvalId || data.id || `appr_${Date.now()}`,
            tool: event.tool || data.toolName || data.tool || 'bash',
            command: event.command || data.command || event.prompt || data.prompt || (data.details ? JSON.stringify(data.details) : ''),
            description: event.description || data.description || 'Elevated command requires approval',
            requestedAt: 'Just now',
            targetNode: get().activeMachine?.name || 'DESKTOP-BJI38IC',
            caller: 'Google Antigravity CLI',
            riskLevel: 'high',
          },
        });
      } else if (event.type === 'text_chunk') {
        const text = typeof event.data === 'string'
          ? event.data
          : event.data?.text ?? event.text ?? '';
        if (!text) return;

        set((state) => {
          const msgs = [...state.sessionMessages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            const currentContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
            msgs[msgs.length - 1] = {
              ...lastMsg,
              content: currentContent + text,
            };
            return { sessionMessages: msgs };
          } else {
            return {
              sessionMessages: [
                ...msgs,
                {
                  id: `asst_${Date.now()}`,
                  role: 'assistant',
                  content: text,
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }
        });
      } else if (event.type === 'thought') {
        const thought = event.data?.thought || event.thought || '';
        if (!thought) return;
        set((state) => {
          const msgs = [...state.sessionMessages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            msgs[msgs.length - 1] = {
              ...lastMsg,
              reasoning: (lastMsg.reasoning || '') + thought,
            };
            return { sessionMessages: msgs };
          } else {
            return {
              sessionMessages: [
                ...msgs,
                {
                  id: `asst_${Date.now()}`,
                  role: 'assistant',
                  content: '',
                  reasoning: thought,
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }
        });
      } else if (event.type === 'tool_call') {
        const tcData = event.data || event;
        set((state) => {
          const msgs = [...state.sessionMessages];
          const lastMsg = msgs[msgs.length - 1];
          const newToolCall = {
            id: tcData.id || `tc_${Date.now()}`,
            name: tcData.name || 'tool',
            arguments: tcData.arguments || {},
          };
          if (lastMsg && lastMsg.role === 'assistant') {
            const existingCalls = lastMsg.toolCalls || [];
            msgs[msgs.length - 1] = {
              ...lastMsg,
              toolCalls: [...existingCalls, newToolCall],
            };
            return { sessionMessages: msgs };
          } else {
            return {
              sessionMessages: [
                ...msgs,
                {
                  id: `asst_${Date.now()}`,
                  role: 'assistant',
                  content: '',
                  toolCalls: [newToolCall],
                  timestamp: new Date().toISOString(),
                },
              ],
            };
          }
        });
      } else if (event.type === 'status') {
        const statusVal = event.data?.status || event.status;
        const msg = event.data?.message || event.message;
        if (statusVal === 'error') {
          set((state) => ({
            sessionMessages: [
              ...state.sessionMessages,
              {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: `⚠️ Error: ${msg || 'Execution failed'}`,
                timestamp: new Date().toISOString(),
              },
            ],
            isSendingPrompt: false,
          }));
        } else if (statusVal === 'done') {
          set({ isSendingPrompt: false });
        }
      }
    });

    try {
      // 1. Fetch Auth JWT
      let token = get().token;
      if (!token) {
        const loginRes = await fetch(`${apiUrl}/auth/dev-login`, { method: 'POST' });
        if (loginRes.ok) {
          const login = await loginRes.json();
          token = login.access_token;
          set({ token });
        }
      }

      if (!token) {
        console.warn('[DaemonStore] No auth token available.');
        return;
      }

      // 2. Fetch Machines from Gateway
      const machRes = await fetch(`${gatewayUrl}/api/machines`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!machRes.ok) {
        console.warn('[DaemonStore] Failed to fetch machines from gateway.');
        return;
      }

      const machData = await machRes.json();
      const machines: MachineInfo[] = (machData.machines || []).map((m: any) => ({
        machineId: m.machineId,
        name: m.name,
        platform: m.platform,
        arch: m.arch,
        isOnline: m.isOnline ?? m.status === 'online',
        status: m.status,
      }));

      const targetMachine = machines.find((m) => m.isOnline) || machines[0];
      if (targetMachine) {
        set({ activeMachine: targetMachine });
        await mobileP2P.connect(gatewayUrl, token, targetMachine.machineId);
      }
    } catch (err) {
      console.error('[DaemonStore] Init error:', err);
    }
  },

  refreshStatus: async () => {
    try {
      const result = await mobileP2P.sendRpc<DaemonStatusResult>('daemon.status');
      if (result) {
        set({ daemonStatus: result });
      }
    } catch (err) {
      console.error('[DaemonStore] refreshStatus error:', err);
    }
  },

  fetchSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const resp = await mobileP2P.sendRpc<{ items: any[]; total: number }>('sessions.list', {
        limit: 50,
      });

      if (resp && Array.isArray(resp.items)) {
        const parsed: RealSessionItem[] = resp.items.map((item: any) => {
          const cleanPath = (item.workspacePath || '').replace(/\\/g, '/');
          const parts = cleanPath.split('/').filter(Boolean);
          const workspaceName = parts.length > 0 ? parts[parts.length - 1] : 'default';

          return {
            id: item.id,
            title: item.title || `Session ${item.id.slice(0, 8)}`,
            workspacePath: item.workspacePath || '',
            workspaceName,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
            messageCount: item.messageCount || 0,
            model: item.model || 'antigravity-runtime',
            status: item.status || 'idle',
          };
        });

        const uniqueWorkspaces = Array.from(new Set(parsed.map((s) => s.workspaceName)));

        set({
          sessions: parsed,
          workspaces: uniqueWorkspaces,
          isLoadingSessions: false,
        });

        // Auto-select first session if none selected
        if (!get().activeSession && parsed.length > 0) {
          get().selectSession(parsed[0]);
        }
      } else {
        set({ isLoadingSessions: false });
      }
    } catch (err) {
      console.error('[DaemonStore] fetchSessions error:', err);
      set({ isLoadingSessions: false });
    }
  },

  selectSession: async (session: RealSessionItem) => {
    set({ activeSession: session, sessionMessages: [] });
    try {
      const resp = await mobileP2P.sendRpc<any>('sessions.messages', {
        sessionId: session.id,
        limit: 50,
      });

      const rawList = Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp?.messages)
        ? resp.messages
        : [];

      if (rawList.length > 0) {
        const msgs: RealMessageItem[] = rawList.map((m: any) => ({
          id: m.id,
          role: m.role || 'user',
          content: m.content || '',
          reasoning: m.reasoning,
          timestamp: m.timestamp || new Date().toISOString(),
          toolCalls: m.toolCalls,
        }));
        set({ sessionMessages: msgs });
      } else {
        set({ sessionMessages: [] });
      }
    } catch (err) {
      console.error('[DaemonStore] selectSession error:', err);
    }
  },

  sendPrompt: async (promptText: string) => {
    if (!promptText.trim()) return;
    const { activeSession } = get();

    // Optimistically append user message
    const userMsg: RealMessageItem = {
      role: 'user',
      content: promptText,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      sessionMessages: [...state.sessionMessages, userMsg],
      isSendingPrompt: true,
    }));

    try {
      await mobileP2P.sendRpc('agent.run', {
        options: {
          prompt: promptText,
          sessionId: activeSession?.id,
          cwd: activeSession?.workspacePath,
        },
        prompt: promptText,
        sessionId: activeSession?.id,
        cwd: activeSession?.workspacePath,
      });
      set({ isSendingPrompt: false });
    } catch (err: any) {
      console.error('[DaemonStore] sendPrompt error:', err);
      const errMsg = err?.message || String(err);
      set((state) => ({
        sessionMessages: [
          ...state.sessionMessages,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Failed to execute turn: ${errMsg}`,
            timestamp: new Date().toISOString(),
          },
        ],
        isSendingPrompt: false,
      }));
    }
  },

  respondApproval: async (allowed: boolean) => {
    const { pendingApproval } = get();
    if (!pendingApproval) return;

    try {
      await mobileP2P.sendRpc('agent.approve', {
        approvalId: pendingApproval.id,
        allowed,
      });

      // Record to audit trail
      set((state) => ({
        pendingApproval: null,
        decisionTrail: [
          {
            id: `dt_${Date.now()}`,
            command: pendingApproval.command,
            approved: allowed,
            timestamp: 'Just now',
            details: allowed ? 'Authorized by mobile operator' : 'Denied by mobile operator',
          },
          ...state.decisionTrail,
        ],
      }));
    } catch (err) {
      console.error('[DaemonStore] respondApproval error:', err);
      // Still update UI
      set((state) => ({
        pendingApproval: null,
        decisionTrail: [
          {
            id: `dt_${Date.now()}`,
            command: pendingApproval.command,
            approved: allowed,
            timestamp: 'Just now',
            details: allowed ? 'Authorized by mobile operator' : 'Denied by mobile operator',
          },
          ...state.decisionTrail,
        ],
      }));
    }
  },

  pingHeartbeat: async () => {
    const start = Date.now();
    try {
      await mobileP2P.sendRpc('daemon.status');
      const rtt = `${Date.now() - start}ms`;
      set({ pingRtt: rtt });
    } catch {
      set({ pingRtt: 'error' });
    }
  },
}));
