export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Snippet {
  id: string;
  text: string;
  /** Full URL of the page where the snippet was saved */
  source: string;
  savedAt: number;
  folderId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Sentinel ID used to represent snippets with no folder assigned */
export const UNCATEGORIZED_ID = '__uncategorized__';