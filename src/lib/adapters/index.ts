import type { AIServiceAdapter } from './types';
import { claudeAdapter } from './claude';
import { chatgptAdapter } from './chatgpt';
import { geminiAdapter } from './gemini';
import { manusAdapter } from './manus';

/** 全アダプタ（無効も含む）。 */
export const ALL_ADAPTERS: AIServiceAdapter[] = [
  claudeAdapter,
  chatgptAdapter,
  geminiAdapter,
  manusAdapter,
];

/** 有効なアダプタのみ（orchestrator が実際に問い合わせる対象）。 */
export const ENABLED_ADAPTERS = ALL_ADAPTERS.filter((a) => a.enabled);

export * from './types';
