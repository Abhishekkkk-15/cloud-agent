import React, { useEffect } from 'react';
import { toast, type ToastVariant } from 'panelui-native';
import { onInAppNotification } from '../lib/notifications';

interface NotificationBannerProps {
  onNavigate?: (screen: 'agent' | 'health' | 'approvals' | 'sessions') => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onNavigate }) => {
  useEffect(() => {
    const unsubscribe = onInAppNotification((payload) => {
      let variant: ToastVariant = 'info';
      let actionLabel: string | undefined = undefined;
      let onActionPress: (() => void) | undefined = undefined;

      if (payload.type === 'approval_required') {
        variant = 'destructive';
        actionLabel = 'Review';
        onActionPress = () => onNavigate?.('approvals');
      } else if (payload.type === 'turn_complete') {
        variant = 'success';
        actionLabel = 'View';
        onActionPress = () => onNavigate?.('agent');
      } else if (payload.type === 'error') {
        variant = 'destructive';
      }

      toast.show({
        placement: 'top',
        variant,
        label: payload.title,
        description: payload.body,
        duration: 4500,
        closable: true,
        actionLabel,
        onActionPress: onActionPress ? (handle) => {
          handle.hide();
          onActionPress?.();
        } : undefined,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onNavigate]);

  // ToastViewport renders the toasts in Portal; this component only needs to manage subscription
  return null;
};
