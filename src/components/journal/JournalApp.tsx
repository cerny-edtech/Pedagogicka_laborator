import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Sparkles,
  Volume2,
  VolumeX,
  Mic,
  Square,
  Play,
  Image as ImageIcon,
  PenTool,
  Calendar,
  Share2,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Check,
  TrendingUp,
  Flame,
  FileText,
} from 'lucide-react';
import {
  JournalEntry,
  JournalPrompt,
  SeasonalCover,
  MoodEmoji,
  Language,
} from '../../types';
import { translations } from '../../i18n/translations';
import { Sketchpad } from './Sketchpad';
import { SEASONAL_COVERS, getDefaultSeasonalCover, getLocalizedJournalPrompt } from '../../utils/initialData';
import { buildJournalPrintableHtml, PrintableDocData } from '../../utils/printExport';

interface JournalAppProps {
  language: Language;
  isDark: boolean;
  entries: JournalEntry[];
  onUpdateEntries: (entries: JournalEntry[]) => void;
  prompts: JournalPrompt[];
  onUpdatePrompts: (prompts: JournalPrompt[]) => void;
  onPrint: () => void;
  onPrintCustomHtml?: (data: PrintableDocData) => void;
  typewriterEnabled: boolean;
  onToggleTypewriter: () => void;
}

const DEFAULT_SPARK_BY_LANG: Record<Language, string> = {
  cs: 'Podle teorie J. P. Guilforda je tvořivost schopností přecházet mezi divergentní fází (hledání neobvyklých možností) a konvergentní fází (výběr nejlepšího řešení). Která fáze vám dnes dělala větší radost?',
  en: 'According to J. P. Guilford’s theory, creativity is the ability to move fluidly between divergent thinking (generating novel possibilities) and convergent thinking (selecting the strongest solution). Which phase energized you most today?',
  pl: 'Według teorii J. P. Guilforda twórczość polega na przechodzeniu między myśleniem dywergencyjnym (szukaniem niezwykłych rozwiązań) a konwergencyjnym (wyborem najlepszego). Która faza sprawiła Ci dziś więcej radości?',
};

