import React, { useRef, useState, useEffect } from 'react';
import { Palette, RotateCcw, Trash2, Check, Download, Eraser, PenTool } from 'lucide-react';
import { Language } from '../../types';
import { translations } from '../../i18n/translations';

interface SketchpadProps {
  language: Language;
  onSaveSketch: (dataUrl: string) => void;
  isDark: boolean;
}

export const Sketchpad: React.FC<SketchpadProps> = ({ language, onSaveSketch, isDark }) => {
  const t = translations[language].journal;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#2d3748');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const saveFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!hasInitializedRef.current || !hasDrawn) {
      ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([imgData]);
      hasInitializedRef.current = true;
    }
  }, [isDark, hasDrawn]);

  useEffect(() => {
    return () => {
      if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    };
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-15), imgData]);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = isEraser ? (isDark ? '#1e293b' : '#ffffff') : color;
    ctx.lineWidth = isEraser ? lineWidth * 3 : lineWidth;

    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveState();
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop(); // discard current
    const previous = newHistory[newHistory.length - 1];
    if (previous) {
      ctx.putImageData(previous, 0, 0);
      setHistory(newHistory);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    saveState();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveSketch(dataUrl);
    setSavedFeedback(true);
    if (saveFeedbackTimerRef.current) clearTimeout(saveFeedbackTimerRef.current);
    saveFeedbackTimerRef.current = setTimeout(() => setSavedFeedback(false), 2000);
  };

  const colors = [
    isDark ? '#f8fafc' : '#0f172a',
    '#64748b',
    '#2563eb',
    '#059669',
    '#d97706',
    '#dc2626',
    '#7c3aed',
  ];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t.sketchpadTitle}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Colors */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
                className={`w-5 h-5 rounded-full transition-transform ${
                  color === c && !isEraser ? 'scale-125 ring-2 ring-indigo-500 ring-offset-1' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* Eraser */}
          <button
            type="button"
            onClick={() => setIsEraser(!isEraser)}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              isEraser
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={t.eraserBtn}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          {/* Stroke Width */}
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>{t.brushSize}</span>
            <input
              type="range"
              min="1"
              max="16"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Undo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="p-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
            title={t.undo}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            title={t.clearCanvas}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Save / Attach */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasDrawn}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-40"
          >
            {savedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>{t.sketchSavedBadge}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{t.saveSketch}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="mt-3 relative rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={700}
          height={320}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[240px] md:h-[300px] touch-none block"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 dark:text-slate-700 text-xs px-4 text-center">
            {t.sketchHint}
          </div>
        )}
      </div>
    </div>
  );
};
