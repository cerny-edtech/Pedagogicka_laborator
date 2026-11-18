import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  BookmarkPlus,
  BookmarkCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  FileText,
  DownloadCloud,
  UploadCloud,
  RefreshCw,
  BookMarked,
  Layers,
  X,
} from 'lucide-react';
import {
  CriteriaAssignment,
  CriterionCategory,
  Language,
  RubricCriterion,
} from '../../types';
import {
  getMaxAssignmentPoints,
  LEVEL_LABELS,
  parseAssignmentFromGoogleDocText,
  serializeAssignmentForGoogleDoc,
} from '../../utils/assessmentUtils';
import { translations } from '../../i18n/translations';
import {
  createRealGoogleDoc,
  listAppGoogleDocs,
  readGoogleDocContent,
} from '../../services/googleDocsService';

interface RubricBuilderTabProps {
  assignment: CriteriaAssignment;
  onUpdateAssignment: (updated: CriteriaAssignment) => void;
  onCreateImportedAssignment: (imported: Omit<CriteriaAssignment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  criteriaBank: RubricCriterion[];
  onAddToBank: (criterion: RubricCriterion) => void;
  onRemoveFromBank: (criterionId: string) => void;
  language: Language;
  googleConnected: boolean;
  onRequireGoogleConnect: () => Promise<boolean>;
}

interface SuggestedCriterion {
  name: string;
  description: string;
  category: CriterionCategory;
  weight: number;
}

export const RubricBuilderTab: React.FC<RubricBuilderTabProps> = ({
  assignment,
  onUpdateAssignment,
  onCreateImportedAssignment,
  criteriaBank,
  onAddToBank,
  onRemoveFromBank,
  language,
  googleConnected,
  onRequireGoogleConnect,
}) => {
  const t = translations[language].assessment;
  const pdfT = translations[language].pdfModal;
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedCriterion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validatingAll, setValidatingAll] = useState(false);
  const [validatingNote, setValidatingNote] = useState(false);
  const [aiActionError, setAiActionError] = useState<string | null>(null);
  const [showBankPanel, setShowBankPanel] = useState(false);

