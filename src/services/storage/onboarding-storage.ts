/**
 * @module onboarding-storage
 * @description Local-only, per-user storage tracking whether the first-run guided
 *   tour has been seen for each surface (side panel and dashboard). Device-local
 *   on purpose — a tour-seen flag should not ride the Drive settings sync, so the
 *   tour can re-introduce features on a fresh device. Mirrors the style of
 *   recent-actions-storage.
 * @dependencies storage/shared, storage/scoped-storage
 * @public onboardingStorage, TourId, OnboardingState
 */
import { ONBOARDING_KEY } from './shared';
import { scopedStorage } from './scoped-storage';

export type TourId = 'sidebar' | 'dashboard';

export interface OnboardingState {
  sidebarSeen?: boolean;
  dashboardSeen?: boolean;
}

const SEEN_FLAG: Record<TourId, keyof OnboardingState> = {
  sidebar: 'sidebarSeen',
  dashboard: 'dashboardSeen',
};

export const onboardingStorage = {
  async getState(): Promise<OnboardingState> {
    const result = await scopedStorage.get<OnboardingState>(ONBOARDING_KEY);
    return result[ONBOARDING_KEY] ?? {};
  },

  async markSeen(tour: TourId): Promise<void> {
    const current = await onboardingStorage.getState();
    await scopedStorage.set({
      [ONBOARDING_KEY]: { ...current, [SEEN_FLAG[tour]]: true },
    });
  },

  async reset(tour: TourId): Promise<void> {
    const current = await onboardingStorage.getState();
    await scopedStorage.set({
      [ONBOARDING_KEY]: { ...current, [SEEN_FLAG[tour]]: false },
    });
  },
};
