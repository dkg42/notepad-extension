export interface Snippet {
  id: string;
  text: string;
  /** Full URL of the page where the snippet was saved */
  source: string;
  savedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
