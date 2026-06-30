import { AskClient } from '@/components/AskClient';
import { enabledServices } from '@/lib/orchestrator';

export default function Home() {
  const services = enabledServices().map((s) => ({ id: s.id, name: s.name }));

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Multi-AI 一括問い合わせ</h1>
        <p className="mt-1 text-sm text-gray-500">
          1つの質問を {services.map((s) => s.name).join(' / ')} に同時に投げて回答を比較します。
          各サービスのログイン済みブラウザを自動操作しています。
        </p>
      </header>
      <AskClient services={services} />
    </main>
  );
}
