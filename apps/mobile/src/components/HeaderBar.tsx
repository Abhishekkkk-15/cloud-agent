import React, { useMemo } from 'react';
import { View, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, cn } from 'panelui-native';
import { ChevronLeft, Menu, MoreVertical, Search } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
import { getGlossyHeaderTokens } from '../theme/tokens';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leftIcon?: 'back' | 'menu';
  onMore?: () => void;
  onSearch?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  onBack,
  leftIcon = 'back',
  onMore,
  onSearch,
  rightElement,
  className,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0);
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';
  const glossyHeader = useMemo(() => getGlossyHeaderTokens(isLight), [isLight]);

  return (
    <View
      style={{ paddingTop: topInset, height: 52 + topInset }}
      className={cn(
        'w-full bg-background px-4 flex-row items-center justify-between z-50',
        className
      )}
    >
      <View className="flex-row items-center flex-1 mr-2 overflow-hidden">
        {onBack && (
          <TouchableOpacity
            style={[
              { width: 44, height: 44, borderRadius: 22 },
              glossyHeader.containerStyle,
            ]}
            className="items-center justify-center mr-2.5 active:opacity-70"
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={leftIcon === 'menu' ? 'Open navigation menu' : 'Go back'}
          >
            {leftIcon === 'menu' ? (
              <Menu size={24} color={glossyHeader.iconColor} />
            ) : (
              <ChevronLeft size={24} color={glossyHeader.iconColor} />
            )}
          </TouchableOpacity>
        )}

        <View className="flex-1 justify-center">
          <Text
            size="base"
            weight="semibold"
            className="text-[16px] font-semibold text-foreground tracking-tight leading-snug"
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              size="xs"
              className="text-[12px] text-muted-foreground mt-0.5 leading-none"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="flex-row items-center gap-2 shrink-0">
        {onSearch && (
          <TouchableOpacity
            style={[
              { width: 44, height: 44, borderRadius: 22 },
              glossyHeader.containerStyle,
            ]}
            className="items-center justify-center active:opacity-70"
            onPress={onSearch}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Search"
          >
            <Search size={22} color={glossyHeader.iconColor} />
          </TouchableOpacity>
        )}

        {rightElement}

        {onMore && (
          <TouchableOpacity
            style={[
              { width: 44, height: 44, borderRadius: 22 },
              glossyHeader.containerStyle,
            ]}
            className="items-center justify-center active:opacity-70"
            onPress={onMore}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="More options"
          >
            <MoreVertical size={22} color={glossyHeader.iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
