/**
 * @module dashboard/tour-steps
 * @description Step definitions for the dashboard's first-run guided tour. Each
 *   step targets an always-present element in the left navigation Sidebar
 *   (matched by its `data-tour` attribute). Tooltips prefer the right side since
 *   the sidebar sits against the left edge.
 * @dependencies @/components/shared/Tour/tour-types
 * @public dashboardTourSteps
 */
import type { TourStep } from '@/components/shared/Tour/tour-types';

export const dashboardTourSteps: TourStep[] = [
  {
    target: '[data-tour="search"]',
    title: 'Search everything',
    body: 'Press ⌘K anywhere to jump to any prompt, notebook, chat or pipeline instantly.',
    placement: 'right',
  },
  {
    target: '[data-tour="home"]',
    title: 'Home',
    body: 'Your dashboard overview — recent activity, usage stats and quick actions.',
    placement: 'right',
  },
  {
    target: '[data-tour="notebooks"]',
    title: 'Notebooks',
    body: 'Browse your NotebookLM notebooks, sources and generated artifacts in one place.',
    placement: 'right',
  },
  {
    target: '[data-tour="prompts"]',
    title: 'Prompt Hub',
    body: 'Manage every saved prompt — search, tag, organise into folders and bulk-edit.',
    placement: 'right',
  },
  {
    target: '[data-tour="chat-history"]',
    title: 'Chat Hub',
    body: 'Revisit conversations you saved across ChatGPT, Claude, Gemini and more.',
    placement: 'right',
  },
  {
    target: '[data-tour="screenshots"]',
    title: 'Screenshots',
    body: 'Review, annotate and export every screenshot you have captured.',
    placement: 'right',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Settings',
    body: 'Tune preferences, manage your account — and replay this tour any time.',
    placement: 'right',
  },
];
