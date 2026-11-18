import React, { useEffect, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Sliders,
  Table2,
  Users,
  BarChart3,
  LogOut,
} from 'lucide-react';
import {
  CriteriaAssignment,
  Language,
  RubricCriterion,
  Student,
  StudentCriterionEvaluation,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  hasCachedToken,
  initAuth,
  logoutGoogle,
  signInWithGoogle,
} from '../../services/googleDocsService';
import { RubricBuilderTab } from './RubricBuilderTab';
import { ScaleAndBoundariesTab } from './ScaleAndBoundariesTab';
import { StudentGradingTab } from './StudentGradingTab';
import { AssessmentDashboardTab } from './AssessmentDashboardTab';

export type AssessmentSubTab = 'builder' | 'scale' | 'grading' | 'dashboard';

interface AssessmentAppProps {
  language: Language;
  isDark: boolean;
  assignments: CriteriaAssignment[];
  onUpdateAssignments: (list: CriteriaAssignment[]) => void;
  activeAssignmentId: string;
  onSelectAssignmentId: (id: string) => void;
  evaluations: StudentCriterionEvaluation[];
  onUpdateEvaluations: (list: StudentCriterionEvaluation[]) => void;
  criteriaBank: RubricCriterion[];
  onUpdateCriteriaBank: (bank: RubricCriterion[]) => void;
  students: Student[];
  onUpdateStudents: (students: Student[]) => void;
  onPrintCustomHtml: (data: {
    title: string;
    subtitle?: string;
    contentHtml: string;
    filename: string;
  }) => void;
}

