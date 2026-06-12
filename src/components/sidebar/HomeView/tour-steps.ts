/**
 * @module sidebar/tour-steps
 * @description Step definitions for the side panel's first-run guided tour. Each
 *   step targets a Home-view feature tile (matched by its `data-tour` attribute,
 *   which mirrors the feature id in HomeView's FEATURES array).
 * @dependencies @/components/shared/Tour/tour-types
 * @public sidebarTourSteps
 */
import type { TourStep } from '@/components/shared/Tour/tour-types';

export const sidebarTourSteps: TourStep[] = [
  {
    target: '[data-tour="prompts"]',
    title: 'Prompt Hub',
    body: 'Save, tag and reuse your best prompts — organised into folders and one click away.',
  },
  {
    target: '[data-tour="snippets"]',
    title: 'Clipboard',
    body: 'A running history of your last 50 copies, so nothing you grabbed slips away.',
  },
  {
    target: '[data-tour="history"]',
    title: 'Chat Hub',
    body: 'Save and revisit conversations across ChatGPT, Claude, Gemini and more.',
  },
  {
    target: '[data-tour="screenshot"]',
    title: 'Screenshot',
    body: 'Capture any page, annotate it, and send it straight to your AI tools.',
  },
  {
    target: '[data-tour="tabs"]',
    title: 'Tab Hub',
    body: 'Group, label and declutter your open tabs to keep your workspace tidy.',
  },
  {
    target: '[data-tour="notebook"]',
    title: 'Add to NotebookLM',
    body: 'Send the current tab to your NotebookLM notebooks as a research source.',
  },
];
