import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
} from 'react-native';
import {
  X,
  FolderTree,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  ImageIcon,
  Music,
  Video,
  File,
  Search,
  RefreshCw,
} from './Icons';
import { Tree } from 'panelui-native';
import { useDaemonStore, type DaemonFileNode } from '../stores/useDaemonStore';
import { formatFileSize, guessMimeType } from '../lib/attachments';
import { FileViewerModal } from './FileViewerModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 28);
const FULL_HEIGHT = SCREEN_HEIGHT - TOP_INSET;
const DEFAULT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 640);
const SNAP_TOP = 0;
const SNAP_DEFAULT = Math.round(FULL_HEIGHT - DEFAULT_HEIGHT);
const SNAP_CLOSED = FULL_HEIGHT + 60;

interface WorkspaceFilesSheetProps {
  visible: boolean;
  onClose: () => void;
  rootPath?: string;
}

function getFileIcon(fileName: string, isLight: boolean, isSwiss: boolean) {
  const mime = guessMimeType(fileName);
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|jfif|bmp|ico|heic)$/i.test(fileName)) {
    return <ImageIcon size={14} color={isSwiss ? '#DC201E' : '#a855f7'} />;
  }
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName)) {
    return <Music size={14} color={isSwiss ? '#DC201E' : '#ec4899'} />;
  }
  if (mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(fileName)) {
    return <Video size={14} color={isSwiss ? '#DC201E' : '#ef4444'} />;
  }
  if (ext === 'md' || ext === 'mdx' || ext === 'txt' || ext === 'log' || ext === 'pdf') {
    return <FileText size={14} color={isSwiss ? '#DC201E' : '#06b6d4'} />;
  }
  if (
    /^(application\/json|application\/javascript|application\/typescript)$/i.test(mime) ||
    /\.(ts|tsx|js|jsx|json|py|rs|go|c|cpp|h|java|kt|swift|css|scss|html|sh|yaml|yml|toml|sql|prisma)$/i.test(fileName)
  ) {
    return <FileCode size={14} color={isSwiss ? '#DC201E' : '#3b82f6'} />;
  }
  return <File size={14} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />;
}

