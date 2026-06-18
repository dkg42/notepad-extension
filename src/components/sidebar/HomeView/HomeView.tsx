/**
 * @module HomeView
 * @description Home launcher grid of the sidebar showing all available tools (Prompt Hub, Snippets, etc.) with accent icons, plan badges, and coming-soon overlays. Displays a sign-in nudge for anonymous users.
 * @dependencies @/types
 * @public HomeView (default export)
 */
import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Clipboard,
  MessageSquare,
  Camera,
  Layers,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import type { StoredAuthProfile } from '@/types';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { FREE_CAPS, type CappedFeature } from '@/services/usage-limit-service';
import { DAILY_LIMITS, type DailyFeature } from '@/services/daily-limit-service';
import { recentActionsStorage, type RecentAction } from '@/services/storage/recent-actions-storage';
import { scopedStorage } from '@/services/storage/scoped-storage';
import { RECENT_ACTIONS_KEY } from '@/services/storage/shared';
import { openUpgradePage } from '@/utils/open-upgrade';
import './HomeView.css';

interface Feature {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
  plan: 'free' | 'pro';
  accent: string;
  comingSoon?: boolean;
  usageFeature?: CappedFeature;
  dailyFeature?: DailyFeature;
}

const ACCENT_MAP: Record<string, { bg: string; fg: string }> = {
  primary: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  sky:     { bg: 'var(--tag-5-bg)', fg: 'var(--tag-5-fg)' },
  green:   { bg: 'var(--tag-2-bg)', fg: 'var(--tag-2-fg)' },
  amber:   { bg: 'var(--accent-soft)', fg: 'var(--accent-fg)' },
  magenta: { bg: 'var(--tag-4-bg)', fg: 'var(--tag-4-fg)' },
  violet:  { bg: 'var(--tag-4-bg)', fg: 'var(--tag-4-fg)' },
};

const FEATURES: Feature[] = [
  {
    id: 'prompts',
    name: 'Prompt Hub',
    icon: Sparkles,
    desc: 'Save, tag and reuse your prompts',
    plan: 'free',
    accent: 'primary',
    usageFeature: 'prompt_hub',
  },
  {
    id: 'snippets',
    name: 'Clipboard',
    icon: Clipboard,
    desc: 'Clipboard manager — last 50 copies',
    plan: 'free',
    accent: 'green',
  },
  {
    id: 'history',
    name: 'Chat Hub',
    icon: MessageSquare,
    desc: 'Save and revisit conversations across AI tools',
    plan: 'free',
    accent: 'sky',
    usageFeature: 'chat_history',
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
    icon: Camera,
    desc: 'Capture, annotate, send to AI',
    plan: 'free',
    accent: 'amber',
  },
  {
    id: 'tabs',
    name: 'Tab Hub',
    icon: Layers,
    desc: 'Group, label, declutter open tabs',
    plan: 'free',
    accent: 'violet',
  },
  {
    id: 'notebook',
    name: 'Add to NotebookLM',
    icon: BookOpen,
    desc: 'Send current tab as a source',
    plan: 'free',
    accent: 'magenta',
    dailyFeature: 'notebook_add',
  },
];


const FEATURES_BY_ID: Record<string, Feature> = FEATURES.reduce(
  (acc, f) => { acc[f.id] = f; return acc; },
  {} as Record<string, Feature>,
);

function relTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}

function useRecentActions(enabled: boolean): RecentAction[] {
  const [items, setItems] = useState<RecentAction[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    recentActionsStorage.getRecentActions().then((list) => {
      if (!cancelled) setItems(list);
    });
    const unsubscribe = scopedStorage.onChanged<RecentAction[]>(
      RECENT_ACTIONS_KEY,
      (changes) => {
        const next = changes[RECENT_ACTIONS_KEY]?.newValue;
        if (next) setItems(next);
      },
    );
    return () => { cancelled = true; unsubscribe(); };
  }, [enabled]);

  return items;
}

