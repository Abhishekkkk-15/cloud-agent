import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Card, Badge, Button, Spinner, Text, cn } from 'panelui-native';
import { HelpCircle, Check, Send, CheckCheck } from './Icons';
import { useDaemonStore } from '../stores/useDaemonStore';
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
  const theme = useDaemonStore((s) => s.theme);
  const isLight = theme === 'light';

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
    <Card className="my-2 p-3.5 bg-surface border border-border rounded-2xl shadow-sm">
      {/* Header */}
      <View className="flex-row items-center justify-between pb-2.5 mb-2.5 border-b border-border">
        <View className="flex-row items-center gap-2">
          <View className="w-6 h-6 rounded-md bg-surface-secondary items-center justify-center border border-border">
            <HelpCircle size={14} color={isLight ? '#262626' : '#f5f5f5'} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            Clarification
          </Text>
        </View>

        <Badge
          variant={isAnswered ? 'success' : 'secondary'}
          size="sm"
          className="px-2 py-0.5"
        >
          <Text className="text-[11px] font-medium">
            {isAnswered ? 'Resolved' : 'Input Needed'}
          </Text>
        </Badge>
      </View>

      {/* Questions List */}
      <View className="gap-3.5">
        {questions.map((q, qIdx) => {
          const isMulti = Boolean(q.is_multi_select);
          const chosenList = isAnswered
            ? answeredSelections[qIdx] || []
            : selectedOptions[qIdx] || [];

          return (
            <View key={`q_${qIdx}`} className="gap-2">
              {/* Question Text */}
              <View className="flex-row items-start gap-2">
                <Badge variant="outline" size="sm" className="px-1.5 py-0 mt-0.5">
                  <Text className="text-[10px] font-mono font-bold text-muted-foreground">
                    Q{qIdx + 1}
                  </Text>
                </Badge>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-foreground leading-relaxed">
                    {q.question}
                  </Text>
                  {isMulti && !isAnswered && (
                    <Text className="text-[11px] text-muted-foreground mt-0.5">
                      Select multiple
                    </Text>
                  )}
                </View>
              </View>

              {/* Options List */}
              <View className="gap-1.5 pl-6">
                {q.options?.map((opt, optIdx) => {
                  const isSelected = chosenList.some(
                    (c) => c === opt || opt.includes(c) || c.includes(opt)
                  );
                  const isRecommended = opt.toLowerCase().includes('(recommended)');
                  const cleanOptText = opt.replace(/^\(recommended\)\s*/i, '');

                  return (
                    <TouchableOpacity
                      key={`opt_${qIdx}_${optIdx}`}
                      className={cn(
                        'p-2.5 rounded-xl border flex-row items-center gap-2.5',
                        isSelected
                          ? 'bg-surface-secondary border-primary/40'
                          : 'bg-surface border-border',
                        isAnswered && 'opacity-80'
                      )}
                      onPress={() => handleToggleOption(qIdx, opt, isMulti)}
                      activeOpacity={isAnswered ? 1 : 0.75}
                      disabled={isAnswered}
                    >
                      {/* Selection Box / Radio Indicator */}
                      <View
                        className={cn(
                          'w-4 h-4 rounded-md border items-center justify-center',
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30 bg-surface'
                        )}
                      >
                        {isSelected && (
                          <Check size={11} color={isLight ? '#fafafa' : '#262626'} />
                        )}
                      </View>

                      {/* Content */}
                      <View className="flex-1 flex-row items-center gap-1.5 flex-wrap">
                        {isRecommended && (
                          <Badge variant="secondary" size="sm" className="px-1.5 py-0">
                            <Text className="text-[10px] font-medium text-muted-foreground">
                              Recommended
                            </Text>
                          </Badge>
                        )}
                        <Text
                          className={cn(
                            'text-xs flex-1',
                            isSelected
                              ? 'text-foreground font-medium'
                              : 'text-muted-foreground'
                          )}
                        >
                          {cleanOptText}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {/* Footer / Submit Button */}
      {!isAnswered ? (
        <View className="pt-3 mt-3 border-t border-border">
          <Button
            variant="primary"
            size="sm"
            className="w-full flex-row items-center justify-center gap-1.5 py-2"
            onPress={handleSubmit}
            disabled={!hasAnySelection || isSubmitting}
          >
            {isSubmitting ? (
              <Spinner size="sm" color={isLight ? '#fafafa' : '#262626'} />
            ) : (
              <>
                <Send size={13} color={isLight ? '#fafafa' : '#262626'} />
                <Text className="text-xs font-semibold text-primary-foreground">
                  Submit Selection
                </Text>
              </>
            )}
          </Button>
        </View>
      ) : (
        <View className="flex-row items-center gap-1.5 pt-2.5 mt-2.5 border-t border-border">
          <CheckCheck size={13} color="#10b981" />
          <Text className="text-[11px] text-muted-foreground">
            Response recorded and sent to agent.
          </Text>
        </View>
      )}
    </Card>
  );
};
