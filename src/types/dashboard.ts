/**
 * @module dashboard
 * @description Type definitions that model the dashboard UI state, including all view names, sort controls, per-user display settings, and export history records. These types are intentionally UI-layer-only — they carry no runtime logic and are imported by dashboard components and storage service methods that persist settings.
 * @dependencies none
 * @public SortColumn, SortDirection, DashboardView, DashboardSettings, ExportRecord
 */
export type SortColumn = 'text' | 'source' | 'folder' | 'tags' | 'savedAt';
export type SortDirection = 'asc' | 'desc';
export type DashboardView =
  | 'home'
  | 'prompts'
  | 'folders'
  | 'tags'
  | 'analytics'
  | 'export-history'
  | 'notebooks'
  | 'notebook-detail'
  | 'all-sources'
  | 'all-artifacts'
  | 'chat-history'
  | 'chat-history-detail'
  | 'podcasts'
  | 'podcast-detail'
  | 'all-audio'
  | 'pipelines'
  | 'settings'
  | 'screenshots'
  | 'screenshot-editor';

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
