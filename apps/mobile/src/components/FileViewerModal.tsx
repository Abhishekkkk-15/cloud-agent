import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Copy,
  Check,
  FileText,
  FileCode,
  ImageIcon,
  Music,
  Video,
  File,
  Code2,
  Eye,
  ExternalLink,
} from './Icons';
import { useDaemonStore, type DaemonFileNode } from '../stores/useDaemonStore';
import { copyToClipboard } from '../lib/clipboard';
import { formatFileSize, guessMimeType } from '../lib/attachments';
import { SandboxedWebView } from './SandboxedWebView';
import { MarkdownText } from './MarkdownText';
import { CodeBlock, toast } from 'panelui-native';
import { wrapSvgInHtml } from '../lib/react-template';

interface FileViewerModalProps {
  visible: boolean;
  node: DaemonFileNode | null;
  onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  visible,
  node,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const fetchFileUtf8 = useDaemonStore((s) => s.fetchFileUtf8);
  const fetchFileBase64 = useDaemonStore((s) => s.fetchFileBase64);

  const [isLoading, setIsLoading] = useState(true);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [base64Content, setBase64Content] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [markdownMode, setMarkdownMode] = useState<'rendered' | 'raw'>('rendered');

  const fileName = node?.name || '';
  const filePath = node?.path || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeType = guessMimeType(fileName);

