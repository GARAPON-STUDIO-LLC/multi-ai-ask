import { makeChatAdapter } from './base';
import { SELECTORS } from './selectors';

export const claudeAdapter = makeChatAdapter({
  id: 'claude',
  name: 'Claude',
  url: 'https://claude.ai/new',
  enabled: true,
  selectors: SELECTORS.claude,
  submitWithEnter: true,
});
