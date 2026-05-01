/**
 * @module podcast-storage
 * @description Domain storage module for podcast episode persistence: upsert, delete, and track-list replacement. All writes fire a best-effort Drive sync tail-call.
 * @dependencies storage/shared, @/types, drive/drive-sync-service
 * @public podcastStorage
 */
import type { PodcastEpisode, EpisodeTrack } from '@/types';
import { PODCAST_EPISODES_KEY, syncToDrive, driveSyncService } from './shared';

export const podcastStorage = {
  // ── Podcast Episodes ────────────────────────────────────────────────────────

  /**
   * Returns all stored podcast episodes.
   * @returns Array of PodcastEpisode objects; empty array if none saved.
   */
  async getPodcastEpisodes(): Promise<PodcastEpisode[]> {
    const result = await chrome.storage.local.get(PODCAST_EPISODES_KEY);
    return (result[PODCAST_EPISODES_KEY] as PodcastEpisode[]) ?? [];
  },

  /**
   * Upserts a podcast episode (replaces by id if it exists, appends if new) and syncs the full list to Drive.
   * @param episode The PodcastEpisode to save or update; matched by `episode.id`.
   * @sideEffect Drive sync
   */
  async savePodcastEpisode(episode: PodcastEpisode): Promise<void> {
    const episodes = await podcastStorage.getPodcastEpisodes();
    const idx = episodes.findIndex((e) => e.id === episode.id);
    if (idx >= 0) {
      episodes[idx] = episode;
    } else {
      episodes.push(episode);
    }
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: episodes });
    syncToDrive((t) => driveSyncService.savePodcastEpisodes(episodes, t));
  },

  /**
   * Removes a podcast episode by id and syncs the remaining list to Drive.
   * @param id UUID of the episode to delete.
   * @sideEffect Drive sync
   */
  async deletePodcastEpisode(id: string): Promise<void> {
    const episodes = await podcastStorage.getPodcastEpisodes();
    const filtered = episodes.filter((e) => e.id !== id);
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: filtered });
    syncToDrive((t) => driveSyncService.savePodcastEpisodes(filtered, t));
  },

  /**
   * Replaces the track list on an episode and bumps its `updatedAt` timestamp, then syncs to Drive. No-ops if the episode id is not found.
   * @param id UUID of the episode to update.
   * @param tracks New complete array of EpisodeTracks (replaces existing tracks).
   * @sideEffect Drive sync
   */
  async updateEpisodeTracks(id: string, tracks: EpisodeTrack[]): Promise<void> {
    const episodes = await podcastStorage.getPodcastEpisodes();
    const idx = episodes.findIndex((e) => e.id === id);
    if (idx < 0) return;
    episodes[idx] = { ...episodes[idx], tracks, updatedAt: Date.now() };
    await chrome.storage.local.set({ [PODCAST_EPISODES_KEY]: episodes });
    syncToDrive((t) => driveSyncService.savePodcastEpisodes(episodes, t));
  },
};
