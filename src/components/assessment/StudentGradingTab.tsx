import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  UserPlus,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  RefreshCw,
  ShieldAlert,
  Printer,
  Copy,
  Check,
  Search,
  ListChecks,
} from 'lucide-react';
import {
  CriteriaAssignment,
  CriterionLevel,
  Gender,
  Language,
  Student,
  StudentCriterionEvaluation,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  computeEvaluationResult,
  GRADE_LABELS,
  LEVEL_LABELS,
} from '../../utils/assessmentUtils';
import { copyTextToClipboard } from '../../utils/clipboard';

interface StudentGradingTabProps {
  assignment: CriteriaAssignment;
  students: Student[];
  onUpdateStudents: (students: Student[]) => void;
  evaluations: StudentCriterionEvaluation[];
  onUpsertEvaluation: (ev: StudentCriterionEvaluation) => void;
  selectedStudentId: string;
  onSelectStudentId: (id: string) => void;
  language: Language;
  onPrintStudentReport: (student: Student, evaluation: StudentCriterionEvaluation) => void;
}

export const StudentGradingTab: React.FC<StudentGradingTabProps> = ({
  assignment,
  students,
  onUpdateStudents,
  evaluations,
  onUpsertEvaluation,
  selectedStudentId,
  onSelectStudentId,
  language,
  onPrintStudentReport,
}) => {
  const t = translations[language].assessment;
  const ts = translations[language].seating;

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newGender, setNewGender] = useState<Gender>('F');
  const [validatingComment, setValidatingComment] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const uiText = useMemo(() => {
    if (language === 'en') {
      return {
        syncedRoster: 'Synced with class roster',
        csvImportTooltip: 'Import students from CSV (Last Name, First Name, Gender)',
        searchPlaceholder: 'Search student...',
        notGraded: 'Not graded yet',
        gradeShort: 'Gr.',
        studentEvalTitle: 'Student Evaluation for Assignment:',
        criteriaEvaluated: 'Criteria graded:',
        ofWord: 'of',
        formalShort: 'Formal',
        contentShort: 'Content',
        maxWord: 'max',
        wbShort: 'w. pts',
        commentWarningTitle: 'Warning: Comment contains subjective opinion or student labeling',
        commentOkTitle: 'Comment is factual and evaluation-focused',
        objectiveRewritePrefix: 'Objective rewrite:',
        appliedObjectiveMsg: 'Objective evaluation phrasing applied.',
        aiSummaryHint: 'Converts rubric points, per-criterion notes, and your comment into detailed student feedback addressing the student by first name and explaining every criterion and grade.',
        regenerateAiBtn: 'Regenerate Detailed Feedback',
        aiSummaryEmptyHint: 'Click "Generate Detailed Student Feedback (AI)" to create a personalized breakdown addressing the student by first name.',
      };
    }
    if (language === 'pl') {
      return {
        syncedRoster: 'Zsynchronizowano z listą klasy',
        csvImportTooltip: 'Importuj uczniów z pliku CSV (Nazwisko, Imię, Płeć)',
        searchPlaceholder: 'Szukaj ucznia...',
        notGraded: 'Jeszcze nieoceniony',
        gradeShort: 'Oc.',
        studentEvalTitle: 'Ocena ucznia za zadanie:',
        criteriaEvaluated: 'Ocenionych kryteriów:',
        ofWord: 'z',
        formalShort: 'Formalne',
        contentShort: 'Merytoryczne',
        maxWord: 'maks.',
        wbShort: 'pkt w.',
        commentWarningTitle: 'Uwaga: Komentarz zawiera subiektywną opinię lub etykietę ucznia',
        commentOkTitle: 'Komentarz jest rzeczowy i skupiony na pracy',
        objectiveRewritePrefix: 'Rzeczowe przeformułowanie:',
        appliedObjectiveMsg: 'Zastosowano rzeczową formę ewaluacji.',
        aiSummaryHint: 'Przekształca punkty ze skali, notatki do kryteriów i komentarz w szczegółową informację zwrotną zwracającą się do ucznia po imieniu.',
        regenerateAiBtn: 'Wygeneruj ponownie szczegółową informację',
        aiSummaryEmptyHint: 'Kliknij „Wygeneruj szczegółową informację zwrotną (AI)”, aby utworzyć omówienie z rozpisaniem punktów.',
      };
    }
    return {
      syncedRoster: 'Synchronizováno se třídním seznamem',
      csvImportTooltip: 'Importovat žáky z CSV (Příjmení, Křestní jméno, Pohlaví)',
      searchPlaceholder: 'Hledat žáka...',
      notGraded: 'Zatím nehodnoceno',
      gradeShort: 'Zn.',
      studentEvalTitle: 'Hodnocení studenta k úkolu:',
      criteriaEvaluated: 'Vyhodnoceno kritérií:',
      ofWord: 'z',
      formalShort: 'Formální',
      contentShort: 'Obsahové',
      maxWord: 'max',
      wbShort: 'v. b.',
      commentWarningTitle: 'Upozornění: Komentář obsahuje subjektivní názor nebo nálepku studenta',
      commentOkTitle: 'Komentář je věcný a evaluační',
      objectiveRewritePrefix: 'Věcné přeformulování:',
      appliedObjectiveMsg: 'Použita věcná evaluační formulace.',
      aiSummaryHint: 'Převede body ze škály, poznámky ke kritériím a Váš komentář do podrobné zprávy — osloví studenta křestním jménem, vysvětlí každé kritérium a sdělí výslednou známku.',
      regenerateAiBtn: 'Přegenerovat podrobné hodnocení',
      aiSummaryEmptyHint: 'Klikněte na „Vygenerovat podrobné hodnocení pro studenta (AI)“ pro vytvoření personalizované zprávy.',
    };
  }, [language]);

  const sortedStudents = useMemo(
    () =>
      [...students]
        .filter((s) =>
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.lastName.localeCompare(b.lastName, language)),
    [students, searchQuery, language]
  );

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || sortedStudents[0] || null;

  const evalMap = useMemo(() => {
    const map = new Map<string, StudentCriterionEvaluation>();
    for (const ev of evaluations) {
      if (ev.assignmentId === assignment.id) {
        map.set(ev.studentId, ev);
      }
    }
    return map;
  }, [evaluations, assignment.id]);

  const currentEval: StudentCriterionEvaluation = useMemo(() => {
    if (selectedStudent && evalMap.has(selectedStudent.id)) {
      return evalMap.get(selectedStudent.id)!;
    }
    return {
      id: `eval_${assignment.id}_${selectedStudent?.id || 'none'}`,
      assignmentId: assignment.id,
      studentId: selectedStudent?.id || '',
      scores: {},
      criterionNotes: {},
      teacherComment: '',
      updatedAt: new Date().toISOString(),
    };
  }, [selectedStudent, evalMap, assignment.id]);

  const result = useMemo(
    () => computeEvaluationResult(assignment, currentEval.scores),
    [assignment, currentEval.scores]
  );

  const formalCriteria = assignment.criteria.filter((c) => c.category === 'formal');
  const contentCriteria = assignment.criteria.filter((c) => c.category === 'content');

  const handleSetLevel = (criterionId: string, level: CriterionLevel) => {
    if (!selectedStudent) return;
    onUpsertEvaluation({
      ...currentEval,
      studentId: selectedStudent.id,
      scores: {
        ...currentEval.scores,
        [criterionId]: level,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCriterionNoteChange = (criterionId: string, note: string) => {
    if (!selectedStudent) return;
    onUpsertEvaluation({
      ...currentEval,
      studentId: selectedStudent.id,
      criterionNotes: {
        ...(currentEval.criterionNotes || {}),
        [criterionId]: note,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCommentChange = (text: string) => {
    if (!selectedStudent) return;
    onUpsertEvaluation({
      ...currentEval,
      studentId: selectedStudent.id,
      teacherComment: text,
      commentValidation: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  // Manual student creation synced into shared class roster
  const handleAddManualStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) return;
    const created: Student = {
      id: `stu_${Date.now()}`,
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      gender: newGender,
      grades: {},
    };
    onUpdateStudents([...students, created]);
    onSelectStudentId(created.id);
    setNewFirstName('');
    setNewLastName('');
    setShowAddStudent(false);
  };

  // CSV Import into shared class roster (supports Last, First, Gender OR First Last)
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '').replace(/^\uFEFF/, '');
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length === 0) return;

      const parsed: Student[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(/[;,]/).map((p) => p.replace(/^"|"$/g, '').trim());
        // Skip header line if detected
        if (
          i === 0 &&
          /jméno|jmeno|příjmení|prijmeni|imię|nazwisko|first|last|name/i.test(parts.join(' '))
        ) {
          continue;
        }
        if (parts.length >= 2 && parts[0] && parts[1]) {
          const rawGender = (parts[2] || '').toUpperCase();
          const gender: Gender =
            rawGender === 'M' ||
            rawGender === 'KLUK' ||
            rawGender === 'CHLAPEC' ||
            rawGender === 'BOY' ||
            rawGender === 'CHŁOPIEC'
              ? 'M'
              : 'F';
          parsed.push({
            id: `stu_csv_${Date.now()}_${i}`,
            lastName: parts[0],
            firstName: parts[1],
            gender,
            grades: {},
          });
        }
      }

      if (parsed.length > 0) {
        const existingKeys = new Set(
          students.map((s) => `${s.firstName.toLowerCase()}::${s.lastName.toLowerCase()}`)
        );
        const fresh = parsed.filter(
          (p) => !existingKeys.has(`${p.firstName.toLowerCase()}::${p.lastName.toLowerCase()}`)
        );
        if (fresh.length > 0) {
          onUpdateStudents([...students, ...fresh]);
          onSelectStudentId(fresh[0].id);
        }
      }
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // AI validate comment for subjectivity / labeling
  const handleValidateComment = async () => {
    if (!selectedStudent || !currentEval.teacherComment.trim()) return;
    setValidatingComment(true);
    setCommentError(null);
    try {
      const res = await fetch('/api/gemini/comment-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: currentEval.teacherComment,
          language,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const validation = await res.json();
      onUpsertEvaluation({
        ...currentEval,
        studentId: selectedStudent.id,
        commentValidation: validation,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Validate comment error:', err);
      setCommentError(
        language === 'en'
          ? 'Could not validate comment right now. Please try again.'
          : language === 'pl'
          ? 'Nie udało się sprawdzić komentarza. Spróbuj ponownie.'
          : 'Kontrola komentáře se nezdařila. Zkuste to prosím znovu.'
      );
    } finally {
      setValidatingComment(false);
    }
  };

  // Generate AI student summary addressing student by first name & informing of grade + detailed breakdown
  const handleGenerateAiSummary = async () => {
    if (!selectedStudent) return;
    setGeneratingSummary(true);
    setSummaryError(null);
    try {
      const breakdown = assignment.criteria.map((c) => {
        const lvl = currentEval.scores[c.id] ?? 0;
        return {
          name: c.name,
          description: c.description,
          category: c.category,
          weight: c.weight,
          level: lvl,
          earnedPoints: lvl * c.weight,
          maxPoints: 3 * c.weight,
          teacherNote: currentEval.criterionNotes?.[c.id] || '',
        };
      });

      const res = await fetch('/api/gemini/student-evaluation-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentFirstName: selectedStudent.firstName,
          studentLastName: selectedStudent.lastName,
          assignmentTitle: assignment.title,
          criteriaBreakdown: breakdown,
          teacherComment: currentEval.teacherComment,
          totalPoints: result.totalPoints,
          maxPoints: result.maxPoints,
          percentage: result.percentage,
          grade: result.grade,
          hasZeroVeto: result.hasZeroVeto,
          language,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.summary) {
        onUpsertEvaluation({
          ...currentEval,
          studentId: selectedStudent.id,
          aiSummary: data.summary,
          updatedAt: new Date().toISOString(),
        });
      } else {
        setSummaryError(data.error || 'Summary generation returned empty response.');
      }
    } catch (err: any) {
      console.error('AI summary error:', err);
      setSummaryError(
        language === 'en'
          ? 'Failed to generate student summary. Please try again.'
          : language === 'pl'
          ? 'Nie udało się wygenerować podsumowania. Spróbuj ponownie.'
          : 'Nepodařilo se vygenerovat hodnocení pro studenta. Zkuste to prosím znovu.'
      );
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleCopySummary = async () => {
    if (!currentEval.aiSummary) return;
    const ok = await copyTextToClipboard(currentEval.aiSummary);
    if (ok) {
      setCopiedSummary(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const levelStyles: Record<CriterionLevel, { active: string; idle: string }> = {
    3: {
      active: 'bg-emerald-600 text-white border-emerald-600',
      idle: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400',
    },
    2: {
      active: 'bg-sky-600 text-white border-sky-600',
      idle: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-400',
    },
    1: {
      active: 'bg-amber-600 text-white border-amber-600',
      idle: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400',
    },
    0: {
      active: 'bg-rose-600 text-white border-rose-600',
      idle: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-rose-400',
    },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT: Shared Class Roster Sidebar */}
      <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.studentsHeading} ({students.length})
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {uiText.syncedRoster}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              title={uiText.csvImportTooltip}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddStudent(!showAddStudent)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t.addBtn}</span>
            </button>
          </div>
        </div>

        {/* Manual Student Quick Form */}
        {showAddStudent && (
          <form
            onSubmit={handleAddManualStudent}
            className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                placeholder={t.studentFirstNamePlaceholder}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
              <input
                type="text"
                required
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                placeholder={t.studentLastNamePlaceholder}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as Gender)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="F">{ts.girlShort}</option>
                <option value="M">{ts.boyShort}</option>
              </select>
              <button
                type="submit"
                className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
              >
                {t.addBtn}
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={uiText.searchPlaceholder}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-900 dark:text-white focus:outline-none"
          />
        </div>

        {/* Roster List */}
        <div className="max-h-[540px] overflow-y-auto space-y-1.5 pr-1">
          {sortedStudents.map((s) => {
            const ev = evalMap.get(s.id);
            const res = ev ? computeEvaluationResult(assignment, ev.scores) : null;
            const isSelected = selectedStudent?.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectStudentId(s.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {s.lastName} {s.firstName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {res && res.scoredCount > 0
                      ? `${res.totalPoints}/${res.maxPoints} ${t.pointsUnit} (${res.percentage} %)`
                      : uiText.notGraded}
                  </p>
                </div>

                {res && res.scoredCount > 0 ? (
                  <span
                    className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums shrink-0 border ${
                      res.passed
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {uiText.gradeShort} {res.grade}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">—</span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* RIGHT: Grading Matrix + Detailed Student Breakdown + Teacher Comment Check + AI Student Summary */}
      <div className="lg:col-span-8 space-y-5">
        {!selectedStudent ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
            {t.selectStudentPrompt}
          </div>
        ) : (
          <>
            {/* Live Student Score Banner */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {uiText.studentEvalTitle} {assignment.title}
                </p>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {selectedStudent.firstName} {selectedStudent.lastName}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                  {uiText.criteriaEvaluated} {result.scoredCount} {uiText.ofWord} {assignment.criteria.length} &bull; {uiText.formalShort}: {result.formalPoints}/{result.formalMax} {t.pointsUnit} &bull; {uiText.contentShort}: {result.contentPoints}/{result.contentMax} {t.pointsUnit}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right tabular-nums">
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {result.totalPoints} / {result.maxPoints} {t.pointsUnit} ({result.percentage} %)
                  </div>
                  <div
                    className={`text-xs font-bold flex items-center justify-end gap-1 ${
                      result.passed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {result.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertOctagon className="w-3.5 h-3.5" />
                    )}
                    <span>{GRADE_LABELS[result.grade][language]}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onPrintStudentReport(selectedStudent, currentEval)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t.exportPdfBtn}</span>
                </button>
              </div>
            </div>

            {result.hasZeroVeto && (
              <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
                <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong>{t.zeroVetoTitle}:</strong> {t.zeroVetoAlert} ({result.zeroCriteriaNames.join(', ')})
                </div>
              </div>
            )}

            {/* Formal & Content Grading Cards with Per-Criterion Notes */}
            {[
              { title: t.formalCriteria, items: formalCriteria },
              { title: t.contentCriteria, items: contentCriteria },
            ].map((section) => (
              <div
                key={section.title}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
              >
                <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  {section.title} ({section.items.length})
                </h4>

                {section.items.length === 0 ? (
                  <p className="text-xs text-slate-500">{t.zeroCriteria}</p>
                ) : (
                  <div className="space-y-4">
                    {section.items.map((c) => {
                      const activeLevel = currentEval.scores[c.id];
                      return (
                        <div
                          key={c.id}
                          className="pb-4 border-b border-slate-100 dark:border-slate-800 last:border-none last:pb-0 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <span className="text-sm font-bold text-slate-900 dark:text-white">
                                {c.name}
                              </span>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {c.description}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                              {t.weightLabel} {c.weight} &bull;{' '}
                              {activeLevel !== undefined
                                ? `${activeLevel * c.weight}/${3 * c.weight} ${t.pointsUnit}`
                                : `${uiText.maxWord} ${3 * c.weight} ${t.pointsUnit}`}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {([3, 2, 1, 0] as CriterionLevel[]).map((lvl) => {
                              const selected = activeLevel === lvl;
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => handleSetLevel(c.id, lvl)}
                                  className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-left cursor-pointer ${
                                    selected ? levelStyles[lvl].active : levelStyles[lvl].idle
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span>{lvl} {t.pointsUnit}</span>
                                    <span className="text-[10px] opacity-85 tabular-nums">
                                      ({lvl * c.weight} {uiText.wbShort})
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-medium mt-0.5 leading-tight">
                                    {LEVEL_LABELS[lvl][language]}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Optional per-criterion evidence & improvement note */}
                          <input
                            type="text"
                            value={currentEval.criterionNotes?.[c.id] || ''}
                            onChange={(e) => handleCriterionNoteChange(c.id, e.target.value)}
                            placeholder={t.criterionNotePlaceholder}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Detailed Criterion-by-Criterion Breakdown Card for Student */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t.detailedBreakdownTitle}</span>
                </h4>
                <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
                  {result.totalPoints} / {result.maxPoints} {t.pointsUnit} ({result.percentage} %) &bull; {uiText.gradeShort} {result.grade}
                </span>
              </div>

              <div className="space-y-2.5">
                {assignment.criteria.map((c) => {
                  const lvl = currentEval.scores[c.id];
                  const earned = lvl !== undefined ? lvl * c.weight : 0;
                  const max = 3 * c.weight;
                  const note = (currentEval.criterionNotes?.[c.id] || '').trim();
                  const whyText = note || c.description;
                  const improveText =
                    lvl === 3
                      ? t.fullMasteryText
                      : lvl !== undefined
                      ? `${t.improveDefaultPrefix} ${c.description}${note ? ` (${note})` : ''}`
                      : '—';

                  return (
                    <div
                      key={c.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {c.name}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {c.category === 'formal' ? uiText.formalShort : uiText.contentShort} &bull; {t.weightLabel} {c.weight}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {lvl !== undefined ? LEVEL_LABELS[lvl][language] : uiText.notGraded}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              lvl === 3
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : lvl === 0
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                            }`}
                          >
                            {lvl !== undefined ? `${earned} / ${max}` : `— / ${max}`} {t.pointsUnit}
                          </span>
                        </div>
                      </div>

                      <div className="text-slate-700 dark:text-slate-300">
                        <strong className="text-slate-900 dark:text-white">{t.whyPointsLabel}</strong>{' '}
                        {whyText}
                      </div>
                      {lvl !== undefined && (
                        <div
                          className={
                            lvl < 3
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          <strong>{t.whatToImproveLabel}</strong> {improveText}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Teacher Comment + AI Subjectivity Check */}
            <div
              className={`rounded-2xl border p-5 space-y-3 transition-colors ${
                currentEval.commentValidation
                  ? currentEval.commentValidation.hasLabelingOrOpinion ||
                    !currentEval.commentValidation.isObjective
                    ? 'border-rose-400 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/25'
                    : 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/25'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.teacherCommentLabel}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t.teacherCommentPlaceholder}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleValidateComment}
                  disabled={validatingComment || !currentEval.teacherComment.trim()}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 ${
                    currentEval.commentValidation
                      ? currentEval.commentValidation.hasLabelingOrOpinion ||
                        !currentEval.commentValidation.isObjective
                        ? 'border-rose-400 dark:border-rose-700 bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200'
                        : 'border-emerald-400 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                      : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {validatingComment ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5" />
                  )}
                  <span>{validatingComment ? t.checkingBias : t.checkCommentBiasBtn}</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={currentEval.teacherComment}
                onChange={(e) => handleCommentChange(e.target.value)}
                placeholder={t.teacherCommentPlaceholder}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
                  currentEval.commentValidation
                    ? currentEval.commentValidation.hasLabelingOrOpinion ||
                      !currentEval.commentValidation.isObjective
                      ? 'border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900'
                      : 'border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
                }`}
              />

              {commentError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {commentError}
                </div>
              )}

              {currentEval.commentValidation && (
                <div
                  className={`rounded-xl p-3.5 border text-xs space-y-2 ${
                    currentEval.commentValidation.hasLabelingOrOpinion ||
                    !currentEval.commentValidation.isObjective
                      ? 'bg-rose-100/80 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100'
                      : 'bg-emerald-100/70 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {currentEval.commentValidation.hasLabelingOrOpinion ||
                    !currentEval.commentValidation.isObjective ? (
                      <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {currentEval.commentValidation.hasLabelingOrOpinion ||
                        !currentEval.commentValidation.isObjective
                          ? uiText.commentWarningTitle
                          : uiText.commentOkTitle}
                      </p>
                      <p className="mt-1">{currentEval.commentValidation.warningMessage}</p>
                    </div>
                  </div>

                  {(currentEval.commentValidation.hasLabelingOrOpinion ||
                    !currentEval.commentValidation.isObjective) &&
                    currentEval.commentValidation.objectiveRewrite && (
                      <div className="pt-2 border-t border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-[11px]">
                          <strong>{uiText.objectiveRewritePrefix}</strong>{' '}
                          {currentEval.commentValidation.objectiveRewrite}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            onUpsertEvaluation({
                              ...currentEval,
                              studentId: selectedStudent.id,
                              teacherComment: currentEval.commentValidation?.objectiveRewrite || '',
                              commentValidation: {
                                isObjective: true,
                                hasLabelingOrOpinion: false,
                                warningMessage: uiText.appliedObjectiveMsg,
                              },
                              updatedAt: new Date().toISOString(),
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer whitespace-nowrap"
                        >
                          {t.acceptRewriteBtn}
                        </button>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* AI Natural Language Export Summary for Student */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>{t.studentSummaryHeading}</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {uiText.aiSummaryHint} ({selectedStudent.firstName}, {uiText.gradeShort} {result.grade})
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiSummary}
                  disabled={generatingSummary}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {generatingSummary ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {generatingSummary
                      ? t.generatingSummary
                      : currentEval.aiSummary
                      ? uiText.regenerateAiBtn
                      : t.generateStudentSummaryBtn}
                  </span>
                </button>
              </div>

              {summaryError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {summaryError}
                </div>
              )}

              {currentEval.aiSummary ? (
                <div className="space-y-3">
                  <textarea
                    rows={8}
                    value={currentEval.aiSummary}
                    onChange={(e) =>
                      onUpsertEvaluation({
                        ...currentEval,
                        studentId: selectedStudent.id,
                        aiSummary: e.target.value,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      {copiedSummary ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedSummary ? t.copiedBtn : t.copySummaryBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onPrintStudentReport(selectedStudent, currentEval)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t.exportStudentPdfBtn}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500">
                  {uiText.aiSummaryEmptyHint}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

