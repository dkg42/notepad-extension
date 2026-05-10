import React, { useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';
import GeneralPanel from './GeneralPanel/GeneralPanel';
import AnnotatePanel from './AnnotatePanel/AnnotatePanel';
import { useScreenshotEditor } from './useScreenshotEditor';
import { useUsageLimit } from '@/hooks/useUsageLimit';
import './ScreenshotEditor.css';

type PanelTab = 'general' | 'annotate';

interface Props {
  captureId: string;
}

export default function ScreenshotEditor({ captureId }: Props) {
  const { handleBackToScreenshots } = useNavigation();
  const [activeTab, setActiveTab] = useState<PanelTab>('general');

  const {
    imageLoaded,
    canvasRef,
    canvasWrapRef,
    settings,
    updateSetting,
    annotations,
    history,
    future,
    undo,
    redo,
    clearAnnotations,
    textInput,
    commitTextAnnotation,
    setTextInput,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    filename,
    setFilename,
    copied,
    download,
    copyToClipboard,
  } = useScreenshotEditor(captureId);

  const { canUse: canEdit, count: editCount, use: useEdit } = useUsageLimit('screenshot_editor');

  const handleDownload = async () => {
    await useEdit();
    download();
  };

  const handleCopy = async () => {
    await useEdit();
    copyToClipboard();
  };

  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const getCursor = () => {
    if (settings.activeTool === 'none') return 'default';
    if (settings.activeTool === 'text') return 'text';
    return 'crosshair';
  };

  return (
    <div className="screenshot-editor">
      {/* Top bar */}
      <div className="screenshot-editor__topbar">
        <button
          className="screenshot-editor__back-btn"
          onClick={handleBackToScreenshots}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="screenshot-editor__tabs">
          <button
            className={`screenshot-editor__tab${activeTab === 'general' ? ' screenshot-editor__tab--active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`screenshot-editor__tab${activeTab === 'annotate' ? ' screenshot-editor__tab--active' : ''}`}
            onClick={() => setActiveTab('annotate')}
          >
            Annotate
          </button>
        </div>
      </div>

      <div className="screenshot-editor__body">
        {/* Left panel */}
        <aside className="screenshot-editor__panel">
          <div className="screenshot-editor__panel-scroll">
            {activeTab === 'general' ? (
              <GeneralPanel
                settings={settings}
                filename={filename}
                onSettingChange={updateSetting}
                onFilenameChange={setFilename}
                onDownload={() => void handleDownload()}
                onCopy={() => void handleCopy()}
                copied={copied}
                canExport={canEdit}
                exportCount={editCount}
              />
            ) : (
              <AnnotatePanel
                settings={settings}
                annotations={annotations}
                history={history}
                future={future}
                onSettingChange={updateSetting}
                onUndo={undo}
                onRedo={redo}
                onClearAll={clearAnnotations}
              />
            )}
          </div>

          {activeTab === 'annotate' && (
            <div className="screenshot-editor__panel-footer">
              <button
                className="general-panel__btn general-panel__btn--download"
                onClick={() => void handleDownload()}
                disabled={!canEdit}
                title={!canEdit ? 'Daily export limit reached — upgrade to Pro' : undefined}
              >
                ↓ Download
              </button>
              <button
                className="general-panel__btn general-panel__btn--copy"
                onClick={() => void handleCopy()}
                disabled={!canEdit}
                title={!canEdit ? 'Daily export limit reached — upgrade to Pro' : undefined}
              >
                {copied ? '✓ Copied!' : '⎘ Copy'}
              </button>
            </div>
          )}
        </aside>

        {/* Canvas area */}
        <div className="screenshot-editor__canvas-area">
          {!imageLoaded ? (
            <div className="screenshot-editor__loading">Loading image…</div>
          ) : (
            <div className="screenshot-editor__canvas-wrap" ref={canvasWrapRef}>
              <canvas
                ref={canvasRef}
                className="screenshot-editor__canvas"
                style={{ cursor: getCursor() }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />

              {/* Floating text input — committed by Enter or the ✓ button; Escape cancels */}
              {textInput && (
                <div
                  className="screenshot-editor__text-wrap"
                  style={{ left: textInput.wrapX, top: textInput.wrapY }}
                >
                  <textarea
                    ref={textInputRef}
                    className="screenshot-editor__text-input"
                    rows={1}
                    placeholder="Type text…"
                    autoFocus
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        commitTextAnnotation((e.target as HTMLTextAreaElement).value);
                      }
                      if (e.key === 'Escape') {
                        setTextInput(null);
                      }
                    }}
                  />
                  <div className="screenshot-editor__text-actions">
                    <button
                      className="screenshot-editor__text-commit"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        commitTextAnnotation(textInputRef.current?.value ?? '');
                      }}
                    >
                      ✓
                    </button>
                    <button
                      className="screenshot-editor__text-cancel"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTextInput(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
