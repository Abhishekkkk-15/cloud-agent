import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  PanResponder,
  Dimensions,
  StatusBar,
} from 'react-native';
import {
  Folder,
  ChevronRight,
  ArrowUp,
  Home,
  RefreshCw,
  X,
  Search,
  Check,
  FolderGit2,
  HardDrive,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, DirectoryBrowseResult } from '../stores/useDaemonStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOP_INSET = Platform.OS === 'ios' ? 44 : (StatusBar.currentHeight || 28);
const FULL_HEIGHT = SCREEN_HEIGHT - TOP_INSET;
const DEFAULT_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 640);
const SNAP_TOP = 0;
const SNAP_DEFAULT = Math.round(FULL_HEIGHT - DEFAULT_HEIGHT);
const SNAP_CLOSED = FULL_HEIGHT + 60;

interface FolderPickerModalProps {
  visible: boolean;
  initialPath?: string;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  visible,
  initialPath,
  onClose,
  onSelectFolder,
}) => {
  const activeMachine = useDaemonStore((s) => s.activeMachine);
  const browseDirectories = useDaemonStore((s) => s.browseDirectories);

  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [homePath, setHomePath] = useState<string>('');
  const [availableDrives, setAvailableDrives] = useState<string[]>([]);
  const [subdirs, setSubdirs] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(false);
  isExpandedRef.current = isExpanded;

  const translateY = useRef(new Animated.Value(SNAP_CLOSED)).current;
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

  // PanResponder to handle dragging up to expand full screen, or down to collapse/dismiss
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
          } else if (gestureState.dy > 90 || gestureState.vy > 0.45) {
            handleClose();
          } else {
            snapTo(SNAP_DEFAULT, false);
          }
        } else {
          if (gestureState.dy > 60 || gestureState.vy > 0.35) {
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
      setIsExpanded(false);
      currentY.current = SNAP_DEFAULT;
      translateY.setValue(SNAP_CLOSED);
      Animated.spring(translateY, {
        toValue: SNAP_DEFAULT,
        damping: 24,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
      loadDirectory(initialPath);
    } else {
      currentY.current = SNAP_CLOSED;
      translateY.setValue(SNAP_CLOSED);
      setSearchFilter('');
      setIsExpanded(false);
    }
  }, [visible, initialPath]);

  const handleClose = () => {
    currentY.current = SNAP_CLOSED;
    Animated.timing(translateY, {
      toValue: SNAP_CLOSED,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const loadDirectory = async (target?: string) => {
    setIsLoading(true);
    setSearchFilter('');
    const res = await browseDirectories(target);
    if (res) {
      setCurrentPath(res.currentPath);
      setParentPath(res.parentPath);
      setHomePath(res.homePath);
      setSubdirs(res.dirs || []);
      if (res.drives && res.drives.length > 0) {
        setAvailableDrives(res.drives);
      }
    }
    setIsLoading(false);
  };

  const handleSelectCurrent = () => {
    if (currentPath) {
      onSelectFolder(currentPath);
      onClose();
    }
  };

  // Build clickable breadcrumbs from path
  const pathSegments = React.useMemo(() => {
    if (!currentPath) return [];
    const normalized = currentPath.replace(/\\/g, '/');
    const isWin = /^[a-zA-Z]:/.test(normalized);
    const parts = normalized.split('/').filter(Boolean);

    const segments: Array<{ name: string; fullPath: string }> = [];

    if (!isWin) {
      // Root /
      segments.push({ name: '/', fullPath: '/' });
      let accumulated = '';
      for (const p of parts) {
        accumulated += `/${p}`;
        segments.push({ name: p, fullPath: accumulated });
      }
    } else {
      const driveLetter = parts[0].toUpperCase();
      segments.push({ name: driveLetter + '\\', fullPath: driveLetter + '\\' });
      let accumulated = driveLetter + '\\';
      for (let i = 1; i < parts.length; i++) {
        accumulated = accumulated.endsWith('\\') ? accumulated + parts[i] : accumulated + '\\' + parts[i];
        segments.push({ name: parts[i], fullPath: accumulated });
      }
    }
    return segments;
  }, [currentPath]);

  const filteredDirs = subdirs.filter((d) =>
    searchFilter.trim() === ''
      ? true
      : d.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.modalCard,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Top Drag Handle & Header Zone */}
          <View {...panResponder.panHandlers} collapsable={false}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.handleContainer}
              onPress={handleToggleExpand}
            >
              <View style={styles.dragPill} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Folder size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.title}>Browse Remote Folders</Text>
                  <Text style={styles.subtitle}>
                    Select workspace directory on{' '}
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {activeMachine?.name || 'Local Machine'}
                    </Text>
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Navigation & Breadcrumb Toolbar */}
          <View style={styles.navBar}>
            <View style={styles.navActions}>
              <TouchableOpacity
                style={[styles.navActionBtn, !parentPath && styles.navActionBtnDisabled]}
                onPress={() => parentPath && loadDirectory(parentPath)}
                disabled={!parentPath || isLoading}
                activeOpacity={0.7}
              >
                <ArrowUp size={15} color={parentPath ? '#fafafa' : '#484f58'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navActionBtn}
                onPress={() => loadDirectory(homePath)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Home size={15} color="#fafafa" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navActionBtn}
                onPress={() => loadDirectory(currentPath)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <RefreshCw size={14} color="#fafafa" />
              </TouchableOpacity>
            </View>

            {/* Clickable Breadcrumbs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.breadcrumbsScroll}
            >
              {pathSegments.map((seg, idx) => (
                <View key={seg.fullPath} style={styles.breadcrumbItem}>
                  <TouchableOpacity
                    onPress={() => loadDirectory(seg.fullPath)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.breadcrumbText,
                        idx === pathSegments.length - 1 && styles.breadcrumbTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {seg.name}
                    </Text>
                  </TouchableOpacity>
                  {idx < pathSegments.length - 1 && (
                    <Text style={styles.breadcrumbSep}>/</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Drives / Partitions Selector Bar */}
          {availableDrives.length > 0 && (
            <View style={styles.drivesBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.drivesScroll}
              >
                {availableDrives.map((drive) => {
                  const normCurr = currentPath.toLowerCase().replace(/\\/g, '/');
                  const normDrive = drive.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
                  const isCurrent =
                    normCurr.startsWith(normDrive + '/') ||
                    normCurr === normDrive ||
                    normCurr.startsWith(normDrive);
                  return (
                    <TouchableOpacity
                      key={drive}
                      style={[styles.driveChip, isCurrent && styles.driveChipActive]}
                      onPress={() => loadDirectory(drive)}
                      activeOpacity={0.7}
                    >
                      <HardDrive size={12} color={isCurrent ? '#fafafa' : '#a3a3a3'} />
                      <Text style={[styles.driveChipText, isCurrent && styles.driveChipTextActive]}>
                        {drive}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Quick Search in Current Folder */}
          <View style={styles.searchContainer}>
            <Search size={14} color="#a3a3a3" />
            <TextInput
              style={styles.searchInput}
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Filter folders in this directory..."
              placeholderTextColor="#737373"
            />
            {searchFilter.length > 0 && (
              <TouchableOpacity onPress={() => setSearchFilter('')}>
                <X size={14} color="#a3a3a3" />
              </TouchableOpacity>
            )}
          </View>

          {/* Folder List */}
          <ScrollView
            style={styles.folderList}
            contentContainerStyle={styles.folderListContent}
            showsVerticalScrollIndicator={false}
          >
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Reading directories...</Text>
              </View>
            ) : filteredDirs.length === 0 ? (
              <View style={styles.emptyBox}>
                <Folder size={32} color="rgba(255, 255, 255, 0.10)" />
                <Text style={styles.emptyTitle}>No subdirectories</Text>
                <Text style={styles.emptySubtitle}>
                  You can choose this current folder as your workspace.
                </Text>
              </View>
            ) : (
              filteredDirs.map((dir) => (
                <TouchableOpacity
                  key={dir.fullPath}
                  style={styles.folderRow}
                  onPress={() => loadDirectory(dir.fullPath)}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderIconBox}>
                    <Folder size={17} color={colors.primary} />
                  </View>
                  <Text style={styles.folderName} numberOfLines={1}>
                    {dir.name}
                  </Text>
                  <ChevronRight size={15} color="#737373" />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Footer: Confirm Selection */}
          <View style={styles.footer}>
            <View style={styles.selectedRow}>
              <Text style={styles.selectedLabel}>Target:</Text>
              <Text style={styles.selectedPath} numberOfLines={1}>
                {currentPath || 'None'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.selectBtn, !currentPath && styles.selectBtnDisabled]}
              onPress={handleSelectCurrent}
              disabled={!currentPath}
              activeOpacity={0.85}
            >
              <Check size={16} color={!currentPath ? '#737373' : '#0a0a0a'} />
              <Text style={[styles.selectBtnText, !currentPath && { color: '#737373' }]}>Select This Folder</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    height: FULL_HEIGHT,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: radii.xl || 20,
    borderTopRightRadius: radii.xl || 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fafafa',
  },
  subtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navActionBtnDisabled: {
    opacity: 0.4,
  },
  breadcrumbsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbText: {
    fontSize: 12.5,
    color: '#a3a3a3',
    fontFamily: typography.mono,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  breadcrumbTextActive: {
    color: '#fafafa',
    fontWeight: '700',
  },
  breadcrumbSep: {
    color: '#484f58',
    fontSize: 12,
  },
  drivesBar: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#121212',
  },
  drivesScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  driveChipActive: {
    backgroundColor: 'rgba(0, 119, 182, 0.22)',
    borderColor: '#0077b6',
  },
  driveChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a3a3a3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  driveChipTextActive: {
    color: '#fafafa',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#fafafa',
    padding: 0,
  },
  folderList: {
    flex: 1,
  },
  folderListContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    marginBottom: 2,
  },
  folderIconBox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  folderName: {
    flex: 1,
    fontSize: 13.5,
    color: '#fafafa',
    fontWeight: '500',
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#a3a3a3',
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a3a3a3',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#737373',
    textAlign: 'center',
    maxWidth: 240,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    backgroundColor: '#121212',
    gap: 10,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedLabel: {
    fontSize: 12,
    color: '#a3a3a3',
    fontWeight: '600',
  },
  selectedPath: {
    flex: 1,
    fontSize: 12,
    color: '#d4d4d4',
    fontFamily: typography.mono,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    height: 44,
    gap: 8,
  },
  selectBtnDisabled: {
    backgroundColor: '#262626',
    opacity: 0.6,
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