function FeatureCard({ f, onNavigate }: { f: Feature; onNavigate: (v: string) => void }) {
  const { isActive } = useSubscription();
  // Hooks must be called unconditionally — pass safe fallbacks when the
  // tile uses neither kind of limit and ignore the result below.
  const { count } = useUsageLimit(f.usageFeature ?? 'prompt_hub');
  const { count: dailyCount } = useDailyLimit(f.dailyFeature ?? 'notebook_add');
  const a = ACCENT_MAP[f.accent] ?? ACCENT_MAP.primary;
  const isDisabled = f.comingSoon;

  let footerText: string;
  if (f.plan === 'pro') {
    footerText = 'Pro only';
  } else if (f.usageFeature && count !== null) {
    footerText = `${count}/${FREE_CAPS[f.usageFeature]}`;
  } else if (f.dailyFeature && dailyCount !== null) {
    footerText = `${dailyCount}/${DAILY_LIMITS[f.dailyFeature]} today`;
  } else {
    footerText = 'Free';
  }

  return (
    <button
      key={f.id}
      data-tour={f.id}
      className={`home-view__tile${isDisabled ? ' home-view__tile--disabled' : ''}`}
      onClick={() => {
        if (isDisabled) return;
        void recentActionsStorage.addRecentAction({
          featureId: f.id,
          kind: 'tile_open',
          label: `Opened ${f.name}`,
        });
        onNavigate(f.id);
      }}
      disabled={isDisabled}
    >
      <div className="home-view__tile-header">
        <div
          className="home-view__tile-icon"
          style={{ background: a.bg, color: a.fg }}
        >
          <f.icon size={15} strokeWidth={1.7} />
        </div>
        {!isActive && (f.plan === 'pro' ? (
          <span className="home-view__tile-badge home-view__tile-badge--pro">Pro</span>
        ) : (
          <span className="home-view__tile-badge home-view__tile-badge--free">Free</span>
        ))}
      </div>

      <div className="home-view__tile-body">
        <div className="home-view__tile-name">{f.name}</div>
        <div className="home-view__tile-desc">{f.desc}</div>
      </div>

      {!isActive && (
        <div className="home-view__tile-footer">
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9.5px',
            color: 'var(--fg-3)',
          }}>
            {footerText}
          </span>
        </div>
      )}

      {f.comingSoon && (
        <div className="home-view__coming-soon">
          <span className="home-view__coming-soon-badge">Coming soon</span>
        </div>
      )}
    </button>
  );
}

interface HomeViewProps {
  onNavigate: (view: string) => void;
  user: StoredAuthProfile | null;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  const { isActive } = useSubscription();
  const recent = useRecentActions(isActive).slice(0, 5);

  return (
    <div className="home-view">

      <div className="home-view__section-label">Tools</div>

      <div className="home-view__grid">
        {FEATURES.map((f) => (
          <FeatureCard key={f.id} f={f} onNavigate={onNavigate} />
        ))}
      </div>

      {isActive && (
        <div className="home-view__recent-section">
          <div className="home-view__section-label">Recent</div>
          {recent.length === 0 ? (
            <div className="home-view__recent-empty">
              Your recent activity will show up here.
            </div>
          ) : (
            <ul className="home-view__recent">
              {recent.map((a) => {
                const feature = FEATURES_BY_ID[a.featureId];
                const Icon = feature?.icon;
                const accent = ACCENT_MAP[feature?.accent ?? 'primary'] ?? ACCENT_MAP.primary;
                return (
                  <li key={a.id} className="home-view__recent-row">
                    <button
                      type="button"
                      className="home-view__recent-btn"
                      onClick={() => onNavigate(a.featureId)}
                    >
                      <span
                        className="home-view__recent-icon"
                        style={{ background: accent.bg, color: accent.fg }}
                      >
                        {Icon ? <Icon size={12} strokeWidth={1.8} /> : null}
                      </span>
                      <span className="home-view__recent-label">{a.label}</span>
                      <span className="home-view__recent-time">{relTime(a.timestamp)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!isActive && (
        <div className="home-view__upsell">
          <div className="home-view__upsell-header">
            <span className="home-view__tile-badge home-view__tile-badge--pro">Pro</span>
            <span className="home-view__upsell-title">Unlock everything</span>
          </div>
          <div className="home-view__upsell-desc">
            Unlimited prompts, screenshots, NotebookLM sources, and chat history search.
          </div>
          <button className="home-view__upsell-btn" onClick={openUpgradePage}>Upgrade to Pro</button>
        </div>
      )}
    </div>
  );
}
