/**
 * @module DashboardHome
 * @description Landing page of the dashboard: greeting hero, 4 stat cards, recent-prompts panel, quick actions, plan usage bars, and a 12-week activity heatmap.
 * @dependencies @/types, @/types/dashboard, ./useDashboardHome, @/contexts/SnippetsContext, @/contexts/NavigationContext, @/services/auth-service
 * @public DashboardHome
 */
import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  BookOpen,
  MessageSquare,
  Tag,
  RefreshCw,
  Plus,
  Search,
  Workflow,
} from 'lucide-react';
import { useDashboardHome, type HeatmapCell } from './useDashboardHome';
import { useSnippets } from '@/contexts/SnippetsContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import { useDailyLimit } from '@/hooks/useDailyLimit';
import { FREE_CAPS } from '@/services/usage-limit-service';
import { DAILY_LIMITS } from '@/services/daily-limit-service';
import { authService } from '@/services/auth-service';
import type { StoredAuthProfile } from '@/types';
import './DashboardHome.css';

// ── Activity heatmap ───────────────────────────────────────────────────────

function ActivityHeatmap({
  cells,
  totalCaptures,
}: {
  cells: HeatmapCell[];
  totalCaptures: number;
}) {
  const WEEKS = 12;
  const DAYS = 7;

  return (
    <div className="heatmap">
      <div className="heatmap__grid-wrap">
        <div className="heatmap__grid">
          {Array.from({ length: WEEKS }).map((_, w) => (
            <div key={w} className="heatmap__week">
              {Array.from({ length: DAYS }).map((_, d) => {
                const cell = cells[w * DAYS + d] ?? { level: 0, count: 0, label: '' };
                return (
                  <div
                    key={d}
                    className={`heatmap__cell heatmap__cell--${cell.level}`}
                    title={`${cell.count} capture${cell.count === 1 ? '' : 's'}${cell.label ? ` · ${cell.label}` : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap__legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heatmap__legend-dot heatmap__cell--${l}`} />
        ))}
        <span>More</span>
        <span className="heatmap__legend-summary">{totalCaptures} captures total</span>
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta: string;
}

function StatCard({ icon, label, value, delta }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <div className="stat-card__icon-wrap">{icon}</div>
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__delta">{delta}</div>
    </div>
  );
}

// ── Plan usage bar ─────────────────────────────────────────────────────────

interface UsageBarProps {
  name: string;
  used: number;
  max: number;
  suffix?: string;
}

function UsageBar({ name, used, max, suffix }: UsageBarProps) {
  const pct = Math.min((used / max) * 100, 100);
  const warn = pct >= 80;
  return (
    <div className="usage-bar">
      <div className="usage-bar__header">
        <span className="usage-bar__name">{name}</span>
        <span className={`usage-bar__count${warn ? ' usage-bar__count--warn' : ''}`}>
          {used} / {max}{suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <div className="usage-bar__track">
        <div
          className={`usage-bar__fill${warn ? ' usage-bar__fill--warn' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DashboardHome() {
  const { snippets, folders, favoritesCount } = useSnippets();
  const {
    setCurrentView: onNavigate,
    notebooksCount,
    chatHistoryCount,
    setShowCommandPalette,
    conversations,
    notebooks,
  } = useNavigation();
  const { totalTags, captureActivity, formattedDate } =
    useDashboardHome(snippets, folders, conversations, notebooks);
  const { isActive: isPro } = useSubscription();

  const promptUsage = useUsageLimit('prompt_hub');
  const chatUsage = useUsageLimit('chat_history');
  const pipelineUsage = useUsageLimit('pipeline');
  const notebookDaily = useDailyLimit('notebook_add');

  const [user, setUser] = useState<StoredAuthProfile | null>(null);
  useEffect(() => {
    authService.getCurrentUser().then(setUser);
    return authService.onAuthStateChange(setUser);
  }, []);

  const firstName = user?.displayName?.split(' ')[0] ?? null;

  const stats: StatCardProps[] = [
    {
      icon: <Sparkles size={13} strokeWidth={1.8} />,
      label: 'Prompts',
      value: snippets.length,
      delta: `${favoritesCount} favorited`,
    },
    {
      icon: <BookOpen size={13} strokeWidth={1.8} />,
      label: 'Notebooks',
      value: notebooksCount,
      delta: 'NotebookLM sources',
    },
    {
      icon: <MessageSquare size={13} strokeWidth={1.8} />,
      label: 'Saved chats',
      value: chatHistoryCount,
      delta: 'Across all LLMs',
    },
    {
      icon: <Tag size={13} strokeWidth={1.8} />,
      label: 'Unique tags',
      value: totalTags,
      delta: 'Organizing your prompts',
    },
  ];

  const quickActions = [
    {
      id: 'newprompt',
      label: 'New prompt',
      sub: 'Save and tag',
      icon: <Plus size={13} strokeWidth={1.8} />,
      accent: true,
      onClick: () => onNavigate('prompts'),
    },
    {
      id: 'sync',
      label: 'Sync NotebookLM',
      sub: 'Keep sources fresh',
      icon: <RefreshCw size={13} strokeWidth={1.8} />,
      accent: false,
      onClick: () => onNavigate('notebooks'),
    },
    {
      id: 'cmdk',
      label: 'Command palette',
      sub: '⌘K',
      icon: <Search size={13} strokeWidth={1.8} />,
      accent: false,
      onClick: () => setShowCommandPalette(true),
    },
    {
      id: 'pipeline',
      label: 'New pipeline',
      sub: 'Automate workflow',
      icon: <Workflow size={13} strokeWidth={1.8} />,
      accent: false,
      onClick: () => onNavigate('pipelines'),
    },
  ];

  const lifetimeBars: UsageBarProps[] = [
    { name: 'Prompts', used: promptUsage.count ?? 0, max: FREE_CAPS.prompt_hub },
    { name: 'Saved chats', used: chatUsage.count ?? 0, max: FREE_CAPS.chat_history },
    { name: 'Pipelines', used: pipelineUsage.count ?? 0, max: FREE_CAPS.pipeline },
  ];

  const dailyBars: UsageBarProps[] = [
    {
      name: 'NotebookLM adds',
      used: notebookDaily.count ?? 0,
      max: DAILY_LIMITS.notebook_add,
      suffix: 'today',
    },
  ];

  const totalCaptures = snippets.length + chatHistoryCount + notebooksCount;

  return (
    <div className="dashboard-home">
      {/* Hero */}
      <div className="dashboard-home__hero">
        <div>
          <div className="dashboard-home__date">{formattedDate}</div>
          <h1 className="dashboard-home__heading">
            Welcome back{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="dashboard-home__subheading">
            You have{' '}
            <strong>{snippets.length} prompts</strong> and{' '}
            <strong>{notebooksCount} notebooks</strong> saved.
          </p>
        </div>
        <div className="dashboard-home__hero-actions">
          <button
            className="dashboard-home__btn-ghost"
            onClick={() => onNavigate('notebooks')}
          >
            <RefreshCw size={13} strokeWidth={1.8} />
            Sync now
          </button>
          <button
            className="dashboard-home__btn-primary"
            onClick={() => onNavigate('prompts')}
          >
            <Plus size={13} strokeWidth={1.8} />
            New prompt
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dashboard-home__stats">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Body: 2fr activity | 1fr side */}
      <div className="dashboard-home__body">
        {/* Capture activity card */}
        <div className="dashboard-home__activity-card">
          <div className="dashboard-home__card-header">
            <div>
              <div className="dashboard-home__card-title">Capture activity</div>
              <div className="dashboard-home__card-subtitle">
                Last 12 weeks · prompts, chats, notebooks
              </div>
            </div>
          </div>
          <div className="dashboard-home__activity-body">
            <ActivityHeatmap cells={captureActivity.cells} totalCaptures={totalCaptures} />
          </div>
        </div>

        {/* Side panel: quick actions + plan usage */}
        <div className="dashboard-home__side">
          <div className="dashboard-home__side-card">
            <div className="dashboard-home__section-label">Quick actions</div>
            <div className="dashboard-home__quick-grid">
              {quickActions.map((q) => (
                <button
                  key={q.id}
                  className={`dashboard-home__quick-action${q.accent ? ' dashboard-home__quick-action--accent' : ''}`}
                  onClick={q.onClick}
                >
                  <div className="dashboard-home__quick-action-header">
                    {q.icon}
                    <span className="dashboard-home__quick-action-label">{q.label}</span>
                  </div>
                  <div className="dashboard-home__quick-action-sub">{q.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {!isPro && (
            <div className="dashboard-home__side-card">
              <div className="dashboard-home__section-label">Plan usage</div>
              <div className="dashboard-home__usage-list">
                <div className="dashboard-home__usage-group-label dashboard-home__usage-group-label--first">
                  Lifetime
                </div>
                {lifetimeBars.map((u) => (
                  <UsageBar key={u.name} {...u} />
                ))}
                <div className="dashboard-home__usage-group-label">Today</div>
                {dailyBars.map((u) => (
                  <UsageBar key={u.name} {...u} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