export const JournalApp: React.FC<JournalAppProps> = ({
  language,
  isDark,
  entries,
  onUpdateEntries,
  prompts,
  onUpdatePrompts,
  onPrint,
  onPrintCustomHtml,
  typewriterEnabled,
  onToggleTypewriter,
}) => {
  const t = translations[language].journal;
  const pdfT = translations[language].pdfModal;

  // Tabs: write | reflection | history | settings
  const [activeTab, setActiveTab] = useState<'write' | 'reflection' | 'history' | 'settings'>('write');

  const toLocalDateStr = (d: Date = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Today's date YYYY-MM-DD (local time)
  const todayStr = useMemo(() => toLocalDateStr(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Seasonal cover image
  const [currentCover, setCurrentCover] = useState<SeasonalCover>(() => getDefaultSeasonalCover());

  // Show sketchpad toggle
  const [showSketchpad, setShowSketchpad] = useState<boolean>(false);

  // Voice recording state & refs to avoid stale closures inside onstop
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [sparkError, setSparkError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef<number>(0);

  // Reflection filters
  const [reflectionDays, setReflectionDays] = useState<number>(10);
  const [selectedPromptFilters, setSelectedPromptFilters] = useState<string[]>([]);
  const [userReflectionText, setUserReflectionText] = useState<string>('');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState<boolean>(false);

  // Bottom Academic Spark loading
  const [academicSpark, setAcademicSpark] = useState<string>(DEFAULT_SPARK_BY_LANG[language]);
  const [hasCustomSpark, setHasCustomSpark] = useState<boolean>(false);
  const [isGeneratingSpark, setIsGeneratingSpark] = useState<boolean>(false);

  useEffect(() => {
    if (!hasCustomSpark) {
      setAcademicSpark(DEFAULT_SPARK_BY_LANG[language]);
    }
  }, [language, hasCustomSpark]);

  // Google Docs export preview modal
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);

  // Find or initialize current day's entry
  const currentEntry = useMemo(() => {
    const existing = entries.find((e) => e.date === selectedDate);
    if (existing) return existing;
    return {
      id: `entry_${selectedDate}`,
      date: selectedDate,
      mood: '🌟' as MoodEmoji,
      answers: {},
      sketches: [],
      photoUrl: '',
      audioNote: '',
      audioDuration: 0,
      sparkReceived: academicSpark,
    };
  }, [entries, selectedDate, academicSpark]);

  // Keep refs synchronized for async MediaRecorder callbacks
  const entriesRef = useRef(entries);
  const currentEntryRef = useRef(currentEntry);
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    entriesRef.current = entries;
    currentEntryRef.current = currentEntry;
    selectedDateRef.current = selectedDate;
  }, [entries, currentEntry, selectedDate]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Daily Challenge pulse
  const dailyChallenges = useMemo(() => {
    if (language === 'en') {
      return [
        'Try explaining one complex concept from your subject today using a kitchen metaphor.',
        'Notice a moment when someone in class laughed sincerely. What sparked it?',
        'Do one thing in class intentionally differently today — change vocal pace, standing position, or opening prompt.',
        'Find 3 unexpected links between today’s lesson topic and a favorite piece of music.',
      ];
    }
    if (language === 'pl') {
      return [
        'Spróbuj dziś wyjaśnić jedno trudne pojęcie ze swojego przedmiotu za pomocą metafory z kuchni.',
        'Zauważ moment, gdy ktoś w klasie szczerze się roześmiał. Co to wywołało?',
        'Zrób dziś jedną rzecz na lekcji celowo inaczej niż zwykle – zmień ton głosu, miejsce stania lub pytanie wstępne.',
        'Znajdź 3 nietypowe powiązania między tematem dzisiejszej lekcji a ulubionym utworem muzycznym.',
      ];
    }
    return [
      'Zkuste dnes vysvětlit jeden složitý pojem ze svého předmětu pomocí metafory z kuchyně.',
      'Všimněte si okamžiku, kdy se někdo ve třídě upřímně zasmál. Co to vyvolalo?',
      'Udělejte jednu věc v hodině záměrně jinak, než jste zvyklí – změňte tón hlasu, místo stání nebo úvodní otázku.',
      'Najděte 3 neobvyklá spojení mezi tématem dnešní výuky a oblíbenou hudební skladbou.',
    ];
  }, [language]);
  const [challengeIdx, setChallengeIdx] = useState(0);

  // Update entry answers helper
  const handleUpdateAnswer = (promptId: string, value: string) => {
    const updatedEntries = [...entries];
    const idx = updatedEntries.findIndex((e) => e.date === selectedDate);
    const updatedEntry: JournalEntry = {
      ...currentEntry,
      answers: {
        ...currentEntry.answers,
        [promptId]: value,
      },
    };

    if (idx >= 0) {
      updatedEntries[idx] = updatedEntry;
    } else {
      updatedEntries.push(updatedEntry);
    }
    onUpdateEntries(updatedEntries);
  };

  // Update mood
  const handleSelectMood = (mood: MoodEmoji) => {
    const updatedEntries = [...entries];
    const idx = updatedEntries.findIndex((e) => e.date === selectedDate);
    const updatedEntry: JournalEntry = { ...currentEntry, mood };
    if (idx >= 0) {
      updatedEntries[idx] = updatedEntry;
    } else {
      updatedEntries.push(updatedEntry);
    }
    onUpdateEntries(updatedEntries);
  };

  // Attach sketch
  const handleSaveSketch = (dataUrl: string) => {
    const updatedEntries = [...entries];
    const idx = updatedEntries.findIndex((e) => e.date === selectedDate);
    const updatedEntry: JournalEntry = {
      ...currentEntry,
      sketches: [...(currentEntry.sketches || []), dataUrl],
    };
    if (idx >= 0) {
      updatedEntries[idx] = updatedEntry;
    } else {
      updatedEntries.push(updatedEntry);
    }
    onUpdateEntries(updatedEntries);
    setShowSketchpad(false);
  };

  // Voice recording handlers using MediaRecorder API
  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingSecondsRef.current = 0;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        const targetDate = selectedDateRef.current;
        const durationSec = recordingSecondsRef.current;
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const updatedEntries = [...entriesRef.current];
          const idx = updatedEntries.findIndex((e) => e.date === targetDate);
          const baseEntry = idx >= 0 ? updatedEntries[idx] : currentEntryRef.current;
          const updatedEntry: JournalEntry = {
            ...baseEntry,
            date: targetDate,
            audioNote: base64Audio,
            audioDuration: durationSec,
          };
          if (idx >= 0) updatedEntries[idx] = updatedEntry;
          else updatedEntries.push(updatedEntry);
          onUpdateEntries(updatedEntries);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch {
      setMicError(t.micError);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Fetch AI Academic Spark for the end of the entry
  const handleFetchNewSpark = async () => {
    setIsGeneratingSpark(true);
    setSparkError(null);
    try {
      const res = await fetch('/api/gemini/creativity-spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          theme: 'didaktická odvaha a experimentování',
          entrySummary: Object.values(currentEntry.answers).join(' ').slice(0, 300),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.spark) {
        setAcademicSpark(data.spark);
        setHasCustomSpark(true);
      }
    } catch (err) {
      console.error(err);
      setSparkError(
        language === 'en'
          ? 'Could not generate a new spark right now.'
          : language === 'pl'
          ? 'Nie udało się wygenerować nowego impulsu.'
          : 'Nepodařilo se načíst nový tvůrčí impuls.'
      );
    } finally {
      setIsGeneratingSpark(false);
    }
  };

  // AI Reflection analysis
  const handleGenerateAiReflection = async () => {
    setIsGeneratingAiReport(true);
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(0, 0, 0, 0);
      cutoffDate.setDate(cutoffDate.getDate() - reflectionDays);
      const relevantEntries = entries.filter((e) => new Date(`${e.date}T12:00:00`) >= cutoffDate);

      const res = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: relevantEntries,
          timeRange: `${reflectionDays} d`,
          language,
          customQuestion: userReflectionText,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiReport(
        data.report ||
          data.summary ||
          (language === 'en'
            ? 'Analysis generated.'
            : language === 'pl'
            ? 'Analiza została wygenerowana.'
            : 'Analýza byla úspěšně vygenerována.')
      );
    } catch (err) {
      console.error(err);
      setAiReport(
        language === 'en'
          ? 'Failed to generate analysis.'
          : language === 'pl'
          ? 'Nie udało się wygenerować analizy.'
          : 'Nepodařilo se vygenerovat analýzu.'
      );
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  // Direct Google Docs Export using Google Docs REST API & direct download fallback
  const [isSavingToGoogleDocs, setIsSavingToGoogleDocs] = useState(false);
  const [createdDocUrl, setCreatedDocUrl] = useState<string | null>(null);

  const handlePrintPdf = () => {
    if (onPrintCustomHtml) {
      onPrintCustomHtml(buildJournalPrintableHtml(currentEntry, prompts, language));
    } else {
      onPrint();
    }
  };

  const handleDirectSaveGoogleDocs = async () => {
    setIsSavingToGoogleDocs(true);
    setCreatedDocUrl(null);
    try {
      const docTitle = `${t.title} - ${currentEntry.date}`;
      const docText = [
        `${t.title.toUpperCase()} (${currentEntry.date})`,
        `${t.dailyMood} ${currentEntry.mood}`,
        `==================================================`,
        '',
        ...prompts.map((p) => {
          const dp = p.isCustom ? p : getLocalizedJournalPrompt(p, language);
          const ans = currentEntry.answers[p.id];
          if (!ans || !ans.trim()) return '';
          return `${dp.title}\n${ans}\n\n`;
        }),
        academicSpark ? `${t.academicSparkTitle}:\n„${academicSpark}“\n\n` : '',
        userReflectionText ? `${t.userReflectionTitle}:\n${userReflectionText}\n\n` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const { createRealGoogleDoc } = await import('../../services/googleDocsService');
      const res = await createRealGoogleDoc(docTitle, docText);
      setCreatedDocUrl(res.documentUrl);
    } catch (err: any) {
      console.warn('Real Google Docs API save issue, using native document file save:', err);
      const docHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t.title} - ${currentEntry.date}</title></head><body><h1>${t.title}</h1><p><strong>${t.entryDateLabel}</strong> ${currentEntry.date} &bull; <strong>${t.dailyMood}</strong> ${currentEntry.mood}</p>${prompts.map((p) => { const dp = p.isCustom ? p : getLocalizedJournalPrompt(p, language); const ans = currentEntry.answers[p.id]; return ans ? `<h2>${dp.title}</h2><p>${ans.replace(/\n/g, '<br/>')}</p>` : ''; }).join('')}${academicSpark ? `<h2>${t.academicSparkTitle}</h2><p>„${academicSpark}“</p>` : ''}</body></html>`;
      const blob = new Blob(['\ufeff' + docHtml], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kreativni_denik_${currentEntry.date}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsSavingToGoogleDocs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t.title}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {entries.length} · {t.entriesTotal}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.exportPdfBtn}</span>
          </button>

          {/* Sub-tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'write', label: t.tabs.write, icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: 'reflection', label: t.tabs.reflection, icon: <Sparkles className="w-3.5 h-3.5" /> },
              { id: 'history', label: t.tabs.history, icon: <Calendar className="w-3.5 h-3.5" /> },
              { id: 'settings', label: t.tabs.settings, icon: <Edit2 className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: WRITE TODAY'S ENTRY */}
      {activeTab === 'write' && (
        <div className="space-y-6">
          {/* Seasonal Cover Banner with Date & Controls */}
          <div className="relative rounded-3xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-800 h-48 sm:h-60 group">
            <img
              src={currentEntry.photoUrl || currentCover.url}
              alt={currentCover.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />

            {/* Banner Top Controls */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {/* Typewriter Audio Toggle */}
              <button
                type="button"
                onClick={onToggleTypewriter}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer ${
                  typewriterEnabled
                    ? 'bg-white/90 text-slate-900 shadow-xs'
                    : 'bg-black/50 text-white/80 hover:bg-black/70'
                }`}
                title={t.typewriterSound}
              >
                {typewriterEnabled ? <Volume2 className="w-3.5 h-3.5 text-indigo-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                <span>{typewriterEnabled ? t.typewriterActive : t.typewriterMuted}</span>
              </button>

              {/* Cover randomizer */}
              <button
                type="button"
                onClick={() => {
                  const covers = SEASONAL_COVERS;
                  const next = covers[Math.floor(Math.random() * covers.length)];
                  setCurrentCover(next);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md bg-black/50 text-white/90 hover:bg-black/70 transition-all flex items-center gap-1.5 cursor-pointer"
                title={t.changeCover}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.changeCover}</span>
              </button>
            </div>

            {/* Banner Bottom Information: Date & Cover credit */}
            <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-white">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                  {currentCover.season === 'spring'
                    ? t.seasonSpring
                    : currentCover.season === 'summer'
                    ? t.seasonSummer
                    : currentCover.season === 'autumn'
                    ? t.seasonAutumn
                    : t.seasonWinter}{' '}
                  &bull; {currentCover.title}
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setCreatedDocUrl(null);
                    }}
                    className="bg-black/40 border border-white/20 rounded-xl px-3 py-1 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  />
                  <span className="text-xs text-white/80 hidden sm:inline">
                    {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(language === 'cs' ? 'cs-CZ' : language === 'pl' ? 'pl-PL' : 'en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Export triggers */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-900 font-semibold text-xs backdrop-blur-md shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.exportPdfBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedDocUrl(null);
                    setShowDocsModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-600 text-white font-semibold text-xs backdrop-blur-md shadow-xs cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{t.exportGoogleDocs}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Daily Creative Challenge Pulse (Top Component) */}
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 block">
                  {t.dailyChallenge}
                </span>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                  {dailyChallenges[challengeIdx]}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setChallengeIdx((prev) => (prev + 1) % dailyChallenges.length)}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline self-end sm:self-auto whitespace-nowrap cursor-pointer"
            >
              {language === 'en' ? 'Another challenge →' : language === 'pl' ? 'Inne wyzwanie →' : 'Jiná výzva →'}
            </button>
          </div>

          {/* Daily Mood Selector & Multimedia Tools Header */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Mood Selector (Emojis) */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.dailyMood}
                </span>
                <div className="flex items-center gap-1.5">
                  {(['😊', '🌟', '🤔', '🌿', '💡', '😴', '🎨', '⚡'] as MoodEmoji[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMood(m)}
                      className={`text-xl p-1 rounded-xl transition-transform cursor-pointer ${
                        currentEntry.mood === m
                          ? 'scale-125 bg-amber-100 dark:bg-amber-950/60 ring-2 ring-amber-500'
                          : 'hover:scale-115 opacity-70 hover:opacity-100'
                      }`}
                      title={m}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Multimedia Action Triggers: Sketch, Voice, Photo */}
              <div className="flex items-center gap-2">
                {/* Voice Note Button */}
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-rose-500" />
                    <span>{currentEntry.audioNote ? t.audioRecorded : t.recordAudio}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>{t.stopAudio} ({recordingSeconds}s)</span>
                  </button>
                )}

                {/* Open Sketchpad */}
                <button
                  type="button"
                  onClick={() => setShowSketchpad(!showSketchpad)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    showSketchpad
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>{t.sketchpadTitle}</span>
                </button>
              </div>
            </div>

            {micError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
                {micError}
              </div>
            )}

            {/* Audio note playback player if saved */}
            {currentEntry.audioNote && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-rose-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {t.voiceNoteTitle} ({currentEntry.date})
                  </span>
                </div>
                <audio controls src={currentEntry.audioNote} className="h-8 max-w-xs" />
              </div>
            )}
          </div>

          {/* Integrated Sketchpad Drawer if opened */}
          {showSketchpad && (
            <Sketchpad
              language={language}
              isDark={isDark}
              onSaveSketch={handleSaveSketch}
            />
          )}

          {/* Attached Sketches Gallery for today */}
          {currentEntry.sketches && currentEntry.sketches.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.sketchpadTitle}:
              </span>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {currentEntry.sketches.map((img, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-28 w-44 shrink-0 bg-white">
                    <img src={img} alt={`${t.sketchpadTitle} ${i + 1}`} className="w-full h-full object-contain" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* The 8 Main Creative Prompts (Fields) */}
          <div className="space-y-4">
            {prompts.map((p) => {
              const dp = p.isCustom ? p : getLocalizedJournalPrompt(p, language);
              const value = currentEntry.answers[p.id] || '';
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <label className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {dp.title}
                    </label>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    {t.exampleLabel} {dp.example}
                  </p>

                  <textarea
                    rows={3}
                    value={value}
                    onChange={(e) => handleUpdateAnswer(p.id, e.target.value)}
                    placeholder={dp.placeholder}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans leading-relaxed"
                  />
                </div>
              );
            })}
          </div>

          {/* Dnešní tvůrčí impuls at the END of the entry as requested! */}
          <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/80 to-violet-50/80 dark:from-indigo-950/30 dark:to-violet-950/30 p-6 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-sm sm:text-base text-indigo-950 dark:text-indigo-200">
                  {t.academicSparkTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={handleFetchNewSpark}
                disabled={isGeneratingSpark}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold text-xs shadow-2xs hover:bg-indigo-50 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSpark ? 'animate-spin' : ''}`} />
                <span>{isGeneratingSpark ? t.generatingReport : t.getNewSpark}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic bg-white/70 dark:bg-slate-900/60 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              „{academicSpark}“
            </p>
            {sparkError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{sparkError}</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REFLECTION & AI ANALYSIS DASHBOARD */}
      {activeTab === 'reflection' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.tabs.reflection}
              </h3>
              <p className="text-xs text-slate-500">
                {t.timelineSubtitle}
              </p>
            </div>

            {/* Time Window Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.reflectionRange}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { days: 1, label: t.rangeDays['1'] },
                  { days: 2, label: t.rangeDays['2'] },
                  { days: 10, label: t.rangeDays['10'] },
                  { days: 30, label: t.rangeDays['30'] },
                  { days: 365, label: t.rangeDays['365'] },
                ].map((r) => (
                  <button
                    key={r.days}
                    type="button"
                    onClick={() => setReflectionDays(r.days)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      reflectionDays === r.days
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Filter Pills */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.filterQuestions}
              </label>
              <div className="flex flex-wrap gap-2">
                {prompts.map((p) => {
                  const dp = p.isCustom ? p : getLocalizedJournalPrompt(p, language);
                  const isFiltered = selectedPromptFilters.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPromptFilters((prev) =>
                          isFiltered ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={`text-xs px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                        isFiltered
                          ? 'bg-amber-600 text-white border-amber-600 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {dp.title.slice(0, 34)}...
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Personal Synthesis Reflection Field */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.userReflectionTitle}:
              </label>
              <textarea
                rows={4}
                value={userReflectionText}
                onChange={(e) => setUserReflectionText(e.target.value)}
                placeholder={t.userReflectionPlaceholder}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Action Buttons: Generate AI Analysis & Export */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleGenerateAiReflection}
                disabled={isGeneratingAiReport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingAiReport ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAiReport ? t.generatingReport : t.generateAiReport}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t.exportPdfBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedDocUrl(null);
                  setShowDocsModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.exportGoogleDocs}</span>
              </button>
            </div>

            {/* AI Report Output Panel */}
            {aiReport && (
              <div className="mt-6 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-indigo-950 dark:text-indigo-200">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>{t.aiReportTitle}</span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {aiReport}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TIMELINE & HISTORY (GOOGLE FIT STYLE) */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <span>{t.timelineTitle}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {t.timelineSubtitle}
                </p>
              </div>

              {/* JSON export */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const dl = document.createElement('a');
                    dl.href = url;
                    dl.download = `kreativni_denik_${todayStr}.json`;
                    document.body.appendChild(dl);
                    dl.click();
                    document.body.removeChild(dl);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-slate-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.exportJsonBtn}</span>
                </button>
              </div>
            </div>

            {/* Google Fit style calendar activity timeline */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-3">
                {t.timelineTitle} (28 d):
              </span>
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
                {Array.from({ length: 28 }).map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (27 - i));
                  const dStr = toLocalDateStr(d);
                  const entry = entries.find((e) => e.date === dStr);
                  const filledCount = entry ? Object.keys(entry.answers).filter((k) => entry.answers[k]?.trim()).length : 0;

                  let heatColor = 'bg-slate-200 dark:bg-slate-800';
                  if (filledCount >= 5) heatColor = 'bg-emerald-500 text-white';
                  else if (filledCount >= 2) heatColor = 'bg-amber-400 text-slate-900';
                  else if (filledCount === 1) heatColor = 'bg-amber-200 text-slate-800';

                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dStr);
                        setActiveTab('write');
                      }}
                      className={`h-12 rounded-xl flex flex-col items-center justify-center p-1 transition-transform hover:scale-105 cursor-pointer ${heatColor}`}
                      title={`${dStr}: ${filledCount}`}
                    >
                      <span className="text-[10px] font-bold">{d.getDate()}</span>
                      <span className="text-[9px]">{entry ? entry.mood : '·'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entries list */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {t.entriesTotal} ({entries.length}):
              </span>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {entries.map((e) => (
                  <div key={e.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{e.mood}</span>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {e.date}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {Object.keys(e.answers).length} · {t.sketchesTotal}: {e.sketches?.length || 0}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(e.date);
                        setActiveTab('write');
                      }}
                      className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer"
                    >
                      {t.openEntryBtn}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PROMPTS SETTINGS (EDIT / DELETE / ADD CUSTOM) */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.promptsSettingsTitle}
              </h3>
              <p className="text-xs text-slate-500">
                {t.promptsSettingsDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const newPrompt: JournalPrompt = {
                  id: `custom_${Date.now()}`,
                  key: `custom_${Date.now()}`,
                  title: t.newPromptTitle,
                  placeholder: t.newPromptPlaceholder,
                  example: t.exampleLabel,
                  isCustom: true,
                };
                onUpdatePrompts([...prompts, newPrompt]);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.addPromptBtn}</span>
            </button>
          </div>

          <div className="space-y-3">
            {prompts.map((p, idx) => {
              const dp = p.isCustom ? p : getLocalizedJournalPrompt(p, language);
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-4 text-xs"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 font-mono">#{idx + 1}</span>
                      <input
                        type="text"
                        value={dp.title}
                        onChange={(e) => {
                          const updated = prompts.map((item) =>
                            item.id === p.id ? { ...item, title: e.target.value, isCustom: true } : item
                          );
                          onUpdatePrompts(updated);
                        }}
                        className="w-full font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 pb-0.5"
                      />
                    </div>
                    <input
                      type="text"
                      value={dp.example}
                      onChange={(e) => {
                        const updated = prompts.map((item) =>
                          item.id === p.id ? { ...item, example: e.target.value, isCustom: true } : item
                        );
                        onUpdatePrompts(updated);
                      }}
                      placeholder={t.exampleLabel}
                      className="w-full text-slate-500 italic bg-transparent border-b border-dashed border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 pb-0.5 text-[11px]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const updated = prompts.filter((item) => item.id !== p.id);
                      onUpdatePrompts(updated);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title={t.deletePrompt}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GOOGLE DOCS EXPORT MODAL */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {t.exportGoogleDocs}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-950 dark:text-indigo-200 space-y-1.5">
              <span className="font-bold block">
                {t.entryDateLabel} {currentEntry.date} &bull; {t.dailyMood} {currentEntry.mood}
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                {t.subtitle}
              </p>
            </div>

            {createdDocUrl ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-2">
                <span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <Check className="w-4 h-4" />
                  {t.docsSuccess}
                </span>
                <a
                  href={createdDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold underline hover:text-emerald-600"
                >
                  {t.openDocLink} ↗
                </a>
              </div>
            ) : null}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleDirectSaveGoogleDocs}
                disabled={isSavingToGoogleDocs}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isSavingToGoogleDocs ? t.exportingDocs : t.exportGoogleDocs}</span>
              </button>

              <a
                href="https://docs.new"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-slate-500" />
                <span>Google Docs (docs.new) ↗</span>
              </a>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {pdfT.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