export const WorkspaceFilesSheet: React.FC<WorkspaceFilesSheetProps> = ({
  visible,
  onClose,
  rootPath,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const activeSession = useDaemonStore((s) => s.activeSession);
  const targetWorkspacePath = useDaemonStore((s) => s.targetWorkspacePath);
  const workspaceTree = useDaemonStore((s) => s.workspaceTree);
  const isLoadingWorkspaceTree = useDaemonStore((s) => s.isLoadingWorkspaceTree);
  const fetchWorkspaceTree = useDaemonStore((s) => s.fetchWorkspaceTree);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedViewerNode, setSelectedViewerNode] = useState<DaemonFileNode | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectivePath = rootPath || activeSession?.workspacePath || targetWorkspacePath || '';

  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  isExpandedRef.current = isExpanded;

  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const currentY = useRef(SNAP_DEFAULT);
  const startDragY = useRef(SNAP_DEFAULT);

  const snapTo = (toValue: number, expanded: boolean) => {
    currentY.current = toValue;
    setIsExpanded(expanded);
    Animated.spring(translateY, {
      toValue,
      damping: 24,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handleToggleExpand = () => {
    if (isExpandedRef.current) {
      snapTo(SNAP_DEFAULT, false);
    } else {
      snapTo(SNAP_TOP, true);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        startDragY.current = currentY.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextY = Math.max(SNAP_TOP, startDragY.current + gestureState.dy);
        currentY.current = nextY;
        translateY.setValue(nextY);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isExpandedRef.current) {
          if (gestureState.dy < -40 || gestureState.vy < -0.3) {
            snapTo(SNAP_TOP, true);
          } else if (gestureState.dy > 60 || gestureState.vy > 0.4) {
            handleClose();
          } else {
            snapTo(SNAP_DEFAULT, false);
          }
        } else {
          if (gestureState.dy > 60 || gestureState.vy > 0.4) {
            snapTo(SNAP_DEFAULT, false);
          } else {
            snapTo(SNAP_TOP, true);
          }
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      currentY.current = SNAP_DEFAULT;
      translateY.setValue(SNAP_DEFAULT);
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      fetchWorkspaceTree(effectivePath).then((tree) => {
        // Auto-expand top-level folders that have children
        if (tree && tree.length > 0) {
          const topDirs = tree.filter((n) => n.type === 'directory').slice(0, 3).map((n) => n.path);
          setExpandedPaths((prev) => Array.from(new Set([...prev, ...topDirs])));
        }
      });
    } else {
      currentY.current = SNAP_CLOSED;
      translateY.setValue(SNAP_CLOSED);
      backdropOpacity.setValue(0);
      setIsExpanded(false);
      setSearchQuery('');
    }
  }, [visible, effectivePath]);

  const handleClose = () => {
    currentY.current = SNAP_CLOSED;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SNAP_CLOSED,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchWorkspaceTree(effectivePath);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Build recursive filter for search
  const filteredTree = useMemo(() => {
    if (!workspaceTree) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return workspaceTree;

    function filterNode(node: DaemonFileNode): DaemonFileNode | null {
      const matchSelf = node.name.toLowerCase().includes(query) || node.path.toLowerCase().includes(query);
      if (node.type === 'directory') {
        const filteredChildren = (node.children || [])
          .map(filterNode)
          .filter((n): n is DaemonFileNode => n !== null);
        if (matchSelf || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      }
      return matchSelf ? node : null;
    }

    return workspaceTree.map(filterNode).filter((n): n is DaemonFileNode => n !== null);
  }, [workspaceTree, searchQuery]);

  // Count files and folders
  const stats = useMemo(() => {
    let fileCount = 0;
    let dirCount = 0;
    let totalBytes = 0;

    function countNodes(nodes: DaemonFileNode[]) {
      for (const n of nodes) {
        if (n.type === 'directory') {
          dirCount++;
          if (n.children) countNodes(n.children);
        } else {
          fileCount++;
          totalBytes += n.size || 0;
        }
      }
    }

    if (workspaceTree) countNodes(workspaceTree);
    return { fileCount, dirCount, totalBytes };
  }, [workspaceTree]);

  // Recursively render panelui-native Tree items
  const renderTreeNode = (node: DaemonFileNode) => {
    if (node.type === 'directory') {
      const isNodeExpanded = expandedPaths.includes(node.path);
      const childCount = node.children?.length || 0;

      return (
        <Tree.Item key={node.path} value={node.path}>
          <Tree.Trigger>
            <Tree.Indicator />
            <Tree.Icon>
              {isNodeExpanded ? (
                <FolderOpen size={14} color={isSwiss ? '#DC201E' : '#3b82f6'} />
              ) : (
                <Folder size={14} color={isSwiss ? '#DC201E' : '#3b82f6'} />
              )}
            </Tree.Icon>
            <Tree.Label numberOfLines={1}>{node.name}</Tree.Label>
            {childCount > 0 && (
              <Tree.Actions>
                <Text style={[styles.nodeActionText, isLight && styles.nodeActionTextLight]}>
                  {childCount}
                </Text>
              </Tree.Actions>
            )}
          </Tree.Trigger>
          {node.children && node.children.length > 0 && (
            <Tree.Group>
              {node.children.map(renderTreeNode)}
            </Tree.Group>
          )}
        </Tree.Item>
      );
    }

    return (
      <Tree.Item key={node.path} value={node.path}>
        <Tree.Trigger>
          <Tree.Icon>{getFileIcon(node.name, isLight, isSwiss)}</Tree.Icon>
          <Tree.Label numberOfLines={1}>{node.name}</Tree.Label>
          {node.size !== undefined && node.size > 0 && (
            <Tree.Actions>
              <Text style={[styles.nodeActionText, isLight && styles.nodeActionTextLight]}>
                {formatFileSize(node.size)}
              </Text>
            </Tree.Actions>
          )}
        </Tree.Trigger>
      </Tree.Item>
    );
  };

  // Find node by path when selected
  const handleSelectPath = (path: string | string[]) => {
    const targetPath = Array.isArray(path) ? path[0] : path;
    if (!targetPath) return;

    function findNode(nodes: DaemonFileNode[]): DaemonFileNode | null {
      for (const n of nodes) {
        if (n.path === targetPath) return n;
        if (n.children) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    }

    if (workspaceTree) {
      const selected = findNode(workspaceTree);
      if (selected && selected.type === 'file') {
        setSelectedViewerNode(selected);
      }
    }
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        transparent
        visible={visible}
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          {/* Sliding Sheet */}
          <Animated.View
            style={[
              styles.sheetContainer,
              isLight && styles.sheetContainerLight,
              isSwiss && styles.sheetContainerSwiss,
              { transform: [{ translateY }] },
            ]}
          >
            {/* Handle & Header */}
            <View {...panResponder.panHandlers} collapsable={false}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.handleContainer}
                onPress={handleToggleExpand}
              >
                <View
                  style={[
                    styles.dragPill,
                    isLight && styles.dragPillLight,
                    isSwiss && styles.dragPillSwiss,
                  ]}
                />
              </TouchableOpacity>

              <View style={[styles.header, isLight && styles.headerLight, isSwiss && styles.headerSwiss]}>
                <View style={styles.headerLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      isLight && styles.iconCircleLight,
                      isSwiss && styles.iconCircleSwiss,
                    ]}
                  >
                    <FolderTree size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#ffffff'} />
                  </View>
                  <View>
                    <Text style={[styles.headerTitle, isLight && styles.headerTitleLight, isSwiss && styles.headerTitleSwiss]}>
                      WORKSPACE FILES
                    </Text>
                    <Text
                      style={[styles.headerSubtitle, isLight && styles.headerSubtitleLight, isSwiss && styles.headerSubtitleSwiss]}
                      numberOfLines={1}
                    >
                      {effectivePath || 'Root workspace directory'}
                    </Text>
                  </View>
                </View>

                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={[styles.iconBtn, isLight && styles.iconBtnLight, isSwiss && styles.iconBtnSwiss]}
                    onPress={handleRefresh}
                    disabled={isRefreshing || isLoadingWorkspaceTree}
                    activeOpacity={0.7}
                    accessibilityLabel="Refresh File Tree"
                  >
                    <RefreshCw size={14} color={isSwiss ? '#111010' : isLight ? '#57606a' : '#a3a3a3'} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.iconBtn, isLight && styles.iconBtnLight, isSwiss && styles.iconBtnSwiss]}
                    onPress={handleClose}
                    activeOpacity={0.7}
                    accessibilityLabel="Close"
                  >
                    <X size={15} color={isSwiss ? '#111010' : isLight ? '#57606a' : '#a3a3a3'} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar & Workspace Stats Bar */}
              <View style={styles.searchBarWrapper}>
                <View
                  style={[
                    styles.searchBox,
                    isLight && styles.searchBoxLight,
                    isSwiss && styles.searchBoxSwiss,
                  ]}
                >
                  <Search size={14} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search workspace files…"
                    placeholderTextColor={isSwiss ? '#9C9589' : isLight ? '#686868' : '#737373'}
                    style={[
                      styles.searchInput,
                      isLight && styles.searchInputLight,
                      isSwiss && styles.searchInputSwiss,
                    ]}
                    clearButtonMode="while-editing"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={13} color={isSwiss ? '#6B665E' : '#737373'} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* File Count / Size Summary */}
                <View style={styles.statsRow}>
                  <Text style={[styles.statsText, isLight && styles.statsTextLight, isSwiss && styles.statsTextSwiss]}>
                    {stats.fileCount} files · {stats.dirCount} folders · {formatFileSize(stats.totalBytes)}
                  </Text>
                  {isLoadingWorkspaceTree && (
                    <View style={styles.loadingIndicatorRow}>
                      <ActivityIndicator size="small" color={isSwiss ? '#DC201E' : '#f5f5f5'} />
                      <Text style={[styles.loadingTreeText, isLight && styles.loadingTreeTextLight]}>Syncing…</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Tree View Body */}
            <ScrollView
              style={[styles.scroll, isExpanded && { flex: 1 }, isLight && styles.scrollLight, isSwiss && styles.scrollSwiss]}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              {isLoadingWorkspaceTree && (!workspaceTree || workspaceTree.length === 0) ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={isSwiss ? '#DC201E' : '#f5f5f5'} />
                  <Text style={[styles.loadingTreeText, isLight && styles.loadingTreeTextLight, { marginTop: 12 }]}>
                    Reading workspace tree…
                  </Text>
                </View>
              ) : filteredTree.length === 0 ? (
                <View style={styles.centerContainer}>
                  <FolderTree size={36} color={isSwiss ? '#6B665E' : '#686868'} />
                  <Text style={[styles.emptyTitle, isLight && styles.emptyTitleLight, isSwiss && styles.emptyTitleSwiss]}>
                    {searchQuery ? 'No matching files found' : 'Workspace is empty'}
                  </Text>
                  <Text style={[styles.emptySubtitle, isLight && styles.emptySubtitleLight]}>
                    {searchQuery ? `No files matching "${searchQuery}"` : 'No files found in the current workspace.'}
                  </Text>
                </View>
              ) : (
                <Tree
                  size="sm"
                  selectionMode="single"
                  showLines
                  expandOnPress
                  expanded={expandedPaths}
                  onExpandedChange={setExpandedPaths}
                  onValueChange={handleSelectPath}
                >
                  {filteredTree.map(renderTreeNode)}
                </Tree>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* File Viewer Modal */}
      <FileViewerModal
        visible={Boolean(selectedViewerNode)}
        node={selectedViewerNode}
        onClose={() => setSelectedViewerNode(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheetContainer: {
    backgroundColor: '#191919',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: FULL_HEIGHT,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetContainerLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  sheetContainerSwiss: {
    backgroundColor: '#F8F3EC',
    borderColor: 'rgba(17, 16, 16, 0.16)',
  },
  handleContainer: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dragPillLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  dragPillSwiss: {
    backgroundColor: 'rgba(17, 16, 16, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerLight: {
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerSwiss: {
    borderColor: 'rgba(17, 16, 16, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  iconCircleSwiss: {
    backgroundColor: '#EDE6DB',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#f5f5f5',
  },
  headerTitleLight: {
    color: '#262626',
  },
  headerTitleSwiss: {
    color: '#111010',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#a3a3a3',
    marginTop: 2,
  },
  headerSubtitleLight: {
    color: '#686868',
  },
  headerSubtitleSwiss: {
    color: '#6B665E',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  iconBtnSwiss: {
    backgroundColor: '#EDE6DB',
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
  },
  searchBoxLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  searchBoxSwiss: {
    backgroundColor: '#EDE6DB',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#f5f5f5',
    paddingVertical: 0,
  },
  searchInputLight: {
    color: '#262626',
  },
  searchInputSwiss: {
    color: '#111010',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  statsText: {
    fontSize: 11,
    color: '#a3a3a3',
  },
  statsTextLight: {
    color: '#686868',
  },
  statsTextSwiss: {
    color: '#6B665E',
  },
  loadingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingTreeText: {
    fontSize: 11,
    color: '#a3a3a3',
  },
  loadingTreeTextLight: {
    color: '#686868',
  },
  scroll: {
    flex: 1,
  },
  scrollLight: {
    backgroundColor: '#ffffff',
  },
  scrollSwiss: {
    backgroundColor: '#F8F3EC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 80,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
    marginTop: 8,
  },
  emptyTitleLight: {
    color: '#262626',
  },
  emptyTitleSwiss: {
    color: '#111010',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    textAlign: 'center',
  },
  emptySubtitleLight: {
    color: '#686868',
  },
  nodeActionText: {
    fontSize: 10,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  nodeActionTextLight: {
    color: '#686868',
  },
});
