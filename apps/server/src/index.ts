import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { createApp } from './app.ts';
import { OpenAiCoachingEvaluator } from './modules/coaching-evaluation/infrastructure/OpenAiCoachingEvaluator.ts';
import { OpenAiProblemVisionAnalyzer } from './modules/problem-analysis/infrastructure/OpenAiProblemVisionAnalyzer.ts';
import type { TutoringGateway } from './shared/application/TutoringGateway.ts';
import { OpenAiClientAdapter } from './shared/infrastructure/openai/OpenAiClientAdapter.ts';

const network = {
  host: process.env.HOST?.trim() || '127.0.0.1',
  port: Number(process.env.PORT || '3000'),
};
if (!Number.isSafeInteger(network.port) || network.port < 1 || network.port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}
const storageDir = fileURLToPath(new URL('../storage/', import.meta.url));
const origins = process.env.CORS_ORIGINS ?? 'http://localhost:8081,http://127.0.0.1:8081';
const corsOrigins = origins.split(',').filter(origin => origin.trim()).map(value => {
  const origin = new URL(value.trim());
  if (!['http:', 'https:'].includes(origin.protocol) || origin.href !== origin.origin + '/') {
    throw new Error('CORS_ORIGINS must contain comma-separated HTTP(S) origins.');
  }
  return origin.origin;
});

const key = process.env.OPENAI_API_KEY?.trim();
let model: TutoringGateway | undefined;
if (key) {
  const adapter = new OpenAiClientAdapter(new OpenAI({ apiKey: key, timeout: 30_000, maxRetries: 0, logLevel: 'off' }),
    process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini-2026-03-17');
  const problemAnalyzer = new OpenAiProblemVisionAnalyzer(adapter);
  const evaluator = new OpenAiCoachingEvaluator(adapter);
  model = {
    analyzePhoto: (image, catalog) => problemAnalyzer.analyzePhoto(image, catalog),
    generateVariant: (submission, simulation) => problemAnalyzer.generateVariant(submission, simulation),
    checkWork: (image, analysis) => evaluator.checkWork(image, analysis),
    evaluateTeachBack: submission => evaluator.evaluateTeachBack(submission),
  };
}

createApp({ storageDir, model, corsOrigins }).listen(network.port, network.host, () => {
  console.log(`Physim-AI server listening on ${network.host}:${network.port}`);
});
