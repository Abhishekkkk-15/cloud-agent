import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { BottomSheet } from 'panelui-native';
import { Camera, ImageIcon, FileText, X } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';

interface AttachmentPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectPhotoLibrary: () => void;
  onSelectDocument: () => void;
}

export const AttachmentPickerSheet: React.FC<AttachmentPickerSheetProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectPhotoLibrary,
  onSelectDocument,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isSwiss = theme === 'swiss';

  const options = [
    {
      id: 'photos',
      label: 'Photo Library',
      description: 'Upload images, screenshots, and diagrams',
      icon: <ImageIcon size={20} color={isSwiss ? '#DC201E' : '#3b82f6'} />,
      action: onSelectPhotoLibrary,
    },
    {
      id: 'camera',
      label: 'Take Photo',
      description: 'Capture a picture with your device camera',
      icon: <Camera size={20} color={isSwiss ? '#DC201E' : '#10b981'} />,
      action: onSelectCamera,
    },
    {
      id: 'documents',
      label: 'Browse Files & Code',
      description: 'Pick logs, source files, PDFs, or specs',
      icon: <FileText size={20} color={isSwiss ? '#DC201E' : '#f59e0b'} />,
      action: onSelectDocument,
    },
  ];

  return (
    <BottomSheet open={visible} onOpenChange={(open) => { if (!open) onClose(); }}>
      <BottomSheet.Content className="max-w-md mx-auto">
        <BottomSheet.Header className="px-4 py-3 border-b border-border bg-surface flex-row items-center justify-between">
          <View>
            <Text className="text-base font-semibold text-foreground">Attach File</Text>
            <Text className="text-xs text-muted-foreground">Upload media or code into host workspace</Text>
          </View>
          <Pressable
            hitSlop={8}
            onPress={onClose}
            className="w-8 h-8 rounded-full items-center justify-center active:bg-muted"
          >
            <X size={16} color={isSwiss ? '#6B665E' : '#a3a3a3'} />
          </Pressable>
        </BottomSheet.Header>

        <BottomSheet.Body className="p-3 gap-2 bg-popover">
          {options.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => {
                onClose();
                opt.action();
              }}
              className="flex-row items-center gap-3 p-3 rounded-xl border border-border bg-card active:bg-surface-secondary"
            >
              <View className="w-10 h-10 rounded-lg bg-surface items-center justify-center border border-border">
                {opt.icon}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-foreground">{opt.label}</Text>
                <Text className="text-xs text-muted-foreground">{opt.description}</Text>
              </View>
            </Pressable>
          ))}
        </BottomSheet.Body>
      </BottomSheet.Content>
    </BottomSheet>
  );
};
