import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Clock,
  Download,
  Layers,
  Plus,
  RotateCw,
  Target,
} from 'lucide-react';
import {
  AddieCriterionStatus,
  AddiePhaseKey,
  AddieProject,
  AddieStepKey,
  Language,
} from '../../types';
import { getT } from '../../i18n/translations';
import { triggerBlobDownload } from '../../utils/clipboard';
import {
  ADDIE_PHASES,
  computeAddieProjectMetrics,
  formatDurationSeconds,
  formatMinutesCompact,
  getCyclePhaseSeconds,
} from './addieMetrics';

interface AddieProjectVisualizationTabProps {
  project: AddieProject;
  language: Language;
  onUpdatePhaseSeconds: (cycleNumber: number, phase: AddiePhaseKey, seconds: number) => void;
  onUpdateCriterion: (
    cycleNumber: number,
    methodId: string,
    patch: { criterionStatus?: AddieCriterionStatus; measuredResult?: string }
  ) => void;
  onJumpToCycleStep: (cycleNumber: number, step: AddieStepKey) => void;
  onStartNextCycle: () => void;
}

const CYCLE_SERIES_COLORS = [
  '#4f46e5', // indigo-600
  '#0ea5e9', // sky-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
];

function formatShortDate(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = language === 'cs' ? 'cs-CZ' : language === 'pl' ? 'pl-PL' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function csvEscape(val: unknown): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const AddieProjectVisualizationTab: React.FC<AddieProjectVisualizationTabProps> = ({
  project,
  language,
  onUpdatePhaseSeconds,
  onUpdateCriterion,
  onJumpToCycleStep,
  onStartNextCycle,
}) => {
  const t = getT(language).addie;
  const pv = t.projectViz;

  const sortedCycles = useMemo(
    () => [...project.cycles].sort((a, b) => a.cycleNumber - b.cycleNumber),
    [project.cycles]
  );

  const [cycleScope, setCycleScope] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AddieCriterionStatus>('all');
  const [includedOnly, setIncludedOnly] = useState<boolean>(true);

  // Time logger controls
  const [logCycleNum, setLogCycleNum] = useState<number>(
    project.activeCycleNumber || sortedCycles[0]?.cycleNumber || 1
  );
  const [logPhase, setLogPhase] = useState<AddiePhaseKey>('analysis');
  const [logMinutesInput, setLogMinutesInput] = useState<string>('0');
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  // Keep selected scope valid if project/cycles change
  useEffect(() => {
    if (
      cycleScope !== 'all' &&
      !sortedCycles.some((c) => c.cycleNumber === cycleScope)
    ) {
      setCycleScope('all');
    }
    if (!sortedCycles.some((c) => c.cycleNumber === logCycleNum)) {
      setLogCycleNum(sortedCycles[0]?.cycleNumber || 1);
    }
  }, [sortedCycles, cycleScope, logCycleNum]);

  // Sync manual time input whenever target cycle or phase changes
  useEffect(() => {
    const targetCycle = sortedCycles.find((c) => c.cycleNumber === logCycleNum);
    if (!targetCycle) {
      setLogMinutesInput('0');
      return;
    }
    const mins = Math.round(getCyclePhaseSeconds(targetCycle, logPhase) / 60);
    setLogMinutesInput(String(mins));
  }, [sortedCycles, logCycleNum, logPhase]);

  const metrics = useMemo(
    () => computeAddieProjectMetrics(project, cycleScope),
    [project, cycleScope]
  );

  // Full-project metrics for cross-cycle chart even when ledger/phase bars are scoped
  const allCycleMetrics = useMemo(
    () => computeAddieProjectMetrics(project, 'all'),
    [project]
  );

  const scopedCycles = useMemo(
    () =>
      cycleScope === 'all'
        ? sortedCycles
        : sortedCycles.filter((c) => c.cycleNumber === cycleScope),
    [sortedCycles, cycleScope]
  );

  const filteredCriteria = useMemo(() => {
    return metrics.criteriaRows.filter((row) => {
      if (includedOnly && !row.selected) return false;
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      return true;
    });
  }, [metrics.criteriaRows, includedOnly, statusFilter]);

  const maxPhaseSeconds = Math.max(
    60,
    ...metrics.phaseRows.map((r) => r.totalSeconds)
  );

  const isBrandNewEmpty =
    metrics.totalTrackedSeconds === 0 &&
    metrics.criteriaRows.length === 0 &&
    metrics.cycleSummaries.every((c) => c.phasesCompleted === 0);

  const handleSaveManualTime = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Math.max(0, Math.round(Number(logMinutesInput) || 0));
    onUpdatePhaseSeconds(logCycleNum, logPhase, mins * 60);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleExportMetricsCsv = () => {
    const lines: string[] = [];
    lines.push(
      [
        'Section',
        'Cycle',
        'Phase / Method',
        'Metric / Status',
        'Tracked Minutes',
        'Share %',
        'Success Criterion',
        'Observed Result',
      ]
        .map(csvEscape)
        .join(',')
    );

    metrics.phaseRows.forEach((row) => {
      lines.push(
        [
          'Phase Time',
          cycleScope === 'all' ? 'All' : String(cycleScope),
          pv.phaseShort[row.phase],
          'Tracked',
          String(Math.round(row.totalSeconds / 60)),
          `${row.sharePct}%`,
          '',
          '',
        ]
          .map(csvEscape)
          .join(',')
      );
    });

    allCycleMetrics.cycleSummaries.forEach((cs) => {
      lines.push(
        [
          'Iteration',
          String(cs.cycleNumber),
          cs.solutionTitle || `Cycle ${cs.cycleNumber}`,
          `${cs.phasesCompleted}/5 phases`,
          String(Math.round(cs.totalTrackedSeconds / 60)),
          `${cs.metRatePct}% met`,
          `${cs.metCount}/${cs.selectedCriteriaCount}`,
          cs.nextCycleFocus,
        ]
          .map(csvEscape)
          .join(',')
      );
    });

    metrics.criteriaRows.forEach((cr) => {
      lines.push(
        [
          'Success Criterion',
          String(cr.cycleNumber),
          cr.title,
          t.criterionStatuses[cr.status],
          '',
          cr.selected ? 'Included' : 'Excluded',
          cr.successCriterion,
          cr.measuredResult,
        ]
          .map(csvEscape)
          .join(',')
      );
    });

    const slug = (project.title || 'addie_metrics')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_');
    triggerBlobDownload(
      `addie_visualization_${slug}.csv`,
      '\uFEFF' + lines.join('\n'),
      'text/csv;charset=utf-8'
    );
  };

  // Status select subtle inline tone
  const getStatusSelectTone = (status: AddieCriterionStatus): string => {
    switch (status) {
      case 'met':
        return 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200';
      case 'partial':
        return 'border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200';
      case 'not_met':
        return 'border-rose-300 dark:border-rose-700 bg-rose-50/70 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200';
      default:
        return 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
    }
  };

  // SVG iteration trajectory geometry
  const cyclePoints = allCycleMetrics.cycleSummaries;
  const chartW = Math.max(320, cyclePoints.length * 78 + 44);
  const chartH = 168;
  const padL = 28;
  const padR = 24;
  const padT = 18;
  const padB = 34;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const stepX = cyclePoints.length > 0 ? innerW / cyclePoints.length : innerW;

  const polylinePoints = cyclePoints
    .map((cp, idx) => {
      const cx = padL + stepX * idx + stepX / 2;
      const cy = padT + innerH - (cp.metRatePct / 100) * innerH;
      return `${cx},${cy}`;
    })
    .join(' ');

  return (
    <div className="space-y-5">
      {/* Header & Cycle Scope Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
            {pv.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {pv.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex flex-wrap items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-0.5">
            <button
              type="button"
              onClick={() => setCycleScope('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                cycleScope === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {pv.scopeAll}
            </button>
            {sortedCycles.map((c) => (
              <button
                key={c.cycleNumber}
                type="button"
                onClick={() => setCycleScope(c.cycleNumber)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold tabular-nums transition cursor-pointer whitespace-nowrap shrink-0 ${
                  cycleScope === c.cycleNumber
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {pv.scopeCycle} {c.cycleNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportMetricsCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{pv.exportMetricsCsv}</span>
          </button>

          <button
            type="button"
            onClick={onStartNextCycle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{pv.startNextCycleBtn}</span>
          </button>
        </div>
      </div>

      {/* Empty-State Guidance Banner (only when zero progress recorded yet) */}
      {isBrandNewEmpty && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {pv.emptyTitle}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
              {pv.emptyDesc}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onJumpToCycleStep(project.activeCycleNumber || 1, 'analysis')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {pv.emptyGoAnalysis}
            </button>
            <button
              type="button"
              onClick={() => onJumpToCycleStep(project.activeCycleNumber || 1, 'evaluation')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              {pv.emptyGoEval}
            </button>
          </div>
        </div>
      )}

      {/* 4-Column Top KPI Strip (Single-Elevation, Zero Pill, Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Iterations */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">{pv.kpis.iterations}</span>
            <RotateCw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {metrics.totalIterationsCreated}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              / {metrics.plannedIterationsTarget} {pv.kpis.iterationsSubPlanned}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums border-t border-slate-100 dark:border-slate-800 pt-2.5">
            {metrics.avgPhasesCompleted}/5 {pv.kpis.iterationsAvgPhases}
          </p>
        </div>

        {/* KPI 2: Total Time Across Phases */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">{pv.kpis.totalTime}</span>
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {formatDurationSeconds(metrics.totalTrackedSeconds)}
            </span>
            {metrics.totalPlannedDevMinutes > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                ({formatMinutesCompact(metrics.totalPlannedDevMinutes)} est.)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate border-t border-slate-100 dark:border-slate-800 pt-2.5">
            {metrics.dominantPhase && metrics.dominantPhaseSeconds > 0
              ? `${pv.kpis.totalTimeHighest} ${pv.phaseShort[metrics.dominantPhase]} (${formatDurationSeconds(metrics.dominantPhaseSeconds)})`
              : pv.kpis.totalTimeNone}
          </p>
        </div>

        {/* KPI 3: Success Criteria Met */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">{pv.kpis.criteriaMet}</span>
            <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {metrics.criteriaTotals.met}/{metrics.criteriaTotals.selectedCount}
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              ({metrics.criteriaTotals.metRatePct}%)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate border-t border-slate-100 dark:border-slate-800 pt-2.5">
            {metrics.criteriaTotals.selectedCount > 0
              ? `${metrics.criteriaTotals.partial} ${t.criterionStatuses.partial} · ${metrics.criteriaTotals.notMet} ${t.criterionStatuses.not_met} · ${metrics.criteriaTotals.pending} ${t.criterionStatuses.pending}`
              : pv.kpis.criteriaNoneSelected}
          </p>
        </div>

        {/* KPI 4: Project Lifespan */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">{pv.kpis.lifespan}</span>
            <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
              {metrics.lifespanDays}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {pv.kpis.lifespanDaysUnit} · {metrics.totalDevSteps} {pv.kpis.lifespanStepsUnit}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate border-t border-slate-100 dark:border-slate-800 pt-2.5">
            {formatShortDate(metrics.lifespanStartIso, language)} –{' '}
            {formatShortDate(metrics.lifespanEndIso, language)}
          </p>
        </div>
      </div>

      {/* Main Analytics Grid: Phase Time Distribution (7 cols) + Iteration Trajectory (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left: Time Spent per ADDIE Phase */}
        <div className="xl:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {pv.phaseChartTitle}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {pv.phaseChartDesc}
                </p>
              </div>
              {metrics.totalPlannedDevMinutes > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {pv.plannedRefLabel}{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {formatMinutesCompact(metrics.totalPlannedDevMinutes)}
                  </strong>
                </span>
              )}
            </div>

            {/* Cycle Color Key when multiple cycles */}
            {scopedCycles.length > 1 && (
              <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-slate-600 dark:text-slate-400">
                {scopedCycles.map((c, idx) => (
                  <span key={c.cycleNumber} className="inline-flex items-center gap-1.5 tabular-nums">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{
                        backgroundColor: CYCLE_SERIES_COLORS[idx % CYCLE_SERIES_COLORS.length],
                      }}
                    />
                    <span>
                      {pv.scopeCycle} {c.cycleNumber}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Horizontal Stacked Bars per ADDIE Phase */}
            <div className="space-y-3.5">
              {metrics.phaseRows.map((row) => {
                return (
                  <div key={row.phase} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          onJumpToCycleStep(
                            cycleScope === 'all'
                              ? project.activeCycleNumber || 1
                              : cycleScope,
                            row.phase
                          )
                        }
                        className="font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer text-left truncate"
                      >
                        {pv.phaseShort[row.phase]}
                      </button>
                      <div className="flex items-center gap-3 tabular-nums shrink-0">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatDurationSeconds(row.totalSeconds)}
                        </span>
                        <span className="w-9 text-right text-slate-500 dark:text-slate-400">
                          {row.sharePct}%
                        </span>
                      </div>
                    </div>

                    {/* Stacked Track */}
                    <div className="h-3 w-full rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      {row.totalSeconds > 0 &&
                        scopedCycles.map((c, idx) => {
                          const segSeconds = row.perCycleSeconds[c.cycleNumber] || 0;
                          if (segSeconds <= 0) return null;
                          const widthPct = Math.max(
                            2,
                            (segSeconds / maxPhaseSeconds) * 100
                          );
                          return (
                            <div
                              key={c.cycleNumber}
                              title={`${pv.scopeCycle} ${c.cycleNumber} · ${pv.phaseShort[row.phase]}: ${formatDurationSeconds(segSeconds)}`}
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor:
                                  CYCLE_SERIES_COLORS[idx % CYCLE_SERIES_COLORS.length],
                              }}
                              className="h-full transition-all border-r border-white/40 dark:border-slate-900/40 last:border-r-0"
                            />
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inline Manual Time Logger / Adjustment */}
          <form
            onSubmit={handleSaveManualTime}
            className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-2.5"
          >
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                {pv.timeLoggerCycleLabel}
              </label>
              <select
                value={logCycleNum}
                onChange={(e) => setLogCycleNum(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white tabular-nums"
              >
                {sortedCycles.map((c) => (
                  <option key={c.cycleNumber} value={c.cycleNumber}>
                    {pv.scopeCycle} {c.cycleNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                {pv.timeLoggerPhaseLabel}
              </label>
              <select
                value={logPhase}
                onChange={(e) => setLogPhase(e.target.value as AddiePhaseKey)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              >
                {ADDIE_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {pv.phaseShort[phase]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 w-24">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                {pv.timeLoggerMinutesLabel}
              </label>
              <input
                type="number"
                min={0}
                max={9999}
                value={logMinutesInput}
                onChange={(e) => setLogMinutesInput(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white tabular-nums"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 h-[30px]"
            >
              {savedNotice ? <Check className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              <span>{savedNotice ? pv.timeLoggerSaved : pv.timeLoggerSaveBtn}</span>
            </button>
          </form>
        </div>

        {/* Right: Iterations & Success Criteria Trajectory SVG + Cycle Breakdown */}
        <div className="xl:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {pv.iterationsChartTitle}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {pv.iterationsChartDesc}
            </p>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/30 border border-indigo-500" />
                <span>{pv.completedPhasesLegend} (0–5)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 inline-block" />
                <span>{pv.metRateLegend}</span>
              </span>
            </div>

            {/* Responsive SVG Progression Chart */}
            <div className="mt-3 overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full min-w-[280px] h-44 select-none"
                role="img"
                aria-label={pv.iterationsChartTitle}
              >
                {/* Horizontal gridlines at 0%, 50%, 100% */}
                {[0, 50, 100].map((pct) => {
                  const y = padT + innerH - (pct / 100) * innerH;
                  return (
                    <g key={pct}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={chartW - padR}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-200 dark:text-slate-800"
                        strokeDasharray={pct === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={padL - 5}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono"
                      >
                        {pct}%
                      </text>
                    </g>
                  );
                })}

                {/* Per-cycle bars (ADDIE phases completed out of 5) */}
                {cyclePoints.map((cp, idx) => {
                  const barW = Math.min(34, Math.max(18, stepX * 0.45));
                  const cx = padL + stepX * idx + stepX / 2;
                  const phasePct = cp.phasesCompleted / 5;
                  const barH = Math.max(2, phasePct * innerH);
                  const barY = padT + innerH - barH;
                  const selectedCycleHighlight = cycleScope === cp.cycleNumber;
                  return (
                    <g key={cp.cycleNumber}>
                      <rect
                        x={cx - barW / 2}
                        y={barY}
                        width={barW}
                        height={barH}
                        rx={4}
                        fill={selectedCycleHighlight ? '#4f46e5' : '#6366f1'}
                        fillOpacity={selectedCycleHighlight ? 0.35 : 0.2}
                        stroke={selectedCycleHighlight ? '#4f46e5' : '#6366f1'}
                        strokeWidth={selectedCycleHighlight ? 1.5 : 1}
                      />
                      <text
                        x={cx}
                        y={chartH - 12}
                        textAnchor="middle"
                        className="fill-slate-700 dark:fill-slate-300 text-[10px] font-bold font-mono"
                      >
                        C{cp.cycleNumber}
                      </text>
                      <text
                        x={cx}
                        y={chartH - 2}
                        textAnchor="middle"
                        className="fill-slate-400 dark:fill-slate-500 text-[9px] font-mono"
                      >
                        {cp.phasesCompleted}/5
                      </text>
                    </g>
                  );
                })}

                {/* Line overlay for % criteria met */}
                {cyclePoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylinePoints}
                  />
                )}

                {cyclePoints.map((cp, idx) => {
                  const cx = padL + stepX * idx + stepX / 2;
                  const cy = padT + innerH - (cp.metRatePct / 100) * innerH;
                  return (
                    <g key={`pt-${cp.cycleNumber}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={cx}
                        y={Math.max(11, cy - 8)}
                        textAnchor="middle"
                        className="fill-emerald-700 dark:fill-emerald-400 text-[9px] font-bold font-mono"
                      >
                        {cp.metRatePct}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Compact Per-Cycle Comparison List */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {allCycleMetrics.cycleSummaries.map((cs, idx) => (
              <div
                key={cs.cycleNumber}
                className="py-2 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{
                      backgroundColor:
                        CYCLE_SERIES_COLORS[idx % CYCLE_SERIES_COLORS.length],
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onJumpToCycleStep(cs.cycleNumber, 'analysis')}
                    className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 tabular-nums cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {pv.scopeCycle} {cs.cycleNumber}
                  </button>
                  <span className="text-slate-500 dark:text-slate-400 truncate">
                    {cs.solutionTitle || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3 tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                  <span>{cs.phasesCompleted}/5</span>
                  <span>{formatDurationSeconds(cs.totalTrackedSeconds)}</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {cs.metCount}/{cs.selectedCriteriaCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Section: Project-Lifespan Success Criteria Ledger */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">
              {pv.criteriaLedgerTitle}
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {pv.criteriaLedgerDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={includedOnly}
                onChange={(e) => setIncludedOnly(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600 rounded"
              />
              <span>{pv.includeOnlyLabel}</span>
            </label>

            <div className="inline-flex flex-wrap items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-0.5">
              {(
                ['all', 'met', 'partial', 'not_met', 'pending'] as Array<
                  'all' | AddieCriterionStatus
                >
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {st === 'all' ? pv.filterAll : t.criterionStatuses[st]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredCriteria.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pv.noMatchingCriteria}
            </p>
            <button
              type="button"
              onClick={() =>
                onJumpToCycleStep(
                  cycleScope === 'all' ? project.activeCycleNumber || 1 : cycleScope,
                  'evaluation'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer whitespace-nowrap"
            >
              <span>{pv.emptyGoEval}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="py-2.5 px-4 whitespace-nowrap">{pv.colCycle}</th>
                  <th className="py-2.5 px-4 min-w-[180px]">{pv.colMethod}</th>
                  <th className="py-2.5 px-4 min-w-[200px]">{pv.colCriterion}</th>
                  <th className="py-2.5 px-4 min-w-[210px]">{pv.colResult}</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">{pv.colStatus}</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">{pv.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCriteria.map((item) => (
                  <tr
                    key={`${item.cycleNumber}-${item.methodId}`}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3 px-4 align-top tabular-nums font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      C{item.cycleNumber}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {item.title || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.methodType || '—'}
                        {item.targetMetric ? ` · ${item.targetMetric}` : ''}
                        {!item.selected ? ` · ${pv.excludedBadge}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 align-top text-slate-700 dark:text-slate-300 leading-relaxed">
                      {item.successCriterion || '—'}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <input
                        type="text"
                        value={item.measuredResult}
                        onChange={(e) =>
                          onUpdateCriterion(item.cycleNumber, item.methodId, {
                            measuredResult: e.target.value,
                          })
                        }
                        placeholder={t.measuredResultPlaceholder}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </td>
                    <td className="py-3 px-4 align-top">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          onUpdateCriterion(item.cycleNumber, item.methodId, {
                            criterionStatus: e.target.value as AddieCriterionStatus,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${getStatusSelectTone(item.status)}`}
                      >
                        <option value="pending">{t.criterionStatuses.pending}</option>
                        <option value="met">{t.criterionStatuses.met}</option>
                        <option value="partial">{t.criterionStatuses.partial}</option>
                        <option value="not_met">{t.criterionStatuses.not_met}</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onJumpToCycleStep(item.cycleNumber, 'evaluation')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer whitespace-nowrap"
                      >
                        <span>{pv.openInEvalBtn}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
