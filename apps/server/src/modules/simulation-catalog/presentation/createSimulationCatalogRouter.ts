import { Router } from 'express';
import { EnsureReadyRequestSchema, SimulationSlugSchema, ERROR_MESSAGES } from '@physim/shared';
import { CatalogError, type SimulationCatalog } from '../domain/SimulationCatalog.ts';
import { ListSimulations } from '../application/list-simulations/ListSimulations.ts';
import { GetSimulationSchema } from '../application/get-schema/GetSimulationSchema.ts';
import { EnsureSimulationReady } from '../application/ensure-ready/EnsureSimulationReady.ts';

export function createSimulationCatalogRouter(catalog:SimulationCatalog):Router {
  const router=Router();
  const list=new ListSimulations(catalog),schema=new GetSimulationSchema(catalog),ensure=new EnsureSimulationReady(catalog);
  router.get('/',async (_req,res)=>{res.json(await list.execute());});
  router.get('/:slug/schema',async (req,res)=>{
    const parsed=SimulationSlugSchema.safeParse(req.params.slug);
    if(!parsed.success)throw new CatalogError('NOT_FOUND',ERROR_MESSAGES.NOT_FOUND,404);
    res.json(await schema.execute({slug:parsed.data}));
  });
  router.post('/:slug/ensure-ready',async (req,res)=>{
    const slug=SimulationSlugSchema.safeParse(req.params.slug),body=EnsureReadyRequestSchema.safeParse(req.body??{});
    if(!slug.success)throw new CatalogError('NOT_FOUND',ERROR_MESSAGES.NOT_FOUND,404);
    if(!body.success)throw new CatalogError('VALIDATION_ERROR',ERROR_MESSAGES.VALIDATION_ERROR,400);
    res.json(await ensure.execute({slug:slug.data,...body.data}));
  });
  return router;
}
