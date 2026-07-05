import { NextRequest } from 'next/server';
import { z } from 'zod';
import { analyzeAnswers } from '@/lib/analyzer';

// Playwright を使うため Node ランタイム必須。長時間ストリームのため動的扱い。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BodySchema = z.object({
  prompt: z.string().trim().min(1, '質問がありません').max(8000),
  answers: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        text: z.string().trim().min(1),
      }),
    )
    .min(2, '分析には2件以上の回答が必要です'),
});

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : 'リクエストが不正です';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const event of analyzeAnswers(parsed.prompt, parsed.answers)) {
          send(event);
        }
        send({ type: 'end' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send({ type: 'fatal', error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
