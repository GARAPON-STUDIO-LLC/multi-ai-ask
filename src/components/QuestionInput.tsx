'use client';

import { useState } from 'react';

interface Props {
  busy: boolean;
  onSubmit: (prompt: string) => void;
}

export function QuestionInput({ busy, onSubmit }: Props) {
  const [value, setValue] = useState('');

  const submit = () => {
    const v = value.trim();
    if (!v || busy) return;
    onSubmit(v);
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Cmd/Ctrl + Enter で送信
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder="質問を入力（⌘/Ctrl + Enter で送信）"
        className="w-full resize-y rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
      />
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '問い合わせ中…' : '4つのAIに聞く'}
        </button>
      </div>
    </div>
  );
}
