import React, { useState, useRef, useMemo, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MoreVertical,
  Menu,
  Terminal,
  Link,
  FileText,
  FileCode,
  FolderGit2,
  GitFork,
  ArrowDown,
  ArrowUp,
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
} from '../components/Icons';
import { colors, radii, typography, getThemeColors } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MarkdownText } from '../components/MarkdownText';
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

  const [promptInput, setPromptInput] = useState('');
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showArtifactsSheet, setShowArtifactsSheet] = useState(false);
  const [artifactFilterQuery, setArtifactFilterQuery] = useState('');
  const [showSessionMenu, setShowSessionMenu] = useState(false);
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
        Alert.alert('Voice Dictation', err);
      },
      onEnd: () => {
        setIsDictating(false);
      },
    });
  };
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSaveRename = async () => {
    if (!activeSession || !renameTitle.trim() || isSavingRename) return;
    setIsSavingRename(true);
    try {
      await renameSession(activeSession.id, renameTitle.trim());
      setIsRenamingSession(false);
    } finally {
      setIsSavingRename(false);
    }
  };

  const [openTurnAccordions, setOpenTurnAccordions] = useState<Record<string, boolean>>({});
  const [openReasoningAccordions, setOpenReasoningAccordions] = useState<Record<string, boolean>>({});
  const [selectedActionForTray, setSelectedActionForTray] = useState<ActionStep | null>(null);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState<boolean>(false);
  const scrollViewRef = useRef<any>(null);

  // Auto-scrolling state & throttle controls during live agent writing
  const isAutoScrollPausedRef = useRef<boolean>(false);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<any>(null);

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

  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    const isScrolledUp = distanceFromBottom > 140 && contentOffset.y > 60;
    setShowScrollToBottom(isScrolledUp);

    // If user scrolled back down near the bottom (within 45px), resume auto-scroll
    if (distanceFromBottom <= 45) {
      resumeAutoScroll();
    } else if (distanceFromBottom > 80 && isSendingPrompt) {
      // User scrolled up away from the bottom while agent is writing
      pauseAutoScroll();
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

  const isReasoningOpen = (turnId: string) => openReasoningAccordions[turnId] ?? false;

  const toggleReasoningAccordion = (turnId: string) => {
    setOpenReasoningAccordions((prev) => ({
      ...prev,
      [turnId]: !isReasoningOpen(turnId),
    }));
  };

  const handleCopyTurnText = (turnId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedTurnId(turnId);
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

    setPromptInput('');
    resumeAutoScroll();
    await sendPrompt(text);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 150);
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
          };
        }

        if (msg.reasoning) {
          currentTurn.assistant.reasoning = currentTurn.assistant.reasoning
            ? currentTurn.assistant.reasoning + '\n' + msg.reasoning
            : msg.reasoning;
        }

        if (msg.content) {
          currentTurn.assistant.content = currentTurn.assistant.content
            ? currentTurn.assistant.content + '\n' + msg.content
            : msg.content;
        }

        // Process tool calls made in this assistant step
        const asstObj = currentTurn.assistant;
        if (asstObj && msg.toolCalls && msg.toolCalls.length > 0) {
          msg.toolCalls.forEach((tc, tcIdx) => {
            const name = tc.name || '';
            let category: ActionStep['category'] = 'terminal';
            if (
              name.includes('file') ||
              name === 'read_file' ||
              name === 'view_file' ||
              name === 'edit_file' ||
              name === 'write_file'
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
            } else if (name.includes('search') || name === 'search_web') {
              category = 'search';
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

            const args = tc.arguments || {};
            let title = `Execute ${name}`;
            if (args.toolSummary) {
              title = String(args.toolSummary).replace(/^"|"$/g, '');
            } else if (args.CommandLine) {
              title = String(args.CommandLine).replace(/^"|"$/g, '');
            } else if (args.Path || args.AbsolutePath) {
              const p = String(args.Path || args.AbsolutePath).replace(/^"|"$/g, '');
              const filename = p.split(/[\\/]/).pop() || p;
              title = `${name.replace(/_file$/, '')}: ${filename}`;
            } else if (args.query) {
              title = `Search: "${String(args.query).replace(/^"|"$/g, '')}"`;
            } else if (args.ServerName && args.ToolName) {
              title = `MCP: ${args.ServerName} / ${args.ToolName}`;
            }

            let exitCode: number | undefined;
            if (toolOutput) {
              const exitMatch = /(?:exited\s+with\s+code\s+|exit\s+code\s+)(\d+)/i.exec(toolOutput);
              if (exitMatch) {
                exitCode = parseInt(exitMatch[1], 10);
              }
            }

            asstObj.actions.push({
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
            });
          });
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

  const renderActionIcon = (category: ActionStep['category']) => {
    const iconColor = isLight ? '#1f2328' : '#ffffff';
    switch (category) {
      case 'repo':
        return <FolderGit2 size={14} color={iconColor} />;
      case 'mcp':
        return <Link size={14} color={iconColor} />;
      case 'skill':
        return <GitFork size={14} color={iconColor} />;
      case 'file':
        return <FileText size={14} color={iconColor} />;
      case 'search':
        return <Search size={14} color={iconColor} />;
      case 'terminal':
      default:
        return <Terminal size={14} color={iconColor} />;
    }
  };

  return (
    <View style={[styles.container, isLight && { backgroundColor: '#f6f8fa' }]}>
      {/* 1. Floating Capsule Header */}
      <View
        style={[
          styles.floatingHeaderContainer,
          { paddingTop: topInset + (Platform.OS === 'ios' ? 4 : 6) },
        ]}
        pointerEvents="box-none"
      >
        {/* Left: Floating Menu Pill */}
        <TouchableOpacity
          style={[
            styles.floatingCircleBtn,
            isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' },
          ]}
          onPress={() => {
            if (onOpenDrawer) {
              onOpenDrawer();
            } else if (onBack) {
              onBack();
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Open Menu Drawer"
        >
          <Menu size={20} color={isLight ? '#1f2328' : '#fafafa'} />
        </TouchableOpacity>

        {/* Center: Floating Workspace Pill */}
        <TouchableOpacity
          style={[
            styles.floatingCenterPill,
            isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' },
          ]}
          onPress={() => setShowConfigSheet(true)}
          activeOpacity={0.75}
          accessibilityLabel="Open Session Parameters"
        >
          {connectionState !== 'connected' && (
            <ActivityIndicator
              size="small"
              color={isLight ? '#0077b6' : '#a3a3a3'}
              style={{ transform: [{ scale: 0.75 }], marginRight: 6 }}
            />
          )}
          <Text
            style={[
              styles.floatingPillTitle,
              isLight && { color: '#1f2328' },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {workspaceTitle}
          </Text>
        </TouchableOpacity>

        {/* Right: Floating Actions (Artifacts, Session Actions with Dropdown) */}
        <View style={styles.floatingRightCluster}>
          <TouchableOpacity
            style={[
              styles.floatingCircleBtn,
              isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' },
            ]}
            onPress={() => {
              setArtifactFilterQuery('');
              setShowArtifactsSheet(true);
              fetchSessionArtifacts().catch(() => {});
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="View Session Artifacts"
          >
            <Layers size={19} color={isLight ? '#1f2328' : '#fafafa'} />
            {sessionArtifacts.length > 0 ? (
              <View style={[styles.headerBadge, isLight && { backgroundColor: '#0077b6' }]}>
                <Text style={styles.headerBadgeText}>{sessionArtifacts.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.floatingCircleBtn,
              isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' },
              showSessionMenu && (isLight ? { borderColor: '#0077b6' } : styles.floatingCircleBtnActive),
            ]}
            onPress={() => setShowSessionMenu((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Session Actions"
          >
            <MoreVertical size={20} color={showSessionMenu ? (isLight ? '#0077b6' : '#fafafa') : (isLight ? '#57606a' : '#a3a3a3')} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Sleek Anchored Dropdown Menu (Underneath Three-Dot Button) */}
      {showSessionMenu && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 250 }]} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={() => setShowSessionMenu(false)}>
            <View style={styles.dropdownBackdrop} />
          </TouchableWithoutFeedback>

          <View
            style={[
              styles.dropdownMenu,
              isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de', shadowOpacity: 0.12 },
              {
                top: topInset + (Platform.OS === 'ios' ? 52 : 54),
              },
            ]}
          >
            {/* PTY / Terminal Option */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowSessionMenu(false);
                setShowTerminal(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.dropdownItemIcon, isLight && { backgroundColor: '#f6f8fa' }]}>
                <Terminal size={15} color={isLight ? '#1f2328' : '#fafafa'} />
              </View>
              <View style={styles.dropdownItemContent}>
                <Text style={[styles.dropdownItemTitle, isLight && { color: '#1f2328' }]}>Terminal / PTY</Text>
                <Text style={[styles.dropdownItemSub, isLight && { color: '#6e7681' }]}>Live interactive shell</Text>
              </View>
            </TouchableOpacity>

            {/* Model & Config Parameters */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setShowSessionMenu(false);
                setShowConfigSheet(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.dropdownItemIcon, isLight && { backgroundColor: '#f6f8fa' }]}>
                <SlidersHorizontal size={15} color={isLight ? '#57606a' : '#a3a3a3'} />
              </View>
              <View style={styles.dropdownItemContent}>
                <Text style={[styles.dropdownItemTitle, isLight && { color: '#1f2328' }]}>Parameters</Text>
                <Text style={[styles.dropdownItemSub, isLight && { color: '#6e7681' }]}>Model, thinking, temperature</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.dropdownDivider, isLight && { backgroundColor: '#e1e4e8' }]} />

            {/* Pin / Unpin */}
            {activeSession && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={async () => {
                  setShowSessionMenu(false);
                  await togglePinSession(activeSession.id);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.dropdownItemIcon, isLight && { backgroundColor: '#f6f8fa' }]}>
                  <Pin size={15} color={activeSession.pinned ? '#0077b6' : (isLight ? '#57606a' : '#a3a3a3')} />
                </View>
                <View style={styles.dropdownItemContent}>
                  <Text style={[styles.dropdownItemTitle, isLight && { color: '#1f2328' }]}>
                    {activeSession.pinned ? 'Unpin Session' : 'Pin Session'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Rename Session */}
            {activeSession && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowSessionMenu(false);
                  setRenameTitle(activeSession.title);
                  setIsRenamingSession(true);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.dropdownItemIcon, isLight && { backgroundColor: '#f6f8fa' }]}>
                  <Pencil size={15} color={isLight ? '#57606a' : '#a3a3a3'} />
                </View>
                <View style={styles.dropdownItemContent}>
                  <Text style={[styles.dropdownItemTitle, isLight && { color: '#1f2328' }]}>Rename Session</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={[styles.dropdownDivider, isLight && { backgroundColor: '#e1e4e8' }]} />

            {/* Delete Session */}
            {activeSession && (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setShowSessionMenu(false);
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
                activeOpacity={0.7}
              >
                <View style={[styles.dropdownItemIcon, styles.dropdownItemIconDanger]}>
                  <Trash2 size={15} color="#f85149" />
                </View>
                <View style={styles.dropdownItemContent}>
                  <Text style={[styles.dropdownItemTitle, { color: '#f85149' }]}>
                    Delete Session
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scroll, isLight && { backgroundColor: '#f6f8fa' }]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + (Platform.OS === 'ios' ? 60 : 56),
            paddingBottom: 90 + insets.bottom + (Platform.OS === 'ios' ? keyboardHeight : 0),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onTouchStart={pauseAutoScroll}
        onScrollBeginDrag={pauseAutoScroll}
        onContentSizeChange={() => {
          if (isSendingPrompt && !isAutoScrollPausedRef.current) {
            triggerAutoScroll();
          }
        }}
      >

        {/* 3. Pagination: Load Older History Button */}
        {hasMoreMessages && (
          <View style={styles.loadOlderContainer}>
            <TouchableOpacity
              style={[styles.loadOlderBtn, isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de' }]}
              onPress={loadOlderMessages}
              disabled={isLoadingOlderMessages}
              activeOpacity={0.7}
            >
              {isLoadingOlderMessages ? (
                <ActivityIndicator size="small" color={isLight ? '#0077b6' : colors.primaryLight} />
              ) : (
                <>
                  <ArrowUp size={13} color={isLight ? '#0077b6' : colors.primaryLight} />
                  <Text style={[styles.loadOlderText, isLight && { color: '#57606a' }]}>Load older messages</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

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
            <View key={turn.id || turnIdx} style={styles.turnCardContainer}>
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

              {/* Assistant Turn: Natural Unboxed Flow matching Paradev AgentMessage */}
              {turn.assistant ? (
                <View style={styles.assistantTurnWrapper}>
                  {/* Reasoning Process: Paradev Reasoning Component */}
                  {turn.assistant.reasoning ? (
                    <View
                      style={[
                        styles.reasoningContainer,
                        isLight && {
                          backgroundColor: '#ffffff',
                          borderColor: '#e1e4e8',
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.reasoningToggleBtn}
                        onPress={() => toggleReasoningAccordion(turn.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.reasoningToggleLeft}>
                          <Brain size={14} color={isLight ? '#57606a' : '#a3a3a3'} />
                          <Text style={[styles.reasoningToggleText, isLight && { color: '#57606a' }]}>
                            {isSendingPrompt && turnIdx === displayedTurns.length - 1
                              ? 'Thinking...'
                              : 'Thought for a few seconds'}
                          </Text>
                        </View>
                        <View style={styles.reasoningToggleRight}>
                          {isReasoningOpen(turn.id) ? (
                            <ChevronUp size={14} color={isLight ? '#57606a' : '#a3a3a3'} />
                          ) : (
                            <ChevronDown size={14} color={isLight ? '#57606a' : '#a3a3a3'} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isReasoningOpen(turn.id) && (
                        <View style={styles.reasoningBody}>
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{ maxHeight: 220 }}>
                            <Text style={[styles.reasoningText, isLight && { color: '#57606a' }]} selectable>
                              {turn.assistant.reasoning.trim()}
                            </Text>
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Inline Tool Execution Steps: Paradev ToolCallRow */}
                  {turn.assistant.actions && turn.assistant.actions.length > 0 ? (
                    <View style={[styles.toolCallsSection, isLight && { backgroundColor: '#ffffff', borderColor: '#e1e4e8' }]}>
                      <TouchableOpacity
                        style={styles.toolCallsSummaryRow}
                        onPress={() => toggleTurnAccordion(turn.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.toolCallsSummaryLeft}>
                          {turn.assistant.actions.some((a) => a.status === 'running') ? (
                            <ActivityIndicator
                              size="small"
                              color={isLight ? '#0077b6' : '#a3a3a3'}
                              style={{ transform: [{ scale: 0.7 }], marginRight: 6 }}
                            />
                          ) : (
                            <Wrench size={13} color={isLight ? '#57606a' : '#737373'} style={{ marginRight: 6 }} />
                          )}
                          <Text style={[styles.toolCallsSummaryText, isLight && { color: '#57606a' }]}>
                            {turn.assistant.actions.length} tool call
                            {turn.assistant.actions.length > 1 ? 's' : ''} executed
                          </Text>
                        </View>
                        <View style={styles.toolCallsSummaryRight}>
                          {isTurnOpen(turn.id) ? (
                            <ChevronUp size={14} color={isLight ? '#57606a' : '#737373'} />
                          ) : (
                            <ChevronDown size={14} color={isLight ? '#57606a' : '#737373'} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isTurnOpen(turn.id) && (
                        <View style={[styles.toolActionRowsList, isLight && { borderTopColor: '#e1e4e8' }]}>
                          {turn.assistant.actions.map((action) => (
                            <TouchableOpacity
                              key={action.id}
                              style={[
                                styles.toolCallRow,
                                isLight && {
                                  backgroundColor: '#f6f8fa',
                                  borderColor: '#e1e4e8',
                                  borderBottomColor: '#e1e4e8',
                                },
                              ]}
                              activeOpacity={0.7}
                              onPress={() => setSelectedActionForTray(action)}
                            >
                              <View style={styles.toolCallLeft}>
                                <View style={[styles.toolCallIconBox, isLight && styles.toolCallIconBoxLight]}>
                                  {renderActionIcon(action.category)}
                                </View>
                                <Text style={[styles.toolCallTitle, isLight && { color: '#1f2328' }]} numberOfLines={1}>
                                  {action.title}
                                </Text>
                              </View>

                              <View style={styles.toolCallRight}>
                                {action.status === 'running' ? (
                                  <View style={[styles.actionRunningBadge, isLight && { backgroundColor: 'rgba(0, 119, 182, 0.10)' }]}>
                                    <ActivityIndicator
                                      size="small"
                                      color={isLight ? '#0077b6' : '#a3a3a3'}
                                      style={{ transform: [{ scale: 0.65 }] }}
                                    />
                                    <Text style={[styles.actionRunningBadgeText, isLight && { color: '#0077b6' }]}>Running</Text>
                                  </View>
                                ) : action.status === 'error' ? (
                                  <View style={styles.actionErrorBadge}>
                                    <X size={12} color="#ef4444" />
                                    <Text style={styles.actionErrorBadgeText}>Failed</Text>
                                  </View>
                                ) : (
                                  <Check size={13} color={isLight ? '#0077b6' : '#fafafa'} />
                                )}
                                <ChevronRight size={14} color={isLight ? '#57606a' : '#737373'} />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Interactive Clarification & Choice Cards (ask_question) */}
                  {turn.assistant.actions
                    ?.filter((a) => a.toolName === 'ask_question')
                    .map((qAction) => (
                      <AskQuestionCard
                        key={qAction.id}
                        action={qAction}
                        onSubmitAnswer={async (answerText) => {
                          await sendPrompt(answerText);
                        }}
                        isSubmitting={isSendingPrompt}
                      />
                    ))}

                  {/* Assistant Markdown Resolution */}
                  {turn.assistant.content ? (
                    <View style={styles.resolutionContainer}>
                      <MarkdownText content={turn.assistant.content} isUser={false} />

                      {/* Paradev Action Row (Copy Message & Branch Icon Buttons) */}
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
            <ActivityIndicator size="small" color={isLight ? '#0077b6' : '#a3a3a3'} />
            <Text style={[styles.streamingText, isLight && { color: '#57606a' }]}>Agent is thinking and executing...</Text>
          </View>
        )}
      </ScrollView>

      {/* 6. Floating Scroll FAB (Visible when user scrolled up or paused auto-scroll mid-stream) */}
      {(showScrollToBottom || (isSendingPrompt && isAutoScrollPaused)) && (
        <View
          style={[
            styles.scrollFabContainer,
            {
              bottom: 76 + Math.max(insets.bottom, 12) + (Platform.OS === 'ios' ? keyboardHeight : 0),
              pointerEvents: 'box-none',
            },
          ]}
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
        </View>
      )}

      {/* 7. Chat Input Bar: Floating Capsule */}
      <View
        style={[
          styles.chatInputWrapper,
          {
            bottom: Platform.OS === 'ios' ? keyboardHeight : 0,
            paddingBottom:
              Platform.OS === 'ios' && keyboardHeight > 0
                ? 10
                : Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12),
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

        {/* Paradev Inset Composer Card */}
        <View style={[styles.composerCard, isLight && { backgroundColor: '#ffffff', borderColor: '#d0d7de', shadowOpacity: 0.08 }]}>
          {/* Circular '+' Button on Left */}
          <TouchableOpacity
            style={[
              styles.composerPlusBtn,
              isLight && { backgroundColor: '#f6f8fa', borderColor: '#d0d7de' },
              showCommandPicker && (isLight ? { backgroundColor: '#0077b6', borderColor: '#0077b6' } : styles.composerPlusBtnActive),
            ]}
            activeOpacity={0.7}
            onPress={() => setShowCommandPicker((prev) => !prev)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Plus size={16} color={showCommandPicker ? '#ffffff' : (isLight ? '#57606a' : '#a3a3a3')} />
          </TouchableOpacity>

          {/* Clean Text Input with Dynamic Multiline Expansion */}
          <TextInput
            style={[styles.composerTextInput, isLight && { color: '#1f2328' }]}
            placeholder={isDictating ? 'Listening... speak your prompt' : 'Type a message...'}
            placeholderTextColor={isDictating ? '#ef4444' : (isLight ? '#8c959f' : '#737373')}
            value={promptInput}
            onChangeText={handleInputChange}
            onSubmitEditing={Platform.OS === 'web' ? handleSendPrompt : undefined}
            multiline={true}
            blurOnSubmit={false}
            editable={!isSendingPrompt}
          />

          {/* Right Action: Stop, ArrowUp Send, or Mic */}
          {isSendingPrompt ? (
            <TouchableOpacity
              style={styles.composerStopBtn}
              onPress={cancelPrompt}
              activeOpacity={0.8}
              accessibilityLabel="Stop agent turn"
              disabled={isCancellingPrompt}
            >
              {isCancellingPrompt ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Square size={13} color="#ffffff" />
              )}
            </TouchableOpacity>
          ) : promptInput.trim().length > 0 && !isDictating ? (
            <TouchableOpacity
              style={[styles.composerSendBtn, isLight && { backgroundColor: '#0077b6' }]}
              onPress={handleSendPrompt}
              activeOpacity={0.85}
            >
              <ArrowUp size={16} color={isLight ? '#ffffff' : '#0a0a0a'} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.composerMicBtn,
                isLight && { backgroundColor: '#f6f8fa' },
                isDictating && styles.composerMicBtnActive,
              ]}
              activeOpacity={0.7}
              onPress={handleToggleDictation}
              accessibilityLabel={isDictating ? 'Stop voice dictation' : 'Start voice dictation'}
            >
              <Mic size={17} color={isDictating ? '#ffffff' : (isLight ? '#57606a' : '#737373')} />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
    backgroundColor: '#0a0a0a', // Paradev root dark theme
  },
  headerTerminalBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.btn,
    backgroundColor: '#161616',
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
  },
  // Floating Option 3 Header Styles
  floatingHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 10,
    paddingBottom: 6,
    backgroundColor: 'transparent',
    zIndex: 40,
  },
  floatingCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingCircleBtnActive: {
    backgroundColor: '#262626',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  floatingCenterPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 21,
    height: 42,
    paddingHorizontal: 14,
    marginHorizontal: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingPillTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fafafa',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  floatingRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Sleek Anchored Dropdown Menu
  dropdownBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  dropdownMenu: {
    position: 'absolute',
    right: 12,
    width: 220,
    backgroundColor: 'rgba(22, 22, 22, 0.98)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 14,
    zIndex: 260,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 10,
  },
  dropdownItemIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemIconDanger: {
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fafafa',
  },
  dropdownItemSub: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
    marginHorizontal: 6,
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

  // Pagination header
  loadOlderContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  loadOlderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  loadOlderText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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

  // Paradev Reasoning Component
  reasoningContainer: {
    marginVertical: 4,
    borderRadius: radii.lg,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  reasoningToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reasoningToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reasoningToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#a3a3a3',
  },
  reasoningToggleRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasoningBody: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 255, 255, 0.2)',
  },
  reasoningText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#a3a3a3',
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Paradev ToolCallRow Section
  toolCallsSection: {
    marginVertical: 6,
    borderRadius: radii.lg,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  toolCallsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toolCallsSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolCallsSummaryText: {
    fontSize: 12,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  toolCallsSummaryRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolActionRowsList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  toolCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  toolCallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  toolCallIconBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCallIconBoxLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  toolCallTitle: {
    fontSize: 12,
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  toolCallRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionRunningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionRunningBadgeText: {
    fontSize: 10,
    color: '#fafafa',
    fontWeight: '600',
  },
  actionErrorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  actionErrorBadgeText: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },

  // Resolution summary container
  resolutionContainer: {
    paddingTop: 2,
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

  // Chat Input Bar: Paradev Floating Capsule
  chatInputWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    zIndex: 30,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 26,
    minHeight: 52,
    maxHeight: 140,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 0,
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
