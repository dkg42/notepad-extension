/**
 * @module usePodcastsPage
 * @description Hook for the Podcasts dashboard page that loads saved episodes from storage and exposes handlers to create new episodes (navigating directly to the detail page) and delete existing ones.
 * @dependencies @/types, @/services/storage-service
 * @public usePodcastsPage
 */
import { useCallback, useEffect, useState } from 'react';
import type { PodcastEpisode } from '@/types';
import { storageService } from '@/services/storage-service';

export function usePodcastsPage(onOpenEpisode: (id: string) => void) {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEpisodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await storageService.getPodcastEpisodes();
      setEpisodes(loaded);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEpisodes();
  }, [loadEpisodes]);

  const handleCreateEpisode = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const now = Date.now();
    const episode: PodcastEpisode = {
      id: crypto.randomUUID(),
      title: trimmed,
      tracks: [],
      createdAt: now,
      updatedAt: now,
    };
    await storageService.savePodcastEpisode(episode);
    setEpisodes((prev) => [episode, ...prev]);
    onOpenEpisode(episode.id);
  }, [onOpenEpisode]);

  const handleDeleteEpisode = useCallback(async (id: string) => {
    await storageService.deletePodcastEpisode(id);
    setEpisodes((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    episodes,
    isLoading,
    handleCreateEpisode,
    handleDeleteEpisode,
  };
}
