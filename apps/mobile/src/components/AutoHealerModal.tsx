import React, { useState } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Share,
  useWindowDimensions,
} from 'react-native';
import {
  Dialog,
  Tabs,
  Button,
  Badge,
  Card,
  Text,
  cn,
} from 'panelui-native';
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
  GitMerge,
  Sparkles,
} from './Icons';
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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const { height: windowHeight } = useWindowDimensions();
  const modalHeight = Math.min(680, Math.round(windowHeight * 0.85));

  const [activeTab, setActiveTab] = useState<'diff' | 'tests' | 'details' | 'review'>('diff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Determine current mode
  const isPrReviewMode = Boolean(!activeProposal && activePrReview);
  const currentTitle = isPrReviewMode
    ? `PR #${activePrReview?.prNumber}: ${activePrReview?.prTitle}`
    : activeProposal?.title || 'Incident Repair';

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
        : `Fix proposal for ${activeProposal?.title}\n\nBranch: ${activeProposal?.branchName}\n\nDiff:\n${activeProposal?.diff}`;
      await Share.share({ message: content });
    } catch {}
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content
        className="w-full max-w-lg bg-popover border border-border p-0 overflow-hidden rounded-2xl flex-col"
        style={{ height: modalHeight }}
      >
        {/* 1. Modal Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-row items-center gap-2.5 flex-1 mr-2">
            <View className={cn(
              "w-8 h-8 rounded-lg items-center justify-center border",
              isPrReviewMode
                ? "bg-primary/10 border-primary/20"
                : "bg-destructive/10 border-destructive/20"
            )}>
              {isPrReviewMode ? (
                <GitPullRequest size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#fafafa'} />
              ) : (
                <Bug size={16} color="#ef4444" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5 mb-0.5">
                <Badge variant={isPrReviewMode ? 'outline' : 'destructive'} size="xs">
                  {isPrReviewMode ? 'PR Review' : 'Incident Repair'}
                </Badge>
                {activeProposal?.source && (
                  <Badge variant="secondary" size="xs">
                    {activeProposal.source.toUpperCase()}
                  </Badge>
                )}
              </View>
              <Dialog.Title className="text-base font-semibold text-foreground" numberOfLines={1}>
                {currentTitle}
              </Dialog.Title>
            </View>
          </View>

          <View className="flex-row items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              onPress={handleShare}
            >
              <Share2 size={14} color={isLight ? '#686868' : '#a3a3a3'} />
            </Button>
            <Dialog.Close>
              <Button
                variant="ghost"
                size="sm"
                className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              >
                <X size={15} color={isLight ? '#686868' : '#a3a3a3'} />
              </Button>
            </Dialog.Close>
          </View>
        </View>

        {/* Status Alert Banner */}
        {statusMessage && (
          <View
            className={cn(
              "mx-4 mt-3 px-3.5 py-2.5 rounded-xl border flex-row items-center gap-2",
              statusMessage.type === 'success'
                ? "bg-success/10 border-success/30"
                : "bg-destructive/10 border-destructive/30"
            )}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 size={15} color="#10b981" />
            ) : (
              <AlertCircle size={15} color="#ef4444" />
            )}
            <Text
              className={cn(
                "text-xs font-medium flex-1",
                statusMessage.type === 'success' ? "text-success" : "text-destructive"
              )}
            >
              {statusMessage.text}
            </Text>
          </View>
        )}

        {/* 2. Mode Specific Banners */}
        {!isPrReviewMode && activeProposal && (
          <View className="mx-4 mt-3 p-3 rounded-xl bg-surface-secondary border border-border flex-row items-center gap-2.5">
            <ShieldCheck size={18} color={activeProposal.testsPassed ? '#10b981' : '#ef4444'} />
            <View className="flex-1">
              <Text className="text-xs font-semibold text-foreground">
                {activeProposal.testsPassed ? 'Fix Verified: Test Suite Passing' : 'Fix Applied: Manual Review Advised'}
              </Text>
              <Text className="text-[11px] text-muted-foreground mt-0.5">
                Branch: <Text className="text-[11px] font-mono text-primary font-semibold">{activeProposal.branchName}</Text>
              </Text>
            </View>
            <Badge variant={activeProposal.testsPassed ? 'success' : 'destructive'} size="xs">
              {activeProposal.testsPassed ? 'TESTS OK' : 'CHECK FAILS'}
            </Badge>
          </View>
        )}

        {isPrReviewMode && activePrReview && (
          <View className="mx-4 mt-3 p-3 rounded-xl bg-surface-secondary border border-border flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5 flex-1 mr-2">
              {activePrReview.verdict === 'APPROVE' ? (
                <CheckCircle2 size={18} color="#10b981" />
              ) : (
                <AlertCircle size={18} color="#ef4444" />
              )}
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">
                  Review Verdict: {activePrReview.verdict}
                </Text>
                <Text className="text-[11px] text-muted-foreground mt-0.5" numberOfLines={1}>
                  {activePrReview.baseBranch} ← {activePrReview.headBranch} by @{activePrReview.author}
                </Text>
              </View>
            </View>
            <Badge variant={activePrReview.verdict === 'APPROVE' ? 'success' : 'destructive'} size="xs">
              {activePrReview.verdict}
            </Badge>
          </View>
        )}

        {/* 3. Navigation Tabs */}
        <View className="px-4 pt-3">
          {!isPrReviewMode ? (
            <Tabs
              defaultValue="diff"
              value={activeTab}
              size="xs"
              onValueChange={(val) => setActiveTab(val as any)}
              className="w-full"
            >
              <Tabs.List className="w-full bg-surface-secondary border border-border p-1 rounded-xl">
                <Tabs.Trigger
                  value="diff"
                  className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
                >
                  <FileCode size={13} color={activeTab === 'diff' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'} />
                  <Text className={cn("text-xs font-medium", activeTab === 'diff' ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    Changes Diff
                  </Text>
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="tests"
                  className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
                >
                  <Terminal size={13} color={activeTab === 'tests' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'} />
                  <Text className={cn("text-xs font-medium", activeTab === 'tests' ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    Test Runner
                  </Text>
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="details"
                  className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
                >
                  <Bug size={13} color={activeTab === 'details' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'} />
                  <Text className={cn("text-xs font-medium", activeTab === 'details' ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    Incident
                  </Text>
                </Tabs.Trigger>
              </Tabs.List>
            </Tabs>
          ) : (
            <Tabs
              defaultValue="review"
              value={activeTab}
              size="xs"
              onValueChange={(val) => setActiveTab(val as any)}
              className="w-full"
            >
              <Tabs.List className="w-full bg-surface-secondary border border-border p-1 rounded-xl">
                <Tabs.Trigger
                  value="review"
                  className="flex-1 py-1.5 px-2 flex-row items-center justify-center gap-1.5"
                >
                  <Sparkles size={13} color={activeTab === 'review' ? (isLight ? '#262626' : '#f5f5f5') : '#888888'} />
                  <Text className={cn("text-xs font-medium", activeTab === 'review' ? "text-foreground font-semibold" : "text-muted-foreground")}>
                    Review Report
                  </Text>
                </Tabs.Trigger>
              </Tabs.List>
            </Tabs>
          )}
        </View>

        {/* 4. Tab Contents */}
        <ScrollView
          className="flex-1"
          style={{ flex: 1 }}
          contentContainerClassName="p-4 pb-6"
          showsVerticalScrollIndicator={true}
        >
          {/* Tab: Changes Diff */}
          {!isPrReviewMode && activeTab === 'diff' && activeProposal && (
            <View className="gap-2">
              <Text className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                UNIFIED GIT PATCH
              </Text>
              <DiffViewer diffText={activeProposal.diff} maxHeight={360} collapsible={false} />
            </View>
          )}

          {/* Tab: Test Runner */}
          {!isPrReviewMode && activeTab === 'tests' && activeProposal && (
            <View className="rounded-xl bg-surface-secondary border border-border p-3">
              <View className="flex-row items-center gap-2 pb-2.5 mb-2.5 border-b border-border">
                <Terminal size={14} color="#888888" />
                <Text className="text-xs font-mono font-medium text-foreground flex-1" numberOfLines={1}>
                  Command: {activeProposal.testCommand}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text className="font-mono text-xs text-muted-foreground leading-5">
                  {activeProposal.testOutput}
                </Text>
              </ScrollView>
            </View>
          )}

          {/* Tab: Incident Details */}
          {!isPrReviewMode && activeTab === 'details' && activeProposal && (
            <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl">
              <Text className="text-xs font-semibold text-foreground mb-1.5">Reported Problem</Text>
              <Text className="text-xs text-muted-foreground leading-5">{activeProposal.description}</Text>
              {activeProposal.url && (
                <View className="mt-3 pt-3 border-t border-border">
                  <Text className="text-xs font-semibold text-foreground mb-1">Source URL</Text>
                  <Text className="text-xs text-primary font-mono" numberOfLines={2}>
                    {activeProposal.url}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* PR Review Report */}
          {isPrReviewMode && activePrReview && (
            <View className="gap-3">
              {/* Summary Card */}
              <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl">
                <Text className="text-xs font-semibold text-foreground mb-1.5">Executive Summary</Text>
                <Text className="text-xs text-muted-foreground leading-5">{activePrReview.summary}</Text>
              </Card>

              {/* Security Risks */}
              {activePrReview.securityRisks && activePrReview.securityRisks.length > 0 && (
                <Card className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl">
                  <View className="flex-row items-center gap-1.5 mb-2">
                    <AlertCircle size={14} color="#ef4444" />
                    <Text className="text-xs font-semibold text-destructive">
                      Security & Critical Risks
                    </Text>
                  </View>
                  {activePrReview.securityRisks.map((risk, idx) => (
                    <Text key={idx} className="text-xs text-destructive-foreground/90 leading-5">
                      • {risk}
                    </Text>
                  ))}
                </Card>
              )}

              {/* Line Comments */}
              {activePrReview.lineComments && activePrReview.lineComments.length > 0 && (
                <View className="gap-2">
                  <Text className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Line-by-Line Suggestions
                  </Text>
                  {activePrReview.lineComments.map((c, idx) => (
                    <Card key={idx} className="p-3 bg-surface-secondary border border-border rounded-xl gap-1.5">
                      <Text className="text-xs font-mono font-medium text-primary">
                        {c.file}:{c.line}
                      </Text>
                      <Text className="text-xs text-foreground leading-5">{c.comment}</Text>
                      {c.suggestion && (
                        <View className="p-2 rounded-lg bg-surface border border-border mt-1">
                          <Text className="text-xs font-mono text-muted-foreground">{c.suggestion}</Text>
                        </View>
                      )}
                    </Card>
                  ))}
                </View>
              )}

              {/* Full Markdown Review */}
              <Card className="p-3.5 bg-surface-secondary border border-border rounded-xl">
                <Text className="text-xs font-semibold text-foreground mb-1.5">Full Review Notes</Text>
                <Text className="text-xs text-muted-foreground leading-5">{activePrReview.fullMarkdown}</Text>
              </Card>
            </View>
          )}
        </ScrollView>

        {/* 5. Action Footer */}
        <View className="px-4 py-3 border-t border-border flex-row items-center justify-between bg-surface">
          {!isPrReviewMode ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                className="flex-row items-center gap-1.5 px-3"
                onPress={() => handleApproveAction('discard')}
                disabled={isSubmitting}
              >
                <Trash2 size={13} color="#ffffff" />
                <Text className="text-xs font-medium text-destructive-foreground">Discard</Text>
              </Button>

              <View className="flex-row items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-row items-center gap-1.5 px-3"
                  onPress={() => handleApproveAction('merge')}
                  disabled={isSubmitting}
                >
                  <GitMerge size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-xs font-medium text-foreground">Merge Locally</Text>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  className="flex-row items-center gap-1.5 px-3.5"
                  onPress={() => handleApproveAction('pr')}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={isLight ? '#ffffff' : '#262626'} />
                  ) : (
                    <>
                      <GitPullRequest size={13} color={isLight ? '#ffffff' : '#262626'} />
                      <Text className="text-xs font-semibold text-primary-foreground">Approve & PR</Text>
                    </>
                  )}
                </Button>
              </View>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="px-3"
                onPress={onClose}
                disabled={isSubmitting}
              >
                <Text className="text-xs font-medium text-foreground">Dismiss</Text>
              </Button>

              <Button
                variant="primary"
                size="sm"
                className="flex-row items-center gap-1.5 px-3.5"
                onPress={handlePostReview}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={isLight ? '#ffffff' : '#262626'} />
                ) : (
                  <>
                    <GitPullRequest size={13} color={isLight ? '#ffffff' : '#262626'} />
                    <Text className="text-xs font-semibold text-primary-foreground">Post to GitHub</Text>
                  </>
                )}
              </Button>
            </>
          )}
        </View>
      </Dialog.Content>
    </Dialog>
  );
};
