import { z } from "zod";

export const chapters = [
  "mechanics", "thermodynamics", "electromagnetism", "waves", "optics", "quantum",
] as const;
export const chapterLabels: Record<(typeof chapters)[number], string> = {
  mechanics: "Cơ học",
  thermodynamics: "Nhiệt & Chất khí",
  electromagnetism: "Điện & Từ trường",
  waves: "Dao động & Sóng",
  optics: "Quang học",
  quantum: "Lượng tử & Hạt nhân",
};

const id = z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const summary = z.string().trim().min(1);
const finiteNumber = z.number().finite();
export const propertyValueSchema = z.union([
  finiteNumber, z.boolean(), z.string(), z.object({ x: finiteNumber, y: finiteNumber }).strict(),
]);
export const propertySchema = z.object({
  id,
  label: summary,
  kind: z.enum(["number", "boolean", "enum", "vector2"]),
  writable: z.boolean(),
  unit: z.string().optional(),
  defaultValue: propertyValueSchema.optional(),
  range: z.tuple([finiteNumber, finiteNumber]).optional(),
  choices: z.array(z.string()).optional(),
});
export const screenSchema = z.object({
  id,
  title: summary,
  properties: z.array(propertySchema),
  actions: z.array(z.object({ id, label: summary })),
});
export const simulationSchema = z.object({
  slug,
  title: summary,
  chapter: z.enum(chapters),
  version: summary,
  locale: z.enum(["vi", "en"]),
  assetPath: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.html$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  screens: z.array(screenSchema),
  bridgeMode: z.enum(["guided", "manual"]),
});
export const catalogSchema = z.object({
  schemaVersion: z.literal(1),
  simulations: z.array(simulationSchema),
});
export const ensureReadySchema = z.object({
  simulation: simulationSchema,
  url: z.string().regex(/^\/phet-sims\/[A-Za-z0-9][A-Za-z0-9_.-]*\.html$/),
});

const values = z.record(id, propertyValueSchema);
export const simConfigSchema = z.object({
  slug,
  screenId: id,
  values,
  actionId: id.nullable().optional(),
}).strict();

export type PropertyValue = z.infer<typeof propertyValueSchema>;
export type Property = z.infer<typeof propertySchema>;
export type Screen = z.infer<typeof screenSchema>;
export type SimulationSchema = z.infer<typeof simulationSchema>;
export type SimulationCatalog = z.infer<typeof catalogSchema>;
export type EnsureReady = z.infer<typeof ensureReadySchema>;
export type SimConfig = z.infer<typeof simConfigSchema>;

function isPropertyValueAllowed(property: Property, value: PropertyValue): boolean {
  switch (property.kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value) &&
        (!property.range || (value >= property.range[0] && value <= property.range[1]));
    case "boolean":
      return typeof value === "boolean";
    case "enum":
      return typeof value === "string" && property.choices?.includes(value) === true;
    case "vector2":
      return typeof value === "object" && value !== null &&
        Number.isFinite(value.x) && Number.isFinite(value.y);
  }
}

export function isConfigSupported(simulation: SimulationSchema, config: SimConfig): boolean {
  if (simulation.bridgeMode !== "guided" || simulation.slug !== config.slug) {
    return false;
  }
  const screen = simulation.screens.find(item => item.id === config.screenId);
  if (!screen || (config.actionId && !screen.actions.some(action => action.id === config.actionId))) {
    return false;
  }
  return Object.entries(config.values).every(([key, value]) => {
    const property = screen.properties.find(item => item.id === key && item.writable);
    return property !== undefined && isPropertyValueAllowed(property, value);
  });
}

const base = z.object({
  version: z.literal(1),
  channel: z.string().min(1).max(160),
  requestId: z.string().max(160),
});
const state = z.object({ screenId: z.string(), values });
const empty = z.union([z.null(), z.object({}).strict()]).optional();

export const bridgeMessageSchema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("APPLY_CONFIG"), payload: z.object({ screenId: id, values }).strict() }),
  base.extend({ type: z.literal("RUN_EXPERIMENT"), payload: z.object({ actionId: id }).strict() }),
  base.extend({ type: z.literal("SWITCH_SCREEN"), payload: z.object({ screenId: id }).strict() }),
  base.extend({ type: z.literal("RESET_SIM"), payload: empty }),
  base.extend({ type: z.literal("GET_STATE"), payload: empty }),
  base.extend({ type: z.literal("READY"), payload: z.object({ screenId: z.string(), screenIds: z.array(id) }) }),
  base.extend({ type: z.literal("ACK"), payload: state }),
  base.extend({ type: z.literal("PROPERTY_CHANGED"), payload: state }),
  base.extend({ type: z.literal("ERROR"), payload: z.object({ code: id, message: summary }) }),
]);
export type BridgeMessage = z.infer<typeof bridgeMessageSchema>;

export const imageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png"]),
  base64: z.base64().min(4).max(11_184_812),
}).strict();

export const analysisSchema = z.object({
  problemText: summary,
  facts: z.array(summary).max(24),
  misconception: z.object({
    question: summary,
    choices: z.array(summary).min(2).max(6),
    correctIndex: z.number().int().min(0),
    explanation: summary,
  }).strict().refine(value => value.correctIndex < value.choices.length, {
    path: ["correctIndex"],
    message: "The correct choice must exist.",
  }),
  hints: z.array(z.object({ text: summary, config: simConfigSchema.nullable() }).strict()).min(1).max(12),
  causalChain: z.array(summary).min(2).max(10),
  config: simConfigSchema.nullable(),
}).strict();
export const workDiagnosisSchema = z.object({
  firstError: summary.nullable(),
  hint: summary,
}).strict();
export const teachBackAssessmentSchema = z.object({
  missingLink: summary.nullable(),
  feedback: summary,
}).strict();
export const variantSchema = z.object({
  question: summary,
  expectedObservation: summary,
  config: simConfigSchema.nullable(),
}).strict();

export type ProblemImage = z.infer<typeof imageSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
export type WorkDiagnosis = z.infer<typeof workDiagnosisSchema>;
export type TeachBackAssessment = z.infer<typeof teachBackAssessmentSchema>;
export type Variant = z.infer<typeof variantSchema>;

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  catalogReady: z.boolean(),
  aiConfigured: z.boolean(),
});
export const errorEnvelopeSchema = z.object({
  error: z.object({ code: id, message: summary }),
});
