import { create } from 'zustand';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CliArtifact } from '@cloud-agent/cli-interface';
import { mobileP2P, ConnectionState, DaemonStatusResult } from '../lib/p2p-client';
import {
  requestNotificationPermission,
  notifyTurnComplete,
  notifyApprovalRequired,
  notifyTurnError,
  registerForPushNotificationsAsync,
  triggerGatewayTestPush,
  getPushRegistrationState,
  isRunningInExpoGo,
  emitInAppNotification,
} from '../lib/notifications';

function getDefaultHost(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location.hostname
      ? window.location.hostname
      : 'localhost';
  }
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '192.168.1.10';
}

const defaultHost = getDefaultHost();

const STORAGE_KEY_TOKEN = 'cloud_agent_token';
const STORAGE_KEY_USER = 'cloud_agent_user';
const STORAGE_KEY_API = 'cloud_agent_api_url';
const STORAGE_KEY_GATEWAY = 'cloud_agent_gateway_url';

async function getStorageItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

async function removeStorageItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function getStoredUrlSync(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envGatewayUrl = process.env.EXPO_PUBLIC_GATEWAY_URL;

export function resolveInitialApiUrl(): string {
  const stored = getStoredUrlSync(STORAGE_KEY_API);
  if (stored && stored.trim()) return stored.trim();
  if (envApiUrl && envApiUrl.trim()) return envApiUrl.trim();
  return `http://${defaultHost}:8000`;
}

export function resolveInitialGatewayUrl(): string {
  const stored = getStoredUrlSync(STORAGE_KEY_GATEWAY);
  if (stored && stored.trim()) return stored.trim();
  if (envGatewayUrl && envGatewayUrl.trim()) return envGatewayUrl.trim();
  return `http://${defaultHost}:8080`;
}

export interface EndpointTestResult {
  apiOk: boolean;
  apiLatencyMs?: number;
  apiError?: string;
  gatewayOk: boolean;
  gatewayLatencyMs?: number;
  connectedDaemons?: number;
  gatewayError?: string;
}

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
  pinned?: boolean;
}

export interface RealMessageItem {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  reasoning?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: any;
    result?: any;
    error?: any;
    status?: 'running' | 'success' | 'error';
    duration?: string;
  }>;
  toolCallId?: string;
}

export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type ExecutionMode = 'auto' | 'plan' | 'accept-edits';

export interface SessionConfig {
  model: string;
  effort: ReasoningEffort;
  mode: ExecutionMode;
  dangerouslySkipPermissions?: boolean;
}

