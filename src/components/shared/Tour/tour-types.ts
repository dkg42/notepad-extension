/**
 * @module tour-types
 * @description Shared type definitions for the first-run guided tour (spotlight
 *   coachmarks) used by both the side panel and the dashboard.
 * @dependencies none
 * @public TourStep, TourProps
 */

export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  /** CSS selector that resolves the element to highlight, e.g. '[data-tour="prompts"]'. */
  target: string;
  /** Short heading shown in the tooltip bubble. */
  title: string;
  /** One- or two-line explanation of the feature. */
  body: string;
  /** Preferred bubble placement relative to the target. Defaults to 'auto'. */
  placement?: TourPlacement;
}

export interface TourProps {
  /** Ordered steps to walk through. */
  steps: TourStep[];
  /** Called once the user finishes the final step. */
  onComplete: () => void;
  /** Called when the user skips (Skip button or Esc). */
  onSkip: () => void;
}
