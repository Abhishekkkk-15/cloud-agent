import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  BottomSheet,
  Breadcrumb,
  Button,
  Input,
  Item,
  Text,
  Badge,
  Spinner,
  toast,
  cn,
} from 'panelui-native';
import {
  Folder,
  FolderPlus,
  ArrowUp,
  Home,
  RefreshCw,
  Search,
  Check,
  HardDrive,
  X,
} from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';

interface FolderPickerModalProps {
  visible: boolean;
  initialPath?: string;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
}

export const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  visible,
  initialPath,
  onClose,
  onSelectFolder,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light' || theme === 'swiss';
  const isSwiss = theme === 'swiss';
  const browseDirectories = useDaemonStore((s) => s.browseDirectories);
  const createDirectory = useDaemonStore((s) => s.createDirectory);

  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [homePath, setHomePath] = useState<string>('');
  const [availableDrives, setAvailableDrives] = useState<string[]>([]);
  const [subdirs, setSubdirs] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmittingFolder, setIsSubmittingFolder] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadDirectory(initialPath);
    } else {
      setSearchFilter('');
      setIsCreatingFolder(false);
      setNewFolderName('');
      setCreateError(null);
    }
  }, [visible, initialPath]);

  const loadDirectory = async (target?: string) => {
    setIsLoading(true);
    setSearchFilter('');
    const res = await browseDirectories(target);
    if (res) {
      setCurrentPath(res.currentPath);
      setParentPath(res.parentPath);
      setHomePath(res.homePath);
      setSubdirs(res.dirs || []);
      if (res.drives && res.drives.length > 0) {
        setAvailableDrives(res.drives);
      }
    }
    setIsLoading(false);
  };

  const handleSelectCurrent = () => {
    if (currentPath) {
      onSelectFolder(currentPath);
      onClose();
    }
  };

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || !currentPath || isSubmittingFolder) return;

    if (/[\\/:*?"<>|]/.test(trimmed) || trimmed.includes('..')) {
      setCreateError('Name cannot contain \\, /, :, *, ?, ", <, >, | or ".."');
      return;
    }

    setIsSubmittingFolder(true);
    setCreateError(null);
    const result = await createDirectory(currentPath, trimmed);
    setIsSubmittingFolder(false);

    if (result.ok && result.fullPath) {
      toast.show({
        variant: 'success',
        label: 'Folder Created',
        description: `Created "${trimmed}" on host system`,
        duration: 2500,
      });
      setIsCreatingFolder(false);
      setNewFolderName('');
      setCreateError(null);
      // Navigate directly into the newly created folder
      await loadDirectory(result.fullPath);
    } else {
      setCreateError(result.error || 'Failed to create folder');
      toast.show({
        variant: 'destructive',
        label: 'Creation Failed',
        description: result.error || 'Could not create folder on host system',
        duration: 3500,
      });
    }
  };

  // Build clickable breadcrumbs from path
  const pathSegments = useMemo(() => {
    if (!currentPath) return [];
    const normalized = currentPath.replace(/\\/g, '/');
    const isWin = /^[a-zA-Z]:/.test(normalized);
    const parts = normalized.split('/').filter(Boolean);

    const segments: Array<{ name: string; fullPath: string }> = [];

    if (!isWin) {
      segments.push({ name: '/', fullPath: '/' });
      let accumulated = '';
      for (const p of parts) {
        accumulated += `/${p}`;
        segments.push({ name: p, fullPath: accumulated });
      }
    } else {
      const driveLetter = parts[0].toUpperCase();
      segments.push({ name: driveLetter + '\\', fullPath: driveLetter + '\\' });
      let accumulated = driveLetter + '\\';
      for (let i = 1; i < parts.length; i++) {
        accumulated = accumulated.endsWith('\\') ? accumulated + parts[i] : accumulated + '\\' + parts[i];
        segments.push({ name: parts[i], fullPath: accumulated });
      }
    }
    return segments;
  }, [currentPath]);

  const filteredDirs = subdirs.filter((d) =>
    searchFilter.trim() === ''
      ? true
      : d.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <BottomSheet open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Content
        size="85%"
        showClose={false}
        className="bg-popover border-t border-border p-0 overflow-hidden"
      >
        <BottomSheet.Header className="px-4 pt-3 pb-2 border-b border-border pe-4 pr-4 bg-surface">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              <View className="w-8 h-8 rounded-lg bg-surface-secondary items-center justify-center border border-border">
                <Folder size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  Browse Host Directories
                </Text>
                <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
                  {subdirs.length} folders available
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onPress={() => loadDirectory(currentPath)}
                disabled={isLoading}
                className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              >
                <RefreshCw size={12} color={isLight ? '#686868' : '#a3a3a3'} />
              </Button>
              <Button
                variant="outline"
                size="xs"
                onPress={onClose}
                className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              >
                <X size={13} color={isLight ? '#686868' : '#a3a3a3'} />
              </Button>
            </View>
          </View>

          {/* Controls: Drives, Up, Home */}
          <View className="flex-row items-center gap-1.5 mb-2 overflow-hidden flex-wrap">
            {availableDrives.map((drv) => {
              const isSelected = currentPath.toUpperCase().startsWith(drv.toUpperCase());
              return (
                <Button
                  key={drv}
                  variant={isSelected ? 'secondary' : 'outline'}
                  size="xs"
                  onPress={() => loadDirectory(drv)}
                  className="flex-row items-center gap-1 px-2 py-0.5"
                >
                  <HardDrive size={11} color={isSelected ? (isLight ? '#262626' : '#f5f5f5') : (isLight ? '#686868' : '#a3a3a3')} />
                  <Text className="text-xs font-mono font-medium text-foreground">{drv}</Text>
                </Button>
              );
            })}

            {homePath ? (
              <Button
                variant="outline"
                size="xs"
                onPress={() => loadDirectory(homePath)}
                className="flex-row items-center gap-1 px-2 py-0.5"
              >
                <Home size={11} color={isLight ? '#686868' : '#a3a3a3'} />
                <Text className="text-xs font-medium text-foreground">Home</Text>
              </Button>
            ) : null}

            {parentPath ? (
              <Button
                variant="outline"
                size="xs"
                onPress={() => loadDirectory(parentPath)}
                className="flex-row items-center gap-1 px-2 py-0.5"
              >
                <ArrowUp size={11} color={isLight ? '#262626' : '#f5f5f5'} />
                <Text className="text-xs font-medium text-foreground">Up</Text>
              </Button>
            ) : null}

            <Button
              variant={isCreatingFolder ? 'secondary' : 'outline'}
              size="xs"
              onPress={() => {
                setIsCreatingFolder((prev) => !prev);
                setNewFolderName('');
                setCreateError(null);
              }}
              className="flex-row items-center gap-1 px-2 py-0.5 ml-auto"
            >
              <FolderPlus size={11} color={isLight ? '#262626' : '#f5f5f5'} />
              <Text className="text-xs font-medium text-foreground">New Folder</Text>
            </Button>
          </View>

          {/* New Folder Inline Form */}
          {isCreatingFolder && (
            <View className="mb-2 p-2.5 rounded-xl bg-surface-secondary border border-border">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-row items-center gap-1.5">
                  <FolderPlus size={13} color={isLight ? '#262626' : '#f5f5f5'} />
                  <Text className="text-xs font-semibold text-foreground">
                    Create New Folder
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                    setCreateError(null);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={13} color={isLight ? '#686868' : '#a3a3a3'} />
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center gap-1.5">
                <View className="flex-1">
                  <Input
                    value={newFolderName}
                    onChangeText={(t) => {
                      setNewFolderName(t);
                      if (createError) setCreateError(null);
                    }}
                    placeholder="Enter folder name..."
                    size="sm"
                    autoFocus
                    variant="outline"
                    className="w-full text-xs"
                    returnKeyType="done"
                    onSubmitEditing={handleCreateFolder}
                  />
                </View>

                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleCreateFolder}
                  disabled={!newFolderName.trim() || isSubmittingFolder}
                  className="px-3 h-8 flex-row items-center gap-1"
                >
                  {isSubmittingFolder ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <Check size={12} color={isLight ? '#fafafa' : '#262626'} />
                      <Text className="text-xs font-semibold text-primary-foreground">Create</Text>
                    </>
                  )}
                </Button>
              </View>

              {createError ? (
                <Text className="text-[11px] text-destructive mt-1 font-medium">
                  {createError}
                </Text>
              ) : null}
            </View>
          )}

          {/* Breadcrumbs Trail */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
            <Breadcrumb>
              <Breadcrumb.List className="flex-row items-center gap-1">
                {pathSegments.map((seg, idx) => {
                  const isLast = idx === pathSegments.length - 1;
                  return (
                    <Breadcrumb.Item key={seg.fullPath}>
                      {isLast ? (
                        <Breadcrumb.Page className="text-xs font-semibold text-foreground">
                          {seg.name}
                        </Breadcrumb.Page>
                      ) : (
                        <Breadcrumb.Link
                          onPress={() => loadDirectory(seg.fullPath)}
                          className="text-xs text-muted-foreground"
                        >
                          {seg.name}
                        </Breadcrumb.Link>
                      )}
                    </Breadcrumb.Item>
                  );
                })}
              </Breadcrumb.List>
            </Breadcrumb>
          </ScrollView>

          {/* Filter Bar */}
          <View className="mt-2 w-full">
            <Input
              value={searchFilter}
              onChangeText={setSearchFilter}
              placeholder="Filter subfolders..."
              size="sm"
              variant="outline"
              className="w-full"
            />
          </View>
        </BottomSheet.Header>

        {/* Directory Listing Body */}
        <BottomSheet.Body
          className="p-2 bg-popover"
          keyboardShouldPersistTaps="handled"
        >
          {isLoading ? (
            <View className="py-12 items-center justify-center">
              <Spinner size="sm" />
              <Text className="text-xs text-muted-foreground mt-2">Loading directory contents...</Text>
            </View>
          ) : filteredDirs.length === 0 ? (
            <View className="py-12 items-center justify-center">
              <Folder size={28} color={isLight ? '#a3a3a3' : '#737373'} />
              <Text className="text-xs text-muted-foreground mt-2">
                {searchFilter ? 'No matching subfolders' : 'Folder contains no subdirectories'}
              </Text>
            </View>
          ) : (
            filteredDirs.map((dir) => (
              <Item
                key={dir.fullPath}
                variant="default"
                size="xs"
                className="px-2.5 py-2 rounded-xl my-0.5"
                onPress={() => loadDirectory(dir.fullPath)}
              >
                <Item.Media variant="icon">
                  <Folder size={16} color={isSwiss ? '#DC201E' : isLight ? '#262626' : '#f5f5f5'} />
                </Item.Media>
                <Item.Content>
                  <Item.Title className="text-sm font-medium text-foreground">
                    {dir.name}
                  </Item.Title>
                </Item.Content>
              </Item>
            ))
          )}
        </BottomSheet.Body>

        {/* Footer */}
        <BottomSheet.Footer className="px-4 py-3 border-t border-border bg-surface flex-row items-center justify-between gap-3">
          <View className="flex-1 mr-2">
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
              Selected Path:
            </Text>
            <Text className="text-xs font-mono font-medium text-foreground" numberOfLines={1}>
              {currentPath || 'None'}
            </Text>
          </View>
          <Button
            variant="primary"
            size="sm"
            onPress={handleSelectCurrent}
            disabled={!currentPath || isLoading}
            className="flex-row items-center gap-1.5 px-4"
          >
            <Check size={14} color={isSwiss ? '#ffffff' : (isLight ? '#fafafa' : '#262626')} />
            <Text className="text-xs font-semibold text-primary-foreground">Choose This Folder</Text>
          </Button>
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet>
  );
};
