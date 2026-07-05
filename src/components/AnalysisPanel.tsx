import type { ServiceStatus } from '@/lib/adapters/types';
import { StatusBadge } from './StatusBadge';

export interface AnalysisState {
  status: ServiceStatus;
  text: string;
  error?: string;
}

export function AnalysisPanel({ state }: { state: AnalysisState }) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 border-t-4 border-t-rose-400 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="font-semibold text-gray-800">
          分析 <span className="ml-1 text-xs font-normal text-gray-400">Claude が4回答を比較</span>
        </h2>
        <StatusBadge status={state.status} />
      </header>

      <div className="px-4 py-3">
        {state.status === 'need_login' && (
          <p className="text-sm text-amber-700">
            分析に使う Claude がログインを要求しています。ターミナルで
            <code className="mx-1 rounded bg-amber-50 px-1">npm run setup-login</code>
            を実行してください。
          </p>
        )}
        {state.status === 'error' && <p className="text-sm text-red-600">エラー: {state.error}</p>}
        {state.text ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800">
            {state.text}
          </pre>
        ) : (
          state.status !== 'need_login' &&
          state.status !== 'error' && (
            <p className="text-sm text-gray-400">
              {state.status === 'idle'
                ? '全サービスの回答が揃うと、自動で共通点・相違点を分析します。'
                : '分析中…'}
            </p>
          )
        )}
      </div>
    </div>
  );
}
