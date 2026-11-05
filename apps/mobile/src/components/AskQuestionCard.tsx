import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { HelpCircle, Check, Circle, Square, CheckSquare, Send, CheckCheck } from './Icons';
import { colors, radii } from '../theme/tokens';
import type { ActionStep } from './ToolActionTray';

export interface QuestionItem {
  question: string;
  options: string[];
  is_multi_select?: boolean;
}

interface AskQuestionCardProps {
  action: ActionStep;
  onSubmitAnswer?: (answerText: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const AskQuestionCard: React.FC<AskQuestionCardProps> = ({
  action,
  onSubmitAnswer,
  isSubmitting = false,
}) => {
  // 1. Parse questions array from action arguments safely
  const questions = useMemo<QuestionItem[]>(() => {
    const raw = action.args?.questions;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  }, [action.args?.questions]);

  // 2. Check if already answered from tool output
  const isAnswered = useMemo(() => {
    if (!action.output) return false;
    const trimmed = action.output.trim();
    return trimmed.length > 0 && !trimmed.startsWith('Error');
  }, [action.output]);

  // 3. Extract answered text lines if already answered
  const answeredSelections = useMemo<Record<number, string[]>>(() => {
    if (!isAnswered || !action.output) return {};
    const map: Record<number, string[]> = {};
    const lines = action.output.split('\n');
    for (const line of lines) {
      const match = /^A(\d+):\s*(.*)$/i.exec(line.trim());
      if (match) {
        const qIdx = parseInt(match[1], 10) - 1;
        const val = match[2].trim();
        if (val) {
          map[qIdx] = [val];
        }
      }
    }
    return map;
  }, [isAnswered, action.output]);

  // 4. Default selections: pre-select options prefixed with "(Recommended)"
  const initialSelections = useMemo(() => {
    const initial: Record<number, string[]> = {};
    questions.forEach((q, qIdx) => {
      const rec = q.options?.find((opt) => opt.toLowerCase().includes('(recommended)'));
      if (rec) {
        initial[qIdx] = [rec];
      } else if (q.options && q.options.length > 0 && !q.is_multi_select) {
        initial[qIdx] = [q.options[0]];
      } else {
        initial[qIdx] = [];
      }
    });
    return initial;
  }, [questions]);

  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>(initialSelections);

  if (questions.length === 0) {
    return null;
  }

  const handleToggleOption = (qIdx: number, option: string, isMulti?: boolean) => {
    if (isAnswered) return;

    setSelectedOptions((prev) => {
      const current = prev[qIdx] || [];
      if (isMulti) {
        const exists = current.includes(option);
        const updated = exists ? current.filter((o) => o !== option) : [...current, option];
        return { ...prev, [qIdx]: updated };
      } else {
        return { ...prev, [qIdx]: [option] };
      }
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting || !onSubmitAnswer) return;

    // Format output matching Antigravity protocol:
    // A1: <answer1>
    // A2: <answer2>
    const answerLines: string[] = [];
    questions.forEach((_, qIdx) => {
      const chosen = selectedOptions[qIdx] || [];
      const joined = chosen.join(', ');
      answerLines.push(`A${qIdx + 1}: ${joined}`);
    });

    const formattedPayload = answerLines.join('\n');
    await onSubmitAnswer(formattedPayload);
  };

  const hasAnySelection = Object.values(selectedOptions).some((arr) => arr.length > 0);

  return (
    <View style={styles.cardContainer}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <HelpCircle size={14} color="#fafafa" />
          </View>
          <Text style={styles.headerTitle}>Clarification Required</Text>
        </View>
        <View style={[styles.statusBadge, isAnswered ? styles.statusBadgeAnswered : styles.statusBadgePending]}>
          <Text style={[styles.statusBadgeText, isAnswered ? styles.statusBadgeTextAnswered : styles.statusBadgeTextPending]}>
            {isAnswered ? 'Resolved' : 'Input Needed'}
          </Text>
        </View>
      </View>

      {/* Questions List */}
      {questions.map((q, qIdx) => {
        const isMulti = Boolean(q.is_multi_select);
        const chosenList = isAnswered
          ? answeredSelections[qIdx] || []
          : selectedOptions[qIdx] || [];

        return (
          <View key={`q_${qIdx}`} style={styles.questionBlock}>
            {/* Question Label */}
            <View style={styles.questionTitleRow}>
              <Text style={styles.questionIndexBadge}>Q{qIdx + 1}</Text>
              <Text style={styles.questionText}>{q.question}</Text>
            </View>

            {isMulti && !isAnswered ? (
              <Text style={styles.multiSelectHint}>Select all that apply</Text>
            ) : null}

            {/* Options List */}
            <View style={styles.optionsList}>
              {q.options?.map((opt, optIdx) => {
                const isSelected = chosenList.some(
                  (c) => c === opt || opt.includes(c) || c.includes(opt)
                );
                const isRecommended = opt.toLowerCase().includes('(recommended)');
                const cleanOptText = opt.replace(/^\(recommended\)\s*/i, '');

                return (
                  <TouchableOpacity
                    key={`opt_${qIdx}_${optIdx}`}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected,
                      isAnswered && styles.optionCardReadonly,
                    ]}
                    onPress={() => handleToggleOption(qIdx, opt, isMulti)}
                    activeOpacity={isAnswered ? 1 : 0.75}
                    disabled={isAnswered}
                  >
                    <View style={styles.optionLeft}>
                      {isMulti ? (
                        <View style={[styles.checkboxBox, isSelected && styles.checkboxBoxSelected]}>
                          {isSelected && <Check size={11} color="#0a0a0a" />}
                        </View>
                      ) : (
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      )}

                      <View style={styles.optionContentCol}>
                        <View style={styles.optionTextRow}>
                          {isRecommended && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedBadgeText}>Recommended</Text>
                            </View>
                          )}
                          <Text
                            style={[
                              styles.optionText,
                              isSelected && styles.optionTextSelected,
                            ]}
                          >
                            {cleanOptText}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Action Submit Button (Only when pending) */}
      {!isAnswered && (
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!hasAnySelection || isSubmitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!hasAnySelection || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#0a0a0a" />
            ) : (
              <>
                <Send size={13} color="#0a0a0a" />
                <Text style={styles.submitBtnText}>Submit Selection</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isAnswered && (
        <View style={styles.answeredFooterRow}>
          <CheckCheck size={13} color="#a3a3a3" />
          <Text style={styles.answeredFooterText}>Decision recorded and applied to agent session</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#161616',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  statusBadgeAnswered: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadgeTextPending: {
    color: '#fafafa',
  },
  statusBadgeTextAnswered: {
    color: '#737373',
  },
  questionBlock: {
    marginBottom: 14,
  },
  questionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  questionIndexBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#a3a3a3',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  questionText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#fafafa',
    lineHeight: 19,
  },
  multiSelectHint: {
    fontSize: 11,
    color: '#737373',
    fontStyle: 'italic',
    marginBottom: 8,
    marginLeft: 32,
  },
  optionsList: {
    gap: 7,
    marginTop: 4,
  },
  optionCard: {
    backgroundColor: '#111111',
    borderRadius: radii.btn,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  optionCardReadonly: {
    opacity: 0.9,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#737373',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioCircleSelected: {
    borderColor: '#fafafa',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#737373',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxSelected: {
    backgroundColor: '#fafafa',
    borderColor: '#fafafa',
  },
  optionContentCol: {
    flex: 1,
  },
  optionTextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  recommendedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  recommendedBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: 0.3,
  },
  optionText: {
    fontSize: 13,
    color: '#a3a3a3',
    lineHeight: 18,
  },
  optionTextSelected: {
    color: '#fafafa',
    fontWeight: '500',
  },
  footerRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fafafa',
    borderRadius: radii.btn,
    paddingHorizontal: 16,
    height: 36,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  answeredFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  answeredFooterText: {
    fontSize: 11,
    color: '#737373',
    fontStyle: 'italic',
  },
});
