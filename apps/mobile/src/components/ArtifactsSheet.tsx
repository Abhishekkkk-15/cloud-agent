import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import {
  X,
  Layers,
  FileText,
  Code2,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Search,
  Sparkles,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';
import { MarkdownText } from './MarkdownText';
import type { CliArtifact } from '@cloud-agent/cli-interface';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ArtifactsSheetProps {
  visible: boolean;
  onClose: () => void;
  initialSearchQuery?: string;
}

export const ArtifactsSheet: React.FC<ArtifactsSheetProps> = ({
  visible,
  onClose,
  initialSearchQuery = '',
}) => {
  const sessionArtifacts = useDaemonStore((s) => s.sessionArtifacts);
  const isLoadingArtifacts = useDaemonStore((s) => s.isLoadingArtifacts);
  const fetchSessionArtifacts = useDaemonStore((s) => s.fetchSessionArtifacts);
  const fetchArtifactContent = useDaemonStore((s) => s.fetchArtifactContent);
  const isLoadingArtifactContent = useDaemonStore((s) => s.isLoadingArtifactContent);

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedArtifact, setSelectedArtifact] = useState<CliArtifact | null>(null);
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (visible) {
      setSearchQuery(initialSearchQuery);
      setSelectedArtifact(null);
      setContent('');
      setViewMode('preview');
      fetchSessionArtifacts().catch(() => {});
    }
  }, [visible, initialSearchQuery]);

  const handleSelectArtifact = async (artifact: CliArtifact) => {
    setSelectedArtifact(artifact);
    setViewMode('preview');
    const text = await fetchArtifactContent(artifact.path);
    setContent(text);
  };

  const handleBackToList = () => {
    setSelectedArtifact(null);
    setContent('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSessionArtifacts();
    if (selectedArtifact) {
      const text = await fetchArtifactContent(selectedArtifact.path);
      setContent(text);
    }
    setIsRefreshing(false);
  };

  const handleCopy = () => {
    if (!content) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredArtifacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessionArtifacts;
    return sessionArtifacts.filter((item) => {
      const titleMatch = (item.title || item.id || '').toLowerCase().includes(q);
      const summaryMatch = (item.summary || '').toLowerCase().includes(q);
      const extMatch = (item.language || '').toLowerCase().includes(q);
      return titleMatch || summaryMatch || extMatch;
    });
  }, [sessionArtifacts, searchQuery]);

  if (!visible) return null;

  const renderIconForArtifact = (item: CliArtifact) => {
    const lang = (item.language || '').toLowerCase();
    if (lang === 'md' || lang === 'markdown') {
      return <FileText size={16} color="#fafafa" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'json', 'yaml', 'yml'].includes(lang)) {
      return <Code2 size={16} color="#fafafa" />;
    }
    return <Layers size={16} color="#fafafa" />;
  };

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

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            {selectedArtifact ? (
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBackToList}
                activeOpacity={0.7}
              >
                <ArrowLeft size={16} color="#fafafa" />
                <Text style={styles.backButtonText}>All Artifacts</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerLeft}>
                <View style={styles.headerIconBox}>
                  <Layers size={18} color="#fafafa" />
                </View>
                <View>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>Session Artifacts</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{sessionArtifacts.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.subtitle}>Plans, reports, and generated specs</Text>
                </View>
              </View>
            )}

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleRefresh}
                activeOpacity={0.7}
                disabled={isRefreshing || isLoadingArtifacts}
              >
                <RefreshCw
                  size={16}
                  color={isRefreshing ? '#fafafa' : '#a3a3a3'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={18} color="#a3a3a3" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Modal Body */}
          {selectedArtifact ? (
            // ================== 1. READER VIEW ==================
            <View style={styles.readerWrapper}>
              {/* Reader Subheader */}
              <View style={styles.readerSubHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.readerTitle} numberOfLines={1}>
                    {selectedArtifact.title || selectedArtifact.id}
                  </Text>
                  <Text style={styles.readerMeta}>
                    {selectedArtifact.language ? selectedArtifact.language.toUpperCase() : 'DOCUMENT'} • {selectedArtifact.path ? selectedArtifact.path.split(/[/\\]/).pop() : ''}
                  </Text>
                </View>

                {/* View Mode Toggle */}
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    style={[styles.modeTab, viewMode === 'preview' && styles.modeTabActive]}
                    onPress={() => setViewMode('preview')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modeTabText, viewMode === 'preview' && styles.modeTabTextActive]}>
                      Preview
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeTab, viewMode === 'source' && styles.modeTabActive]}
                    onPress={() => setViewMode('source')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modeTabText, viewMode === 'source' && styles.modeTabTextActive]}>
                      Source
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Copy Button */}
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={handleCopy}
                  activeOpacity={0.7}
                  disabled={!content}
                >
                  {copied ? (
                    <Check size={14} color="#fafafa" />
                  ) : (
                    <Copy size={14} color="#a3a3a3" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Reader Scrollable Content */}
              {isLoadingArtifactContent ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#fafafa" />
                  <Text style={styles.loadingText}>Loading artifact content...</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.readerScroll}
                  contentContainerStyle={styles.readerContentContainer}
                  showsVerticalScrollIndicator={true}
                >
                  {/* Summary Card if present */}
                  {selectedArtifact.summary ? (
                    <View style={styles.summaryBox}>
                      <View style={styles.summaryHeader}>
                        <Sparkles size={13} color="#fafafa" />
                        <Text style={styles.summaryTitle}>Summary</Text>
                      </View>
                      <Text style={styles.summaryText}>{selectedArtifact.summary}</Text>
                    </View>
                  ) : null}

                  {/* Rendered or Raw Monospace */}
                  {viewMode === 'preview' ? (
                    <MarkdownText content={content || '*(Empty file)*'} />
                  ) : (
                    <View style={styles.sourceBox}>
                      <Text style={styles.sourceText} selectable>
                        {content || '(Empty file)'}
                      </Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </View>
          ) : (
            // ================== 2. LIST VIEW ==================
            <View style={styles.listWrapper}>
              {/* Search Filter Bar */}
              <View style={styles.searchBarContainer}>
                <Search size={15} color="#a3a3a3" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Filter artifacts by title, summary, or type..."
                  placeholderTextColor="#737373"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {searchQuery ? (
                  <TouchableOpacity
                    onPress={() => setSearchQuery('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={14} color="#a3a3a3" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Artifacts List */}
              {isLoadingArtifacts && sessionArtifacts.length === 0 ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#fafafa" />
                  <Text style={styles.loadingText}>Fetching session artifacts...</Text>
                </View>
              ) : filteredArtifacts.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBox}>
                    <Layers size={28} color="#fafafa" />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {searchQuery ? 'No matching artifacts' : 'No artifacts created yet'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery
                      ? `No artifacts matching "${searchQuery}" in this session.`
                      : 'When the agent generates implementation plans, markdown reports, or diagrams, they will appear here.'}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.listScroll}
                  contentContainerStyle={styles.listContentContainer}
                  showsVerticalScrollIndicator={false}
                >
                  {filteredArtifacts.map((item) => {
                    const ext = (item.language || item.path.split('.').pop() || 'file').toUpperCase();
                    return (
                      <TouchableOpacity
                        key={item.id || item.path}
                        style={styles.artifactCard}
                        onPress={() => handleSelectArtifact(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.cardIconBox}>
                          {renderIconForArtifact(item)}
                        </View>

                        <View style={styles.cardDetails}>
                          <View style={styles.cardTitleRow}>
                            <Text style={styles.cardTitle} numberOfLines={1}>
                              {item.title || item.id}
                            </Text>
                            <View style={styles.extBadge}>
                              <Text style={styles.extBadgeText}>{ext}</Text>
                            </View>
                          </View>

                          {item.summary ? (
                            <Text style={styles.cardSummary} numberOfLines={2}>
                              {item.summary}
                            </Text>
                          ) : (
                            <Text style={styles.cardPath} numberOfLines={1}>
                              {item.path.split(/[/\\]/).pop()}
                            </Text>
                          )}
                        </View>

                        <ChevronRight size={16} color="#737373" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: radii.xl || 20,
    borderTopRightRadius: radii.xl || 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    height: Math.min(SCREEN_HEIGHT * 0.85, 720),
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#161616',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fafafa',
  },
  countBadge: {
    backgroundColor: '#fafafa',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#a3a3a3',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#262626',
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fafafa',
  },
  listWrapper: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 19,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#fafafa',
    paddingVertical: 0,
  },
  listScroll: {
    flex: 1,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
  artifactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fafafa',
  },
  extBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  extBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fafafa',
  },
  cardSummary: {
    fontSize: 12,
    color: '#a3a3a3',
    lineHeight: 16,
  },
  cardPath: {
    fontSize: 11,
    color: '#737373',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fafafa',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#a3a3a3',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 13,
    color: '#a3a3a3',
  },
  readerWrapper: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  readerSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderColor: '#262626',
  },
  readerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fafafa',
  },
  readerMeta: {
    fontSize: 11,
    color: '#a3a3a3',
    marginTop: 1,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 2,
    marginRight: 8,
  },
  modeTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: '#fafafa',
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a3a3a3',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerScroll: {
    flex: 1,
  },
  readerContentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fafafa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 13,
    color: '#d4d4d4',
    lineHeight: 18,
  },
  sourceBox: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 12,
  },
  sourceText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d4d4d4',
    lineHeight: 18,
  },
});
