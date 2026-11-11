import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  StatusBar,
  Modal,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as ReanimatedEasing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Clock,
  MoreVertical,
  Menu as MenuIcon,
  Terminal,
  Link,
  FileText,
  FileCode,
  FolderGit2,
  GitFork,
  ArrowDown,
  Sparkles,
  Search,
  Brain,
  SlidersHorizontal,
  Command,
  Plus,
  Mic,
  Layers,
  Square,
  Wrench,
  Copy,
  X,
  Pin,
  Pencil,
  Trash2,
  GitBranch,
  BookOpen,
} from '../components/Icons';
import { colors, radii, typography, getThemeColors, getGlossyHeaderTokens } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';
import {
  Menu,
  AIInput,
  Reasoning,
  Response,
  ThinkingOrb,
  Shimmer,
  Spinner,
  toast,
} from 'panelui-native';
import { ToolActionTray, type ActionStep } from '../components/ToolActionTray';
import { SlashCommandPicker, type SlashCommandItem } from '../components/SlashCommandPicker';
import { SessionConfigSheet } from '../components/SessionConfigSheet';
import { TerminalSheet } from '../components/TerminalSheet';
import { LiveApprovalCard } from '../components/LiveApprovalCard';
import { ArtifactsSheet } from '../components/ArtifactsSheet';
import { AutoHealerModal } from '../components/AutoHealerModal';
import { AskQuestionCard } from '../components/AskQuestionCard';
import { startDictation, stopDictation, isSpeechRecognitionSupported } from '../lib/speech';

interface AgentTurnScreenProps {
  onBack?: () => void;
  onOpenDrawer?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export type AssistantTurnElement =
  | { type: 'reasoning'; id: string; text: string }
  | { type: 'action'; id: string; action: ActionStep }
  | { type: 'content'; id: string; text: string };

interface ChatTurn {
  id: string;
  userMessage?: {
    id: string;
    content: string;
    timestamp?: string;
  };
  assistant?: {
    id: string;
    timestamp?: string;
    reasoning?: string;
    actions: ActionStep[];
    content?: string;
    elements: AssistantTurnElement[];
  };
}

export const AgentTurnScreen: React.FC<AgentTurnScreenProps> = ({
  onBack,
  onOpenDrawer,
  onNavigateTab,
}) => {
  const activeSession = useDaemonStore((s) => s.activeSession);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const sessionConfig = useDaemonStore((s) => s.sessionConfig);
  const sessionMessages = useDaemonStore((s) => s.sessionMessages);
  const isSendingPrompt = useDaemonStore((s) => s.isSendingPrompt);
  const isCancellingPrompt = useDaemonStore((s) => s.isCancellingPrompt);
  const sendPrompt = useDaemonStore((s) => s.sendPrompt);
  const cancelPrompt = useDaemonStore((s) => s.cancelPrompt);
  const hasMoreMessages = useDaemonStore((s) => s.hasMoreMessages);
  const isLoadingOlderMessages = useDaemonStore((s) => s.isLoadingOlderMessages);
  const isLoadingMessages = useDaemonStore((s) => s.isLoadingMessages);
  const connectionState = useDaemonStore((s) => s.connectionState);
  const isNetworkOnline = useDaemonStore((s) => s.isNetworkOnline);
  const loadOlderMessages = useDaemonStore((s) => s.loadOlderMessages);
  const pendingApproval = useDaemonStore((s) => s.pendingApproval);
  const respondApproval = useDaemonStore((s) => s.respondApproval);
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);
  const sessionArtifacts = useDaemonStore((s) => s.sessionArtifacts);
  const fetchSessionArtifacts = useDaemonStore((s) => s.fetchSessionArtifacts);
  const isAutoHealerModalVisible = useDaemonStore((s) => s.isAutoHealerModalVisible);
  const dismissAutoHealer = useDaemonStore((s) => s.dismissAutoHealer);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const glossyHeader = useMemo(() => getGlossyHeaderTokens(isLight), [isLight]);

