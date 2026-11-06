import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Menu, MoreVertical, Search } from './Icons';
import { colors, radii } from '../theme/tokens';
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
    <View style={[styles.container, isLight && styles.containerLight, { paddingTop: topInset, height: 50 + topInset }]}>
      <View style={styles.leftRow}>
        {onBack && (
          <TouchableOpacity
            style={[styles.circleButton, isLight && styles.circleButtonLight]}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {leftIcon === 'menu' ? (
              <Menu size={18} color={isLight ? '#1f2328' : '#fafafa'} />
            ) : (
              <ChevronLeft size={18} color={isLight ? '#1f2328' : '#fafafa'} />
            )}
          </TouchableOpacity>
        )}
        <View style={styles.titleColumn}>
          <Text style={[styles.title, isLight && styles.titleLight]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, isLight && styles.subtitleLight]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightRow}>
        {onSearch && (
          <TouchableOpacity
            style={[styles.circleActionBtn, isLight && styles.circleActionBtnLight]}
            onPress={onSearch}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Search size={16} color={isLight ? '#57606a' : '#a3a3a3'} />
          </TouchableOpacity>
        )}
        {rightElement}
        {onMore && (
          <TouchableOpacity
            style={[styles.circleActionBtn, isLight && styles.circleActionBtnLight]}
            onPress={onMore}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={18} color={isLight ? '#57606a' : '#a3a3a3'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 50,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 50,
  },
  containerLight: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d0d7de',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  circleButtonLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  circleActionBtnLight: {
    backgroundColor: '#f6f8fa',
    borderColor: '#d0d7de',
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fafafa',
    letterSpacing: -0.2,
    lineHeight: 20,
    flexShrink: 1,
  },
  titleLight: {
    color: '#1f2328',
  },
  subtitle: {
    fontSize: 11,
    color: '#737373',
    marginTop: 1,
    lineHeight: 14,
  },
  subtitleLight: {
    color: '#6e7681',
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
