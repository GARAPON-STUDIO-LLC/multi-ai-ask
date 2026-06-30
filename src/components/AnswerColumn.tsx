import type { ServiceStatus } from '@/lib/adapters/types';
import { StatusBadge } from './StatusBadge';

export interface ColumnState {
  id: string;
  name: string;
  status: ServiceStatus;
  text: string;
  error?: string;
}

const ACCENT: Record<string, string> = {
  claude: 'border-t-orange-400',
  chatgpt: 'border-t-teal-400',
  gemini: 'border-t-blue-400',
  manus: 'border-t-purple-400',
};

export function AnswerColumn({ state }: { state: ColumnState }) {
  return (
    <div
      className={`flex min-h-[60vh] flex-col rounded-xl border border-gray-200 border-t-4 bg-white shadow-sm ${
        ACCENT[state.id] ?? 'border-t-gray-300'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="font-semibold text-gray-800">{state.name}</h2>
        <StatusBadge status={state.status} />
      </header>

      <div className="flex-1 overflow-auto px-4 py-3">
        {state.status === 'need_login' && (
          <p className="text-sm text-amber-700">
            このサービスはログインが必要です。ターミナルで
            <code className="mx-1 rounded bg-amber-50 px-1">npm run setup-login</code>
            を実行してログインしてください。
          </p>
        )}
        {state.status === 'error' && (
          <p className="text-sm text-red-600">エラー: {state.error}</p>
        )}
        {state.text ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800">
            {state.text}
          </pre>
        ) : (
          state.status !== 'need_login' &&
          state.status !== 'error' && (
            <p className="text-sm text-gray-400">
              {state.status === 'idle' ? '質問を送信すると回答がここに表示されます。' : '…'}
            </p>
          )
        )}
      </div>
    </div>
  );
}
