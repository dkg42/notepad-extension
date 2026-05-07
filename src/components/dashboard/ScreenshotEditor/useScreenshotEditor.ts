import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureRecord } from '@/types/screenshot';

export type AnnotationTool = 'none' | 'text' | 'arrow' | 'line' | 'circle' | 'highlight' | 'redact';
export type AnnotationType = Exclude<AnnotationTool, 'none'>;
export type GradientStyle = 'linear' | 'radial';
export type BackgroundType = 'gradient' | 'solid';

export interface Annotation {
  id: string;
  type: AnnotationType;
  color: string;
  size: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text?: string;
}

export interface EditorSettings {
  backgroundType: BackgroundType;
  gradientStyle: GradientStyle;
  gradientAngle: number;
  colorStart: string;
  colorEnd: string;
  padding: number;
  frameRoundness: number;
  shadowAmount: number;
  activeTool: AnnotationTool;
  annotationColor: string;
  annotationSize: number;
}

export interface TextInputState {
  /** Position in px relative to the canvas-wrap div (for CSS left/top). */
  wrapX: number;
  wrapY: number;
  canvasX: number;
  canvasY: number;
}

const DEFAULT_SETTINGS: EditorSettings = {
  backgroundType: 'gradient',
  gradientStyle: 'linear',
  gradientAngle: 135,
  colorStart: '#FFBF00',
  colorEnd: '#06B6D4',
  padding: 40,
  frameRoundness: 12,
  shadowAmount: 28,
  activeTool: 'none',
  annotationColor: '#06B6D4',
  annotationSize: 4,
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const safeR = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, safeR);
  } else {
    ctx.moveTo(x + safeR, y);
    ctx.lineTo(x + w - safeR, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + safeR);
    ctx.lineTo(x + w, y + h - safeR);
    ctx.quadraticCurveTo(x + w, y + h, x + w - safeR, y + h);
    ctx.lineTo(x + safeR, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - safeR);
    ctx.lineTo(x, y + safeR);
    ctx.quadraticCurveTo(x, y, x + safeR, y);
    ctx.closePath();
  }
}

