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
  ArrowRight,
  Star,
} from 'lucide-react';
import { useDashboardHome, type HeatmapCell } from './useDashboardHome';
import { useSnippets } from '@/contexts/SnippetsContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { FREE_CAPS } from '@/services/usage-limit-service';
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
}

function UsageBar({ name, used, max }: UsageBarProps) {
  const pct = Math.min((used / max) * 100, 100);
  const warn = pct >= 80;
  return (
    <div className="usage-bar">
      <div className="usage-bar__header">
        <span className="usage-bar__name">{name}</span>
        <span className={`usage-bar__count${warn ? ' usage-bar__count--warn' : ''}`}>
          {used} / {max}
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
  const { totalTags, recentSnippets, folderMap, captureActivity, formattedDate } =
    useDashboardHome(snippets, folders, conversations, notebooks);
  const { isActive: isPro } = useSubscription();

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

  const usageBars: UsageBarProps[] = [
    { name: 'Prompts', used: snippets.length, max: FREE_CAPS.prompt_hub },
    { name: 'Saved chats', used: chatHistoryCount, max: FREE_CAPS.chat_history },
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

      {/* Body: 2fr recent prompts | 1fr side */}
      <div className="dashboard-home__body">
        {/* Recent prompts card */}
        <div className="dashboard-home__recent-card">
          <div className="dashboard-home__card-header">
            <div>
              <div className="dashboard-home__card-title">Recent prompts</div>
              <div className="dashboard-home__card-subtitle">From your Prompt Hub</div>
            </div>
            <button
              className="dashboard-home__view-all"
              onClick={() => onNavigate('prompts')}
            >
              View all <ArrowRight size={11} strokeWidth={2} />
            </button>
          </div>

          {recentSnippets.length === 0 ? (
            <div className="dashboard-home__empty">
              <Sparkles size={28} strokeWidth={1.4} />
              <span>No prompts saved yet.</span>
              <button
                className="dashboard-home__btn-primary dashboard-home__btn-primary--sm"
                onClick={() => onNavigate('prompts')}
              >
                <Plus size={12} /> Save a prompt
              </button>
            </div>
          ) : (
            <div className="dashboard-home__prompt-list">
              {recentSnippets.map((s) => (
                <div key={s.id} className="dashboard-home__prompt-row">
                  <Star
                    size={14}
                    strokeWidth={1.6}
                    className={`dashboard-home__star${s.isFavorite ? ' dashboard-home__star--active' : ''}`}
                  />
                  <div className="dashboard-home__prompt-info">
                    <div className="dashboard-home__prompt-title">
                      {s.title ?? s.text.slice(0, 60)}
                      {!s.title && s.text.length > 60 ? '…' : ''}
                    </div>
                    <div className="dashboard-home__prompt-meta">
                      {s.folderId && (
                        <span className="dashboard-home__prompt-folder">
                          {folderMap.get(s.folderId) ?? ''}
                        </span>
                      )}
                      {s.tags?.slice(0, 2).map((t) => (
                        <span key={t} className="dashboard-home__tag">#{t}</span>
                      ))}
                    </div>
                  </div>
                  {s.savedAt && (
                    <span className="dashboard-home__prompt-date">
                      {new Date(s.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
                {usageBars.map((u) => (
                  <UsageBar key={u.name} {...u} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="dashboard-home__heatmap-card">
        <div className="dashboard-home__card-header">
          <div className="dashboard-home__section-label" style={{ marginBottom: 0 }}>
            Capture activity · last 12 weeks
          </div>
        </div>
        <ActivityHeatmap cells={captureActivity.cells} totalCaptures={totalCaptures} />
      </div>
    </div>
  );
}
