import { isFeatureEnabled } from '@/config/feature-flags';

export type AIAvailability = 'readily' | 'after-download' | 'unavailable' | 'unsupported';

export const aiService = {
  async checkAvailability(): Promise<AIAvailability> {
    if (typeof LanguageModel === 'undefined') return 'unsupported';
    try {
      const status = await LanguageModel.availability();
      // Chrome 148 returns 'available'; spec says 'readily' — normalize both
      if (status === 'readily' || status === 'available') return 'readily';
      if (status === 'no') return 'unavailable';
      return status; // 'after-download'
    } catch {
      return 'unavailable';
    }
  },

  async enhancePrompt(text: string): Promise<string> {
    if (!isFeatureEnabled('geminiNano')) throw new Error('AI_DISABLED');
    const avail = await this.checkAvailability();
    if (avail !== 'readily') throw new Error(`AI_${avail.toUpperCase()}`);
    try {
      const session = await LanguageModel!.create({
        initialPrompts: [
          {
            role: 'system',
            content:
              'You are a prompt engineering expert. Rewrite the provided prompt to be clearer, more specific, and effective for AI models while preserving the original intent. Return only the improved prompt text.',
          },
        ],
        temperature: 0.7,
        topK: 40,
      });
      try {
        return await session.prompt(text);
      } finally {
        session.destroy();
      }
    } catch (err) {
      console.error('[aiService] enhancePrompt failed:', err);
      throw err;
    }
  },

  async summarizeTabs(tabs: Array<{ title: string; url: string }>): Promise<string> {
    if (!isFeatureEnabled('geminiNano')) throw new Error('AI_DISABLED');
    const tabList = tabs.map((t, i) => `${i + 1}. ${t.title} — ${t.url}`).join('\n');

    const avail = await this.checkAvailability();
    if (avail !== 'readily') throw new Error(`AI_${avail.toUpperCase()}`);
    try {
      const session = await LanguageModel!.create({
        initialPrompts: [
          {
            role: 'system',
            content:
              'You are writing a personal reminder note for the user. Based on their open browser tabs, write 2-3 sentences in first person (as if the user is writing to themselves) describing what they were working on and where they left off. Help them pick up where they stopped. Start directly with "I was..." or "I\'m working on...". Do not mention tab counts or URLs.',
          },
        ],
      });
      try {
        return await session.prompt(`My open tabs:\n${tabList}`);
      } finally {
        session.destroy();
      }
    } catch (err) {
      console.error('[aiService] summarizeTabs failed:', err);
      throw err;
    }
  },
};
