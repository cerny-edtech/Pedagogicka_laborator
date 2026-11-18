import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Plus,
  Trash2,
  FileText,
  FileJson,
  Printer,
  Upload,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Compass,
  UserCheck,
  MessageSquareHeart,
  ChevronDown,
  ChevronUp,
  LogOut,
  Check,
} from 'lucide-react';
import { Language, ObservationRecord } from '../../types';
import { getT } from '../../i18n/translations';
import { buildObservationPrintableHtml, PrintableDocData } from '../../utils/printExport';
import { triggerBlobDownload } from '../../utils/clipboard';
import {
  createRealGoogleDoc,
  hasCachedToken,
  initAuth,
  logoutGoogle,
  signInWithGoogle,
} from '../../services/googleDocsService';

interface ObservationsAppProps {
  language: Language;
  isDark: boolean;
  observations: ObservationRecord[];
  onUpdateObservations: (items: ObservationRecord[]) => void;
  activeObservationId: string;
  onSelectObservationId: (id: string) => void;
  onPrintCustomHtml: (data: PrintableDocData) => void;
}

interface AiAssistPayload {
  guidingQuestions: string[];
  pedagogicalTip: string;
  suggestedAnswer: string;
  suggestedItems?: string[];
  source?: string;
}

type ObservationSubTab = 'reflective' | 'evaluative' | 'guide';

