import type { ICliAdapter, CliAvailability } from "@cloud-agent/cli-interface";
import { AntigravityAdapter } from "@cloud-agent/cli-antigravity";

export class CliAdapterRegistry {
  private adapters = new Map<string, ICliAdapter>();
  private defaultAdapterId = "antigravity";

  constructor() {
    // Register standard first-party CLI adapters
    this.register(new AntigravityAdapter());
  }

  register(adapter: ICliAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  setDefault(id: string): void {
    if (this.adapters.has(id.toLowerCase())) {
      this.defaultAdapterId = id.toLowerCase();
    }
  }

  get(id?: string): ICliAdapter {
    const key = (id || this.defaultAdapterId).toLowerCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new Error(`CLI adapter '${key}' is not registered. Available: ${Array.from(this.adapters.keys()).join(", ")}`);
    }
    return adapter;
  }

  list(): Array<{ id: string; displayName: string; binaryName: string }> {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.id,
      displayName: a.displayName,
      binaryName: a.binaryName,
    }));
  }

  async checkAll(): Promise<Record<string, CliAvailability>> {
    const results: Record<string, CliAvailability> = {};
    for (const [id, adapter] of this.adapters.entries()) {
      results[id] = await adapter.checkAvailability();
    }
    return results;
  }
}

export const registry = new CliAdapterRegistry();
