import { z } from 'zod';
import { AnalyzePhotoResponseSchema, CheckWorkResponseSchema, EvaluateTeachBackResponseSchema, GenerateVariantResponseSchema, SimulationCatalogResponseSchema, EnsureReadyResponseSchema, SimulationSchemaSchema, type AnalyzePhotoRequest, type CheckWorkRequest, type EvaluateTeachBackRequest, type GenerateVariantRequest } from '@physim/shared';

export class ApiError extends Error {
  constructor(message:string,readonly code='NETWORK_ERROR',readonly retryable=true){super(message);this.name='ApiError';}
}
export async function request<T>(baseUrl:string,path:string,schema:{parse:(value:unknown)=>T},body?:unknown):Promise<T>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
    const response=await fetch(`${baseUrl.replace(/\/$/,'')}/api/v1${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new ApiError(data?.error?.message||'Máy chủ chưa xử lý được yêu cầu. Hãy thử lại.',data?.error?.code||'SERVER_ERROR',data?.error?.retryable!==false);
    try{return schema.parse(data);}catch{throw new ApiError('Dữ liệu từ máy chủ không đúng định dạng. Kiểm tra phiên bản ứng dụng và server.','INVALID_RESPONSE',false);}
  }catch(error){
    if(error instanceof ApiError)throw error;
    if(error instanceof Error&&error.name==='AbortError')throw new ApiError('Máy chủ phản hồi quá lâu. Hãy kiểm tra kết nối và thử lại.','TIMEOUT');
    throw new ApiError('Không kết nối được máy chủ. Kiểm tra địa chỉ server trong Cài đặt và kết nối mạng.');
  }finally{clearTimeout(timer);}
}
export const healthSchema=z.object({ok:z.literal(true),service:z.string(),ai:z.object({configured:z.boolean(),model:z.string()}),protocolVersion:z.number()});
export const getHealth=(base:string)=>request(base,'/health',healthSchema);
export const getCatalog=(base:string)=>request(base,'/simulations',SimulationCatalogResponseSchema);
export const getSimulationSchema=(base:string,slug:string)=>request(base,`/simulations/${encodeURIComponent(slug)}/schema`,SimulationSchemaSchema);
export const ensureReady=(base:string,slug:string,version?:string)=>request(base,`/simulations/${encodeURIComponent(slug)}/ensure-ready`,EnsureReadyResponseSchema,version?{version}:{});
export const analyzePhoto=(base:string,body:AnalyzePhotoRequest)=>request(base,'/learning/analyze-photo',AnalyzePhotoResponseSchema,body);
export const checkWork=(base:string,body:CheckWorkRequest)=>request(base,'/learning/check-work',CheckWorkResponseSchema,body);
export const evaluateTeachBack=(base:string,body:EvaluateTeachBackRequest)=>request(base,'/learning/evaluate-teach-back',EvaluateTeachBackResponseSchema,body);
export const generateVariant=(base:string,body:GenerateVariantRequest)=>request(base,'/learning/generate-variant',GenerateVariantResponseSchema,body);
export function simulationUrl(base:string,url:string){
  if(url.startsWith('//'))throw new ApiError('Đường dẫn mô phỏng không hợp lệ.','INVALID_RESPONSE',false);
  const result=/^https?:\/\//i.test(url)?new URL(url):new URL(url.replace(/^\/+/,''),`${base.replace(/\/$/,'')}/`);
  if(result.origin!==new URL(base).origin)throw new ApiError('Đường dẫn mô phỏng không thuộc server đã chọn.','INVALID_RESPONSE',false);
  return result.toString();
}
