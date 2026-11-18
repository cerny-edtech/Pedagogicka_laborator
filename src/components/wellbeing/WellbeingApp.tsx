import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Heart,
  Target,
  Sparkles,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Share2,
  Calendar,
  CheckCircle2,
  Check,
  Printer,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  WellbeingGoal,
  WellbeingCheckIn,
  WellbeingExercise,
  CalendarTask,
  NvcNeed,
  MoodEmoji,
  Language,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  NVC_NEEDS,
  INITIAL_WELLBEING_EXERCISES,
  INITIAL_CALENDAR_TASKS,
  getLocalizedCalendarTaskTitle,
} from '../../utils/initialData';
import { buildWellbeingPrintableHtml, PrintableDocData } from '../../utils/printExport';
import { createRealGoogleDoc } from '../../services/googleDocsService';

interface WellbeingAppProps {
  language: Language;
  isDark: boolean;
  onPrint: () => void;
  onPrintCustomHtml?: (data: PrintableDocData) => void;
}

export const WellbeingApp: React.FC<WellbeingAppProps> = ({
  language,
  onPrint,
  onPrintCustomHtml,
}) => {
  const t = translations[language].wellbeing;

  // Four primary modes: 'goals' | 'exercises' | 'diary' | 'coach'
  const [activeMode, setActiveMode] = useState<'goals' | 'exercises' | 'diary' | 'coach'>('goals');

  const uiText = useMemo(() => {
    if (language === 'en') {
      return {
        needPrefix: 'Need:',
        metricPrefix: 'Metric:',
        savedFeedback: 'Logged!',
        logBtn: 'Log',
        levelTitlePrefix: 'Rating',
        cancelBtn: 'Cancel',
        durationLabel: 'Duration',
        noExercises: 'No micro-habits in deck.',
        cardOf: 'of',
        exerciseFeedbackHint: 'Feedback shapes future rotation frequency',
        lastExerciseNotice: 'This is the last remaining exercise in the deck.',
        diaryTitle: 'Mindful Day Diary & Tech Purpose',
        diarySubtitle: 'Screen-time counting replaced by a more meaningful question: Did digital tools serve a clear purpose today?',
        reflectionLabel: 'Today’s Reflection:',
        tasksDoneOf: 'completed',
        tasksHint: 'Live view of your daily agenda alongside diary reflection for holistic balance check.',
        exportDocLoading: 'Saving to Google Docs...',
        exportDocSuccess: 'Diary saved directly to Google Docs!',
        exportDocErr: 'Unable to save to Google Docs:',
        openDocBtn: 'Open Google Doc',
        activeNvcGoals: 'Active NVC Goals',
        goalSingular: 'goal',
        goalPlural: 'goals',
        checkInsCountPrefix: 'Logged check-ins:',
        techSenseKpi: 'Tech Purposefulness',
        techSensePos: 'Purposeful use',
        techSenseNeg: 'Need to slow down',
        fromTodayDiary: 'Based on today’s diary',
        emotionalTone: 'Mood & Energy',
        todayFeeling: 'Today’s feeling',
        reflectionDatePrefix: 'Reflection:',
        coachReportHeader: 'Weekly Pedagogical & Psychological Self-Reflection',
        adoptedBadge: 'Added to active goals',
        addHabitBtn: 'Add to my goals',
        coachEmptyTitle: 'No weekly coach report generated yet',
        coachEmptyDesc: 'Click above so the AI Coach connects your tech-purpose log, NVC check-ins, and mood into a tailored weekly balance plan.',
        generateNowBtn: 'Generate Weekly Report',
        defaultGoal1: 'Put away work phone after 5:30 PM and dedicate the evening to recovery and family.',
        defaultMetric1: 'Completed at least 5 days a week (logged in diary).',
        defaultGoal2: 'Lead at least two 3-minute movement micro-breaks during classes.',
        defaultMetric2: 'Twice daily breathing and stretching break.',
        defaultReflection: 'Today I used interactive classroom polling with students. It felt purposeful because every student had a voice rather than passively staring at a screen.',
        coachErrMsg: 'Unable to generate coach report right now. Please try again.',
        restoreDeckBtn: 'Restore all exercises',
        deleteGoalTitle: 'Delete goal',
      };
    }
    if (language === 'pl') {
      return {
        needPrefix: 'Potrzeba:',
        metricPrefix: 'Wskaźnik:',
        savedFeedback: 'Zapisano!',
        logBtn: 'Zapisz',
        levelTitlePrefix: 'Ocena',
        cancelBtn: 'Anuluj',
        durationLabel: 'Czas',
        noExercises: 'Brak ćwiczeń na liście.',
        cardOf: 'z',
        exerciseFeedbackHint: 'Ocena dostosowuje częstotliwość kolejnych rekomendacji',
        lastExerciseNotice: 'To jest ostatnie ćwiczenie na liście.',
        diaryTitle: 'Dziennik uważnego dnia & Sens technologii',
        diarySubtitle: 'Licznik czasu przed ekranem zastąpiono ważniejszym pytaniem: czy praca z technologią miała dziś sens?',
        reflectionLabel: 'Refleksja dnia:',
        tasksDoneOf: 'ukończono',
        tasksHint: 'Podgląd harmonogramu dnia obok wpisu w dzienniku pomaga ocenić równowagę dnia.',
        exportDocLoading: 'Zapisywanie w Google Docs...',
        exportDocSuccess: 'Wpis zapisano bezpośrednio w Dokumentach Google!',
        exportDocErr: 'Błąd zapisu w Dokumentach Google:',
        openDocBtn: 'Otwórz Dokument Google',
        activeNvcGoals: 'Aktywne cele NVC',
        goalSingular: 'cel',
        goalPlural: 'cele/celów',
        checkInsCountPrefix: 'Zapisanych ocen:',
        techSenseKpi: 'Sensowność technologii',
        techSensePos: 'Świadome wsparcie',
        techSenseNeg: 'Potrzeba zwolnienia',
        fromTodayDiary: 'Ocena z dzisiejszego dziennika',
        emotionalTone: 'Nastrój dnia',
        todayFeeling: 'Dzisiejsze samopoczucie',
        reflectionDatePrefix: 'Refleksja:',
        coachReportHeader: 'Tygodniowa autorefleksja pedagogiczno-psychologiczna',
        adoptedBadge: 'Dodano do celów',
        addHabitBtn: 'Dodaj do moich celów',
        coachEmptyTitle: 'Nie wygenerowano jeszcze raportu tygodniowego',
        coachEmptyDesc: 'Kliknij przycisk powyżej, aby AI Trener połączył Twoje wpisy o sensowności technologii i cele NVC w spersonalizowany plan na przyszły tydzień.',
        generateNowBtn: 'Wygeneruj raport teraz',
        defaultGoal1: 'Odłożyć telefon służbowy po 17:30 i poświęcić wieczór regeneracji oraz rodzinie.',
        defaultMetric1: 'Zrealizowane co najmniej 5 dni w tygodniu (zapisane w dzienniku).',
        defaultGoal2: 'Przeprowadzić podczas lekcji co najmniej dwie 3-minutowe mikroprzerwy ruchowe z klasą.',
        defaultMetric2: 'Dwa razy dziennie ćwiczenie oddechowe i rozciągające.',
        defaultReflection: 'Dziś użyłem interaktywnego głosowania z uczniami. Miało to głęboki sens, bo każdy uczeń zabrał głos, zamiast tylko patrzeć w ekran.',
        coachErrMsg: 'Nie udało się wygenerować raportu trenera AI. Spróbuj ponownie.',
        restoreDeckBtn: 'Przywróć wszystkie ćwiczenia',
        deleteGoalTitle: 'Usuń cel',
      };
    }
    return {
      needPrefix: 'Potřeba:',
      metricPrefix: 'Metrika:',
      savedFeedback: 'Zaznamenáno!',
      logBtn: 'Zaznamenat',
      levelTitlePrefix: 'Úroveň',
      cancelBtn: 'Zrušit',
      durationLabel: 'Délka',
      noExercises: 'Žádná cvičení v seznamu.',
      cardOf: 'z',
      exerciseFeedbackHint: 'Hodnocení přizpůsobuje budoucí rotaci doporučení',
      lastExerciseNotice: 'Toto je poslední cvičení v seznamu.',
      diaryTitle: 'Deník vědomého dne & Smysl technologií',
      diarySubtitle: 'Čas u obrazovek byl nahrazen podstatnější otázkou: Zda práce s technikou dávala dnes smysl.',
      reflectionLabel: 'Reflexe dne:',
      tasksDoneOf: 'splněno',
      tasksHint: 'Náhled denního programu přímo v zápisu pro kontextové posouzení vyrovnanosti dne.',
      exportDocLoading: 'Ukládám do Google Docs...',
      exportDocSuccess: 'Zápis byl uložen přímo do Google Dokumentů!',
      exportDocErr: 'Nepodařilo se uložit do Google Docs:',
      openDocBtn: 'Otevřít Google Dokument',
      activeNvcGoals: 'Aktivní NVC cíle',
      goalSingular: 'cíl',
      goalPlural: 'cíle',
      checkInsCountPrefix: 'Zaznamenáno sebereflexí:',
      techSenseKpi: 'Smysluplnost techniky',
      techSensePos: 'Smysluplné využití',
      techSenseNeg: 'Potřeba zpomalit',
      fromTodayDiary: 'Hodnocení z dnešního deníku',
      emotionalTone: 'Emoční naladění',
      todayFeeling: 'Dnešní pocit',
      reflectionDatePrefix: 'Reflexe:',
      coachReportHeader: 'Týdenní pedagogicko-psychologická sebereflexe',
      adoptedBadge: 'Zařazeno do cílů',
      addHabitBtn: 'Přidat mezi mé cíle',
      coachEmptyTitle: 'Zatím nebyl vygenerován týdenní koučovací report',
      coachEmptyDesc: 'Kliknutím na tlačítko výše AI Kouč propojí vaše záznamy o smysluplnosti technologií, check-iny a potřeby NVC do plánu pro příští týden.',
      generateNowBtn: 'Vygenerovat report nyní',
      defaultGoal1: 'Odložit školní pracovní mobil po 17:30 a věnovat večer regeneraci a rodině.',
      defaultMetric1: 'Splněno v alespoň 5 dnech z týdne (zaznamenáno v deníku).',
      defaultGoal2: 'Během výuky provést alespoň dvě 3minutové pohybové mikropauzy se třídou.',
      defaultMetric2: 'Dvakrát denně dechové a protahovací cvičení.',
      defaultReflection: 'Dnes jsem využil interaktivní hlasování se studenty. Bylo to smysluplné, protože všichni žáci dostali hlas a nebylo to jen o tom mít před sebou displej.',
      coachErrMsg: 'Nepodařilo se vygenerovat zprávu AI kouče. Zkuste to prosím znovu.',
      restoreDeckBtn: 'Obnovit všechna cvičení',
      deleteGoalTitle: 'Smazat cíl',
    };
  }, [language]);

  const toLocalDateStr = (d: Date = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // AI Coach state
  const [coachReport, setCoachReport] = useState<{
    paragraphReport: string;
    weeklyTips: Array<{ title: string; habit: string; category: string }>;
    nvcNeedHighlight?: string;
    encouragement?: string;
    source?: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('pl_wellbeing_coach_report');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [adoptedHabits, setAdoptedHabits] = useState<string[]>([]);

  // NVC Needs list
  const [needsList, setNeedsList] = useState<NvcNeed[]>(() => NVC_NEEDS);
  const [showCustomNeedInput, setShowCustomNeedInput] = useState(false);
  const [customNeedText, setCustomNeedText] = useState('');

  // Mode 1: Active Goals & Daily Check-ins
  const [goals, setGoals] = useState<WellbeingGoal[]>(() => {
    try {
      const saved = localStorage.getItem('pl_wellbeing_goals');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'g1',
        needKey: 'inner_peace',
        goalText: uiText.defaultGoal1,
        metric: uiText.defaultMetric1,
        startDate: new Date().toISOString().slice(0, 10),
        active: true,
      },
      {
        id: 'g2',
        needKey: 'physical_wellbeing',
        goalText: uiText.defaultGoal2,
        metric: uiText.defaultMetric2,
        startDate: new Date().toISOString().slice(0, 10),
        active: true,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('pl_wellbeing_goals', JSON.stringify(goals));
    } catch {
      // ignore
    }
  }, [goals]);

  const [selectedNeedKey, setSelectedNeedKey] = useState<string>('inner_peace');
  const [newGoalText, setNewGoalText] = useState('');
  const [newGoalMetric, setNewGoalMetric] = useState('');
  const [checkIns, setCheckIns] = useState<WellbeingCheckIn[]>(() => {
    try {
      const saved = localStorage.getItem('pl_wellbeing_checkins');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('pl_wellbeing_checkins', JSON.stringify(checkIns));
    } catch {
      // ignore
    }
  }, [checkIns]);

  const [checkInRatings, setCheckInRatings] = useState<Record<string, number>>({});
  const [checkInTexts, setCheckInTexts] = useState<Record<string, string>>({});
  const [checkInSavedGoalId, setCheckInSavedGoalId] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Mode 2: Balance Exercises (Strictly ONE CARD at a time)
  const [exercises, setExercises] = useState<WellbeingExercise[]>(() => INITIAL_WELLBEING_EXERCISES);
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [exerciseNotice, setExerciseNotice] = useState<string | null>(null);

  // Mode 3: Mindful Tech Diary (persisted in pl_wellbeing_diary)
  const todayStr = useMemo(() => toLocalDateStr(), []);
  const savedDiary = useMemo(() => {
    try {
      const raw = localStorage.getItem('pl_wellbeing_diary');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
  const [diaryDate, setDiaryDate] = useState<string>(() => savedDiary?.diaryDate || todayStr);
  const [diaryMood, setDiaryMood] = useState<MoodEmoji>(() => savedDiary?.diaryMood || '🌿');
  const [didTechMakeSense, setDidTechMakeSense] = useState<boolean>(() =>
    typeof savedDiary?.didTechMakeSense === 'boolean' ? savedDiary.didTechMakeSense : true
  );
  const [diaryReflection, setDiaryReflection] = useState<string>(
    () => savedDiary?.diaryReflection ?? uiText.defaultReflection
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        'pl_wellbeing_diary',
        JSON.stringify({ diaryDate, diaryMood, didTechMakeSense, diaryReflection })
      );
    } catch {
      // ignore
    }
  }, [diaryDate, diaryMood, didTechMakeSense, diaryReflection]);

  const [tasksList, setTasksList] = useState<CalendarTask[]>(() => {
    try {
      const saved = localStorage.getItem('pl_wellbeing_tasks');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_CALENDAR_TASKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('pl_wellbeing_tasks', JSON.stringify(tasksList));
    } catch {
      // ignore
    }
  }, [tasksList]);

  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Docs export feedback
  const [exportingDocs, setExportingDocs] = useState(false);
  const [docExportStatus, setDocExportStatus] = useState<{ type: 'ok' | 'err'; msg: string; url?: string } | null>(null);

  const activeExercise = exercises[currentExerciseIdx] || exercises[0] || null;

  const handleFeedbackExercise = (up: boolean) => {
    if (!activeExercise) return;
    setExerciseNotice(null);
    if (up) {
      setCurrentExerciseIdx((prev) => (prev + 1) % exercises.length);
    } else {
      if (exercises.length > 1) {
        const remaining = exercises.filter((e) => e.id !== activeExercise.id);
        setExercises(remaining);
        setCurrentExerciseIdx(0);
      } else {
        setExerciseNotice(uiText.lastExerciseNotice);
        if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => setExerciseNotice(null), 3000);
      }
    }
  };

  const handleAddCustomNeed = () => {
    if (!customNeedText.trim()) return;
    const key = `custom_${Date.now()}`;
    const newNeed: NvcNeed = {
      key,
      category: 'meaning',
      label: { cs: customNeedText, en: customNeedText, pl: customNeedText },
      description: {
        cs: 'Vlastní osobní potřeba',
        en: 'Custom personal need',
        pl: 'Indywidualna potrzeba',
      },
      isCustom: true,
    };
    setNeedsList((prev) => [...prev, newNeed]);
    setSelectedNeedKey(key);
    setCustomNeedText('');
    setShowCustomNeedInput(false);
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    const newG: WellbeingGoal = {
      id: `goal_${Date.now()}`,
      needKey: selectedNeedKey,
      goalText: newGoalText,
      metric: newGoalMetric || t.metricPlaceholder,
      startDate: toLocalDateStr(),
      active: true,
    };
    setGoals((prev) => [...prev, newG]);
    setNewGoalText('');
    setNewGoalMetric('');
  };

  const handleSaveCheckIn = (goalId: string) => {
    const rating = checkInRatings[goalId] ?? 4;
    const reflection = checkInTexts[goalId] ?? '';
    const newCheckIn: WellbeingCheckIn = {
      id: `check_${Date.now()}`,
      date: toLocalDateStr(),
      goalId,
      completed: rating >= 3,
      rating,
      reflection,
    };
    setCheckIns((prev) => [...prev, newCheckIn]);
    setCheckInTexts((prev) => ({ ...prev, [goalId]: '' }));
    setCheckInSavedGoalId(goalId);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setCheckInSavedGoalId(null), 2000);
  };

  const handleGenerateCoachReport = async () => {
    setIsLoadingCoach(true);
    setCoachError(null);
    try {
      const payload = {
        language,
        activeGoals: goals,
        checkIns,
        diaryEntries: [
          {
            date: diaryDate,
            mood: diaryMood,
            didTechMakeSense,
            reflection: diaryReflection,
          },
        ],
        stats: {
          fulfilledGoalsCount: checkIns.filter((c) => c.rating >= 3).length,
          techSenseRatio: didTechMakeSense ? 85 : 40,
        },
      };

      const res = await fetch('/api/gemini/wellbeing-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCoachReport(data);
      try {
        localStorage.setItem('pl_wellbeing_coach_report', JSON.stringify(data));
      } catch {
        // ignore storage quota
      }
    } catch (err) {
      console.error(err);
      setCoachError(uiText.coachErrMsg);
    } finally {
      setIsLoadingCoach(false);
    }
  };

  const handleAdoptHabit = (tip: { title: string; habit: string; category: string }) => {
    const newG: WellbeingGoal = {
      id: `goal_coach_${Date.now()}`,
      needKey: 'inner_peace',
      goalText: `${tip.title}: ${tip.habit}`,
      metric: t.coachSubtitle,
      startDate: toLocalDateStr(),
      active: true,
    };
    setGoals((prev) => [...prev, newG]);
    setAdoptedHabits((prev) => [...prev, tip.title]);
  };

  const handleExportPdf = () => {
    if (onPrintCustomHtml) {
      onPrintCustomHtml(
        buildWellbeingPrintableHtml({
          goals,
          checkIns,
          diaryDate,
          diaryMood,
          didTechMakeSense,
          diaryReflection,
          coachReport,
          tasks: tasksList,
          language,
        })
      );
    } else {
      onPrint();
    }
  };

  const handleExportGoogleDoc = async () => {
    setExportingDocs(true);
    setDocExportStatus(null);
    try {
      const content = [
        `${t.title} — ${diaryDate}`,
        `${t.moodToday} ${diaryMood}`,
        `${t.techSenseQuestion} ${didTechMakeSense ? t.yesBtn : t.noBtn}`,
        '',
        `${uiText.reflectionLabel}`,
        diaryReflection,
        '',
        `${t.activeGoalsTitle}:`,
        ...goals.map((g, idx) => `${idx + 1}. ${g.goalText} (${g.metric})`),
        ...(coachReport
          ? [
              '',
              `${t.coachTitle}:`,
              coachReport.paragraphReport,
              ...(coachReport.weeklyTips || []).map((tip, idx) => `${idx + 1}. ${tip.title}: ${tip.habit}`),
            ]
          : []),
      ].join('\n');

      const res = await createRealGoogleDoc(`${t.title} (${diaryDate})`, content);
      setDocExportStatus({
        type: 'ok',
        msg: uiText.exportDocSuccess,
        url: res.documentUrl,
      });
    } catch (err: any) {
      setDocExportStatus({
        type: 'err',
        msg: `${uiText.exportDocErr} ${err?.message || ''}`,
      });
    } finally {
      setExportingDocs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {t.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 4 Primary Modes Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { id: 'goals', label: t.modes.goals, icon: <Target className="w-3.5 h-3.5" /> },
              { id: 'exercises', label: t.modes.exercises, icon: <Sparkles className="w-3.5 h-3.5" /> },
              { id: 'diary', label: t.modes.diary, icon: <BookOpen className="w-3.5 h-3.5" /> },
              { id: 'coach', label: t.modes.coach, icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" /> },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setActiveMode(mode.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMode === mode.id
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode.icon}
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.exportPdfBtn}</span>
          </button>
        </div>
      </div>

      {/* MODE 1: GOALS & NVC NEEDS */}
      {activeMode === 'goals' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-500" />
              <span>{t.activeGoalsTitle} ({goals.length})</span>
            </h3>

            {goals.length === 0 ? (
              <p className="text-xs text-slate-500">{t.noActiveGoals}</p>
            ) : (
              <div className="space-y-4">
                {goals.map((g) => {
                  const need = needsList.find((n) => n.key === g.needKey);
                  const goalRating = checkInRatings[g.id] ?? 4;
                  const goalText = checkInTexts[g.id] ?? '';
                  const isSaved = checkInSavedGoalId === g.id;
                  return (
                    <div
                      key={g.id}
                      className="p-5 rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 space-y-3 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            {uiText.needPrefix} {need?.label[language] || g.needKey}
                          </span>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                            {g.goalText}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">
                            {uiText.metricPrefix} {g.metric}
                          </span>
                          <button
                            type="button"
                            onClick={() => setGoals((prev) => prev.filter((item) => item.id !== g.id))}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title={uiText.deleteGoalTitle}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-rose-100 dark:border-rose-900/30 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {t.dailyQuestion}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {[
                              { val: 1, icon: '😞' },
                              { val: 2, icon: '😐' },
                              { val: 3, icon: '🙂' },
                              { val: 4, icon: '😊' },
                              { val: 5, icon: '🌟' },
                            ].map((sm) => (
                              <button
                                key={sm.val}
                                type="button"
                                onClick={() => setCheckInRatings((prev) => ({ ...prev, [g.id]: sm.val }))}
                                className={`text-lg p-1 rounded-lg transition-transform cursor-pointer ${
                                  goalRating === sm.val
                                    ? 'scale-125 bg-rose-100 dark:bg-rose-900/50 ring-2 ring-rose-500'
                                    : 'opacity-60 hover:opacity-100'
                                }`}
                                title={`${uiText.levelTitlePrefix} ${sm.val}`}
                              >
                                {sm.icon}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={goalText}
                            onChange={(e) => setCheckInTexts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                            placeholder={t.reflectionShortPlaceholder}
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveCheckIn(g.id)}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            {isSaved ? <Check className="w-3.5 h-3.5" /> : null}
                            <span>{isSaved ? uiText.savedFeedback : uiText.logBtn}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>{t.needsTitle}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.step1Need}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {needsList.map((need) => {
                const isSelected = selectedNeedKey === need.key;
                return (
                  <button
                    key={need.key}
                    type="button"
                    onClick={() => setSelectedNeedKey(need.key)}
                    className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/60 ring-2 ring-rose-500/20 text-rose-950 dark:text-rose-100 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="font-bold text-xs block mb-1">
                      {need.label[language] || need.key}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug block">
                      {need.description[language]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              {!showCustomNeedInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomNeedInput(true)}
                  className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.customNeedButton}</span>
                </button>
              ) : (
                <div className="p-3.5 rounded-xl border border-dashed border-rose-300 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 flex gap-2">
                  <input
                    type="text"
                    value={customNeedText}
                    onChange={(e) => setCustomNeedText(e.target.value)}
                    placeholder={t.customNeedPlaceholder}
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomNeed}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs cursor-pointer"
                  >
                    {t.addNeedBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomNeedInput(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
                  >
                    {uiText.cancelBtn}
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleCreateGoal} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                {t.step2Goal} &amp; {t.step3Metric}:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-500">{t.step2Goal}</label>
                  <input
                    type="text"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    placeholder={t.goalPlaceholder}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500">{t.step3Metric}</label>
                  <input
                    type="text"
                    value={newGoalMetric}
                    onChange={(e) => setNewGoalMetric(e.target.value)}
                    placeholder={t.metricPlaceholder}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!newGoalText.trim()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-40"
              >
                + {t.saveGoalBtn}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODE 2: BALANCE EXERCISES (STRICTLY ONE CARD AT A TIME) */}
      {activeMode === 'exercises' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md text-center space-y-6 relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/40">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.exerciseCardTitle}</span>
            </div>

            {activeExercise ? (
              <div className="space-y-4 max-w-lg mx-auto">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest block">
                  {uiText.durationLabel}: {activeExercise.duration} &bull; {activeExercise.category.toUpperCase()}
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                  {activeExercise.title[language] || activeExercise.title.cs}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  {activeExercise.description[language] || activeExercise.description.cs}
                </p>
              </div>
            ) : (
              <div className="py-8 text-slate-400 text-xs">
                {uiText.noExercises}
              </div>
            )}

            {exerciseNotice && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                {exerciseNotice}
              </div>
            )}

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleFeedbackExercise(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs transition-all cursor-pointer"
                title={t.thumbsDown}
              >
                <ThumbsDown className="w-4 h-4" />
                <span>{t.thumbsDown}</span>
              </button>

              <button
                type="button"
                onClick={() => handleFeedbackExercise(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                title={t.thumbsUp}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>{t.thumbsUp}</span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-2">
              <span>{t.exerciseCounter} {currentExerciseIdx + 1} {uiText.cardOf} {exercises.length} &bull; {uiText.exerciseFeedbackHint}</span>
              {exercises.length < INITIAL_WELLBEING_EXERCISES.length && (
                <button
                  type="button"
                  onClick={() => {
                    setExercises(INITIAL_WELLBEING_EXERCISES);
                    setCurrentExerciseIdx(0);
                    setExerciseNotice(null);
                  }}
                  className="text-rose-600 dark:text-rose-400 font-semibold underline cursor-pointer"
                >
                  {uiText.restoreDeckBtn}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: MINDFUL TECH DIARY & DAY AGENDA */}
      {activeMode === 'diary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {uiText.diaryTitle}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {uiText.diarySubtitle}
                  </p>
                </div>

                <input
                  type="date"
                  value={diaryDate}
                  onChange={(e) => setDiaryDate(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.moodToday}
                </span>
                <div className="flex items-center gap-1.5">
                  {(['😊', '🌟', '🤔', '🌿', '💡', '😴', '🎨', '⚡'] as MoodEmoji[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDiaryMood(m)}
                      className={`text-xl p-1 rounded-lg transition-transform cursor-pointer ${
                        diaryMood === m ? 'scale-125 bg-rose-100 ring-2 ring-rose-500' : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  {t.techSenseQuestion}
                </span>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="techsense"
                      checked={didTechMakeSense}
                      onChange={() => setDidTechMakeSense(true)}
                      className="text-emerald-600"
                    />
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {t.yesBtn}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="techsense"
                      checked={!didTechMakeSense}
                      onChange={() => setDidTechMakeSense(false)}
                      className="text-amber-600"
                    />
                    <span className="text-amber-700 dark:text-amber-400">
                      {t.noBtn}
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.diaryReflectionLabel}
                </label>
                <textarea
                  rows={4}
                  value={diaryReflection}
                  onChange={(e) => setDiaryReflection(e.target.value)}
                  placeholder={t.diaryReflectionPlaceholder}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
                />
              </div>

              {docExportStatus && (
                <div
                  className={`rounded-xl p-3 border text-xs flex flex-wrap items-center justify-between gap-2 ${
                    docExportStatus.type === 'ok'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-200'
                  }`}
                >
                  <span>{docExportStatus.msg}</span>
                  {docExportStatus.url && (
                    <a
                      href={docExportStatus.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline"
                    >
                      {uiText.openDocBtn}
                    </a>
                  )}
                </div>
              )}

              <div className="pt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-500" />
                  <span>{t.exportPdfBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportGoogleDoc}
                  disabled={exportingDocs}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {exportingDocs ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>{exportingDocs ? uiText.exportDocLoading : t.exportDocs}</span>
                </button>
              </div>
            </div>

            {/* Day's Agenda Preview */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <span>{t.tasksPreviewTitle}</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  {tasksList.filter((x) => x.completed).length}/{tasksList.length} {uiText.tasksDoneOf}
                </span>
              </div>

              <p className="text-[11px] text-slate-500">
                {uiText.tasksHint}
              </p>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {tasksList.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => {
                      const updated = tasksList.map((item) =>
                        item.id === task.id ? { ...item, completed: !item.completed } : item
                      );
                      setTasksList(updated);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-colors ${
                      task.completed
                        ? 'bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-400 line-through'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                        {task.completed && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className="font-medium">
                        {getLocalizedCalendarTaskTitle(task, language)}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{task.time}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder={t.newTaskPlaceholder}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newTaskTitle.trim()) return;
                    setTasksList([
                      ...tasksList,
                      {
                        id: `t_${Date.now()}`,
                        title: newTaskTitle,
                        time: '16:00',
                        category: 'personal',
                        completed: false,
                      },
                    ]);
                    setNewTaskTitle('');
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 4: AI DIGITAL BALANCE COACH */}
      {activeMode === 'coach' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {t.coachTitle}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                  {t.coachSubtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateCoachReport}
                disabled={isLoadingCoach}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Sparkles className={`w-4 h-4 ${isLoadingCoach ? 'animate-spin' : ''}`} />
                <span>
                  {isLoadingCoach ? t.generatingCoach : t.generateCoachReport}
                </span>
              </button>
            </div>

            {coachError && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{coachError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {uiText.activeNvcGoals}
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {goals.length} {goals.length === 1 ? uiText.goalSingular : uiText.goalPlural}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {uiText.checkInsCountPrefix} {checkIns.length}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {uiText.techSenseKpi}
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {didTechMakeSense ? uiText.techSensePos : uiText.techSenseNeg}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {uiText.fromTodayDiary}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  {uiText.emotionalTone}
                </span>
                <span className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{diaryMood}</span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{uiText.todayFeeling}</span>
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  {uiText.reflectionDatePrefix} {diaryDate}
                </span>
              </div>
            </div>
          </div>

          {coachReport ? (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/60 via-white to-rose-50/40 dark:from-amber-950/20 dark:via-slate-900 dark:to-rose-950/20 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {uiText.coachReportHeader}
                  </span>
                  {coachReport.source && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                      {coachReport.source}
                    </span>
                  )}
                </div>

                {/* Clean rounded highlight box without left accent stripe */}
                <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 p-4 text-sm text-slate-800 dark:text-slate-200 leading-relaxed italic">
                  {coachReport.paragraphReport}
                </div>

                {coachReport.nvcNeedHighlight && (
                  <div className="mt-4 p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-amber-200/80 dark:border-amber-800/60 flex items-center gap-3">
                    <Heart className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        {t.coachCoreNeedLabel}
                      </span>
                      <strong className="text-xs text-slate-900 dark:text-white">
                        {coachReport.nvcNeedHighlight}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <span>{t.coachWeeklyTipsTitle}</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {coachReport.weeklyTips?.map((tip, idx) => {
                    const isAdopted = adoptedHabits.includes(tip.title);
                    const catKey = tip.category as keyof typeof t.coachCategoryLabels;
                    const catLabel = t.coachCategoryLabels[catKey] || t.coachCategoryLabels.pedagogy;
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800">
                              {catLabel}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                          </div>

                          <h5 className="font-bold text-xs text-slate-900 dark:text-white">
                            {tip.title}
                          </h5>

                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {tip.habit}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdoptHabit(tip)}
                          disabled={isAdopted}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isAdopted
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400'
                          }`}
                        >
                          {isAdopted ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>{uiText.adoptedBadge}</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>{uiText.addHabitBtn}</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {coachReport.encouragement && (
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-center text-xs text-slate-600 dark:text-slate-300 italic border border-slate-200 dark:border-slate-700">
                  „{coachReport.encouragement}“
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {uiText.coachEmptyTitle}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {uiText.coachEmptyDesc}
              </p>
              <button
                type="button"
                onClick={handleGenerateCoachReport}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-xs hover:bg-indigo-700 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{uiText.generateNowBtn}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

