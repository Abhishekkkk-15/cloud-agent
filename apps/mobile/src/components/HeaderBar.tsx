import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft, MoreVertical } from './Icons';
import { colors, radii } from '../theme/tokens';

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onMore?: () => void;
  rightElement?: React.ReactNode;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  onBack,
  onMore,
  rightElement,
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
            <ChevronLeft size={18} color="#f0f6fc" />
          </TouchableOpacity>
        )}
        <View style={styles.titleColumn}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightRow}>
        {rightElement}
        {onMore && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={onMore}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 54,
    backgroundColor: '#0d1117',
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
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
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#21262d',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f0f6fc',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 11,
    color: '#8b949e',
    marginTop: 1,
    lineHeight: 14,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
});
