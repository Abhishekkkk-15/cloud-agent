import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

export interface SandboxedWebViewProps {
  source: { html?: string; uri?: string };
  style?: any;
  scrollEnabled?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (err: any) => void;
}

export const SandboxedWebView: React.FC<SandboxedWebViewProps> = ({
  source,
  style,
  scrollEnabled = true,
  pointerEvents = 'auto',
  onLoadStart,
  onLoadEnd,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const webViewRef = useRef<any>(null);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]} pointerEvents={pointerEvents}>
        <iframe
          src={source.uri}
          srcDoc={source.html}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            overflow: scrollEnabled ? 'auto' : 'hidden',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          onLoad={() => {
            setIsLoading(false);
            onLoadEnd?.();
          }}
          onError={(e) => {
            setIsLoading(false);
            onError?.(e);
          }}
        />
      </View>
    );
  }

  const webViewSource = source.uri
    ? { uri: source.uri }
    : { html: source.html || '', baseUrl: '' };

  return (
    <View style={[styles.container, style]} pointerEvents={pointerEvents}>
      <WebView
        ref={webViewRef}
        source={webViewSource}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
        scrollEnabled={scrollEnabled}
        scalesPageToFit={true}
        nestedScrollEnabled={scrollEnabled}
        onLoadStart={() => {
          setIsLoading(true);
          onLoadStart?.();
        }}
        onLoadEnd={() => {
          setIsLoading(false);
          onLoadEnd?.();
        }}
        onError={(syntheticEvent) => {
          setIsLoading(false);
          onError?.(syntheticEvent.nativeEvent);
        }}
        renderError={(errorDomain, errorCode, errorDesc) => (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Cannot reach server</Text>
            <Text style={styles.errorDesc}>
              {errorDesc || 'Ensure the dev server is running on the host machine and port is exposed.'}
            </Text>
          </View>
        )}
        style={styles.webView}
      />
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  errorContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#161616',
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f5f5f5',
    textAlign: 'center',
  },
  errorDesc: {
    fontSize: 12,
    color: '#a3a3a3',
    textAlign: 'center',
    maxWidth: 280,
  },
});
