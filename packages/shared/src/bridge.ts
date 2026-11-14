import { z } from 'zod';
import { BridgeCapabilitiesSchema, SimulationSchemaSchema, SimulationSlugSchema } from './simulation.ts';

export const BRIDGE_PROTOCOL='physim-bridge' as const;
export const BRIDGE_VERSION=1 as const;
export const BridgeCommandTypeSchema=z.enum(['INIT','APPLY_CONFIG','RUN_EXPERIMENT','SWITCH_SCREEN','RESET_SIM','GET_STATE']);
export const BridgeEventTypeSchema=z.enum(['READY','RESULT','ERROR','PROPERTY_CHANGED']);
export const BridgeEnvelopeSchema=z.object({
  protocol:z.literal(BRIDGE_PROTOCOL),version:z.literal(BRIDGE_VERSION),
  loadId:z.string().min(1).max(160),requestId:z.string().min(1).max(160).optional(),
  type:z.union([BridgeCommandTypeSchema,BridgeEventTypeSchema]),payload:z.unknown()
}).refine(message=>!BridgeCommandTypeSchema.safeParse(message.type).success||Boolean(message.requestId),{message:'Bridge commands require requestId',path:['requestId']});
export type BridgeEnvelope=z.infer<typeof BridgeEnvelopeSchema>;
export type BridgeCommandType=z.infer<typeof BridgeCommandTypeSchema>;
export const BridgeReadyPayloadSchema=z.object({
  slug:SimulationSlugSchema,version:z.string(),screenId:z.string(),
  capabilities:BridgeCapabilitiesSchema,schema:SimulationSchemaSchema
});
export type BridgeReadyPayload=z.infer<typeof BridgeReadyPayloadSchema>;
export function makeBridgeCommand(type:BridgeCommandType,loadId:string,requestId:string,payload:unknown={}):BridgeEnvelope{
  return BridgeEnvelopeSchema.parse({protocol:BRIDGE_PROTOCOL,version:BRIDGE_VERSION,loadId,requestId,type,payload});
}
/** Origin and source window are checked by the platform transport before this validation. */
export function parseBridgeMessage(value:unknown,currentLoadId:string):BridgeEnvelope|null{
  let decoded:unknown=value;
  if(typeof value==='string'){try{decoded=JSON.parse(value);}catch{return null;}}
  const parsed=BridgeEnvelopeSchema.safeParse(decoded);
  return parsed.success&&parsed.data.loadId===currentLoadId?parsed.data:null;
}
