import { makeChatAdapter } from './base';
import { SELECTORS } from './selectors';

export const chatgptAdapter = makeChatAdapter({
  id: 'chatgpt',
  name: 'ChatGPT',
  url: 'https://chatgpt.com/',
  enabled: true,
  selectors: SELECTORS.chatgpt,
  submitWithEnter: true,
});
