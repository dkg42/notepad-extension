/**
 * @module adapter-registry
 * @description Single registration point that maps LLM site hostnames to their concrete adapter instances. Consumers call getAdapter(hostname) to retrieve the correct adapter without knowing which sites are supported; adding a new site only requires registering it here (Open/Closed principle).
 * @dependencies adapter.interface, chatgpt.adapter, claude.adapter, gemini.adapter, perplexity.adapter, copilot.adapter, notebooklm.adapter
 * @public getAdapter
 */
import type { ChatSiteAdapter } from './adapter.interface';
import { ChatGPTAdapter } from './chatgpt.adapter';
import { ClaudeAdapter } from './claude.adapter';
import { GeminiAdapter } from './gemini.adapter';
import { PerplexityAdapter } from './perplexity.adapter';
import { CopilotAdapter } from './copilot.adapter';
import { NotebookLMAdapter } from './notebooklm.adapter';

// Register all adapters here. Adding a new site = add one line.
const adapters: ChatSiteAdapter[] = [
  new ChatGPTAdapter(),
  new ClaudeAdapter(),
  new GeminiAdapter(),
  new PerplexityAdapter(),
  new CopilotAdapter(),
  new NotebookLMAdapter(),
];

export function getAdapter(hostname: string): ChatSiteAdapter | null {
  return adapters.find((a) => a.hostnames.some((h) => hostname.includes(h))) ?? null;
}
