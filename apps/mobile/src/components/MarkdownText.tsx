import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { colors, radii, typography } from '../theme/tokens';
import {
  Copy,
  Check,
  Terminal,
  Folder,
  FileText,
  FileCode,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from './Icons';

interface MarkdownTextProps {
  content?: string;
  isUser?: boolean;
}

interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
}

interface JsonBlock {
  type: 'json';
  data: any;
  raw: string;
}

interface HeaderBlock {
  type: 'header';
  level: number;
  text: string;
}

interface QuoteBlock {
  type: 'quote';
  text: string;
}

interface AlertBlock {
  type: 'alert';
  variant: 'note' | 'tip' | 'important' | 'warning' | 'caution';
  text: string;
}

interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

interface TableBlock {
  type: 'table';
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
}

interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

interface DirectoryItem {
  name: string;
  isDir: boolean;
  sizeBytes?: string;
}

interface DirectoryBlock {
  type: 'directory';
  items: DirectoryItem[];
  summary?: string;
}

interface FileHeaderBlock {
  type: 'file_header';
  path: string;
  totalLines?: number;
  totalBytes?: number;
}

interface CommandOutputBlock {
  type: 'command_output';
  exitCode: number;
  output: string;
  createdAt?: string;
}

type ContentBlock =
  | CodeBlock
  | JsonBlock
  | HeaderBlock
  | QuoteBlock
  | AlertBlock
  | ListBlock
  | TableBlock
  | ParagraphBlock
  | DirectoryBlock
  | FileHeaderBlock
  | CommandOutputBlock;

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content = '', isUser = false }) => {
  const safeContent = typeof content === 'string' ? content : String(content ?? '');

  if (!safeContent.trim()) {
    return null;
  }

  const cleaned = cleanPromptText(safeContent);
  const blocks = parseBlocks(cleaned);

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'directory':
            return <DirectoryBlockView key={idx} block={block} />;
          case 'file_header':
            return <FileHeaderView key={idx} block={block} />;
          case 'json':
            return <JsonViewer key={idx} data={block.data} rawString={block.raw} />;
          case 'table':
            return <TableBlockView key={idx} block={block} />;
          case 'alert':
            return <AlertBlockView key={idx} block={block} />;
          case 'command_output':
            return <CommandOutputView key={idx} block={block} />;
          case 'code':
            return <CodeBlockView key={idx} block={block} />;
          case 'header':
            return (
              <Text
                key={idx}
                style={[
                  styles.headerText,
                  block.level === 1 && styles.h1,
                  block.level === 2 && styles.h2,
                  block.level >= 3 && styles.h3,
                  isUser && { color: '#ffffff' },
                ]}
              >
                {renderInline(block.text, isUser)}
              </Text>
            );
          case 'quote':
            return (
              <View key={idx} style={styles.quoteBox}>
                <Text style={styles.quoteText}>{renderInline(block.text, isUser)}</Text>
              </View>
            );
          case 'list':
            return (
              <View key={idx} style={styles.listBox}>
                {block.items.map((item, itemIdx) => (
                  <View key={itemIdx} style={styles.listItemRow}>
                    <Text style={[styles.listBullet, isUser && { color: '#ffffff' }]}>
                      {block.ordered ? `${itemIdx + 1}.` : '•'}
                    </Text>
                    <Text style={[styles.listItemText, isUser && { color: '#ffffff' }]}>
                      {renderInline(item, isUser)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'paragraph':
          default:
            return (
              <Text key={idx} style={[styles.paragraphText, isUser && { color: '#ffffff' }]}>
                {renderInline(block.text, isUser)}
              </Text>
            );
        }
      })}
    </View>
  );
};

/**
 * Removes internal agent prompt wrappers like <USER_REQUEST>, <ADDITIONAL_METADATA>, etc.
 */
