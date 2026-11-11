import React from 'react';
import { View, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, cn } from 'panelui-native';
import { ChevronLeft, Menu, MoreVertical, Search } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leftIcon?: 'back' | 'menu';
  onMore?: () => void;
  onSearch?: () => void;
  rightElement?: React.ReactNode;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  onBack,
  leftIcon = 'back',
  onMore,
  onSearch,
  rightElement,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  return (
    <View
      style={{ paddingTop: topInset, height: 52 + topInset }}
      className="w-full bg-background border-b border-border px-3.5 flex-row items-center justify-between z-50"
    >
      <View className="flex-row items-center flex-1 mr-2 overflow-hidden">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            className="w-9 h-9 p-0 rounded-full items-center justify-center bg-surface border-border mr-2.5 active:opacity-70"
            onPress={onBack}
            accessibilityLabel={leftIcon === 'menu' ? 'Open navigation menu' : 'Go back'}
          >
            {leftIcon === 'menu' ? (
              <Menu size={18} color={isLight ? '#262626' : '#f5f5f5'} />
            ) : (
              <ChevronLeft size={18} color={isLight ? '#262626' : '#f5f5f5'} />
            )}
          </Button>
        )}

        <View className="flex-1 justify-center">
          <Text
            size="base"
            weight="semibold"
            className="text-[15px] font-semibold text-foreground tracking-tight leading-snug"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              size="xs"
              className="text-[11px] text-muted-foreground mt-0.5 leading-none"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center gap-1.5 shrink-0">
        {onSearch && (
          <Button
            variant="outline"
            size="sm"
            className="w-8 h-8 p-0 rounded-full items-center justify-center bg-surface border-border active:opacity-70"
            onPress={onSearch}
            accessibilityLabel="Search"
          >
            <Search size={15} color={isLight ? '#686868' : '#a3a3a3'} />
          </Button>
        )}

        {rightElement}

        {onMore && (
          <Button
            variant="outline"
            size="sm"
            className="w-8 h-8 p-0 rounded-full items-center justify-center bg-surface border-border active:opacity-70"
            onPress={onMore}
            accessibilityLabel="More options"
          >
            <MoreVertical size={16} color={isLight ? '#686868' : '#a3a3a3'} />
          </Button>
        )}
      </View>
    </View>
  );
};