function drawSingleAnnotation(
  ctx: CanvasRenderingContext2D,
  ann: Annotation,
  isPreview: boolean,
) {
  ctx.save();
  ctx.strokeStyle = ann.color;
  ctx.fillStyle = ann.color;
  ctx.lineWidth = ann.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (isPreview) ctx.globalAlpha = 0.65;

  switch (ann.type) {
    case 'line':
      ctx.beginPath();
      ctx.moveTo(ann.x1, ann.y1);
      ctx.lineTo(ann.x2, ann.y2);
      ctx.stroke();
      break;

    case 'arrow': {
      ctx.beginPath();
      ctx.moveTo(ann.x1, ann.y1);
      ctx.lineTo(ann.x2, ann.y2);
      ctx.stroke();
      const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
      const headLen = Math.max(ann.size * 5, 12);
      ctx.beginPath();
      ctx.moveTo(ann.x2, ann.y2);
      ctx.lineTo(
        ann.x2 - headLen * Math.cos(angle - Math.PI / 6),
        ann.y2 - headLen * Math.sin(angle - Math.PI / 6),
      );
      ctx.lineTo(
        ann.x2 - headLen * Math.cos(angle + Math.PI / 6),
        ann.y2 - headLen * Math.sin(angle + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'circle': {
      const cx = (ann.x1 + ann.x2) / 2;
      const cy = (ann.y1 + ann.y2) / 2;
      const rx = Math.abs(ann.x2 - ann.x1) / 2;
      const ry = Math.abs(ann.y2 - ann.y1) / 2;
      if (rx > 0 && ry > 0) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
      break;
    }

    case 'highlight':
      ctx.globalAlpha = isPreview ? 0.25 : 0.38;
      ctx.fillRect(
        Math.min(ann.x1, ann.x2),
        Math.min(ann.y1, ann.y2),
        Math.abs(ann.x2 - ann.x1),
        Math.abs(ann.y2 - ann.y1),
      );
      break;

    case 'redact': {
      const bx = Math.min(ann.x1, ann.x2);
      const by = Math.min(ann.y1, ann.y2);
      const bw = Math.abs(ann.x2 - ann.x1);
      const bh = Math.abs(ann.y2 - ann.y1);
      if (bw < 2 || bh < 2) break;
      if (isPreview) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(bx, by, bw, bh);
        break;
      }
      // Gaussian blur via OffscreenCanvas: extract region with padding, blur, clip back
      const blurPx = 14;
      const pad2 = blurPx * 2;
      const exX = Math.max(0, Math.floor(bx - pad2));
      const exY = Math.max(0, Math.floor(by - pad2));
      const exW = Math.min(ctx.canvas.width - exX, Math.ceil(bw + pad2 * 2));
      const exH = Math.min(ctx.canvas.height - exY, Math.ceil(bh + pad2 * 2));
      try {
        const off = new OffscreenCanvas(exW, exH);
        const offCtx = off.getContext('2d')!;
        offCtx.filter = `blur(${blurPx}px)`;
        offCtx.drawImage(ctx.canvas, exX, exY, exW, exH, 0, 0, exW, exH);
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx, by, bw, bh);
        ctx.clip();
        ctx.drawImage(off, 0, 0, exW, exH, exX, exY, exW, exH);
        ctx.restore();
      } catch {
        // Fallback to dark fill if OffscreenCanvas unavailable
        ctx.fillStyle = '#111111';
        ctx.fillRect(bx, by, bw, bh);
      }
      break;
    }

    case 'text':
      if (ann.text) {
        const fontSize = Math.max(ann.size * 3, 14);
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(ann.text, ann.x1, ann.y1);
      }
      break;
  }

  ctx.restore();
}

function getCanvasCoords(
  e: React.MouseEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

export function useScreenshotEditor(captureId: string) {
  const [capture, setCapture] = useState<CaptureRecord | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [settings, setSettings] = useState<EditorSettings>(DEFAULT_SETTINGS);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [filename, setFilename] = useState('screenshot');
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const inProgressRef = useRef<Annotation | null>(null);
  const settingsRef = useRef(settings);
  const annotationsRef = useRef(annotations);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { annotationsRef.current = annotations; }, [annotations]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SCREENSHOT_STORE' })
      .then((res: { ok: boolean; store?: { captures: CaptureRecord[] } }) => {
        const found = res?.store?.captures?.find((c) => c.id === captureId);
        if (found) setCapture(found);
      })
      .catch(() => {});
  }, [captureId]);

  useEffect(() => {
    if (!capture) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = capture.dataUrl;
  }, [capture]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const s = settingsRef.current;
    const pad = s.padding;
    const cw = img.naturalWidth + 2 * pad;
    const ch = img.naturalHeight + 2 * pad;

    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);

    // 1. Background
    if (s.backgroundType === 'solid') {
      ctx.fillStyle = s.colorStart;
      ctx.fillRect(0, 0, cw, ch);
    } else if (s.gradientStyle === 'linear') {
      const rad = (s.gradientAngle * Math.PI) / 180;
      const halfLen = Math.sqrt(cw * cw + ch * ch) / 2;
      const cx = cw / 2, cy = ch / 2;
      const grad = ctx.createLinearGradient(
        cx - Math.sin(rad) * halfLen,
        cy + Math.cos(rad) * halfLen,
        cx + Math.sin(rad) * halfLen,
        cy - Math.cos(rad) * halfLen,
      );
      grad.addColorStop(0, s.colorStart);
      grad.addColorStop(1, s.colorEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      const cx = cw / 2, cy = ch / 2;
      const r = Math.sqrt(cw * cw + ch * ch) / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, s.colorStart);
      grad.addColorStop(1, s.colorEnd);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    }

    // 2. Screenshot frame — shadow pass
    ctx.save();
    if (s.shadowAmount > 0) {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = s.shadowAmount;
      ctx.shadowOffsetY = s.shadowAmount * 0.25;
    }
    drawRoundRect(ctx, pad, pad, img.naturalWidth, img.naturalHeight, s.frameRoundness);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // 3. Screenshot frame — image pass
    ctx.save();
    drawRoundRect(ctx, pad, pad, img.naturalWidth, img.naturalHeight, s.frameRoundness);
    ctx.clip();
    ctx.drawImage(img, pad, pad, img.naturalWidth, img.naturalHeight);
    ctx.restore();

    // 4. Committed annotations
    for (const ann of annotationsRef.current) {
      drawSingleAnnotation(ctx, ann, false);
    }

    // 5. In-progress annotation preview
    if (inProgressRef.current) {
      drawSingleAnnotation(ctx, inProgressRef.current, true);
    }
  }, []);

  // Re-render when settings or annotations change
  useEffect(() => {
    if (imageLoaded) renderCanvas();
  }, [imageLoaded, settings, annotations, renderCanvas]);

  const updateSetting = useCallback(<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const commitAnnotation = useCallback((ann: Annotation) => {
    setHistory((h) => [...h, annotationsRef.current]);
    setFuture([]);
    setAnnotations((prev) => [...prev, ann]);
    inProgressRef.current = null;
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [annotationsRef.current, ...f]);
      setAnnotations(prev);
      return h.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, annotationsRef.current]);
      setAnnotations(next);
      return f.slice(1);
    });
  }, []);

  const clearAnnotations = useCallback(() => {
    if (annotationsRef.current.length === 0) return;
    setHistory((h) => [...h, annotationsRef.current]);
    setFuture([]);
    setAnnotations([]);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || settingsRef.current.activeTool === 'none') return;

    const { x, y } = getCanvasCoords(e, canvas);

    if (settingsRef.current.activeTool === 'text') {
      // Position relative to the canvas-wrap div (the textarea's offsetParent).
      // Using wrapRef so we don't rely on the canvas rect which can be scaled.
      const wrapRect = (canvasWrapRef.current ?? canvas).getBoundingClientRect();
      setTextInput({
        wrapX: e.clientX - wrapRect.left,
        wrapY: e.clientY - wrapRect.top,
        canvasX: x,
        canvasY: y,
      });
      return;
    }

    isDrawingRef.current = true;
    drawStartRef.current = { x, y };
    inProgressRef.current = {
      id: '',
      type: settingsRef.current.activeTool as AnnotationType,
      color: settingsRef.current.annotationColor,
      size: settingsRef.current.annotationSize,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !drawStartRef.current || !canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    inProgressRef.current = {
      ...inProgressRef.current!,
      x2: x,
      y2: y,
    };
    renderCanvas();
  }, [renderCanvas]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    const { x, y } = getCanvasCoords(e, canvasRef.current);
    isDrawingRef.current = false;

    const ann = {
      ...inProgressRef.current!,
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x2: x,
      y2: y,
    };

    // Don't commit zero-size annotations
    const dx = Math.abs(ann.x2 - ann.x1);
    const dy = Math.abs(ann.y2 - ann.y1);
    if (dx < 2 && dy < 2 && ann.type !== 'text') {
      inProgressRef.current = null;
      renderCanvas();
      return;
    }

    commitAnnotation(ann);
    drawStartRef.current = null;
  }, [commitAnnotation, renderCanvas]);

  const commitTextAnnotation = useCallback((text: string) => {
    if (!textInput || !text.trim()) {
      setTextInput(null);
      return;
    }
    const ann: Annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'text',
      color: settingsRef.current.annotationColor,
      size: settingsRef.current.annotationSize,
      x1: textInput.canvasX,
      y1: textInput.canvasY,
      x2: textInput.canvasX,
      y2: textInput.canvasY,
      text,
    };
    commitAnnotation(ann);
    setTextInput(null);
  }, [textInput, commitAnnotation]);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename || 'screenshot'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [filename]);

  const copyToClipboard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback: not all browsers support ClipboardItem
      }
    }, 'image/png');
  }, []);

  return {
    capture,
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
  };
}
