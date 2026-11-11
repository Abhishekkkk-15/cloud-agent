import React, { useState } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import {
  Menu,
  Dialog,
  Button,
  Input,
  Text,
  toast,
} from 'panelui-native';
import { MoreVertical, Pencil, Pin, Trash2, X } from './Icons';
import { useDaemonStore, type RealSessionItem } from '../stores/useDaemonStore';

interface SessionDropdownMenuProps {
  session: RealSessionItem;
  onRename?: (session: RealSessionItem, newTitle: string) => Promise<void>;
  onTogglePin?: (session: RealSessionItem) => Promise<void>;
  onDelete?: (session: RealSessionItem) => Promise<void>;
  triggerClassName?: string;
  iconSize?: number;
}

export const SessionDropdownMenu: React.FC<SessionDropdownMenuProps> = ({
  session,
  onRename,
  onTogglePin,
  onDelete,
  triggerClassName = 'p-1',
  iconSize = 14,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const renameSession = useDaemonStore((s) => s.renameSession);
  const togglePinSession = useDaemonStore((s) => s.togglePinSession);
  const deleteSession = useDaemonStore((s) => s.deleteSession);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleOpenRename = () => {
    setNewTitle(session.title);
    setRenameDialogOpen(true);
  };

  const handleSaveRename = async () => {
    if (!newTitle.trim() || isRenaming) return;
    setIsRenaming(true);
    try {
      if (onRename) {
        await onRename(session, newTitle.trim());
      } else {
        await renameSession(session.id, newTitle.trim());
      }
      setRenameDialogOpen(false);
      toast.show({
        variant: 'success',
        label: 'Session Renamed',
        description: newTitle.trim(),
        duration: 2500,
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleTogglePin = async () => {
    const willPin = !session.pinned;
    if (onTogglePin) {
      await onTogglePin(session);
    } else {
      await togglePinSession(session.id);
    }
    toast.show({
      variant: 'default',
      label: willPin ? 'Session pinned' : 'Session unpinned',
      duration: 2000,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${session.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (onDelete) {
              await onDelete(session);
            } else {
              await deleteSession(session.id);
            }
            toast.show({
              variant: 'default',
              label: 'Session deleted',
              duration: 2500,
            });
          },
        },
      ]
    );
  };

  return (
    <>
      <Menu>
        <Menu.Trigger>
          <TouchableOpacity
            className={triggerClassName}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Session options for ${session.title}`}
          >
            <MoreVertical size={iconSize} color={isLight ? '#686868' : '#a3a3a3'} />
          </TouchableOpacity>
        </Menu.Trigger>

        <Menu.Content
          align="end"
          className="w-48 bg-popover border border-border rounded-xl p-1 shadow-xl"
        >
          <Menu.Item
            icon={<Pencil size={14} color={isLight ? '#262626' : '#f5f5f5'} />}
            onSelect={handleOpenRename}
          >
            Rename
          </Menu.Item>
          <Menu.Item
            icon={<Pin size={14} color={isLight ? '#262626' : '#f5f5f5'} />}
            onSelect={handleTogglePin}
          >
            {session.pinned ? 'Unpin from Top' : 'Pin to Top'}
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            variant="destructive"
            icon={<Trash2 size={14} color="#ef4444" />}
            onSelect={handleDelete}
          >
            Delete
          </Menu.Item>
        </Menu.Content>
      </Menu>

      {/* Rename Dialog (Opens only when user clicks Rename from the dropdown) */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <Dialog.Content className="w-full max-w-sm bg-popover border border-border p-4 rounded-2xl gap-3">
          <View className="flex-row items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Rename Session
            </Dialog.Title>
            <Dialog.Close>
              <Button
                variant="ghost"
                size="xs"
                className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              >
                <X size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              </Button>
            </Dialog.Close>
          </View>

          <Input
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Session title..."
            size="md"
            variant="outline"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={handleSaveRename}
          />

          <View className="flex-row items-center justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onPress={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={handleSaveRename}
              disabled={!newTitle.trim() || isRenaming}
            >
              {isRenaming ? 'Saving...' : 'Save'}
            </Button>
          </View>
        </Dialog.Content>
      </Dialog>
    </>
  );
};
