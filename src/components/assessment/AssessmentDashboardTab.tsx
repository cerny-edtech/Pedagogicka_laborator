import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileJson,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  CriteriaAssignment,
  CriterionCategory,
  Language,
  Student,
  StudentCriterionEvaluation,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  buildEvaluationCsv,
  computeEvaluationResult,
  getMaxAssignmentPoints,
} from '../../utils/assessmentUtils';
import { triggerBlobDownload } from '../../utils/clipboard';
import { createRealGoogleSheet } from '../../services/googleDocsService';

interface AssessmentDashboardTabProps {
  assignment: CriteriaAssignment;
  students: Student[];
  evaluations: StudentCriterionEvaluation[];
  selectedStudentId: string;
  onSelectStudentId: (id: string) => void;
  language: Language;
  googleConnected: boolean;
  onRequireGoogleConnect: () => Promise<boolean>;
  onPrintDashboard: () => void;
}

export const AssessmentDashboardTab: React.FC<AssessmentDashboardTabProps> = ({
  assignment,
  students,
  evaluations,
  selectedStudentId,
  onSelectStudentId,
  language,
  googleConnected,
  onRequireGoogleConnect,
  onPrintDashboard,
}) => {
  const t = translations[language].assessment;
  const ts = translations[language].seating;

  const [categoryFilter, setCategoryFilter] = useState<'all' | CriterionCategory>('all');
  const [selectedCriterionIds, setSelectedCriterionIds] = useState<string[]>([]);
  const [showCumulativeCard, setShowCumulativeCard] = useState<boolean>(true);
  const [cumulativeViewMode, setCumulativeViewMode] = useState<'cumulative_grades' | 'all_students'>('cumulative_grades');
  const [hoveredGrade, setHoveredGrade] = useState<number | null>(null);
  const [hoveredStudentId, setHoveredStudentId] = useState<string | null>(null);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [sheetsStatus, setSheetsStatus] = useState<{ type: 'ok' | 'err'; msg: string; url?: string } | null>(null);

  useEffect(() => {
    setSelectedCriterionIds([]);
    setHoveredGrade(null);
    setHoveredStudentId(null);
    setSheetsStatus(null);
  }, [assignment.id]);

  const uiText = useMemo(() => {
    if (language === 'en') {
      return {
        subtitle: 'Point distributions per criterion, overall class score, and selected student standing.',
        overallHistogramTitle: 'Class Total Score Histogram (%)',
        overallHistogramSubtitle: 'Number of students in each percentage bracket',
        gradeDistSubtitle: 'Includes automatic grade 5 triggered by 0 points in a criterion',
        zeroVetoCountLabel: 'zero veto',
        compareSubtitle: 'Select a student and filter categories to compare performance against the class average.',
        filterAll: 'All',
        filterFormal: 'Formal',
        filterContent: 'Content',
        selectedCriteriaLabel: 'Selected categories/criteria:',
        showAllBtn: 'Show all',
        vsClass: 'vs. class',
        perCritTitle: 'Point Distribution (0–3) by Criterion',
        perCritSubtitle: 'Histogram for each selected criterion. The highlighted bar marks the selected student.',
        avgLabel: 'Average',
        openSheetLink: 'Open Google Sheet',
        sheetsOkMsg: 'Class results saved directly to a new Google Sheet.',
        sheetsErrMsg: 'Failed to save data to Google Sheets.',
        sheetDocPrefix: 'Class Assessment',
        sheetTabName: 'Class Results',
        ungraded: 'Not graded',
        yesLabel: 'YES',
        noLabel: 'NO',
        gradeShort: 'Gr.',
        cumulativeToggleBtn: 'Cumulative Histogram',
        cumulativeCardTitle: 'Cumulative Class Grade Histogram',
        cumulativeCardSubtitle: 'Unified view of all graded students showing per-grade frequency alongside cumulative class share (1 → 5).',
        cumulativeModeGrades: 'Cumulative Grades (1–5)',
        cumulativeModeStudents: 'All Students Combined',
        cumulativeLegendBar: 'Students in grade',
        cumulativeLegendLine: 'Cumulative class share (%)',
        passingBoundaryLabel: 'Passing (Grades 1–4)',
        cumulativeShort: 'Cum.',
        studentsUnit: 'students',
        hoverGradeHint: 'Click or hover a grade column to see matching students',
        allStudentsSortedHint: 'Sorted by score descending · Click a bar to compare student below',
        passThresholdLine: 'Pass threshold',
      };
    }
    if (language === 'pl') {
      return {
        subtitle: 'Rozkład punktów w każdym kryterium, wynik ogólny klasy i pozycja wybranego ucznia.',
        overallHistogramTitle: 'Histogram wyniku ogólnego klasy (%)',
        overallHistogramSubtitle: 'Liczba uczniów w poszczególnych przedziałach procentowych',
        gradeDistSubtitle: 'Zawiera oceny 5 przyznane automatycznie przy 0 pkt w kryterium',
        zeroVetoCountLabel: 'weto 0 pkt',
        compareSubtitle: 'Wybierz ucznia i filtruj kategorie, aby porównać jego wynik ze średnią klasy.',
        filterAll: 'Wszystkie',
        filterFormal: 'Formalne',
        filterContent: 'Merytoryczne',
        selectedCriteriaLabel: 'Wybrane kategorie/kryteria:',
        showAllBtn: 'Pokaż wszystkie',
        vsClass: 'vs klasa',
        perCritTitle: 'Rozkład punktów (0–3) dla poszczególnych kryteriów',
        perCritSubtitle: 'Histogram dla każdego wybranego kryterium. Wyróżniony słupek oznacza wybranego ucznia.',
        avgLabel: 'Średnia',
        openSheetLink: 'Otwórz Arkusz Google',
        sheetsOkMsg: 'Dane całej klasy zostały zapisane bezpośrednio w nowym Arkuszu Google.',
        sheetsErrMsg: 'Nie udało się zapisać danych w Arkuszach Google.',
        sheetDocPrefix: 'Ocena klasy',
        sheetTabName: 'Wyniki klasy',
        ungraded: 'Nieoceniony',
        yesLabel: 'TAK',
        noLabel: 'NIE',
        gradeShort: 'Oc.',
        cumulativeToggleBtn: 'Histogram kumulatywny',
        cumulativeCardTitle: 'Kumulatywny histogram ocen wszystkich uczniów',
        cumulativeCardSubtitle: 'Jedna karta prezentująca liczbę uczniów na każdej ocenie (1–5) wraz z krzywą skumulowanego udziału klasy.',
        cumulativeModeGrades: 'Kumulatywne oceny (1–5)',
        cumulativeModeStudents: 'Wszyscy uczniowie razem',
        cumulativeLegendBar: 'Liczba uczniów (ocena)',
        cumulativeLegendLine: 'Udział skumulowany (%)',
        passingBoundaryLabel: 'Zaliczone (oceny 1–4)',
        cumulativeShort: 'Skum.',
        studentsUnit: 'ucz.',
        hoverGradeHint: 'Najedź lub kliknij kolumnę oceny, aby zobaczyć listę uczniów',
        allStudentsSortedHint: 'Posortowano malejąco wg wyniku · Kliknij słupek, aby porównać ucznia poniżej',
        passThresholdLine: 'Próg zaliczenia',
      };
    }
    return {
      subtitle: 'Rozložení bodů za každé kritérium, celkové skóre třídy a srovnání pozice vybraného studenta.',
      overallHistogramTitle: 'Histogram celkového skóre třídy (%)',
      overallHistogramSubtitle: 'Počet studentů v jednotlivých procentních pásmech',
      gradeDistSubtitle: 'Včetně známek 5 udělených při 0 bodech v kritériu',
      zeroVetoCountLabel: 'veto 0 b.',
      compareSubtitle: 'Vyberte studenta a filtrujte kategorie pro porovnání jeho výkonu s průměrem třídy.',
      filterAll: 'Všechny',
      filterFormal: 'Formální',
      filterContent: 'Obsahové',
      selectedCriteriaLabel: 'Vybrané kategorie/kritéria:',
      showAllBtn: 'Zobrazit vše',
      vsClass: 'vs. třída',
      perCritTitle: 'Rozložení bodů (0–3) za jednotlivá kritéria',
      perCritSubtitle: 'Histogram pro každé vybrané kritérium. Orámovaný sloupec označuje úroveň aktuálně zvoleného studenta.',
      avgLabel: 'Průměr',
      openSheetLink: 'Otevřít Google Tabulku',
      sheetsOkMsg: 'Data za celou třídu byla přímo uložena do nové Google Tabulky.',
      sheetsErrMsg: 'Nepodařilo se uložit data do Google Tabulek.',
      sheetDocPrefix: 'Hodnocení třídy',
      sheetTabName: 'Výsledky třídy',
      ungraded: 'Nehodnoceno',
      yesLabel: 'ANO',
      noLabel: 'NE',
      gradeShort: 'Zn.',
      cumulativeToggleBtn: 'Kumulativní histogram',
      cumulativeCardTitle: 'Kumulativní histogram všech studentů',
      cumulativeCardSubtitle: 'Přehled rozložení známek celé třídy (1–5) s kumulativním součtem a procentem úspěšných studentů v jedné kartě.',
      cumulativeModeGrades: 'Kumulativní známky (1–5)',
      cumulativeModeStudents: 'Všichni studenti v jednom grafu',
      cumulativeLegendBar: 'Počet studentů se známkou',
      cumulativeLegendLine: 'Kumulativní podíl třídy (%)',
      passingBoundaryLabel: 'Úspěšní (známky 1–4)',
      cumulativeShort: 'Kum.',
      studentsUnit: 'žáků',
      hoverGradeHint: 'Najeďte nebo klikněte na sloupec známky pro zobrazení jmen studentů',
      allStudentsSortedHint: 'Seřazeno od nejvyšší úspěšnosti · Kliknutím na sloupec studenta porovnáte níže',
      passThresholdLine: 'Hranice úspěchu',
    };
  }, [language]);

  const assignmentEvals = useMemo(
    () => evaluations.filter((e) => e.assignmentId === assignment.id),
    [evaluations, assignment.id]
  );

  const evalMap = useMemo(
    () => new Map(assignmentEvals.map((e) => [e.studentId, e])),
    [assignmentEvals]
  );

  const evaluatedRows = useMemo(() => {
    return students
      .map((student) => {
        const ev = evalMap.get(student.id);
        if (!ev || Object.keys(ev.scores).length === 0) return null;
        return {
          student,
          evaluation: ev,
          result: computeEvaluationResult(assignment, ev.scores),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [students, evalMap, assignment]);

  const maxPoints = getMaxAssignmentPoints(assignment.criteria);

  // Class KPI stats
  const classStats = useMemo(() => {
    if (evaluatedRows.length === 0) {
      return {
        count: 0,
        avgPct: 0,
        avgGrade: 0,
        passRate: 0,
        zeroVetoCount: 0,
        formalAvgPct: 0,
        contentAvgPct: 0,
      };
    }
    const count = evaluatedRows.length;
    const avgPct =
      Math.round(
        (evaluatedRows.reduce((acc, r) => acc + r.result.percentage, 0) / count) * 10
      ) / 10;
    const avgGrade =
      Math.round((evaluatedRows.reduce((acc, r) => acc + r.result.grade, 0) / count) * 100) / 100;
    const passCount = evaluatedRows.filter((r) => r.result.passed).length;
    const zeroVetoCount = evaluatedRows.filter((r) => r.result.hasZeroVeto).length;
    const formalAvgPct =
      evaluatedRows[0].result.formalMax > 0
        ? Math.round(
            (evaluatedRows.reduce(
              (acc, r) => acc + (r.result.formalPoints / r.result.formalMax) * 100,
              0
            ) /
              count) *
              10
          ) / 10
        : 0;
    const contentAvgPct =
      evaluatedRows[0].result.contentMax > 0
        ? Math.round(
            (evaluatedRows.reduce(
              (acc, r) => acc + (r.result.contentPoints / r.result.contentMax) * 100,
              0
            ) /
              count) *
              10
          ) / 10
        : 0;

    return {
      count,
      avgPct,
      avgGrade,
      passRate: Math.round((passCount / count) * 100),
      zeroVetoCount,
      formalAvgPct,
      contentAvgPct,
    };
  }, [evaluatedRows]);

  // Total Score % Histogram (5 bins: <60%, 60-69%, 70-79%, 80-89%, 90-100%)
  const totalHistogram = useMemo(() => {
    const bins = [
      { label: '0–59 %', min: 0, max: 59.99, count: 0, tone: 'bg-rose-500' },
      { label: '60–69 %', min: 60, max: 69.99, count: 0, tone: 'bg-amber-500' },
      { label: '70–79 %', min: 70, max: 79.99, count: 0, tone: 'bg-sky-500' },
      { label: '80–89 %', min: 80, max: 89.99, count: 0, tone: 'bg-indigo-500' },
      { label: '90–100 %', min: 90, max: 100.01, count: 0, tone: 'bg-emerald-500' },
    ];
    for (const r of evaluatedRows) {
      const bin = bins.find((b) => r.result.percentage >= b.min && r.result.percentage <= b.max);
      if (bin) bin.count += 1;
    }
    const peak = Math.max(1, ...bins.map((b) => b.count));
    return { bins, peak };
  }, [evaluatedRows]);

  // Grade 1-5 counts & cumulative class breakdown
  const gradeCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const byGrade: Record<number, typeof evaluatedRows> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const r of evaluatedRows) {
      counts[r.result.grade] = (counts[r.result.grade] || 0) + 1;
      byGrade[r.result.grade]?.push(r);
    }
    const peak = Math.max(1, ...Object.values(counts));
    const total = evaluatedRows.length;

    let running = 0;
    const cumulative = [1, 2, 3, 4, 5].map((grade) => {
      const count = counts[grade] || 0;
      running += count;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const cumPct = total > 0 ? Math.round((running / total) * 100) : 0;
      return {
        grade,
        count,
        pct,
        cumCount: running,
        cumPct,
        studentsInGrade: byGrade[grade] || [],
      };
    });

    const sortedStudents = [...evaluatedRows].sort(
      (a, b) => a.result.grade - b.result.grade || b.result.percentage - a.result.percentage
    );

    return { counts, peak, cumulative, sortedStudents };
  }, [evaluatedRows]);

  // Selected student details for comparison
  const activeComparison = useMemo(() => {
    const target =
      evaluatedRows.find((r) => r.student.id === selectedStudentId) || evaluatedRows[0] || null;
    if (!target) return null;
    const formalPct =
      target.result.formalMax > 0
        ? Math.round((target.result.formalPoints / target.result.formalMax) * 1000) / 10
        : 0;
    const contentPct =
      target.result.contentMax > 0
        ? Math.round((target.result.contentPoints / target.result.contentMax) * 1000) / 10
        : 0;
    return {
      ...target,
      formalPct,
      contentPct,
    };
  }, [evaluatedRows, selectedStudentId]);

  const visibleCriteria = useMemo(() => {
    const byCategory =
      categoryFilter === 'all'
        ? assignment.criteria
        : assignment.criteria.filter((c) => c.category === categoryFilter);
    if (selectedCriterionIds.length === 0) return byCategory;
    return byCategory.filter((c) => selectedCriterionIds.includes(c.id));
  }, [assignment.criteria, categoryFilter, selectedCriterionIds]);

  const toggleCriterionPick = (id: string) => {
    setSelectedCriterionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Export CSV
  const handleDownloadCsv = () => {
    const csv = buildEvaluationCsv(assignment, students, assignmentEvals, language);
    triggerBlobDownload(
      `assessment_${assignment.title.replace(/\s+/g, '_').toLowerCase()}.csv`,
      csv,
      'text/csv;charset=utf-8;'
    );
  };

  // Export JSON
  const handleDownloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      assignment,
      classStats,
      studentEvaluations: students.map((s) => {
        const ev = evalMap.get(s.id);
        const res = ev ? computeEvaluationResult(assignment, ev.scores) : null;
        return {
          student: { id: s.id, firstName: s.firstName, lastName: s.lastName },
          scores: ev?.scores || {},
          criterionNotes: ev?.criterionNotes || {},
          teacherComment: ev?.teacherComment || '',
          aiSummary: ev?.aiSummary || '',
          result: res,
        };
      }),
    };
    triggerBlobDownload(
      `assessment_${assignment.title.replace(/\s+/g, '_').toLowerCase()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    );
  };

  // Export to Google Sheets
  const handleExportGoogleSheets = async () => {
    setExportingSheets(true);
    setSheetsStatus(null);
    try {
      const ok = googleConnected || (await onRequireGoogleConnect());
      if (!ok) {
        setExportingSheets(false);
        return;
      }

      const headerRow: (string | number)[] = [
        ts.lastName,
        ts.firstName,
        ...assignment.criteria.map((c) => `${c.name} (${t.weightLabel} ${c.weight})`),
        t.formalCriteria,
        t.contentCriteria,
        t.pointsRangeCol,
        t.totalMaxPointsLabel,
        t.rangePctCol,
        t.zeroVetoTitle,
        t.gradeCol,
        t.teacherCommentLabel,
        t.studentSummaryHeading,
      ];

      const dataRows: (string | number)[][] = students.map((s) => {
        const ev = evalMap.get(s.id);
        if (!ev || Object.keys(ev.scores).length === 0) {
          return [
            s.lastName,
            s.firstName,
            ...assignment.criteria.map(() => ''),
            '',
            '',
            '',
            maxPoints,
            '',
            '',
            uiText.ungraded,
            '',
            '',
          ];
        }
        const res = computeEvaluationResult(assignment, ev.scores);
        return [
          s.lastName,
          s.firstName,
          ...assignment.criteria.map((c) => (ev.scores[c.id] !== undefined ? ev.scores[c.id] : '')),
          res.formalPoints,
          res.contentPoints,
          res.totalPoints,
          res.maxPoints,
          res.percentage,
          res.hasZeroVeto ? uiText.yesLabel : uiText.noLabel,
          res.grade,
          ev.teacherComment || '',
          ev.aiSummary || '',
        ];
      });

      const { spreadsheetUrl } = await createRealGoogleSheet(
        `${uiText.sheetDocPrefix}: ${assignment.title}`,
        uiText.sheetTabName,
        [headerRow, ...dataRows]
      );

      setSheetsStatus({
        type: 'ok',
        msg: uiText.sheetsOkMsg,
        url: spreadsheetUrl,
      });
    } catch (err: any) {
      setSheetsStatus({
        type: 'err',
        msg: err?.message || uiText.sheetsErrMsg,
      });
    } finally {
      setExportingSheets(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Export & Controls Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            {t.dashTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {uiText.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCumulativeCard((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
              showCumulativeCard
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>{uiText.cumulativeToggleBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleExportGoogleSheets}
            disabled={exportingSheets}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {exportingSheets ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>{t.dashExportSheetsBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-slate-500" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={onPrintDashboard}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t.dashExportPdfBtn}</span>
          </button>
        </div>
      </div>

      {sheetsStatus && (
        <div
          className={`rounded-xl p-3 border text-xs flex flex-wrap items-center justify-between gap-2 ${
            sheetsStatus.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {sheetsStatus.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{sheetsStatus.msg}</span>
          </div>
          {sheetsStatus.url && (
            <a
              href={sheetsStatus.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              {uiText.openSheetLink}
            </a>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.dashGradedCount}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {classStats.count} / {students.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.dashAvgScore}</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {classStats.avgPct} %
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.dashAvgGrade}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {classStats.count > 0 ? classStats.avgGrade.toFixed(2) : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.dashPassRate}</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {classStats.passRate} %{' '}
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
              ({classStats.zeroVetoCount}&times; {uiText.zeroVetoCountLabel})
            </span>
          </p>
        </div>
      </div>

      {/* Unified Cumulative Histogram Card of All Students */}
      {showCumulativeCard && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {uiText.cumulativeCardTitle}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {uiText.cumulativeCardSubtitle}
              </p>
            </div>

            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCumulativeViewMode('cumulative_grades')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  cumulativeViewMode === 'cumulative_grades'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {uiText.cumulativeModeGrades}
              </button>
              <button
                type="button"
                onClick={() => setCumulativeViewMode('all_students')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  cumulativeViewMode === 'all_students'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {uiText.cumulativeModeStudents}
              </button>
            </div>
          </div>

          {evaluatedRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
              {t.noGradedYet}
            </div>
          ) : cumulativeViewMode === 'cumulative_grades' ? (
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="w-3 h-3 rounded-xs bg-indigo-500 inline-block" />
                    {uiText.cumulativeLegendBar}
                  </span>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <span className="w-4 h-0.5 bg-slate-900 dark:bg-white inline-block" />
                    {uiText.cumulativeLegendLine}
                  </span>
                </div>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {uiText.passingBoundaryLabel}: {classStats.passRate} %
                </span>
              </div>

              {/* Unified Cumulative Pareto / Ogive SVG Chart */}
              <div className="relative rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4">
                <svg
                  viewBox="0 0 600 230"
                  className="w-full h-56 overflow-visible select-none"
                  role="img"
                  aria-label={uiText.cumulativeCardTitle}
                >
                  {/* Horizontal percentage grid lines (25%, 50%, 75%, 100%) */}
                  {[25, 50, 75, 100].map((pct) => {
                    const y = 180 - (pct / 100) * 150;
                    return (
                      <g key={pct}>
                        <line
                          x1={44}
                          x2={568}
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          className="text-slate-200 dark:text-slate-800"
                          strokeDasharray="3 3"
                          strokeWidth={1}
                        />
                        <text
                          x={36}
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Passing Divider between Grade 4 and Grade 5 */}
                  <line
                    x1={460}
                    x2={460}
                    y1={20}
                    y2={186}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    opacity={0.65}
                  />

                  {/* Bars for Grades 1 to 5 */}
                  {gradeCounts.cumulative.map((item, idx) => {
                    const colCenter = 96 + idx * 104;
                    const barW = 54;
                    const barH = item.count > 0 ? Math.max(10, (item.count / gradeCounts.peak) * 140) : 0;
                    const barY = 180 - barH;
                    const fillClass =
                      item.grade === 1
                        ? 'fill-emerald-500'
                        : item.grade === 2
                        ? 'fill-teal-500'
                        : item.grade === 3
                        ? 'fill-sky-500'
                        : item.grade === 4
                        ? 'fill-amber-500'
                        : 'fill-rose-500';
                    const isActive = hoveredGrade === item.grade;

                    return (
                      <g
                        key={item.grade}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredGrade(item.grade)}
                        onMouseLeave={() => setHoveredGrade(null)}
                        onClick={() => setHoveredGrade((prev) => (prev === item.grade ? null : item.grade))}
                      >
                        <rect
                          x={colCenter - barW / 2}
                          y={30}
                          width={barW}
                          height={150}
                          rx={8}
                          className="fill-slate-200/40 dark:fill-slate-800/40"
                        />
                        {barH > 0 && (
                          <rect
                            x={colCenter - barW / 2}
                            y={barY}
                            width={barW}
                            height={barH}
                            rx={8}
                            className={`${fillClass} transition-opacity ${
                              isActive ? 'opacity-100 stroke-slate-900 dark:stroke-white stroke-2' : 'opacity-85 hover:opacity-100'
                            }`}
                          />
                        )}
                        <text
                          x={colCenter}
                          y={Math.max(22, barY - 6)}
                          textAnchor="middle"
                          className="fill-slate-800 dark:fill-slate-100 text-[11px] font-bold"
                        >
                          {item.count} ({item.pct}%)
                        </text>
                        <text
                          x={colCenter}
                          y={202}
                          textAnchor="middle"
                          className="fill-slate-800 dark:fill-slate-200 text-[12px] font-bold"
                        >
                          {t.gradeCol} {item.grade}
                        </text>
                        <text
                          x={colCenter}
                          y={218}
                          textAnchor="middle"
                          className="fill-indigo-600 dark:fill-indigo-400 text-[10px] font-mono font-semibold"
                        >
                          {uiText.cumulativeShort} {item.cumCount}/{evaluatedRows.length} ({item.cumPct}%)
                        </text>
                      </g>
                    );
                  })}

                  {/* Cumulative Line Overlay (Σ %) */}
                  <polyline
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-900 dark:text-white pointer-events-none"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={gradeCounts.cumulative
                      .map((item, idx) => `${96 + idx * 104},${180 - (item.cumPct / 100) * 150}`)
                      .join(' ')}
                  />

                  {/* Cumulative Dots */}
                  {gradeCounts.cumulative.map((item, idx) => {
                    const cx = 96 + idx * 104;
                    const cy = 180 - (item.cumPct / 100) * 150;
                    return (
                      <g key={`dot-${item.grade}`} className="pointer-events-none">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          className="fill-white dark:fill-slate-900 stroke-indigo-600 dark:stroke-indigo-400"
                          strokeWidth={2.5}
                        />
                        <text
                          x={cx}
                          y={cy - 10}
                          textAnchor="middle"
                          className="fill-slate-900 dark:fill-white text-[10px] font-mono font-bold"
                        >
                          {item.cumPct}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Matching Student Breakdown Bar */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-3 text-xs">
                {hoveredGrade !== null ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {t.gradeCol} {hoveredGrade}:
                    </span>
                    {(gradeCounts.cumulative.find((c) => c.grade === hoveredGrade)?.studentsInGrade || []).length === 0 ? (
                      <span className="text-slate-500">0 {uiText.studentsUnit}</span>
                    ) : (
                      (gradeCounts.cumulative.find((c) => c.grade === hoveredGrade)?.studentsInGrade || []).map((row) => (
                        <button
                          key={row.student.id}
                          type="button"
                          onClick={() => onSelectStudentId(row.student.id)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 hover:border-indigo-400 transition cursor-pointer tabular-nums"
                        >
                          {row.student.lastName} {row.student.firstName} · {row.result.percentage} %
                          {row.result.hasZeroVeto ? ` (${uiText.zeroVetoCountLabel})` : ''}
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">{uiText.hoverGradeHint}</span>
                )}
              </div>
            </div>
          ) : (
            /* Unified All-Students Single Card View */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{uiText.allStudentsSortedHint}</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                  {uiText.passThresholdLine}: {assignment.passingPercentage} %
                </span>
              </div>

              <div className="relative rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 overflow-x-auto">
                <div className="relative min-w-[520px] h-56 flex items-end gap-2 pt-8 pb-12 px-2">
                  {/* Horizontal Passing Threshold Line */}
                  <div
                    className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/80 pointer-events-none z-10"
                    style={{ bottom: `calc(3rem + ${(assignment.passingPercentage / 100) * 140}px)` }}
                  >
                    <span className="absolute right-2 -top-5 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 rounded tabular-nums">
                      {assignment.passingPercentage} %
                    </span>
                  </div>

                  {gradeCounts.sortedStudents.map((row) => {
                    const g = row.result.grade;
                    const barColor =
                      g === 1
                        ? 'bg-emerald-500'
                        : g === 2
                        ? 'bg-teal-500'
                        : g === 3
                        ? 'bg-sky-500'
                        : g === 4
                        ? 'bg-amber-500'
                        : 'bg-rose-500';
                    const isSelected = activeComparison?.student.id === row.student.id;
                    const barPx = Math.max(8, Math.round((row.result.percentage / 100) * 140));

                    return (
                      <button
                        key={row.student.id}
                        type="button"
                        onClick={() => onSelectStudentId(row.student.id)}
                        onMouseEnter={() => setHoveredStudentId(row.student.id)}
                        onMouseLeave={() => setHoveredStudentId(null)}
                        className={`flex-1 min-w-[34px] max-w-[68px] flex flex-col items-center justify-end group cursor-pointer focus:outline-none ${
                          isSelected ? 'scale-[1.03]' : ''
                        }`}
                        title={`${row.student.lastName} ${row.student.firstName} — ${row.result.percentage} % (${uiText.gradeShort} ${g})`}
                      >
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1 tabular-nums">
                          {uiText.gradeShort} {g}
                        </span>
                        <div
                          className={`w-full rounded-t-lg transition-all ${barColor} ${
                            isSelected
                              ? 'ring-2 ring-indigo-600 dark:ring-white opacity-100'
                              : 'opacity-85 group-hover:opacity-100'
                          }`}
                          style={{ height: `${barPx}px` }}
                        />
                        <div className="mt-1.5 text-center leading-tight">
                          <div className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[58px]">
                            {row.student.lastName}
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                            {row.result.percentage}%
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {hoveredStudentId && (
                (() => {
                  const target = gradeCounts.sortedStudents.find((r) => r.student.id === hoveredStudentId);
                  if (!target) return null;
                  return (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {target.student.firstName} {target.student.lastName}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {target.result.totalPoints} / {target.result.maxPoints} {t.pointsUnit} ·{' '}
                        <strong>{target.result.percentage} %</strong> · {t.gradeCol} <strong>{target.result.grade}</strong>
                        {target.result.hasZeroVeto ? ` (${uiText.zeroVetoCountLabel})` : ''}
                      </span>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}

      {/* Overall Score Histogram & Grade Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {uiText.overallHistogramTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {uiText.overallHistogramSubtitle}
            </p>
          </div>

          <div className="flex items-end gap-3 h-44 pt-4">
            {totalHistogram.bins.map((bin) => {
              const heightPct = Math.round((bin.count / totalHistogram.peak) * 100);
              return (
                <div key={bin.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                    {bin.count}
                  </span>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg h-28 flex items-end overflow-hidden">
                    <div
                      className={`w-full ${bin.tone} rounded-t-lg transition-all`}
                      style={{ height: `${Math.max(bin.count > 0 ? 12 : 0, heightPct)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums text-center">
                    {bin.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.dashGradeDistTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {uiText.gradeDistSubtitle}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((g) => {
              const c = gradeCounts.counts[g] || 0;
              const widthPct = Math.round((c / gradeCounts.peak) * 100);
              return (
                <div key={g} className="flex items-center gap-3 text-xs tabular-nums">
                  <span className="w-24 font-bold text-slate-800 dark:text-slate-200">
                    {t.gradeCol} {g}
                  </span>
                  <div className="flex-1 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all ${
                        g <= 2
                          ? 'bg-emerald-500'
                          : g === 3
                          ? 'bg-sky-500'
                          : g === 4
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${c > 0 ? Math.max(6, widthPct) : 0}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-bold text-slate-700 dark:text-slate-300">
                    {c}&times;
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Student Position vs. Class Comparison across Categories & Criteria */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {t.dashCategoryComparison}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {uiText.compareSubtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeComparison?.student.id || selectedStudentId}
              onChange={(e) => onSelectStudentId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              {evaluatedRows.length === 0 ? (
                <option value="">{t.dashAllStudentsNone}</option>
              ) : (
                evaluatedRows.map((r) => (
                  <option key={r.student.id} value={r.student.id}>
                    {r.student.lastName} {r.student.firstName} ({r.result.percentage} % &bull; {uiText.gradeShort} {r.result.grade})
                  </option>
                ))
              )}
            </select>

            <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
              {(
                [
                  { id: 'all', label: uiText.filterAll },
                  { id: 'formal', label: uiText.filterFormal },
                  { id: 'content', label: uiText.filterContent },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    categoryFilter === tab.id
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Select specific criteria chips (optional filter) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">
            {uiText.selectedCriteriaLabel}
          </span>
          {assignment.criteria
            .filter((c) => categoryFilter === 'all' || c.category === categoryFilter)
            .map((c) => {
              const active = selectedCriterionIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCriterionPick(c.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          {selectedCriterionIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCriterionIds([])}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold underline ml-1 cursor-pointer"
            >
              {uiText.showAllBtn}
            </button>
          )}
        </div>

        {/* Comparison Overview Bars: Student vs Class Average */}
        {activeComparison ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: t.dashAvgScore,
                  studentPct: activeComparison.result.percentage,
                  classPct: classStats.avgPct,
                },
                {
                  label: t.formalCriteria,
                  studentPct: activeComparison.formalPct,
                  classPct: classStats.formalAvgPct,
                },
                {
                  label: t.contentCriteria,
                  studentPct: activeComparison.contentPct,
                  classPct: classStats.contentAvgPct,
                },
              ].map((cmp) => (
                <div
                  key={cmp.label}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2.5 tabular-nums"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                    <span>{cmp.label}</span>
                    <span
                      className={
                        cmp.studentPct >= cmp.classPct
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {cmp.studentPct >= cmp.classPct ? '+' : ''}
                      {(cmp.studentPct - cmp.classPct).toFixed(1)} % {uiText.vsClass}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div>
                      <div className="flex justify-between font-semibold text-indigo-700 dark:text-indigo-300">
                        <span>{activeComparison.student.firstName} ({t.dashStudentBar})</span>
                        <span>{cmp.studentPct} %</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${cmp.studentPct}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>{t.dashClassAvgBar}</span>
                        <span>{cmp.classPct} %</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-slate-400 dark:bg-slate-500 rounded-full"
                          style={{ width: `${cmp.classPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
            {t.noGradedYet}
          </div>
        )}
      </div>

      {/* Per-Criterion Distribution Histograms (0 - 1 - 2 - 3 points) */}
      <div className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {uiText.perCritTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {uiText.perCritSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCriteria.map((c) => {
            const levelCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
            let sum = 0;
            let n = 0;
            for (const r of evaluatedRows) {
              const lvl = r.evaluation.scores[c.id];
              if (lvl !== undefined) {
                levelCounts[lvl] = (levelCounts[lvl] || 0) + 1;
                sum += lvl;
                n += 1;
              }
            }
            const peak = Math.max(1, ...Object.values(levelCounts));
            const avgLvl = n > 0 ? (sum / n).toFixed(2) : '—';
            const studentLvl = activeComparison?.evaluation.scores[c.id];

            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {c.category === 'formal' ? uiText.filterFormal : uiText.filterContent} &bull; {t.weightLabel} {c.weight}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</h4>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                    {uiText.avgLabel}: {avgLvl} / 3
                  </span>
                </div>

                <div className="flex items-end gap-2.5 h-32 pt-2">
                  {([0, 1, 2, 3] as const).map((lvl) => {
                    const count = levelCounts[lvl] || 0;
                    const hPct = Math.round((count / peak) * 100);
                    const isStudentHere = studentLvl === lvl;
                    const barColor =
                      lvl === 3
                        ? 'bg-emerald-500'
                        : lvl === 2
                        ? 'bg-sky-500'
                        : lvl === 1
                        ? 'bg-amber-500'
                        : 'bg-rose-500';
                    return (
                      <div
                        key={lvl}
                        className={`flex-1 flex flex-col items-center justify-end gap-1 h-full p-1 rounded-xl ${
                          isStudentHere
                            ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                            : ''
                        }`}
                      >
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          {count}
                        </span>
                        <div className="w-full h-16 bg-slate-100 dark:bg-slate-800 rounded-md flex items-end overflow-hidden">
                          <div
                            className={`w-full ${barColor} rounded-md transition-all`}
                            style={{ height: `${count > 0 ? Math.max(14, hPct) : 0}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                          {lvl} {t.pointsUnit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

