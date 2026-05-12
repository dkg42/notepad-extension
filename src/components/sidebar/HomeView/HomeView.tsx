/**
 * @module HomeView
 * @description Home launcher grid of the sidebar showing all available tools (Prompt Hub, Snippets, etc.) with accent icons, plan badges, and coming-soon overlays. Displays a sign-in nudge for anonymous users.
 * @dependencies @/types
 * @public HomeView (default export)
 */
import React from 'react';
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
import { useUsageLimit } from '@/hooks/useUsageLimit';
import type { UsageFeature } from '@/services/usage-limit-service';
import './HomeView.css';

interface Feature {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
  plan: 'free' | 'pro';
  accent: string;
  comingSoon?: boolean;
  dailyLimit?: number;
  usageFeature?: UsageFeature;
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
    dailyLimit: 5,
    usageFeature: 'prompt_hub',
  },
  {
    id: 'snippets',
    name: 'Snippets',
    icon: Clipboard,
    desc: 'Clipboard manager — last 50 copies',
    plan: 'free',
    accent: 'green',
  },
  {
    id: 'history',
    name: 'Chat History',
    icon: MessageSquare,
    desc: 'Save and revisit conversations across AI tools',
    plan: 'free',
    accent: 'sky',
    dailyLimit: 2,
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
    name: 'Tab Manager',
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
    dailyLimit: 3,
    usageFeature: 'notebooklm_add',
  },
];


function FeatureCard({ f, onNavigate }: { f: Feature; onNavigate: (v: string) => void }) {
  // Always call the hook — safe because it's called unconditionally.
  // For features without a usageFeature, we pass 'prompt_hub' as a dummy but ignore the result.
  const { count } = useUsageLimit(f.usageFeature ?? 'prompt_hub');
  const a = ACCENT_MAP[f.accent] ?? ACCENT_MAP.primary;
  const isDisabled = f.comingSoon;

  let footerText: string;
  if (f.plan === 'pro') {
    footerText = 'Pro only';
  } else if (f.usageFeature && f.dailyLimit) {
    // count is null for pro users (unlimited); otherwise show live "X/Y today"
    footerText = count !== null ? `${count}/${f.dailyLimit} today` : 'Unlimited';
  } else {
    footerText = 'Unlimited';
  }

  return (
    <button
      key={f.id}
      className={`home-view__tile${isDisabled ? ' home-view__tile--disabled' : ''}`}
      onClick={() => !isDisabled && onNavigate(f.id)}
      disabled={isDisabled}
    >
      <div className="home-view__tile-header">
        <div
          className="home-view__tile-icon"
          style={{ background: a.bg, color: a.fg }}
        >
          <f.icon size={15} strokeWidth={1.7} />
        </div>
        {f.plan === 'pro' ? (
          <span className="home-view__tile-badge home-view__tile-badge--pro">Pro</span>
        ) : (
          <span className="home-view__tile-badge home-view__tile-badge--free">Free</span>
        )}
      </div>

      <div className="home-view__tile-body">
        <div className="home-view__tile-name">{f.name}</div>
        <div className="home-view__tile-desc">{f.desc}</div>
      </div>

      <div className="home-view__tile-footer">
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9.5px',
          color: 'var(--fg-3)',
        }}>
          {footerText}
        </span>
      </div>

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
  return (
    <div className="home-view">

      <div className="home-view__section-label">Tools</div>

      <div className="home-view__grid">
        {FEATURES.map((f) => (
          <FeatureCard key={f.id} f={f} onNavigate={onNavigate} />
        ))}
      </div>

      <div className="home-view__upsell">
        <div className="home-view__upsell-header">
          <span className="home-view__tile-badge home-view__tile-badge--pro">Pro</span>
          <span className="home-view__upsell-title">Unlock everything</span>
        </div>
        <div className="home-view__upsell-desc">
          Unlimited prompts, screenshots, NotebookLM sources, and chat history search.
        </div>
        <button className="home-view__upsell-btn">Upgrade — $5/mo</button>
      </div>
    </div>
  );
}