export interface ApprovalRequest {
  id: string;
  sessionId?: string;
  tool: string;
  command: string;
  description: string;
  justification?: string;
  requestedAt: string;
  targetNode: string;
  caller: string;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface KnownWorkspaceItem {
  path: string;
  name: string;
  lastUsed?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface DirectoryBrowseResult {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  dirs: Array<{ name: string; fullPath: string }>;
}

export interface TerminalOutputLine {
  id: string;
  text: string;
  stream: 'stdout' | 'stderr' | 'info';
  timestamp: string;
}

export interface AutoHealerProposal {
  incidentId: string;
  title: string;
  description: string;
  source: 'github' | 'sentry' | 'simulator';
  branchName: string;
  diff: string;
  testCommand: string;
  testOutput: string;
  testsPassed: boolean;
  createdAt: string;
  status: 'pending_review' | 'approved' | 'discarded';
  url?: string;
}

export interface AutoPrReviewReport {
  prNumber: number;
  prTitle: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  verdict: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  summary: string;
  securityRisks: string[];
  lineComments: Array<{ file: string; line: number; comment: string; suggestion?: string }>;
  fullMarkdown: string;
  createdAt: string;
  status: 'pending_review' | 'posted' | 'discarded';
}

interface DaemonStoreState {
  apiUrl: string;
  gatewayUrl: string;
  token: string | null;
  isAuthenticated: boolean;
  isInitializingAuth: boolean;
  currentUser: UserProfile | null;
  activeMachine: MachineInfo | null;
  machines: MachineInfo[];
  isLoadingMachines: boolean;
  connectionState: ConnectionState;
  daemonStatus: DaemonStatusResult | null;
  pingRtt: string;
  sessions: RealSessionItem[];
  selectedWorkspace: string;
  workspaces: string[];
  knownWorkspaces: KnownWorkspaceItem[];
  targetWorkspacePath: string | null;
  activeSession: RealSessionItem | null;
  sessionMessages: RealMessageItem[];
  messagesOffset: number;
  hasMoreMessages: boolean;
  isLoadingOlderMessages: boolean;
  isLoadingSessions: boolean;
  isSendingPrompt: boolean;
  isCancellingPrompt: boolean;
  pendingApproval: ApprovalRequest | null;
  decisionTrail: Array<{
    id: string;
    command: string;
    approved: boolean;
    timestamp: string;
    details: string;
  }>;
  sessionConfig: SessionConfig;
  terminalLines: TerminalOutputLine[];
  isTerminalRunning: boolean;
  sessionArtifacts: CliArtifact[];
  isLoadingArtifacts: boolean;
  selectedArtifactContent: Record<string, string>;
  isLoadingArtifactContent: boolean;
  pushStatus: string;
  isPushRegistered: boolean;
  pushToken: string | null;
  activeProposal: AutoHealerProposal | null;
  activePrReview: AutoPrReviewReport | null;
  isAutoHealerModalVisible: boolean;
  isSimulatingIncident: boolean;

  // Actions
  init: () => Promise<void>;
  registerPushNotifications: () => Promise<void>;
  triggerTestPushNotification: () => Promise<{ success: boolean; message: string }>;
  openAutoHealerProposal: (proposal: AutoHealerProposal) => void;
  openAutoPrReview: (review: AutoPrReviewReport) => void;
  dismissAutoHealer: () => void;
  simulateAutoHealerIncident: (machineId?: string) => Promise<{ success: boolean; message: string; proposal?: AutoHealerProposal }>;
  simulatePrReview: (machineId?: string) => Promise<{ success: boolean; message: string; review?: AutoPrReviewReport }>;
  approveAutoHealerProposal: (incidentId: string, action: 'pr' | 'merge' | 'discard') => Promise<{ success: boolean; message: string }>;
  postPrReviewToGitHub: (prNumber: number, verdict: string, body?: string) => Promise<{ success: boolean; message: string }>;
  connectGateway: () => Promise<void>;
  loginWithDev: () => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginWithToken: (token: string, user?: any) => Promise<boolean>;
  logout: () => void;
  execTerminalCommand: (command: string, cwd?: string) => Promise<{ exitCode: number }>;
  clearTerminal: () => void;
  refreshStatus: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchKnownWorkspaces: () => Promise<void>;
  fetchSessionArtifacts: (sessionId?: string) => Promise<CliArtifact[]>;
  fetchArtifactContent: (artifactPath: string) => Promise<string>;
  fetchDirectorySuggestions: (parentPath?: string) => Promise<Array<{ name: string; fullPath: string }>>;
  browseDirectories: (path?: string) => Promise<DirectoryBrowseResult | null>;
  startNewSessionInWorkspace: (workspacePath: string, config?: Partial<SessionConfig>) => void;
  fetchMachines: () => Promise<MachineInfo[]>;
  selectMachine: (machine: MachineInfo) => Promise<void>;
  unpairMachine: (machineId: string) => Promise<boolean>;
  generateMachinePairingToken: (machineName?: string) => Promise<{ token: string; installCommand: string; instructions: string } | null>;
  pairWithPayload: (payload: string) => Promise<{ success: boolean; message: string }>;
  renameSession: (sessionId: string, title: string) => Promise<boolean>;
  deleteSession: (sessionId: string) => Promise<boolean>;
  togglePinSession: (sessionId: string) => Promise<boolean>;
  selectSession: (session: RealSessionItem) => Promise<void>;
  createNewSession: () => void;
  loadOlderMessages: () => Promise<void>;
  sendPrompt: (promptText: string) => Promise<void>;
  cancelPrompt: () => Promise<boolean>;
  respondApproval: (allowed: boolean) => Promise<void>;
  pingHeartbeat: () => Promise<void>;
  setSelectedWorkspace: (ws: string) => void;
  setSessionConfig: (config: Partial<SessionConfig>) => void;
  setServerEndpoints: (urls: { apiUrl: string; gatewayUrl: string }) => Promise<void>;
  resetServerEndpoints: () => Promise<void>;
  testServerEndpoints: (apiUrl: string, gatewayUrl: string) => Promise<EndpointTestResult>;
}

export const useDaemonStore = create<DaemonStoreState>((set, get) => ({
  apiUrl: resolveInitialApiUrl(),
  gatewayUrl: resolveInitialGatewayUrl(),
  token: null,
  isAuthenticated: false,
  isInitializingAuth: true,
  currentUser: null,
  activeMachine: null,
  machines: [],
  isLoadingMachines: false,
  connectionState: 'disconnected',
  daemonStatus: null,
  pingRtt: '14ms',
  sessions: [],
  selectedWorkspace: 'all',
  workspaces: [],
  knownWorkspaces: [],
  targetWorkspacePath: null,
  activeSession: null,
  sessionMessages: [],
  messagesOffset: 0,
  hasMoreMessages: false,
  isLoadingOlderMessages: false,
  isLoadingSessions: false,
  isSendingPrompt: false,
  isCancellingPrompt: false,
  pendingApproval: null,
  decisionTrail: [],
  sessionConfig: {
    model: 'gemini-3.8-flash-high',
    effort: 'high',
    mode: 'auto',
    dangerouslySkipPermissions: true,
  },
  terminalLines: [],
  isTerminalRunning: false,
  sessionArtifacts: [],
  isLoadingArtifacts: false,
  selectedArtifactContent: {},
  isLoadingArtifactContent: false,
  pushStatus: 'Initializing...',
  isPushRegistered: false,
  pushToken: null,
  activeProposal: null,
  activePrReview: null,
  isAutoHealerModalVisible: false,
  isSimulatingIncident: false,

  openAutoHealerProposal: (proposal: AutoHealerProposal) => {
    set({
      activeProposal: proposal,
      activePrReview: null,
      isAutoHealerModalVisible: true,
    });
  },

  openAutoPrReview: (review: AutoPrReviewReport) => {
    set({
      activePrReview: review,
      activeProposal: null,
      isAutoHealerModalVisible: true,
    });
  },

  dismissAutoHealer: () => {
    set({
      activeProposal: null,
      activePrReview: null,
      isAutoHealerModalVisible: false,
    });
  },

  simulateAutoHealerIncident: async (machineId?: string) => {
    const { gatewayUrl, activeMachine } = get();
    const targetId = machineId || activeMachine?.machineId;
    if (!targetId) {
      return { success: false, message: 'No target machine selected' };
    }
    set({ isSimulatingIncident: true });
    try {
      const cleanUrl = gatewayUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/webhooks/simulate/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (data.proposal) {
        get().openAutoHealerProposal(data.proposal);
      }
      return {
        success: true,
        message: 'Auto-Healer incident simulated and verified!',
        proposal: data.proposal,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Simulation failed',
      };
    } finally {
      set({ isSimulatingIncident: false });
    }
  },

  simulatePrReview: async (machineId?: string) => {
    const { gatewayUrl, activeMachine } = get();
    const targetId = machineId || activeMachine?.machineId;
    if (!targetId) {
      return { success: false, message: 'No target machine selected' };
    }
    set({ isSimulatingIncident: true });
    try {
      const cleanUrl = gatewayUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/webhooks/simulate-pr/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (data.review) {
        get().openAutoPrReview(data.review);
      }
      return {
        success: true,
        message: 'Autonomous PR review simulated and ready!',
        review: data.review,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'PR simulation failed',
      };
    } finally {
      set({ isSimulatingIncident: false });
    }
  },

  approveAutoHealerProposal: async (incidentId: string, action: 'pr' | 'merge' | 'discard') => {
    const { activeProposal, targetWorkspacePath, activeSession } = get();
    const branchName = activeProposal?.branchName || `auto-healer/${incidentId}`;
    const workspacePath = activeSession?.workspacePath || targetWorkspacePath || undefined;

    try {
      const res: any = await mobileP2P.sendRpc('auto_healer.approve', {
        incidentId,
        branchName,
        action,
        workspacePath,
      });
      return {
        success: Boolean(res?.success ?? true),
        message: res?.message || `Proposal ${action} executed successfully.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Action failed',
      };
    }
  },

  postPrReviewToGitHub: async (prNumber: number, verdict: string, body?: string) => {
    const { targetWorkspacePath, activeSession } = get();
    const workspacePath = activeSession?.workspacePath || targetWorkspacePath || undefined;

    try {
      const res: any = await mobileP2P.sendRpc('auto_healer.post_pr_review', {
        prNumber,
        verdict,
        body,
        workspacePath,
      });
      return {
        success: Boolean(res?.success ?? true),
        message: res?.message || `PR Review posted to GitHub PR #${prNumber}.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Post review failed',
      };
    }
  },

  registerPushNotifications: async () => {
    const { gatewayUrl, token, activeMachine } = get();
    try {
      const pushToken = await registerForPushNotificationsAsync({
        gatewayUrl,
        userToken: token || undefined,
        machineId: activeMachine?.machineId,
      });
      const pushState = getPushRegistrationState();
      set({
        pushStatus: pushState.statusMessage,
        isPushRegistered: pushState.isRegistered,
        pushToken: pushState.pushToken || pushToken,
      });
    } catch (e: any) {
      set({
        pushStatus: e?.message || 'Push registration failed',
        isPushRegistered: false,
      });
    }
  },

  triggerTestPushNotification: async () => {
    const { gatewayUrl, token } = get();
    try {
      const isExpoGo = isRunningInExpoGo();
      const pushState = getPushRegistrationState();

      if (isExpoGo || !pushState.pushToken) {
        // In Expo Go or when no remote push token is registered:
        // Trigger simulated in-app notification banner directly so developer can verify notifications working
        emitInAppNotification({
          title: 'Cloud Agent • Notification Alert (Expo Go)',
          body: 'In-app notification working! (Remote lock-screen push requires an APK development build via EAS).',
          type: 'info',
        });
        return {
          success: true,
          message: 'In-App notification banner verified! Note: Remote lock-screen push requires an APK development build.',
        };
      }

      const ok = await triggerGatewayTestPush(gatewayUrl, token || undefined);
      return {
        success: ok,
        message: ok
          ? 'Native push notification sent from Gateway! Check your lock-screen / notification shade.'
          : 'Failed to send test push notification.',
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Test push request failed',
      };
    }
  },

  setSessionConfig: (newCfg: Partial<SessionConfig>) => {
    set((state) => ({
      sessionConfig: { ...state.sessionConfig, ...newCfg },
    }));
  },

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
        get().fetchKnownWorkspaces();
        get().fetchMachines();
      }
    });

    // Subscribe to live agent events
    mobileP2P.onEvent((event: any) => {
      if (!event) return;

      if (event.type === 'auto_healer.proposal' && event.proposal) {
        get().openAutoHealerProposal(event.proposal);
        return;
      }
      if (event.type === 'auto_healer.pr_review' && event.review) {
        get().openAutoPrReview(event.review);
        return;
      }

      if (event.type === 'tool_approval_required' || event.type === 'ask_user' || event.type === 'permission_request') {
        const data = event.data || event;
        const tool = event.tool || data.toolName || data.tool || 'bash';
        const cmd = event.command || data.command || event.prompt || data.prompt || (data.details ? JSON.stringify(data.details) : '');
        set({
          pendingApproval: {
            id: event.approvalId || data.id || `appr_${Date.now()}`,
            sessionId: event.sessionId || data.sessionId,
            tool,
            command: cmd,
            description: event.description || data.description || 'Elevated command requires approval',
            requestedAt: 'Just now',
            targetNode: get().activeMachine?.name || get().daemonStatus?.hostname || 'Local Machine',
            caller: 'Google Antigravity CLI',
            riskLevel: 'high',
          },
        });
        notifyApprovalRequired(tool, cmd).catch(() => {});
      } else if (event.type === 'text_chunk') {
        const text = typeof event.data === 'string'
          ? event.data
          : event.data?.text ?? event.text ?? '';
        const isDelta = typeof event.data === 'object' && event.data !== null && 'delta' in event.data
          ? (event.data as any).delta
          : true;
        if (!text) return;

        set((state) => {
          const msgs = [...state.sessionMessages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            const currentContent = typeof lastMsg.content === 'string' ? lastMsg.content : '';
            msgs[msgs.length - 1] = {
              ...lastMsg,
              content: isDelta ? currentContent + text : text,
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
        const toolCallId = tcData.id || `tc_${Date.now()}`;
        set((state) => {
          const msgs = [...state.sessionMessages];
          const lastMsg = msgs[msgs.length - 1];
          const newToolCall = {
            id: toolCallId,
            name: tcData.name || 'tool',
            arguments: tcData.arguments || {},
            status: 'running' as const,
          };
          if (lastMsg && lastMsg.role === 'assistant') {
            const existingCalls = lastMsg.toolCalls || [];
            const exists = existingCalls.some((c) => c.id === toolCallId);
            if (!exists) {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                toolCalls: [...existingCalls, newToolCall],
              };
            }
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
      } else if (event.type === 'tool_result') {
        const trData = event.data || event;
        set((state) => {
          const msgs = [...state.sessionMessages];
          let updated = false;
          for (let i = msgs.length - 1; i >= 0; i--) {
            const msg = msgs[i];
            if (msg.toolCalls && msg.toolCalls.length > 0) {
              const hasMatch = msg.toolCalls.some(
                (tc) => tc.id === trData.toolCallId || tc.name === trData.name
              );
              if (hasMatch) {
                const newToolCalls = msg.toolCalls.map((tc) => {
                  if (tc.id === trData.toolCallId || tc.name === trData.name) {
                    return {
                      ...tc,
                      result: trData.output ?? trData.result ?? '',
                      error: trData.error,
                      status: trData.isError || trData.error ? ('error' as const) : ('success' as const),
                      duration: trData.duration ? String(trData.duration) : tc.duration,
                    };
                  }
                  return tc;
                });
                msgs[i] = {
                  ...msg,
                  toolCalls: newToolCalls,
                };
                updated = true;
                break;
              }
            }
          }
          return updated ? { sessionMessages: msgs } : state;
        });
      } else if (event.type === 'status') {
        const statusVal = event.data?.status || event.status;
        const msg = event.data?.message || event.message;
        if (statusVal === 'error') {
          notifyTurnError(msg || 'Execution failed').catch(() => {});
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
          if (get().isSendingPrompt) {
            notifyTurnComplete(get().activeSession?.title || 'Active Session').catch(() => {});
          }
          set({ isSendingPrompt: false });
          get().fetchSessionArtifacts();
        }
      } else if (event.type === 'artifact') {
        get().fetchSessionArtifacts();
      } else if (event.type === 'terminal.output') {
        const trData = event.data || event;
        const text = trData.text || '';
        const stream = trData.stream || 'stdout';
        if (text) {
          set((state) => ({
            terminalLines: [
              ...state.terminalLines,
              {
                id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                text,
                stream,
                timestamp: new Date().toISOString(),
              },
            ],
          }));
        }
      }
    });

    try {
      requestNotificationPermission().catch(() => {});

      // Restore stored token, user profile, and custom endpoints from persistent storage
      const [storedToken, storedUserJson, storedApi, storedGateway] = await Promise.all([
        getStorageItem(STORAGE_KEY_TOKEN),
        getStorageItem(STORAGE_KEY_USER),
        getStorageItem(STORAGE_KEY_API),
        getStorageItem(STORAGE_KEY_GATEWAY),
      ]);

      let restoredUser: UserProfile | null = null;
      if (storedUserJson) {
        try {
          restoredUser = JSON.parse(storedUserJson);
        } catch {
          // ignore
        }
      }

      const effectiveApi = storedApi || get().apiUrl;
      const effectiveGateway = storedGateway || get().gatewayUrl;

      if (storedToken) {
        set({
          token: storedToken,
          isAuthenticated: true,
          currentUser: restoredUser,
          apiUrl: effectiveApi,
          gatewayUrl: effectiveGateway,
        });
        await get().connectGateway();
        get().registerPushNotifications().catch(() => {});
      } else {
        set({
          apiUrl: effectiveApi,
          gatewayUrl: effectiveGateway,
        });
        get().registerPushNotifications().catch(() => {});
      }
    } catch (err) {
      console.error('[DaemonStore] Init error:', err);
    } finally {
      set({ isInitializingAuth: false });
    }
  },

  fetchMachines: async () => {
    const { gatewayUrl, token } = get();
    if (!token) return [];

    set({ isLoadingMachines: true });
    try {
      const machRes = await fetch(`${gatewayUrl}/api/machines`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!machRes.ok) {
        set({ isLoadingMachines: false });
        return get().machines;
      }

      const machData = await machRes.json();
      const machines: MachineInfo[] = (machData.machines || []).map((m: any) => ({
        machineId: m.machineId,
        name: m.name,
        platform: m.platform || 'Linux',
        arch: m.arch || 'x64',
        isOnline: m.isOnline ?? m.status === 'online',
        status: m.status,
      }));

      set({ machines, isLoadingMachines: false });

      // Keep activeMachine synced or auto-select first online/available machine
      const currentActive = get().activeMachine;
      const matched = machines.find((m) => m.machineId === currentActive?.machineId);
      if (!currentActive && machines.length > 0) {
        const next = machines.find((m) => m.isOnline) || machines[0];
        set({ activeMachine: next });
      } else if (matched) {
        set({ activeMachine: { ...currentActive, ...matched } });
      }

      return machines;
    } catch (err) {
      console.error('[DaemonStore] fetchMachines error:', err);
      set({ isLoadingMachines: false });
      return get().machines;
    }
  },

  selectMachine: async (machine: MachineInfo) => {
    const prev = get().activeMachine;
    if (prev?.machineId === machine.machineId) return;

    set({
      activeMachine: machine,
      sessions: [],
      activeSession: null,
      sessionMessages: [],
      sessionArtifacts: [],
      workspaces: [],
      knownWorkspaces: [],
      targetWorkspacePath: null,
      terminalLines: [],
    });

    await mobileP2P.switchMachine(machine.machineId);

    // Refresh telemetry, sessions, and workspaces for the new VPS
    await Promise.allSettled([
      get().refreshStatus(),
      get().fetchSessions(),
      get().fetchKnownWorkspaces(),
      get().fetchMachines(),
    ]);

    get().registerPushNotifications().catch(() => {});
  },

  unpairMachine: async (machineId: string) => {
    const { gatewayUrl, token } = get();
    if (!token) return false;

    try {
      const res = await fetch(`${gatewayUrl}/api/machines/${machineId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return false;

      const remaining = get().machines.filter((m) => m.machineId !== machineId);
      set({ machines: remaining });

      if (get().activeMachine?.machineId === machineId) {
        if (remaining.length > 0) {
          const next = remaining.find((m) => m.isOnline) || remaining[0];
          await get().selectMachine(next);
        } else {
          set({
            activeMachine: null,
            sessions: [],
            activeSession: null,
            sessionMessages: [],
            sessionArtifacts: [],
          });
        }
      }
      return true;
    } catch (err) {
      console.error('[DaemonStore] unpairMachine error:', err);
      return false;
    }
  },

  connectGateway: async () => {
    const { gatewayUrl, token } = get();
    if (!token) return;

    try {
      const machines = await get().fetchMachines();
      const targetMachine = get().activeMachine || machines.find((m) => m.isOnline) || machines[0];
      if (targetMachine) {
        set({ activeMachine: targetMachine });
        await mobileP2P.connect(gatewayUrl, token, targetMachine.machineId);
      }
    } catch (err) {
      console.error('[DaemonStore] connectGateway error:', err);
    }
  },

  loginWithDev: async () => {
    const { gatewayUrl, apiUrl } = get();
    try {
      let loginRes: Response | null = null;
      try {
        loginRes = await fetch(`${gatewayUrl}/auth/dev-login`, { method: 'POST' });
      } catch {}
      if (!loginRes || !loginRes.ok) {
        loginRes = await fetch(`${apiUrl}/auth/dev-login`, { method: 'POST' });
      }
      const login = await loginRes.json();
      const token = login.access_token;
      const devUser = {
        id: 'dev_user_1',
        name: 'Developer',
        email: 'developer@cloud-agent.internal',
      };
      await setStorageItem(STORAGE_KEY_TOKEN, token);
      await setStorageItem(STORAGE_KEY_USER, JSON.stringify(devUser));
      set({
        token,
        isAuthenticated: true,
        currentUser: devUser,
      });
      await get().connectGateway();
      return true;
    } catch (err) {
      console.error('[DaemonStore] loginWithDev error:', err);
      return false;
    }
  },

  loginWithToken: async (token: string, user?: any) => {
    try {
      await setStorageItem(STORAGE_KEY_TOKEN, token);
      if (user) {
        await setStorageItem(STORAGE_KEY_USER, JSON.stringify(user));
      }
      set({
        token,
        isAuthenticated: true,
        currentUser: user || null,
      });
      await get().connectGateway();
      get().registerPushNotifications().catch(() => {});
      return true;
    } catch (err) {
      console.error('[DaemonStore] loginWithToken error:', err);
      return false;
    }
  },

  loginWithGoogle: async (credential: string) => {
    const { apiUrl } = get();
    try {
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const token = data.access_token;
      await setStorageItem(STORAGE_KEY_TOKEN, token);
      if (data.user) {
        await setStorageItem(STORAGE_KEY_USER, JSON.stringify(data.user));
      }
      set({
        token,
        isAuthenticated: true,
        currentUser: data.user || null,
      });
      await get().connectGateway();
      get().registerPushNotifications().catch(() => {});
      return true;
    } catch (err) {
      console.error('[DaemonStore] loginWithGoogle error:', err);
      return false;
    }
  },

  logout: () => {
    mobileP2P.disconnect();
    removeStorageItem(STORAGE_KEY_TOKEN);
    removeStorageItem(STORAGE_KEY_USER);
    set({
      token: null,
      isAuthenticated: false,
      currentUser: null,
      activeMachine: null,
      machines: [],
      sessions: [],
      activeSession: null,
      sessionMessages: [],
      sessionArtifacts: [],
      connectionState: 'disconnected',
    });
  },

  execTerminalCommand: async (command: string, cwd?: string) => {
    const activeWs = cwd || get().targetWorkspacePath || get().activeSession?.workspacePath;
    set((state) => ({
      isTerminalRunning: true,
      terminalLines: [
        ...state.terminalLines,
        {
          id: `cmd_${Date.now()}`,
          text: `$ ${command}`,
          stream: 'info',
          timestamp: new Date().toISOString(),
        },
      ],
    }));

    try {
      const res = await mobileP2P.sendRpc<{ exitCode: number; durationMs?: number }>(
        'terminal.exec',
        { command, cwd: activeWs },
        180000
      );
      set((state) => ({
        isTerminalRunning: false,
        terminalLines: [
          ...state.terminalLines,
          {
            id: `done_${Date.now()}`,
            text: `[Process exited with code ${res?.exitCode ?? 0}]`,
            stream: (res?.exitCode ?? 0) === 0 ? 'info' : 'stderr',
            timestamp: new Date().toISOString(),
          },
        ],
      }));
      return res || { exitCode: 0 };
    } catch (err: any) {
      set((state) => ({
        isTerminalRunning: false,
        terminalLines: [
          ...state.terminalLines,
          {
            id: `err_${Date.now()}`,
            text: `Error: ${err?.message || 'Execution failed'}`,
            stream: 'stderr',
            timestamp: new Date().toISOString(),
          },
        ],
      }));
      return { exitCode: 1 };
    }
  },

  clearTerminal: () => {
    set({ terminalLines: [] });
  },

  fetchKnownWorkspaces: async () => {
    try {
      const res = await mobileP2P.sendRpc<{ workspaces: KnownWorkspaceItem[] }>('workspaces.list');
      if (res && Array.isArray(res.workspaces)) {
        set({ knownWorkspaces: res.workspaces });
        if (!get().targetWorkspacePath && res.workspaces.length > 0) {
          set({ targetWorkspacePath: res.workspaces[0].path });
        }
      }
    } catch (err) {
      console.error('[DaemonStore] fetchKnownWorkspaces error:', err);
    }
  },

  fetchSessionArtifacts: async (sessionId?: string) => {
    const targetId = sessionId || get().activeSession?.id;
    if (!targetId) {
      set({ sessionArtifacts: [] });
      return [];
    }
    set({ isLoadingArtifacts: true });
    try {
      const resp = await mobileP2P.sendRpc<any>('sessions.get', {
        sessionId: targetId,
        includeArtifacts: true,
      });
      const artifacts: CliArtifact[] = Array.isArray(resp?.artifacts) ? resp.artifacts : [];
      set({ sessionArtifacts: artifacts, isLoadingArtifacts: false });
      return artifacts;
    } catch (err) {
      console.error('[DaemonStore] fetchSessionArtifacts error:', err);
      set({ isLoadingArtifacts: false });
      return [];
    }
  },

  fetchArtifactContent: async (artifactPath: string) => {
    const cached = get().selectedArtifactContent[artifactPath];
    if (cached !== undefined) return cached;

    set({ isLoadingArtifactContent: true });
    try {
      const res = await mobileP2P.sendRpc<any>('fs.read', { path: artifactPath });
      const content = typeof res?.content === 'string' ? res.content : '';
      set((state) => ({
        selectedArtifactContent: {
          ...state.selectedArtifactContent,
          [artifactPath]: content,
        },
        isLoadingArtifactContent: false,
      }));
      return content;
    } catch (err) {
      console.error('[DaemonStore] fetchArtifactContent error:', err);
      set({ isLoadingArtifactContent: false });
      return '';
    }
  },

  fetchDirectorySuggestions: async (parentPath?: string) => {
    try {
      const res = await mobileP2P.sendRpc<any>(
        'fs.listDirs',
        { parentPath }
      );
      return res?.dirs || [];
    } catch (err) {
      console.error('[DaemonStore] fetchDirectorySuggestions error:', err);
      return [];
    }
  },

  browseDirectories: async (targetPath?: string) => {
    try {
      const res = await mobileP2P.sendRpc<DirectoryBrowseResult>('fs.listDirs', {
        path: targetPath,
        parentPath: targetPath,
      });
      return res || null;
    } catch (err) {
      console.error('[DaemonStore] browseDirectories error:', err);
      return null;
    }
  },

  startNewSessionInWorkspace: (workspacePath: string, config?: Partial<SessionConfig>) => {
    set((state) => ({
      activeSession: null,
      targetWorkspacePath: workspacePath,
      sessionMessages: [],
      sessionArtifacts: [],
      messagesOffset: 0,
      hasMoreMessages: false,
      isLoadingOlderMessages: false,
      sessionConfig: config ? { ...state.sessionConfig, ...config } : state.sessionConfig,
    }));
  },

  generateMachinePairingToken: async (machineName?: string) => {
    const { gatewayUrl, token } = get();
    if (!token) return null;
    try {
      const res = await fetch(`${gatewayUrl}/api/machines/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: machineName }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return {
        token: data.token,
        installCommand: data.installCommand,
        instructions: data.instructions,
      };
    } catch (err) {
      console.error('[DaemonStore] generateMachinePairingToken error:', err);
      return null;
    }
  },

  pairWithPayload: async (payload: string) => {
    try {
      let token = '';
      let machineId = '';
      let machineName = '';
      let gateway = get().gatewayUrl;

      const trimmed = payload.trim();
      if (trimmed.startsWith('ca_pair://connect?')) {
        const queryStr = trimmed.slice('ca_pair://connect?'.length);
        const params = new URLSearchParams(queryStr);
        token = params.get('token') || '';
        machineId = params.get('machineId') || '';
        machineName = params.get('name') || '';
        if (params.get('gateway')) {
          gateway = params.get('gateway')!;
        }
      } else if (trimmed.startsWith('ca_mach_') || trimmed.length > 20) {
        token = trimmed;
      } else {
        return { success: false, message: 'Invalid pairing format. Expected ca_pair:// URL or token.' };
      }

      if (!token) {
        return { success: false, message: 'No valid token found in payload.' };
      }

      set({
        token,
        isAuthenticated: true,
        gatewayUrl: gateway,
        ...(machineId
          ? {
              activeMachine: {
                machineId,
                name: machineName || 'Paired Machine',
                platform: 'linux',
                arch: 'x64',
                isOnline: true,
                status: 'online',
              },
            }
          : {}),
      });

      await get().connectGateway();
      return { success: true, message: 'Machine paired successfully!' };
    } catch (err: any) {
      console.error('[DaemonStore] pairWithPayload error:', err);
      return { success: false, message: err?.message || 'Failed to pair machine.' };
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
            pinned: Boolean(item.pinned),
          };
        });

        const uniqueWorkspaces = Array.from(new Set(parsed.map((s) => s.workspaceName)));

        set({
          sessions: parsed,
          workspaces: uniqueWorkspaces,
          isLoadingSessions: false,
        });

        // Auto-select first session ONLY IF none selected AND we don't have active chat messages
        if (!get().activeSession && parsed.length > 0) {
          if (get().sessionMessages.length === 0) {
            get().selectSession(parsed[0]);
          } else {
            // Associate with newly created session on disk without wiping in-memory sessionMessages
            set({ activeSession: parsed[0] });
          }
        }
      } else {
        set({ isLoadingSessions: false });
      }
    } catch (err) {
      console.error('[DaemonStore] fetchSessions error:', err);
      set({ isLoadingSessions: false });
    }
  },

  renameSession: async (sessionId: string, title: string) => {
    try {
      await mobileP2P.sendRpc('sessions.rename', { sessionId, title });
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, title } : s)),
        activeSession:
          state.activeSession?.id === sessionId
            ? { ...state.activeSession, title }
            : state.activeSession,
      }));
      return true;
    } catch (err) {
      console.error('[DaemonStore] renameSession error:', err);
      return false;
    }
  },

  togglePinSession: async (sessionId: string) => {
    const current = get().sessions.find((s) => s.id === sessionId);
    const newPinned = !current?.pinned;
    try {
      await mobileP2P.sendRpc('sessions.pin', { sessionId, pinned: newPinned });
      set((state) => {
        const updated = state.sessions.map((s) =>
          s.id === sessionId ? { ...s, pinned: newPinned } : s
        );
        updated.sort((a, b) => {
          if (Boolean(a.pinned) !== Boolean(b.pinned)) {
            return a.pinned ? -1 : 1;
          }
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        return {
          sessions: updated,
          activeSession:
            state.activeSession?.id === sessionId
              ? { ...state.activeSession, pinned: newPinned }
              : state.activeSession,
        };
      });
      return true;
    } catch (err) {
      console.error('[DaemonStore] togglePinSession error:', err);
      return false;
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await mobileP2P.sendRpc('sessions.delete', { sessionId });
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSession: state.activeSession?.id === sessionId ? null : state.activeSession,
        sessionMessages: state.activeSession?.id === sessionId ? [] : state.sessionMessages,
      }));
      return true;
    } catch (err) {
      console.error('[DaemonStore] deleteSession error:', err);
      return false;
    }
  },

  selectSession: async (session: RealSessionItem) => {
    // If selecting the currently active session and it already has messages, avoid wiping
    if (get().activeSession?.id === session.id && get().sessionMessages.length > 0) {
      if (session.workspacePath && get().targetWorkspacePath !== session.workspacePath) {
        set({ targetWorkspacePath: session.workspacePath });
      }
      get().fetchSessionArtifacts(session.id);
      return;
    }
    set({
      activeSession: session,
      targetWorkspacePath: session.workspacePath || null,
      sessionMessages: [],
      sessionArtifacts: [],
      messagesOffset: 0,
      hasMoreMessages: false,
      isLoadingOlderMessages: false,
    });
    get().fetchSessionArtifacts(session.id);
    try {
      // Query the latest 50 messages in reverse chronological order
      const resp = await mobileP2P.sendRpc<any>('sessions.messages', {
        sessionId: session.id,
        limit: 50,
        offset: 0,
        order: 'desc',
      });

      const rawList = Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp?.messages)
        ? resp.messages
        : [];

      if (rawList.length > 0) {
        // Reverse array so messages appear in ascending chronological order (oldest to latest)
        const msgs: RealMessageItem[] = [...rawList].reverse().map((m: any) => ({
          id: m.id,
          role: m.role || 'user',
          content: m.content || '',
          reasoning: m.reasoning,
          timestamp: m.timestamp || new Date().toISOString(),
          toolCalls: m.toolCalls,
        }));
        set({
          sessionMessages: msgs,
          messagesOffset: rawList.length,
          hasMoreMessages: Boolean(resp?.hasMore),
        });
      } else {
        set({ sessionMessages: [], hasMoreMessages: false });
      }
    } catch (err) {
      console.error('[DaemonStore] selectSession error:', err);
    }
  },

  createNewSession: () => {
    set({
      activeSession: null,
      targetWorkspacePath: null,
      sessionMessages: [],
      sessionArtifacts: [],
      messagesOffset: 0,
      hasMoreMessages: false,
      isLoadingOlderMessages: false,
    });
  },

  loadOlderMessages: async () => {
    const { activeSession, messagesOffset, hasMoreMessages, isLoadingOlderMessages } = get();
    if (!activeSession || !hasMoreMessages || isLoadingOlderMessages) return;

    set({ isLoadingOlderMessages: true });
    try {
      const resp = await mobileP2P.sendRpc<any>('sessions.messages', {
        sessionId: activeSession.id,
        limit: 50,
        offset: messagesOffset,
        order: 'desc',
      });

      const rawList = Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp?.messages)
        ? resp.messages
        : [];

      if (rawList.length > 0) {
        // Reverse older slice into ascending order
        const olderMsgs: RealMessageItem[] = [...rawList].reverse().map((m: any) => ({
          id: m.id,
          role: m.role || 'user',
          content: m.content || '',
          reasoning: m.reasoning,
          timestamp: m.timestamp || new Date().toISOString(),
          toolCalls: m.toolCalls,
        }));

        set((state) => ({
          sessionMessages: [...olderMsgs, ...state.sessionMessages],
          messagesOffset: state.messagesOffset + rawList.length,
          hasMoreMessages: Boolean(resp?.hasMore),
          isLoadingOlderMessages: false,
        }));
      } else {
        set({ hasMoreMessages: false, isLoadingOlderMessages: false });
      }
    } catch (err) {
      console.error('[DaemonStore] loadOlderMessages error:', err);
      set({ isLoadingOlderMessages: false });
    }
  },

  sendPrompt: async (promptText: string) => {
    if (!promptText.trim()) return;
    const { activeSession, targetWorkspacePath, sessionConfig } = get();
    const effectiveCwd = activeSession?.workspacePath || targetWorkspacePath || undefined;

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
      const skipPermissions = sessionConfig.dangerouslySkipPermissions !== false;
      const runResult = await mobileP2P.sendRpc<any>('agent.run', {
        options: {
          prompt: promptText,
          sessionId: activeSession?.id,
          cwd: effectiveCwd,
          model: sessionConfig.model,
          effort: sessionConfig.effort,
          mode: sessionConfig.mode,
          dangerouslySkipPermissions: skipPermissions,
        },
        prompt: promptText,
        sessionId: activeSession?.id,
        cwd: effectiveCwd,
        model: sessionConfig.model,
        effort: sessionConfig.effort,
        mode: sessionConfig.mode,
        dangerouslySkipPermissions: skipPermissions,
      });
      set({ isSendingPrompt: false });

      // If this was a built-in CLI command (/usage, /models, /mcp, etc.),
      // the result was already rendered in real-time in sessionMessages!
      // Do not re-query or wipe session messages.
      if (runResult?.isCommand) {
        return;
      }

      // Automatically re-sync messages from disk transcript once turn completes
      if (activeSession) {
        const resp = await mobileP2P.sendRpc<any>('sessions.messages', {
          sessionId: activeSession.id,
          limit: 50,
          offset: 0,
          order: 'desc',
        });
        const rawList = Array.isArray(resp?.items)
          ? resp.items
          : Array.isArray(resp?.messages)
          ? resp.messages
          : [];
        if (rawList.length > 0) {
          const msgs: RealMessageItem[] = [...rawList].reverse().map((m: any) => ({
            id: m.id,
            role: m.role || 'user',
            content: m.content || '',
            reasoning: m.reasoning,
            timestamp: m.timestamp || new Date().toISOString(),
            toolCalls: m.toolCalls,
          }));
          // Guard: Only replace if disk has at least as many messages as local state
          set((state) => {
            if (msgs.length >= state.sessionMessages.length) {
              return {
                sessionMessages: msgs,
                messagesOffset: rawList.length,
                hasMoreMessages: Boolean(resp?.hasMore),
              };
            }
            return state;
          });
        }
      } else {
        // Newly initiated session: refresh sessions from disk transcripts
        await get().fetchSessions();
      }
      get().fetchSessionArtifacts();
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

  cancelPrompt: async () => {
    const { activeSession, isSendingPrompt } = get();
    if (!isSendingPrompt) return false;

    set({ isCancellingPrompt: true });
    try {
      const targetSessionId = activeSession?.id;
      if (targetSessionId) {
        await mobileP2P.sendRpc('agent.cancel', { sessionId: targetSessionId });
      }

      set((state) => ({
        isSendingPrompt: false,
        isCancellingPrompt: false,
        sessionMessages: [
          ...state.sessionMessages,
          {
            id: `cancel_${Date.now()}`,
            role: 'assistant',
            content: '⏹️ *Turn stopped by user.*',
            timestamp: new Date().toISOString(),
          },
        ],
      }));

      if (targetSessionId) {
        await get().fetchSessionArtifacts(targetSessionId);
      }
      return true;
    } catch (err) {
      console.error('[DaemonStore] cancelPrompt error:', err);
      set({ isSendingPrompt: false, isCancellingPrompt: false });
      return false;
    }
  },

  respondApproval: async (allowed: boolean) => {
    const { pendingApproval } = get();
    if (!pendingApproval) return;

    try {
      await mobileP2P.sendRpc('agent.approve', {
        approvalId: pendingApproval.id,
        requestId: pendingApproval.id,
        sessionId: pendingApproval.sessionId || get().activeSession?.id,
        allowed,
        allow: allowed,
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

  setServerEndpoints: async ({ apiUrl, gatewayUrl }: { apiUrl: string; gatewayUrl: string }) => {
    const cleanApi = apiUrl.trim().replace(/\/$/, '');
    const cleanGateway = gatewayUrl.trim().replace(/\/$/, '');
    await setStorageItem(STORAGE_KEY_API, cleanApi);
    await setStorageItem(STORAGE_KEY_GATEWAY, cleanGateway);
    set({ apiUrl: cleanApi, gatewayUrl: cleanGateway });

    try {
      mobileP2P.disconnect();
    } catch {
      // ignore
    }
    if (get().token) { await get().connectGateway(); }
  },

  resetServerEndpoints: async () => {
    await removeStorageItem(STORAGE_KEY_API);
    await removeStorageItem(STORAGE_KEY_GATEWAY);
    const defApi = envApiUrl || `http://${defaultHost}:8000`;
    const defGateway = envGatewayUrl || `http://${defaultHost}:8080`;
    set({ apiUrl: defApi, gatewayUrl: defGateway });
    try {
      mobileP2P.disconnect();
    } catch {
      // ignore
    }
    if (get().token) { await get().connectGateway(); }
  },

  testServerEndpoints: async (apiUrl: string, gatewayUrl: string): Promise<EndpointTestResult> => {
    const cleanApi = apiUrl.trim().replace(/\/$/, '');
    const cleanGateway = gatewayUrl.trim().replace(/\/$/, '');

    let apiOk = false;
    let apiLatencyMs: number | undefined;
    let apiError: string | undefined;

    let gatewayOk = false;
    let gatewayLatencyMs: number | undefined;
    let connectedDaemons: number | undefined;
    let gatewayError: string | undefined;

    // Test API (only if distinct from gateway)
    if (cleanApi && cleanApi !== cleanGateway) {
      const startApi = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`${cleanApi}/docs`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        apiLatencyMs = Date.now() - startApi;
        apiOk = res.ok || res.status === 404 || res.status === 401;
      } catch (e: any) {
        apiError = e?.message || 'Connection failed';
      }
    } else {
      apiOk = true;
    }

    // Test Gateway
    const startGw = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${cleanGateway}/health`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      gatewayLatencyMs = Date.now() - startGw;
      if (res.ok) {
        const data = await res.json();
        gatewayOk = true;
        connectedDaemons = typeof data.connectedDaemons === 'number' ? data.connectedDaemons : 0;
      } else {
        gatewayOk = res.status < 500;
      }
    } catch (e: any) {
      gatewayError = e?.message || 'Connection failed';
    }

    return {
      apiOk,
      apiLatencyMs,
      apiError,
      gatewayOk,
      gatewayLatencyMs,
      connectedDaemons,
      gatewayError,
    };
  },
}));
