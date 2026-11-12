import React, { useState, useEffect } from 'react';
import {
  View,
  Alert,
} from 'react-native';
import {
  Dialog,
  Button,
  Input,
  Item,
  Text,
  Spinner,
} from 'panelui-native';
import { Pin, Pencil, Trash2, X } from './Icons';
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
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';

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
    <Dialog open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Content className="w-full max-w-sm bg-popover border border-border p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between bg-surface">
          <View className="flex-1 mr-2">
            <Dialog.Title className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {session.title}
            </Dialog.Title>
            <Dialog.Description className="text-xs text-muted-foreground" numberOfLines={1}>
              {session.workspaceName} • {session.id.slice(0, 8)}
            </Dialog.Description>
          </View>
          <Dialog.Close>
            <Button
              variant="ghost"
              size="sm"
              className="w-7 h-7 p-0 items-center justify-center rounded-lg"
            >
              <X size={15} color={isSwiss ? '#6B665E' : isLight ? '#686868' : '#a3a3a3'} />
            </Button>
          </Dialog.Close>
        </View>

        {/* Body */}
        <View className="p-3">
          {isRenaming ? (
            <View className="p-1">
              <Text className="text-xs font-semibold text-foreground mb-1.5">
                Rename Session
              </Text>
              <Input
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Enter new title..."
                size="sm"
                variant="outline"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveRename}
                className="mb-3"
              />
              <View className="flex-row items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setIsRenaming(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleSaveRename}
                  disabled={isLoading || !newTitle.trim()}
                >
                  {isLoading ? (
                    <Spinner size="sm" color={isSwiss ? '#ffffff' : (isLight ? '#fafafa' : '#262626')} />
                  ) : (
                    'Save'
                  )}
                </Button>
              </View>
            </View>
          ) : (
            <View className="gap-1">
              {/* 1. Pin / Unpin Action */}
              <Item
                variant="default"
                size="xs"
                className="px-2.5 py-2 rounded-xl"
                onPress={handleTogglePinAction}
                disabled={isLoading}
              >
                <Item.Media variant="icon">
                  <Pin
                    size={16}
                    color={session.pinned ? (isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5') : (isSwiss ? '#6B665E' : isLight ? '#686868' : '#a3a3a3')}
                  />
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm font-medium text-foreground">
                    {session.pinned ? 'Unpin Session' : 'Pin to Top'}
                  </Item.Title>
                  <Item.Description className="text-xs text-muted-foreground">
                    {session.pinned
                      ? 'Remove from pinned list'
                      : 'Keep pinned to the top of your drawer'}
                  </Item.Description>
                </Item.Content>
              </Item>

              {/* 2. Rename Action */}
              <Item
                variant="default"
                size="xs"
                className="px-2.5 py-2 rounded-xl"
                onPress={() => setIsRenaming(true)}
                disabled={isLoading}
              >
                <Item.Media variant="icon">
                  <Pencil size={16} color={isLight ? '#686868' : '#a3a3a3'} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm font-medium text-foreground">
                    Rename Session
                  </Item.Title>
                  <Item.Description className="text-xs text-muted-foreground">
                    Change the title of this session
                  </Item.Description>
                </Item.Content>
              </Item>

              {/* 3. Delete Action */}
              <Item
                variant="default"
                size="xs"
                className="px-2.5 py-2 rounded-xl"
                onPress={handleDeleteAction}
                disabled={isLoading}
              >
                <Item.Media variant="icon">
                  <Trash2 size={16} color="#ef4444" />
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm font-medium text-destructive">
                    Delete Session
                  </Item.Title>
                  <Item.Description className="text-xs text-destructive/70">
                    Permanently delete transcript from host disk
                  </Item.Description>
                </Item.Content>
              </Item>
            </View>
          )}
        </View>
      </Dialog.Content>
    </Dialog>
  );
};
