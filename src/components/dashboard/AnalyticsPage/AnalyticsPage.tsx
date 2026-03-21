import React from 'react';
import type { Folder, Snippet } from '@/types';
import StatChart from '@/components/dashboard/StatChart/StatChart';
import { useAnalyticsPage } from './useAnalyticsPage';
import './AnalyticsPage.css';

interface AnalyticsPageProps {
  snippets: Snippet[];
  folders: Folder[];
}

export default function AnalyticsPage({ snippets, folders }: AnalyticsPageProps) {
  const { bySource, byFolder, byTag, byMonth } = useAnalyticsPage(snippets, folders);

  const uniqueSources = new Set(snippets.map((s) => {
    try { return new URL(s.source).hostname.replace(/^www\./, ''); } catch { return s.source; }
  })).size;

  const uniqueTags = new Set(snippets.flatMap((s) => s.tags ?? [])).size;
  const favorites = snippets.filter((s) => s.isFavorite).length;

  return (
    <div className="analytics-page">
      <div className="analytics-page__header">
        <h1 className="analytics-page__heading">Analytics</h1>
        <p className="analytics-page__subheading">
          Usage breakdown of your saved prompts.
        </p>
      </div>

      <div className="analytics-page__stats">
        <div className="analytics-stat">
          <div className="analytics-stat__value">{snippets.length}</div>
          <div className="analytics-stat__label">Total Prompts</div>
        </div>
        <div className="analytics-stat">
          <div className="analytics-stat__value">{folders.length}</div>
          <div className="analytics-stat__label">Folders</div>
        </div>
        <div className="analytics-stat">
          <div className="analytics-stat__value">{uniqueTags}</div>
          <div className="analytics-stat__label">Unique Tags</div>
        </div>
        <div className="analytics-stat">
          <div className="analytics-stat__value">{uniqueSources}</div>
          <div className="analytics-stat__label">Sources</div>
        </div>
        <div className="analytics-stat">
          <div className="analytics-stat__value">{favorites}</div>
          <div className="analytics-stat__label">Favourites</div>
        </div>
      </div>

      <div className="analytics-page__charts">
        <StatChart title="Prompts by Source" entries={bySource} />
        <StatChart title="Prompts by Folder" entries={byFolder} />
        <StatChart title="Top Tags" entries={byTag} />
        <StatChart title="Prompts Over Time" entries={byMonth} />
      </div>
    </div>
  );
}
