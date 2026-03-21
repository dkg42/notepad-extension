export type SortColumn = 'text' | 'source' | 'folder' | 'tags' | 'savedAt';
export type SortDirection = 'asc' | 'desc';
export type DashboardView =
  | 'home'
  | 'prompts'
  | 'favorites'
  | 'folders'
  | 'tags'
  | 'analytics'
  | 'export-history'
  | 'settings';

export interface DashboardSettings {
  theme: 'light' | 'dark';
  rowsPerPage: number;
  defaultSortColumn: SortColumn;
  defaultSortDirection: SortDirection;
}

export interface ExportRecord {
  id: string;
  exportedAt: number;
  format: string;
  itemCount: number;
  source: string;
  filename?: string;
}
