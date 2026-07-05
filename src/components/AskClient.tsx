'use client';

import { useCallback, useState } from 'react';
import type { ServiceStatus } from '@/lib/adapters/types';
import { AnswerColumn, type ColumnState } from './AnswerColumn';
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

export function AskClient({ services }: { services: ServiceInfo[] }) {
  const [columns, setColumns] = useState<Record<string, ColumnState>>(() => initialColumns(services));
  const [busy, setBusy] = useState(false);

  const update = useCallback((id: string, patch: Partial<ColumnState>) => {
    setColumns((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const ask = useCallback(
    async (prompt: string) => {
      setBusy(true);
      // 全カラムを接続中にリセット
      setColumns((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(next)) next[id] = { ...next[id], status: 'connecting', text: '', error: undefined };
        return next;
      });

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

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // SSE をパース（data: 行を JSON として処理）
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const payload = JSON.parse(line.slice(6));
            if (payload.type === 'end' || payload.type === 'fatal') continue;
            const patch: Partial<ColumnState> = { status: payload.status as ServiceStatus };
            // text は文字列のときだけ更新（status だけの更新で既存回答を消さない）
            if (typeof payload.text === 'string') patch.text = payload.text;
            if (payload.error) patch.error = payload.error;
            update(payload.service, patch);
          }
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
    [update],
  );

  return (
    <div className="flex flex-col gap-6">
      <QuestionInput busy={busy} onSubmit={ask} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {services.map((s) => (
          <AnswerColumn key={s.id} state={columns[s.id]} />
        ))}
      </div>
    </div>
  );
}
