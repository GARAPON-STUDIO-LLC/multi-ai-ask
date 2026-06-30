import type { ServiceStatus } from '@/lib/adapters/types';

const LABEL: Record<ServiceStatus, string> = {
  idle: '待機中',
  connecting: '接続中…',
  need_login: '要ログイン',
  submitting: '送信中…',
  generating: '生成中…',
  done: '完了',
  error: 'エラー',
};

const STYLE: Record<ServiceStatus, string> = {
  idle: 'bg-gray-100 text-gray-500',
  connecting: 'bg-blue-100 text-blue-700',
  need_login: 'bg-amber-100 text-amber-800',
  submitting: 'bg-blue-100 text-blue-700',
  generating: 'bg-violet-100 text-violet-700 animate-pulse',
  done: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
