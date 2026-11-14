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
import { X, Copy, Check, FileText, FileCode, ImageIcon, ExternalLink } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { copyToClipboard } from '../lib/clipboard';
import { formatFileSize, guessMimeType } from '../lib/attachments';
import { toast } from 'panelui-native';

export interface AttachmentPreviewTarget {
  name: string;
  path?: string;
  uri?: string;
  mimeType?: string;
  size?: number;
}

interface AttachmentPreviewModalProps {
  visible: boolean;
  attachment: AttachmentPreviewTarget | null;
  onClose: () => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  visible,
  attachment,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

  const fetchFileBase64 = useDaemonStore((s) => s.fetchFileBase64);
  const fetchArtifactContent = useDaemonStore((s) => s.fetchArtifactContent);

  const [isLoading, setIsLoading] = useState(true);
  const [resolvedImageUri, setResolvedImageUri] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const isImage = Boolean(
    attachment &&
      (attachment.mimeType?.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|svg)$/i.test(attachment.name))
  );

  const isTextOrCode = Boolean(
    attachment &&
      (attachment.mimeType?.startsWith('text/') ||
        /\.(ts|tsx|js|jsx|json|md|py|sh|html|css|yaml|yml|txt|sql|rs|go|java|c|cpp|h)$/i.test(
          attachment.name
        ))
  );

  useEffect(() => {
    if (!visible || !attachment) {
      setResolvedImageUri(null);
      setTextContent(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const resolveContent = async () => {
      try {
        if (isImage) {
          // 1. If local device URI is available (e.g. from picker in this session)
          if (attachment.uri) {
            if (isMounted) {
              setResolvedImageUri(attachment.uri);
              setIsLoading(false);
            }
            return;
          }

          // 2. Fetch from daemon over RPC as base64
          if (attachment.path) {
            const b64 = await fetchFileBase64(attachment.path);
            if (isMounted) {
              if (b64) {
                const mime = attachment.mimeType || guessMimeType(attachment.name) || 'image/png';
                setResolvedImageUri(`data:${mime};base64,${b64}`);
              }
              setIsLoading(false);
            }
            return;
          }
        } else if (isTextOrCode) {
          // Fetch text/code content from daemon
          if (attachment.path) {
            const content = await fetchArtifactContent(attachment.path);
            if (isMounted) {
              setTextContent(content);
              setIsLoading(false);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[AttachmentPreviewModal] Failed to load preview content:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    resolveContent();

    return () => {
      isMounted = false;
    };
  }, [visible, attachment?.path, attachment?.uri, attachment?.name]);

  if (!visible || !attachment) return null;

  const handleCopy = async () => {
    const textToCopy = textContent || attachment.path || attachment.name;
    if (!textToCopy) return;
    await copyToClipboard(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    toast.show({ variant: 'success', label: 'Copied to clipboard' });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.backdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Container Card */}
        <View
          style={[
            styles.modalCard,
            isSwiss
              ? styles.modalCardSwiss
              : isLight
              ? styles.modalCardLight
              : styles.modalCardDark,
          ]}
        >
          {/* Header Bar */}
          <View
            style={[
              styles.headerBar,
              isLight && styles.headerBarLight,
              isSwiss && styles.headerBarSwiss,
            ]}
          >
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconWrap,
                  isLight ? styles.iconWrapLight : styles.iconWrapDark,
                ]}
              >
                {isImage ? (
                  <ImageIcon size={15} color={isSwiss ? '#DC201E' : '#3b82f6'} />
                ) : isTextOrCode ? (
                  <FileCode size={15} color={isSwiss ? '#DC201E' : '#10b981'} />
                ) : (
                  <FileText size={15} color={isSwiss ? '#DC201E' : '#f59e0b'} />
                )}
              </View>
              <View style={styles.titleCol}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.headerTitle,
                    isLight && styles.headerTitleLight,
                    isSwiss && styles.headerTitleSwiss,
                  ]}
                >
                  {attachment.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.headerSubtitle,
                    isLight && styles.headerSubtitleLight,
                    isSwiss && styles.headerSubtitleSwiss,
                  ]}
                >
                  {attachment.size
                    ? `${formatFileSize(attachment.size)} • `
                    : ''}
                  {attachment.mimeType || guessMimeType(attachment.name)}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {textContent ? (
                <TouchableOpacity
                  onPress={handleCopy}
                  style={[styles.headerBtn, isLight && styles.headerBtnLight]}
                  hitSlop={8}
                  accessibilityLabel="Copy Content"
                >
                  {isCopied ? (
                    <Check size={14} color="#10b981" />
                  ) : (
                    <Copy size={14} color={isLight ? '#57606a' : '#a3a3a3'} />
                  )}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={onClose}
                style={[styles.headerBtn, isLight && styles.headerBtnLight]}
                hitSlop={8}
                accessibilityLabel="Close"
              >
                <X size={16} color={isLight ? '#262626' : '#f5f5f5'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Body Preview Area */}
          <View style={styles.body}>
            {isLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator
                  size="large"
                  color={isSwiss ? '#DC201E' : '#3b82f6'}
                />
                <Text
                  style={[
                    styles.loadingText,
                    isLight && styles.loadingTextLight,
                  ]}
                >
                  Loading preview...
                </Text>
              </View>
            ) : isImage && resolvedImageUri ? (
              <View style={styles.imageContainer}>
                <RNImage
                  source={{ uri: resolvedImageUri }}
                  style={[
                    styles.fullImage,
                    {
                      maxWidth: windowWidth - 48,
                      maxHeight: windowHeight * 0.7,
                    },
                  ]}
                  resizeMode="contain"
                />
              </View>
            ) : isTextOrCode && textContent ? (
              <ScrollView
                style={styles.codeScroll}
                contentContainerStyle={styles.codeContent}
                showsVerticalScrollIndicator={true}
              >
                <Text
                  selectable
                  style={[
                    styles.codeText,
                    isLight && styles.codeTextLight,
                  ]}
                >
                  {textContent}
                </Text>
              </ScrollView>
            ) : (
              <View style={styles.emptyBox}>
                <FileText size={36} color={isSwiss ? '#DC201E' : '#888'} />
                <Text
                  style={[
                    styles.emptyTitle,
                    isLight && styles.emptyTitleLight,
                  ]}
                >
                  {attachment.name}
                </Text>
                <Text
                  style={[
                    styles.emptyDesc,
                    isLight && styles.emptyDescLight,
                  ]}
                >
                  {attachment.path
                    ? `Saved to host: ${attachment.path}`
                    : 'File attachment stored in workspace'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  modalCardDark: {
    backgroundColor: '#191919',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
  },
  modalCardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.10)',
    borderWidth: 1,
  },
  modalCardSwiss: {
    backgroundColor: '#F1EBE1',
    borderColor: 'rgba(17, 16, 16, 0.16)',
    borderWidth: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.10)',
  },
  headerBarLight: {
    backgroundColor: '#f7f7f7',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerBarSwiss: {
    backgroundColor: '#EBE4D8',
    borderBottomColor: 'rgba(17, 16, 16, 0.12)',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDark: {
    backgroundColor: '#242424',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconWrapLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
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
    color: '#a3a3a3',
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
    gap: 8,
  },
  headerBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerBtnLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  body: {
    minHeight: 220,
    maxHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    padding: 40,
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
  imageContainer: {
    width: '100%',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: 400,
    borderRadius: 8,
  },
  codeScroll: {
    width: '100%',
    maxHeight: 500,
  },
  codeContent: {
    padding: 16,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#f5f5f5',
  },
  codeTextLight: {
    color: '#262626',
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
    textAlign: 'center',
  },
  emptyTitleLight: {
    color: '#262626',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#a3a3a3',
    textAlign: 'center',
    maxWidth: 320,
  },
  emptyDescLight: {
    color: '#686868',
  },
});
