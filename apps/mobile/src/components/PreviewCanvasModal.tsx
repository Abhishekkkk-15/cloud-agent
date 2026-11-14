import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { SandboxedWebView } from './SandboxedWebView';
import {
  X,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  Code2,
  Globe,
  Copy,
  Check,
} from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { copyToClipboard } from '../lib/clipboard';
import { toast } from 'panelui-native';
import type { PreviewTarget } from '../lib/preview-detector';
import {
  wrapReactComponentInHtml,
  wrapSvgInHtml,
  isSvgDocument,
  prepareHtmlForMobile,
  unescapeContent,
} from '../lib/react-template';

interface PreviewCanvasModalProps {
  visible: boolean;
  target: PreviewTarget | null;
  htmlContent?: string;
  sourceCode?: string;
  onClose: () => void;
}

type ViewportMode = 'mobile' | 'tablet' | 'fluid';
type ViewMode = 'rendered' | 'source';

export const PreviewCanvasModal: React.FC<PreviewCanvasModalProps> = ({
  visible,
  target,
  htmlContent = '',
  sourceCode = '',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const [viewport, setViewport] = useState<ViewportMode>('fluid');
  const [viewMode, setViewMode] = useState<ViewMode>('rendered');
  const [reloadKey, setReloadKey] = useState(0);
  const [isCopied, setIsCopied] = useState(false);

  if (!target) return null;

  const fetchArtifactContent = useDaemonStore((s) => s.fetchArtifactContent);
  const targetPath = (target as any)?.path as string | undefined;
  const initialRaw = unescapeContent((target as any)?.htmlContent || (target as any)?.code || htmlContent || sourceCode);
  const [content, setContent] = useState<string>(initialRaw);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(!initialRaw && Boolean(targetPath));

  useEffect(() => {
    if (!target) return;
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
  }, [target?.id, targetPath, (target as any)?.htmlContent, (target as any)?.code, htmlContent, sourceCode]);

  // Resolve WebView source (either URL or compiled HTML)
  let source: { html?: string; uri?: string } = { html: '' };
  let effectiveCode = content || sourceCode || htmlContent || '';

  if (target?.type === 'dev_server') {
    source = { uri: target.url };
  } else if (target?.type === 'react_artifact') {
    source = {
      html: wrapReactComponentInHtml(content, {
        isDark: !isLight,
        title: target.title,
      }),
    };
  } else if (target?.type === 'html_artifact') {
    if (isSvgDocument(content)) {
      source = { html: wrapSvgInHtml(content, !isLight) };
    } else {
      source = { html: prepareHtmlForMobile(content) };
    }
  }

  const handleOpenExternal = async () => {
    try {
      if (source.uri) {
        await WebBrowser.openBrowserAsync(source.uri);
      } else if (source.html) {
        toast.show({
          variant: 'info',
          label: 'In-App Sandbox',
          description: 'This is a standalone component artifact running inside the sandbox.',
        });
      }
    } catch (err: any) {
      toast.show({
        variant: 'destructive',
        label: 'Browser Error',
        description: err?.message || 'Could not open external browser',
      });
    }
  };

  const handleCopyCode = async () => {
    if (!effectiveCode) return;
    await copyToClipboard(effectiveCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.show({ variant: 'success', label: 'Copied to clipboard' });
  };

  // Viewport width constraints for mobile & tablet frame emulation
  const getViewportWidth = () => {
    if (viewport === 'mobile') return Math.min(390, windowWidth - 32);
    if (viewport === 'tablet') return Math.min(768, windowWidth - 32);
    return '100%';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          isSwiss
            ? styles.containerSwiss
            : isLight
            ? styles.containerLight
            : undefined,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Top Header Bar */}
        <View style={[styles.headerBar, isLight && styles.headerBarLight, isSwiss && styles.headerBarSwiss]}>
          {/* Target Title & Badge */}
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.iconBtn}>
              <X size={18} color={isSwiss ? '#111010' : isLight ? '#262626' : '#f5f5f5'} />
            </TouchableOpacity>
            <View style={styles.titleCol}>
              <Text numberOfLines={1} style={[styles.headerTitle, isLight && styles.headerTitleLight, isSwiss && styles.headerTitleSwiss]}>
                {target.title}
              </Text>
              <Text numberOfLines={1} style={[styles.headerSubtitle, isLight && styles.headerSubtitleLight, isSwiss && styles.headerSubtitleSwiss]}>
                {target.type === 'dev_server'
                  ? `${target.url} • Live Server`
                  : target.type === 'react_artifact'
                  ? 'React Standalone Sandbox'
                  : 'HTML / Web Artifact'}
              </Text>
            </View>
          </View>

          {/* Action Tools */}
          <View style={styles.headerRight}>
            {/* Viewport Switcher */}
            {viewMode === 'rendered' && (
              <View style={[styles.pillToggleGroup, isLight && styles.pillToggleGroupLight]}>
                <TouchableOpacity
                  onPress={() => setViewport('mobile')}
                  style={[styles.pillBtn, viewport === 'mobile' && (isLight ? styles.pillBtnActiveLight : styles.pillBtnActive)]}
                >
                  <Smartphone size={13} color={viewport === 'mobile' ? (isLight ? '#262626' : '#ffffff') : '#888'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewport('tablet')}
                  style={[styles.pillBtn, viewport === 'tablet' && (isLight ? styles.pillBtnActiveLight : styles.pillBtnActive)]}
                >
                  <Tablet size={13} color={viewport === 'tablet' ? (isLight ? '#262626' : '#ffffff') : '#888'} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewport('fluid')}
                  style={[styles.pillBtn, viewport === 'fluid' && (isLight ? styles.pillBtnActiveLight : styles.pillBtnActive)]}
                >
                  <Monitor size={13} color={viewport === 'fluid' ? (isLight ? '#262626' : '#ffffff') : '#888'} />
                </TouchableOpacity>
              </View>
            )}

            {/* Rendered vs Code Toggle */}
            <TouchableOpacity
              onPress={() => setViewMode((prev) => (prev === 'rendered' ? 'source' : 'rendered'))}
              style={[styles.iconBtn, styles.borderBtn, isLight && styles.borderBtnLight]}
              accessibilityLabel="Toggle Code"
            >
              {viewMode === 'rendered' ? (
                <Code2 size={15} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              ) : (
                <Globe size={15} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              )}
            </TouchableOpacity>

            {/* Reload Button */}
            {viewMode === 'rendered' && (
              <TouchableOpacity
                onPress={() => setReloadKey((k) => k + 1)}
                style={[styles.iconBtn, styles.borderBtn, isLight && styles.borderBtnLight]}
                accessibilityLabel="Reload Preview"
              >
                <RefreshCw size={14} color={isSwiss ? '#6B665E' : isLight ? '#57606a' : '#a3a3a3'} />
              </TouchableOpacity>
            )}

            {/* External Browser */}
            {target.type === 'dev_server' && (
              <TouchableOpacity
                onPress={handleOpenExternal}
                style={[styles.iconBtn, styles.borderBtn, isLight && styles.borderBtnLight]}
                accessibilityLabel="Open External Browser"
              >
                <ExternalLink size={14} color={isSwiss ? '#DC201E' : '#3b82f6'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Main Canvas Viewport Area */}
        <View style={styles.canvasContainer}>
          {viewMode === 'rendered' ? (
            <View
              style={[
                styles.viewportFrame,
                viewport !== 'fluid' && styles.viewportFramedBox,
                isLight && styles.viewportFrameLight,
                isSwiss && styles.viewportFrameSwiss,
                { width: getViewportWidth() },
              ]}
            >
              {isLoadingContent ? (
                <View style={[styles.webViewFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator size="small" color={isSwiss ? '#DC201E' : '#3b82f6'} />
                </View>
              ) : (
                <SandboxedWebView
                  key={`webview_${reloadKey}`}
                  source={source}
                  style={styles.webViewFill}
                />
              )}
            </View>
          ) : (
            <View style={[styles.codeContainer, isLight && styles.codeContainerLight, isSwiss && styles.codeContainerSwiss]}>
              <View style={styles.codeHeader}>
                <Text style={styles.codeLanguage}>Source Code</Text>
                <TouchableOpacity onPress={handleCopyCode} style={styles.copyBtn}>
                  {isCopied ? <Check size={13} color="#10b981" /> : <Copy size={13} color="#888" />}
                  <Text style={styles.copyBtnText}>{isCopied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.codeScroll} contentContainerStyle={{ padding: 14 }}>
                <Text selectable style={[styles.codeText, isLight && styles.codeTextLight]}>
                  {effectiveCode || '/* No source code available */'}
                </Text>
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  containerLight: {
    backgroundColor: '#ffffff',
  },
  containerSwiss: {
    backgroundColor: '#F8F3EC',
  },
  headerBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#191919',
  },
  headerBarLight: {
    borderColor: '#e1e4e8',
    backgroundColor: '#ffffff',
  },
  headerBarSwiss: {
    borderColor: 'rgba(17,16,16,0.14)',
    backgroundColor: '#F1EBE1',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  titleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
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
    color: '#888',
    marginTop: 1,
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
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  borderBtnLight: {
    borderColor: '#d0d7de',
    backgroundColor: '#f6f8fa',
  },
  pillToggleGroup: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 2,
    marginRight: 4,
  },
  pillToggleGroupLight: {
    backgroundColor: '#eaeef2',
  },
  pillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillBtnActive: {
    backgroundColor: '#262626',
  },
  pillBtnActiveLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  canvasContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  viewportFrame: {
    flex: 1,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  viewportFrameLight: {
    backgroundColor: '#ffffff',
  },
  viewportFrameSwiss: {
    backgroundColor: '#ffffff',
  },
  viewportFramedBox: {
    height: '94%',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  webViewFill: {
    flex: 1,
  },
  codeContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#161616',
  },
  codeContainerLight: {
    backgroundColor: '#f6f8fa',
  },
  codeContainerSwiss: {
    backgroundColor: '#F1EBE1',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  codeLanguage: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  copyBtnText: {
    fontSize: 11,
    color: '#aaa',
  },
  codeScroll: {
    flex: 1,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#e5e7eb',
  },
  codeTextLight: {
    color: '#1f2328',
  },
});
