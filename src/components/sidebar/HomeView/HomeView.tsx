/**
 * @module HomeView
 * @description Home launcher grid of the sidebar showing all available tools (Prompt Hub, Snippets, etc.) with accent icons, plan badges, and coming-soon overlays. Displays a sign-in nudge for anonymous users and a current-page strip with a capture button.
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
  Plus,
  User,
  type LucideIcon,
} from 'lucide-react';
import type { StoredAuthProfile } from '@/types';
import './HomeView.css';

interface Feature {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
  plan: 'free' | 'pro';
  accent: string;
  comingSoon?: boolean;
  limit?: { used: number; max: number; unit: string };
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
    desc: 'Recent conversations across AI tools',
    plan: 'free',
    accent: 'sky',
    comingSoon: true,
  },
  {
    id: 'screenshot',
    name: 'Screenshot',
    icon: Camera,
    desc: 'Capture, annotate, send to AI',
    plan: 'free',
    accent: 'amber',
    comingSoon: true,
  },
  {
    id: 'tabs',
    name: 'Tab Manager',
    icon: Layers,
    desc: 'Group, label, declutter open tabs',
    plan: 'free',
    accent: 'violet',
    comingSoon: true,
  },
  {
    id: 'notebook',
    name: 'Add to NotebookLM',
    icon: BookOpen,
    desc: 'Send current tab as a source',
    plan: 'pro',
    accent: 'magenta',
    comingSoon: true,
  },
];

interface UsageBarProps {
  used: number;
  max: number;
}

function UsageBar({ used, max }: UsageBarProps) {
  const pct = Math.min(100, (used / max) * 100);
  const warn = pct >= 80;
  return (
    <div className="home-view__usage-bar-row">
      <div className="home-view__usage-bar-track">
        <div
          className={`home-view__usage-bar-fill${warn ? ' home-view__usage-bar-fill--warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="home-view__usage-count">{used}/{max}</span>
    </div>
  );
}

interface HomeViewProps {
  onNavigate: (view: string) => void;
  signedOut: boolean;
  user: StoredAuthProfile | null;
  onSignIn: () => void;
}

export default function HomeView({ onNavigate, signedOut, onSignIn }: HomeViewProps) {
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? '';
      try {
        setCurrentUrl(new URL(url).hostname);
      } catch {
        setCurrentUrl(url);
      }
    });
  }, []);

  return (
    <div className="home-view">
      {signedOut && (
        <div className="home-view__signin-nudge">
          <div className="home-view__signin-nudge-icon">
            <User size={13} strokeWidth={1.8} />
          </div>
          <div className="home-view__signin-nudge-text">
            <div className="home-view__signin-nudge-title">Sign in to sync across devices</div>
            <div className="home-view__signin-nudge-sub">
              You're using Notehublm anonymously — saves stay on this browser.
            </div>
          </div>
          <button className="home-view__signin-nudge-btn" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      )}

      {currentUrl && (
        <div className="home-view__page-strip">
          <div className="home-view__page-strip-icon">
            <Sparkles size={15} strokeWidth={1.8} />
          </div>
          <div className="home-view__page-strip-info">
            <div className="home-view__page-strip-label">This page</div>
            <div className="home-view__page-strip-url">{currentUrl}</div>
          </div>
          <button className="home-view__page-strip-btn">
            <Plus size={11} strokeWidth={2.4} />
            Capture
          </button>
        </div>
      )}

      <div className="home-view__section-label">Tools</div>

      <div className="home-view__grid">
        {FEATURES.map((f) => {
          const a = ACCENT_MAP[f.accent] ?? ACCENT_MAP.primary;
          const isDisabled = f.comingSoon;

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
                {f.limit ? (
                  <UsageBar used={f.limit.used} max={f.limit.max} />
                ) : (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9.5px',
                    color: 'var(--fg-3)',
                  }}>
                    {f.plan === 'pro' ? 'Unlimited on Pro' : 'Unlimited'}
                  </span>
                )}
              </div>

              {f.comingSoon && (
                <div className="home-view__coming-soon">
                  <span className="home-view__coming-soon-badge">Coming soon</span>
                </div>
              )}
            </button>
          );
        })}
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
