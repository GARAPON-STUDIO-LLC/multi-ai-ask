import type { AIServiceAdapter } from './types';

/**
 * Manus はフェーズ2で実装する。
 * Manus は非同期エージェント基盤で、回答完了までに数分かかり、完了検知も
 * 「実行ステータスの監視」という別ロジックが必要なため、enabled: false にしている。
 * enabled を true にして submit / streamResponse を実装すれば有効化できる。
 */
export const manusAdapter: AIServiceAdapter = {
  id: 'manus',
  name: 'Manus',
  url: 'https://manus.im/',
  enabled: false,

  async ensureReady() {
    return { ready: false };
  },
  async submit() {
    throw new Error('Manus はフェーズ2で実装予定です');
  },
  async *streamResponse() {
    // 未実装
  },
};
