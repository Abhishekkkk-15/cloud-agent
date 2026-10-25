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
import type { RealSessionItem } from '../stores/useDaemonStore';

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

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {session.title}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {session.workspaceName} • {session.id.slice(0, 8)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color="#8b949e" />
            </TouchableOpacity>
          </View>

          {/* Body / Actions */}
          <View style={styles.body}>
            {isRenaming ? (
              <View style={styles.renameContainer}>
                <Text style={styles.renameLabel}>Rename Session</Text>
                <TextInput
                  style={styles.renameInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Enter new title..."
                  placeholderTextColor="#6e7681"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveRename}
                />
                <View style={styles.renameActionsRow}>
                  <TouchableOpacity
                    style={styles.renameCancelBtn}
                    onPress={() => setIsRenaming(false)}
                    disabled={isLoading}
                  >
                    <Text style={styles.renameCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.renameSaveBtn}
                    onPress={handleSaveRename}
                    disabled={isLoading || !newTitle.trim()}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.renameSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* 1. Pin / Unpin Action */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={handleTogglePinAction}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <View style={styles.actionIconBox}>
                    <Pin
                      size={16}
                      color={session.pinned ? '#0077b6' : '#c9d1d9'}
                    />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitle}>
                      {session.pinned ? 'Unpin Session' : 'Pin to Top'}
                    </Text>
                    <Text style={styles.actionDesc}>
                      {session.pinned
                        ? 'Remove from pinned list'
                        : 'Keep this session pinned to the top of your drawer'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* 2. Rename Action */}
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => setIsRenaming(true)}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <View style={styles.actionIconBox}>
                    <Pencil size={16} color="#c9d1d9" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitle}>Rename Session</Text>
                    <Text style={styles.actionDesc}>Change the title of this session</Text>
                  </View>
                </TouchableOpacity>

                {/* 3. Delete Action */}
                <TouchableOpacity
                  style={[styles.actionRow, styles.actionRowDanger]}
                  onPress={handleDeleteAction}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <View style={[styles.actionIconBox, styles.actionIconDanger]}>
                    <Trash2 size={16} color="#f85149" />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={styles.actionTitleDanger}>Delete Session</Text>
                    <Text style={styles.actionDescDanger}>
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
    backgroundColor: '#0d1117',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    backgroundColor: '#161b22',
  },
  headerTextCol: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#21262d',
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
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
  },
  actionRowDanger: {
    borderColor: 'rgba(248, 81, 73, 0.25)',
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#21262d',
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
    color: '#f0f6fc',
  },
  actionDesc: {
    fontSize: 11,
    color: '#8b949e',
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
    color: '#8b949e',
    marginBottom: 8,
  },
  renameInput: {
    height: 42,
    backgroundColor: '#010409',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#30363d',
    paddingHorizontal: 12,
    color: '#f0f6fc',
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
    backgroundColor: '#21262d',
  },
  renameCancelText: {
    fontSize: 12,
    color: '#c9d1d9',
  },
  renameSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0077b6',
  },
  renameSaveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
