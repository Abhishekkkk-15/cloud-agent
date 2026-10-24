import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors, radii, typography } from '../theme/tokens';
import { Copy, Check, Terminal, ChevronDown, ChevronUp, Folder, FileText } from './Icons';

interface MarkdownTextProps {
  content?: string;
  isUser?: boolean;
}

interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
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

interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
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

type ContentBlock =
  | CodeBlock
  | HeaderBlock
  | QuoteBlock
  | ListBlock
  | ParagraphBlock
  | DirectoryBlock
  | FileHeaderBlock;

export const MarkdownText: React.FC<MarkdownTextProps> = ({ content = '', isUser = false }) => {
  const safeContent = typeof content === 'string' ? content : String(content ?? '');

  if (!safeContent.trim()) {
    return null;
  }

  const blocks = parseBlocks(safeContent);

  return (
    <View style={styles.container}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'directory':
            return <DirectoryBlockView key={idx} block={block} />;
          case 'file_header':
            return <FileHeaderView key={idx} block={block} />;
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

function formatBytes(bytesStr?: string | number): string {
  if (!bytesStr) return '';
  const bytes = Number(bytesStr);
  if (isNaN(bytes)) return String(bytesStr);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DirectoryBlockView: React.FC<{ block: DirectoryBlock }> = ({ block }) => {
  const folders = block.items.filter((i) => i.isDir);
  const files = block.items.filter((i) => !i.isDir);

  return (
    <View style={styles.dirContainer}>
      <View style={styles.dirHeader}>
        <View style={styles.dirHeaderLeft}>
          <Folder size={14} color="#58a6ff" />
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
              <Folder size={13} color="#58a6ff" />
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
        <FileText size={14} color="#58a6ff" />
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

const CodeBlockView: React.FC<{ block: CodeBlock }> = ({ block }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(block.code).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.codeContainer}>
      <View style={styles.codeHeader}>
        <View style={styles.codeHeaderLeft}>
          <Terminal size={12} color={colors.textMuted} />
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
      <View style={styles.codeBody}>
        <Text style={styles.codeText} selectable>
          {block.code}
        </Text>
      </View>
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

    // 1. Skip tool execution timestamp lines
    if (/^(Created|Completed)\s+At:\s+\d{4}-\d{2}-\d{2}/i.test(trimmed)) {
      i++;
      continue;
    }

    // 2. Check for NDJSON Directory Listing entries: {"name":"...", ...}
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

    // 3. Check for File Path header: File Path: file:///...
    if (/^File\s+Path:\s+/i.test(trimmed)) {
      flushList();
      const path = trimmed.replace(/^File\s+Path:\s+/i, '').replace(/^file:\/\/\/?/, '');
      let totalLines: number | undefined;
      let totalBytes: number | undefined;
      i++;

      // Read meta lines (Total Lines, Total Bytes, Showing lines, disclaimer)
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

      // Extract subsequent line-numbered content
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

    // 4. Fenced code block open/close
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

    // 5. Empty line
    if (!trimmed) {
      flushList();
      i++;
      continue;
    }

    // 6. Headings: #, ##, ###
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

    // 7. Blockquote: >
    if (trimmed.startsWith('>')) {
      flushList();
      blocks.push({
        type: 'quote',
        text: trimmed.replace(/^>\s?/, ''),
      });
      i++;
      continue;
    }

    // 8. Unordered List: - or *
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

    // 9. Ordered List: 1. or 2.
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

    // 10. Default paragraph
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
  // Regex to split by inline tokens
  // 1: `code`
  // 2: **bold**
  // 3: *italic*
  // 4: [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code: `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeSnippet = part.slice(1, -1);
      const isCommitHash = /^[0-9a-f]{7,10}$/i.test(codeSnippet);
      const isFilePath = codeSnippet.includes('/') && codeSnippet.length > 25;

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
    color: '#f0f6fc',
    marginBottom: 8,
  },
  headerText: {
    color: '#f0f6fc',
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  h1: {
    fontSize: 18,
    lineHeight: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#21262d',
    paddingBottom: 4,
  },
  h2: {
    fontSize: 16,
    lineHeight: 22,
  },
  h3: {
    fontSize: 15,
    lineHeight: 21,
    color: '#f0f6fc',
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#30363d',
    paddingLeft: 10,
    marginVertical: 6,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#8b949e',
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
    color: '#8b949e',
    width: 16,
  },
  listItemText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#c9d1d9',
  },
  codeContainer: {
    backgroundColor: '#010409',
    borderWidth: 1,
    borderColor: '#30363d',
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
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  codeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeLangText: {
    fontSize: 11,
    color: '#8b949e',
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
    color: '#8b949e',
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
  inlineCode: {
    fontFamily: typography.mono,
    fontSize: 12,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  inlineCodeAssistant: {
    backgroundColor: '#21262d',
    color: '#e6edf3',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  commitHashBadge: {
    color: '#79c0ff',
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
    color: '#f0f6fc',
  },
  italicText: {
    fontStyle: 'italic',
  },
  linkText: {
    color: '#58a6ff',
    textDecorationLine: 'underline',
  },

  // Workspace Directory Card
  dirContainer: {
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
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
    backgroundColor: '#0d1117',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  dirHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dirTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#f0f6fc',
  },
  dirSummary: {
    fontSize: 11,
    color: '#8b949e',
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
    borderBottomColor: 'rgba(48, 54, 61, 0.4)',
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
    color: '#f0f6fc',
    fontFamily: typography.mono,
  },
  dirFileName: {
    fontSize: 12,
    color: '#c9d1d9',
    fontFamily: typography.mono,
  },
  dirBadge: {
    backgroundColor: 'rgba(56, 139, 253, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 139, 253, 0.3)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  dirBadgeText: {
    fontSize: 10,
    color: '#58a6ff',
    fontFamily: typography.mono,
    fontWeight: '600',
  },
  dirFileSize: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
  },

  // File Header Banner
  fileHeaderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
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
    color: '#f0f6fc',
    fontFamily: typography.mono,
  },
  fileHeaderPath: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
    flex: 1,
  },
  fileHeaderMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileHeaderMetaText: {
    fontSize: 11,
    color: '#8b949e',
    fontFamily: typography.mono,
  },
});
