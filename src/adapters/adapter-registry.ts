import type { ChatSiteAdapter } from './adapter.interface';
import { ChatGPTAdapter } from './chatgpt.adapter';
import { ClaudeAdapter } from './claude.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { PerplexityAdapter } from './perplexity.adapter';
import { CopilotAdapter } from './copilot.adapter';

// Register all adapters here. Adding a new site = add one line.
const adapters: ChatSiteAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new PerplexityAdapter(),
  new CopilotAdapter(),
];

export function getAdapter(hostname: string): ChatSiteAdapter | null {
  return adapters.find((a) => a.hostnames.some((h) => hostname.includes(h))) ?? null;
}
