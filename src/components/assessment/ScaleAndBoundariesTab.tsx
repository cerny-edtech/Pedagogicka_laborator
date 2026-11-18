import React, { useEffect, useRef, useState } from 'react';
import {
  Printer,
  AlertOctagon,
  Award,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react';
import { CriteriaAssignment, Language } from '../../types';
import {
  computeGradeBoundaries,
  getMaxAssignmentPoints,
  LEVEL_LABELS,
  serializeAssignmentForGoogleDoc,
} from '../../utils/assessmentUtils';
import { copyTextToClipboard } from '../../utils/clipboard';
import { translations } from '../../i18n/translations';
import { createRealGoogleDoc } from '../../services/googleDocsService';

interface ScaleAndBoundariesTabProps {
  assignment: CriteriaAssignment;
  language: Language;
  googleConnected: boolean;
  onRequireGoogleConnect: () => Promise<boolean>;
  onPrintRubric: () => void;
}

export const ScaleAndBoundariesTab: React.FC<ScaleAndBoundariesTabProps> = ({
  assignment,
  language,
  googleConnected,
  onRequireGoogleConnect,
  onPrintRubric,
}) => {
  const t = translations[language].assessment;
  const [exportingDoc, setExportingDoc] = useState(false);
  const [docStatus, setDocStatus] = useState<{ type: 'ok' | 'err'; msg: string; url?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const maxPoints = getMaxAssignmentPoints(assignment.criteria);
  const formalCriteria = assignment.criteria.filter((c) => c.category === 'formal');
  const contentCriteria = assignment.criteria.filter((c) => c.category === 'content');
  const formalMax = getMaxAssignmentPoints(formalCriteria);
  const contentMax = getMaxAssignmentPoints(contentCriteria);
  const boundaries = computeGradeBoundaries(maxPoints, assignment.passingPercentage);

  const handleSaveGoogleDoc = async () => {
    setExportingDoc(true);
    setDocStatus(null);
    try {
      const ok = googleConnected || (await onRequireGoogleConnect());
      if (!ok) {
        setExportingDoc(false);
        return;
      }
      const text = serializeAssignmentForGoogleDoc(assignment, language);
      const { documentUrl } = await createRealGoogleDoc(
        `${t.title}: ${assignment.title}`,
        text
      );
      setDocStatus({
        type: 'ok',
        msg:
          language === 'en'
            ? 'Assignment, rubric scale, and computed grade boundaries saved to Google Docs.'
            : language === 'pl'
            ? 'Zadanie, skala oraz obliczone progi ocen zostały zapisane w Google Docs.'
            : 'Zadání, škála i vypočtené hranice známek byly uloženy do Google Docs.',
        url: documentUrl,
      });
    } catch (err: any) {
      setDocStatus({
        type: 'err',
        msg:
          err?.message ||
          (language === 'en'
            ? 'Saving to Google Docs failed.'
            : language === 'pl'
            ? 'Zapis do Google Docs nie powiódł się.'
            : 'Uložení do Google Docs selhalo.'),
      });
    } finally {
      setExportingDoc(false);
    }
  };

  const handleCopyPlainText = async () => {
    const ok = await copyTextToClipboard(serializeAssignmentForGoogleDoc(assignment, language));
    if (ok) {
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const passLabel = language === 'en' ? 'Pass' : language === 'pl' ? 'Zaliczono' : 'Splněno';
  const failLabel = language === 'en' ? 'Fail' : language === 'pl' ? 'Niezaliczono' : 'Nesplněno';
  const statusCol = language === 'en' ? 'Status' : language === 'pl' ? 'Status' : 'Stav';

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {t.scaleHeader}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.scaleSubheader}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyPlainText}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? t.copiedBtn : t.copySummaryBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveGoogleDoc}
            disabled={exportingDoc}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer disabled:opacity-50"
          >
            {exportingDoc ? (
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            ) : (
              <DownloadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            )}
            <span>{t.exportGdocBtn}</span>
          </button>

          <button
            type="button"
            onClick={onPrintRubric}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t.exportPdfBtn}</span>
          </button>
        </div>
      </div>

      {docStatus && (
        <div
          className={`rounded-xl p-3 border text-xs flex flex-wrap items-center justify-between gap-2 ${
            docStatus.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {docStatus.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{docStatus.msg}</span>
          </div>
          {docStatus.url && (
            <a
              href={docStatus.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              {t.openExternal}
            </a>
          )}
        </div>
      )}

      {/* Printable In-App Export Sheet */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-8 shadow-xs">
        {/* Assignment Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {assignment.subject || t.title}
            </p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
              {assignment.title}
            </h3>
            {assignment.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                {assignment.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t.formalCriteria}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{formalMax} {t.pointsUnit}</div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{t.contentCriteria}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{contentMax} {t.pointsUnit}</div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
              <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">Max</div>
              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{maxPoints} {t.pointsUnit}</div>
            </div>
          </div>
        </div>

        {/* Grade Boundaries + Zero Veto Rule */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {t.boundariesHeading}
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3.5">{t.gradeCol}</th>
                    <th className="py-2.5 px-3.5">{t.rangePctCol}</th>
                    <th className="py-2.5 px-3.5">{t.pointsRangeCol} ({maxPoints} {t.pointsUnit})</th>
                    <th className="py-2.5 px-3.5">{statusCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {boundaries.map((b) => {
                    const isPass = b.grade <= 4;
                    return (
                      <tr key={b.grade} className="bg-white dark:bg-slate-900">
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                          {b.label[language]}
                        </td>
                        <td className="py-2.5 px-3.5 tabular-nums text-slate-700 dark:text-slate-300">
                          {b.minPct} % – {b.maxPct} %
                        </td>
                        <td className="py-2.5 px-3.5 font-semibold tabular-nums text-slate-900 dark:text-white">
                          {b.minPoints} – {b.maxPoints} {t.pointsUnit}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isPass
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {isPass ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertOctagon className="w-3.5 h-3.5" />
                            )}
                            {isPass ? passLabel : failLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.gradeScaleHeading}
            </h4>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2.5 text-xs">
              {([3, 2, 1, 0] as const).map((lvl) => (
                <div
                  key={lvl}
                  className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-slate-700/60 last:border-none last:pb-0"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {LEVEL_LABELS[lvl][language]}
                  </span>
                  <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {lvl} {t.pointsUnit} &times; {t.weightLabel.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{t.zeroVetoTitle}</p>
                <p className="leading-relaxed">
                  {t.passMinPointsLabel}: <strong>{Math.ceil((assignment.passingPercentage / 100) * maxPoints)} / {maxPoints} {t.pointsUnit}</strong>. {t.zeroVetoDesc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Criteria Detail Tables */}
        {[
          { title: t.formalCriteria, items: formalCriteria, sectionMax: formalMax },
          { title: t.contentCriteria, items: contentCriteria, sectionMax: contentMax },
        ].map((group) => (
          <div key={group.title} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {group.title} ({group.items.length})
              </h4>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                Max: {group.sectionMax} {t.pointsUnit}
              </span>
            </div>

            {group.items.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{t.zeroCriteria}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-1/4">{t.critNameLabel}</th>
                      <th className="py-2.5 px-3">{t.critDescLabel}</th>
                      <th className="py-2.5 px-3 w-20 text-center">{t.weightLabel}</th>
                      <th className="py-2.5 px-3 w-28 text-right">{t.pointsUnit} (0–3 &times; w.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {group.items.map((c) => (
                      <tr key={c.id} className="bg-white dark:bg-slate-900">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white align-top">
                          {c.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 align-top">
                          {c.description}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold tabular-nums text-indigo-600 dark:text-indigo-400 align-top">
                          {c.weight}/10
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 dark:text-slate-300 align-top">
                          0 / {c.weight} / {c.weight * 2} / <strong>{c.weight * 3}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
