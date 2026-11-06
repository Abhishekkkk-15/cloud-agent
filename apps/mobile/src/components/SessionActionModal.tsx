import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Pin, Pencil, Trash2, X, Check } from './Icons';
import { colors, radii } from '../theme/tokens';
import { useDaemonStore, type RealSessionItem } from '../stores/useDaemonStore';

interface SessionActionModalProps {
  visible: boolean;
  session: RealSessionItem | null;
  onClose: () => void;
  onRename: (session: RealSessionItem, newTitle: string) => Promise<void>;
  onTogglePin: (session: RealSessionItem) => Promise<void>;
  onDelete: (session: RealSessionItem) => Promise<void>;
}

export const SessionActionModal: React.FC<SessionActionModalProps> = ({
  visible,
  session,
  onClose,
  onRename,
  onTogglePin,
  onDelete,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session) {
      setNewTitle(session.title);
      setIsRenaming(false);
      setIsLoading(false);
    }
  }, [session, visible]);

  if (!visible || !session) return null;

  const handleSaveRename = async () => {
    if (!newTitle.trim() || isLoading) return;
    setIsLoading(true);
    await onRename(session, newTitle.trim());
    setIsLoading(false);
    onClose();
  };

  const handleTogglePinAction = async () => {
    if (isLoading) return;
    setIsLoading(true);
    await onTogglePin(session);
    setIsLoading(false);
    onClose();
  };

  const handleDeleteAction = () => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${session.title}"? This will permanently remove its transcript from the host machine.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            await onDelete(session);
            setIsLoading(false);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalCard, isLight && styles.modalCardLight]}>
          {/* Header */}
          <View style={[styles.header, isLight && styles.headerLight]}>
            <View style={styles.headerTextCol}>
              <Text style={[styles.headerTitle, isLight && styles.headerTitleLight]} numberOfLines={1}>
                {session.title}
              </Text>
              <Text style={[styles.headerSubtitle, isLight && styles.headerSubtitleLight]} numberOfLines={1}>
                {session.workspaceName} • {session.id.slice(0, 8)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, isLight && styles.closeBtnLight]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={isLight ? '#57606a' : '#a3a3a3'} />
            </TouchableOpacity>
          </View>

          {/* Body / Actions */}
          <View style={[styles.body, isLight && styles.bodyLight]}>
            {isRenaming ? (
              <View style={styles.renameContainer}>
                <Text style={[styles.renameLabel, isLight && styles.renameLabelLight]}>Rename Session</Text>
                <TextInput
                  style={[styles.renameInput, isLight && styles.renameInputLight]}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Enter new title..."
                  placeholderTextColor={isLight ? '#8c959f' : '#737373'}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveRename}
                />
                <View style={styles.renameActionsRow}>
                  <TouchableOpacity
                    style={[styles.renameCancelBtn, isLight && styles.renameCancelBtnLight]}
                    onPress={() => setIsRenaming(false)}
                    disabled={isLoading}
                  >
                    <Text style={[styles.renameCancelText, isLight && styles.renameCancelTextLight]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.renameSaveBtn, isLight && styles.renameSaveBtnLight]}
                    onPress={handleSaveRename}
                    disabled={isLoading || !newTitle.trim()}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={isLight ? '#ffffff' : '#0a0a0a'} />
                    ) : (
                      <Text style={[styles.renameSaveText, isLight && styles.renameSaveTextLight]}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* 1. Pin / Unpin Action */}
                <TouchableOpacity
                  style={[styles.actionRow, isLight && styles.actionRowLight]}
                  onPress={handleTogglePinAction}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <View style={[styles.actionIconBox, isLight && styles.actionIconBoxLight]}>
                    <Pin
                      size={16}
                      color={session.pinned ? (isLight ? '#0077b6' : '#fafafa') : (isLight ? '#57606a' : '#d4d4d4')}
                    />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={[styles.actionTitle, isLight && styles.actionTitleLight]}>
                      {session.pinned ? 'Unpin Session' : 'Pin to Top'}
                    </Text>
                    <Text style={[styles.actionDesc, isLight && styles.actionDescLight]}>
                      {session.pinned
                        ? 'Remove from pinned list'
                        : 'Keep this session pinned to the top of your drawer'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Rename Action */}
                <TouchableOpacity
                  style={[styles.actionRow, isLight && styles.actionRowLight]}
                  onPress={() => setIsRenaming(true)}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <View style={[styles.actionIconBox, isLight && styles.actionIconBoxLight]}>
                    <Pencil size={16} color={isLight ? '#57606a' : '#d4d4d4'} />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={[styles.actionTitle, isLight && styles.actionTitleLight]}>Rename Session</Text>
                    <Text style={[styles.actionDesc, isLight && styles.actionDescLight]}>Change the title of this session</Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Delete Action */}
                <TouchableOpacity
                  style={[
                    styles.actionRow,
                    styles.actionRowDanger,
                    isLight && styles.actionRowDangerLight,
                  ]}
                  onPress={handleDeleteAction}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <View style={[styles.actionIconBox, styles.actionIconDanger]}>
                    <Trash2 size={16} color="#cf222e" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitleDanger}>Delete Session</Text>
                    <Text style={[styles.actionDescDanger, isLight && { color: '#cf222e' }]}>
                      Permanently delete transcript from host disk
                    </Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0a0a0a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#161616',
  },
  headerTextCol: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fafafa',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#a3a3a3',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
  },
  actionRowDanger: {
    borderColor: 'rgba(248, 81, 73, 0.25)',
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIconDanger: {
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fafafa',
  },
  actionDesc: {
    fontSize: 11,
    color: '#a3a3a3',
    marginTop: 2,
  },
  actionTitleDanger: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f85149',
  },
  actionDescDanger: {
    fontSize: 11,
    color: 'rgba(248, 81, 73, 0.7)',
    marginTop: 2,
  },
  renameContainer: {
    padding: 8,
  },
  renameLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a3a3a3',
    marginBottom: 8,
  },
  renameInput: {
    height: 42,
    backgroundColor: '#121212',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 12,
    color: '#fafafa',
    fontSize: 13,
    marginBottom: 12,
  },
  renameActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  renameCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#262626',
  },
  renameCancelText: {
    fontSize: 12,
    color: '#d4d4d4',
  },
  renameSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fafafa',
  },
  renameSaveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a0a0a',
  },

  // Light Theme Overrides
  modalCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  headerLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#e1e4e8',
  },
  headerTitleLight: {
    color: '#1f2328',
  },
  headerSubtitleLight: {
    color: '#6e7681',
  },
  closeBtnLight: {
    backgroundColor: '#eaeef2',
  },
  bodyLight: {
    backgroundColor: '#ffffff',
  },
  actionRowLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  actionRowDangerLight: {
    borderColor: 'rgba(207, 34, 46, 0.25)',
    backgroundColor: '#fff8f8',
  },
  actionIconBoxLight: {
    backgroundColor: '#eaeef2',
  },
  actionTitleLight: {
    color: '#1f2328',
  },
  actionDescLight: {
    color: '#6e7681',
  },
  renameLabelLight: {
    color: '#57606a',
  },
  renameInputLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
    color: '#1f2328',
  },
  renameCancelBtnLight: {
    backgroundColor: '#eaeef2',
  },
  renameCancelTextLight: {
    color: '#57606a',
  },
  renameSaveBtnLight: {
    backgroundColor: '#0077b6',
  },
  renameSaveTextLight: {
    color: '#ffffff',
  },
});
