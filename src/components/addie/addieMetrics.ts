import {
  AddieCriterionStatus,
  AddieCycle,
  AddieEvaluationMethod,
  AddiePhaseKey,
  AddieProject,
} from '../../types';
import { getAddieStepCompletion } from './addieHelpers';

export const ADDIE_PHASES: AddiePhaseKey[] = [
  'analysis',
  'design',
  'development',
  'implementation',
  'evaluation',
];

export interface PhaseAggregateRow {
  phase: AddiePhaseKey;
  totalSeconds: number;
  sharePct: number;
  perCycleSeconds: Record<number, number>;
  cyclesWithTime: number;
}

export interface CycleIterationSummary {
  cycleNumber: number;
  createdAt: string;
  updatedAt: string;
  deliverableMode: 'digital_object' | 'classic_lesson';
  phasesCompleted: number;
  totalTrackedSeconds: number;
  plannedDevMinutes: number;
  devStepsCount: number;
  selectedCriteriaCount: number;
  totalCriteriaCount: number;
  metCount: number;
  partialCount: number;
  notMetCount: number;
  pendingCount: number;
  metRatePct: number;
  solutionTitle: string;
  nextCycleFocus: string;
}

export interface FlattenedCriterionItem {
  cycleNumber: number;
  methodId: string;
  title: string;
  methodType: string;
  targetMetric: string;
  successCriterion: string;
  embeddedFeature: string;
  selected: boolean;
  status: AddieCriterionStatus;
  measuredResult: string;
}

export interface AddieProjectMetrics {
  totalIterationsCreated: number;
  plannedIterationsTarget: number;
  avgPhasesCompleted: number;
  totalTrackedSeconds: number;
  totalPlannedDevMinutes: number;
  dominantPhase: AddiePhaseKey | null;
  dominantPhaseSeconds: number;
  phaseRows: PhaseAggregateRow[];
  cycleSummaries: CycleIterationSummary[];
  criteriaRows: FlattenedCriterionItem[];
  criteriaTotals: {
    selectedCount: number;
    allCount: number;
    met: number;
    partial: number;
    notMet: number;
    pending: number;
    metRatePct: number;
  };
  lifespanStartIso: string;
  lifespanEndIso: string;
  lifespanDays: number;
  totalDevSteps: number;
}

/**
 * Parses human-written duration strings such as "2h", "1.5 hod", "45 min", "30m", or "1d"
 * into minutes for secondary planned-effort reference. Returns 0 when unparseable.
 */
export function parseDurationToMinutes(raw: string): number {
  if (!raw || !raw.trim()) return 0;
  const normalized = raw.toLowerCase().replace(',', '.').trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([a-záčďéěíňóřšťúůýž.]*)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = (match[2] || '').replace(/\./g, '');

  if (
    unit.startsWith('d') || // day, d, den, dny, dni
    unit.startsWith('t') // tyden? rare, fallback below
  ) {
    if (unit.startsWith('d')) return Math.round(value * 8 * 60);
  }
  if (unit.startsWith('h') || unit.startsWith('g')) {
    // h, hr, hrs, hod, godz
    return Math.round(value * 60);
  }
  if (unit.startsWith('s')) {
    return Math.round(value / 60);
  }
  // Default or "m" / "min" / "minut"
  return Math.round(value);
}

