import { z } from 'zod';

export const ChapterIdSchema = z.enum(['mechanics', 'thermal', 'electricity', 'waves', 'optics', 'nuclear']);
export type ChapterId = z.infer<typeof ChapterIdSchema>;
export const CHAPTERS: ReadonlyArray<{id: ChapterId; title: string; description: string}> = [
  {id:'mechanics',title:'Cơ học',description:'Chuyển động, lực và năng lượng'},
  {id:'thermal',title:'Nhiệt & Chất khí',description:'Nhiệt độ, áp suất và chuyển động phân tử'},
  {id:'electricity',title:'Điện & Từ',description:'Điện tích, dòng điện và từ trường'},
  {id:'waves',title:'Dao động & Sóng',description:'Dao động, truyền sóng và âm thanh'},
  {id:'optics',title:'Quang học',description:'Ánh sáng, khúc xạ và tạo ảnh'},
  {id:'nuclear',title:'Nguyên tử & Hạt nhân',description:'Cấu trúc nguyên tử và các hạt cơ bản'}
];
export const SimulationSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const PrimitiveSchema = z.union([z.number().finite(), z.string(), z.boolean()]);
export type Primitive = z.infer<typeof PrimitiveSchema>;
export const SimulationConfigSchema = z.object({
  slug: SimulationSlugSchema,
  version: z.string().min(1).max(60).optional(),
  screenId: z.string().min(1).max(100),
  values: z.record(z.string().min(1).max(120), PrimitiveSchema)
}).strict();
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;
export const SimulationPropertySchema = z.object({
  key: z.string().min(1), name: z.string().optional(),
  type: z.enum(['number','string','boolean']),
  defaultValue: PrimitiveSchema.nullable().optional(), min: z.number().finite().optional(), max: z.number().finite().optional(),
  values: z.array(PrimitiveSchema).optional(), unit: z.string().optional(), integer:z.boolean().optional(),
  nullable:z.boolean().optional(),step:z.number().finite().positive().optional(),writable: z.boolean()
});
export const SimulationScreenSchema = z.object({
  id: z.string().min(1), name: z.string(),
  properties: z.array(SimulationPropertySchema),
  actions: z.array(z.object({id: z.string().min(1),name: z.string()}))
});
export const SimulationSchemaSchema = z.object({
  slug: SimulationSlugSchema, version: z.string().min(1), adapterVerified: z.boolean(),
  screens: z.array(SimulationScreenSchema)
});
export type SimulationProperty = z.infer<typeof SimulationPropertySchema>;
export type SimulationScreen = z.infer<typeof SimulationScreenSchema>;
export type SimulationSchema = z.infer<typeof SimulationSchemaSchema>;
export const BridgeCapabilitiesSchema = z.object({
  applyConfig:z.boolean(),runExperiment:z.boolean(),switchScreen:z.boolean(),resetSim:z.boolean(),getState:z.boolean(),telemetry:z.boolean()
});
export type BridgeCapabilities = z.infer<typeof BridgeCapabilitiesSchema>;
export const NO_BRIDGE_CAPABILITIES: BridgeCapabilities = {applyConfig:false,runExperiment:false,switchScreen:false,resetSim:false,getState:false,telemetry:false};
export const SimulationStateSchema = z.object({
  slug: SimulationSlugSchema, version:z.string(),screenId:z.string(),values:z.record(z.string(),PrimitiveSchema.nullable())
});
export type SimulationState = z.infer<typeof SimulationStateSchema>;
export const SimulationLicenseSchema=z.object({id:z.string(),url:z.string().url()});
export const SimulationSummarySchema=z.object({
  slug:SimulationSlugSchema,title:z.string(),titleEn:z.string(),chapter:ChapterIdSchema,
  version:z.string(),locale:z.enum(['vi','en']),sha256:z.string().regex(/^[a-f0-9]{64}$/),
  license:SimulationLicenseSchema,releaseDate:z.string().nullable(),
  sourceUrl:z.string().url(),sourcePage:z.string().url(),attribution:z.string(),
  adapterVerified:z.boolean(),capabilities:z.array(z.string())
});
export type SimulationSummary=z.infer<typeof SimulationSummarySchema>;
export const SimulationCatalogResponseSchema=z.object({
  simulations:z.array(SimulationSummarySchema),chapters:z.array(z.object({id:ChapterIdSchema,title:z.string(),description:z.string().optional()})),total:z.number().int().nonnegative()
});
export type SimulationCatalogResponse=z.infer<typeof SimulationCatalogResponseSchema>;
export const EnsureReadyRequestSchema=z.object({version:z.string().optional()}).strict();
export const EnsureReadyResponseSchema=z.object({
  slug:SimulationSlugSchema,version:z.string(),locale:z.enum(['vi','en']),url:z.string(),
  capabilities:z.array(z.string()),adapterVerified:z.boolean(),attribution:z.string(),license:SimulationLicenseSchema
});
export type EnsureReadyResponse=z.infer<typeof EnsureReadyResponseSchema>;

export interface ConfigValidationResult { success: boolean; errors: string[] }
/** Validate the whole proposal before any runtime property is mutated. */
export function validateSimulationConfig(schema: SimulationSchema, candidate: unknown): ConfigValidationResult {
  const parsed=SimulationConfigSchema.safeParse(candidate);
  if(!parsed.success)return {success:false,errors:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`)};
  const config=parsed.data,errors:string[]=[];
  if(config.slug!==schema.slug)errors.push('Mô phỏng không khớp với schema.');
  if(config.version && config.version!==schema.version)errors.push('Phiên bản mô phỏng không khớp.');
  if(!schema.adapterVerified)errors.push('Adapter chưa được kiểm thử cho phiên bản mô phỏng này.');
  const screen=schema.screens.find(item=>item.id===config.screenId);
  if(!screen)return {success:false,errors:[...errors,'Màn hình không tồn tại.']};
  for(const [key,value] of Object.entries(config.values)){
    const property=screen.properties.find(item=>item.key===key);
    if(!property){errors.push(`${key}: đại lượng chưa được đăng ký.`);continue;}
    if(!property.writable)errors.push(`${key}: đại lượng chỉ đọc.`);
    if(typeof value!==property.type)errors.push(`${key}: kiểu dữ liệu không hợp lệ.`);
    if(typeof value==='number'){
      if(property.integer&&!Number.isInteger(value))errors.push(`${key}: giá trị phải là số nguyên.`);
      if(property.min!==undefined&&value<property.min)errors.push(`${key}: nhỏ hơn ${property.min}.`);
      if(property.max!==undefined&&value>property.max)errors.push(`${key}: lớn hơn ${property.max}.`);
    }
    if(property.values && !property.values.some(allowed=>Object.is(allowed,value)))errors.push(`${key}: giá trị không thuộc danh sách cho phép.`);
  }
  return {success:errors.length===0,errors};
}
