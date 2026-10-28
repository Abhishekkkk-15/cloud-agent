import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, MoreVertical, Search } from './Icons';
import { colors, radii } from '../theme/tokens';

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMore?: () => void;
  onSearch?: () => void;
  rightElement?: React.ReactNode;
  showLiveDot?: boolean;
  liveColor?: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  onBack,
  onMore,
  onSearch,
  rightElement,
  showLiveDot = false,
  liveColor = colors.statusLive,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {onBack && (
          <TouchableOpacity
            style={styles.circleButton}
            onPress={onBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleColumn}>
          <View style={styles.titleRow}>
            {showLiveDot && (
              <View style={[styles.liveDot, { backgroundColor: liveColor }]} />
            )}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightRow}>
        {onSearch && (
          <TouchableOpacity
            style={styles.circleActionBtn}
            onPress={onSearch}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Search size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {rightElement}
        {onMore && (
          <TouchableOpacity
            style={styles.circleActionBtn}
            onPress={onMore}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    zIndex: 50,
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
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 7,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
    lineHeight: 20,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
    lineHeight: 14,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