export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe === 0) return '0m';
  if (safe < 60) return `<1m`;
  const totalMinutes = Math.floor(safe / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatMinutesCompact(totalMinutes: number): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  if (safe === 0) return '0m';
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function getCyclePhaseSeconds(cycle: AddieCycle, phase: AddiePhaseKey): number {
  const val = cycle.phaseTimeSeconds?.[phase];
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : 0;
}

export function getCriterionStatus(method: AddieEvaluationMethod): AddieCriterionStatus {
  return method.criterionStatus || 'pending';
}

export function computeAddieProjectMetrics(
  project: AddieProject,
  cycleFilter: number | 'all' = 'all'
): AddieProjectMetrics {
  const sortedCycles = [...(project.cycles || [])].sort(
    (a, b) => a.cycleNumber - b.cycleNumber
  );
  const scopedCycles =
    cycleFilter === 'all'
      ? sortedCycles
      : sortedCycles.filter((c) => c.cycleNumber === cycleFilter);

  const plannedIterationsTarget = Math.max(
    sortedCycles.length,
    ...sortedCycles.map((c) => c.analysis?.plannedCycles || 1)
  );

  // Per-phase aggregation across scoped cycles
  const phaseTotals: Record<AddiePhaseKey, number> = {
    analysis: 0,
    design: 0,
    development: 0,
    implementation: 0,
    evaluation: 0,
  };
  const phaseCycleCount: Record<AddiePhaseKey, number> = {
    analysis: 0,
    design: 0,
    development: 0,
    implementation: 0,
    evaluation: 0,
  };
  const phasePerCycle: Record<AddiePhaseKey, Record<number, number>> = {
    analysis: {},
    design: {},
    development: {},
    implementation: {},
    evaluation: {},
  };

  let totalTrackedSeconds = 0;
  let totalPlannedDevMinutes = 0;
  let totalDevSteps = 0;

  const cycleSummaries: CycleIterationSummary[] = [];
  const criteriaRows: FlattenedCriterionItem[] = [];

  for (const cycle of scopedCycles) {
    const completion = getAddieStepCompletion(cycle, project);
    const phasesCompleted = ADDIE_PHASES.filter((p) => completion[p]).length;

    let cycleTrackedSeconds = 0;
    for (const phase of ADDIE_PHASES) {
      const secs = getCyclePhaseSeconds(cycle, phase);
      phaseTotals[phase] += secs;
      phasePerCycle[phase][cycle.cycleNumber] = secs;
      if (secs > 0) phaseCycleCount[phase] += 1;
      cycleTrackedSeconds += secs;
    }
    totalTrackedSeconds += cycleTrackedSeconds;

    const devSteps = cycle.development?.steps || [];
    totalDevSteps += devSteps.length;
    const plannedDevMinutes = devSteps.reduce(
      (sum, step) => sum + parseDurationToMinutes(step.duration || ''),
      0
    );
    totalPlannedDevMinutes += plannedDevMinutes;

    const allMethods = cycle.evaluation?.methods || [];
    const selectedMethods = allMethods.filter((m) => m.selected);

    let metCount = 0;
    let partialCount = 0;
    let notMetCount = 0;
    let pendingCount = 0;

    for (const m of selectedMethods) {
      const st = getCriterionStatus(m);
      if (st === 'met') metCount += 1;
      else if (st === 'partial') partialCount += 1;
      else if (st === 'not_met') notMetCount += 1;
      else pendingCount += 1;
    }

    for (const m of allMethods) {
      criteriaRows.push({
        cycleNumber: cycle.cycleNumber,
        methodId: m.id,
        title: m.title,
        methodType: m.methodType,
        targetMetric: m.targetMetric,
        successCriterion: m.successCriterion,
        embeddedFeature: m.embeddedFeature || '',
        selected: Boolean(m.selected),
        status: getCriterionStatus(m),
        measuredResult: m.measuredResult || '',
      });
    }

    const metRatePct =
      selectedMethods.length > 0 ? Math.round((metCount / selectedMethods.length) * 100) : 0;

    cycleSummaries.push({
      cycleNumber: cycle.cycleNumber,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
      deliverableMode: cycle.implementation?.deliverableMode || 'digital_object',
      phasesCompleted,
      totalTrackedSeconds: cycleTrackedSeconds,
      plannedDevMinutes,
      devStepsCount: devSteps.length,
      selectedCriteriaCount: selectedMethods.length,
      totalCriteriaCount: allMethods.length,
      metCount,
      partialCount,
      notMetCount,
      pendingCount,
      metRatePct,
      solutionTitle: cycle.design?.editedSolution?.title || '',
      nextCycleFocus: cycle.evaluation?.nextCycleFocus || '',
    });
  }

  let dominantPhase: AddiePhaseKey | null = null;
  let dominantPhaseSeconds = 0;
  const phaseRows: PhaseAggregateRow[] = ADDIE_PHASES.map((phase) => {
    const secs = phaseTotals[phase];
    if (secs > dominantPhaseSeconds) {
      dominantPhaseSeconds = secs;
      dominantPhase = phase;
    }
    return {
      phase,
      totalSeconds: secs,
      sharePct: totalTrackedSeconds > 0 ? Math.round((secs / totalTrackedSeconds) * 100) : 0,
      perCycleSeconds: phasePerCycle[phase],
      cyclesWithTime: phaseCycleCount[phase],
    };
  });

  const selectedRows = criteriaRows.filter((r) => r.selected);
  const met = selectedRows.filter((r) => r.status === 'met').length;
  const partial = selectedRows.filter((r) => r.status === 'partial').length;
  const notMet = selectedRows.filter((r) => r.status === 'not_met').length;
  const pending = selectedRows.filter((r) => r.status === 'pending').length;
  const metRatePct = selectedRows.length > 0 ? Math.round((met / selectedRows.length) * 100) : 0;

  const avgPhasesCompleted =
    cycleSummaries.length > 0
      ? Number(
          (
            cycleSummaries.reduce((acc, s) => acc + s.phasesCompleted, 0) / cycleSummaries.length
          ).toFixed(1)
        )
      : 0;

  // Lifespan dates across entire project
  const timestamps = [
    project.createdAt,
    project.updatedAt,
    ...sortedCycles.flatMap((c) => [c.createdAt, c.updatedAt]),
  ]
    .map((iso) => new Date(iso).getTime())
    .filter((t) => Number.isFinite(t));

  const startMs = timestamps.length > 0 ? Math.min(...timestamps) : Date.now();
  const endMs = timestamps.length > 0 ? Math.max(...timestamps) : startMs;
  const lifespanDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)) || 1);

  return {
    totalIterationsCreated: sortedCycles.length,
    plannedIterationsTarget,
    avgPhasesCompleted,
    totalTrackedSeconds,
    totalPlannedDevMinutes,
    dominantPhase,
    dominantPhaseSeconds,
    phaseRows,
    cycleSummaries,
    criteriaRows,
    criteriaTotals: {
      selectedCount: selectedRows.length,
      allCount: criteriaRows.length,
      met,
      partial,
      notMet,
      pending,
      metRatePct,
    },
    lifespanStartIso: new Date(startMs).toISOString(),
    lifespanEndIso: new Date(endMs).toISOString(),
    lifespanDays,
    totalDevSteps,
  };
}