export const AssessmentApp: React.FC<AssessmentAppProps> = ({
  language,
  assignments,
  onUpdateAssignments,
  activeAssignmentId,
  onSelectAssignmentId,
  evaluations,
  onUpdateEvaluations,
  criteriaBank,
  onUpdateCriteriaBank,
  students,
  onUpdateStudents,
  onPrintCustomHtml,
}) => {
  const t = translations[language].assessment;
  const [subTab, setSubTab] = useState<AssessmentSubTab>('builder');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    students[0]?.id || ''
  );

  // Google Workspace Auth State
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(hasCachedToken());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setGoogleUserEmail(user.email || user.displayName || 'Google');
        setGoogleConnected(true);
      },
      () => {
        setGoogleConnected(false);
        setGoogleUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const handleGoogleConnect = async (): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogle();
      setGoogleUserEmail(res.user.email || res.user.displayName || 'Google');
      setGoogleConnected(true);
      return true;
    } catch (err: any) {
      setAuthError(
        err?.message ||
          (language === 'en'
            ? 'Google sign-in was cancelled or failed.'
            : language === 'pl'
            ? 'Logowanie Google zostało anulowane lub nie powiodło się.'
            : 'Přihlášení ke Google účtu bylo zrušeno nebo se nezdařilo.')
      );
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleConnected(false);
    setGoogleUserEmail(null);
  };

  const activeAssignment =
    assignments.find((a) => a.id === activeAssignmentId) || assignments[0];

  const handleCreateAssignment = () => {
    const newId = `assign_${Date.now()}`;
    const blank: CriteriaAssignment = {
      id: newId,
      title: `${t.newAssignmentTitle} ${assignments.length + 1}`,
      subject: t.subjectLabel,
      description: '',
      passingPercentage: 60,
      criteria: [],
      generalNote: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateAssignments([...assignments, blank]);
    onSelectAssignmentId(newId);
    setSubTab('builder');
  };

  const handleCreateImportedAssignment = (
    imported: Omit<CriteriaAssignment, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const newId = `assign_imp_${Date.now()}`;
    const full: CriteriaAssignment = {
      ...imported,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onUpdateAssignments([...assignments, full]);
    onSelectAssignmentId(newId);
  };

  const handleDeleteAssignment = (id: string) => {
    if (assignments.length <= 1) return;
    const remaining = assignments.filter((a) => a.id !== id);
    onUpdateAssignments(remaining);
    onUpdateEvaluations(evaluations.filter((e) => e.assignmentId !== id));
    if (activeAssignmentId === id && remaining[0]) {
      onSelectAssignmentId(remaining[0].id);
    }
  };

  const handleUpdateActiveAssignment = (updated: CriteriaAssignment) => {
    onUpdateAssignments(assignments.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleAddToBank = (crit: RubricCriterion) => {
    const exists = criteriaBank.some(
      (b) =>
        b.name.trim().toLowerCase() === crit.name.trim().toLowerCase() &&
        b.category === crit.category
    );
    if (exists) return;
    onUpdateCriteriaBank([
      ...criteriaBank,
      {
        ...crit,
        id: `bank_${Date.now()}`,
        validation: undefined,
      },
    ]);
  };

  const handleRemoveFromBank = (id: string) => {
    onUpdateCriteriaBank(criteriaBank.filter((b) => b.id !== id));
  };

  const handleUpsertEvaluation = (ev: StudentCriterionEvaluation) => {
    const idx = evaluations.findIndex(
      (e) => e.assignmentId === ev.assignmentId && e.studentId === ev.studentId
    );
    if (idx >= 0) {
      const next = [...evaluations];
      next[idx] = ev;
      onUpdateEvaluations(next);
    } else {
      onUpdateEvaluations([...evaluations, ev]);
    }
  };

  // Helper to print rubric & boundaries PDF
  const handlePrintRubric = async () => {
    if (!activeAssignment) return;
    const { buildRubricPrintableHtml } = await import('../../utils/printExport');
    onPrintCustomHtml(buildRubricPrintableHtml(activeAssignment, language));
  };

  // Helper to print individual student report PDF
  const handlePrintStudentReport = async (
    student: Student,
    evaluation: StudentCriterionEvaluation
  ) => {
    if (!activeAssignment) return;
    const { buildStudentEvaluationPrintableHtml } = await import('../../utils/printExport');
    onPrintCustomHtml(
      buildStudentEvaluationPrintableHtml(activeAssignment, student, evaluation, language)
    );
  };

  // Helper to print class dashboard PDF
  const handlePrintDashboard = async () => {
    if (!activeAssignment) return;
    const { buildAssessmentDashboardPrintableHtml } = await import('../../utils/printExport');
    onPrintCustomHtml(
      buildAssessmentDashboardPrintableHtml(
        activeAssignment,
        students,
        evaluations.filter((e) => e.assignmentId === activeAssignment.id),
        language
      )
    );
  };

  if (!activeAssignment) return null;

  const stepButtons: { id: AssessmentSubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'builder', label: t.steps.builder, icon: <Sliders className="w-4 h-4" /> },
    { id: 'scale', label: t.steps.scale, icon: <Table2 className="w-4 h-4" /> },
    { id: 'grading', label: t.steps.grading, icon: <Users className="w-4 h-4" /> },
    { id: 'dashboard', label: t.steps.dashboard, icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-App Top Header & Assignment Switcher */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          {/* Google Workspace Sign-In Control (Official Google Sign-In button style) */}
          <div className="flex items-center gap-2">
            {googleConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-xs">
                <span className="font-semibold text-emerald-800 dark:text-emerald-200 truncate max-w-[180px]">
                  Google: {googleUserEmail}
                </span>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="p-1 rounded-md text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
                  title={language === 'en' ? 'Sign out' : language === 'pl' ? 'Wyloguj z Google' : 'Odhlásit z Google'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={authLoading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>
                  {authLoading
                    ? language === 'en'
                      ? 'Connecting...'
                      : language === 'pl'
                      ? 'Łączenie...'
                      : 'Připojování...'
                    : language === 'en'
                    ? 'Connect Google Docs & Sheets'
                    : language === 'pl'
                    ? 'Połącz Google Docs i Arkusze'
                    : 'Připojit Google Docs & Tabulky'}
                </span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="font-bold underline cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>
        )}

        {/* Assignment Switcher Row (each assignment is isolated) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.titleLabel}:
            </span>
            <select
              value={activeAssignment.id}
              onChange={(e) => onSelectAssignmentId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white max-w-xs sm:max-w-md cursor-pointer"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.criteria.length})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateAssignment}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newAssignment}</span>
            </button>

            {assignments.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteAssignment(activeAssignment.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                title={t.deleteAssignment}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {t.passThreshold}
          </div>
        </div>

        {/* 4-Step Sub-App Navigation */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
          {stepButtons.map((step) => {
            const active = subTab === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setSubTab(step.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {step.icon}
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      {subTab === 'builder' && (
        <RubricBuilderTab
          assignment={activeAssignment}
          onUpdateAssignment={handleUpdateActiveAssignment}
          onCreateImportedAssignment={handleCreateImportedAssignment}
          criteriaBank={criteriaBank}
          onAddToBank={handleAddToBank}
          onRemoveFromBank={handleRemoveFromBank}
          language={language}
          googleConnected={googleConnected}
          onRequireGoogleConnect={handleGoogleConnect}
        />
      )}

      {subTab === 'scale' && (
        <ScaleAndBoundariesTab
          assignment={activeAssignment}
          language={language}
          googleConnected={googleConnected}
          onRequireGoogleConnect={handleGoogleConnect}
          onPrintRubric={handlePrintRubric}
        />
      )}

      {subTab === 'grading' && (
        <StudentGradingTab
          assignment={activeAssignment}
          students={students}
          onUpdateStudents={onUpdateStudents}
          evaluations={evaluations}
          onUpsertEvaluation={handleUpsertEvaluation}
          selectedStudentId={selectedStudentId}
          onSelectStudentId={setSelectedStudentId}
          language={language}
          onPrintStudentReport={handlePrintStudentReport}
        />
      )}

      {subTab === 'dashboard' && (
        <AssessmentDashboardTab
          assignment={activeAssignment}
          students={students}
          evaluations={evaluations}
          selectedStudentId={selectedStudentId}
          onSelectStudentId={setSelectedStudentId}
          language={language}
          googleConnected={googleConnected}
          onRequireGoogleConnect={handleGoogleConnect}
          onPrintDashboard={handlePrintDashboard}
        />
      )}
    </div>
  );
};
