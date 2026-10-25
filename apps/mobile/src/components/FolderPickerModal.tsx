import React, { useState, useEffect } from 'react';
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
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore, DirectoryBrowseResult } from '../stores/useDaemonStore';

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
  const [subdirs, setSubdirs] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (visible) {
      loadDirectory(initialPath);
    } else {
      setSearchFilter('');
    }
  }, [visible, initialPath]);

  const loadDirectory = async (target?: string) => {
    setIsLoading(true);
    setSearchFilter('');
    const res = await browseDirectories(target);
    if (res) {
      setCurrentPath(res.currentPath);
      setParentPath(res.parentPath);
      setHomePath(res.homePath);
      setSubdirs(res.dirs || []);
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
      let accumulated = parts[0];
      segments.push({ name: parts[0], fullPath: parts[0] + '/' });
      for (let i = 1; i < parts.length; i++) {
        accumulated += `/${parts[i]}`;
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.modalCard}>
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
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#8b949e" />
            </TouchableOpacity>
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
                <ArrowUp size={15} color={parentPath ? '#f0f6fc' : '#484f58'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navActionBtn}
                onPress={() => loadDirectory(homePath)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Home size={15} color="#f0f6fc" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navActionBtn}
                onPress={() => loadDirectory(currentPath)}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <RefreshCw size={14} color="#f0f6fc" />
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

          {/* Quick Search in Current Folder */}
          <View style={styles.searchContainer}>
            <Search size={14} color="#8b949e" />
            <TextInput
              style={styles.searchInput}
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Filter folders in this directory..."
              placeholderTextColor="#6e7681"
            />
            {searchFilter.length > 0 && (
              <TouchableOpacity onPress={() => setSearchFilter('')}>
                <X size={14} color="#8b949e" />
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
                <Folder size={32} color="#30363d" />
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
                  <ChevronRight size={15} color="#6e7681" />
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
              <Check size={16} color="#ffffff" />
              <Text style={styles.selectBtnText}>Select This Folder</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: '#0d1117',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
    maxHeight: '88%',
    minHeight: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
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
    color: '#f0f6fc',
  },
  subtitle: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161b22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
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
    backgroundColor: '#21262d',
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
    color: '#8b949e',
    fontFamily: typography.mono,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  breadcrumbTextActive: {
    color: '#f0f6fc',
    fontWeight: '700',
  },
  breadcrumbSep: {
    color: '#484f58',
    fontSize: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010409',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#f0f6fc',
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
    color: '#f0f6fc',
    fontWeight: '500',
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#8b949e',
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b949e',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6e7681',
    textAlign: 'center',
    maxWidth: 240,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#010409',
    gap: 10,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedLabel: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '600',
  },
  selectedPath: {
    flex: 1,
    fontSize: 12,
    color: '#c9d1d9',
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
    backgroundColor: '#21262d',
    opacity: 0.6,
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
