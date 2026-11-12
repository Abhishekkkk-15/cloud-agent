import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BaseCliAdapter } from "../src/adapter.js";
import type { CliCapabilities, CliModelCapability } from "../src/types.js";

class MockAdapter extends BaseCliAdapter {
  readonly id = "mock-cli";
  readonly displayName = "Mock CLI";
  readonly binaryName = "mock";
}

class CustomConfiguredAdapter extends BaseCliAdapter {
  readonly id = "custom-cli";
  readonly displayName = "Custom Configured CLI";
  readonly binaryName = "custom";

  async getCapabilities(): Promise<CliCapabilities> {
    return {
      cliId: this.id,
      displayName: this.displayName,
      supportedModes: ["auto", "plan", "review"],
      defaultMode: "plan",
      supportsEffort: true,
      supportedEffortLevels: ["low", "high"],
      defaultEffort: "high",
      permissions: {
        supportsHeadlessHitl: true,
        requiresBypassInHeadless: false,
        warningMessage: "Custom warning",
        defaultAutoApprove: false,
      },
      models: {
        supportsDynamicDiscovery: true,
      },
    };
  }

  async listModels(): Promise<CliModelCapability[]> {
    return [
      {
        id: "mock-model-1",
        name: "Mock Fast Model",
        provider: "MockOrg",
        supportsEffort: false,
      },
      {
        id: "mock-model-2",
        name: "Mock Reasoning Model",
        provider: "MockOrg",
        supportsEffort: true,
        supportedEffortLevels: ["low", "high"],
        isDefault: true,
      },
    ];
  }
}

describe("@cloud-agent/cli-interface - Capabilities & Adapter Contract", () => {
  it("BaseCliAdapter should provide safe fallback capabilities when not overridden", async () => {
    const adapter = new MockAdapter();
    const caps = await adapter.getCapabilities();

    assert.ok(caps, "Capabilities should not be null or undefined");
    assert.equal(caps.cliId, "mock-cli");
    assert.equal(caps.displayName, "Mock CLI");
    assert.equal(caps.defaultMode, "auto");
    assert.deepEqual(caps.supportedModes, ["auto"]);
    assert.equal(caps.supportsEffort, false);
    assert.deepEqual(caps.supportedEffortLevels, []);
    assert.equal(caps.permissions.supportsHeadlessHitl, false);
    assert.equal(caps.permissions.requiresBypassInHeadless, true);
    assert.equal(caps.models.supportsDynamicDiscovery, false);
  });

  it("BaseCliAdapter should provide listModels returning an empty array by default", async () => {
    const adapter = new MockAdapter();
    const models = await adapter.listModels?.();

    assert.ok(Array.isArray(models), "listModels should return an array");
    assert.equal(models?.length, 0);
  });

  it("Custom adapter subclass should override capabilities and model discovery properly", async () => {
    const adapter = new CustomConfiguredAdapter();
    const caps = await adapter.getCapabilities();

    assert.equal(caps.cliId, "custom-cli");
    assert.equal(caps.displayName, "Custom Configured CLI");
    assert.deepEqual(caps.supportedModes, ["auto", "plan", "review"]);
    assert.equal(caps.defaultMode, "plan");
    assert.equal(caps.supportsEffort, true);
    assert.deepEqual(caps.supportedEffortLevels, ["low", "high"]);
    assert.equal(caps.permissions.supportsHeadlessHitl, true);
    assert.equal(caps.permissions.requiresBypassInHeadless, false);
    assert.equal(caps.models.supportsDynamicDiscovery, true);

    const models = await adapter.listModels?.();
    assert.ok(models);
    assert.equal(models.length, 2);
    assert.equal(models[0].id, "mock-model-1");
    assert.equal(models[0].supportsEffort, false);
    assert.equal(models[1].id, "mock-model-2");
    assert.equal(models[1].supportsEffort, true);
    assert.equal(models[1].isDefault, true);
  });
});