  const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|jfif|bmp|ico|heic)$/i.test(fileName);
  const isSvg = ext === 'svg';
  const isAudio = mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(fileName);
  const isVideo = mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(fileName);
  const isMarkdown = ext === 'md' || ext === 'mdx';
  const isPdf = ext === 'pdf' || mimeType === 'application/pdf';
  const isTextOrCode =
    isMarkdown ||
    mimeType.startsWith('text/') ||
    /^(application\/json|application\/javascript|application\/typescript|application\/xml)$/i.test(mimeType) ||
    /\.(ts|tsx|js|jsx|json|py|rs|go|c|cpp|h|java|kt|swift|css|scss|html|txt|sh|bash|zsh|yaml|yml|toml|sql|env|gitignore|prisma|xml|log|md|mdx)$/i.test(fileName);

  useEffect(() => {
    if (!visible || !node || node.type === 'directory') {
      setIsLoading(false);
      setTextContent(null);
      setBase64Content(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        if (isImage || isAudio || isVideo || isPdf || !isTextOrCode) {
          const b64 = await fetchFileBase64(node.path);
          if (isMounted) {
            setBase64Content(b64);
            setIsLoading(false);
          }
        } else {
          const text = await fetchFileUtf8(node.path);
          if (isMounted) {
            setTextContent(text);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('[FileViewerModal] Load error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [visible, node?.path]);

  if (!visible || !node) return null;

  const handleCopy = async () => {
    const toCopy = textContent || base64Content || filePath;
    if (!toCopy) return;
    await copyToClipboard(toCopy);
    setIsCopied(true);
    toast.show({
      variant: 'default',
      label: textContent ? 'File Content Copied' : 'File Path Copied',
      duration: 2000,
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyPath = async () => {
    await copyToClipboard(filePath);
    toast.show({
      variant: 'default',
      label: 'Path Copied',
      description: filePath,
      duration: 2000,
    });
  };

  const getLanguage = (extension: string) => {
    switch (extension) {
      case 'ts':
      case 'tsx':
        return 'tsx';
      case 'js':
      case 'jsx':
        return 'jsx';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      case 'go':
        return 'go';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
      case 'scss':
        return 'css';
      case 'md':
      case 'mdx':
        return 'markdown';
      case 'sh':
      case 'bash':
      case 'zsh':
        return 'bash';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'toml':
        return 'toml';
      case 'sql':
        return 'sql';
      default:
        return 'typescript';
    }
  };

  // Generate HTML for sandboxed audio playback
  const renderAudioHtml = () => {
    const audioDataUrl = `data:${mimeType};base64,${base64Content}`;
    const bgColor = isSwiss ? '#F8F3EC' : isLight ? '#ffffff' : '#141414';
    const cardBg = isSwiss ? '#F1EBE1' : isLight ? '#f7f7f7' : '#1e1e1e';
    const textColor = isSwiss ? '#111010' : isLight ? '#262626' : '#f5f5f5';
    const accentColor = isSwiss ? '#DC201E' : '#3b82f6';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: ${bgColor};
            color: ${textColor};
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
          }
          .card {
            background: ${cardBg};
            border-radius: 20px;
            padding: 24px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
          .disc {
            width: 72px;
            height: 72px;
            border-radius: 36px;
            background: ${accentColor};
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 28px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .title {
            font-size: 16px;
            font-weight: 700;
            text-align: center;
            word-break: break-all;
          }
          .meta {
            font-size: 12px;
            opacity: 0.65;
          }
          audio {
            width: 100%;
            outline: none;
            margin-top: 8px;
            border-radius: 8px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="disc">♪</div>
          <div class="title">${fileName}</div>
          <div class="meta">${formatFileSize(node?.size)} · ${mimeType}</div>
          <audio controls autoplay src="${audioDataUrl}"></audio>
        </div>
      </body>
      </html>
    `;
  };

  // Generate HTML for sandboxed video playback
  const renderVideoHtml = () => {
    const videoDataUrl = `data:${mimeType};base64,${base64Content}`;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #000000;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          video {
            width: 100%;
            max-height: 100vh;
            outline: none;
          }
        </style>
      </head>
      <body>
        <video controls playsinline autoplay src="${videoDataUrl}"></video>
      </body>
      </html>
    `;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          isLight && styles.containerLight,
          isSwiss && styles.containerSwiss,
          { paddingTop: insets.top },
        ]}
      >
        {/* Top Header */}
        <View style={[styles.header, isLight && styles.headerLight, isSwiss && styles.headerSwiss]}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.iconBadge,
                isLight && styles.iconBadgeLight,
                isSwiss && styles.iconBadgeSwiss,
              ]}
            >
              {isImage ? (
                <ImageIcon size={18} color={isSwiss ? '#DC201E' : '#a855f7'} />
              ) : isAudio ? (
                <Music size={18} color={isSwiss ? '#DC201E' : '#ec4899'} />
              ) : isVideo ? (
                <Video size={18} color={isSwiss ? '#DC201E' : '#ef4444'} />
              ) : isTextOrCode ? (
                <FileCode size={18} color={isSwiss ? '#DC201E' : '#3b82f6'} />
              ) : (
                <File size={18} color={isSwiss ? '#6B665E' : '#686868'} />
              )}
            </View>

            <View style={styles.headerTitleCol}>
              <Text
                style={[
                  styles.headerTitle,
                  isLight && styles.headerTitleLight,
                  isSwiss && styles.headerTitleSwiss,
                ]}
                numberOfLines={1}
              >
                {fileName}
              </Text>
              <TouchableOpacity onPress={handleCopyPath} activeOpacity={0.7}>
                <Text
                  style={[
                    styles.headerSubtitle,
                    isLight && styles.headerSubtitleLight,
                    isSwiss && styles.headerSubtitleSwiss,
                  ]}
                  numberOfLines={1}
                >
                  {filePath}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Header Actions */}
          <View style={styles.headerRight}>
            {isMarkdown && (
              <View
                style={[
                  styles.segmentedToggle,
                  isLight && styles.segmentedToggleLight,
                  isSwiss && styles.segmentedToggleSwiss,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.segmentedBtn,
                    markdownMode === 'rendered' && (isSwiss ? styles.segmentedBtnActiveSwiss : isLight ? styles.segmentedBtnActiveLight : styles.segmentedBtnActive),
                  ]}
                  onPress={() => setMarkdownMode('rendered')}
                  activeOpacity={0.8}
                >
                  <Eye size={12} color={markdownMode === 'rendered' ? (isSwiss ? '#ffffff' : '#262626') : (isLight ? '#686868' : '#a3a3a3')} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentedBtn,
                    markdownMode === 'raw' && (isSwiss ? styles.segmentedBtnActiveSwiss : isLight ? styles.segmentedBtnActiveLight : styles.segmentedBtnActive),
                  ]}
                  onPress={() => setMarkdownMode('raw')}
                  activeOpacity={0.8}
                >
                  <Code2 size={12} color={markdownMode === 'raw' ? (isSwiss ? '#ffffff' : '#262626') : (isLight ? '#686868' : '#a3a3a3')} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.headerBtn, isLight && styles.headerBtnLight, isSwiss && styles.headerBtnSwiss]}
              onPress={handleCopy}
              activeOpacity={0.7}
              accessibilityLabel="Copy Content"
            >
              {isCopied ? (
                <Check size={16} color={isSwiss ? '#DC201E' : '#10b981'} />
              ) : (
                <Copy size={16} color={isSwiss ? '#111010' : isLight ? '#262626' : '#f5f5f5'} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerBtn, isLight && styles.headerBtnLight, isSwiss && styles.headerBtnSwiss]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <X size={16} color={isSwiss ? '#111010' : isLight ? '#262626' : '#f5f5f5'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isSwiss ? '#DC201E' : '#f5f5f5'} />
              <Text style={[styles.loadingText, isLight && styles.loadingTextLight, isSwiss && styles.loadingTextSwiss]}>
                Loading file content…
              </Text>
            </View>
          ) : isImage && base64Content ? (
            isSvg ? (
              <SandboxedWebView
                source={{ html: wrapSvgInHtml(atob(base64Content)) }}
                style={{ flex: 1 }}
              />
            ) : (
              <ScrollView
                style={styles.imageScroll}
                contentContainerStyle={styles.imageScrollContent}
                maximumZoomScale={4}
                minimumZoomScale={1}
              >
                <View
                  style={[
                    styles.imageBackdrop,
                    isLight && styles.imageBackdropLight,
                    isSwiss && styles.imageBackdropSwiss,
                  ]}
                >
                  <RNImage
                    source={{ uri: `data:${mimeType};base64,${base64Content}` }}
                    style={{ width: windowWidth - 32, height: windowHeight * 0.65, resizeMode: 'contain' }}
                  />
                </View>
                <View style={styles.fileStatsFooter}>
                  <Text style={[styles.statText, isLight && styles.statTextLight]}>
                    {formatFileSize(node.size)} · {mimeType}
                  </Text>
                </View>
              </ScrollView>
            )
          ) : isAudio && base64Content ? (
            <SandboxedWebView
              source={{ html: renderAudioHtml() }}
              style={{ flex: 1 }}
            />
          ) : isVideo && base64Content ? (
            <SandboxedWebView
              source={{ html: renderVideoHtml() }}
              style={{ flex: 1, backgroundColor: '#000000' }}
            />
          ) : isMarkdown && markdownMode === 'rendered' && textContent !== null ? (
            <ScrollView
              style={styles.textScroll}
              contentContainerStyle={styles.textScrollContent}
            >
              <MarkdownText content={textContent} />
            </ScrollView>
          ) : textContent !== null ? (
            <ScrollView
              style={styles.codeScroll}
              contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
            >
              <CodeBlock
                code={textContent}
                language={getLanguage(ext)}
                showLineNumbers
              >
                <CodeBlock.Header>
                  <CodeBlock.Filename>{fileName}</CodeBlock.Filename>
                  <CodeBlock.CopyButton />
                </CodeBlock.Header>
              </CodeBlock>
            </ScrollView>
          ) : (
            <View style={styles.fallbackContainer}>
              <File size={48} color={isSwiss ? '#6B665E' : '#686868'} />
              <Text style={[styles.fallbackTitle, isLight && styles.fallbackTitleLight, isSwiss && styles.fallbackTitleSwiss]}>
                Binary File
              </Text>
              <Text style={[styles.fallbackDesc, isLight && styles.fallbackDescLight, isSwiss && styles.fallbackDescSwiss]}>
                This file format cannot be directly previewed as text.
              </Text>
              <Text style={[styles.fallbackMeta, isLight && styles.fallbackMetaLight]}>
                {formatFileSize(node.size)} · {mimeType}
              </Text>
              <TouchableOpacity
                style={[styles.copyPathBtn, isSwiss ? styles.copyPathBtnSwiss : isLight ? styles.copyPathBtnLight : styles.copyPathBtnDark]}
                onPress={handleCopyPath}
                activeOpacity={0.75}
              >
                <Text style={[styles.copyPathBtnText, isSwiss && { color: '#ffffff' }]}>
                  Copy Absolute Path
                </Text>
              </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLight: {
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerSwiss: {
    borderColor: 'rgba(17, 16, 16, 0.12)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  iconBadgeSwiss: {
    backgroundColor: '#EDE6DB',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: -0.2,
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
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerBtnSwiss: {
    backgroundColor: '#EDE6DB',
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentedToggleLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  segmentedToggleSwiss: {
    backgroundColor: '#EDE6DB',
  },
  segmentedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentedBtnActive: {
    backgroundColor: '#f5f5f5',
  },
  segmentedBtnActiveLight: {
    backgroundColor: '#ffffff',
  },
  segmentedBtnActiveSwiss: {
    backgroundColor: '#DC201E',
  },
  body: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#a3a3a3',
  },
  loadingTextLight: {
    color: '#686868',
  },
  loadingTextSwiss: {
    color: '#6B665E',
  },
  codeScroll: {
    flex: 1,
  },
  textScroll: {
    flex: 1,
  },
  textScrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  imageScroll: {
    flex: 1,
  },
  imageScrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  imageBackdrop: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    overflow: 'hidden',
  },
  imageBackdropLight: {
    backgroundColor: '#fafafa',
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  imageBackdropSwiss: {
    backgroundColor: '#EDE6DB',
    borderColor: 'rgba(17, 16, 16, 0.12)',
  },
  fileStatsFooter: {
    marginTop: 14,
    alignItems: 'center',
  },
  statText: {
    fontSize: 12,
    color: '#a3a3a3',
    fontWeight: '500',
  },
  statTextLight: {
    color: '#686868',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f5f5f5',
    marginTop: 6,
  },
  fallbackTitleLight: {
    color: '#262626',
  },
  fallbackTitleSwiss: {
    color: '#111010',
  },
  fallbackDesc: {
    fontSize: 13,
    color: '#a3a3a3',
    textAlign: 'center',
    lineHeight: 18,
  },
  fallbackDescLight: {
    color: '#686868',
  },
  fallbackDescSwiss: {
    color: '#6B665E',
  },
  fallbackMeta: {
    fontSize: 12,
    color: '#737373',
    marginTop: 4,
  },
  fallbackMetaLight: {
    color: '#8c8c8c',
  },
  copyPathBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyPathBtnDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  copyPathBtnLight: {
    backgroundColor: '#262626',
  },
  copyPathBtnSwiss: {
    backgroundColor: '#DC201E',
  },
  copyPathBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5f5f5',
  },
});
