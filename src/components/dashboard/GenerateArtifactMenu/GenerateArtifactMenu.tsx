/**
 * @module GenerateArtifactMenu
 * @description Dropdown button that triggers generation of a non-audio NotebookLM artifact (mind map, report/study guide, flashcards, quiz, or slide deck). Fires the GENERATE_NOTEBOOK_ARTIFACT background message via the supplied callback.
 * @dependencies @/services/notebooklm-api
 * @public GenerateArtifactMenu
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Network, FileText, Layers, HelpCircle, Presentation } from 'lucide-react';
import type { ArtifactKind } from '@/services/notebooklm-api';
import './GenerateArtifactMenu.css';

interface ArtifactOption {
  kind: ArtifactKind;
  label: string;
  description: string;
  icon: typeof Network;
}

const OPTIONS: ArtifactOption[] = [
  { kind: 'mindmap', label: 'Mind map', description: 'Interactive hierarchical map', icon: Network },
  { kind: 'report', label: 'Study guide', description: 'Long-form briefing or report', icon: FileText },
  { kind: 'flashcards', label: 'Flashcards', description: 'Q&A cards for review', icon: Layers },
  { kind: 'quiz', label: 'Quiz', description: 'Multiple-choice questions', icon: HelpCircle },
  { kind: 'slides', label: 'Slide deck', description: 'Presentation slides', icon: Presentation },
];

interface GenerateArtifactMenuProps {
  onGenerate: (kind: ArtifactKind) => void | Promise<void>;
  /** Non-null while a kind is generating; disables the trigger and labels the spinner. */
  generatingKind: ArtifactKind | null;
}

export default function GenerateArtifactMenu({ onGenerate, generatingKind }: GenerateArtifactMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const isGenerating = generatingKind !== null;
  const generatingLabel = generatingKind
    ? OPTIONS.find((o) => o.kind === generatingKind)?.label
    : null;

  return (
    <div className="generate-artifact-menu" ref={wrapRef}>
      <button
        className="notebook-detail__action-btn"
        onClick={() => setOpen((v) => !v)}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <span className="notebook-detail__spinner" />
            Generating {generatingLabel?.toLowerCase()}…
          </>
        ) : (
          <>
            Generate
            <ChevronDown size={12} strokeWidth={2} />
          </>
        )}
      </button>
      {open && (
        <div className="generate-artifact-menu__dropdown" role="menu">
          {OPTIONS.map(({ kind, label, description, icon: Icon }) => (
            <button
              key={kind}
              className="generate-artifact-menu__item"
              onClick={() => {
                setOpen(false);
                void onGenerate(kind);
              }}
            >
              <span className="generate-artifact-menu__icon">
                <Icon size={14} strokeWidth={1.75} />
              </span>
              <span className="generate-artifact-menu__text">
                <span className="generate-artifact-menu__label">{label}</span>
                <span className="generate-artifact-menu__desc">{description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
