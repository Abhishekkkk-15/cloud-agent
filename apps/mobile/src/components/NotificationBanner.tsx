import React, { useEffect } from 'react';
import { toast, type ToastVariant } from 'panelui-native';
import { onInAppNotification } from '../lib/notifications';
import { ShieldAlert, Sparkles, AlertTriangle, BellRing } from './Icons';

interface NotificationBannerProps {
  onNavigate?: (screen: 'agent' | 'health' | 'approvals' | 'sessions') => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onNavigate }) => {
  useEffect(() => {
    const unsubscribe = onInAppNotification((payload) => {
      let variant: ToastVariant = 'info';
      let actionLabel: string | undefined = undefined;
      let onActionPress: (() => void) | undefined = undefined;
      let icon: React.ReactNode = <BellRing size={18} color="#3b82f6" />;
      let duration = 4000;

      if (payload.type === 'approval_required') {
        variant = 'destructive';
        actionLabel = 'Review';
        duration = 6000;
        icon = <ShieldAlert size={18} color="#ef4444" />;
        onActionPress = () => onNavigate?.('approvals');
      } else if (payload.type === 'turn_complete') {
        variant = 'success';
        actionLabel = 'View';
        duration = 4500;
        icon = <Sparkles size={18} color="#10b981" />;
        onActionPress = () => onNavigate?.('agent');
      } else if (payload.type === 'error') {
        variant = 'destructive';
        duration = 5000;
        icon = <AlertTriangle size={18} color="#ef4444" />;
      }

      toast.show({
        placement: 'top',
        variant,
        icon,
        label: payload.title,
        description: payload.body,
        duration,
        closable: true,
        actionLabel,
        onActionPress: onActionPress
          ? (handle) => {
              handle.hide();
              onActionPress?.();
            }
          : undefined,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [onNavigate]);

  // ToastViewport renders the toasts in Portal; this component only needs to manage subscription
  return null;
};
