/**
 * @module Tour
 * @description Reusable first-run guided tour engine. Renders a full-viewport
 *   dim with a spotlight cut-out around the current step's target element and an
 *   anchored tooltip bubble with Back / Next / Skip controls. Shared by the side
 *   panel and the dashboard; relies on design tokens so it themes automatically
 *   in light/dark. Must be rendered *inside* the app's themed root container
 *   (e.g. `.app-shell` / `.dashboard-app`) so token cascade applies.
 * @dependencies framer-motion, @/utils/dom (waitForElement), ./tour-types
 * @public Tour (default export)
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import { waitForElement } from '@/utils/dom';
import type { TourPlacement, TourProps } from './tour-types';
import './Tour.css';

const SPOT_PADDING = 6;
const BUBBLE_GAP = 12;
const VIEWPORT_MARGIN = 8;
const RESOLVE_TIMEOUT = 1500;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface BubblePos {
  top: number;
  left: number;
  place: Exclude<TourPlacement, 'auto'>;
}

function rectOf(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Picks the first placement that fits the bubble in the viewport, else clamps. */
function computeBubblePos(
  rect: Rect,
  bw: number,
  bh: number,
  preferred: TourPlacement = 'auto',
): BubblePos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const padded = {
    top: rect.top - SPOT_PADDING,
    left: rect.left - SPOT_PADDING,
    right: rect.left + rect.width + SPOT_PADDING,
    bottom: rect.top + rect.height + SPOT_PADDING,
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
  };

  const order: Array<Exclude<TourPlacement, 'auto'>> =
    preferred === 'auto'
      ? ['bottom', 'top', 'right', 'left']
      : [preferred as Exclude<TourPlacement, 'auto'>, 'bottom', 'top', 'right', 'left'];

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(v, max));

  for (const place of order) {
    let top = 0;
    let left = 0;
    let fits = false;

    if (place === 'bottom') {
      top = padded.bottom + BUBBLE_GAP;
      left = padded.cx - bw / 2;
      fits = top + bh <= vh - VIEWPORT_MARGIN;
    } else if (place === 'top') {
      top = padded.top - BUBBLE_GAP - bh;
      left = padded.cx - bw / 2;
      fits = top >= VIEWPORT_MARGIN;
    } else if (place === 'right') {
      left = padded.right + BUBBLE_GAP;
      top = padded.cy - bh / 2;
      fits = left + bw <= vw - VIEWPORT_MARGIN;
    } else {
      left = padded.left - BUBBLE_GAP - bw;
      top = padded.cy - bh / 2;
      fits = left >= VIEWPORT_MARGIN;
    }

    if (fits) {
      return {
        place,
        top: clamp(top, VIEWPORT_MARGIN, vh - bh - VIEWPORT_MARGIN),
        left: clamp(left, VIEWPORT_MARGIN, vw - bw - VIEWPORT_MARGIN),
      };
    }
  }

  // Nothing fit cleanly — fall back to bottom, clamped into view.
  return {
    place: 'bottom',
    top: clamp(padded.bottom + BUBBLE_GAP, VIEWPORT_MARGIN, vh - bh - VIEWPORT_MARGIN),
    left: clamp(padded.cx - bw / 2, VIEWPORT_MARGIN, vw - bw - VIEWPORT_MARGIN),
  };
}

export default function Tour({ steps, onComplete, onSkip }: TourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [bubblePos, setBubblePos] = useState<BubblePos | null>(null);

  const elRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const stepsLenRef = useRef(steps.length);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);

  indexRef.current = stepIndex;
  stepsLenRef.current = steps.length;
  onCompleteRef.current = onComplete;
  onSkipRef.current = onSkip;

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  // Stable navigation handlers (read latest index from a ref).
  const advance = useCallback(() => {
    const i = indexRef.current;
    if (i >= stepsLenRef.current - 1) onCompleteRef.current();
    else setStepIndex(i + 1);
  }, []);
  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);
  const skip = useCallback(() => onSkipRef.current(), []);

  // Resolve and measure the current target whenever the step changes.
  useEffect(() => {
    let cancelled = false;
    setRect(null);
    setBubblePos(null);
    elRef.current = null;

    const current = steps[stepIndex];
    if (!current) return;

    (async () => {
      let el = document.querySelector(current.target) as HTMLElement | null;
      if (!el) {
        el = (await waitForElement(current.target, RESOLVE_TIMEOUT)) as HTMLElement | null;
      }
      if (cancelled) return;
      if (!el) {
        advance(); // Target absent — skip gracefully to the next step.
        return;
      }
      el.scrollIntoView({ block: 'center', inline: 'center' });
      elRef.current = el;
      requestAnimationFrame(() => {
        if (!cancelled && elRef.current) setRect(rectOf(elRef.current));
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [stepIndex, steps, advance]);

  // Keep the spotlight aligned on scroll / resize.
  useEffect(() => {
    const reMeasure = () => {
      if (elRef.current) setRect(rectOf(elRef.current));
    };
    window.addEventListener('resize', reMeasure);
    window.addEventListener('scroll', reMeasure, true);
    return () => {
      window.removeEventListener('resize', reMeasure);
      window.removeEventListener('scroll', reMeasure, true);
    };
  }, []);

  // Position the bubble once we have a target rect and a measured bubble.
  useLayoutEffect(() => {
    if (!rect || !bubbleRef.current) return;
    const bw = bubbleRef.current.offsetWidth;
    const bh = bubbleRef.current.offsetHeight;
    setBubblePos(computeBubblePos(rect, bw, bh, step?.placement));
  }, [rect, step?.placement]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [advance, back, skip]);

  if (!step) return null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Feature tour">
      {/* Click catcher: blocks interaction with the underlying UI. */}
      <div className="tour__catcher" onClick={(e) => e.stopPropagation()} />

      {/* Spotlight cut-out (visual dim via large box-shadow). */}
      {rect && (
        <div
          className="tour__spotlight"
          style={{
            top: rect.top - SPOT_PADDING,
            left: rect.left - SPOT_PADDING,
            width: rect.width + SPOT_PADDING * 2,
            height: rect.height + SPOT_PADDING * 2,
          }}
        />
      )}

      {/* Tooltip bubble. */}
      <motion.div
        ref={bubbleRef}
        className={`tour__bubble${bubblePos ? ` tour__bubble--${bubblePos.place}` : ''}`}
        style={{
          top: bubblePos?.top ?? 0,
          left: bubblePos?.left ?? 0,
          visibility: bubblePos ? 'visible' : 'hidden',
        }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: bubblePos ? 1 : 0, scale: bubblePos ? 1 : 0.96 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        key={stepIndex}
      >
        <div className="tour__title">{step.title}</div>
        <div className="tour__body">{step.body}</div>

        <div className="tour__footer">
          <div className="tour__dots" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`tour__dot${i === stepIndex ? ' tour__dot--active' : ''}`}
              />
            ))}
          </div>

          <div className="tour__actions">
            <button type="button" className="tour__btn tour__btn--ghost" onClick={skip}>
              Skip
            </button>
            {stepIndex > 0 && (
              <button type="button" className="tour__btn" onClick={back}>
                Back
              </button>
            )}
            <button type="button" className="tour__btn tour__btn--primary" onClick={advance}>
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
