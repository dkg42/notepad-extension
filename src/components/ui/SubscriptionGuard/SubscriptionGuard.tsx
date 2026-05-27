/**
 * @module SubscriptionGuard
 * @description Wraps content that requires an active subscription plan. Shows a locked overlay
 *   with an upgrade CTA when the user's plan does not meet the required level.
 *   During the initial claims load, renders children optimistically to avoid a flash of locked UI.
 * @dependencies SubscriptionContext, @/types
 * @public SubscriptionGuard (default export)
 */
import React from 'react';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import type { SubscriptionContextValue } from '@/contexts/SubscriptionContext';
import type { SubscriptionPlan } from '@/types';
import { openDashboard } from '@/utils/open-dashboard';
import './SubscriptionGuard.css';

interface SubscriptionGuardProps {
  /**
   * Which plans grant access.
   *   'any'      — any active subscription (blocks free/unauthenticated users)
   *   string[]   — specific plans, e.g. ['pro_monthly', 'pro_yearly']
   *   undefined  — no restriction (guard is a no-op)
   */
  requiredPlan?: 'any' | SubscriptionPlan[];
  /** Text for the upgrade CTA button. Defaults to 'Upgrade to unlock'. */
  ctaText?: string;
  /** When true, children are rendered but visually dimmed behind the overlay. */
  showBlurred?: boolean;
  children: React.ReactNode;
}

function hasAccess(
  ctx: SubscriptionContextValue,
  requiredPlan?: 'any' | SubscriptionPlan[],
): boolean {
  if (!requiredPlan) return true;
  if (!ctx.isActive) return false;
  if (requiredPlan === 'any') return true;
  return (requiredPlan as SubscriptionPlan[]).includes(
    ctx.claims?.subscriptionPlan as SubscriptionPlan,
  );
}

function getPlanLabel(requiredPlan?: 'any' | SubscriptionPlan[]): string {
  if (!requiredPlan || requiredPlan === 'any') return 'Pro';
  const plans = requiredPlan as SubscriptionPlan[];
  if (plans.includes('pro_monthly') || plans.includes('pro_yearly')) return 'Pro';
  return 'a paid plan';
}

export default function SubscriptionGuard({
  requiredPlan,
  ctaText,
  showBlurred = false,
  children,
}: SubscriptionGuardProps) {
  const ctx = useSubscription();

  // Render children while claims are still loading to avoid UI flash.
  if (ctx.isLoading || hasAccess(ctx, requiredPlan)) {
    return <>{children}</>;
  }

  const label = getPlanLabel(requiredPlan);
  const cta = ctaText ?? `Upgrade to ${label} to unlock`;

  return (
    <div className="sub-guard__wrapper">
      {showBlurred && <div className="sub-guard__blurred" aria-hidden>{children}</div>}
      <div className="sub-guard__overlay" role="status" aria-label="Feature locked">
        <div className="sub-guard__content">
          <div className="sub-guard__icon">
            <Lock size={20} />
          </div>
          <p className="sub-guard__message">This feature requires a {label} subscription.</p>
          <button
            className="sub-guard__cta"
            onClick={() => { void openDashboard(); }}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}
