import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookMarked,
  ChevronDown,
  Edit3,
  FileDown,
  HelpCircle,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Language } from '../../types';
import {
  ABOUT_CARD_ORDER,
  AboutCardData,
  AboutCardId,
  AboutContentMap,
  loadAboutContent,
  resetAboutContent,
  saveAboutContent,
} from './aboutData';

interface AboutAppProps {
  language: Language;
  onPrintCustomHtml: (data: {
    title: string;
    subtitle?: string;
    contentHtml: string;
    filename: string;
  }) => void;
}

const UI_TEXT: Record<
  Language,
  {
    pageTitle: string;
    pageSubtitle: string;
    overviewMeta: string;
    openSection: string;
    backToCards: string;
    exportPdfAll: string;
    exportPdfSection: string;
    editSection: string;
    saveDone: string;
    resetDefault: string;
    confirmReset: string;
    cancelReset: string;
    expandAll: string;
    collapseAll: string;
    sectionsCountLabel: (n: number) => string;
    faqCountLabel: (n: number) => string;
    editFields: {
      cardSummary: string;
      subtitle: string;
      leadText: string;
      blocksHeading: string;
      blockTitle: string;
      blockBody: string;
      addBlock: string;
      faqHeading: string;
      faqQuestion: string;
      faqAnswer: string;
      addFaq: string;
    };
  }
> = {
  cs: {
    pageTitle: 'O projektu',
    pageSubtitle: 'Licence · FAQ · Metodika · Autor',
    overviewMeta: 'Vyberte jednu ze čtyř informačních karet pro zobrazení podrobností.',
    openSection: 'Zobrazit informace',
    backToCards: 'Zpět na přehled (4 karty)',
    exportPdfAll: 'Exportovat vše (PDF)',
    exportPdfSection: 'Exportovat sekci (PDF)',
    editSection: 'Upravit obsah',
    saveDone: 'Uložit a zavřít úpravy',
    resetDefault: 'Obnovit výchozí text',
    confirmReset: 'Potvrdit obnovení výchozího textu',
    cancelReset: 'Zrušit',
    expandAll: 'Rozbalit vše',
    collapseAll: 'Sbalit vše',
    sectionsCountLabel: (n) => `${n} ${n === 1 ? 'sekce' : n < 5 ? 'sekce' : 'sekcí'}`,
    faqCountLabel: (n) => `${n} ${n === 1 ? 'otázka' : n < 5 ? 'otázky' : 'otázek'}`,
    editFields: {
      cardSummary: 'Krátký popis na kartě',
      subtitle: 'Podtitulek detailu',
      leadText: 'Úvodní odstavec',
      blocksHeading: 'Textové oddíly',
      blockTitle: 'Nadpis oddílu',
      blockBody: 'Obsah oddílu',
      addBlock: 'Přidat textový oddíl',
      faqHeading: 'Otázky a odpovědi (FAQ)',
      faqQuestion: 'Otázka',
      faqAnswer: 'Odpověď',
      addFaq: 'Přidat otázku',
    },
  },
  en: {
    pageTitle: 'About Project',
    pageSubtitle: 'License · FAQ · Methodology · Author',
    overviewMeta: 'Select any of the four documentation cards to open full details.',
    openSection: 'Open section',
    backToCards: 'Back to 4 cards',
    exportPdfAll: 'Export All (PDF)',
    exportPdfSection: 'Export Section (PDF)',
    editSection: 'Edit content',
    saveDone: 'Save & finish editing',
    resetDefault: 'Reset to default',
    confirmReset: 'Confirm reset to default',
    cancelReset: 'Cancel',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    sectionsCountLabel: (n) => `${n} ${n === 1 ? 'section' : 'sections'}`,
    faqCountLabel: (n) => `${n} ${n === 1 ? 'question' : 'questions'}`,
    editFields: {
      cardSummary: 'Short card summary',
      subtitle: 'Section subtitle',
      leadText: 'Lead paragraph',
      blocksHeading: 'Content blocks',
      blockTitle: 'Block heading',
      blockBody: 'Block body',
      addBlock: 'Add content block',
      faqHeading: 'Questions & Answers (FAQ)',
      faqQuestion: 'Question',
      faqAnswer: 'Answer',
      addFaq: 'Add question',
    },
  },
  pl: {
    pageTitle: 'O projekcie',
    pageSubtitle: 'Licencja · FAQ · Metodyka · Autor',
    overviewMeta: 'Wybierz jedną z czterech kart informacyjnych, aby wyświetlić szczegóły.',
    openSection: 'Otwórz sekcję',
    backToCards: 'Powrót do 4 kart',
    exportPdfAll: 'Eksportuj całość (PDF)',
    exportPdfSection: 'Eksportuj sekcję (PDF)',
    editSection: 'Edytuj treść',
    saveDone: 'Zapisz i zamknij edycję',
    resetDefault: 'Przywróć domyślne',
    confirmReset: 'Potwierdź przywrócenie',
    cancelReset: 'Anuluj',
    expandAll: 'Rozwiń wszystkie',
    collapseAll: 'Zwiń wszystkie',
    sectionsCountLabel: (n) => `${n} ${n === 1 ? 'sekcja' : 'sekcje'}`,
    faqCountLabel: (n) => `${n} ${n === 1 ? 'pytanie' : 'pytań'}`,
    editFields: {
      cardSummary: 'Krótki opis na karcie',
      subtitle: 'Podtytuł sekcji',
      leadText: 'Akapit wprowadzający',
      blocksHeading: 'Bloki treści',
      blockTitle: 'Nagłówek bloku',
      blockBody: 'Treść bloku',
      addBlock: 'Dodaj blok treści',
      faqHeading: 'Pytania i odpowiedzi (FAQ)',
      faqQuestion: 'Pytanie',
      faqAnswer: 'Odpowiedź',
      addFaq: 'Dodaj pytanie',
    },
  },
};

function escHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escMultiline(val: unknown): string {
  return escHtml(val).replace(/\n/g, '<br/>');
}

export function buildAboutPrintableHtml(
  contentMap: AboutContentMap,
  language: Language,
  sectionId?: AboutCardId | null
): { title: string; subtitle: string; contentHtml: string; filename: string } {
  const ui = UI_TEXT[language] || UI_TEXT.cs;
  const targets = sectionId ? [contentMap[sectionId]] : ABOUT_CARD_ORDER.map((id) => contentMap[id]);

  const sectionsHtml = targets
    .map((sec) => {
      const blocksHtml = sec.blocks
        .map(
          (b) => `
            <div style="margin-bottom:12px;">
              <h4 style="margin:0 0 4px 0; color:#0f172a;">${escHtml(b.heading)}</h4>
              <p style="margin:0; color:#334155;">${escMultiline(b.body)}</p>
            </div>
          `
        )
        .join('');

      const faqHtml =
        sec.faqItems && sec.faqItems.length > 0
          ? `<div style="margin-top:12px;">
              ${sec.faqItems
                .map(
                  (item, idx) => `
                  <div style="padding:10px 12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; background:#ffffff;">
                    <p style="margin:0 0 4px 0; font-weight:700; color:#0f172a;">${idx + 1}. ${escHtml(item.question)}</p>
                    <p style="margin:0; color:#334155;">${escMultiline(item.answer)}</p>
                  </div>`
                )
                .join('')}
            </div>`
          : '';

      return `
        <section style="margin-bottom:22px; padding-bottom:16px; border-bottom:1px solid #e2e8f0;">
          <h2 style="margin:0 0 4px 0;">${escHtml(sec.title)} — ${escHtml(sec.subtitle)}</h2>
          <p style="margin:0 0 10px 0; color:#475569;">${escMultiline(sec.leadText)}</p>
          ${blocksHtml}
          ${faqHtml}
        </section>
      `;
    })
    .join('');

  return {
    title: sectionId ? `${ui.pageTitle} — ${contentMap[sectionId].title}` : ui.pageTitle,
    subtitle: ui.pageSubtitle,
    contentHtml: sectionsHtml,
    filename: sectionId ? `o_projektu_${sectionId}` : 'o_projektu_komplet',
  };
}

