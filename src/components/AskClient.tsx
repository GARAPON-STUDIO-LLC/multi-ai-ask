'use client';

import { useCallback, useState } from 'react';
import type { ServiceStatus } from '@/lib/adapters/types';
import { AnswerColumn, type ColumnState } from './AnswerColumn';
import { AnalysisPanel, type AnalysisState } from './AnalysisPanel';
import { QuestionInput } from './QuestionInput';

interface ServiceInfo {
  id: string;
  name: string;
}

function initialColumns(services: ServiceInfo[]): Record<string, ColumnState> {
  const map: Record<string, ColumnState> = {};
  for (const s of services) {
    map[s.id] = { id: s.id, name: s.name, status: 'idle', text: '' };
  }
  return map;
}

const IDLE_ANALYSIS: AnalysisState = { status: 'idle', text: '' };

/** SSE レスポンスの data: 行を JSON として1件ずつコールバックに流す。 */
async function readSSE(res: Response, onEvent: (payload: Record<string, unknown>) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)));
    }
  }
}

export function AskClient({ services }: { services: ServiceInfo[] }) {
  const [columns, setColumns] = useState<Record<string, ColumnState>>(() => initialColumns(services));
  const [analysis, setAnalysis] = useState<AnalysisState>(IDLE_ANALYSIS);
  const [busy, setBusy] = useState(false);

  const update = useCallback((id: string, patch: Partial<ColumnState>) => {
    setColumns((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  // 4回答を Claude に分析させる（/api/analyze をストリーム）。
  const runAnalysis = useCallback(async (prompt: string, answers: { name: string; text: string }[]) => {
    setAnalysis({ status: 'connecting', text: '' });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, answers }),
      });
      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => ({ error: '通信エラー' }));
        throw new Error(msg.error ?? '通信エラー');
      }
      await readSSE(res, (payload) => {
        if (payload.type === 'end' || payload.type === 'fatal') return;
        setAnalysis((prev) => ({
          status: (payload.status as ServiceStatus) ?? prev.status,
          text: typeof payload.text === 'string' ? payload.text : prev.text,
          error: typeof payload.error === 'string' ? payload.error : prev.error,
        }));
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAnalysis((prev) => ({ ...prev, status: 'error', error: message }));
    }
  }, []);

  const ask = useCallback(
    async (prompt: string) => {
      setBusy(true);
      setAnalysis(IDLE_ANALYSIS);
      // 全カラムを接続中にリセット
      setColumns((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) next[id] = { ...next[id], status: 'connecting', text: '', error: undefined };
        return next;
      });

      // SSE 受信中に各サービスの最新回答を控えておき、完了後の自動分析に使う。
      const latest = new Map<string, { name: string; text: string; status: ServiceStatus }>();

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        if (!res.ok || !res.body) {
          const msg = await res.json().catch(() => ({ error: '通信エラー' }));
          throw new Error(msg.error ?? '通信エラー');
        }

        await readSSE(res, (payload) => {
          if (payload.type === 'end' || payload.type === 'fatal') return;
          const id = payload.service as string;
          const status = payload.status as ServiceStatus;
          const patch: Partial<ColumnState> = { status };
          // text は文字列のときだけ更新（status だけの更新で既存回答を消さない）
          if (typeof payload.text === 'string') patch.text = payload.text;
          if (payload.error) patch.error = payload.error as string;
          update(id, patch);

          const prev = latest.get(id) ?? { name: (payload.name as string) ?? id, text: '', status };
          latest.set(id, {
            name: (payload.name as string) ?? prev.name,
            text: typeof payload.text === 'string' ? payload.text : prev.text,
            status,
          });
        });

        // 全回答が出そろったら、2件以上の実回答を Claude に分析させる。
        const answers = [...latest.values()]
          .filter((v) => v.text.trim().length > 0)
          .map((v) => ({ name: v.name, text: v.text }));
        if (answers.length >= 2) {
          await runAnalysis(prompt, answers);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setColumns((prev) => {
          const next = { ...prev };
          for (const id of Object.keys(next)) {
            if (next[id].status === 'connecting') next[id] = { ...next[id], status: 'error', error: message };
          }
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [update, runAnalysis],
  );

  return (
    <div className="flex flex-col gap-6">
      <QuestionInput busy={busy} onSubmit={ask} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {services.map((s) => (
          <AnswerColumn key={s.id} state={columns[s.id]} />
        ))}
      </div>
      <AnalysisPanel state={analysis} />
    </div>
  );
}
