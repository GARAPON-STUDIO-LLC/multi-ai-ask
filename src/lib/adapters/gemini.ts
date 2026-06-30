import { makeChatAdapter } from './base';
import { SELECTORS } from './selectors';

export const geminiAdapter = makeChatAdapter({
  id: 'gemini',
  name: 'Gemini',
  url: 'https://gemini.google.com/app',
  enabled: true,
  selectors: SELECTORS.gemini,
  // Gemini は Enter で送信できるが、送信ボタンの方が安定するケースがある。
  // 既定は Enter。問題があれば false にして送信ボタンを使う。
  submitWithEnter: true,
});
