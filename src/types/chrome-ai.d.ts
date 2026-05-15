// Chrome 148+ Built-in AI API — top-level globals (window.ai removed)

// Chrome 148 still returns 'available'; spec says 'readily' — both accepted
type AIAvailabilityStatus = 'readily' | 'available' | 'after-download' | 'no';

interface LanguageModelInitialPrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LanguageModelCreateOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  initialPrompts?: LanguageModelInitialPrompt[];
}

interface LanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  promptStreaming(input: string, options?: { signal?: AbortSignal }): AsyncIterable<string>;
  clone(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  destroy(): void;
  readonly contextUsage: number;
  readonly contextWindow: number;
  readonly temperature?: number;
  readonly topK?: number;
}

interface LanguageModelFactory {
  availability(options?: { expectedInputs?: Array<{ type: string }> }): Promise<AIAvailabilityStatus>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

type SummaryType = 'tldr' | 'teaser' | 'key-points' | 'headline';
type SummaryFormat = 'plain-text' | 'markdown';
type SummaryLength = 'short' | 'medium' | 'long';

interface SummarizerCreateOptions {
  type?: SummaryType;
  format?: SummaryFormat;
  length?: SummaryLength;
  sharedContext?: string;
  signal?: AbortSignal;
}

interface SummarizerInstance {
  summarize(input: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
  summarizeStreaming(input: string, options?: { context?: string; signal?: AbortSignal }): AsyncIterable<string>;
  destroy(): void;
}

interface SummarizerFactory {
  availability(options?: SummarizerCreateOptions): Promise<AIAvailabilityStatus>;
  create(options?: SummarizerCreateOptions): Promise<SummarizerInstance>;
}

declare global {
  const LanguageModel: LanguageModelFactory | undefined;
  const Summarizer: SummarizerFactory | undefined;
}

export {};
