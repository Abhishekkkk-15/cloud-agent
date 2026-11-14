import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SandboxedWebView } from './SandboxedWebView';
import {
  Globe,
  Maximize2,
  Play,
  ExternalLink,
  Code2,
} from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { toast } from 'panelui-native';
import type { PreviewTarget } from '../lib/preview-detector';
import {
  wrapReactComponentInHtml,
  wrapSvgInHtml,
  isSvgDocument,
  prepareHtmlForMobile,
  unescapeContent,
} from '../lib/react-template';

interface InlinePreviewCardProps {
  target: PreviewTarget;
  htmlContent?: string;
  sourceCode?: string;
  onExpand: (target: PreviewTarget) => void;
}

export const InlinePreviewCard: React.FC<InlinePreviewCardProps> = ({
  target,
  htmlContent,
  sourceCode,
  onExpand,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const startPreviewServer = useDaemonStore((s) => s.startPreviewServer);
  const fetchArtifactContent = useDaemonStore((s) => s.fetchArtifactContent);
  const resolveDevServerTargetUrl = useDaemonStore((s) => s.resolveDevServerTargetUrl);
  const [isStartingServer, setIsStartingServer] = useState(false);
  const [liveTarget, setLiveTarget] = useState<PreviewTarget>(target);
  const [resolvedServerUrl, setResolvedServerUrl] = useState<string | null>(null);

  const targetPath = (target as any).path as string | undefined;
  const initialRaw = unescapeContent((target as any).htmlContent || (target as any).code || htmlContent || sourceCode);
  const [content, setContent] = useState<string>(initialRaw);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(!initialRaw && Boolean(targetPath));

  useEffect(() => {
    setLiveTarget(target);
    const raw = unescapeContent((target as any).htmlContent || (target as any).code || htmlContent || sourceCode);
    if (raw) {
      setContent(raw);
      setIsLoadingContent(false);
      return;
    }

    if (targetPath) {
      setIsLoadingContent(true);
      fetchArtifactContent(targetPath)
        .then((fetched) => {
          if (fetched) {
            setContent(unescapeContent(fetched));
          }
          setIsLoadingContent(false);
        })
        .catch(() => {
          setIsLoadingContent(false);
        });
    }
  }, [target.id, targetPath, (target as any).htmlContent, (target as any).code, htmlContent, sourceCode]);

  useEffect(() => {
    if (liveTarget.type === 'dev_server' && liveTarget.port) {
      resolveDevServerTargetUrl(liveTarget.port)
        .then((url) => {
          if (url) setResolvedServerUrl(url);
        })
        .catch(() => {});
    }
  }, [liveTarget.id, liveTarget.type, (liveTarget as any)?.port]);

  const handleStartDevServer = async () => {
    setIsStartingServer(true);
    try {
      const res = await startPreviewServer();
      if (res && res.ok) {
        toast.show({
          variant: 'success',
          label: 'Server Started',
          description: 'Spooling up Vite dev server on localhost:5173...',
        });
        // Optimistically transition card to listening state
        setTimeout(() => {
          setLiveTarget({
            type: 'dev_server',
            id: 'server_5173',
            title: 'Vite • React (: 5173)',
            port: 5173,
            url: 'http://localhost:5173',
            framework: 'Vite • React',
          });
          setIsStartingServer(false);
        }, 2500);
      } else {
        setIsStartingServer(false);
        toast.show({
          variant: 'destructive',
          label: 'Start Failed',
          description: 'Could not execute dev server command on host',
        });
      }
    } catch (err: any) {
      setIsStartingServer(false);
      toast.show({
        variant: 'destructive',
        label: 'Server Error',
        description: err?.message || 'Failed to start dev server',
      });
    }
  };

  const handleExpand = () => {
    const enrichedTarget: PreviewTarget = {
      ...liveTarget,
      ...(resolvedServerUrl ? { url: resolvedServerUrl } : {}),
      ...(liveTarget.type === 'html_artifact' ? { htmlContent: content } : {}),
      ...(liveTarget.type === 'react_artifact' ? { code: content } : {}),
    };
    onExpand(enrichedTarget);
  };

  // Resolve source for preview thumbnail
  let source: { html?: string; uri?: string } = { html: '' };
  if (liveTarget.type === 'dev_server') {
    source = { uri: resolvedServerUrl || liveTarget.url };
  } else if (liveTarget.type === 'react_artifact') {
    source = {
      html: wrapReactComponentInHtml(content, {
        isDark: !isLight,
        title: liveTarget.title,
      }),
    };
  } else if (liveTarget.type === 'html_artifact') {
    if (isSvgDocument(content)) {
      source = { html: wrapSvgInHtml(content, !isLight) };
    } else {
      source = { html: prepareHtmlForMobile(content) };
    }
  }

  return (
    <View
      style={[
        styles.cardContainer,
        isSwiss
          ? styles.cardContainerSwiss
          : isLight
          ? styles.cardContainerLight
          : undefined,
      ]}
    >
      {/* Header Bar */}
      <View style={[styles.headerRow, isLight && styles.headerRowLight, isSwiss && styles.headerRowSwiss]}>
        <View style={styles.headerLeft}>
          {liveTarget.type === 'dev_server' ? (
            <View style={styles.liveDot} />
          ) : (
            <Globe size={13} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#3b82f6'} />
          )}
          <Text numberOfLines={1} style={[styles.headerTitle, isLight && styles.headerTitleLight, isSwiss && styles.headerTitleSwiss]}>
            {liveTarget.title}
          </Text>
        </View>

        {liveTarget.type !== 'project_server' && (
          <TouchableOpacity
            onPress={handleExpand}
            style={[styles.expandBtn, isLight && styles.expandBtnLight, isSwiss && styles.expandBtnSwiss]}
            activeOpacity={0.7}
            accessibilityLabel="Expand Preview"
          >
            <Maximize2 size={12} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#ffffff'} />
            <Text style={[styles.expandText, isLight && styles.expandTextLight, isSwiss && styles.expandTextSwiss]}>
              Expand
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body Preview Area */}
      {liveTarget.type === 'project_server' ? (
        <View style={styles.launchArea}>
          <Text style={[styles.launchText, isLight && styles.launchTextLight]}>
            React dev server is not currently running.
          </Text>
          <TouchableOpacity
            onPress={handleStartDevServer}
            disabled={isStartingServer}
            style={[styles.startBtn, isSwiss && styles.startBtnSwiss]}
            activeOpacity={0.8}
          >
            {isStartingServer ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Play size={13} color="#ffffff" />
                <Text style={styles.startBtnText}>Start Dev Server ({liveTarget.script})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleExpand}
          activeOpacity={0.92}
          style={styles.previewBox}
        >
          {isLoadingContent ? (
            <View style={[styles.miniWebView, { alignItems: 'center', justifyContent: 'center', backgroundColor: isLight ? '#f5f5f5' : '#141414' }]}>
              <ActivityIndicator size="small" color={isSwiss ? '#DC201E' : '#3b82f6'} />
            </View>
          ) : (
            <View style={styles.webViewMask} pointerEvents="none">
              <SandboxedWebView
                source={source}
                style={styles.miniWebView}
                scrollEnabled={false}
                pointerEvents="none"
              />
            </View>
          )}

          {/* Footer Touch Bar */}
          <View style={[styles.footerBar, isLight && styles.footerBarLight, isSwiss && styles.footerBarSwiss]}>
            <Text style={[styles.footerText, isLight && styles.footerTextLight, isSwiss && styles.footerTextSwiss]}>
              Tap to test full screen • Mobile, Tablet & Desktop frames
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#191919',
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 6,
    width: '100%',
  },
  cardContainerLight: {
    borderColor: '#e1e4e8',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardContainerSwiss: {
    borderColor: 'rgba(17,16,16,0.16)',
    backgroundColor: '#F1EBE1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerRowLight: {
    borderColor: '#eaeef2',
    backgroundColor: '#f6f8fa',
  },
  headerRowSwiss: {
    borderColor: 'rgba(17,16,16,0.1)',
    backgroundColor: '#EBE4D8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f5f5f5',
  },
  headerTitleLight: {
    color: '#262626',
  },
  headerTitleSwiss: {
    color: '#111010',
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  expandBtnLight: {
    backgroundColor: '#eaeef2',
  },
  expandBtnSwiss: {
    backgroundColor: 'rgba(17,16,16,0.08)',
  },
  expandText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#f5f5f5',
  },
  expandTextLight: {
    color: '#262626',
  },
  expandTextSwiss: {
    color: '#111010',
  },
  previewBox: {
    width: '100%',
    height: 155,
    position: 'relative',
  },
  webViewMask: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  miniWebView: {
    flex: 1,
  },
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  footerBarLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: '#e1e4e8',
  },
  footerBarSwiss: {
    backgroundColor: 'rgba(241,235,225,0.95)',
    borderColor: 'rgba(17,16,16,0.12)',
  },
  footerText: {
    fontSize: 10,
    color: '#a3a3a3',
  },
  footerTextLight: {
    color: '#686868',
  },
  footerTextSwiss: {
    color: '#6B665E',
  },
  launchArea: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  launchText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  launchTextLight: {
    color: '#57606a',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  startBtnSwiss: {
    backgroundColor: '#DC201E',
  },
  startBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
