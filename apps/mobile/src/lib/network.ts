import { AppState, Platform } from 'react-native';

export type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkMonitor {
  private isOnline: boolean = true;
  private listeners: Set<NetworkStatusListener> = new Set();
  private checkInterval: any = null;
  private isChecking: boolean = false;
  private lastCheckedAt: number = 0;
  private targetGatewayUrl: string = '';

  constructor() {
    this.init();
  }

  private init() {
    // 1. Initial Web state if running in web browser
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      if (typeof navigator.onLine === 'boolean') {
        this.isOnline = navigator.onLine;
      }
      window.addEventListener('online', () => this.handleWebOnlineChange(true));
      window.addEventListener('offline', () => this.handleWebOnlineChange(false));
    }

    // 2. React Native AppState: probe network connectivity immediately when foregrounded
    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        this.checkConnectivity();
      }
    });

    // 3. Initial reachability probe
    this.checkConnectivity();

    // 4. Start polling watchdog
    this.startWatchdog();
  }

  private handleWebOnlineChange(online: boolean) {
    if (online) {
      // Confirm with a quick probe
      this.checkConnectivity();
    } else {
      this.setOnline(false);
    }
  }

  private startWatchdog() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    // Poll more frequently if offline (8s) to quickly catch reconnection, less when online (25s)
    const intervalMs = this.isOnline ? 25000 : 8000;
    this.checkInterval = setInterval(() => {
      this.checkConnectivity();
    }, intervalMs);
  }

  private setOnline(online: boolean) {
    if (this.isOnline !== online) {
      this.isOnline = online;
      this.listeners.forEach((listener) => {
        try {
          listener(online);
        } catch (e) {
          console.warn('[NetworkMonitor] Listener error:', e);
        }
      });
      // Adjust polling frequency
      this.startWatchdog();
    }
  }

  setGatewayUrl(url: string) {
    this.targetGatewayUrl = url;
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.isOnline);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Fast reachability test using HEAD/GET with short timeout (3.5s).
   * Does not rely on any native binary modules.
   */
  async checkConnectivity(overrideGatewayUrl?: string): Promise<boolean> {
    const now = Date.now();
    if (this.isChecking && now - this.lastCheckedAt < 2500) {
      return this.isOnline;
    }

    this.isChecking = true;
    this.lastCheckedAt = now;

    // Web quick-check
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setOnline(false);
      this.isChecking = false;
      return false;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);

      const gw = overrideGatewayUrl || this.targetGatewayUrl;
      const testUrls: string[] = [];
      if (gw && !gw.includes('localhost') && !gw.includes('127.0.0.1')) {
        testUrls.push(`${gw.replace(/\/+$/, '')}/health`);
      }
      // Standard lightweight Google connectivity check (returns 204 No Content with 0 bytes)
      testUrls.push('https://clients3.google.com/generate_204');

      let reachable = false;
      for (const url of testUrls) {
        try {
          const res = await fetch(url, {
            method: 'HEAD',
            headers: { 'Cache-Control': 'no-cache' },
            signal: controller.signal,
          });
          if (res.status >= 200 && res.status < 400) {
            reachable = true;
            break;
          }
        } catch {
          // Probe next endpoint
        }
      }

      clearTimeout(timer);
      this.setOnline(reachable);
      this.isChecking = false;
      return reachable;
    } catch {
      this.setOnline(false);
      this.isChecking = false;
      return false;
    }
  }

  markNetworkFailure() {
    this.setOnline(false);
    setTimeout(() => this.checkConnectivity(), 2000);
  }
}

export const networkMonitor = new NetworkMonitor();
