import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card, Badge, Button, Text, cn } from 'panelui-native';
import { FileCode, Copy, Check, ChevronDown, ChevronUp } from './Icons';
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
 * Parses a standard git diff patch string into typed lines with line numbers.
 */
function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines = diff.split(/\r?\n/);
  const result: DiffLine[] = [];

  let oldCounter = 0;
  let newCounter = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
      result.push({
        type: 'header',
        content: line,
      });
      continue;
    }

    const hunkMatch = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (hunkMatch) {
      oldCounter = parseInt(hunkMatch[1], 10);
      newCounter = parseInt(hunkMatch[2], 10);
      result.push({
        type: 'hunk',
        content: line,
      });
      continue;
    }

    if (line.startsWith('+')) {
      result.push({
        type: 'add',
        newLineNumber: newCounter++,
        content: line,
      });
      continue;
    }

    if (line.startsWith('-')) {
      result.push({
        type: 'delete',
        oldLineNumber: oldCounter++,
        content: line,
      });
      continue;
    }

    result.push({
      type: 'normal',
      oldLineNumber: oldCounter++,
      newLineNumber: newCounter++,
      content: line.startsWith(' ') ? line : ` ${line}`,
    });
  }

  return result;
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
    <Card className="my-2 p-0 bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      {/* File Diff Header */}
      <View className="px-3 py-2 bg-surface-secondary border-b border-border flex-row items-center justify-between">
        <TouchableOpacity
          className="flex-row items-center gap-2 flex-1 mr-2"
          activeOpacity={collapsible ? 0.7 : 1}
          onPress={collapsible ? () => setExpanded((prev) => !prev) : undefined}
        >
          <FileCode size={14} color={isLight ? '#262626' : '#f5f5f5'} />
          <View className="flex-1">
            <Text className="text-xs font-mono font-semibold text-foreground" numberOfLines={1}>
              {basename}
            </Text>
            {basename !== filePath ? (
              <Text className="text-[10px] font-mono text-muted-foreground" numberOfLines={1}>
                {filePath}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          {/* Stats Badge (+X -Y) */}
          <View className="flex-row items-center gap-1">
            {stats.adds > 0 ? (
              <Badge variant="outline" size="sm" className="px-1.5 py-0 bg-success/10 border-success/30">
                <Text className="text-[10px] font-mono font-bold text-success">+{stats.adds}</Text>
              </Badge>
            ) : null}
            {stats.subs > 0 ? (
              <Badge variant="outline" size="sm" className="px-1.5 py-0 bg-destructive/10 border-destructive/30">
                <Text className="text-[10px] font-mono font-bold text-destructive">-{stats.subs}</Text>
              </Badge>
            ) : null}
          </View>

          {/* Copy Button */}
          <Button
            variant="ghost"
            size="xs"
            className="w-7 h-7 p-0 items-center justify-center rounded-lg"
            onPress={handleCopy}
          >
            {copied ? (
              <Check size={12} color="#10b981" />
            ) : (
              <Copy size={12} color={isLight ? '#686868' : '#a3a3a3'} />
            )}
          </Button>

          {/* Collapse Chevron */}
          {collapsible ? (
            <Button
              variant="ghost"
              size="xs"
              className="w-7 h-7 p-0 items-center justify-center rounded-lg"
              onPress={() => setExpanded((prev) => !prev)}
            >
              {expanded ? (
                <ChevronUp size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              ) : (
                <ChevronDown size={14} color={isLight ? '#686868' : '#a3a3a3'} />
              )}
            </Button>
          ) : null}
        </View>
      </View>

      {/* Diff Content Body */}
      {expanded ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="bg-background"
        >
          <ScrollView
            style={maxHeight ? { maxHeight } : undefined}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View className="py-1">
              {parsedLines.map((line, idx) => {
                const isAdd = line.type === 'add';
                const isSub = line.type === 'delete';
                const isHunk = line.type === 'hunk';
                const isHeader = line.type === 'header';

                if (isHunk) {
                  return (
                    <View key={idx} className="px-2.5 py-1 bg-surface-secondary border-y border-border">
                      <Text className="text-[11px] font-mono text-muted-foreground">{line.content}</Text>
                    </View>
                  );
                }

                if (isHeader) {
                  return (
                    <View key={idx} className="px-2.5 py-0.5">
                      <Text className="text-[11px] font-mono text-muted-foreground">{line.content}</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={idx}
                    className={cn(
                      'flex-row items-center px-2 py-0.5 min-w-full',
                      isAdd && 'bg-success/10',
                      isSub && 'bg-destructive/10'
                    )}
                  >
                    {/* Old line number */}
                    <Text
                      className={cn(
                        'w-8 text-[11px] font-mono text-right pr-2 select-none',
                        isSub ? 'text-destructive font-semibold' : 'text-muted-foreground/50'
                      )}
                    >
                      {line.oldLineNumber ?? ''}
                    </Text>

                    {/* New line number */}
                    <Text
                      className={cn(
                        'w-8 text-[11px] font-mono text-right pr-2 select-none',
                        isAdd ? 'text-success font-semibold' : 'text-muted-foreground/50'
                      )}
                    >
                      {line.newLineNumber ?? ''}
                    </Text>

                    {/* Prefix sign (+ / - / space) */}
                    <Text
                      className={cn(
                        'w-4 text-[11px] font-mono font-bold text-center',
                        isAdd && 'text-success',
                        isSub && 'text-destructive',
                        !isAdd && !isSub && 'text-muted-foreground/40'
                      )}
                    >
                      {isAdd ? '+' : isSub ? '-' : ' '}
                    </Text>

                    {/* Code content */}
                    <Text
                      className={cn(
                        'text-xs font-mono pr-4 flex-1',
                        isAdd && 'text-foreground',
                        isSub && 'text-foreground',
                        !isAdd && !isSub && 'text-foreground'
                      )}
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
    </Card>
  );
};