function cleanPromptText(text: string): string {
  if (!text) return '';
  const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
  if (reqMatch && reqMatch[1]) {
    return reqMatch[1].trim();
  }
  return text
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_SETTINGS_CHANGE>[\s\S]*?<\/USER_SETTINGS_CHANGE>/gi, '')
    .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/gi, '')
    .replace(/<system_instructions>[\s\S]*?<\/system_instructions>/gi, '')
    .trim();
}

function formatBytes(bytesStr?: string | number): string {
  if (!bytesStr) return '';
  const bytes = Number(bytesStr);
  if (isNaN(bytes)) return String(bytesStr);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Interactive, Syntax-Highlighted JSON Viewer adhering to Primer Dark palette
 */
export const JsonViewer: React.FC<{
  data: any;
  rawString?: string;
  title?: string;
  maxInitialLines?: number;
}> = ({ data, rawString, title = 'JSON', maxInitialLines = 14 }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  let formatted = '';
  try {
    if (typeof data === 'string') {
      formatted = JSON.stringify(JSON.parse(data), null, 2);
    } else if (data !== undefined) {
      formatted = JSON.stringify(data, null, 2);
    } else if (rawString) {
      formatted = JSON.stringify(JSON.parse(rawString), null, 2);
    }
  } catch {
    formatted = rawString || String(data || '');
  }

  const lines = formatted.split(/\r?\n/);
  const isTruncatable = lines.length > maxInitialLines;
  const visibleLines = isTruncatable && !isExpanded ? lines.slice(0, maxInitialLines) : lines;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(formatted).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderJsonLine = (line: string, index: number) => {
    // Match line indentation
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    const trimmed = line.slice(indent.length);

    // Key-value pair: "key": value
    const kvMatch = trimmed.match(/^(".*?")\s*:\s*(.*)$/);
    if (kvMatch) {
      const keyStr = kvMatch[1];
      const valStr = kvMatch[2];
      return (
        <View key={index} style={styles.jsonLineRow}>
          <Text style={styles.jsonLineNumber}>{index + 1}</Text>
          <Text style={styles.jsonIndent}>{indent}</Text>
          <Text style={styles.jsonKey}>{keyStr}</Text>
          <Text style={styles.jsonPunctuation}>: </Text>
          {renderJsonValue(valStr)}
        </View>
      );
    }

    return (
      <View key={index} style={styles.jsonLineRow}>
        <Text style={styles.jsonLineNumber}>{index + 1}</Text>
        <Text style={styles.jsonIndent}>{indent}</Text>
        {renderJsonValue(trimmed)}
      </View>
    );
  };

  const renderJsonValue = (val: string) => {
    // Strings in double quotes
    if (val.startsWith('"') && (val.endsWith('"') || val.endsWith('",'))) {
      return <Text style={styles.jsonString}>{val}</Text>;
    }
    // Numbers
    if (/^-?\d+(\.\d+)?(e[+-]?\d+)?,?$/i.test(val)) {
      return <Text style={styles.jsonNumber}>{val}</Text>;
    }
    // Booleans
    if (/^(true|false),?$/i.test(val)) {
      return <Text style={styles.jsonBoolean}>{val}</Text>;
    }
    // Null
    if (/^null,?$/i.test(val)) {
      return <Text style={styles.jsonNull}>{val}</Text>;
    }
    // Structural braces/brackets
    return <Text style={styles.jsonPunctuation}>{val}</Text>;
  };

  return (
    <View style={styles.codeContainer}>
      <View style={styles.codeHeader}>
        <View style={styles.codeHeaderLeft}>
          <FileCode size={12} color={colors.primary} />
          <Text style={styles.codeLangText}>{title}</Text>
          <Text style={styles.jsonLineCountBadge}>{lines.length} lines</Text>
        </View>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
          {copied ? (
            <>
              <Check size={12} color={colors.green} />
              <Text style={[styles.copyBtnText, { color: colors.green }]}>Copied</Text>
            </>
          ) : (
            <>
              <Copy size={12} color={colors.textMuted} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.jsonScroll}>
        <View style={styles.jsonBody}>
          {visibleLines.map((line, idx) => renderJsonLine(line, idx))}
        </View>
      </ScrollView>

      {isTruncatable ? (
        <TouchableOpacity
          style={styles.expandJsonBtn}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={13} color={colors.primary} />
              <Text style={styles.expandJsonText}>Collapse ({lines.length} lines)</Text>
            </>
          ) : (
            <>
              <ChevronDown size={13} color={colors.primary} />
              <Text style={styles.expandJsonText}>
                Show full JSON (+{lines.length - maxInitialLines} more lines)
              </Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const DirectoryBlockView: React.FC<{ block: DirectoryBlock }> = ({ block }) => {
  const folders = block.items.filter((i) => i.isDir);
  const files = block.items.filter((i) => !i.isDir);

  return (
    <View style={styles.dirContainer}>
      <View style={styles.dirHeader}>
        <View style={styles.dirHeaderLeft}>
          <Folder size={14} color={colors.primary} />
          <Text style={styles.dirTitle}>Workspace Directory</Text>
        </View>
        <Text style={styles.dirSummary}>
          {folders.length} folders • {files.length} files
        </Text>
      </View>
      <View style={styles.dirBody}>
        {folders.map((item, idx) => (
          <View key={`dir_${idx}`} style={styles.dirRow}>
            <View style={styles.dirRowLeft}>
              <Folder size={13} color={colors.primary} />
              <Text style={styles.dirFolderName}>{item.name}</Text>
            </View>
            <View style={styles.dirBadge}>
              <Text style={styles.dirBadgeText}>dir</Text>
            </View>
          </View>
        ))}
        {files.map((item, idx) => (
          <View key={`file_${idx}`} style={styles.dirRow}>
            <View style={styles.dirRowLeft}>
              <FileText size={13} color="#8b949e" />
              <Text style={styles.dirFileName}>{item.name}</Text>
            </View>
            {item.sizeBytes ? (
              <Text style={styles.dirFileSize}>{formatBytes(item.sizeBytes)}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
};

const FileHeaderView: React.FC<{ block: FileHeaderBlock }> = ({ block }) => {
  const fileName = block.path.split(/[\\/]/).pop() || block.path;

  return (
    <View style={styles.fileHeaderBanner}>
      <View style={styles.fileHeaderLeft}>
        <FileText size={14} color={colors.primary} />
        <Text style={styles.fileHeaderName}>{fileName}</Text>
        <Text style={styles.fileHeaderPath} numberOfLines={1}>
          {block.path}
        </Text>
      </View>
      <View style={styles.fileHeaderMetaBadge}>
        {block.totalLines ? (
          <Text style={styles.fileHeaderMetaText}>{block.totalLines} lines</Text>
        ) : null}
        {block.totalBytes ? (
          <Text style={styles.fileHeaderMetaText}>
            {' '}• {formatBytes(block.totalBytes)}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const AlertBlockView: React.FC<{ block: AlertBlock }> = ({ block }) => {
  const getAlertProps = (variant: AlertBlock['variant']) => {
    switch (variant) {
      case 'tip':
        return {
          title: 'Tip',
          borderColor: colors.green,
          titleColor: colors.green,
          bgColor: colors.greenSubtle,
          icon: <Sparkles size={14} color={colors.green} />,
        };
      case 'important':
        return {
          title: 'Important',
          borderColor: colors.green,
          titleColor: colors.green,
          bgColor: colors.greenSubtle,
          icon: <AlertTriangle size={14} color={colors.green} />,
        };
      case 'warning':
        return {
          title: 'Warning',
          borderColor: '#d29922',
          titleColor: '#e3b341',
          bgColor: 'rgba(210, 153, 34, 0.15)',
          icon: <AlertTriangle size={14} color="#e3b341" />,
        };
      case 'caution':
        return {
          title: 'Caution',
          borderColor: colors.red,
          titleColor: colors.red,
          bgColor: colors.redSubtle,
          icon: <ShieldAlert size={14} color={colors.red} />,
        };
      case 'note':
      default:
        return {
          title: 'Note',
          borderColor: colors.borderDefault,
          titleColor: colors.textSecondary,
          bgColor: colors.bgHover,
          icon: <Sparkles size={14} color={colors.green} />,
        };
    }
  };

  const alertProps = getAlertProps(block.variant);

  return (
    <View style={[styles.alertContainer, { borderLeftColor: alertProps.borderColor }]}>
      <View style={styles.alertHeader}>
        {alertProps.icon}
        <Text style={[styles.alertTitle, { color: alertProps.titleColor }]}>
          {alertProps.title}
        </Text>
      </View>
      <Text style={styles.alertBody}>{renderInline(block.text, false)}</Text>
    </View>
  );
};

const TableBlockView: React.FC<{ block: TableBlock }> = ({ block }) => {
  return (
    <View style={styles.tableWrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tableContainer}>
          {/* Table Header */}
          <View style={styles.tableHeaderRow}>
            {block.headers.map((header, colIdx) => (
              <View
                key={colIdx}
                style={[
                  styles.tableHeaderCell,
                  colIdx === block.headers.length - 1 && { borderRightWidth: 0 },
                ]}
              >
                <Text style={styles.tableHeaderText}>{renderInline(header, false)}</Text>
              </View>
            ))}
          </View>

          {/* Table Body */}
          {block.rows.map((row, rowIdx) => (
            <View
              key={rowIdx}
              style={[
                styles.tableRow,
                rowIdx % 2 === 1 && styles.tableRowAlt,
                rowIdx === block.rows.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              {row.map((cell, colIdx) => (
                <View
                  key={colIdx}
                  style={[
                    styles.tableCell,
                    colIdx === row.length - 1 && { borderRightWidth: 0 },
                  ]}
                >
                  <Text style={styles.tableCellText}>{renderInline(cell, false)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const CommandOutputView: React.FC<{ block: CommandOutputBlock }> = ({ block }) => {
  const [copied, setCopied] = useState(false);
  const isSuccess = block.exitCode === 0;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(block.output).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.commandOutputContainer}>
      <View style={styles.commandOutputHeader}>
        <View style={styles.codeHeaderLeft}>
          <Terminal size={12} color="#ffffff" />
          <Text style={styles.codeLangText}>TERMINAL OUTPUT</Text>
          <View
            style={[
              styles.exitCodeBadge,
              isSuccess ? styles.exitCodeBadgeSuccess : styles.exitCodeBadgeError,
            ]}
          >
            <Text
              style={[
                styles.exitCodeBadgeText,
                { color: isSuccess ? colors.green : colors.red },
              ]}
            >
              Exit {block.exitCode}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
          {copied ? (
            <>
              <Check size={12} color={colors.green} />
              <Text style={[styles.copyBtnText, { color: colors.green }]}>Copied</Text>
            </>
          ) : (
            <>
              <Copy size={12} color={colors.textMuted} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeBody}>
          <Text style={styles.codeText} selectable>
            {block.output}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const CodeBlockView: React.FC<{ block: CodeBlock }> = ({ block }) => {
  const [copied, setCopied] = useState(false);

  // If the language is JSON or the code string is valid JSON, render with JsonViewer
  const isJsonLang = block.language && block.language.toLowerCase() === 'json';
  if (isJsonLang || (!block.language && block.code.trim().startsWith('{') && block.code.trim().endsWith('}'))) {
    try {
      const parsed = JSON.parse(block.code);
      return <JsonViewer data={parsed} rawString={block.code} title={block.language ? block.language.toUpperCase() : 'JSON'} />;
    } catch {
      // Fall through to regular code block
    }
  }

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(block.code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Check if code is a diff
  const isDiff = block.language.toLowerCase() === 'diff' || /^[+-]\s/m.test(block.code);
  const lines = block.code.split(/\r?\n/);

  return (
    <View style={styles.codeContainer}>
      <View style={styles.codeHeader}>
        <View style={styles.codeHeaderLeft}>
          <Terminal size={12} color="#ffffff" />
          <Text style={styles.codeLangText}>
            {block.language ? block.language.toUpperCase() : 'CODE'}
          </Text>
        </View>
        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
          {copied ? (
            <>
              <Check size={12} color={colors.green} />
              <Text style={[styles.copyBtnText, { color: colors.green }]}>Copied</Text>
            </>
          ) : (
            <>
              <Copy size={12} color={colors.textMuted} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeBody}>
          {isDiff ? (
            lines.map((l, lIdx) => {
              const isAdd = l.startsWith('+');
              const isSub = l.startsWith('-');
              return (
                <View
                  key={lIdx}
                  style={[
                    styles.diffLineRow,
                    isAdd && styles.diffLineAdd,
                    isSub && styles.diffLineSub,
                  ]}
                >
                  <Text
                    style={[
                      styles.codeText,
                      isAdd && { color: colors.green },
                      isSub && { color: colors.red },
                    ]}
                    selectable
                  >
                    {l}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.codeText} selectable>
              {block.code}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

function parseBlocks(rawText: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = rawText.split(/\r?\n/);
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];

  let currentList: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      blocks.push({
        type: 'list',
        ordered: currentList.ordered,
        items: [...currentList.items],
      });
      currentList = null;
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Skip metadata timestamp lines
    if (/^(Created|Completed)\s+At:\s+\d{4}-\d{2}-\d{2}/i.test(trimmed)) {
      i++;
      continue;
    }

    // 2. Check for Antigravity Command Exit / Output block
    const exitMatch = /(?:The\s+command\s+exited|Command\s+exited)\s+with\s+code\s+(\d+)/i.exec(trimmed);
    if (exitMatch) {
      flushList();
      const exitCode = parseInt(exitMatch[1], 10);
      i++;
      const outputLines: string[] = [];
      while (i < lines.length) {
        const curLine = lines[i];
        if (/^(?:Command\s+output|Output):\s*$/i.test(curLine.trim())) {
          i++;
          continue;
        }
        if (/^(Created|Completed)\s+At:/i.test(curLine.trim())) {
          i++;
          continue;
        }
        outputLines.push(curLine);
        i++;
      }
      blocks.push({
        type: 'command_output',
        exitCode,
        output: outputLines.join('\n').trim(),
      });
      continue;
    }

    // 3. Check for NDJSON Directory Listing entries: {"name":"...", ...}
    if (trimmed.startsWith('{"name":') && trimmed.endsWith('}')) {
      flushList();
      const dirItems: DirectoryItem[] = [];
      let summaryText: string | undefined;

      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.startsWith('{"name":') && cur.endsWith('}')) {
          try {
            const parsed = JSON.parse(cur);
            if (parsed.name) {
              dirItems.push({
                name: parsed.name,
                isDir: Boolean(parsed.isDir),
                sizeBytes: parsed.sizeBytes ? String(parsed.sizeBytes) : undefined,
              });
            }
          } catch {
            // ignore JSON error
          }
          i++;
        } else if (cur.startsWith('Summary:')) {
          summaryText = cur.replace(/^Summary:\s*/, '');
          i++;
          break;
        } else if (!cur) {
          i++;
          if (i < lines.length && !lines[i].trim().startsWith('{"name":')) {
            break;
          }
        } else {
          break;
        }
      }

      if (dirItems.length > 0) {
        blocks.push({
          type: 'directory',
          items: dirItems,
          summary: summaryText,
        });
      }
      continue;
    }

    // 4. Standalone JSON Object or Array
    if ((trimmed.startsWith('{') && !trimmed.startsWith('{"name":')) || trimmed.startsWith('[')) {
      // Collect candidate lines for JSON parsing
      const jsonCandidateLines: string[] = [line];
      let depth = 0;
      for (const ch of trimmed) {
        if (ch === '{' || ch === '[') depth++;
        if (ch === '}' || ch === ']') depth--;
      }

      let j = i + 1;
      while (depth > 0 && j < lines.length) {
        const nextLine = lines[j];
        jsonCandidateLines.push(nextLine);
        for (const ch of nextLine) {
          if (ch === '{' || ch === '[') depth++;
          if (ch === '}' || ch === ']') depth--;
        }
        j++;
      }

      const jsonCandidate = jsonCandidateLines.join('\n').trim();
      try {
        const parsed = JSON.parse(jsonCandidate);
        if (parsed !== null && typeof parsed === 'object') {
          flushList();
          blocks.push({
            type: 'json',
            data: parsed,
            raw: jsonCandidate,
          });
          i = j;
          continue;
        }
      } catch {
        // Not valid JSON, continue with normal parsing
      }
    }

    // 5. Check for File Path header: File Path: file:///...
    if (/^File\s+Path:\s+/i.test(trimmed)) {
      flushList();
      const path = trimmed.replace(/^File\s+Path:\s+/i, '').replace(/^file:\/\/\/?/, '');
      let totalLines: number | undefined;
      let totalBytes: number | undefined;
      i++;

      while (i < lines.length) {
        const metaLine = lines[i].trim();
        const linesMatch = /^Total\s+Lines:\s+(\d+)/i.exec(metaLine);
        if (linesMatch) {
          totalLines = parseInt(linesMatch[1], 10);
          i++;
          continue;
        }
        const bytesMatch = /^Total\s+Bytes:\s+(\d+)/i.exec(metaLine);
        if (bytesMatch) {
          totalBytes = parseInt(bytesMatch[1], 10);
          i++;
          continue;
        }
        if (/^Showing\s+lines/i.test(metaLine) || /The following code has been modified/i.test(metaLine)) {
          i++;
          continue;
        }
        if (!metaLine && i + 1 < lines.length && /^(\d+):/.test(lines[i + 1].trim())) {
          i++;
          continue;
        }
        break;
      }

      blocks.push({
        type: 'file_header',
        path,
        totalLines,
        totalBytes,
      });

      const fileContentLines: string[] = [];
      while (i < lines.length) {
        const codeLine = lines[i];
        const numMatch = /^(\d+):\s?(.*)$/.exec(codeLine);
        if (numMatch) {
          fileContentLines.push(numMatch[2]);
          i++;
        } else if (!codeLine.trim()) {
          if (i + 1 < lines.length && /^(\d+):/.test(lines[i + 1])) {
            fileContentLines.push('');
            i++;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (fileContentLines.length > 0) {
        const fullContent = fileContentLines.join('\n');
        const isMarkdown = path.toLowerCase().endsWith('.md');
        if (isMarkdown) {
          const innerBlocks = parseBlocks(fullContent);
          blocks.push(...innerBlocks);
        } else {
          const ext = path.split('.').pop() || 'code';
          blocks.push({
            type: 'code',
            language: ext,
            code: fullContent,
          });
        }
      }
      continue;
    }

    // 6. Markdown Tables (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (i + 1 < lines.length && /^\|(\s*:?-+:?\s*\|)+$/.test(lines[i + 1].trim())) {
        flushList();
        const headerCells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        const sepCells = lines[i + 1]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        const alignments: ('left' | 'center' | 'right')[] = sepCells.map((sep) => {
          const hasLeft = sep.startsWith(':');
          const hasRight = sep.endsWith(':');
          if (hasLeft && hasRight) return 'center';
          if (hasRight) return 'right';
          return 'left';
        });

        i += 2;
        const rowList: string[][] = [];
        while (i < lines.length) {
          const rLine = lines[i].trim();
          if (rLine.startsWith('|') && rLine.endsWith('|')) {
            const cells = rLine
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
            rowList.push(cells);
            i++;
          } else {
            break;
          }
        }

        blocks.push({
          type: 'table',
          headers: headerCells,
          alignments,
          rows: rowList,
        });
        continue;
      }
    }

    // 7. GitHub Alerts (> [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION])
    const alertMatch = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(trimmed);
    if (alertMatch) {
      flushList();
      const variant = alertMatch[1].toLowerCase() as AlertBlock['variant'];
      i++;
      const alertBodyLines: string[] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.startsWith('>')) {
          alertBodyLines.push(cur.replace(/^>\s?/, ''));
          i++;
        } else if (!cur) {
          i++;
          if (i < lines.length && lines[i].trim().startsWith('>')) {
            alertBodyLines.push('');
          } else {
            break;
          }
        } else {
          break;
        }
      }

      blocks.push({
        type: 'alert',
        variant,
        text: alertBodyLines.join('\n').trim(),
      });
      continue;
    }

    // 8. Fenced code block open/close
    if (trimmed.startsWith('```')) {
      if (inCode) {
        blocks.push({
          type: 'code',
          language: codeLang,
          code: codeLines.join('\n'),
        });
        inCode = false;
        codeLang = '';
        codeLines = [];
      } else {
        flushList();
        inCode = true;
        codeLang = trimmed.slice(3).trim();
        codeLines = [];
      }
      i++;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      i++;
      continue;
    }

    // 9. Empty line
    if (!trimmed) {
      flushList();
      i++;
      continue;
    }

    // 10. Headings: #, ##, ###
    const headerMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headerMatch) {
      flushList();
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2],
      });
      i++;
      continue;
    }

    // 11. Blockquote: >
    if (trimmed.startsWith('>')) {
      flushList();
      blocks.push({
        type: 'quote',
        text: trimmed.replace(/^>\s?/, ''),
      });
      i++;
      continue;
    }

    // 12. Unordered List: - or *
    const uListMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (uListMatch) {
      if (!currentList || currentList.ordered) {
        flushList();
        currentList = { ordered: false, items: [] };
      }
      currentList.items.push(uListMatch[1]);
      i++;
      continue;
    }

    // 13. Ordered List: 1. or 2.
    const oListMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (oListMatch) {
      if (!currentList || !currentList.ordered) {
        flushList();
        currentList = { ordered: true, items: [] };
      }
      currentList.items.push(oListMatch[2]);
      i++;
      continue;
    }

    // 14. Default paragraph
    flushList();
    blocks.push({
      type: 'paragraph',
      text: line,
    });
    i++;
  }

  if (inCode && codeLines.length > 0) {
    blocks.push({
      type: 'code',
      language: codeLang,
      code: codeLines.join('\n'),
    });
  }

  flushList();

  return blocks;
}

/**
 * Parses inline elements: `inline code`, **bold**, *italic*, and [link](url).
 */
function renderInline(text: string, isUser: boolean): React.ReactNode {
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code: `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeSnippet = part.slice(1, -1);
      const isCommitHash = /^[0-9a-f]{7,10}$/i.test(codeSnippet);
      const isFilePath = codeSnippet.includes('/') && codeSnippet.length > 20;

      return (
        <Text
          key={index}
          style={[
            styles.inlineCode,
            isUser ? styles.inlineCodeUser : styles.inlineCodeAssistant,
            isCommitHash && styles.commitHashBadge,
            isFilePath && styles.filePathBadge,
          ]}
        >
          {codeSnippet}
        </Text>
      );
    }

    // Bold: **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <Text key={index} style={[styles.boldText, isUser && { color: '#ffffff' }]}>
          {boldText}
        </Text>
      );
    }

    // Italic: *...*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const italicText = part.slice(1, -1);
      return (
        <Text key={index} style={styles.italicText}>
          {italicText}
        </Text>
      );
    }

    // Link: [label](url)
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      return (
        <Text key={index} style={styles.linkText}>
          {linkMatch[1]}
        </Text>
      );
    }

    // Plain text
    return <Text key={index}>{part}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  headerText: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  h1: {
    fontSize: 18,
    lineHeight: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
    paddingBottom: 4,
  },
  h2: {
    fontSize: 16,
    lineHeight: 22,
  },
  h3: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.borderDefault,
    paddingLeft: 10,
    marginVertical: 6,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  listBox: {
    marginVertical: 4,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  listBullet: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textMuted,
    width: 16,
  },
  listItemText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  codeContainer: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    marginVertical: 8,
    overflow: 'hidden',
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  codeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLangText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
    fontWeight: '600',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  copyBtnText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  codeBody: {
    padding: 10,
  },
  codeText: {
    fontFamily: typography.mono,
    fontSize: 12,
    lineHeight: 18,
    color: '#e6edf3',
  },
  diffLineRow: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 2,
  },
  diffLineAdd: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
  },
  diffLineSub: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
  },
  inlineCode: {
    fontFamily: typography.mono,
    fontSize: 12,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  inlineCodeAssistant: {
    backgroundColor: colors.bgHover,
    color: '#e6edf3',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  commitHashBadge: {
    color: colors.primary,
  },
  filePathBadge: {
    fontSize: 11,
    color: '#e6edf3',
    lineHeight: 16,
  },
  inlineCodeUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
  },
  boldText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  italicText: {
    fontStyle: 'italic',
  },
  linkText: {
    color: colors.green,
    textDecorationLine: 'underline',
  },

  // JSON Viewer
  jsonScroll: {
    maxHeight: 320,
  },
  jsonBody: {
    padding: 8,
  },
  jsonLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 1,
  },
  jsonLineNumber: {
    width: 28,
    fontSize: 10.5,
    color: colors.textDisabled,
    fontFamily: typography.mono,
    textAlign: 'right',
    marginRight: 8,
  },
  jsonIndent: {
    fontFamily: typography.mono,
    fontSize: 11.5,
  },
  jsonKey: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.primary,
  },
  jsonString: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: '#c9d1d9',
  },
  jsonNumber: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.green,
  },
  jsonBoolean: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.green,
  },
  jsonNull: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  jsonPunctuation: {
    fontFamily: typography.mono,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  jsonLineCountBadge: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: typography.mono,
    backgroundColor: colors.bgHover,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.xs,
  },
  expandJsonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.bgHover,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  expandJsonText: {
    fontSize: 11.5,
    color: colors.green,
    fontFamily: typography.mono,
    fontWeight: '600',
  },

  // Markdown Tables
  tableWrapper: {
    marginVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
  },
  tableContainer: {
    backgroundColor: colors.bgCard,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCanvasInset,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  tableHeaderCell: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: colors.borderDefault,
    minWidth: 110,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  tableRowAlt: {
    backgroundColor: colors.bgCanvasInset,
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRightWidth: 1,
    borderRightColor: colors.borderMuted,
    minWidth: 110,
  },
  tableCellText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },

  // GitHub Alerts
  alertContainer: {
    backgroundColor: colors.bgCard,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.md,
    padding: 12,
    marginVertical: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: typography.mono,
  },
  alertBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  // Command Output
  commandOutputContainer: {
    backgroundColor: colors.bgCanvasInset,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    marginVertical: 8,
    overflow: 'hidden',
  },
  commandOutputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  exitCodeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  exitCodeBadgeSuccess: {
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
  },
  exitCodeBadgeError: {
    backgroundColor: colors.redSubtle,
    borderWidth: 1,
    borderColor: colors.redBorder,
  },
  exitCodeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: typography.mono,
  },

  // Workspace Directory Card
  dirContainer: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    marginVertical: 10,
    overflow: 'hidden',
  },
  dirHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  dirHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dirTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dirSummary: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
  dirBody: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dirRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  dirRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  dirFolderName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  dirFileName: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: typography.mono,
  },
  dirBadge: {
    backgroundColor: colors.greenSubtle,
    borderWidth: 1,
    borderColor: colors.greenBorder,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  dirBadgeText: {
    fontSize: 10,
    color: colors.green,
    fontFamily: typography.mono,
    fontWeight: '600',
  },
  dirFileSize: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },

  // File Header Banner
  fileHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 10,
    marginBottom: 8,
  },
  fileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  fileHeaderName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.mono,
  },
  fileHeaderPath: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
    flex: 1,
  },
  fileHeaderMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileHeaderMetaText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: typography.mono,
  },
});
