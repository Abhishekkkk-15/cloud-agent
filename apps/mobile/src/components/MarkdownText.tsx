import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors, radii, typography } from '../theme/tokens';
import { Copy, Check, Terminal, ChevronDown, ChevronUp } from './Icons';

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

type ContentBlock = CodeBlock | HeaderBlock | QuoteBlock | ListBlock | ParagraphBlock;

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block open/close
    if (line.trim().startsWith('```')) {
      if (inCode) {
        // Close code block
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
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings: #, ##, ###
    const headerMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (headerMatch) {
      flushList();
      blocks.push({
        type: 'header',
        level: headerMatch[1].length,
        text: headerMatch[2],
      });
      continue;
    }

    // Blockquote: >
    if (trimmed.startsWith('>')) {
      flushList();
      blocks.push({
        type: 'quote',
        text: trimmed.replace(/^>\s?/, ''),
      });
      continue;
    }

    // Unordered List: - or *
    const uListMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (uListMatch) {
      if (!currentList || currentList.ordered) {
        flushList();
        currentList = { ordered: false, items: [] };
      }
      currentList.items.push(uListMatch[1]);
      continue;
    }

    // Ordered List: 1. or 2.
    const oListMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (oListMatch) {
      if (!currentList || !currentList.ordered) {
        flushList();
        currentList = { ordered: true, items: [] };
      }
      currentList.items.push(oListMatch[2]);
      continue;
    }

    // Default paragraph
    flushList();
    blocks.push({
      type: 'paragraph',
      text: line,
    });
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
      return (
        <Text
          key={index}
          style={[
            styles.inlineCode,
            isUser ? styles.inlineCodeUser : styles.inlineCodeAssistant,
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
        <Text key={index} style={styles.boldText}>
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
    lineHeight: 21,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  headerText: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  h1: {
    fontSize: 18,
    lineHeight: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    paddingBottom: 4,
  },
  h2: {
    fontSize: 16,
    lineHeight: 22,
  },
  h3: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.blueBg,
    paddingLeft: 10,
    marginVertical: 6,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  listBox: {
    marginVertical: 4,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  listBullet: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.green,
    width: 16,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
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
  inlineCode: {
    fontFamily: typography.mono,
    fontSize: 12.5,
    borderRadius: radii.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  inlineCodeAssistant: {
    backgroundColor: colors.bgCard,
    color: colors.blue,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  inlineCodeUser: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
  },
  linkText: {
    color: colors.blue,
    textDecorationLine: 'underline',
  },
});