export const AboutApp: React.FC<AboutAppProps> = ({ language, onPrintCustomHtml }) => {
  const ui = UI_TEXT[language] || UI_TEXT.cs;

  const [contentMap, setContentMap] = useState<AboutContentMap>(() => loadAboutContent(language));
  const [selectedCard, setSelectedCard] = useState<AboutCardId | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [openFaqIndexes, setOpenFaqIndexes] = useState<number[]>([0]);

  useEffect(() => {
    setContentMap(loadAboutContent(language));
    setIsEditing(false);
    setConfirmingReset(false);
  }, [language]);

  const cardIcons: Record<AboutCardId, { icon: React.ReactNode; hoverAccent: string }> = {
    license: {
      icon: <Scale className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
      hoverAccent: 'hover:border-indigo-500/50',
    },
    faq: {
      icon: <HelpCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      hoverAccent: 'hover:border-amber-500/50',
    },
    methodology: {
      icon: <BookMarked className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      hoverAccent: 'hover:border-emerald-500/50',
    },
    author: {
      icon: <UserCheck className="w-6 h-6 text-violet-600 dark:text-violet-400" />,
      hoverAccent: 'hover:border-violet-500/50',
    },
  };

  const activeSection: AboutCardData | null = selectedCard ? contentMap[selectedCard] : null;

  const handleOpenCard = (cardId: AboutCardId) => {
    setSelectedCard(cardId);
    setIsEditing(false);
    setConfirmingReset(false);
    if (cardId === 'faq') {
      setOpenFaqIndexes([0]);
    }
  };

  const handleUpdateSection = (updated: AboutCardData) => {
    const next: AboutContentMap = {
      ...contentMap,
      [updated.id]: updated,
    };
    setContentMap(next);
    saveAboutContent(language, next);
  };

  const handleResetAllToDefault = () => {
    const defaults = resetAboutContent(language);
    setContentMap(defaults);
    setConfirmingReset(false);
    setIsEditing(false);
  };

  const toggleFaqIndex = (idx: number) => {
    setOpenFaqIndexes((prev) =>
      prev.includes(idx) ? prev.filter((item) => item !== idx) : [...prev, idx]
    );
  };

  const handleExportPdf = () => {
    onPrintCustomHtml(buildAboutPrintableHtml(contentMap, language, selectedCard));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sub-App Top Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            {ui.pageTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activeSection ? `${activeSection.title} · ${activeSection.subtitle}` : ui.pageSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedCard && (
            <button
              type="button"
              onClick={() => {
                setSelectedCard(null);
                setIsEditing(false);
                setConfirmingReset(false);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{ui.backToCards}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-600 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{selectedCard ? ui.exportPdfSection : ui.exportPdfAll}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Four-Card Overview */}
      {!activeSection && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 px-1">
            {ui.overviewMeta}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ABOUT_CARD_ORDER.map((cardId, idx) => {
              const card = contentMap[cardId];
              const visual = cardIcons[cardId];
              const countText =
                cardId === 'faq' && card.faqItems
                  ? ui.faqCountLabel(card.faqItems.length)
                  : ui.sectionsCountLabel(card.blocks.length);

              return (
                <div
                  key={card.id}
                  onClick={() => handleOpenCard(card.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenCard(card.id);
                    }
                  }}
                  className={`group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${visual.hoverAccent}`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="p-3 w-fit rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        {visual.icon}
                      </div>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                        0{idx + 1}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {card.metaLabel} · <span className="tabular-nums">{countText}</span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {card.title}
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {card.cardSummary}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                    <span className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 group-hover:bg-indigo-600 dark:bg-slate-800 dark:group-hover:bg-indigo-600 text-white font-semibold text-xs tracking-wide transition-colors whitespace-nowrap">
                      <span>{ui.openSection}</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Selected Section Detail View */}
      {activeSection && (
        <div className="space-y-5">
          {/* Quick Segmented Section Switcher + Edit Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
              {ABOUT_CARD_ORDER.map((id) => {
                const isActive = activeSection.id === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleOpenCard(id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {contentMap[id].title}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing((prev) => !prev);
                  setConfirmingReset(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isEditing
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
              >
                {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                <span>{isEditing ? ui.saveDone : ui.editSection}</span>
              </button>

              {isEditing && !confirmingReset && (
                <button
                  type="button"
                  onClick={() => setConfirmingReset(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-600 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{ui.resetDefault}</span>
                </button>
              )}

              {isEditing && confirmingReset && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleResetAllToDefault}
                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {ui.confirmReset}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {ui.cancelReset}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Detail Article Container */}
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-8">
            {/* Article Header */}
            <header className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                  {cardIcons[activeSection.id].icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeSection.metaLabel}
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
                    {activeSection.title} — {activeSection.subtitle}
                  </h2>
                </div>
              </div>
              <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl pt-2">
                {activeSection.leadText}
              </p>
            </header>

            {/* READ-ONLY PRESENTATION */}
            {!isEditing && (
              <div className="space-y-8 max-w-3xl">
                {activeSection.blocks.map((block, index) => (
                  <section
                    key={index}
                    className={
                      index > 0
                        ? 'pt-6 border-t border-slate-100 dark:border-slate-800/80 space-y-2'
                        : 'space-y-2'
                    }
                  >
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {block.heading}
                    </h3>
                    <p className="text-sm sm:text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {block.body}
                    </p>
                  </section>
                ))}

                {/* Interactive FAQ Accordion (only in FAQ section) */}
                {activeSection.id === 'faq' &&
                  activeSection.faqItems &&
                  activeSection.faqItems.length > 0 && (
                    <section className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                          {ui.editFields.faqHeading}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenFaqIndexes(
                                activeSection.faqItems!.map((_, i) => i)
                              )
                            }
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                          >
                            {ui.expandAll}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenFaqIndexes([])}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                          >
                            {ui.collapseAll}
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
                        {activeSection.faqItems.map((item, idx) => {
                          const isOpen = openFaqIndexes.includes(idx);
                          return (
                            <div key={idx} className="py-4">
                              <button
                                type="button"
                                onClick={() => toggleFaqIndex(idx)}
                                aria-expanded={isOpen}
                                className="w-full flex items-center justify-between gap-4 text-left cursor-pointer group"
                              >
                                <span className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  <span className="font-mono text-xs text-slate-400 dark:text-slate-500 mr-2 tabular-nums">
                                    {String(idx + 1).padStart(2, '0')}.
                                  </span>
                                  {item.question}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                                    isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
                                  }`}
                                />
                              </button>
                              {isOpen && (
                                <p className="mt-3 pl-7 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                  {item.answer}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
              </div>
            )}

            {/* INLINE CONTENT EDITOR */}
            {isEditing && (
              <div className="space-y-6 max-w-3xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {ui.editFields.subtitle}
                    </span>
                    <input
                      type="text"
                      value={activeSection.subtitle}
                      onChange={(e) =>
                        handleUpdateSection({ ...activeSection, subtitle: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {ui.editFields.cardSummary}
                    </span>
                    <input
                      type="text"
                      value={activeSection.cardSummary}
                      onChange={(e) =>
                        handleUpdateSection({ ...activeSection, cardSummary: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {ui.editFields.leadText}
                  </span>
                  <textarea
                    rows={3}
                    value={activeSection.leadText}
                    onChange={(e) =>
                      handleUpdateSection({ ...activeSection, leadText: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </label>

                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {ui.editFields.blocksHeading}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSection({
                          ...activeSection,
                          blocks: [
                            ...activeSection.blocks,
                            { heading: `${activeSection.blocks.length + 1}.`, body: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{ui.editFields.addBlock}</span>
                    </button>
                  </div>

                  {activeSection.blocks.map((block, bIdx) => (
                    <div
                      key={bIdx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={block.heading}
                          placeholder={ui.editFields.blockTitle}
                          onChange={(e) => {
                            const nextBlocks = activeSection.blocks.map((b, i) =>
                              i === bIdx ? { ...b, heading: e.target.value } : b
                            );
                            handleUpdateSection({ ...activeSection, blocks: nextBlocks });
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white"
                        />
                        {activeSection.blocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextBlocks = activeSection.blocks.filter((_, i) => i !== bIdx);
                              handleUpdateSection({ ...activeSection, blocks: nextBlocks });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={block.body}
                        placeholder={ui.editFields.blockBody}
                        onChange={(e) => {
                          const nextBlocks = activeSection.blocks.map((b, i) =>
                            i === bIdx ? { ...b, body: e.target.value } : b
                          );
                          handleUpdateSection({ ...activeSection, blocks: nextBlocks });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  ))}
                </div>

                {activeSection.id === 'faq' && (
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {ui.editFields.faqHeading}
                      </h3>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSection({
                            ...activeSection,
                            faqItems: [
                              ...(activeSection.faqItems || []),
                              { question: '', answer: '' },
                            ],
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{ui.editFields.addFaq}</span>
                      </button>
                    </div>

                    {(activeSection.faqItems || []).map((item, fIdx) => (
                      <div
                        key={fIdx}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={item.question}
                            placeholder={ui.editFields.faqQuestion}
                            onChange={(e) => {
                              const nextFaq = (activeSection.faqItems || []).map((q, i) =>
                                i === fIdx ? { ...q, question: e.target.value } : q
                              );
                              handleUpdateSection({ ...activeSection, faqItems: nextFaq });
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextFaq = (activeSection.faqItems || []).filter(
                                (_, i) => i !== fIdx
                              );
                              handleUpdateSection({ ...activeSection, faqItems: nextFaq });
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={item.answer}
                          placeholder={ui.editFields.faqAnswer}
                          onChange={(e) => {
                            const nextFaq = (activeSection.faqItems || []).map((q, i) =>
                              i === fIdx ? { ...q, answer: e.target.value } : q
                            );
                            handleUpdateSection({ ...activeSection, faqItems: nextFaq });
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>
        </div>
      )}
    </div>
  );
};
