import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { FileCode, Copy, Check, ChevronDown, ChevronUp } from './Icons';
import { colors, radii } from '../theme/tokens';
import { useDaemonStore } from '../stores/useDaemonStore';

export interface DiffLine {
  type: 'header' | 'hunk' | 'add' | 'delete' | 'normal';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffViewerProps {
  filePath?: string;
  diffText?: string;
  target?: string;
  replacement?: string;
  content?: string;
  maxHeight?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Computes a unified diff line-by-line between a target snippet and its replacement.
 */
function computeTargetReplacementDiff(target: string, replacement: string): DiffLine[] {
  const oldLines = target.split(/\r?\n/);
  const newLines = replacement.split(/\r?\n/);

  const diffLines: DiffLine[] = [];
  diffLines.push({
    type: 'hunk',
    content: `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  });

  oldLines.forEach((l, idx) => {
    diffLines.push({
      type: 'delete',
      oldLineNumber: idx + 1,
      content: `-${l}`,
    });
  });

  newLines.forEach((l, idx) => {
    diffLines.push({
      type: 'add',
      newLineNumber: idx + 1,
      content: `+${l}`,
    });
  });

  return diffLines;
}

/**
 * Parses raw unified patch / diff text into structured lines.
 */
function parseUnifiedDiff(rawDiff: string): DiffLine[] {
  const rawLines = rawDiff.split(/\r?\n/);
  const diffLines: DiffLine[] = [];

  let oldCounter = 1;
  let newCounter = 1;

  for (const line of rawLines) {
    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      diffLines.push({
        type: 'header',
        content: line,
      });
    } else if (line.startsWith('@@')) {
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        oldCounter = parseInt(match[1], 10);
        newCounter = parseInt(match[2], 10);
      }
      diffLines.push({
        type: 'hunk',
        content: line,
      });
    } else if (line.startsWith('+')) {
      diffLines.push({
        type: 'add',
        newLineNumber: newCounter++,
        content: line,
      });
    } else if (line.startsWith('-')) {
      diffLines.push({
        type: 'delete',
        oldLineNumber: oldCounter++,
        content: line,
      });
    } else {
      diffLines.push({
        type: 'normal',
        oldLineNumber: oldCounter++,
        newLineNumber: newCounter++,
        content: line.startsWith(' ') ? line : ` ${line}`,
      });
    }
  }

  return diffLines;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filePath = 'modified_file',
  diffText,
  target,
  replacement,
  content,
  maxHeight,
  collapsible = true,
  defaultExpanded = true,
}) => {
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  // Generate structured lines
  const parsedLines = useMemo<DiffLine[]>(() => {
    if (diffText && diffText.trim().length > 0) {
      return parseUnifiedDiff(diffText);
    }
    if (target !== undefined && replacement !== undefined) {
      return computeTargetReplacementDiff(target, replacement);
    }
    if (content !== undefined) {
      const lines = content.split(/\r?\n/);
      return [
        { type: 'hunk', content: `@@ -0,0 +1,${lines.length} @@` },
        ...lines.map((l, i) => ({
          type: 'add' as const,
          newLineNumber: i + 1,
          content: `+${l}`,
        })),
      ];
    }
    return [];
  }, [diffText, target, replacement, content]);

  // Calculate statistics (+additions, -deletions)
  const stats = useMemo(() => {
    let adds = 0;
    let subs = 0;
    for (const l of parsedLines) {
      if (l.type === 'add') adds++;
      if (l.type === 'delete') subs++;
    }
    return { adds, subs };
  }, [parsedLines]);

  const handleCopy = () => {
    const raw = parsedLines.map((l) => l.content).join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(raw).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const basename = filePath.split(/[\\/]/).pop() || filePath;

  return (
    <View style={[styles.container, isLight && styles.containerLight]}>
      {/* File Diff Header */}
      <View style={[styles.header, isLight && styles.headerLight]}>
        <TouchableOpacity
          style={styles.headerLeft}
          activeOpacity={collapsible ? 0.7 : 1}
          onPress={collapsible ? () => setExpanded((prev) => !prev) : undefined}
        >
          <FileCode size={14} color={isLight ? '#0077b6' : '#fafafa'} />
          <View style={styles.titleColumn}>
            <Text style={[styles.basenameText, isLight && styles.basenameTextLight]} numberOfLines={1}>
              {basename}
            </Text>
            {basename !== filePath ? (
              <Text style={[styles.fullPathText, isLight && styles.fullPathTextLight]} numberOfLines={1}>
                {filePath}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Stats Badge (+X -Y) */}
          <View style={[styles.statsBadge, isLight && styles.statsBadgeLight]}>
            {stats.adds > 0 ? (
              <Text style={[styles.statsAddText, isLight && { color: '#1a7f37' }]}>+{stats.adds}</Text>
            ) : null}
            {stats.subs > 0 ? (
              <Text style={[styles.statsSubText, isLight && { color: '#cf222e' }]}>-{stats.subs}</Text>
            ) : null}
          </View>

          {/* Copy Button */}
          <TouchableOpacity
            style={[styles.copyBtn, isLight && styles.copyBtnLight]}
            onPress={handleCopy}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            {copied ? (
              <Check size={13} color={isLight ? '#1a7f37' : colors.green} />
            ) : (
              <Copy size={13} color={isLight ? '#57606a' : '#a3a3a3'} />
            )}
          </TouchableOpacity>

          {/* Collapse Chevron */}
          {collapsible ? (
            <TouchableOpacity
              onPress={() => setExpanded((prev) => !prev)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {expanded ? (
                <ChevronUp size={16} color={isLight ? '#57606a' : '#a3a3a3'} />
              ) : (
                <ChevronDown size={16} color={isLight ? '#57606a' : '#a3a3a3'} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Diff Content Body */}
      {expanded ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.horizontalScroll, isLight && styles.horizontalScrollLight]}
        >
          <ScrollView
            style={[styles.verticalScroll, maxHeight ? { maxHeight } : undefined]}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={styles.diffTable}>
              {parsedLines.map((line, idx) => {
                const isAdd = line.type === 'add';
                const isSub = line.type === 'delete';
                const isHunk = line.type === 'hunk';
                const isHeader = line.type === 'header';

                if (isHunk) {
                  return (
                    <View key={idx} style={[styles.hunkRow, isLight && styles.hunkRowLight]}>
                      <Text style={[styles.hunkText, isLight && styles.hunkTextLight]}>{line.content}</Text>
                    </View>
                  );
                }

                if (isHeader) {
                  return (
                    <View key={idx} style={styles.metaRow}>
                      <Text style={[styles.metaText, isLight && styles.metaTextLight]}>{line.content}</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={idx}
                    style={[
                      styles.diffRow,
                      isAdd && (isLight ? styles.diffRowAddLight : styles.diffRowAdd),
                      isSub && (isLight ? styles.diffRowSubLight : styles.diffRowSub),
                    ]}
                  >
                    {/* Old line number */}
                    <Text
                      style={[
                        styles.gutterNum,
                        isLight && styles.gutterNumLight,
                        isSub && (isLight ? { color: '#cf222e' } : styles.gutterNumSub),
                      ]}
                    >
                      {line.oldLineNumber ?? ''}
                    </Text>

                    {/* New line number */}
                    <Text
                      style={[
                        styles.gutterNum,
                        isLight && styles.gutterNumLight,
                        isAdd && (isLight ? { color: '#1a7f37' } : styles.gutterNumAdd),
                      ]}
                    >
                      {line.newLineNumber ?? ''}
                    </Text>

                    {/* Prefix sign (+ / - / space) */}
                    <Text
                      style={[
                        styles.signGutter,
                        isLight && styles.signGutterLight,
                        isAdd && (isLight ? { color: '#1a7f37' } : styles.signAdd),
                        isSub && (isLight ? { color: '#cf222e' } : styles.signSub),
                      ]}
                    >
                      {isAdd ? '+' : isSub ? '-' : ' '}
                    </Text>

                    {/* Code content */}
                    <Text
                      style={[
                        styles.codeText,
                        isLight && styles.codeTextLight,
                        isAdd && (isLight ? styles.codeTextAddLight : styles.codeTextAdd),
                        isSub && (isLight ? styles.codeTextSubLight : styles.codeTextSub),
                      ]}
                      selectable
                    >
                      {line.content.replace(/^[+-]/, '')}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121212',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    overflow: 'hidden',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161616',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  titleColumn: {
    flex: 1,
  },
  basenameText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fafafa',
    letterSpacing: -0.1,
  },
  fullPathText: {
    fontSize: 10,
    color: '#a3a3a3',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#262626',
  },
  statsAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3fb950',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsSubText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f85149',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#262626',
  },

  horizontalScroll: {
    backgroundColor: '#121212',
  },
  verticalScroll: {
    minWidth: '100%',
  },
  diffTable: {
    paddingVertical: 4,
  },

  // Row variants
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    minHeight: 20,
    paddingRight: 16,
  },
  diffRowAdd: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#2ea043',
  },
  diffRowSub: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#da3633',
  },
  hunkRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255, 255, 255, 0.35)',
  },
  hunkText: {
    fontSize: 11,
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaRow: {
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#a3a3a3',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Gutters
  gutterNum: {
    width: 32,
    fontSize: 11,
    color: '#737373',
    textAlign: 'right',
    paddingRight: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  gutterNumAdd: {
    color: '#3fb950',
  },
  gutterNumSub: {
    color: '#f85149',
  },
  signGutter: {
    width: 14,
    fontSize: 12,
    fontWeight: '700',
    color: '#a3a3a3',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  signAdd: {
    color: '#3fb950',
  },
  signSub: {
    color: '#f85149',
  },

  // Code
  codeText: {
    flex: 1,
    fontSize: 12,
    color: '#fafafa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  codeTextAdd: {
    color: '#e6edf3',
  },
  codeTextSub: {
    color: '#e6edf3',
  },

  // Light Theme Overrides
  containerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  headerLight: {
    backgroundColor: '#f6f8fa',
    borderBottomColor: '#d0d7de',
  },
  basenameTextLight: {
    color: '#1f2328',
  },
  fullPathTextLight: {
    color: '#57606a',
  },
  statsBadgeLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d0d7de',
  },
  copyBtnLight: {
    backgroundColor: '#eaeef2',
  },
  horizontalScrollLight: {
    backgroundColor: '#ffffff',
  },
  hunkRowLight: {
    backgroundColor: '#f6f8fa',
    borderLeftColor: '#0077b6',
  },
  hunkTextLight: {
    color: '#57606a',
  },
  metaTextLight: {
    color: '#6e7681',
  },
  diffRowAddLight: {
    backgroundColor: 'rgba(46, 160, 67, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#1a7f37',
  },
  diffRowSubLight: {
    backgroundColor: 'rgba(248, 81, 73, 0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#cf222e',
  },
  gutterNumLight: {
    color: '#8c959f',
  },
  signGutterLight: {
    color: '#8c959f',
  },
  codeTextLight: {
    color: '#1f2328',
  },
  codeTextAddLight: {
    color: '#1a7f37',
  },
  codeTextSubLight: {
    color: '#cf222e',
  },
});
