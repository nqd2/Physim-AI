import assert from "node:assert/strict";
import { test } from "node:test";
import { bridgeMessageSchema, isConfigSupported, simulationSchema } from "./index.ts";

const ohm = simulationSchema.parse({
  slug: "ohms-law", title: "Định luật Ohm", chapter: "electromagnetism",
  version: "1.4.33", locale: "vi", assetPath: "ohms-law.html", sha256: "0".repeat(64),
  bridgeMode: "guided", screens: [{
    id: "main", title: "Định luật Ohm", actions: [{ id: "measure", label: "Đo" }],
    properties: [
      { id: "voltage", label: "Hiệu điện thế", kind: "number", writable: true, range: [0.1, 9] },
      { id: "current", label: "Cường độ dòng điện", kind: "number", writable: false }
    ]
  }]
});

test("accepts an available screen, action and writable bounded property", () => {
  assert.equal(isConfigSupported(ohm, {
    slug: "ohms-law", screenId: "main", values: { voltage: 6 }, actionId: "measure"
  }), true);
});

test("rejects unverified simulation configurations", () => {
  for (const config of [
    { slug: "other", screenId: "main", values: {} },
    { slug: "ohms-law", screenId: "other", values: {} },
    { slug: "ohms-law", screenId: "main", values: { voltage: 10 } },
    { slug: "ohms-law", screenId: "main", values: { current: 0.01 } },
    { slug: "ohms-law", screenId: "main", values: {}, actionId: "unknown" }
  ]) {
    assert.equal(isConfigSupported(ohm, config), false, JSON.stringify(config));
  }
});

test("checks bridge version and command payload", () => {
  const request = { version: 1, channel: "lab", requestId: "a", type: "APPLY_CONFIG" };
  assert.equal(bridgeMessageSchema.safeParse({ ...request, payload: { screenId: "main", values: { voltage: 5 } } }).success, true);
  assert.equal(bridgeMessageSchema.safeParse({ ...request, payload: { actionId: "measure" } }).success, false);
  assert.equal(bridgeMessageSchema.safeParse({ ...request, version: 2, payload: { screenId: "main", values: {} } }).success, false);
});
