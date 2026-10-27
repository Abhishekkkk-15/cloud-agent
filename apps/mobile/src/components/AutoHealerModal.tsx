import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import {
  X,
  Bug,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Terminal,
  FileCode,
  Share2,
  Trash2,
  ArrowRight,
  GitMerge,
  Sparkles,
} from './Icons';
import { colors, radii, typography } from '../theme/tokens';
import {
  useDaemonStore,
  type AutoHealerProposal,
  type AutoPrReviewReport,
} from '../stores/useDaemonStore';
import { DiffViewer } from './DiffViewer';

interface AutoHealerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AutoHealerModal: React.FC<AutoHealerModalProps> = ({ visible, onClose }) => {
  const activeProposal = useDaemonStore((s) => s.activeProposal);
  const activePrReview = useDaemonStore((s) => s.activePrReview);
  const approveAutoHealerProposal = useDaemonStore((s) => s.approveAutoHealerProposal);
  const postPrReviewToGitHub = useDaemonStore((s) => s.postPrReviewToGitHub);
  const dismissAutoHealer = useDaemonStore((s) => s.dismissAutoHealer);

  const [activeTab, setActiveTab] = useState<'diff' | 'tests' | 'details' | 'review'>('diff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Determine current mode
  const isPrReviewMode = Boolean(!activeProposal && activePrReview);
  const currentTitle = isPrReviewMode
    ? `PR #${activePrReview?.prNumber}: ${activePrReview?.prTitle}`
    : activeProposal?.title || 'Autonomous Incident Repair';

  const handleApproveAction = async (action: 'pr' | 'merge' | 'discard') => {
    if (!activeProposal) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await approveAutoHealerProposal(activeProposal.incidentId, action);
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setTimeout(() => {
          dismissAutoHealer();
          onClose();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Action failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostReview = async () => {
    if (!activePrReview) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await postPrReviewToGitHub(
        activePrReview.prNumber,
        activePrReview.verdict,
        activePrReview.fullMarkdown
      );
      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message });
        setTimeout(() => {
          dismissAutoHealer();
          onClose();
        }, 1500);
      } else {
        setStatusMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Posting review failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async () => {
    try {
      const content = isPrReviewMode
        ? activePrReview?.fullMarkdown || ''
        : `Autonomous Auto-Healer Fix for ${activeProposal?.title}\n\nBranch: ${activeProposal?.branchName}\n\nDiff:\n${activeProposal?.diff}`;
      await Share.share({ message: content });
    } catch {}
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalCard}>
              {/* 1. Modal Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIconBox}>
                    {isPrReviewMode ? (
                      <GitPullRequest size={18} color="#0077b6" />
                    ) : (
                      <Bug size={18} color="#f85149" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.headerBadge}>
                        {isPrReviewMode ? 'AUTONOMOUS PR REVIEW' : 'ON-CALL AUTO-HEALER'}
                      </Text>
                      {activeProposal?.source && (
                        <View style={styles.sourcePill}>
                          <Text style={styles.sourcePillText}>{activeProposal.source.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                      {currentTitle}
                    </Text>
                  </View>
                </View>

                <View style={styles.headerRight}>
                  <TouchableOpacity
                    style={styles.headerActionBtn}
                    onPress={handleShare}
                    activeOpacity={0.7}
                  >
                    <Share2 size={16} color="#8b949e" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerActionBtn}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <X size={18} color="#8b949e" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status Alert Banner */}
              {statusMessage && (
                <View
                  style={[
                    styles.statusAlert,
                    statusMessage.type === 'success'
                      ? styles.statusAlertSuccess
                      : styles.statusAlertError,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusAlertText,
                      statusMessage.type === 'success'
                        ? styles.statusAlertTextSuccess
                        : styles.statusAlertTextError,
                    ]}
                  >
                    {statusMessage.text}
                  </Text>
                </View>
              )}

              {/* 2. Mode Specific Banners */}
              {!isPrReviewMode && activeProposal && (
                <View style={styles.verificationBanner}>
                  <ShieldCheck size={16} color="#3fb950" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.verificationTitle}>
                      {activeProposal.testsPassed ? 'Fix Verified: Test Suite Passing' : 'Fix Applied: Manual Review Advised'}
                    </Text>
                    <Text style={styles.verificationSubtitle}>
                      Isolated Branch: <Text style={{ color: '#58a6ff', fontFamily: typography.mono }}>{activeProposal.branchName}</Text>
                    </Text>
                  </View>
                  <View style={[styles.testBadge, activeProposal.testsPassed ? styles.testBadgePass : styles.testBadgeFail]}>
                    <Text style={[styles.testBadgeText, activeProposal.testsPassed ? styles.testBadgeTextPass : styles.testBadgeTextFail]}>
                      {activeProposal.testsPassed ? 'TESTS OK' : 'CHECK FAILS'}
                    </Text>
                  </View>
                </View>
              )}

              {isPrReviewMode && activePrReview && (
                <View style={styles.verdictBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {activePrReview.verdict === 'APPROVE' ? (
                      <CheckCircle2 size={18} color="#3fb950" />
                    ) : (
                      <AlertCircle size={18} color="#f85149" />
                    )}
                    <View>
                      <Text style={styles.verdictTitle}>Review Verdict: {activePrReview.verdict}</Text>
                      <Text style={styles.verdictSubtitle}>
                        {activePrReview.baseBranch} ← {activePrReview.headBranch} by @{activePrReview.author}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.verdictPill,
                      activePrReview.verdict === 'APPROVE'
                        ? styles.verdictPillApprove
                        : styles.verdictPillChanges,
                    ]}
                  >
                    <Text
                      style={[
                        styles.verdictPillText,
                        activePrReview.verdict === 'APPROVE'
                          ? styles.verdictPillTextApprove
                          : styles.verdictPillTextChanges,
                      ]}
                    >
                      {activePrReview.verdict}
                    </Text>
                  </View>
                </View>
              )}

              {/* 3. Navigation Tabs */}
              <View style={styles.tabBar}>
                {!isPrReviewMode ? (
                  <>
                    <TouchableOpacity
                      style={[styles.tabItem, activeTab === 'diff' && styles.tabItemActive]}
                      onPress={() => setActiveTab('diff')}
                      activeOpacity={0.7}
                    >
                      <FileCode size={13} color={activeTab === 'diff' ? '#0077b6' : '#8b949e'} />
                      <Text style={[styles.tabText, activeTab === 'diff' && styles.tabTextActive]}>
                        Changes Diff
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.tabItem, activeTab === 'tests' && styles.tabItemActive]}
                      onPress={() => setActiveTab('tests')}
                      activeOpacity={0.7}
                    >
                      <Terminal size={13} color={activeTab === 'tests' ? '#0077b6' : '#8b949e'} />
                      <Text style={[styles.tabText, activeTab === 'tests' && styles.tabTextActive]}>
                        Test Runner
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.tabItem, activeTab === 'details' && styles.tabItemActive]}
                      onPress={() => setActiveTab('details')}
                      activeOpacity={0.7}
                    >
                      <Bug size={13} color={activeTab === 'details' ? '#0077b6' : '#8b949e'} />
                      <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
                        Incident Details
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.tabItem, activeTab === 'review' && styles.tabItemActive]}
                      onPress={() => setActiveTab('review')}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={13} color={activeTab === 'review' ? '#0077b6' : '#8b949e'} />
                      <Text style={[styles.tabText, activeTab === 'review' && styles.tabTextActive]}>
                        Review Report
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* 4. Tab Contents */}
              <ScrollView style={styles.scrollContent} contentContainerStyle={{ padding: 14 }}>
                {/* Tab: Changes Diff */}
                {!isPrReviewMode && activeTab === 'diff' && activeProposal && (
                  <View style={{ gap: 8 }}>
                    <Text style={styles.diffHeader}>UNIFIED GIT PATCH</Text>
                    <DiffViewer diffText={activeProposal.diff} maxHeight={360} collapsible={false} />
                  </View>
                )}

                {/* Tab: Test Runner */}
                {!isPrReviewMode && activeTab === 'tests' && activeProposal && (
                  <View style={styles.terminalBox}>
                    <View style={styles.terminalHeader}>
                      <Terminal size={13} color="#8b949e" />
                      <Text style={styles.terminalTitle}>Command: {activeProposal.testCommand}</Text>
                    </View>
                    <ScrollView horizontal>
                      <Text style={styles.terminalOutput}>{activeProposal.testOutput}</Text>
                    </ScrollView>
                  </View>
                )}

                {/* Tab: Incident Details */}
                {!isPrReviewMode && activeTab === 'details' && activeProposal && (
                  <View style={styles.detailsCard}>
                    <Text style={styles.detailsSectionTitle}>Reported Problem</Text>
                    <Text style={styles.detailsBodyText}>{activeProposal.description}</Text>
                    {activeProposal.url && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={styles.detailsSectionTitle}>Source URL</Text>
                        <Text style={{ color: '#58a6ff', fontSize: 12 }}>{activeProposal.url}</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* PR Review Report */}
                {isPrReviewMode && activePrReview && (
                  <View style={{ gap: 12 }}>
                    {/* Summary Card */}
                    <View style={styles.detailsCard}>
                      <Text style={styles.detailsSectionTitle}>Executive Summary</Text>
                      <Text style={styles.detailsBodyText}>{activePrReview.summary}</Text>
                    </View>

                    {/* Security Risks */}
                    {activePrReview.securityRisks?.length > 0 && (
                      <View style={[styles.detailsCard, { borderColor: 'rgba(248, 81, 73, 0.4)' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <AlertCircle size={14} color="#f85149" />
                          <Text style={[styles.detailsSectionTitle, { color: '#f85149', marginBottom: 0 }]}>
                            Security & Critical Risks
                          </Text>
                        </View>
                        {activePrReview.securityRisks.map((risk, idx) => (
                          <Text key={idx} style={{ color: '#c9d1d9', fontSize: 12, lineHeight: 18 }}>
                            • {risk}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* Line Comments */}
                    {activePrReview.lineComments?.length > 0 && (
                      <View style={{ gap: 8 }}>
                        <Text style={styles.detailsSectionTitle}>Line-by-Line Suggestions</Text>
                        {activePrReview.lineComments.map((c, idx) => (
                          <View key={idx} style={styles.lineCommentCard}>
                            <Text style={styles.lineCommentFile}>
                              {c.file}:{c.line}
                            </Text>
                            <Text style={styles.lineCommentText}>{c.comment}</Text>
                            {c.suggestion && (
                              <View style={styles.suggestionBox}>
                                <Text style={styles.suggestionCode}>{c.suggestion}</Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Full Markdown Review */}
                    <View style={styles.detailsCard}>
                      <Text style={styles.detailsSectionTitle}>Full Review Notes</Text>
                      <Text style={styles.detailsBodyText}>{activePrReview.fullMarkdown}</Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* 5. Action Footer */}
              <View style={styles.footer}>
                {!isPrReviewMode ? (
                  <>
                    <TouchableOpacity
                      style={styles.discardBtn}
                      onPress={() => handleApproveAction('discard')}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={13} color="#f85149" />
                      <Text style={styles.discardBtnText}>Discard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.mergeBtn}
                      onPress={() => handleApproveAction('merge')}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <GitMerge size={13} color="#c9d1d9" />
                      <Text style={styles.mergeBtnText}>Merge Locally</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, isSubmitting && { opacity: 0.6 }]}
                      onPress={() => handleApproveAction('pr')}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <GitPullRequest size={14} color="#ffffff" />
                          <Text style={styles.primaryActionBtnText}>Approve & PR</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.discardBtn}
                      onPress={onClose}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.discardBtnText}>Dismiss</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.primaryActionBtn, isSubmitting && { opacity: 0.6 }]}
                      onPress={handlePostReview}
                      disabled={isSubmitting}
                      activeOpacity={0.7}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <GitPullRequest size={14} color="#ffffff" />
                          <Text style={styles.primaryActionBtnText}>Post to GitHub</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(1, 4, 9, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '88%',
    backgroundColor: '#0d1117',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    fontSize: 10,
    color: '#0077b6',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sourcePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#21262d',
  },
  sourcePillText: {
    fontSize: 9,
    color: '#8b949e',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0f6fc',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    padding: 6,
    borderRadius: 6,
  },
  statusAlert: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statusAlertSuccess: {
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
    borderBottomColor: 'rgba(63, 185, 80, 0.3)',
  },
  statusAlertError: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderBottomColor: 'rgba(248, 81, 73, 0.3)',
  },
  statusAlertText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusAlertTextSuccess: {
    color: '#3fb950',
  },
  statusAlertTextError: {
    color: '#f85149',
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(63, 185, 80, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(63, 185, 80, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  verificationTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3fb950',
  },
  verificationSubtitle: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 1,
  },
  testBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  testBadgePass: {
    backgroundColor: 'rgba(63, 185, 80, 0.2)',
  },
  testBadgeFail: {
    backgroundColor: 'rgba(248, 81, 73, 0.2)',
  },
  testBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  testBadgeTextPass: {
    color: '#3fb950',
  },
  testBadgeTextFail: {
    color: '#f85149',
  },
  verdictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 119, 182, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 119, 182, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  verdictTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f0f6fc',
  },
  verdictSubtitle: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 1,
  },
  verdictPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  verdictPillApprove: {
    backgroundColor: 'rgba(63, 185, 80, 0.15)',
    borderColor: 'rgba(63, 185, 80, 0.4)',
  },
  verdictPillChanges: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderColor: 'rgba(248, 81, 73, 0.4)',
  },
  verdictPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  verdictPillTextApprove: {
    color: '#3fb950',
  },
  verdictPillTextChanges: {
    color: '#f85149',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0077b6',
  },
  tabText: {
    fontSize: 12,
    color: '#8b949e',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#f0f6fc',
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  diffHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b949e',
    letterSpacing: 0.5,
  },
  terminalBox: {
    backgroundColor: '#010409',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#21262d',
    padding: 10,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    marginBottom: 8,
  },
  terminalTitle: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
  },
  terminalOutput: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: '#3fb950',
    lineHeight: 16,
  },
  detailsCard: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    borderRadius: 8,
    padding: 12,
  },
  detailsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailsBodyText: {
    fontSize: 12,
    color: '#c9d1d9',
    lineHeight: 18,
  },
  lineCommentCard: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  lineCommentFile: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: '#58a6ff',
    fontWeight: '600',
  },
  lineCommentText: {
    fontSize: 12,
    color: '#f0f6fc',
  },
  suggestionBox: {
    backgroundColor: '#010409',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#21262d',
    marginTop: 4,
  },
  suggestionCode: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: '#48cae4',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
    backgroundColor: '#161b22',
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#21262d',
  },
  discardBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#f85149',
  },
  mergeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#21262d',
  },
  mergeBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#c9d1d9',
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0077b6',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});