export function createBlankObservation(defaultTopic = 'Náslechový seminář'): ObservationRecord {
  const now = new Date();
  const formattedDateTime = now.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    seminarTopic: defaultTopic,
    dateTime: formattedDateTime,
    observerName: '',
    observedTeacherName: '',
    reflective: {
      learned: ['', '', ''],
      delighted: ['', '', ''],
      application: '',
      furtherLearning: '',
      expectationsMet: '',
    },
    evaluative: {
      lessonGoals: '',
      methodsAndAchievement: '',
      safeAtmosphere: '',
      recommendations: ['', '', ''],
      improvementsNextTime: '',
      groupConnection: '',
      clarity: '',
      metaphorAndReason: '',
      issuesObserved: '',
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export const ObservationsApp: React.FC<ObservationsAppProps> = ({
  language,
  observations,
  onUpdateObservations,
  activeObservationId,
  onSelectObservationId,
  onPrintCustomHtml,
}) => {
  const t = getT(language).observations;

  const [subTab, setSubTab] = useState<ObservationSubTab>('reflective');
  const [showInlineGuide, setShowInlineGuide] = useState<boolean>(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Google Workspace Auth state
  const [googleConnected, setGoogleConnected] = useState<boolean>(() => hasCachedToken());
  const [googleUserEmail, setGoogleUserEmail] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Export & Import status banner
  const [exportingDocs, setExportingDocs] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
    url?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-field AI Assistant state
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null);
  const [aiHelpers, setAiHelpers] = useState<Record<string, AiAssistPayload>>({});
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setGoogleConnected(true);
        setGoogleUserEmail(user.email || user.displayName || 'Google');
      },
      () => {
        setGoogleConnected(hasCachedToken());
        if (!hasCachedToken()) setGoogleUserEmail('');
      }
    );
    return () => unsub();
  }, []);

  const activeObservation = useMemo(() => {
    return observations.find((o) => o.id === activeObservationId) || observations[0] || null;
  }, [observations, activeObservationId]);

  const updateActive = (updater: (prev: ObservationRecord) => ObservationRecord) => {
    if (!activeObservation) return;
    const next = updater({
      ...activeObservation,
      updatedAt: new Date().toISOString(),
    });
    onUpdateObservations(observations.map((o) => (o.id === next.id ? next : o)));
  };

  // Completion counter (14 total prompts)
  const completionStats = useMemo(() => {
    if (!activeObservation) return { filled: 0, total: 14 };
    const r = activeObservation.reflective;
    const e = activeObservation.evaluative;
    const checks = [
      r.learned.some((x) => x.trim().length > 0),
      r.delighted.some((x) => x.trim().length > 0),
      r.application.trim().length > 0,
      r.furtherLearning.trim().length > 0,
      r.expectationsMet.trim().length > 0,
      e.lessonGoals.trim().length > 0,
      e.methodsAndAchievement.trim().length > 0,
      e.safeAtmosphere.trim().length > 0,
      e.recommendations.some((x) => x.trim().length > 0),
      e.improvementsNextTime.trim().length > 0,
      e.groupConnection.trim().length > 0,
      e.clarity.trim().length > 0,
      e.metaphorAndReason.trim().length > 0,
      e.issuesObserved.trim().length > 0,
    ];
    return {
      filled: checks.filter(Boolean).length,
      total: checks.length,
    };
  }, [activeObservation]);

  const handleCreateNew = () => {
    const fresh = createBlankObservation(t.defaultTopic);
    onUpdateObservations([fresh, ...observations]);
    onSelectObservationId(fresh.id);
    setConfirmDeleteId(null);
    setAiHelpers({});
    setAiErrors({});
  };

  const handleDeleteRecord = (id: string) => {
    if (observations.length <= 1) return;
    const remaining = observations.filter((o) => o.id !== id);
    onUpdateObservations(remaining);
    if (activeObservationId === id && remaining[0]) {
      onSelectObservationId(remaining[0].id);
    }
    setConfirmDeleteId(null);
  };

  const handleGoogleConnect = async (): Promise<boolean> => {
    setAuthLoading(true);
    try {
      const res = await signInWithGoogle();
      setGoogleConnected(true);
      setGoogleUserEmail(res.user.email || res.user.displayName || 'Google');
      return true;
    } catch (err: any) {
      console.error(err);
      setStatusBanner({
        type: 'err',
        msg: err?.message || t.docsErrorMsg,
      });
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleConnected(false);
    setGoogleUserEmail('');
  };

  // Build plain-text formatted document for Google Docs
  const buildGoogleDocText = (obs: ObservationRecord): string => {
    const lines: string[] = [
      t.title,
      '==================================================',
      `${t.seminarTopicLabel}: ${obs.seminarTopic || '-'}`,
      `${t.dateTimeLabel}: ${obs.dateTime || '-'}`,
      ...(obs.observerName ? [`${t.observerNameLabel}: ${obs.observerName}`] : []),
      ...(obs.observedTeacherName ? [`${t.observedNameLabel}: ${obs.observedTeacherName}`] : []),
      '',
      `1) ${t.reflectiveSectionTitle.toUpperCase()}`,
      '--------------------------------------------------',
      `${t.reflectiveQuestions.learnedTitle}`,
      `1. ${obs.reflective.learned[0] || '-'}`,
      `2. ${obs.reflective.learned[1] || '-'}`,
      `3. ${obs.reflective.learned[2] || '-'}`,
      '',
      `${t.reflectiveQuestions.delightedTitle}`,
      `1. ${obs.reflective.delighted[0] || '-'}`,
      `2. ${obs.reflective.delighted[1] || '-'}`,
      `3. ${obs.reflective.delighted[2] || '-'}`,
      '',
      `${t.reflectiveQuestions.applicationTitle}`,
      obs.reflective.application || '-',
      '',
      `${t.reflectiveQuestions.furtherLearningTitle}`,
      obs.reflective.furtherLearning || '-',
      '',
      `${t.reflectiveQuestions.expectationsMetTitle}`,
      obs.reflective.expectationsMet || '-',
      '',
      `2) ${t.evaluativeSectionTitle.toUpperCase()}`,
      '--------------------------------------------------',
      `${t.evaluativeQuestions.lessonGoalsTitle}`,
      obs.evaluative.lessonGoals || '-',
      '',
      `${t.evaluativeQuestions.methodsAndAchievementTitle}`,
      obs.evaluative.methodsAndAchievement || '-',
      '',
      `${t.evaluativeQuestions.safeAtmosphereTitle}`,
      obs.evaluative.safeAtmosphere || '-',
      '',
      `${t.evaluativeQuestions.recommendationsTitle}`,
      `1. ${obs.evaluative.recommendations[0] || '-'}`,
      `2. ${obs.evaluative.recommendations[1] || '-'}`,
      `3. ${obs.evaluative.recommendations[2] || '-'}`,
      '',
      `${t.evaluativeQuestions.improvementsNextTimeTitle}`,
      obs.evaluative.improvementsNextTime || '-',
      '',
      `${t.evaluativeQuestions.groupConnectionTitle}`,
      obs.evaluative.groupConnection || '-',
      '',
      `${t.evaluativeQuestions.clarityTitle}`,
      obs.evaluative.clarity || '-',
      '',
      `${t.evaluativeQuestions.metaphorAndReasonTitle}`,
      obs.evaluative.metaphorAndReason || '-',
      '',
      `${t.evaluativeQuestions.issuesObservedTitle}`,
      obs.evaluative.issuesObserved || '-',
    ];
    return lines.join('\n');
  };

  const handleExportGoogleDoc = async () => {
    if (!activeObservation) return;
    setExportingDocs(true);
    setStatusBanner(null);
    try {
      const ok = googleConnected || (await handleGoogleConnect());
      if (!ok) {
        setExportingDocs(false);
        return;
      }
      const docTitle = `${t.tabs.reflective.split(' ')[0]} & ${t.tabs.evaluative.split(' ')[0]} — ${activeObservation.seminarTopic || t.defaultTopic} (${activeObservation.dateTime || ''})`;
      const { documentUrl } = await createRealGoogleDoc(docTitle, buildGoogleDocText(activeObservation));
      setStatusBanner({
        type: 'ok',
        msg: t.docsSuccessMsg,
        url: documentUrl,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'err',
        msg: err?.message || t.docsErrorMsg,
      });
    } finally {
      setExportingDocs(false);
    }
  };

  const handleExportJson = () => {
    if (!activeObservation) return;
    const slug = (activeObservation.seminarTopic || 'naslech')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_');
    triggerBlobDownload(
      `naslech_${slug}.json`,
      JSON.stringify(activeObservation, null, 2),
      'application/json;charset=utf-8'
    );
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cleanJson = String(reader.result || '{}').replace(/^\uFEFF/, '');
        const parsed = JSON.parse(cleanJson);
        if (!parsed || !parsed.reflective || !parsed.evaluative) {
          setStatusBanner({ type: 'err', msg: t.jsonImportError });
          return;
        }
        const imported: ObservationRecord = {
          ...createBlankObservation(t.defaultTopic),
          ...parsed,
          id: `obs_${Date.now()}`,
          reflective: {
            learned: Array.isArray(parsed.reflective.learned)
              ? [
                  parsed.reflective.learned[0] || '',
                  parsed.reflective.learned[1] || '',
                  parsed.reflective.learned[2] || '',
                ]
              : ['', '', ''],
            delighted: Array.isArray(parsed.reflective.delighted)
              ? [
                  parsed.reflective.delighted[0] || '',
                  parsed.reflective.delighted[1] || '',
                  parsed.reflective.delighted[2] || '',
                ]
              : ['', '', ''],
            application: String(parsed.reflective.application || ''),
            furtherLearning: String(parsed.reflective.furtherLearning || ''),
            expectationsMet: String(parsed.reflective.expectationsMet || ''),
          },
          evaluative: {
            lessonGoals: String(parsed.evaluative.lessonGoals || ''),
            methodsAndAchievement: String(parsed.evaluative.methodsAndAchievement || ''),
            safeAtmosphere: String(parsed.evaluative.safeAtmosphere || ''),
            recommendations: Array.isArray(parsed.evaluative.recommendations)
              ? [
                  parsed.evaluative.recommendations[0] || '',
                  parsed.evaluative.recommendations[1] || '',
                  parsed.evaluative.recommendations[2] || '',
                ]
              : ['', '', ''],
            improvementsNextTime: String(parsed.evaluative.improvementsNextTime || ''),
            groupConnection: String(parsed.evaluative.groupConnection || ''),
            clarity: String(parsed.evaluative.clarity || ''),
            metaphorAndReason: String(parsed.evaluative.metaphorAndReason || ''),
            issuesObserved: String(parsed.evaluative.issuesObserved || ''),
          },
          updatedAt: new Date().toISOString(),
        };
        onUpdateObservations([imported, ...observations]);
        onSelectObservationId(imported.id);
        setStatusBanner({ type: 'ok', msg: t.jsonImportSuccess });
      } catch {
        setStatusBanner({ type: 'err', msg: t.jsonImportError });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPdf = () => {
    if (!activeObservation) return;
    onPrintCustomHtml(buildObservationPrintableHtml(activeObservation, language));
  };

  // Call per-field AI Assistant
  const handleAskAi = async (params: {
    section: 'reflective' | 'evaluative';
    fieldKey: string;
    fieldQuestion: string;
    currentValue: string | string[];
    isTripleList?: boolean;
  }) => {
    if (!activeObservation) return;
    const compositeKey = `${params.section}.${params.fieldKey}`;
    setAiLoadingField(compositeKey);
    setAiErrors((prev) => {
      const next = { ...prev };
      delete next[compositeKey];
      return next;
    });

    try {
      const res = await fetch('/api/gemini/observation-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          section: params.section,
          fieldKey: params.fieldKey,
          fieldQuestion: params.fieldQuestion,
          seminarTopic: activeObservation.seminarTopic,
          dateTime: activeObservation.dateTime,
          currentValue: params.currentValue,
          isTripleList: Boolean(params.isTripleList),
        }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data: AiAssistPayload = await res.json();
      setAiHelpers((prev) => ({
        ...prev,
        [compositeKey]: data,
      }));
    } catch {
      setAiErrors((prev) => ({
        ...prev,
        [compositeKey]: t.aiErrorMsg,
      }));
    } finally {
      setAiLoadingField(null);
    }
  };

  const applyAiTextSuggestion = (
    section: 'reflective' | 'evaluative',
    fieldKey: string,
    suggestedAnswer: string
  ) => {
    updateActive((prev) => {
      if (section === 'reflective') {
        return {
          ...prev,
          reflective: {
            ...prev.reflective,
            [fieldKey]: suggestedAnswer,
          },
        };
      }
      return {
        ...prev,
        evaluative: {
          ...prev.evaluative,
          [fieldKey]: suggestedAnswer,
        },
      };
    });
  };

  const applyAiTripleSuggestion = (
    section: 'reflective' | 'evaluative',
    fieldKey: 'learned' | 'delighted' | 'recommendations',
    suggestedItems: string[]
  ) => {
    updateActive((prev) => {
      const existing: [string, string, string] =
        section === 'reflective'
          ? fieldKey === 'delighted'
            ? prev.reflective.delighted
            : prev.reflective.learned
          : prev.evaluative.recommendations;

      const merged: [string, string, string] = [
        existing[0].trim() || suggestedItems[0] || '',
        existing[1].trim() || suggestedItems[1] || '',
        existing[2].trim() || suggestedItems[2] || '',
      ];

      if (section === 'reflective') {
        return {
          ...prev,
          reflective: {
            ...prev.reflective,
            [fieldKey]: merged,
          },
        };
      }
      return {
        ...prev,
        evaluative: {
          ...prev.evaluative,
          recommendations: merged,
        },
      };
    });
  };

  if (!activeObservation) return null;

  // Reusable renderer for single textarea field + AI assistant
  const renderTextFieldCard = (cfg: {
    section: 'reflective' | 'evaluative';
    fieldKey: string;
    numberLabel: string;
    title: string;
    hint: string;
    value: string;
    onChange: (val: string) => void;
    rows?: number;
  }) => {
    const compositeKey = `${cfg.section}.${cfg.fieldKey}`;
    const isLoading = aiLoadingField === compositeKey;
    const helper = aiHelpers[compositeKey];
    const err = aiErrors[compositeKey];

    return (
      <div
        key={compositeKey}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              <span className="text-indigo-600 dark:text-indigo-400 mr-1.5 tabular-nums">
                {cfg.numberLabel}
              </span>
              {cfg.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{cfg.hint}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              handleAskAi({
                section: cfg.section,
                fieldKey: cfg.fieldKey,
                fieldQuestion: cfg.title,
                currentValue: cfg.value,
                isTripleList: false,
              })
            }
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-60"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isLoading ? t.aiAssisting : t.aiAssistBtn}</span>
          </button>
        </div>

        <textarea
          rows={cfg.rows || 3}
          value={cfg.value}
          onChange={(e) => cfg.onChange(e.target.value)}
          placeholder={t.textareaPlaceholder}
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />

        {err && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {helper && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3 text-xs">
            <div>
              <p className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                {t.aiQuestionsLabel}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                {helper.guidingQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-2.5 text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">{t.aiTipLabel}</strong>{' '}
              {helper.pedagogicalTip}
            </div>

            <div className="space-y-1.5">
              <p className="font-bold text-slate-800 dark:text-slate-200">{t.aiDraftLabel}</p>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                {helper.suggestedAnswer}
              </p>
              <button
                type="button"
                onClick={() =>
                  applyAiTextSuggestion(cfg.section, cfg.fieldKey, helper.suggestedAnswer)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.aiApplyBtn}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Reusable renderer for 3 numbered items (1. 2. 3.) + AI assistant
  const renderTripleFieldCard = (cfg: {
    section: 'reflective' | 'evaluative';
    fieldKey: 'learned' | 'delighted' | 'recommendations';
    numberLabel: string;
    title: string;
    hint: string;
    items: [string, string, string];
    onChangeItem: (index: 0 | 1 | 2, val: string) => void;
  }) => {
    const compositeKey = `${cfg.section}.${cfg.fieldKey}`;
    const isLoading = aiLoadingField === compositeKey;
    const helper = aiHelpers[compositeKey];
    const err = aiErrors[compositeKey];

    return (
      <div
        key={compositeKey}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-[240px]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
              <span className="text-indigo-600 dark:text-indigo-400 mr-1.5 tabular-nums">
                {cfg.numberLabel}
              </span>
              {cfg.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{cfg.hint}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              handleAskAi({
                section: cfg.section,
                fieldKey: cfg.fieldKey,
                fieldQuestion: cfg.title,
                currentValue: cfg.items,
                isTripleList: true,
              })
            }
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition cursor-pointer shrink-0 disabled:opacity-60"
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isLoading ? t.aiAssisting : t.aiAssistBtn}</span>
          </button>
        </div>

        <div className="space-y-2">
          {([0, 1, 2] as const).map((idx) => (
            <div key={idx} className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 tabular-nums">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={cfg.items[idx]}
                onChange={(e) => cfg.onChangeItem(idx, e.target.value)}
                placeholder={t.itemPlaceholder}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          ))}
        </div>

        {err && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {helper && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-3 text-xs">
            <div>
              <p className="font-bold text-indigo-900 dark:text-indigo-200 mb-1">
                {t.aiQuestionsLabel}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-700 dark:text-slate-300">
                {helper.guidingQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-white/80 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-2.5 text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-white">{t.aiTipLabel}</strong>{' '}
              {helper.pedagogicalTip}
            </div>

            <div className="space-y-1.5">
              <p className="font-bold text-slate-800 dark:text-slate-200">{t.aiDraftLabel}</p>
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1 text-slate-700 dark:text-slate-300">
                {(helper.suggestedItems && helper.suggestedItems.length > 0
                  ? helper.suggestedItems
                  : [helper.suggestedAnswer]
                ).map((item, i) => (
                  <div key={i}>
                    <strong>{i + 1}.</strong> {item}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  applyAiTripleSuggestion(
                    cfg.section,
                    cfg.fieldKey,
                    helper.suggestedItems && helper.suggestedItems.length > 0
                      ? helper.suggestedItems
                      : [helper.suggestedAnswer, '', '']
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t.aiFillEmptyBtn}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Module Header, Google Auth, Sheet Switcher & Exports */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>

          {/* Google Connect Control */}
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
                  title={t.signOutGoogleTitle}
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
                <span>{authLoading ? t.connectingGoogle : t.connectGoogleBtn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sheet Selector + Create/Delete + Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.recordLabel}
            </span>
            <select
              value={activeObservation.id}
              onChange={(e) => {
                onSelectObservationId(e.target.value);
                setConfirmDeleteId(null);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white max-w-xs sm:max-w-sm cursor-pointer"
            >
              {observations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.seminarTopic || t.defaultTopic} ({o.dateTime || '-'})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newRecordBtn}</span>
            </button>

            {observations.length > 1 && (
              confirmDeleteId === activeObservation.id ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteRecord(activeObservation.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t.confirmDeleteBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(activeObservation.id)}
                  title={t.deleteRecordBtn}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 hover:border-rose-300 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )
            )}
          </div>

          {/* Export Buttons: Google Docs, JSON (Export + Import), PDF */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 tabular-nums">
              {t.progressLabel} {completionStats.filled} / {completionStats.total}
            </span>

            <button
              type="button"
              onClick={handleExportGoogleDoc}
              disabled={exportingDocs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {exportingDocs ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>{exportingDocs ? t.exportingDocs : t.exportDocsBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{t.exportJsonBtn}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.importJsonBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.exportPdfBtn}</span>
            </button>
          </div>
        </div>

        {/* Status Banner */}
        {statusBanner && (
          <div
            className={`rounded-xl p-3 border text-xs flex flex-wrap items-center justify-between gap-2 ${
              statusBanner.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusBanner.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusBanner.msg}</span>
            </div>
            {statusBanner.url && (
              <a
                href={statusBanner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline"
              >
                {t.openDocBtn}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Shared Session Details Card (Téma semináře, Datum a čas, Role) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t.headerCardTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.seminarTopicLabel}
            </label>
            <input
              type="text"
              value={activeObservation.seminarTopic}
              onChange={(e) =>
                updateActive((prev) => ({ ...prev, seminarTopic: e.target.value }))
              }
              placeholder={t.seminarTopicPlaceholder}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.dateTimeLabel}
            </label>
            <input
              type="text"
              value={activeObservation.dateTime}
              onChange={(e) =>
                updateActive((prev) => ({ ...prev, dateTime: e.target.value }))
              }
              placeholder={t.dateTimePlaceholder}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {t.observerNameLabel}
              </label>
              <input
                type="text"
                value={activeObservation.observerName || ''}
                onChange={(e) =>
                  updateActive((prev) => ({ ...prev, observerName: e.target.value }))
                }
                placeholder={t.observerNamePlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {t.observedNameLabel}
              </label>
              <input
                type="text"
                value={activeObservation.observedTeacherName || ''}
                onChange={(e) =>
                  updateActive((prev) => ({ ...prev, observedTeacherName: e.target.value }))
                }
                placeholder={t.observedNamePlaceholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs: Reflektivní část (Hodnotitel) | Hodnotící část (Hodnocený) | Průvodce & Souhrn */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setSubTab('reflective')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'reflective'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{t.tabs.reflective}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('evaluative')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'evaluative'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquareHeart className="w-4 h-4" />
            <span>{t.tabs.evaluative}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('guide')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'guide'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{t.tabs.guide}</span>
          </button>
        </div>

        {subTab !== 'guide' && (
          <button
            type="button"
            onClick={() => setShowInlineGuide((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{showInlineGuide ? t.guideToggleHide : t.guideToggleShow}</span>
            {showInlineGuide ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* TAB 1: REFLEKTIVNÍ ČÁST (HODNOTITEL) */}
      {subTab === 'reflective' && (
        <div className="space-y-4">
          {showInlineGuide && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/30 p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.guideObserverTitle}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t.guideObserverSubtitle}
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 pl-4 list-disc text-xs text-slate-700 dark:text-slate-300">
                {t.guideObserverSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {renderTripleFieldCard({
            section: 'reflective',
            fieldKey: 'learned',
            numberLabel: '1.',
            title: t.reflectiveQuestions.learnedTitle,
            hint: t.reflectiveQuestions.learnedHint,
            items: activeObservation.reflective.learned,
            onChangeItem: (idx, val) =>
              updateActive((prev) => {
                const next: [string, string, string] = [...prev.reflective.learned];
                next[idx] = val;
                return { ...prev, reflective: { ...prev.reflective, learned: next } };
              }),
          })}

          {renderTripleFieldCard({
            section: 'reflective',
            fieldKey: 'delighted',
            numberLabel: '2.',
            title: t.reflectiveQuestions.delightedTitle,
            hint: t.reflectiveQuestions.delightedHint,
            items: activeObservation.reflective.delighted,
            onChangeItem: (idx, val) =>
              updateActive((prev) => {
                const next: [string, string, string] = [...prev.reflective.delighted];
                next[idx] = val;
                return { ...prev, reflective: { ...prev.reflective, delighted: next } };
              }),
          })}

          {renderTextFieldCard({
            section: 'reflective',
            fieldKey: 'application',
            numberLabel: '3.',
            title: t.reflectiveQuestions.applicationTitle,
            hint: t.reflectiveQuestions.applicationHint,
            value: activeObservation.reflective.application,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                reflective: { ...prev.reflective, application: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'reflective',
            fieldKey: 'furtherLearning',
            numberLabel: '4.',
            title: t.reflectiveQuestions.furtherLearningTitle,
            hint: t.reflectiveQuestions.furtherLearningHint,
            value: activeObservation.reflective.furtherLearning,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                reflective: { ...prev.reflective, furtherLearning: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'reflective',
            fieldKey: 'expectationsMet',
            numberLabel: '5.',
            title: t.reflectiveQuestions.expectationsMetTitle,
            hint: t.reflectiveQuestions.expectationsMetHint,
            value: activeObservation.reflective.expectationsMet,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                reflective: { ...prev.reflective, expectationsMet: val },
              })),
          })}
        </div>
      )}

      {/* TAB 2: HODNOTÍCÍ ČÁST (HODNOCENÝ) */}
      {subTab === 'evaluative' && (
        <div className="space-y-4">
          {showInlineGuide && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/50 dark:bg-indigo-950/30 p-5 space-y-2.5">
              <div className="flex items-center gap-2">
                <MessageSquareHeart className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.guideObservedTitle}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t.guideObservedSubtitle}
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 pl-4 list-disc text-xs text-slate-700 dark:text-slate-300">
                {t.guideObservedSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'lessonGoals',
            numberLabel: '1.',
            title: t.evaluativeQuestions.lessonGoalsTitle,
            hint: t.evaluativeQuestions.lessonGoalsHint,
            value: activeObservation.evaluative.lessonGoals,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, lessonGoals: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'methodsAndAchievement',
            numberLabel: '2.',
            title: t.evaluativeQuestions.methodsAndAchievementTitle,
            hint: t.evaluativeQuestions.methodsAndAchievementHint,
            value: activeObservation.evaluative.methodsAndAchievement,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, methodsAndAchievement: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'safeAtmosphere',
            numberLabel: '3.',
            title: t.evaluativeQuestions.safeAtmosphereTitle,
            hint: t.evaluativeQuestions.safeAtmosphereHint,
            value: activeObservation.evaluative.safeAtmosphere,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, safeAtmosphere: val },
              })),
          })}

          {renderTripleFieldCard({
            section: 'evaluative',
            fieldKey: 'recommendations',
            numberLabel: '4.',
            title: t.evaluativeQuestions.recommendationsTitle,
            hint: t.evaluativeQuestions.recommendationsHint,
            items: activeObservation.evaluative.recommendations,
            onChangeItem: (idx, val) =>
              updateActive((prev) => {
                const next: [string, string, string] = [...prev.evaluative.recommendations];
                next[idx] = val;
                return { ...prev, evaluative: { ...prev.evaluative, recommendations: next } };
              }),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'improvementsNextTime',
            numberLabel: '5.',
            title: t.evaluativeQuestions.improvementsNextTimeTitle,
            hint: t.evaluativeQuestions.improvementsNextTimeHint,
            value: activeObservation.evaluative.improvementsNextTime,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, improvementsNextTime: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'groupConnection',
            numberLabel: '6.',
            title: t.evaluativeQuestions.groupConnectionTitle,
            hint: t.evaluativeQuestions.groupConnectionHint,
            value: activeObservation.evaluative.groupConnection,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, groupConnection: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'clarity',
            numberLabel: '7.',
            title: t.evaluativeQuestions.clarityTitle,
            hint: t.evaluativeQuestions.clarityHint,
            value: activeObservation.evaluative.clarity,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, clarity: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'metaphorAndReason',
            numberLabel: '8.',
            title: t.evaluativeQuestions.metaphorAndReasonTitle,
            hint: t.evaluativeQuestions.metaphorAndReasonHint,
            value: activeObservation.evaluative.metaphorAndReason,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, metaphorAndReason: val },
              })),
          })}

          {renderTextFieldCard({
            section: 'evaluative',
            fieldKey: 'issuesObserved',
            numberLabel: '9.',
            title: t.evaluativeQuestions.issuesObservedTitle,
            hint: t.evaluativeQuestions.issuesObservedHint,
            value: activeObservation.evaluative.issuesObserved,
            onChange: (val) =>
              updateActive((prev) => ({
                ...prev,
                evaluative: { ...prev.evaluative, issuesObserved: val },
              })),
          })}
        </div>
      )}

      {/* TAB 3: DUAL-PERSPECTIVE GUIDE & FULL SUMMARY PREVIEW */}
      {subTab === 'guide' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t.dualGuideIntroTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t.dualGuideIntroDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              {/* Guide Column 1: Observer / Hodnotitel */}
              <div className="rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.guideObserverTitle}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {t.guideObserverSubtitle}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2 pl-4 list-disc text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {t.guideObserverSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>

                <div className="space-y-2 pt-2 border-t border-amber-200/70 dark:border-amber-800/50 text-xs">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3">
                    <p className="font-bold text-emerald-800 dark:text-emerald-300">
                      {t.dualGoodExampleLabel}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{t.dualObserverGood}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3">
                    <p className="font-bold text-rose-800 dark:text-rose-300">
                      {t.dualWeakExampleLabel}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{t.dualObserverWeak}</p>
                  </div>
                </div>
              </div>

              {/* Guide Column 2: Observed Instructor / Hodnocený */}
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquareHeart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.guideObservedTitle}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {t.guideObservedSubtitle}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2 pl-4 list-disc text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {t.guideObservedSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>

                <div className="space-y-2 pt-2 border-t border-indigo-200/70 dark:border-indigo-800/50 text-xs">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3">
                    <p className="font-bold text-emerald-800 dark:text-emerald-300">
                      {t.dualGoodExampleLabel}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{t.dualObservedGood}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3">
                    <p className="font-bold text-rose-800 dark:text-rose-300">
                      {t.dualWeakExampleLabel}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{t.dualObservedWeak}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Complete Summary Preview */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.summaryPreviewTitle}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeObservation.seminarTopic || '-'} · {activeObservation.dateTime || '-'}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h3 className="font-bold text-indigo-700 dark:text-indigo-300">
                  {t.reflectiveSectionTitle}
                </h3>
                <div className="space-y-2.5 text-slate-700 dark:text-slate-300">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.reflectiveQuestions.learnedTitle}
                    </p>
                    <ol className="pl-4 list-decimal">
                      {activeObservation.reflective.learned.map((x, i) => (
                        <li key={i}>{x || '—'}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.reflectiveQuestions.delightedTitle}
                    </p>
                    <ol className="pl-4 list-decimal">
                      {activeObservation.reflective.delighted.map((x, i) => (
                        <li key={i}>{x || '—'}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.reflectiveQuestions.applicationTitle}
                    </p>
                    <p>{activeObservation.reflective.application || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.reflectiveQuestions.furtherLearningTitle}
                    </p>
                    <p>{activeObservation.reflective.furtherLearning || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.reflectiveQuestions.expectationsMetTitle}
                    </p>
                    <p>{activeObservation.reflective.expectationsMet || '—'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-indigo-700 dark:text-indigo-300">
                  {t.evaluativeSectionTitle}
                </h3>
                <div className="space-y-2.5 text-slate-700 dark:text-slate-300">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.lessonGoalsTitle}
                    </p>
                    <p>{activeObservation.evaluative.lessonGoals || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.methodsAndAchievementTitle}
                    </p>
                    <p>{activeObservation.evaluative.methodsAndAchievement || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.safeAtmosphereTitle}
                    </p>
                    <p>{activeObservation.evaluative.safeAtmosphere || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.recommendationsTitle}
                    </p>
                    <ol className="pl-4 list-decimal">
                      {activeObservation.evaluative.recommendations.map((x, i) => (
                        <li key={i}>{x || '—'}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.improvementsNextTimeTitle}
                    </p>
                    <p>{activeObservation.evaluative.improvementsNextTime || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.groupConnectionTitle}
                    </p>
                    <p>{activeObservation.evaluative.groupConnection || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.clarityTitle}
                    </p>
                    <p>{activeObservation.evaluative.clarity || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.metaphorAndReasonTitle}
                    </p>
                    <p>{activeObservation.evaluative.metaphorAndReason || '—'}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {t.evaluativeQuestions.issuesObservedTitle}
                    </p>
                    <p>{activeObservation.evaluative.issuesObserved || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
