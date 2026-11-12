import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AntigravityAdapter } from "../src/adapter.js";

describe("@cloud-agent/cli-antigravity - Capabilities & Model Discovery", () => {
  const adapter = new AntigravityAdapter();

  it("should have correct metadata identifiers", () => {
    assert.equal(adapter.id, "antigravity");
    assert.equal(adapter.displayName, "Google Antigravity");
    assert.equal(adapter.binaryName, "agy");
  });

  it("should return valid Antigravity capabilities manifest", async () => {
    const caps = await adapter.getCapabilities();

    assert.ok(caps, "Capabilities should be defined");
    assert.equal(caps.cliId, "antigravity");
    assert.equal(caps.displayName, "Google Antigravity");
    assert.deepEqual(caps.supportedModes, ["auto", "plan", "accept-edits"]);
    assert.equal(caps.defaultMode, "auto");
    assert.equal(caps.supportsEffort, true);
    assert.deepEqual(caps.supportedEffortLevels, ["low", "medium", "high", "xhigh", "max"]);
    assert.equal(caps.defaultEffort, "high");

    // Invariant checks: Headless HITL must be false and require permission bypass flag
    assert.equal(caps.permissions.supportsHeadlessHitl, false);
    assert.equal(caps.permissions.requiresBypassInHeadless, true);
    assert.equal(caps.permissions.bypassFlagName, "--dangerously-skip-permissions");
    assert.equal(caps.permissions.defaultAutoApprove, true);
    assert.ok(caps.permissions.warningMessage.length > 0);

    // Model discovery configuration
    assert.equal(caps.models.supportsDynamicDiscovery, true);
    assert.ok(Array.isArray(caps.models.fallbackModels));
    assert.ok(caps.models.fallbackModels!.length >= 5);
  });

  it("should return valid models via listModels with providers and effort flags", async () => {
    const models = await adapter.listModels();

    assert.ok(Array.isArray(models), "listModels should return an array");
    assert.ok(models.length > 0, "listModels should not be empty");

    // Check default model exists
    const defaultModel = models.find((m) => m.isDefault);
    assert.ok(defaultModel, "At least one model should be marked as default");
    assert.equal(defaultModel.id, "gemini-3.8-flash-high");

    // Check each model conforms to schema
    for (const model of models) {
      assert.ok(model.id, "Model must have an id");
      assert.ok(model.name, "Model must have a display name");
      assert.ok(["Google", "Anthropic", "OSS"].includes(model.provider || ""), `Model ${model.id} should have recognized provider`);
      assert.equal(typeof model.supportsEffort, "boolean");
      if (model.supportsEffort) {
        assert.ok(Array.isArray(model.supportedEffortLevels), `Model ${model.id} with effort must define effort levels`);
        assert.ok(model.supportedEffortLevels!.length > 0);
      }
    }

    // Verify provider mappings
    const googleModels = models.filter((m) => m.provider === "Google");
    const anthropicModels = models.filter((m) => m.provider === "Anthropic");
    const ossModels = models.filter((m) => m.provider === "OSS");

    assert.ok(googleModels.length > 0, "Should include Google models");
    assert.ok(anthropicModels.length > 0, "Should include Anthropic models");
    assert.ok(ossModels.length > 0, "Should include OSS models");
  });
});
