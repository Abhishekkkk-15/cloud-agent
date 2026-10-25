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
    <View style={styles.container}>
      {/* File Diff Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerLeft}
          activeOpacity={collapsible ? 0.7 : 1}
          onPress={collapsible ? () => setExpanded((prev) => !prev) : undefined}
        >
          <FileCode size={14} color="#f0f6fc" />
          <View style={styles.titleColumn}>
            <Text style={styles.basenameText} numberOfLines={1}>
              {basename}
            </Text>
            {basename !== filePath ? (
              <Text style={styles.fullPathText} numberOfLines={1}>
                {filePath}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Stats Badge (+X -Y) */}
          <View style={styles.statsBadge}>
            {stats.adds > 0 ? (
              <Text style={styles.statsAddText}>+{stats.adds}</Text>
            ) : null}
            {stats.subs > 0 ? (
              <Text style={styles.statsSubText}>-{stats.subs}</Text>
            ) : null}
          </View>

          {/* Copy Button */}
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={handleCopy}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            {copied ? (
              <Check size={13} color={colors.green} />
            ) : (
              <Copy size={13} color="#8b949e" />
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
                <ChevronUp size={16} color="#8b949e" />
              ) : (
                <ChevronDown size={16} color="#8b949e" />
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
          style={styles.horizontalScroll}
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
                    <View key={idx} style={styles.hunkRow}>
                      <Text style={styles.hunkText}>{line.content}</Text>
                    </View>
                  );
                }

                if (isHeader) {
                  return (
                    <View key={idx} style={styles.metaRow}>
                      <Text style={styles.metaText}>{line.content}</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={idx}
                    style={[
                      styles.diffRow,
                      isAdd && styles.diffRowAdd,
                      isSub && styles.diffRowSub,
                    ]}
                  >
                    {/* Old line number */}
                    <Text style={[styles.gutterNum, isSub && styles.gutterNumSub]}>
                      {line.oldLineNumber ?? ''}
                    </Text>

                    {/* New line number */}
                    <Text style={[styles.gutterNum, isAdd && styles.gutterNumAdd]}>
                      {line.newLineNumber ?? ''}
                    </Text>

                    {/* Prefix sign (+ / - / space) */}
                    <Text
                      style={[
                        styles.signGutter,
                        isAdd && styles.signAdd,
                        isSub && styles.signSub,
                      ]}
                    >
                      {isAdd ? '+' : isSub ? '-' : ' '}
                    </Text>

                    {/* Code content */}
                    <Text
                      style={[
                        styles.codeText,
                        isAdd && styles.codeTextAdd,
                        isSub && styles.codeTextSub,
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
    backgroundColor: '#010409',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
    marginVertical: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
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
    color: '#f0f6fc',
    letterSpacing: -0.1,
  },
  fullPathText: {
    fontSize: 10,
    color: '#8b949e',
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
    backgroundColor: '#0d1117',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#21262d',
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
    backgroundColor: '#21262d',
  },

  horizontalScroll: {
    backgroundColor: '#010409',
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
    backgroundColor: 'rgba(0, 119, 182, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginVertical: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#0077b6',
  },
  hunkText: {
    fontSize: 11,
    color: '#48cae4',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaRow: {
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Gutters
  gutterNum: {
    width: 32,
    fontSize: 11,
    color: '#6e7681',
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
    color: '#8b949e',
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
    color: '#f0f6fc',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  codeTextAdd: {
    color: '#e6edf3',
  },
  codeTextSub: {
    color: '#e6edf3',
  },
});
