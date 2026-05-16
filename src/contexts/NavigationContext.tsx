/**
 * @module NavigationContext
 * @description React context providing navigation state, sidebar counts, audio playback, settings, and drive conflict state.
 *   Consumed by Sidebar, DashboardApp routing, AudioPlayer, SettingsPage, and detail pages.
 * @dependencies @/types, @/types/dashboard
 * @public NavigationProvider, useNavigation
 */
import React, { createContext, useContext } from 'react';
import type { ChatPlatform, EpisodeTrack, NotebookMeta } from '@/types';
import type { ConversationMeta } from '@/types/chat-history';
import type { DashboardSettings, DashboardView } from '@/types/dashboard';
import type { ConflictSummary } from '@/services/drive/drive-init-service';

interface PodcastContext {
  tracks: EpisodeTrack[];
  currentIndex: number;
}

export interface NavigationContextValue {
  // Routing
  currentView: DashboardView;
  setCurrentView: (view: DashboardView) => void;
  isLoading: boolean;

  // Settings
  settings: DashboardSettings;
  handleSettingsChange: (partial: Partial<DashboardSettings>) => Promise<void>;

  // UI overlays
  showShortcuts: boolean;
  setShowShortcuts: (show: boolean) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;

  // Sidebar counts
  notebooksCount: number;
  chatHistoryCount: number;
  podcastsCount: number;
  pipelinesCount: number;

  // Timestamped capture sources (for activity aggregation)
  conversations: ConversationMeta[];
  notebooks: NotebookMeta[];

  // Notebook navigation
  selectedNotebookId: string | null;
  handleOpenNotebookDetail: (notebookId: string) => void;
  handleBackToNotebooks: () => void;

  // Podcast navigation
  selectedEpisodeId: string | null;
  handleOpenPodcastDetail: (episodeId: string) => void;
  handleBackToPodcasts: () => void;

  // Chat history navigation
  selectedChatId: string | null;
  selectedChatPlatform: ChatPlatform | null;
  handleOpenChatDetail: (platform: ChatPlatform, id: string) => void;
  handleBackToChatHistory: () => void;

  // Screenshot editor navigation
  selectedCaptureId: string | null;
  handleOpenScreenshotEditor: (captureId: string) => void;
  handleBackToScreenshots: () => void;

  // Drive conflict
  driveConflict: ConflictSummary | null;
  handleConflictResolution: (decision: 'merge' | 'overwrite') => Promise<void>;

  // Global audio
  audioUrl: string | null;
  audioTitle: string | undefined;
  isLoadingAudio: boolean;
  podcastContext: PodcastContext | null;
  playArtifact: (mediaUrl: string, artifactId: string, title: string) => Promise<void>;
  playTrack: (track: EpisodeTrack, playlist: EpisodeTrack[], idx: number) => Promise<void>;
  playNext: () => Promise<void>;
  stopAudio: () => void;
}

interface NavigationProviderProps {
  /** Pre-memoised value object from the parent (e.g. DashboardApp). */
  value: NavigationContextValue;
  children: React.ReactNode;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

/**
 * Provides navigation, audio, settings, and drive conflict state to the subtree.
 * Callers are responsible for memoising `value` (useMemo) to avoid
 * unnecessary consumer re-renders.
 */
export function NavigationProvider({ value, children }: NavigationProviderProps) {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
}