  // Google Docs export/import states
  const [docExporting, setDocExporting] = useState(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [driveDocs, setDriveDocs] = useState<Array<{ id: string; name: string; modifiedTime?: string }>>([]);
  const [loadingDriveDocs, setLoadingDriveDocs] = useState(false);
  const [importDocUrlOrId, setImportDocUrlOrId] = useState('');
  const [importingDoc, setImportingDoc] = useState(false);
  const [docMessage, setDocMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const formalCriteria = assignment.criteria.filter((c) => c.category === 'formal');
  const contentCriteria = assignment.criteria.filter((c) => c.category === 'content');
  const maxPoints = getMaxAssignmentPoints(assignment.criteria);

  const updateFields = (patch: Partial<CriteriaAssignment>) => {
    onUpdateAssignment({
      ...assignment,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddCriterion = (category: CriterionCategory) => {
    const newCrit: RubricCriterion = {
      id: `crit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      description: '',
      category,
      weight: category === 'formal' ? 3 : 7,
    };
    updateFields({ criteria: [...assignment.criteria, newCrit] });
  };

  const handleUpdateCriterion = (id: string, patch: Partial<RubricCriterion>) => {
    const next = assignment.criteria.map((c) =>
      c.id === id
        ? {
            ...c,
            ...patch,
            // Clear stale validation if user edited name/description
            validation:
              patch.name !== undefined || patch.description !== undefined
                ? undefined
                : c.validation,
          }
        : c
    );
    updateFields({ criteria: next });
  };

  const handleDeleteCriterion = (id: string) => {
    updateFields({ criteria: assignment.criteria.filter((c) => c.id !== id) });
  };

  const handleAddFromBank = (bankItem: RubricCriterion) => {
    const clone: RubricCriterion = {
      ...bankItem,
      id: `crit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      validation: undefined,
    };
    updateFields({ criteria: [...assignment.criteria, clone] });
  };

  // AI: Suggest criteria for assignment
  const handleAiSuggest = async () => {
    setSuggestLoading(true);
    setAiActionError(null);
    try {
      const res = await fetch('/api/gemini/criteria-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: assignment.title,
          subject: assignment.subject,
          description: assignment.description,
          language,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.criteria)) {
        setAiSuggestions(data.criteria);
      } else {
        throw new Error('Invalid AI suggestions payload');
      }
    } catch (err: any) {
      console.error('Failed to suggest criteria:', err);
      setAiActionError(
        language === 'en'
          ? 'Could not suggest criteria right now. Please try again.'
          : language === 'pl'
          ? 'Nie udało się zaproponować kryteriów. Spróbuj ponownie.'
          : 'Nepodařilo se navrhnout kritéria. Zkuste to prosím znovu.'
      );
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleAddSuggestion = (s: SuggestedCriterion, idx: number) => {
    const newCrit: RubricCriterion = {
      id: `crit_ai_${Date.now()}_${idx}`,
      name: s.name,
      description: s.description,
      category: s.category,
      weight: s.weight,
    };
    updateFields({ criteria: [...assignment.criteria, newCrit] });
    setAiSuggestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddAllSuggestions = () => {
    const added: RubricCriterion[] = aiSuggestions.map((s, idx) => ({
      id: `crit_ai_${Date.now()}_${idx}`,
      name: s.name,
      description: s.description,
      category: s.category,
      weight: s.weight,
    }));
    updateFields({ criteria: [...assignment.criteria, ...added] });
    setAiSuggestions([]);
  };

  // AI: Validate single criterion measurability & objectivity
  const validateSingleCriterion = async (crit: RubricCriterion) => {
    if (!crit.name.trim() && !crit.description.trim()) return;
    setValidatingId(crit.id);
    setAiActionError(null);
    try {
      const res = await fetch('/api/gemini/criteria-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: crit.name,
          description: crit.description,
          category: crit.category,
          language,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const validation = await res.json();
      handleUpdateCriterion(crit.id, { validation });
    } catch (err) {
      console.error('Validate criterion error:', err);
      setAiActionError(
        language === 'en'
          ? 'Criterion validation request failed. Please try again.'
          : language === 'pl'
          ? 'Weryfikacja kryterium nie powiodła się. Spróbuj ponownie.'
          : 'Ověření kritéria selhalo. Zkuste to prosím znovu.'
      );
    } finally {
      setValidatingId(null);
    }
  };

  const handleValidateAllCriteria = async () => {
    setValidatingAll(true);
    setAiActionError(null);
    try {
      const updatedList = await Promise.all(
        assignment.criteria.map(async (c) => {
          const res = await fetch('/api/gemini/criteria-validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: c.name,
              description: c.description,
              category: c.category,
              language,
            }),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const validation = await res.json();
          return { ...c, validation };
        })
      );
      updateFields({ criteria: updatedList });
    } catch (err) {
      console.error('Validate all error:', err);
      setAiActionError(
        language === 'en'
          ? 'Batch criteria validation failed. Please try again.'
          : language === 'pl'
          ? 'Zbiorcza weryfikacja kryteriów nie powiodła się.'
          : 'Hromadné ověření kritérií selhalo. Zkuste to prosím znovu.'
      );
    } finally {
      setValidatingAll(false);
    }
  };

  // AI: Validate general teacher note / comment for subjectivity & labeling
  const handleValidateGeneralNote = async () => {
    if (!assignment.generalNote?.trim()) return;
    setValidatingNote(true);
    setAiActionError(null);
    try {
      const res = await fetch('/api/gemini/comment-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: assignment.generalNote,
          language,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const validation = await res.json();
      updateFields({ generalNoteValidation: validation });
    } catch (err) {
      console.error('Validate general note error:', err);
      setAiActionError(
        language === 'en'
          ? 'Comment objectivity check failed. Please try again.'
          : language === 'pl'
          ? 'Sprawdzenie obiektywności komentarza nie powiodło się.'
          : 'Kontrola objektivity poznámky selhala. Zkuste to prosím znovu.'
      );
    } finally {
      setValidatingNote(false);
    }
  };

  // Google Docs: Export assignment + criteria + weights
  const handleExportToGoogleDocs = async () => {
    setDocMessage(null);
    setDocExporting(true);
    try {
      const ok = googleConnected || (await onRequireGoogleConnect());
      if (!ok) {
        setDocExporting(false);
        return;
      }
      const docContent = serializeAssignmentForGoogleDoc(assignment, language);
      const { documentUrl } = await createRealGoogleDoc(
        `${t.title}: ${assignment.title}`,
        docContent
      );
      setExportedDocUrl(documentUrl);
      setDocMessage({
        type: 'ok',
        text:
          language === 'en'
            ? 'Assignment brief, criteria, and weights were saved as a new Google Doc.'
            : language === 'pl'
            ? 'Zadanie z kryteriami i wagami zostało zapisane jako nowy Dokument Google.'
            : 'Zadání s kritérii a vahami bylo přímo uloženo jako nový Google Dokument.',
      });
    } catch (err: any) {
      setDocMessage({
        type: 'err',
        text:
          err?.message ||
          (language === 'en'
            ? 'Failed to save document to Google Drive.'
            : language === 'pl'
            ? 'Nie udało się zapisać dokumentu na Dysku Google.'
            : 'Nepodařilo se uložit dokument na Google Disk.'),
      });
    } finally {
      setDocExporting(false);
    }
  };

  // Google Docs: Open Import Modal & list documents
  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    setDocMessage(null);
    setLoadingDriveDocs(true);
    try {
      const ok = googleConnected || (await onRequireGoogleConnect());
      if (!ok) {
        setLoadingDriveDocs(false);
        return;
      }
      const files = await listAppGoogleDocs();
      setDriveDocs(files);
    } catch (err: any) {
      setDocMessage({
        type: 'err',
        text:
          err?.message ||
          (language === 'en'
            ? 'Please sign in to Google to list documents.'
            : language === 'pl'
            ? 'Zaloguj się na konto Google, aby wyświetlić dokumenty.'
            : 'Pro zobrazení dokumentů se prosím přihlaste ke Google účtu.'),
      });
    } finally {
      setLoadingDriveDocs(false);
    }
  };

  // Import parsed document
  const handleImportGoogleDoc = async (docIdOrUrl: string) => {
    if (!docIdOrUrl.trim()) return;
    setImportingDoc(true);
    setDocMessage(null);
    try {
      const ok = googleConnected || (await onRequireGoogleConnect());
      if (!ok) {
        setImportingDoc(false);
        return;
      }
      const doc = await readGoogleDocContent(docIdOrUrl);
      let parsed = parseAssignmentFromGoogleDocText(doc.text, doc.title);

      // If structured marker wasn't found (e.g., hand-written Google Doc), try Gemini parsing
      if (!parsed) {
        const res = await fetch('/api/gemini/parse-assignment-doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: doc.text,
            docTitle: doc.title,
            language,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.assignment && Array.isArray(data.assignment.criteria)) {
            parsed = {
              title: data.assignment.title || doc.title,
              subject: data.assignment.subject || 'Google Docs',
              description: data.assignment.description || '',
              passingPercentage: 60,
              criteria: data.assignment.criteria.map((c: any, idx: number) => ({
                id: `crit_gdoc_${Date.now()}_${idx}`,
                name: c.name,
                description: c.description,
                category: c.category === 'formal' ? 'formal' : 'content',
                weight: Math.min(10, Math.max(1, Number(c.weight) || 5)),
              })),
            };
          }
        }
      }

      if (!parsed) {
        throw new Error(
          language === 'en'
            ? 'Document does not contain recognizable assessment criteria.'
            : language === 'pl'
            ? 'Dokument nie zawiera rozpoznawalnych kryteriów oceny.'
            : 'Dokument neobsahuje rozpoznatelná kritéria hodnocení.'
        );
      }

      onCreateImportedAssignment(parsed);
      setShowImportModal(false);
      setImportDocUrlOrId('');
      setDocMessage({
        type: 'ok',
        text:
          language === 'en'
            ? `Assignment “${parsed.title}” (${parsed.criteria.length} criteria) imported from Google Docs.`
            : language === 'pl'
            ? `Zadanie „${parsed.title}” (${parsed.criteria.length} kryteriów) zostało zaimportowane z Google Docs.`
            : `Úkol „${parsed.title}“ (${parsed.criteria.length} kritérií) byl úspěšně importován z Google Docs.`,
      });
    } catch (err: any) {
      setDocMessage({
        type: 'err',
        text:
          err?.message ||
          (language === 'en'
            ? 'Google Doc import failed.'
            : language === 'pl'
            ? 'Import Dokumentu Google nie powiódł się.'
            : 'Import Google Dokumentu se nezdařil.'),
      });
    } finally {
      setImportingDoc(false);
    }
  };

  const renderCriterionCard = (c: RubricCriterion, index: number) => {
    const isValidating = validatingId === c.id;
    const isInBank = criteriaBank.some(
      (b) => b.name.trim().toLowerCase() === c.name.trim().toLowerCase() && b.category === c.category
    );
    const hasWarning = Boolean(
      c.validation && (!c.validation.isMeasurable || c.validation.hasSubjectiveBias)
    );
    const isVerifiedOk = Boolean(
      c.validation && c.validation.isMeasurable && !c.validation.hasSubjectiveBias
    );

    const acceptConfirmMsg =
      language === 'en'
        ? 'Objective, measurable criterion formulation applied and verified.'
        : language === 'pl'
        ? 'Zastosowano i zweryfikowano obiektywną, mierzalną treść kryterium.'
        : 'Byla přijata objektivní, přísně měřitelná formulace kritéria bez subjektivních pojmů.';

    return (
      <div
        key={c.id}
        className={`rounded-xl border p-4 transition-colors space-y-3 ${
          hasWarning
            ? 'border-rose-400 dark:border-rose-700 bg-rose-50/60 dark:bg-rose-950/30'
            : isVerifiedOk
            ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/25'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
              {index + 1}
            </span>
            <input
              type="text"
              value={c.name}
              onChange={(e) => handleUpdateCriterion(c.id, { name: e.target.value })}
              placeholder={t.critNamePlaceholder}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Weight 1-10 */}
            <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{t.weightLabel}:</span>
              <select
                value={c.weight}
                onChange={(e) => handleUpdateCriterion(c.id, { weight: Number(e.target.value) })}
                className="bg-transparent font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none tabular-nums cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                  <option key={w} value={w} className="bg-white dark:bg-slate-900">
                    {w} / 10 (max {w * 3} {t.pointsUnit})
                  </option>
                ))}
              </select>
            </label>

            {/* Category switcher */}
            <select
              value={c.category}
              onChange={(e) =>
                handleUpdateCriterion(c.id, { category: e.target.value as CriterionCategory })
              }
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              title={t.critCategoryLabel}
            >
              <option value="formal">{t.formalCriteria}</option>
              <option value="content">{t.contentCriteria}</option>
            </select>

            {/* Save to reusable bank */}
            <button
              type="button"
              onClick={() => onAddToBank(c)}
              disabled={!c.name.trim()}
              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer disabled:opacity-40 ${
                isInBank
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={t.reusableCategoriesTitle}
            >
              {isInBank ? <BookmarkCheck className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
            </button>

            {/* Validate measurability (turns red/green on result) */}
            <button
              type="button"
              onClick={() => validateSingleCriterion(c)}
              disabled={isValidating || (!c.name.trim() && !c.description.trim())}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                hasWarning
                  ? 'border-rose-400 dark:border-rose-700 bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200 hover:bg-rose-200/70'
                  : isVerifiedOk
                  ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-200/70'
                  : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60'
              }`}
              title={t.verifyObjBtn}
            >
              {isValidating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>{t.verifyObjBtn}</span>
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => handleDeleteCriterion(c.id)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title={t.deleteAssignment}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        <textarea
          rows={2}
          value={c.description}
          onChange={(e) => handleUpdateCriterion(c.id, { description: e.target.value })}
          placeholder={t.critDescPlaceholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />

        {/* Fixed 3-2-1-0 Scale Preview strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
          <div className="px-2 py-1 rounded-md bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 tabular-nums">
            <span className="font-bold text-emerald-700 dark:text-emerald-300">3 {t.pointsUnit}</span> {LEVEL_LABELS[3][language]} ({3 * c.weight} {t.pointsUnit})
          </div>
          <div className="px-2 py-1 rounded-md bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-900/60 tabular-nums">
            <span className="font-bold text-sky-700 dark:text-sky-300">2 {t.pointsUnit}</span> {LEVEL_LABELS[2][language]} ({2 * c.weight} {t.pointsUnit})
          </div>
          <div className="px-2 py-1 rounded-md bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 tabular-nums">
            <span className="font-bold text-amber-700 dark:text-amber-300">1 {t.pointsUnit}</span> {LEVEL_LABELS[1][language]} ({c.weight} {t.pointsUnit})
          </div>
          <div className="px-2 py-1 rounded-md bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/60 tabular-nums">
            <span className="font-bold text-rose-700 dark:text-rose-300">0 {t.pointsUnit}</span> {LEVEL_LABELS[0][language]}
          </div>
        </div>

        {/* AI Measurability Result Banner */}
        {c.validation && (
          <div
            className={`rounded-lg p-3.5 border text-xs flex flex-col gap-2 ${
              hasWarning
                ? 'bg-rose-100/80 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100'
                : 'bg-emerald-100/70 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
            }`}
          >
            <div className="flex items-start gap-2">
              {hasWarning ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-bold">
                  {hasWarning
                    ? language === 'en'
                      ? 'Strict Audit Failed: Subjective or insufficiently measurable criterion!'
                      : language === 'pl'
                      ? 'Audyt AI negatywny: Kryterium jest subiektywne lub niemierzalne!'
                      : 'Zamítnuto v přísném auditu AI: Kritérium je subjektivní nebo nedostatečně měřitelné!'
                    : language === 'en'
                    ? 'Verified: Criterion is concrete and objectively measurable'
                    : language === 'pl'
                    ? 'Zweryfikowano: Kryterium jest konkretne i obiektywnie mierzalne'
                    : 'Ověřeno AI: Kritérium je konkrétní a objektivně měřitelné'}
                </p>
                <p className="mt-1 leading-relaxed">{c.validation.warningMessage}</p>
              </div>
            </div>

            {hasWarning && c.validation.suggestedDescription && (
              <div className="pt-2 border-t border-rose-300/70 dark:border-rose-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-[11px] italic">
                  <strong className="not-italic">{t.applySuggestionBtn}:</strong>{' '}
                  {c.validation.suggestedName ? `${c.validation.suggestedName} — ` : ''}
                  {c.validation.suggestedDescription}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateCriterion(c.id, {
                      name: c.validation?.suggestedName || c.name,
                      description: c.validation?.suggestedDescription || c.description,
                      validation: {
                        isMeasurable: true,
                        hasSubjectiveBias: false,
                        warningMessage: acceptConfirmMsg,
                      },
                    })
                  }
                  className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] shrink-0 cursor-pointer whitespace-nowrap"
                >
                  {t.applySuggestionBtn}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Assignment Info & Google Docs Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t.assignmentDetailsTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenImportModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t.importGdocBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportToGoogleDocs}
              disabled={docExporting}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {docExporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
              <span>{t.exportGdocBtn}</span>
            </button>
          </div>
        </div>

        {docMessage && (
          <div
            className={`rounded-xl p-3 text-xs border flex flex-wrap items-center justify-between gap-2 ${
              docMessage.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {docMessage.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{docMessage.text}</span>
            </div>
            {exportedDocUrl && docMessage.type === 'ok' && (
              <a
                href={exportedDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-emerald-700 dark:text-emerald-300"
              >
                {t.openExternal}
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.titleLabel}
            </label>
            <input
              type="text"
              value={assignment.title}
              onChange={(e) => updateFields({ title: e.target.value })}
              placeholder={t.newAssignmentTitle}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.subjectLabel}
            </label>
            <input
              type="text"
              value={assignment.subject}
              onChange={(e) => updateFields({ subject: e.target.value })}
              placeholder={t.subjectLabel}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {t.descLabel}
          </label>
          <textarea
            rows={3}
            value={assignment.description}
            onChange={(e) => updateFields({ description: e.target.value })}
            placeholder={t.newAssignmentDesc}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>

        {/* Summary KPI Strip + AI / Bank Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            <span>
              {t.formalCriteria}: <strong className="text-slate-900 dark:text-white">{formalCriteria.length}</strong>
            </span>
            <span>
              {t.contentCriteria}: <strong className="text-slate-900 dark:text-white">{contentCriteria.length}</strong>
            </span>
            <span>
              {t.totalMaxPointsLabel}: <strong className="text-indigo-600 dark:text-indigo-400">{maxPoints} {t.pointsUnit}</strong>
            </span>
            <span>
              {t.passMinPointsLabel}: <strong className="text-slate-900 dark:text-white">{Math.ceil(0.6 * maxPoints)} {t.pointsUnit}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBankPanel(!showBankPanel)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                showBankPanel
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <BookMarked className="w-4 h-4" />
              <span>{t.reusableCategoriesTitle} ({criteriaBank.length})</span>
            </button>

            <button
              type="button"
              onClick={handleValidateAllCriteria}
              disabled={validatingAll || assignment.criteria.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
            >
              {validatingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{validatingAll ? t.verifyingObj : t.verifyObjBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={suggestLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              {suggestLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{suggestLoading ? t.aiSuggesting : t.aiSuggestCriteria}</span>
            </button>
          </div>
        </div>

        {aiActionError && (
          <div className="rounded-xl p-3 text-xs border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{aiActionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiActionError(null)}
              className="font-bold underline cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Reusable Criterion Bank Drawer */}
      {showBankPanel && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t.reusableCategoriesTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowBankPanel(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {criteriaBank.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <span>{b.category === 'formal' ? t.formalCriteria : t.contentCriteria}</span>
                    <span className="tabular-nums">{t.weightLabel} {b.weight}/10</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{b.name}</h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                    {b.description}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleAddFromBank(b)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addReusableBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFromBank(b.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                    title={t.deleteAssignment}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Suggested Criteria Panel */}
      {aiSuggestions.length > 0 && (
        <div className="rounded-2xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t.suggestedSectionTitle}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddAllSuggestions}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
              >
                {t.addOneClick} ({aiSuggestions.length})
              </button>
              <button
                type="button"
                onClick={() => setAiSuggestions([])}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {pdfT.close}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiSuggestions.map((s, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    <span>{s.category === 'formal' ? t.formalCriteria : t.contentCriteria}</span>
                    <span className="tabular-nums">{t.weightLabel}: {s.weight}/10</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{s.name}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{s.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddSuggestion(s, idx)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addOneClick}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION A: FORMAL CRITERIA */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              {t.formalCriteria} ({formalCriteria.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleAddCriterion('formal')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-500 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t.addOneClick} ({t.formalCriteria})</span>
          </button>
        </div>

        {formalCriteria.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
            {t.zeroCriteria}
          </div>
        ) : (
          <div className="space-y-3">
            {formalCriteria.map((c, idx) => renderCriterionCard(c, idx))}
          </div>
        )}
      </section>

      {/* SECTION B: CONTENT CRITERIA */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {t.contentCriteria} ({contentCriteria.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => handleAddCriterion('content')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-500 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{t.addOneClick} ({t.contentCriteria})</span>
          </button>
        </div>

        {contentCriteria.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
            {t.zeroCriteria}
          </div>
        ) : (
          <div className="space-y-3">
            {contentCriteria.map((c, idx) => renderCriterionCard(c, idx))}
          </div>
        )}
      </section>

      {/* SECTION C: TEACHER GENERAL COMMENT / METODICKÁ POZNÁMKA + AI SUBJECTIVITY CHECK */}
      <section
        className={`rounded-2xl border p-5 space-y-3 transition-colors ${
          assignment.generalNoteValidation
            ? assignment.generalNoteValidation.hasLabelingOrOpinion ||
              !assignment.generalNoteValidation.isObjective
              ? 'border-rose-400 dark:border-rose-700 bg-rose-50/50 dark:bg-rose-950/25'
              : 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/25'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.teacherCommentLabel}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleValidateGeneralNote}
            disabled={validatingNote || !assignment.generalNote?.trim()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 ${
              assignment.generalNoteValidation
                ? assignment.generalNoteValidation.hasLabelingOrOpinion ||
                  !assignment.generalNoteValidation.isObjective
                  ? 'border-rose-400 dark:border-rose-700 bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200'
                  : 'border-emerald-400 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
            }`}
          >
            {validatingNote ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
            <span>{validatingNote ? t.checkingBias : t.checkCommentBiasBtn}</span>
          </button>
        </div>

        <textarea
          rows={3}
          value={assignment.generalNote || ''}
          onChange={(e) =>
            updateFields({ generalNote: e.target.value, generalNoteValidation: undefined })
          }
          placeholder={t.teacherCommentPlaceholder}
          className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
            assignment.generalNoteValidation
              ? assignment.generalNoteValidation.hasLabelingOrOpinion ||
                !assignment.generalNoteValidation.isObjective
                ? 'border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900'
                : 'border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
          }`}
        />

        {assignment.generalNoteValidation && (
          <div
            className={`rounded-xl p-3.5 border text-xs space-y-2 ${
              assignment.generalNoteValidation.hasLabelingOrOpinion ||
              !assignment.generalNoteValidation.isObjective
                ? 'bg-rose-100/80 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100'
                : 'bg-emerald-100/70 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
            }`}
          >
            <div className="flex items-start gap-2">
              {assignment.generalNoteValidation.hasLabelingOrOpinion ||
              !assignment.generalNoteValidation.isObjective ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {assignment.generalNoteValidation.hasLabelingOrOpinion ||
                  !assignment.generalNoteValidation.isObjective
                    ? language === 'en'
                      ? 'Warning: Comment contains subjective opinion, unverified claim, or student labeling!'
                      : language === 'pl'
                      ? 'Uwaga: Komentarz zawiera subiektywną opinię lub etykietowanie ucznia!'
                      : 'Pozor: Komentář obsahuje subjektivní názor, dojem nebo nálepkování!'
                    : language === 'en'
                    ? 'Objective evidence-based evaluation verified'
                    : language === 'pl'
                    ? 'Komentarz rzeczowy i oparty na faktach'
                    : 'Komentář je věcný a respektuje objektivní evaluaci práce'}
                </p>
                <p className="mt-1">{assignment.generalNoteValidation.warningMessage}</p>
              </div>
            </div>

            {(assignment.generalNoteValidation.hasLabelingOrOpinion ||
              !assignment.generalNoteValidation.isObjective) &&
              assignment.generalNoteValidation.objectiveRewrite && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-[11px]">
                    <strong>{t.acceptRewriteBtn}:</strong>{' '}
                    {assignment.generalNoteValidation.objectiveRewrite}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      updateFields({
                        generalNote: assignment.generalNoteValidation?.objectiveRewrite || '',
                        generalNoteValidation: {
                          isObjective: true,
                          hasLabelingOrOpinion: false,
                          warningMessage:
                            language === 'en'
                              ? 'Objective evidence-based formulation applied.'
                              : language === 'pl'
                              ? 'Zastosowano obiektywną, rzeczową treść komentarza.'
                              : 'Byl použit věcný komentář bez subjektivních soudů a nálepkování.',
                        },
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
      </section>

      {/* Google Docs Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.importGdocBtn}
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Google Docs URL / ID:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={importDocUrlOrId}
                  onChange={(e) => setImportDocUrlOrId(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => handleImportGoogleDoc(importDocUrlOrId)}
                  disabled={importingDoc || !importDocUrlOrId.trim()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  {importingDoc ? '...' : 'Import'}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Google Drive:
              </p>
              {loadingDriveDocs ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  ...
                </div>
              ) : driveDocs.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  {language === 'en'
                    ? 'No Google Docs found in Drive yet.'
                    : language === 'pl'
                    ? 'Nie znaleziono dokumentów Google na Dysku.'
                    : 'Na Google Disku nebyly nalezeny žádné dokumenty.'}
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {driveDocs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {d.name}
                        </p>
                        {d.modifiedTime && (
                          <p className="text-[11px] text-slate-500">
                            {new Date(d.modifiedTime).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImportGoogleDoc(d.id)}
                        disabled={importingDoc}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-indigo-600 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                      >
                        Import
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