  const [promptInput, setPromptInput] = useState('');
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showArtifactsSheet, setShowArtifactsSheet] = useState(false);
  const [artifactFilterQuery, setArtifactFilterQuery] = useState('');
  const [isRenamingSession, setIsRenamingSession] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [isRespondingApproval, setIsRespondingApproval] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  useEffect(() => {
    return () => {
      stopDictation();
    };
  }, []);

  const handleToggleDictation = async () => {
    if (isDictating) {
      stopDictation();
      setIsDictating(false);
      return;
    }

    const basePrompt = promptInput.trim();
    setIsDictating(true);

    await startDictation({
      onStart: () => {
        setIsDictating(true);
      },
      onResult: (transcript) => {
        const full = basePrompt ? `${basePrompt} ${transcript}` : transcript;
        setPromptInput(full);
      },
      onError: (err) => {
        setIsDictating(false);
        toast.show({
          variant: 'destructive',
          label: 'Voice Dictation Error',
          description: err,
        });
      },
      onEnd: () => {
        setIsDictating(false);
      },
    });
  };
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardAnim = useSharedValue(0);

  const isKeyboardActive = keyboardHeight > 0;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const rawKbH = e.endCoordinates ? e.endCoordinates.height : 0;
      setKeyboardHeight(rawKbH);

      // On iOS, window does not resize, so animate translateY by rawKbH.
      // On Android, windowSoftInputMode="adjustResize" automatically resizes the window,
      // so translateY is kept at 0 to avoid double spacing.
      if (Platform.OS === 'ios') {
        keyboardAnim.value = withTiming(rawKbH, {
          duration: e.duration || 250,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        });
      }

      if (isNearBottomRef.current) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardHeight(0);
      if (Platform.OS === 'ios') {
        keyboardAnim.value = withTiming(0, {
          duration: e?.duration || 200,
          easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
        });
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAnim]);

  const animatedKeyboardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboardAnim.value }],
  }));

  const handleSaveRename = async () => {
    if (!activeSession || !renameTitle.trim() || isSavingRename) return;
    setIsSavingRename(true);
    try {
      await renameSession(activeSession.id, renameTitle.trim());
      setIsRenamingSession(false);
      toast.show({
        variant: 'success',
        label: 'Session Renamed',
        description: renameTitle.trim(),
        duration: 2500,
      });
    } finally {
      setIsSavingRename(false);
    }
  };

  const [openTurnAccordions, setOpenTurnAccordions] = useState<Record<string, boolean>>({});
  const [selectedActionForTray, setSelectedActionForTray] = useState<ActionStep | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);
  const scrollViewRef = useRef<any>(null);

  // Auto-scrolling state & throttle controls during live agent writing
  const isAutoScrollPausedRef = useRef<boolean>(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<any>(null);

  // Vercel v0 Pattern: Dynamic Floating Composer Height & Upward Expansion Auto-Scroll
  const [composerMeasuredHeight, setComposerMeasuredHeight] = useState<number>(64);
  const prevComposerHeightRef = useRef<number>(64);
  const isNearBottomRef = useRef<boolean>(true);
  const currentScrollYRef = useRef<number>(0);

  // Vercel v0 Pattern: User Prompt Top-Pinning Invariant
  const userJustSubmittedRef = useRef<boolean>(false);
  const activePromptTurnIndexRef = useRef<number>(-1);
  const activePromptLayoutYRef = useRef<number>(0);

  // Infinite Scroll & Synchronous Scroll Compensation Refs
  const isFetchingOlderRef = useRef<boolean>(false);
  const isPrependPendingRef = useRef<boolean>(false);
  const prevScrollHeightRef = useRef<number>(0);
  const anchorScrollYRef = useRef<number>(0);
  const anchorTurnIdRef = useRef<string | null>(null);
  const anchorTurnOldYRef = useRef<number>(0);
  const turnYPositionsRef = useRef<Map<string, number>>(new Map());
  const liveScrollYRef = useRef<number>(0);
  const lastContentHeightRef = useRef<number>(0);
  const hasInitialScrolledRef = useRef<string | null>(null);
  const displayedTurnsRef = useRef<any[]>([]);

  // Initial scroll to bottom when session messages load
  useEffect(() => {
    if (activeSession?.id && sessionMessages.length > 0 && !isLoadingMessages) {
      if (hasInitialScrolledRef.current !== activeSession.id) {
        hasInitialScrolledRef.current = activeSession.id;
        turnYPositionsRef.current.clear();
        isPrependPendingRef.current = false;
        anchorTurnIdRef.current = null;
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 120);
      }
    }
  }, [activeSession?.id, sessionMessages.length, isLoadingMessages]);

  const handleComposerLayout = (event: any) => {
    const newHeight = Math.round(event.nativeEvent.layout.height);
    if (newHeight > 0 && Math.abs(newHeight - prevComposerHeightRef.current) > 2) {
      const delta = newHeight - prevComposerHeightRef.current;
      prevComposerHeightRef.current = newHeight;
      setComposerMeasuredHeight(newHeight);

      // Vercel v0 Pattern: If user is reading near the bottom, compensate scroll offset so content never gets covered
      if (isNearBottomRef.current && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          y: Math.max(0, currentScrollYRef.current + delta),
          animated: true,
        });
      }
    }
  };

  const pauseAutoScroll = () => {
    if (isSendingPrompt && !isAutoScrollPausedRef.current) {
      isAutoScrollPausedRef.current = true;
      setIsAutoScrollPaused(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }
  };

  const resumeAutoScroll = () => {
    if (isAutoScrollPausedRef.current) {
      isAutoScrollPausedRef.current = false;
      setIsAutoScrollPaused(false);
    }
  };

  const triggerAutoScroll = () => {
    if (!isSendingPrompt || isAutoScrollPausedRef.current) return;
    const now = Date.now();
    // Throttle to 50ms so rapid stream chunks scroll smoothly without JS thread choking
    if (now - lastScrollTimeRef.current < 50) {
      if (!scrollTimeoutRef.current) {
        scrollTimeoutRef.current = setTimeout(() => {
          scrollTimeoutRef.current = null;
          if (isSendingPrompt && !isAutoScrollPausedRef.current) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
            lastScrollTimeRef.current = Date.now();
          }
        }, 50);
      }
      return;
    }
    lastScrollTimeRef.current = now;
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const triggerLoadOlderMessages = useCallback(async () => {
    if (
      !hasMoreMessages ||
      isLoadingOlderMessages ||
      isFetchingOlderRef.current ||
      !activeSession?.id
    ) {
      return;
    }

    isFetchingOlderRef.current = true;

    // Snapshot current scroll offset & top turn anchor BEFORE store mutation
    isPrependPendingRef.current = true;
    prevScrollHeightRef.current = lastContentHeightRef.current;
    anchorScrollYRef.current = liveScrollYRef.current;

    const firstTurn = displayedTurnsRef.current[0];
    if (firstTurn) {
      anchorTurnIdRef.current = firstTurn.id || null;
      anchorTurnOldYRef.current = turnYPositionsRef.current.get(firstTurn.id) ?? 0;
    } else {
      anchorTurnIdRef.current = null;
      anchorTurnOldYRef.current = 0;
    }

    try {
      await loadOlderMessages();
    } finally {
      setTimeout(() => {
        isFetchingOlderRef.current = false;
      }, 500);
    }
  }, [hasMoreMessages, isLoadingOlderMessages, activeSession?.id, loadOlderMessages]);

  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event?.nativeEvent || event || {};
    if (!contentOffset || !layoutMeasurement || !contentSize) return;
    currentScrollYRef.current = contentOffset.y;
    liveScrollYRef.current = contentOffset.y;
    lastContentHeightRef.current = contentSize.height;

    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const isNear = distanceFromBottom <= 45;
    isNearBottomRef.current = isNear;

    const isScrolledUp = distanceFromBottom > 140 && contentOffset.y > 60;
    setShowScrollToBottom(isScrolledUp);

    // If user scrolled back down near the bottom (within 45px), resume auto-scroll
    if (isNear) {
      resumeAutoScroll();
    } else if (distanceFromBottom > 80 && isSendingPrompt) {
      // User scrolled up away from the bottom while agent is writing
      pauseAutoScroll();
    }

    // Smooth Infinite scroll: trigger when user scrolls near the top (< 120px) and not bouncing negatively
    if (
      contentOffset.y <= 120 &&
      contentOffset.y >= 0 &&
      hasMoreMessages &&
      !isLoadingOlderMessages &&
      !isFetchingOlderRef.current &&
      contentSize.height > layoutMeasurement.height
    ) {
      triggerLoadOlderMessages();
    }
  };

  const handleScrollToBottom = () => {
    resumeAutoScroll();
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Reset auto-scroll pause when prompt execution finishes
  useEffect(() => {
    if (!isSendingPrompt) {
      resumeAutoScroll();
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }
  }, [isSendingPrompt]);

  // When new messages or streaming chunks update, auto-scroll to latest token if not paused by user
  const lastMsg = sessionMessages[sessionMessages.length - 1];
  const lastMsgLen =
    (typeof lastMsg?.content === 'string' ? lastMsg.content.length : 0) +
    (typeof lastMsg?.reasoning === 'string' ? lastMsg.reasoning.length : 0) +
    (lastMsg?.toolCalls?.length || 0);

  useEffect(() => {
    if (isSendingPrompt && !isAutoScrollPausedRef.current) {
      triggerAutoScroll();
    }
  }, [sessionMessages.length, lastMsgLen, isSendingPrompt]);

  const isTurnOpen = (turnId: string) => openTurnAccordions[turnId] ?? true;

  const toggleTurnAccordion = (turnId: string) => {
    setOpenTurnAccordions((prev) => ({
      ...prev,
      [turnId]: !isTurnOpen(turnId),
    }));
  };

  const handleCopyTurnText = (turnId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedTurnId(turnId);
    toast.show({
      variant: 'default',
      label: 'Message copied to clipboard',
      duration: 2000,
    });
    setTimeout(() => {
      setCopiedTurnId(null);
    }, 1500);
  };

  const handleInputChange = (text: string) => {
    setPromptInput(text);
    if (text.startsWith('/')) {
      setShowCommandPicker(true);
    } else if (showCommandPicker && !text.includes('/')) {
      setShowCommandPicker(false);
    }
  };

  const handleSelectCommand = (item: SlashCommandItem, immediate?: boolean) => {
    setShowCommandPicker(false);
    if (item.command === '/artifact' || item.command === '/artifacts') {
      setPromptInput('');
      setArtifactFilterQuery('');
      setShowArtifactsSheet(true);
      fetchSessionArtifacts().catch(() => {});
      return;
    }
    if (immediate) {
      setPromptInput('');
      sendPrompt(item.template);
    } else {
      setPromptInput(item.template);
    }
  };

  const handleSendPrompt = async () => {
    if (!promptInput.trim() || isSendingPrompt) return;

    if (!isNetworkOnline) {
      toast.show({
        variant: 'warning',
        label: 'Network Offline',
        description: 'Cannot send message while offline. Please check your network connection.',
      });
      return;
    }

    const text = promptInput;
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // Client-side interception of /artifact and /artifacts commands
    if (lower === '/artifact' || lower === '/artifacts') {
      setPromptInput('');
      setArtifactFilterQuery('');
      setShowArtifactsSheet(true);
      fetchSessionArtifacts().catch(() => {});
      return;
    }
    if (lower.startsWith('/artifact ') || lower.startsWith('/artifacts ')) {
      const q = trimmed.replace(/^\/artifacts?\s+/i, '');
      setPromptInput('');
      setArtifactFilterQuery(q);
      setShowArtifactsSheet(true);
      fetchSessionArtifacts().catch(() => {});
      return;
    }

    // Vercel v0 Pattern: Activate user prompt top-pinning on the new turn
    userJustSubmittedRef.current = true;
    activePromptTurnIndexRef.current = displayedTurns.length;

    setPromptInput('');
    resumeAutoScroll();
    await sendPrompt(text);
  };

  const formatTimeAgo = (isoDate?: string) => {
    if (!isoDate) return '1 hour ago';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    if (isNaN(diffMs)) return '1 hour ago';
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays} hour${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const workspaceTitle =
    activeSession?.workspaceName ||
    (targetWorkspacePath ? targetWorkspacePath.split(/[\\/]/).pop() || null : null) ||
    activeSession?.title ||
    'Workspace';
  const modelStr = activeSession?.model || sessionConfig.model.split('-')[0] || 'antigravity';

  // Group linear chronological messages into sequential chat turns matching Antigravity flow
  const chatTurns = useMemo<ChatTurn[]>(() => {
    if (!sessionMessages || sessionMessages.length === 0) {
      return [];
    }

    const formatFilePath = (p: string) => {
      const clean = p.replace(/^"|"$/g, '').replace(/\\/g, '/');
      const parts = clean.split('/');
      return parts.length > 3 ? parts.slice(-3).join('/') : clean;
    };

    const turns: ChatTurn[] = [];
    let currentTurn: ChatTurn | null = null;

    for (let i = 0; i < sessionMessages.length; i++) {
      const msg = sessionMessages[i];

      if (msg.role === 'user') {
        currentTurn = {
          id: msg.id || `turn_${i}`,
          userMessage: {
            id: msg.id || `usr_${i}`,
            content: msg.content,
            timestamp: msg.timestamp,
          },
        };
        turns.push(currentTurn);
      } else if (msg.role === 'assistant') {
        if (!currentTurn) {
          currentTurn = {
            id: msg.id || `turn_${i}`,
          };
          turns.push(currentTurn);
        }

        if (!currentTurn.assistant) {
          currentTurn.assistant = {
            id: msg.id || `asst_${i}`,
            timestamp: msg.timestamp,
            actions: [],
            content: '',
            reasoning: '',
            elements: [],
          };
        }

        const asstObj = currentTurn.assistant;

        // 1. Process reasoning
        if (msg.reasoning && msg.reasoning.trim()) {
          asstObj.reasoning = asstObj.reasoning
            ? asstObj.reasoning + '\n' + msg.reasoning
            : msg.reasoning;

          const existingReasoning = asstObj.elements.find(
            (el) => el.type === 'reasoning' && el.id.startsWith(`${msg.id || i}_reasoning`)
          );
          if (existingReasoning && existingReasoning.type === 'reasoning') {
            existingReasoning.text = msg.reasoning;
          } else {
            asstObj.elements.push({
              type: 'reasoning',
              id: `${msg.id || i}_reasoning_${asstObj.elements.length}`,
              text: msg.reasoning,
            });
          }
        }

        // 2. Process tool calls made in this assistant step
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach((tc, tcIdx) => {
            const name = tc.name || '';
            const args = tc.arguments || {};
            let category: ActionStep['category'] = 'terminal';

            if (
              name === 'edit_file' ||
              name === 'write_file' ||
              name === 'create_file' ||
              name === 'patch_file'
            ) {
              category = 'edit';
            } else if (
              name === 'read_file' ||
              name === 'view_file' ||
              name.includes('file')
            ) {
              category = 'file';
            } else if (name.includes('mcp') || name.startsWith('mcp_') || name === 'call_mcp_tool') {
              category = 'mcp';
            } else if (
              name.includes('subagent') ||
              name.includes('skill') ||
              name === 'schedule' ||
              name === 'ask_question' ||
              name === 'send_message'
            ) {
              category = 'skill';
            } else if (name.includes('search') || name === 'search_web' || args.query) {
              category = 'search';
            }

            const cmd = args.CommandLine ? String(args.CommandLine).replace(/^"|"$/g, '').trim() : '';
            if (cmd.startsWith('git ') || name.includes('git')) {
              category = 'git';
            }

            // Correlate with tool output
            let toolOutput: string | undefined =
              typeof tc.result === 'string'
                ? tc.result
                : tc.result
                ? JSON.stringify(tc.result, null, 2)
                : undefined;

            if (!toolOutput) {
              for (let nextIdx = i + 1; nextIdx < sessionMessages.length; nextIdx++) {
                const nextMsg = sessionMessages[nextIdx];
                if (nextMsg.role === 'tool') {
                  toolOutput = nextMsg.content;
                  break;
                }
                if (nextMsg.role === 'user' || nextMsg.role === 'assistant') {
                  break;
                }
              }
            }

            let title = `Execute ${name}`;
            if (args.toolSummary) {
              title = String(args.toolSummary).replace(/^"|"$/g, '');
            } else if (category === 'git' && cmd) {
              if (cmd.startsWith('git checkout ')) {
                title = `Checked out ${cmd.replace('git checkout ', '').trim()}`;
              } else if (cmd.startsWith('git switch ')) {
                title = `Switched to ${cmd.replace('git switch ', '').trim()}`;
              } else if (cmd.startsWith('git branch ')) {
                title = `Branch ${cmd.replace('git branch ', '').trim()}`;
              } else if (cmd.startsWith('git clone ')) {
                title = `Cloned ${cmd.replace('git clone ', '').trim()}`;
              } else {
                title = `Git ${cmd.replace(/^git\s+/, '')}`;
              }
            } else if (name === 'read_file' || name === 'view_file') {
              const filePath = args.Path || args.AbsolutePath || '';
              title = filePath ? `Read ${formatFilePath(String(filePath))}` : 'Read file';
            } else if (name === 'edit_file') {
              const filePath = args.Path || args.AbsolutePath || '';
              title = filePath ? `Edited ${formatFilePath(String(filePath))}` : 'Edited file';
            } else if (name === 'write_file' || name === 'create_file') {
              const filePath = args.Path || args.AbsolutePath || '';
              title = filePath ? `Created ${formatFilePath(String(filePath))}` : 'Created file';
            } else if (cmd) {
              const shortCmd = cmd.length > 45 ? `${cmd.slice(0, 42)}...` : cmd;
              title = `Ran ${shortCmd}`;
            } else if (name.includes('search') || args.query) {
              title = `Searched for ${String(args.query || 'query').replace(/^"|"$/g, '')}`;
            } else if (args.ServerName && args.ToolName) {
              title = `MCP: ${args.ServerName} / ${args.ToolName}`;
            } else if (args.Path || args.AbsolutePath) {
              title = `${name}: ${formatFilePath(String(args.Path || args.AbsolutePath))}`;
            }

            let exitCode: number | undefined;
            if (toolOutput) {
              const exitMatch = /(?:exited\s+with\s+code\s+|exit\s+code\s+)(\d+)/i.exec(toolOutput);
              if (exitMatch) {
                exitCode = parseInt(exitMatch[1], 10);
              }
            }

            const actionStep: ActionStep = {
              id: `action_${tc.id || `${i}_${tcIdx}`}`,
              title,
              category,
              toolName: name,
              hasDetails: true,
              args,
              output: toolOutput,
              status: tc.status || (exitCode === undefined || exitCode === 0 ? 'success' : 'error'),
              exitCode,
              details: toolOutput || (typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)),
            };

            const existingActionIdx = asstObj.actions.findIndex((a) => a.id === actionStep.id);
            if (existingActionIdx >= 0) {
              asstObj.actions[existingActionIdx] = actionStep;
            } else {
              asstObj.actions.push(actionStep);
            }

            const existingEl = asstObj.elements.find(
              (el) => el.type === 'action' && el.action.id === actionStep.id
            );
            if (existingEl && existingEl.type === 'action') {
              existingEl.action = actionStep;
            } else {
              asstObj.elements.push({
                type: 'action',
                id: `${actionStep.id}_${asstObj.elements.length}`,
                action: actionStep,
              });
            }
          });
        }

        // 3. Process content
        if (msg.content && msg.content.trim()) {
          asstObj.content = asstObj.content
            ? asstObj.content + '\n' + msg.content
            : msg.content;

          const existingContent = asstObj.elements.find(
            (el) => el.type === 'content' && el.id.startsWith(`${msg.id || i}_content`)
          );
          if (existingContent && existingContent.type === 'content') {
            existingContent.text = msg.content;
          } else {
            asstObj.elements.push({
              type: 'content',
              id: `${msg.id || i}_content_${asstObj.elements.length}`,
              text: msg.content,
            });
          }
        }
      }
    }

    return turns;
  }, [sessionMessages]);

  const liveSelectedAction = useMemo(() => {
    if (!selectedActionForTray) return null;
    for (const turn of chatTurns) {
      if (turn.assistant?.actions) {
        const found = turn.assistant.actions.find((a) => a.id === selectedActionForTray.id);
        if (found) return found;
      }
    }
    return selectedActionForTray;
  }, [chatTurns, selectedActionForTray]);

  const displayedTurns = chatTurns;
  displayedTurnsRef.current = displayedTurns;

  const renderActionIcon = (category: ActionStep['category']) => {
    const iconColor = isLight ? '#57606a' : '#c9d1d9';
    switch (category) {
      case 'git':
      case 'repo':
        return <GitBranch size={15} color={iconColor} />;
      case 'search':
        return <Search size={15} color={iconColor} />;
      case 'edit':
        return <Pencil size={14} color={iconColor} />;
      case 'file':
        return <FileText size={15} color={iconColor} />;
      case 'mcp':
        return <BookOpen size={15} color={iconColor} />;
      case 'skill':
        return <GitFork size={15} color={iconColor} />;
      case 'terminal':
      default:
        return <Terminal size={15} color={iconColor} />;
    }
  };

  return (
    <View style={[styles.container, isLight && { backgroundColor: '#ffffff' }]}>
      {/* 0. Top Notch Background (Covers physical notch/status bar while keeping the header transparent without borders) */}
      {topInset > 0 && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: topInset,
            backgroundColor: isLight ? '#ffffff' : '#141414',
            zIndex: 15,
          }}
          pointerEvents="none"
        />
      )}

      {/* 1. Clean Minimal Header (No borders, circular left button, centered title, circular three-dots button) */}
      <View
        style={[
          styles.cleanHeaderContainer,
          { paddingTop: topInset + (Platform.OS === 'ios' ? 6 : 8) },
        ]}
        pointerEvents="box-none"
      >
        {/* Left: Circular Menu Button */}
        <TouchableOpacity
          style={[
            styles.cleanCircleBtn,
            glossyHeader.containerStyle,
          ]}
          onPress={() => {
            if (onOpenDrawer) {
              onOpenDrawer();
            } else if (onBack) {
              onBack();
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Open Menu Drawer"
        >
          <MenuIcon size={24} color={glossyHeader.iconColor} />
        </TouchableOpacity>

        {/* Center: Clean Title (No pill container, no borders) */}
        <View style={styles.cleanHeaderCenter} pointerEvents="box-none">
          <Text
            style={[
              styles.cleanHeaderTitle,
              isLight && { color: '#1f2328' },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {workspaceTitle}
          </Text>
        </View>

        {/* Right: Circular Three Dots Action Button with PanelUI Dropdown Menu */}
        <Menu>
          <Menu.Trigger>
            <TouchableOpacity
              style={[
                styles.cleanCircleBtn,
                glossyHeader.containerStyle,
              ]}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Session Actions"
            >
              <MoreVertical size={24} color={glossyHeader.iconColor} />
            </TouchableOpacity>
          </Menu.Trigger>

          <Menu.Content align="end" minWidth={240}>
            <Menu.Item
              icon={<SlidersHorizontal size={18} color={isLight ? '#1f2328' : '#fafafa'} />}
              description="Model, thinking, temperature"
              onSelect={() => setShowConfigSheet(true)}
            >
              Session Parameters
            </Menu.Item>

            <Menu.Item
              icon={<Layers size={18} color={isLight ? '#1f2328' : '#fafafa'} />}
              description={
                sessionArtifacts.length > 0
                  ? `${sessionArtifacts.length} generated artifact${sessionArtifacts.length === 1 ? '' : 's'}`
                  : 'View session outputs'
              }
              trailing={
                sessionArtifacts.length > 0 ? (
                  <View style={[styles.dropdownBadge, isLight && { backgroundColor: '#0077b6' }]}>
                    <Text style={styles.dropdownBadgeText}>{sessionArtifacts.length}</Text>
                  </View>
                ) : undefined
              }
              onSelect={() => {
                setArtifactFilterQuery('');
                setShowArtifactsSheet(true);
                fetchSessionArtifacts().catch(() => {});
              }}
            >
              Artifacts
            </Menu.Item>

            <Menu.Item
              icon={<Terminal size={18} color={isLight ? '#1f2328' : '#fafafa'} />}
              description="Live interactive shell"
              onSelect={() => setShowTerminal(true)}
            >
              Terminal / PTY
            </Menu.Item>

            <Menu.Separator />

            {activeSession && (
              <Menu.Item
                icon={<Pin size={18} color={activeSession.pinned ? '#0077b6' : (isLight ? '#57606a' : '#a3a3a3')} />}
                onSelect={async () => {
                  await togglePinSession(activeSession.id);
                }}
              >
                {activeSession.pinned ? 'Unpin Session' : 'Pin Session'}
              </Menu.Item>
            )}

            {activeSession && (
              <Menu.Item
                icon={<Pencil size={18} color={isLight ? '#57606a' : '#a3a3a3'} />}
                onSelect={() => {
                  setRenameTitle(activeSession.title);
                  setIsRenamingSession(true);
                }}
              >
                Rename Session
              </Menu.Item>
            )}

            {activeSession && <Menu.Separator />}

            {activeSession && (
              <Menu.Item
                variant="destructive"
                icon={<Trash2 size={18} color="#ef4444" />}
                onSelect={() => {
                  Alert.alert(
                    'Delete Session',
                    `Are you sure you want to delete "${activeSession.title}"? This will permanently remove its transcript from the host machine.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteSession(activeSession.id);
                        },
                      },
                    ]
                  );
                }}
              >
                Delete Session
              </Menu.Item>
            )}
          </Menu.Content>
        </Menu>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scroll, isLight && { backgroundColor: '#ffffff' }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + (Platform.OS === 'ios' ? 60 : 56),
            paddingBottom:
              composerMeasuredHeight +
              Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10) +
              (Platform.OS === 'ios' ? keyboardHeight : 0) +
              18,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onTouchStart={pauseAutoScroll}
        onScrollBeginDrag={pauseAutoScroll}
        onContentSizeChange={(_w, h) => {
          const previousHeight = lastContentHeightRef.current;
          lastContentHeightRef.current = h;

          if (isPrependPendingRef.current && previousHeight > 0) {
            const heightDelta = h - previousHeight;
            if (heightDelta > 0) {
              const targetY = anchorScrollYRef.current + heightDelta;
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated: false,
              });
              liveScrollYRef.current = targetY;
              currentScrollYRef.current = targetY;
            }
            isPrependPendingRef.current = false;
            anchorTurnIdRef.current = null;
          }

          if (isSendingPrompt && !isAutoScrollPausedRef.current) {
            triggerAutoScroll();
          }
        }}
      >

        {/* Infinite Scroll / Top Pagination Header */}
        {hasMoreMessages ? (
          <View style={styles.paginationHeaderContainer}>
            {isLoadingOlderMessages ? (
              <View style={styles.paginationLoadingRow}>
                <Spinner size="sm" />
                <Text style={[styles.paginationLoadingText, isLight && { color: '#57606a' }]}>
                  Loading earlier messages…
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.loadOlderButton,
                  isLight && { backgroundColor: '#f6f8fa', borderColor: '#d0d7de' },
                ]}
                onPress={triggerLoadOlderMessages}
                activeOpacity={0.7}
              >
                <Clock size={13} color={isLight ? '#57606a' : '#8b949e'} />
                <Text style={[styles.loadOlderButtonText, isLight && { color: '#57606a' }]}>
                  Load earlier messages
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : displayedTurns.length > 0 ? (
          <View style={styles.transcriptStartContainer}>
            <View style={[styles.transcriptStartDivider, isLight && { backgroundColor: '#e1e4e8' }]} />
            <View style={[styles.transcriptStartBadge, isLight && { backgroundColor: '#f6f8fa', borderColor: '#d0d7de' }]}>
              <Terminal size={11} color={isLight ? '#57606a' : '#8b949e'} />
              <Text style={[styles.transcriptStartText, isLight && { color: '#57606a' }]}>
                Beginning of session
              </Text>
            </View>
            <View style={[styles.transcriptStartDivider, isLight && { backgroundColor: '#e1e4e8' }]} />
          </View>
        ) : null}

        {/* 4. Turn-by-Turn Timeline (Paradev OutgoingBubble & AgentMessage) */}
        {isLoadingMessages ? (
          <View style={styles.sessionLoadingBox}>
            <View style={[styles.sessionLoadingCard, isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' }]}>
              <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#fafafa'} />
              <Text style={[styles.sessionLoadingText, isLight && { color: '#57606a' }]}>Loading session transcript...</Text>
            </View>
          </View>
        ) : displayedTurns.length === 0 ? (
          <View style={styles.emptyChatBox}>
            <View style={[styles.emptyChatIconBox, isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' }]}>
              <Terminal size={22} color={isLight ? '#0077b6' : '#fafafa'} />
            </View>
            <Text style={[styles.emptyChatTitle, isLight && { color: '#1f2328' }]}>No messages in this session yet</Text>
            <Text style={[styles.emptyChatSubtitle, isLight && { color: '#57606a' }]}>
              Send a prompt below to interact with the Antigravity agent runtime.
            </Text>
          </View>
        ) : (
          displayedTurns.map((turn, turnIdx) => (
            <View
              key={turn.id || turnIdx}
              style={styles.turnCardContainer}
              onLayout={(e) => {
                const turnY = e.nativeEvent.layout.y;
                turnYPositionsRef.current.set(turn.id, turnY);

                if (isPrependPendingRef.current && anchorTurnIdRef.current === turn.id) {
                  const oldY = anchorTurnOldYRef.current;
                  if (turnY > oldY) {
                    const shift = turnY - oldY;
                    const targetY = anchorScrollYRef.current + shift;
                    scrollViewRef.current?.scrollTo({ y: targetY, animated: false });
                    liveScrollYRef.current = targetY;
                    currentScrollYRef.current = targetY;
                    isPrependPendingRef.current = false;
                    anchorTurnIdRef.current = null;
                  }
                }

                if (turnIdx === activePromptTurnIndexRef.current && userJustSubmittedRef.current) {
                  userJustSubmittedRef.current = false;
                  activePromptLayoutYRef.current = turnY;
                  // Vercel v0 Pattern: Smoothly anchor the user prompt comfortably below the header
                  const targetY = Math.max(0, turnY - (topInset + 52));
                  scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
                }
              }}
            >
              {/* User Prompt: Paradev OutgoingBubble */}
              {turn.userMessage?.content ? (
                <View style={styles.userBubbleWrapper}>
                  <View
                    style={[
                      styles.userOutgoingBubble,
                      isLight && {
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#d0d7de',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.05,
                        shadowRadius: 3,
                        elevation: 1,
                      },
                    ]}
                  >
                    <Text style={[styles.userBubbleText, isLight && { color: '#1f2328' }]}>{turn.userMessage.content}</Text>
                  </View>
                  <View style={styles.userBubbleMeta}>
                    <Text style={[styles.userBubbleMetaText, isLight && { color: '#8c959f' }]}>
                      {turn.userMessage.timestamp
                        ? formatTimeAgo(turn.userMessage.timestamp)
                        : `turn #${turnIdx + 1}`}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Assistant Turn: Natural Borderless Flow matching Reference */}
              {turn.assistant ? (
                <View style={styles.assistantTurnWrapper}>
                  {/* Sequential chronological stream elements (Thoughts, Tool Actions, Markdown resolution) */}
                  {turn.assistant.elements && turn.assistant.elements.length > 0 ? (
                    turn.assistant.elements.map((element) => {
                      if (element.type === 'reasoning') {
                        const isLastTurn = turnIdx === displayedTurns.length - 1;
                        let isCurrentlyThinking = false;
                        if (isSendingPrompt && isLastTurn && turn.assistant?.elements) {
                          // Check if any action or content follows this element in elements
                          let hasFollowingActionOrContent = false;
                          const elIdx = turn.assistant.elements.indexOf(element);
                          if (elIdx >= 0) {
                            for (let k = elIdx + 1; k < turn.assistant.elements.length; k++) {
                              const nextEl = turn.assistant.elements[k];
                              if (nextEl.type === 'action' || nextEl.type === 'content') {
                                hasFollowingActionOrContent = true;
                                break;
                              }
                            }
                          }
                          isCurrentlyThinking = !hasFollowingActionOrContent;
                        }

                        return (
                          <AnimatedReanimated.View
                            key={element.id}
                            entering={FadeInDown.duration(180)}
                          >
                            <Reasoning
                              isStreaming={isCurrentlyThinking}
                              className="my-1.5"
                            >
                              <Reasoning.Trigger
                                label={(isStreaming, duration) =>
                                  isStreaming ? (
                                    <Shimmer textClassName={isLight ? 'text-xs text-primary font-medium' : 'text-xs text-primary font-medium'}>
                                      Thinking…
                                    </Shimmer>
                                  ) : (
                                    <Text className="text-xs text-muted-foreground">
                                      {duration === undefined ? 'Thought' : `Thought for ${duration}s`}
                                    </Text>
                                  )
                                }
                              />
                              <Reasoning.Content>
                                {element.text.trim()}
                              </Reasoning.Content>
                            </Reasoning>
                          </AnimatedReanimated.View>
                        );
                      }

                      if (element.type === 'action') {
                        const action = element.action;
                        return (
                          <AnimatedReanimated.View
                            key={action.id}
                            entering={FadeInDown.duration(180)}
                            style={styles.flatToolItemWrapper}
                          >
                            <TouchableOpacity
                              style={styles.flatToolRow}
                              activeOpacity={0.65}
                              onPress={() => setSelectedActionForTray(action)}
                            >
                              <View style={styles.flatToolLeft}>
                                <View style={styles.flatToolIconWrap}>
                                  {renderActionIcon(action.category)}
                                </View>
                                <Text
                                  style={[
                                    styles.flatToolTitle,
                                    isLight && styles.flatToolTitleLight,
                                    action.status === 'error' && styles.flatToolTitleError,
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="middle"
                                >
                                  {action.title}
                                </Text>
                              </View>

                              <View style={styles.flatToolRight}>
                                {action.status === 'running' && (
                                  <Spinner size="sm" />
                                )}
                                <ChevronRight size={14} color={isLight ? '#8c959f' : '#6e7681'} />
                              </View>
                            </TouchableOpacity>

                            {/* Interactive Clarification & Choice Cards (ask_question) */}
                            {action.toolName === 'ask_question' && (
                              <AskQuestionCard
                                action={action}
                                onSubmitAnswer={async (answerText) => {
                                  await sendPrompt(answerText);
                                }}
                                isSubmitting={isSendingPrompt}
                              />
                            )}
                          </AnimatedReanimated.View>
                        );
                      }

                      if (element.type === 'content') {
                        const isLastTurn = turnIdx === displayedTurns.length - 1;
                        return (
                          <AnimatedReanimated.View
                            key={element.id}
                            entering={FadeInDown.duration(180)}
                            style={styles.resolutionContainer}
                          >
                            <Response isStreaming={isSendingPrompt && isLastTurn}>
                              {element.text}
                            </Response>
                            {isSendingPrompt && isLastTurn && (
                              <AnimatedReanimated.View
                                entering={FadeIn.duration(150)}
                                style={styles.streamingCaretContainer}
                              >
                                <View style={[styles.streamingDot, isLight && { backgroundColor: '#0077b6' }]} />
                              </AnimatedReanimated.View>
                            )}
                          </AnimatedReanimated.View>
                        );
                      }

                      return null;
                    })
                  ) : (
                    // Fallback if elements not yet populated
                    <>
                      {turn.assistant.content ? (
                        <AnimatedReanimated.View
                          entering={FadeInDown.duration(180)}
                          style={styles.resolutionContainer}
                        >
                          <Response isStreaming={isSendingPrompt && turnIdx === displayedTurns.length - 1}>
                            {turn.assistant.content}
                          </Response>
                        </AnimatedReanimated.View>
                      ) : null}
                    </>
                  )}

                  {/* Paradev Action Row (Copy Message & Branch Icon Buttons) */}
                  {turn.assistant.content ? (
                    <View style={styles.agentActionRow}>
                      <TouchableOpacity
                        style={[styles.agentActionBtn, isLight && { backgroundColor: '#ffffff', borderColor: '#e1e4e8' }]}
                        onPress={() =>
                          handleCopyTurnText(turn.id, turn.assistant?.content || '')
                        }
                        activeOpacity={0.7}
                        accessibilityLabel="Copy message"
                      >
                        {copiedTurnId === turn.id ? (
                          <Check size={14} color={isLight ? '#0077b6' : '#fafafa'} />
                        ) : (
                          <Copy size={14} color={isLight ? '#57606a' : '#737373'} />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.agentActionBtn, isLight && { backgroundColor: '#ffffff', borderColor: '#e1e4e8' }]}
                        onPress={() => {
                          setPromptInput(`Regarding turn #${turnIdx + 1}: `);
                        }}
                        activeOpacity={0.7}
                        accessibilityLabel="Branch from here"
                      >
                        <GitFork size={14} color={isLight ? '#57606a' : '#737373'} />
                      </TouchableOpacity>

                      <View style={[styles.agentMetaPill, isLight && { backgroundColor: '#ffffff', borderColor: '#e1e4e8' }]}>
                        <Text style={[styles.agentMetaPillText, isLight && { color: '#57606a' }]}>{modelStr}</Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ))
        )}

        {/* 5. Streaming Live Indicator */}
        {isSendingPrompt && (
          <View style={styles.streamingIndicatorRow}>
            <ThinkingOrb state="working" size={20} />
            <Text style={[styles.streamingText, isLight && { color: '#57606a' }]}>Agent is thinking and executing...</Text>
          </View>
        )}
      </ScrollView>

      {/* 6. Floating Scroll FAB (Visible when user scrolled up or paused auto-scroll mid-stream) */}
      {(showScrollToBottom || (isSendingPrompt && isAutoScrollPaused)) && (
        <AnimatedReanimated.View
          style={[
            styles.scrollFabContainer,
            {
              bottom:
                composerMeasuredHeight +
                Math.max(insets.bottom, 12) +
                12,
            },
            Platform.OS === 'ios' ? animatedKeyboardStyle : null,
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[styles.scrollFab, isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' }]}
            activeOpacity={0.7}
            onPress={handleScrollToBottom}
          >
            <ArrowDown
              size={14}
              color={isSendingPrompt && isAutoScrollPaused ? (isLight ? '#0077b6' : colors.primaryLight) : (isLight ? '#57606a' : '#a3a3a3')}
            />
            {isSendingPrompt && isAutoScrollPaused && (
              <View style={[styles.scrollFabBadge, isLight && { backgroundColor: '#0077b6' }]} />
            )}
          </TouchableOpacity>
        </AnimatedReanimated.View>
      )}

      {/* 7. Chat Input Bar: Elevation above Software Keyboard */}
      <AnimatedReanimated.View
        style={[
          styles.keyboardAvoidingInputWrapper,
          Platform.OS === 'ios' ? animatedKeyboardStyle : null,
        ]}
        pointerEvents="box-none"
      >
        <View
          onLayout={handleComposerLayout}
          style={[
            styles.chatInputWrapper,
            {
              paddingBottom: isKeyboardActive
                ? (Platform.OS === 'android' ? 8 : 6)
                : Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10),
            },
          ]}
          pointerEvents="box-none"
        >
          {/* Autocomplete Slash Command Picker Overlay */}
          <SlashCommandPicker
            visible={showCommandPicker}
            searchQuery={promptInput}
            onSelect={handleSelectCommand}
            onClose={() => setShowCommandPicker(false)}
          />

          {/* Interactive Live Tool Approval Card (Paradev ApprovalCard) */}
          {pendingApproval && (
            <LiveApprovalCard
              approval={pendingApproval}
              isResponding={isRespondingApproval}
              onAuthorize={async () => {
                setIsRespondingApproval(true);
                await respondApproval(true);
                setIsRespondingApproval(false);
              }}
              onDeny={async () => {
                setIsRespondingApproval(true);
                await respondApproval(false);
                setIsRespondingApproval(false);
              }}
            />
          )}

          {/* PanelUI Native AI Composer — Vercel v0 Floating Liquid Glass Pattern */}
          <AIInput
            value={promptInput}
            onValueChange={handleInputChange}
            onSubmit={handleSendPrompt}
            onStop={cancelPrompt}
            onVoice={handleToggleDictation}
            status={isSendingPrompt ? 'streaming' : isDictating ? 'recording' : 'ready'}
            avoidKeyboard={false}
            size="lg"
            className="w-full"
            style={[
              styles.floatingComposerCapsule,
              isLight ? styles.floatingComposerLight : styles.floatingComposerDark,
            ]}
          >
            <AIInput.Row>
              <AIInput.Action
                label="Commands"
                icon={
                  <Plus
                    size={16}
                    color={showCommandPicker ? '#0077b6' : (isLight ? '#57606a' : '#a3a3a3')}
                  />
                }
                onPress={() => setShowCommandPicker((prev) => !prev)}
              />

              <AIInput.Field
                placeholder={
                  !isNetworkOnline
                    ? 'Offline — waiting for connection...'
                    : isDictating
                    ? 'Listening... speak your prompt'
                    : 'Type a message...'
                }
                editable={!isSendingPrompt}
                onSubmitEditing={Platform.OS === 'web' ? handleSendPrompt : undefined}
              />

              <AIInput.Submit />
            </AIInput.Row>
          </AIInput>
        </View>
      </AnimatedReanimated.View>

      {/* 8. Draggable Tool Slide Tray */}
      <ToolActionTray
        visible={Boolean(selectedActionForTray)}
        action={liveSelectedAction}
        onClose={() => setSelectedActionForTray(null)}
      />

      {/* 9. Session Parameters Bottom Sheet */}
      <SessionConfigSheet
        visible={showConfigSheet}
        onClose={() => setShowConfigSheet(false)}
      />

      {/* 10. Live Interactive Terminal Sheet */}
      <TerminalSheet
        visible={showTerminal}
        onClose={() => setShowTerminal(false)}
      />

      {/* 11. Compact Rename Dialog */}
      <Modal
        visible={isRenamingSession}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenamingSession(false)}
      >
        <View style={styles.renameOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsRenamingSession(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.renameCardWrapper}
          >
            <View style={[styles.renameCard, isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' }]}>
              <View style={styles.renameHeader}>
                <Text style={[styles.renameTitle, isLight && { color: '#1f2328' }]}>Rename Session</Text>
                <TouchableOpacity
                  onPress={() => setIsRenamingSession(false)}
                  style={styles.renameCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={isLight ? '#57606a' : '#a3a3a3'} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.renameInput, isLight && { backgroundColor: '#f6f8fa', borderColor: '#d0d7de', color: '#1f2328' }]}
                value={renameTitle}
                onChangeText={setRenameTitle}
                placeholder="Session title..."
                placeholderTextColor={isLight ? '#8c959f' : '#737373'}
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveRename}
              />

              <View style={styles.renameActionsRow}>
                <TouchableOpacity
                  style={[styles.renameCancelBtn, isLight && { backgroundColor: '#f6f8fa', borderColor: '#d0d7de' }]}
                  onPress={() => setIsRenamingSession(false)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.renameCancelText, isLight && { color: '#57606a' }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.renameSaveBtn, isLight && { backgroundColor: '#0077b6' }, isSavingRename && { opacity: 0.6 }]}
                  onPress={handleSaveRename}
                  disabled={isSavingRename || !renameTitle.trim()}
                  activeOpacity={0.7}
                >
                  {isSavingRename ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.renameSaveText, isLight && { color: '#ffffff' }]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* 12. Session Artifacts Bottom Sheet */}
      <ArtifactsSheet
        visible={showArtifactsSheet}
        onClose={() => setShowArtifactsSheet(false)}
        initialSearchQuery={artifactFilterQuery}
      />

      {/* 13. Autonomous On-Call & PR Review Modal */}
      <AutoHealerModal
        visible={isAutoHealerModalVisible}
        onClose={dismissAutoHealer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  headerTerminalBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.btn,
    backgroundColor: '#191919',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#141414',
  },
  // Floating Option 3 Header Styles
  cleanHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    zIndex: 40,
    borderBottomWidth: 0,
  },
  cleanCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cleanHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f5f5',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  // Dropdown Badge
  dropdownBadge: {
    backgroundColor: '#0077b6',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 8,
  },
  dropdownBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Compact Rename Modal Styles
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  renameCardWrapper: {
    width: '100%',
    maxWidth: 340,
  },
  renameCard: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  renameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  renameTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fafafa',
  },
  renameCloseBtn: {
    padding: 4,
  },
  renameInput: {
    height: 42,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    color: '#fafafa',
    fontSize: 14,
    marginBottom: 16,
  },
  renameActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  renameCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  renameCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a3a3a3',
  },
  renameSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    minWidth: 70,
    alignItems: 'center',
  },
  renameSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 58 : 54,
    paddingBottom: 130,
  },

  // Metadata summary row & session config
  sessionMetaPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10,
    gap: 8,
  },
  modelStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    flexShrink: 1,
  },
  modelStatusText: {
    fontSize: 11,
    color: '#a3a3a3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  contextPill: {
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  contextPillText: {
    fontSize: 10,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Infinite scroll & transcript pagination header
  paginationHeaderContainer: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  paginationLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  paginationLoadingText: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '500',
  },
  loadOlderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  loadOlderButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#a3a3a3',
  },
  transcriptStartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    gap: 10,
  },
  transcriptStartDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  transcriptStartBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#191919',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  transcriptStartText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#737373',
  },

  // Sequential Turn Card
  turnCardContainer: {
    marginBottom: 14,
  },

  // User Message: Paradev OutgoingBubble (bg-[#2F2F2F], rounded-[22px], max-w-[82%])
  userBubbleWrapper: {
    alignItems: 'flex-end',
    marginBottom: 16,
    marginTop: 4,
  },
  userOutgoingBubble: {
    maxWidth: '82%',
    backgroundColor: '#2F2F2F', // Paradev OutgoingBubble
    borderRadius: radii.bubble,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubbleText: {
    fontSize: 15.5,
    lineHeight: 22,
    color: '#fafafa',
  },
  userBubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginRight: 6,
  },
  userBubbleMetaText: {
    fontSize: 10.5,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Assistant Turn: Natural Unboxed Flow
  assistantTurnWrapper: {
    width: '100%',
    marginBottom: 16,
  },

  // Flat Tool Actions (Pure borderless rows matching reference image)
  flatToolItemWrapper: {
    width: '100%',
  },
  flatToolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  flatToolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  flatToolIconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  flatToolTitle: {
    fontSize: 13,
    color: '#e6edf3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  flatToolTitleLight: {
    color: '#1f2328',
  },
  flatToolTitleError: {
    color: '#f85149',
  },
  flatToolRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Resolution summary container
  resolutionContainer: {
    paddingTop: 2,
  },
  streamingCaretContainer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 2,
  },
  streamingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#58a6ff',
    opacity: 0.85,
  },

  // Paradev AgentMessage Footer Action Row
  agentActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingLeft: 2,
  },
  agentActionBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.btn,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  agentMetaPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  agentMetaPillText: {
    fontSize: 10,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Session loading
  sessionLoadingBox: {
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLoadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sessionLoadingText: {
    fontSize: 13,
    color: '#a3a3a3',
    fontWeight: '500',
  },

  // Streaming indicator
  streamingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  streamingText: {
    fontSize: 13,
    color: '#fafafa',
    fontStyle: 'italic',
  },

  // Empty chat state
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyChatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyChatTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fafafa',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: '#737373',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Floating Action Buttons
  scrollFabContainer: {
    position: 'absolute',
    bottom: 82,
    right: 16,
    zIndex: 25,
  },
  scrollFab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  scrollFabBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: '#161616',
  },

  // Chat Input Bar: KeyboardAvoidingView container + Capsule Wrapper
  keyboardAvoidingInputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  chatInputWrapper: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  // Vercel v0 Liquid Glass Floating Composer Capsule
  floatingComposerCapsule: {
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingComposerDark: {
    backgroundColor: 'rgba(25, 25, 25, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  floatingComposerLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 26,
    minHeight: 52,
    maxHeight: 140,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  composerPlusBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  composerPlusBtnActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderWidth: 1,
  },
  composerTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#fafafa',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 4,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 120,
  },
  composerSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fafafa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  composerStopBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 2 : 1,
  },
  composerMicBtnActive: {
    backgroundColor: '#ef4444',
  },
});
