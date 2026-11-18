import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  RotateCw,
  ArrowRight,
  History,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Download,
  Pencil,
} from 'lucide-react';
import { AddieCycle, AddieProject, AddieStepKey, Language } from '../../types';
import { getT } from '../../i18n/translations';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  buildStructuredMasterPrompt,
  downloadTextFile,
  getAddieStepCompletion,
} from './addieHelpers';

interface PreviousCyclePanelProps {
  previousCycle: AddieCycle;
  language: Language;
}

export const PreviousCyclePanel: React.FC<PreviousCyclePanelProps> = ({
  previousCycle,
  language,
}) => {
  const t = getT(language).addie;
  const [expanded, setExpanded] = useState(true);
  const selectedEval = (previousCycle.evaluation.methods || []).filter((m) => m.selected);

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.prevCycleDrawerTitle} ({t.cycleBadge} {previousCycle.cycleNumber})
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t.prevCycleCopyNotice}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition cursor-pointer"
        >
          <span>{expanded ? t.prevCycleHide : t.prevCycleShow}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-indigo-200/70 dark:border-indigo-800/50 text-xs">
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1">
            <div className="font-bold text-indigo-700 dark:text-indigo-300">{t.steps.analysis}</div>
            <p className="text-slate-700 dark:text-slate-300 line-clamp-3">
              {previousCycle.analysis.designChallenge || t.visualization.noDataText}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              {previousCycle.analysis.targetGroup}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1">
            <div className="font-bold text-indigo-700 dark:text-indigo-300">{t.steps.design}</div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
              {previousCycle.design.editedSolution.title || t.visualization.noDataText}
            </p>
            <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
              {previousCycle.design.editedSolution.summary}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1">
            <div className="font-bold text-indigo-700 dark:text-indigo-300">{t.steps.development}</div>
            <p className="text-slate-700 dark:text-slate-300 tabular-nums">
              {previousCycle.development.steps.length} {t.development.stepsTitle.toLowerCase()}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
              {previousCycle.development.tools.join(', ') || t.visualization.noDataText}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1">
            <div className="font-bold text-indigo-700 dark:text-indigo-300">{t.steps.implementation}</div>
            <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
              {previousCycle.implementation.artifactTitle || t.visualization.noDataText}
            </p>
            <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
              {previousCycle.implementation.generatedArtifact.slice(0, 120) || t.visualization.noDataText}
            </p>
          </div>

          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1">
            <div className="font-bold text-emerald-700 dark:text-emerald-300">{t.steps.evaluation}</div>
            <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
              {previousCycle.evaluation.cycleReflection ||
                selectedEval.map((m) => m.title).join(', ') ||
                t.visualization.noDataText}
            </p>
            {previousCycle.evaluation.nextCycleFocus && (
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 line-clamp-2">
                → {previousCycle.evaluation.nextCycleFocus}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface AddieCycleVisualizerProps {
  project: AddieProject;
  activeCycle: AddieCycle;
  language: Language;
  isCompilingPrompt: boolean;
  onSelectCycle: (cycleNumber: number) => void;
  onJumpToStep: (step: AddieStepKey) => void;
  onUpdateMasterPrompt: (value: string) => void;
  onCompileMasterPrompt: () => void;
}

export const AddieCycleVisualizer: React.FC<AddieCycleVisualizerProps> = ({
  project,
  activeCycle,
  language,
  isCompilingPrompt,
  onSelectCycle,
  onJumpToStep,
  onUpdateMasterPrompt,
  onCompileMasterPrompt,
}) => {
  const t = getT(language).addie;
  const [copiedMaster, setCopiedMaster] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const plannedCount = Math.max(activeCycle.analysis.plannedCycles || 1, project.cycles.length);
  const completion = getAddieStepCompletion(activeCycle, project);
  const liveMasterPrompt =
    activeCycle.implementation.finalMasterPrompt?.trim()
      ? activeCycle.implementation.finalMasterPrompt
      : buildStructuredMasterPrompt(activeCycle, project.title, language);

  const phases: {
    key: Exclude<AddieStepKey, 'visualization'>;
    short: string;
    label: string;
    hint: string;
    done: boolean;
  }[] = [
    {
      key: 'analysis',
      short: 'A',
      label: t.steps.analysis.replace(/^\d+\.\s*/, ''),
      hint: t.stepHints.analysis,
      done: completion.analysis,
    },
    {
      key: 'design',
      short: 'D',
      label: t.steps.design.replace(/^\d+\.\s*/, ''),
      hint: t.stepHints.design,
      done: completion.design,
    },
    {
      key: 'development',
      short: 'D',
      label: t.steps.development.replace(/^\d+\.\s*/, ''),
      hint: t.stepHints.development,
      done: completion.development,
    },
    {
      key: 'implementation',
      short: 'I',
      label: t.steps.implementation.replace(/^\d+\.\s*/, ''),
      hint: t.stepHints.implementation,
      done: completion.implementation,
    },
    {
      key: 'evaluation',
      short: 'E',
      label: t.steps.evaluation.replace(/^\d+\.\s*/, ''),
      hint: t.stepHints.evaluation,
      done: completion.evaluation,
    },
  ];

  // Build visual track slots (actual cycles + upcoming planned placeholder slots)
  const totalSlots = Array.from({ length: plannedCount }, (_, idx) => {
    const num = idx + 1;
    const cycleObj = project.cycles.find((c) => c.cycleNumber === num) || null;
    return { cycleNumber: num, cycle: cycleObj };
  });

  const selectedEval = (activeCycle.evaluation.methods || []).filter((m) => m.selected);

  const handleCopyMaster = async () => {
    const ok = await copyTextToClipboard(liveMasterPrompt);
    if (ok) {
      setCopiedMaster(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedMaster(false), 2200);
    }
  };

  const handleDownloadPrompt = (ext: 'txt' | 'md') => {
    const slug = (project.title || 'addie_projekt')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `addie_ai_studio_prompt_${slug}_cyklus_${activeCycle.cycleNumber}.${ext}`;
    downloadTextFile(
      filename,
      liveMasterPrompt,
      ext === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    );
  };

  const handleSyncFromSteps = () => {
    onUpdateMasterPrompt(buildStructuredMasterPrompt(activeCycle, project.title, language));
  };

  return (
    <div className="space-y-6">
      {/* 1. Interactive ADDIE Cycle Diagram + Full-Green Step Status Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t.visualization.loopDiagramTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {t.visualization.completedCyclesLabel} <strong>{project.cycles.length}</strong> &bull;{' '}
              {t.visualization.plannedProgressLabel} <strong>{activeCycle.analysis.plannedCycles || 1}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalSlots.map((slot, idx) => {
              const isCurrent = slot.cycleNumber === activeCycle.cycleNumber;
              const exists = Boolean(slot.cycle);
              return (
                <React.Fragment key={slot.cycleNumber}>
                  <button
                    type="button"
                    disabled={!exists}
                    onClick={() => exists && onSelectCycle(slot.cycleNumber)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold tabular-nums transition ${
                      isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs cursor-pointer'
                        : exists
                        ? 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-indigo-400 cursor-pointer'
                        : 'bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600 border-dashed border-slate-200 dark:border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    {t.cycleBadge} {slot.cycleNumber}
                  </button>
                  {idx < totalSlots.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Enhanced SVG ADDIE Flow showing concrete verbs per phase */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 overflow-x-auto">
          <div className="min-w-[760px]">
            <svg
              viewBox="0 0 920 205"
              className="w-full h-auto"
              role="img"
              aria-label={t.visualization.loopDiagramTitle}
            >
              {/* Iterative Feedback Return Loop */}
              <path
                d="M 815 130 C 815 186, 105 186, 105 130"
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.4"
                strokeDasharray="7 4"
                opacity="0.75"
              />
              <polygon points="99,134 111,134 105,120" fill="#4f46e5" opacity="0.9" />
              <text
                x="460"
                y="194"
                textAnchor="middle"
                className="fill-indigo-700 dark:fill-indigo-300 text-[11.5px] font-bold"
              >
                {t.cycleBadge} {activeCycle.cycleNumber} → {t.cycleBadge} {activeCycle.cycleNumber + 1}
              </text>

              {phases.map((phase, idx) => {
                const cx = 105 + idx * 177;
                const cy = 68;
                const done = phase.done;
                return (
                  <g
                    key={phase.key}
                    className="cursor-pointer"
                    onClick={() => onJumpToStep(phase.key)}
                  >
                    {idx < phases.length - 1 && (
                      <>
                        <line
                          x1={cx + 66}
                          y1={cy}
                          x2={cx + 111}
                          y2={cy}
                          stroke={done ? '#059669' : '#94a3b8'}
                          strokeWidth="2.5"
                        />
                        <polygon
                          points={`${cx + 106},${cy - 5} ${cx + 116},${cy} ${cx + 106},${cy + 5}`}
                          fill={done ? '#059669' : '#94a3b8'}
                        />
                      </>
                    )}
                    <rect
                      x={cx - 66}
                      y={cy - 44}
                      width="132"
                      height="88"
                      rx="14"
                      fill={done ? '#059669' : '#ffffff'}
                      stroke={done ? '#047857' : '#cbd5e1'}
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y={cy - 12}
                      textAnchor="middle"
                      fill={done ? '#ffffff' : '#0f172a'}
                      fontSize="20"
                      fontWeight="800"
                    >
                      {idx + 1}. {phase.short}
                    </text>
                    <text
                      x={cx}
                      y={cy + 8}
                      textAnchor="middle"
                      fill={done ? '#ecfdf5' : '#334155'}
                      fontSize="11"
                      fontWeight="700"
                    >
                      {phase.label.length > 16 ? `${phase.label.slice(0, 15)}…` : phase.label}
                    </text>
                    <text
                      x={cx}
                      y={cy + 26}
                      textAnchor="middle"
                      fill={done ? '#d1fae5' : '#64748b'}
                      fontSize="9.5"
                      fontWeight="600"
                    >
                      {phase.hint.length > 22 ? `${phase.hint.slice(0, 21)}…` : phase.hint}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Clickable Phase Completion Buttons — Full Green When Filled */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
            {phases.map((phase, idx) => {
              const done = phase.done;
              return (
                <button
                  key={phase.key}
                  type="button"
                  onClick={() => onJumpToStep(phase.key)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition cursor-pointer ${
                    done
                      ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate tabular-nums">
                      {idx + 1}. {phase.label}
                    </div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        done ? 'text-emerald-50' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {phase.hint}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Actionable Step-by-Step ADDIE Playbook (What to do + What was created in Steps 1–5) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {t.visualization.playbookTitle}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t.visualization.playbookDesc}
          </p>
        </div>

        <div className="space-y-4">
          {/* Card 1: Analysis */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
              completion.analysis
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    completion.analysis
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {completion.analysis ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>{t.steps.analysis}</span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.visualization.phaseActions.analysis}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep('analysis')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.visualization.editStepBtn}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <div>
                <div className="font-bold text-slate-500 dark:text-slate-400">{t.analysis.q1Label}</div>
                <p className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {activeCycle.analysis.designChallenge || t.visualization.noDataText}
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-500 dark:text-slate-400">{t.analysis.q2aLabel}</div>
                <p className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {activeCycle.analysis.targetGroup || t.visualization.noDataText}
                </p>
              </div>
              <div>
                <div className="font-bold text-slate-500 dark:text-slate-400">{t.analysis.q3Label}</div>
                <p className="text-slate-900 dark:text-slate-100 mt-0.5">
                  {activeCycle.analysis.availableResources || t.visualization.noDataText}
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Design */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
              completion.design
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    completion.design
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {completion.design ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>{t.steps.design}</span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.visualization.phaseActions.design}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep('design')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.visualization.editStepBtn}</span>
              </button>
            </div>
            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <div className="font-bold text-slate-900 dark:text-white">
                {activeCycle.design.editedSolution.title || t.visualization.noDataText}{' '}
                {activeCycle.design.editedSolution.archetype
                  ? `— ${activeCycle.design.editedSolution.archetype}`
                  : ''}
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                {activeCycle.design.editedSolution.summary || t.visualization.noDataText}
              </p>
              {(activeCycle.design.editedSolution.keyFeatures || []).filter(Boolean).length > 0 && (
                <ul className="list-disc pl-5 text-slate-700 dark:text-slate-300 space-y-0.5 pt-1">
                  {activeCycle.design.editedSolution.keyFeatures.filter(Boolean).map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Card 3: Development */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
              completion.development
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    completion.development
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {completion.development ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>{t.steps.development}</span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.visualization.phaseActions.development}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep('development')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.visualization.editStepBtn}</span>
              </button>
            </div>
            <div className="text-xs space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              {activeCycle.development.steps.length > 0 ? (
                <ol className="space-y-1.5">
                  {activeCycle.development.steps.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <div>
                        <strong className="text-slate-900 dark:text-white tabular-nums">
                          {s.order}. {s.title}
                        </strong>
                        <span className="text-slate-600 dark:text-slate-400"> — {s.description}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0 tabular-nums">
                        {s.deliverable} ({s.duration})
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-slate-500">{t.visualization.noDataText}</p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-700 dark:text-slate-300 pt-1">
                <span>
                  <strong>{t.development.toolsTitle}:</strong>{' '}
                  {activeCycle.development.tools.join(', ') || t.visualization.noDataText}
                </span>
                <span>
                  <strong>{t.development.professionsTitle}:</strong>{' '}
                  {activeCycle.development.professions.join(', ') || t.visualization.noDataText}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Implementation */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
              completion.implementation
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    completion.implementation
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {completion.implementation ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>{t.steps.implementation}</span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.visualization.phaseActions.implementation}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep('implementation')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.visualization.editStepBtn}</span>
              </button>
            </div>
            <div className="text-xs space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              <div className="font-bold text-slate-900 dark:text-white">
                {activeCycle.implementation.deliverableMode === 'classic_lesson'
                  ? t.analysis.outputLesson
                  : t.analysis.outputDigital}
                {activeCycle.implementation.artifactTitle
                  ? ` · ${activeCycle.implementation.artifactTitle}`
                  : ''}
              </div>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line max-h-36 overflow-y-auto">
                {activeCycle.implementation.generatedArtifact || t.visualization.noDataText}
              </p>
            </div>
          </div>

          {/* Card 5: Evaluation (Embedded Inside Object) */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
              completion.evaluation
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${
                    completion.evaluation
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {completion.evaluation ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  <span>{t.steps.evaluation}</span>
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.visualization.phaseActions.evaluation}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep('evaluation')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t.visualization.editStepBtn}</span>
              </button>
            </div>
            <div className="text-xs space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
              {selectedEval.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {selectedEval.map((m, idx) => (
                    <div
                      key={m.id}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-1"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">
                        {idx + 1}. {m.title}
                      </div>
                      <div className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        {t.evaluation.embeddedFeatureLabel}:{' '}
                        <span className="font-normal text-slate-700 dark:text-slate-300">
                          {m.embeddedFeature || m.howToConduct}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.evaluation.criterionLabel}: {m.successCriterion}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">{t.visualization.noDataText}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Final Downloadable & Copy-Ready Google AI Studio Master Prompt */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t.visualization.masterPromptTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t.visualization.masterPromptDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCompileMasterPrompt}
              disabled={isCompilingPrompt}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
            >
              {isCompilingPrompt ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                {isCompilingPrompt
                  ? t.visualization.compilingAiPrompt
                  : t.visualization.compileAiPromptBtn}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSyncFromSteps}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t.visualization.syncFromStepsBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMaster}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
            >
              {copiedMaster ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>
                {copiedMaster
                  ? t.visualization.copiedMasterPrompt
                  : t.visualization.copyMasterPromptBtn}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPrompt('txt')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-700 dark:hover:bg-indigo-600 text-white text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.visualization.downloadPromptTxtBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadPrompt('md')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.visualization.downloadPromptMdBtn}</span>
            </button>
          </div>
        </div>

        <textarea
          rows={18}
          value={liveMasterPrompt}
          onChange={(e) => onUpdateMasterPrompt(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* 4. Multi-Cycle Evolution Comparison Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          {t.visualization.comparisonTitle}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-bold">{t.visualization.phaseCol}</th>
                {project.cycles.map((c) => (
                  <th key={c.cycleNumber} className="py-2.5 px-3 font-bold tabular-nums">
                    {t.cycleBadge} {c.cycleNumber}
                    {c.cycleNumber === activeCycle.cycleNumber ? ` (${t.design.selectedBadge})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="py-3 pr-4 font-semibold align-top">{t.steps.analysis}</td>
                {project.cycles.map((c) => (
                  <td key={c.cycleNumber} className="py-3 px-3 align-top max-w-xs">
                    <div className="line-clamp-3">{c.analysis.designChallenge || t.visualization.noDataText}</div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold align-top">{t.steps.design}</td>
                {project.cycles.map((c) => (
                  <td key={c.cycleNumber} className="py-3 px-3 align-top max-w-xs">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {c.design.editedSolution.title || t.visualization.noDataText}
                    </div>
                    <div className="text-[11px] text-slate-500">{c.design.editedSolution.archetype}</div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold align-top">{t.steps.development}</td>
                {project.cycles.map((c) => (
                  <td key={c.cycleNumber} className="py-3 px-3 align-top max-w-xs tabular-nums">
                    <div>{c.development.steps.length} {t.development.stepsTitle.toLowerCase()}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {c.development.tools.join(', ') || t.visualization.noDataText}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold align-top">{t.steps.implementation}</td>
                {project.cycles.map((c) => (
                  <td key={c.cycleNumber} className="py-3 px-3 align-top max-w-xs">
                    <div className="font-semibold">
                      {c.implementation.deliverableMode === 'classic_lesson'
                        ? t.analysis.outputLesson
                        : t.analysis.outputDigital}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {c.implementation.artifactTitle || t.visualization.noDataText}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold align-top">{t.steps.evaluation}</td>
                {project.cycles.map((c) => (
                  <td key={c.cycleNumber} className="py-3 px-3 align-top max-w-xs">
                    <div className="tabular-nums">
                      {(c.evaluation.methods || []).filter((m) => m.selected).length}{' '}
                      {t.evaluation.includeToggle.toLowerCase()}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {c.evaluation.cycleReflection || c.evaluation.nextCycleFocus || '-'}
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
