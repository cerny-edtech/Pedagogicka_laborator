import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Grid,
  Shuffle,
  Sparkles,
  Heart,
  Sliders,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Check,
  AlertCircle,
  HelpCircle,
  Eye,
  EyeOff,
  Edit3,
} from 'lucide-react';
import {
  Student,
  ClassroomConfig,
  SeatingPairRule,
  DeskSlot,
  Language,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  getStudentAverage,
  sortStudentsByLastName,
  generateOptimalSeating,
  generateRandomSeating,
  splitClassIntoTwoGroups,
  computeSeatingCorrelation,
  getDeskHeatmapStyle,
} from '../../utils/seatingAlgorithms';

interface SeatingAppProps {
  language: Language;
  isDark: boolean;
  students: Student[];
  onUpdateStudents: (students: Student[]) => void;
  rules: SeatingPairRule[];
  onUpdateRules: (rules: SeatingPairRule[]) => void;
  config: ClassroomConfig;
  onUpdateConfig: (config: ClassroomConfig) => void;
  onPrint: () => void;
}

export const SeatingApp: React.FC<SeatingAppProps> = ({
  language,
  isDark,
  students,
  onUpdateStudents,
  rules,
  onUpdateRules,
  config,
  onUpdateConfig,
  onPrint,
}) => {
  const t = translations[language].seating;
  const subjects = translations[language].subjects;

  // Tabs inside Seating App
  const [activeSubTab, setActiveSubTab] = useState<
    'grid' | 'groups' | 'pairs' | 'students' | 'bulkGrades' | 'correlations'
  >('grid');

  // Active group filter: 'all' | 'group1' | 'group2'
  const [activeGroupFilter, setActiveGroupFilter] = useState<'all' | 'group1' | 'group2'>('all');

  // Drag & drop or click-to-swap selection state
  const [selectedSeat, setSelectedSeat] = useState<{ deskId: string; slotIdx: number; studentId: string | null } | null>(null);

  // Modal for individual student inspection & grade editing
  const [inspectingStudent, setInspectingStudent] = useState<Student | null>(null);
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [editingSpecialNeeds, setEditingSpecialNeeds] = useState<string[]>([]);
  const [editingSpecialNeedsNotes, setEditingSpecialNeedsNotes] = useState<string>('');

  const openStudentModal = (s: Student) => {
    setInspectingStudent(s);
    setEditingNotes(s.notes || '');
    setEditingSpecialNeeds(s.specialNeeds || []);
    setEditingSpecialNeedsNotes(s.specialNeedsNotes || '');
  };

  const handleSaveStudentDetails = () => {
    if (!inspectingStudent) return;
    const updated = students.map((s) =>
      s.id === inspectingStudent.id
        ? {
            ...s,
            notes: editingNotes,
            specialNeeds: editingSpecialNeeds,
            specialNeedsNotes: editingSpecialNeedsNotes,
          }
        : s
    );
    onUpdateStudents(updated);
    setInspectingStudent(null);
  };

  // Bulk grade modal state
  const [bulkSubject, setBulkSubject] = useState<string>('math');
  const [bulkGradeInput, setBulkGradeInput] = useState<Record<string, number>>({});
  const [bulkSaveFeedback, setBulkSaveFeedback] = useState(false);

  // Custom desks state (persisted in pl_seating_desks when viewing all students)
  const [desksState, setDesksState] = useState<DeskSlot[]>(() => {
    try {
      const savedRaw = localStorage.getItem('pl_seating_desks');
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (
          parsed &&
          Array.isArray(parsed.desks) &&
          parsed.layout === config.layout &&
          parsed.rows === config.rows &&
          parsed.cols === config.cols &&
          parsed.activeSubject === config.activeSubject
        ) {
          const validIds = new Set(students.map((s) => s.id));
          const hasMatchingStudents = parsed.desks.some((d: DeskSlot) =>
            d.studentIds?.some((id) => id && validIds.has(id))
          );
          if (hasMatchingStudents || students.length === 0) {
            return parsed.desks;
          }
        }
      }
    } catch {
      // ignore storage errors
    }
    return generateOptimalSeating(students, config, rules, config.activeSubject);
  });

  useEffect(() => {
    if (activeGroupFilter !== 'all') return;
    try {
      localStorage.setItem(
        'pl_seating_desks',
        JSON.stringify({
          layout: config.layout,
          rows: config.rows,
          cols: config.cols,
          activeSubject: config.activeSubject,
          desks: desksState,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [desksState, config.layout, config.rows, config.cols, config.activeSubject, activeGroupFilter]);

  // Subject key list
  const subjectKeys = [
    { key: 'math', label: subjects.math },
    { key: 'nativeLang', label: subjects.nativeLang },
    { key: 'science', label: subjects.science },
    { key: 'history', label: subjects.history },
    { key: 'foreignLang', label: subjects.foreignLang },
    { key: 'art', label: subjects.art },
  ];

  // Group split calculations
  const splitGroups = useMemo(() => {
    return splitClassIntoTwoGroups(students, rules);
  }, [students, rules]);

  // Current active student pool
  const currentStudents = useMemo(() => {
    if (activeGroupFilter === 'group1') return splitGroups.group1;
    if (activeGroupFilter === 'group2') return splitGroups.group2;
    return students;
  }, [students, splitGroups, activeGroupFilter]);

  // Student map for fast lookup
  const studentMap = useMemo(() => {
    return new Map(students.map((s) => [s.id, s]));
  }, [students]);

  // Correlation metrics
  const correlationData = useMemo(() => {
    return computeSeatingCorrelation(desksState, currentStudents, config.activeSubject, language);
  }, [desksState, currentStudents, config.activeSubject, language]);

  // Group filter switcher
  const handleSwitchGroupFilter = (nextFilter: 'all' | 'group1' | 'group2') => {
    setActiveGroupFilter(nextFilter);
    setSelectedSeat(null);
    const pool =
      nextFilter === 'group1'
        ? splitGroups.group1
        : nextFilter === 'group2'
        ? splitGroups.group2
        : students;
    setDesksState(generateOptimalSeating(pool, config, rules, config.activeSubject));
  };

  // Handlers for Seating Generation
  const handleAutoOptimize = () => {
    const newDesks = generateOptimalSeating(currentStudents, config, rules, config.activeSubject);
    setDesksState(newDesks);
    setSelectedSeat(null);
  };

  const handleRandomize = () => {
    const newDesks = generateRandomSeating(currentStudents, config);
    setDesksState(newDesks);
    setSelectedSeat(null);
  };

  // Seat click / Swap handler
  const handleSeatClick = (deskId: string, slotIdx: number, studentId: string | null) => {
    if (!selectedSeat) {
      if (studentId) {
        setSelectedSeat({ deskId, slotIdx, studentId });
      }
      return;
    }

    // If clicking same seat, deselect
    if (selectedSeat.deskId === deskId && selectedSeat.slotIdx === slotIdx) {
      setSelectedSeat(null);
      return;
    }

    // Swap student from selectedSeat with target seat!
    setDesksState((prev) => {
      const next = prev.map((d) => ({ ...d, studentIds: [...d.studentIds] }));
      const originDesk = next.find((d) => d.deskId === selectedSeat.deskId);
      const targetDesk = next.find((d) => d.deskId === deskId);

      if (originDesk && targetDesk) {
        const studentA = originDesk.studentIds[selectedSeat.slotIdx];
        const studentB = targetDesk.studentIds[slotIdx];

        originDesk.studentIds[selectedSeat.slotIdx] = studentB;
        targetDesk.studentIds[slotIdx] = studentA;
      }
      return next;
    });

    setSelectedSeat(null);
  };

  // Bulk grades submit
  const handleSaveBulkGrades = () => {
    const updated = students.map((s) => {
      const newGrade = bulkGradeInput[s.id];
      if (newGrade && newGrade >= 1 && newGrade <= 5) {
        const currentList = s.grades[bulkSubject] || [];
        return {
          ...s,
          grades: {
            ...s.grades,
            [bulkSubject]: [...currentList, newGrade],
          },
        };
      }
      return s;
    });
    onUpdateStudents(updated);
    setBulkSaveFeedback(true);
    setTimeout(() => setBulkSaveFeedback(false), 2000);
  };

  const escapeCsvCell = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const getLocalIsoDate = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [t.lastName, t.firstName, t.gender, t.allAvgCol, ...subjectKeys.map((s) => s.label)];
    const rows = sortStudentsByLastName(students).map((s) => {
      const overallAvg = getStudentAverage(s, 'all');
      const subjectAvgs = subjectKeys.map((sub) => {
        const list = s.grades[sub.key] || [];
        return list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(2) : '-';
      });
      return [s.lastName, s.firstName, s.gender, overallAvg, ...subjectAvgs].map(escapeCsvCell).join(',');
    });

    const csvText = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zasedaci_poradek_${getLocalIsoDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import CSV / Google Sheets TSV/CSV format
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawText = (event.target?.result as string) || '';
      const text = rawText.replace(/^\uFEFF/, '');
      if (!text) return;

      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return;

      const newStudents: Student[] = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        const cols = line
          .split(delimiter)
          .map((c) => c.trim().replace(/^["']|["']$/g, '').replace(/""/g, '"'));
        if (cols.length >= 2 && (cols[0] || cols[1])) {
          const lastName = cols[0];
          const firstName = cols[1];
          const genderRaw = cols[2]?.toUpperCase() || '';
          const gender = genderRaw === 'F' || genderRaw === 'Ž' || genderRaw === 'Z' || genderRaw === 'K' ? 'F' : 'M';
          newStudents.push({
            id: `imported_${Date.now()}_${i}`,
            lastName,
            firstName,
            gender,
            grades: {
              math: [2, 3],
              nativeLang: [2, 2],
              science: [2, 3],
              history: [2, 2],
              foreignLang: [2, 2],
              art: [1, 1],
            },
          });
        }
      }

      if (newStudents.length > 0) {
        onUpdateStudents(newStudents);
        setActiveGroupFilter('all');
        const newDesks = generateOptimalSeating(newStudents, config, rules, config.activeSubject);
        setDesksState(newDesks);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Main Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t.title}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {t.layouts[config.layout]}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.subtitle}
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'grid', label: t.tabs.grid, icon: <Grid className="w-3.5 h-3.5" /> },
            { id: 'groups', label: t.tabs.groups, icon: <Users className="w-3.5 h-3.5" /> },
            { id: 'pairs', label: t.tabs.pairs, icon: <Heart className="w-3.5 h-3.5" /> },
            { id: 'students', label: t.tabs.students, icon: <Sliders className="w-3.5 h-3.5" /> },
            { id: 'bulkGrades', label: t.tabs.bulkGrades, icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
            { id: 'correlations', label: t.tabs.correlations, icon: <BarChart3 className="w-3.5 h-3.5" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeSubTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: CLASSROOM GRID VIEW */}
      {activeSubTab === 'grid' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 no-print">
            <div className="flex flex-wrap items-center gap-2">
              {/* Subject filter */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {t.subjectFilter}
                </span>
                <select
                  value={config.activeSubject}
                  onChange={(e) => {
                    const nextSubject = e.target.value;
                    const newCfg = { ...config, activeSubject: nextSubject };
                    onUpdateConfig(newCfg);
                    setDesksState(generateOptimalSeating(currentStudents, newCfg, rules, nextSubject));
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">{t.allSubjects}</option>
                  {subjectKeys.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Group View switch (All / Group 1 / Group 2) */}
              <div className="flex items-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleSwitchGroupFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    activeGroupFilter === 'all'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.allSubjects} ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchGroupFilter('group1')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    activeGroupFilter === 'group1'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.group1} ({splitGroups.group1.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchGroupFilter('group2')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    activeGroupFilter === 'group2'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {t.group2} ({splitGroups.group2.length})
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Student View Toggle Button */}
              <button
                type="button"
                onClick={() => onUpdateConfig({ ...config, studentViewMode: !config.studentViewMode })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all ${
                  config.studentViewMode
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/40'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
                title={t.studentViewActiveBadge}
              >
                {config.studentViewMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{config.studentViewMode ? t.studentViewBtn : t.studentViewBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleAutoOptimize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                title={t.autoOptimize}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.autoOptimize}</span>
              </button>

              <button
                type="button"
                onClick={handleRandomize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                title={t.randomize}
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{t.randomize}</span>
              </button>

              <button
                type="button"
                onClick={onPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.exportPdf}</span>
              </button>
            </div>
          </div>

          {/* Conditional Projection Banner OR Heatmap Legend */}
          {config.studentViewMode ? (
            <div className="flex items-center justify-between gap-3 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 p-3.5 rounded-xl text-emerald-900 dark:text-emerald-300">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <strong className="block font-bold">
                    {t.studentViewBtn}
                  </strong>
                  <span className="text-emerald-700 dark:text-emerald-400 text-[11px]">
                    {t.studentViewActiveBadge}
                  </span>
                </div>
              </div>
              <span className="px-2 py-1 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0">
                {t.blackboardStudent}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {t.heatmapLegend}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 dark:bg-emerald-950 border border-emerald-400" />
                    <span className="text-slate-600 dark:text-slate-400">{t.excellent}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-amber-100 dark:bg-amber-950 border border-amber-400" />
                    <span className="text-slate-600 dark:text-slate-400">{t.average}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-rose-100 dark:bg-rose-950 border border-rose-400" />
                    <span className="text-slate-600 dark:text-slate-400">{t.attention}</span>
                  </div>
                </div>
              </div>

              <div className="text-slate-500 text-[11px] italic">
                {t.dragHint}
              </div>
            </div>
          )}

          {/* U-Shape Information Banner if active */}
          {config.layout === 'u_shape' && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 p-3.5 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>{t.uShapeInfo}</span>
            </div>
          )}

          {/* Classroom Canvas Grid Area */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm overflow-x-auto">
            {/* BLACKBOARD / FRONT */}
            <div className="max-w-md mx-auto mb-8">
              <div className="py-2.5 px-6 rounded-xl bg-slate-800 text-white dark:bg-slate-700 text-center font-bold text-xs tracking-widest shadow-md border-b-4 border-slate-900">
                {t.blackboard}
              </div>
              <div className="text-[10px] text-center text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                {config.studentViewMode ? t.blackboardStudent : t.blackboard}
              </div>
            </div>

            {/* SEATING LAYOUT RENDERING */}
            {config.layout === 'standard' && (
              <div className="space-y-5 max-w-5xl mx-auto">
                {Array.from({ length: config.rows }).map((_, r) => (
                  <div key={r} className="flex items-center justify-center gap-4">
                    <span className="text-[11px] font-bold text-slate-400 w-14 text-right whitespace-nowrap">
                      {t.corrRowLabel} {r + 1}
                    </span>
                    <div
                      className="grid gap-4 flex-1 max-w-4xl"
                      style={{ gridTemplateColumns: `repeat(${Math.max(1, config.cols)}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: config.cols }).map((_, c) => {
                        const desk = desksState.find((d) => d.row === r && d.col === c);
                        return renderDeskBox(desk, `std_r${r}_c${c}`);
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {config.layout === 'clusters' && (() => {
              const clusterCols = Math.max(2, Math.floor(config.cols * 0.7));
              return (
                <div className="space-y-8 max-w-5xl mx-auto">
                  {Array.from({ length: config.rows }).map((_, r) => (
                    <div key={r} className="flex items-center justify-center gap-6">
                      <span className="text-[11px] font-bold text-slate-400 w-14 text-right whitespace-nowrap">
                        {t.corrRowLabel} {r + 1}
                      </span>
                      <div
                        className="grid gap-6 flex-1 max-w-4xl"
                        style={{ gridTemplateColumns: `repeat(${clusterCols}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: clusterCols }).map((_, c) => {
                          const desk = desksState.find((d) => d.row === r && d.col === c);
                          return renderDeskBox(desk, `pod_r${r}_c${c}`, true);
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {config.layout === 'u_shape' && (
              <div className="max-w-5xl mx-auto relative min-h-[460px] p-4">
                {/* U-Shape Perimeter */}
                <div className="flex justify-between items-stretch gap-6">
                  {/* Left Column (Facing inward) */}
                  <div className="flex flex-col gap-4 w-44">
                    <span className="text-[10px] font-bold uppercase text-slate-400 text-center">
                      {t.boardLeft} (U)
                    </span>
                    {desksState
                      .filter((d) => d.deskId.startsWith('u_left'))
                      .map((desk) => renderDeskBox(desk, desk.deskId))}
                  </div>

                  {/* Open Center (Teacher Movement Space) */}
                  <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-indigo-200/60 dark:border-indigo-900/40 rounded-2xl p-6 bg-indigo-50/20 dark:bg-indigo-950/10">
                    <div className="text-center space-y-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
                        {t.layouts.u_shape}
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                        {t.uShapeInfo}
                      </p>
                    </div>
                  </div>

                  {/* Right Column (Facing inward) */}
                  <div className="flex flex-col gap-4 w-44">
                    <span className="text-[10px] font-bold uppercase text-slate-400 text-center">
                      {t.boardRight} (U)
                    </span>
                    {desksState
                      .filter((d) => d.deskId.startsWith('u_right'))
                      .map((desk) => renderDeskBox(desk, desk.deskId))}
                  </div>
                </div>

                {/* Bottom Back Wing */}
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block text-center mb-3">
                    {t.boardBottom} (U)
                  </span>
                  <div className="flex justify-center gap-4 flex-wrap">
                    {desksState
                      .filter((d) => d.deskId.startsWith('u_back'))
                      .map((desk) => renderDeskBox(desk, desk.deskId))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GROUPS / PŮLENÉ HODINY */}
      {activeSubTab === 'groups' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.tabs.groups}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.groupSplitInfo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  handleSwitchGroupFilter('group1');
                  setActiveSubTab('grid');
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                {t.tabs.grid}: {t.group1}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {/* Group 1 Card */}
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-base">
                    {t.group1} ({splitGroups.group1.length} {t.groupCountSuffix})
                  </h4>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {t.boy}: {splitGroups.group1.filter((s) => s.gender === 'M').length} &bull; {t.girl}: {splitGroups.group1.filter((s) => s.gender === 'F').length}
                  </span>
                </div>
                <div className="divide-y divide-indigo-100 dark:divide-indigo-900/40">
                  {splitGroups.group1.map((s, idx) => (
                    <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {idx + 1}. {s.lastName} {s.firstName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.gender === 'M' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'}`}>
                          {s.gender === 'M' ? t.boy : t.girl}
                        </span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          Ø {getStudentAverage(s, config.activeSubject)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2 Card */}
              <div className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/30 dark:bg-violet-950/20 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-violet-900 dark:text-violet-200 text-base">
                    {t.group2} ({splitGroups.group2.length} {t.groupCountSuffix})
                  </h4>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                    {t.boy}: {splitGroups.group2.filter((s) => s.gender === 'M').length} &bull; {t.girl}: {splitGroups.group2.filter((s) => s.gender === 'F').length}
                  </span>
                </div>
                <div className="divide-y divide-violet-100 dark:divide-violet-900/40">
                  {splitGroups.group2.map((s, idx) => (
                    <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {idx + 1}. {s.lastName} {s.firstName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${s.gender === 'M' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'}`}>
                          {s.gender === 'M' ? t.boy : t.girl}
                        </span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          Ø {getStudentAverage(s, config.activeSubject)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: RULES & PEVNÉ DVOJICE & GEOMETRIE */}
      {activeSubTab === 'pairs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Classroom Geometry & Layout Settings */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-500" />
              <span>{t.classroomParams}</span>
            </h3>

            {/* Layout switch */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.classroomParams}:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'standard', label: t.layouts.standard },
                  { id: 'u_shape', label: t.layouts.u_shape },
                  { id: 'clusters', label: t.layouts.clusters },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      const newCfg: ClassroomConfig = { ...config, layout: l.id as any };
                      onUpdateConfig(newCfg);
                      setDesksState(generateOptimalSeating(students, newCfg, rules, config.activeSubject));
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      config.layout === l.id
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enforce Boy / Girl rule toggle */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t.enforceBoyGirl}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.enforceBoyGirlHint}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enforceBoyGirl}
                  onChange={(e) => {
                    const newCfg = { ...config, enforceBoyGirl: e.target.checked };
                    onUpdateConfig(newCfg);
                    setDesksState(generateOptimalSeating(students, newCfg, rules, config.activeSubject));
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            {/* Geometry sliders */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.rows} ({config.rows})
                </label>
                <input
                  type="range"
                  min="3"
                  max="8"
                  value={config.rows}
                  onChange={(e) => {
                    const newCfg = { ...config, rows: Number(e.target.value) };
                    onUpdateConfig(newCfg);
                    setDesksState(generateOptimalSeating(students, newCfg, rules, config.activeSubject));
                  }}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.cols} ({config.cols})
                </label>
                <input
                  type="range"
                  min="2"
                  max="6"
                  value={config.cols}
                  onChange={(e) => {
                    const newCfg = { ...config, cols: Number(e.target.value) };
                    onUpdateConfig(newCfg);
                    setDesksState(generateOptimalSeating(students, newCfg, rules, config.activeSubject));
                  }}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-2"
                />
              </div>
            </div>
          </div>

          {/* Card: Fixed Pairing Rules (Kamarádi / Zákaz) */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>{t.fixedPairsTitle}</span>
              </h3>
              <span className="text-xs text-slate-500">
                ({rules.length})
              </span>
            </div>

            {/* Rules list */}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {rules.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  {t.noPairRules}
                </div>
              ) : (
                rules.map((r) => {
                  const s1 = studentMap.get(r.student1Id);
                  const s2 = studentMap.get(r.student2Id);
                  if (!s1 || !s2) return null;
                  return (
                    <div
                      key={r.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        r.type === 'positive'
                          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                          : 'border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">
                          {r.type === 'positive' ? `💚 ${t.positivePairs}:` : `🚫 ${t.negativePairs}:`}
                        </span>
                        <span>
                          {s1.lastName} {s1.firstName} &amp; {s2.lastName} {s2.firstName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = rules.filter((item) => item.id !== r.id);
                          onUpdateRules(updated);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title={t.close}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add new rule form */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t.addPairRule}
              </span>
              <AddRuleForm
                students={students}
                t={t}
                onAdd={(rule) => {
                  onUpdateRules([...rules, rule]);
                  setDesksState(generateOptimalSeating(students, config, [...rules, rule], config.activeSubject));
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STUDENT ROSTER & INDIVIDUAL GRADES */}
      {activeSubTab === 'students' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.studentsTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.groupSplitInfo}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{t.importCsv}</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleImportCsv}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.exportCsv}</span>
              </button>
            </div>
          </div>

          {/* Student table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">{t.lastName}</th>
                  <th className="py-2.5 px-3">{t.firstName}</th>
                  <th className="py-2.5 px-3">{t.gender}</th>
                  <th className="py-2.5 px-3">{t.avgLabel}</th>
                  {subjectKeys.map((sub) => (
                    <th key={sub.key} className="py-2.5 px-3 text-center">
                      {sub.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">{t.actionsCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sortStudentsByLastName(students).map((s, idx) => {
                  const avg = getStudentAverage(s, 'all');
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {s.lastName}
                      </td>
                      <td className="py-2.5 px-3">{s.firstName}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            s.gender === 'M'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                              : 'bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300'
                          }`}
                        >
                          {s.gender === 'M' ? t.boy : t.girl}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            avg <= 1.8
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : avg <= 2.8
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {avg}
                        </span>
                      </td>
                      {subjectKeys.map((sub) => {
                        const marks = s.grades[sub.key] || [];
                        return (
                          <td key={sub.key} className="py-2.5 px-3 text-center font-mono">
                            {marks.length ? marks.join(', ') : '-'}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openStudentModal(s)}
                          className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer text-xs flex items-center gap-1 ml-auto"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{t.editSvpBtn}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: BULK GRADE ENTRY FOR WHOLE CLASS */}
      {activeSubTab === 'bulkGrades' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.bulkTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.bulkSubtitle}
              </p>
            </div>

            {/* Select subject */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t.bulkSelectSubject}
              </span>
              <select
                value={bulkSubject}
                onChange={(e) => setBulkSubject(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 font-semibold"
              >
                {subjectKeys.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSaveBulkGrades}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {bulkSaveFeedback ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{bulkSaveFeedback ? '✓' : t.saveChanges}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sortStudentsByLastName(students).map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    {s.lastName} {s.firstName}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {t.avgLabel}: {getStudentAverage(s, bulkSubject)}
                  </span>
                </div>

                {/* Grade buttons 1 to 5 */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() =>
                        setBulkGradeInput((prev) => ({
                          ...prev,
                          [s.id]: prev[s.id] === grade ? 0 : grade,
                        }))
                      }
                      className={`w-7 h-7 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                        bulkGradeInput[s.id] === grade
                          ? 'bg-indigo-600 text-white shadow-xs scale-105'
                          : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
                      }`}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: CORRELATIONS & TEACHER DASHBOARD */}
      {activeSubTab === 'correlations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Pearson r stat card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.corrPearsonLabel}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {correlationData.pearsonR}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  ({t.corrDistLabel})
                </span>
              </div>
              <div className="pt-2 text-xs text-slate-600 dark:text-slate-400">
                {correlationData.interpretation}
              </div>
            </div>

            {/* Front row average */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.corrFrontAvg}
              </span>
              <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {correlationData.frontRowAvg}
              </div>
              <p className="text-xs text-slate-500">
                {t.frontRowStudents}
              </p>
            </div>

            {/* Back row average */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {t.corrBackAvg}
              </span>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {correlationData.backRowAvg}
              </div>
              <p className="text-xs text-slate-500">
                {t.excellent}
              </p>
            </div>
          </div>

          {/* Student correlation breakdown table */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="font-bold text-base text-slate-900 dark:text-white">
              {t.corrScatterTitle}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {correlationData.correlations.map((c) => (
                <div
                  key={c.studentId}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {c.name}
                    </span>
                    <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      Ø {c.averageGrade}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t.corrRowLabel} {c.distanceFromBoard}</span>
                    <span
                      className={`font-semibold ${
                        c.correlationLevel === 'front_higher_need'
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : c.correlationLevel === 'rear_high_performer'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {c.correlationLevel === 'front_higher_need'
                        ? t.attention
                        : c.correlationLevel === 'rear_high_performer'
                        ? t.excellent
                        : t.average}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STUDENT INSPECT / SVP & NOTES / GRADE MODAL */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{inspectingStudent.lastName} {inspectingStudent.firstName}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      inspectingStudent.gender === 'M'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                        : 'bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300'
                    }`}
                  >
                    {inspectingStudent.gender === 'M' ? t.boy : t.girl}
                  </span>
                </h4>
                <span className="text-xs text-slate-500">
                  {t.allAvgCol}: Ø {getStudentAverage(inspectingStudent, 'all')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Speciální vzdělávací potřeby (SVP / SEN) */}
            <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  {t.svpChecklistLabel}
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  {t.svpSavedNotice}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(t.svpOptions).map(([optKey, optLabel]) => {
                  const isChecked = editingSpecialNeeds.includes(optKey) || editingSpecialNeeds.includes(optLabel);
                  return (
                    <label
                      key={optKey}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-amber-100 dark:bg-amber-900/80 border-amber-400 text-amber-900 dark:text-amber-100 font-bold'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingSpecialNeeds([...editingSpecialNeeds, optKey]);
                          } else {
                            setEditingSpecialNeeds(editingSpecialNeeds.filter((n) => n !== optKey && n !== optLabel));
                          }
                        }}
                        className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <span className="truncate">{optLabel}</span>
                    </label>
                  );
                })}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  {t.svpModalTitle}:
                </label>
                <input
                  type="text"
                  value={editingSpecialNeedsNotes}
                  onChange={(e) => setEditingSpecialNeedsNotes(e.target.value)}
                  placeholder={t.teacherNotesPlaceholder}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Interní poznámky pedagoga */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                {t.teacherNotesLabel}:
              </label>
              <textarea
                rows={2}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder={t.teacherNotesPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Visual Grade Chart across Subjects */}
            <div className="space-y-3 pt-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t.gradesCol}:
              </span>
              <div className="space-y-2">
                {subjectKeys.map((sub) => {
                  const avg = getStudentAverage(inspectingStudent, sub.key);
                  const marks = inspectingStudent.grades[sub.key] || [];
                  const pct = Math.max(10, Math.min(100, ((6 - avg) / 5) * 100));
                  return (
                    <div key={sub.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {sub.label}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          Ø {avg} ({marks.join(', ') || '-'})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            avg <= 1.8
                              ? 'bg-emerald-500'
                              : avg <= 2.8
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-[11px] text-slate-400">
                {t.svpSavedNotice}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInspectingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
                >
                  {t.close}
                </button>
                <button
                  type="button"
                  onClick={handleSaveStudentDetails}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.saveChanges}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper renderer for a single desk box
  function renderDeskBox(desk: DeskSlot | undefined, key: string, isPod = false) {
    if (!desk) {
      return (
        <div
          key={key}
          className="h-28 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-xs text-slate-300"
        >
          {t.emptySeat}
        </div>
      );
    }

    // Compute average grade of students sitting at this desk
    const validOccupants = desk.studentIds
      .map((id) => (id ? studentMap.get(id) : null))
      .filter((s): s is Student => Boolean(s));

    let deskAvg: number | null = null;
    if (validOccupants.length > 0) {
      const sum = validOccupants.reduce(
        (acc, s) => acc + getStudentAverage(s, config.activeSubject),
        0
      );
      deskAvg = Number((sum / validOccupants.length).toFixed(2));
    }

    const heatmapStyle = getDeskHeatmapStyle(deskAvg, isDark);

    // If student view is enabled: neutral pleasant desk styling without grades
    const bgStyle = config.studentViewMode
      ? isDark ? '#1e293b' : '#f8fafc'
      : heatmapStyle.backgroundColor;
    const borderStyle = config.studentViewMode
      ? isDark ? '#334155' : '#cbd5e1'
      : heatmapStyle.borderColor;

    return (
      <div
        key={key}
        className={`relative rounded-2xl border transition-all p-3 shadow-2xs ${
          isPod ? 'col-span-1' : ''
        }`}
        style={{
          backgroundColor: bgStyle,
          borderColor: borderStyle,
        }}
      >
        {/* Desk Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {config.studentViewMode ? `${t.deskLabel} ${desk.row + 1}.${desk.col + 1}` : t.deskLabel}
          </span>
          {!config.studentViewMode && deskAvg !== null && (
            <span
              className="text-[10px] font-extrabold px-1.5 py-0.5 rounded"
              style={{
                color: heatmapStyle.labelColor,
                backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
              }}
            >
              Ø {deskAvg}
            </span>
          )}
        </div>

        {/* Student seats in desk */}
        <div className={`grid ${isPod ? 'grid-cols-2 gap-2' : 'grid-cols-2 gap-2'}`}>
          {desk.studentIds.map((studentId, slotIdx) => {
            const student = studentId ? studentMap.get(studentId) : null;
            const isSelected =
              selectedSeat?.deskId === desk.deskId && selectedSeat?.slotIdx === slotIdx;

            return (
              <div
                key={slotIdx}
                onClick={() => handleSeatClick(desk.deskId, slotIdx, studentId)}
                className={`group relative p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-indigo-600 bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 scale-102'
                    : student
                    ? 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                    : 'bg-slate-100/60 dark:bg-slate-800/30 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-200/60'
                }`}
              >
                {student ? (
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {student.lastName}
                      </span>
                      <div className="flex items-center gap-1">
                        {!config.studentViewMode && student.specialNeeds && student.specialNeeds.length > 0 && (
                          <span
                            className="text-[9px] font-bold px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            title={student.specialNeeds.join(', ')}
                          >
                            SVP
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-1 rounded ${
                            student.gender === 'M'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'
                          }`}
                        >
                          {student.gender}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-600 dark:text-slate-300 block truncate font-medium">
                      {student.firstName}
                    </span>

                    {/* In Teacher View: show average, notes, and quick edit pencil button */}
                    {!config.studentViewMode && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <span>Ø {getStudentAverage(student, config.activeSubject)}</span>
                        <div className="flex items-center gap-1">
                          {student.notes && (
                            <span className="text-[9px] text-indigo-500 font-sans" title={student.notes}>
                              📝
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openStudentModal(student);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-opacity"
                            title={t.editSvpBtn}
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-11 flex items-center justify-center text-[10px] text-slate-400 italic">
                    {t.emptySeat}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
};

// Sub-component: Add Rule Form
function AddRuleForm({
  students,
  onAdd,
  t,
}: {
  students: Student[];
  onAdd: (rule: SeatingPairRule) => void;
  t: typeof translations.cs.seating;
}) {
  const sorted = sortStudentsByLastName(students);
  const [s1, setS1] = useState(sorted[0]?.id || '');
  const [s2, setS2] = useState(sorted[1]?.id || sorted[0]?.id || '');
  const [type, setType] = useState<'positive' | 'negative'>('positive');

  useEffect(() => {
    const ids = new Set(sorted.map((st) => st.id));
    if (!ids.has(s1)) {
      setS1(sorted[0]?.id || '');
    }
    if (!ids.has(s2)) {
      setS2(sorted[1]?.id || sorted[0]?.id || '');
    }
  }, [students]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!s1 || !s2 || s1 === s2) return;
    onAdd({
      id: `rule_${Date.now()}`,
      student1Id: s1,
      student2Id: s2,
      type,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-slate-500">{t.selectStudent1}</label>
          <select
            value={s1}
            onChange={(e) => setS1(e.target.value)}
            className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
          >
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName} {s.firstName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-500">{t.selectStudent2}</label>
          <select
            value={s2}
            onChange={(e) => setS2(e.target.value)}
            className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200"
          >
            {sorted.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName} {s.firstName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="ruletype"
            checked={type === 'positive'}
            onChange={() => setType('positive')}
            className="text-emerald-600"
          />
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            💚 {t.positivePairs}
          </span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name="ruletype"
            checked={type === 'negative'}
            onChange={() => setType('negative')}
            className="text-rose-600"
          />
          <span className="font-semibold text-rose-700 dark:text-rose-400">
            🚫 {t.negativePairs}
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={s1 === s2}
        className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold transition-all disabled:opacity-40 cursor-pointer"
      >
        {t.addRuleBtn}
      </button>
    </form>
  );
}
