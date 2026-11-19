import React, { useState, useEffect, useMemo } from 'react';
import {
  AppTab,
  Language,
  Student,
  ClassroomConfig,
  SeatingPairRule,
  JournalEntry,
  JournalPrompt,
  LearningProject,
  DeskSlot,
  CriteriaAssignment,
  StudentCriterionEvaluation,
  RubricCriterion,
  ObservationRecord,
  AddieProject,
} from './types';
import { Header } from './components/navigation/Header';
import { Rozcestnik } from './components/hub/Rozcestnik';
import { SeatingApp } from './components/seating/SeatingApp';
import { JournalApp } from './components/journal/JournalApp';
import { EduDesignApp } from './components/edudesign/EduDesignApp';
import { WellbeingApp } from './components/wellbeing/WellbeingApp';
import { AssessmentApp } from './components/assessment/AssessmentApp';
import { ObservationsApp, createBlankObservation } from './components/observations/ObservationsApp';
import { AddieApp, createBlankAddieProject } from './components/addie/AddieApp';
import { AboutApp } from './components/about/AboutApp';
import { PdfExportModal } from './components/common/PdfExportModal';
import { playTypewriterSound } from './utils/typewriterAudio';
import {
  AmbientSoundType,
  setAmbientVolume,
  startAmbientSound,
  stopAmbientSound,
} from './utils/ambientAudio';
import { generatePrintableHtml } from './utils/printExport';
import { getT } from './i18n/translations';
import { generateOptimalSeating } from './utils/seatingAlgorithms';
import {
  INITIAL_STUDENTS,
  INITIAL_RULES,
  INITIAL_JOURNAL_PROMPTS,
} from './utils/initialData';
import {
  INITIAL_ASSIGNMENTS,
  INITIAL_CRITERIA_BANK,
} from './utils/assessmentUtils';

const VALID_LANGUAGES: Language[] = ['cs', 'en', 'pl'];
const VALID_TABS: AppTab[] = [
  'hub',
  'seating',
  'journal',
  'edudesign',
  'wellbeing',
  'assessment',
  'observations',
  'addie',
  'about',
];

function safeParseStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (
      fallback !== null &&
      typeof fallback === 'object' &&
      !Array.isArray(fallback) &&
      (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
    ) {
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function safeSaveStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`Could not persist ${key}:`, err);
  }
}

export default function App() {
  // 1. Language state: cs | en | pl
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('pl_language') as Language | null;
      return saved && VALID_LANGUAGES.includes(saved) ? saved : 'cs';
    } catch {
      return 'cs';
    }
  });

  // 2. Dark mode state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('pl_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // 3. Active sub-app tab
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    try {
      const saved = localStorage.getItem('pl_active_tab') as AppTab | null;
      return saved && VALID_TABS.includes(saved) ? saved : 'hub';
    } catch {
      return 'hub';
    }
  });

  // 4. Global Typewriter Sound toggle (Available everywhere!)
  const [typewriterEnabled, setTypewriterEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('pl_typewriter_sound');
    return saved !== null ? saved === 'true' : true;
  });

  // 4b. Global Ambient Background Sound state (Cafe, Rain, Fireplace)
  const [ambientEnabled, setAmbientEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('pl_ambient_enabled');
    return saved === 'true';
  });
  const [ambientSound, setAmbientSound] = useState<AmbientSoundType>(() => {
    const saved = localStorage.getItem('pl_ambient_sound') as AmbientSoundType | null;
    return saved === 'cafe' || saved === 'rain' || saved === 'fire' ? saved : 'rain';
  });
  const [ambientVolume, setAmbientVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('pl_ambient_volume');
    const num = saved ? Number(saved) : 45;
    return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 45;
  });

  // 5. Seating state
  const [students, setStudents] = useState<Student[]>(() =>
    safeParseStorage<Student[]>('pl_students', INITIAL_STUDENTS)
  );

  const [seatingRules, setSeatingRules] = useState<SeatingPairRule[]>(() =>
    safeParseStorage<SeatingPairRule[]>('pl_seating_rules', INITIAL_RULES)
  );

  const [classroomConfig, setClassroomConfig] = useState<ClassroomConfig>(() =>
    safeParseStorage<ClassroomConfig>('pl_classroom_config', {
      layout: 'standard',
      rows: 5,
      cols: 3,
      deskCapacity: 2,
      blackboardPosition: 'top',
      enforceBoyGirl: true,
      activeSubject: 'all',
    })
  );

  // 6. Journal state
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(() =>
    safeParseStorage<JournalEntry[]>('pl_journal_entries', [])
  );

  const [journalPrompts, setJournalPrompts] = useState<JournalPrompt[]>(() =>
    safeParseStorage<JournalPrompt[]>('pl_journal_prompts', INITIAL_JOURNAL_PROMPTS)
  );

  // 7. EduDesign state
  const [projects, setProjects] = useState<LearningProject[]>(() =>
    safeParseStorage<LearningProject[]>('pl_edudesign_projects', [
      {
        id: 'proj_default',
        title: 'Konstruktivistická badatelská lekce',
        subject: 'Přírodovědné a společenské vzdělávání',
        targetGroup: 'Žáci 8. ročníku ZŠ',
        context: 'Standardní učebna se skupinovým uspořádáním',
        lessonForm: 'Prezenční seminář 45 minut',
        generalGoal: 'Student umí analyzovat ekologické dopady lidské činnosti na krajinu a obhájit návrhy udržitelných opatření.',
        subGoals: [
          {
            id: 'sg_1',
            text: 'Student vysvětlí klíčové faktory degradace půdy v regionu.',
            bloomLevel: 'understand',
          },
          {
            id: 'sg_2',
            text: 'Student navrhne a porovná dvě varianty revitalizace vodního toku.',
            bloomLevel: 'create',
          },
        ],
        learningObjects: [
          {
            id: 'obj_1',
            title: 'Interaktivní případová studie lokálního povodí',
            type: 'case_study',
            duration: '25 min',
            targetSubGoalIds: ['sg_1', 'sg_2'],
            studentActivity: 'Žáci v týmech analyzují historické mapy a srážková data.',
            teacherRole: 'Facilitátor, moderuje diskusi nad protichůdnými zájmy zemědělců a ochranářů.',
            verificationMethod: 'Kriteriální rubrika pro hodnocení artefaktu',
            implementationDetails: 'Matice 4x3 se slovními deskriptory výkonu předaná žákům předem',
            assessmentCriteria: [
              { id: 'c1', name: 'Věcná správnost argumentace', type: 'nominal', maxPoints: 5, weight: 1, description: 'Správné použití terminologie' },
              { id: 'c2', name: 'Odevzdání návrhu včas', type: 'binary', maxPoints: 1, weight: 1, description: 'Dodržení termínu a formátu' },
            ],
            gamificationTip: 'Společná odemykací nástěnka: každý tým svým zjištěním pomáhá složit celou mapu povodí.',
            methodologicalTip: 'Požádejte žáky, aby na začátku zapsali jeden svůj prekoncept o zadržování vody.',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      },
    ])
  );

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      return localStorage.getItem('pl_active_project_id') || 'proj_default';
    } catch {
      return 'proj_default';
    }
  });

  // 8. Criterion Assessment state (isolated assignments + reusable bank + student evaluations)
  const [assignments, setAssignments] = useState<CriteriaAssignment[]>(() =>
    safeParseStorage<CriteriaAssignment[]>('pl_assessment_assignments', INITIAL_ASSIGNMENTS)
  );

  const [activeAssignmentId, setActiveAssignmentId] = useState<string>(() => {
    try {
      return localStorage.getItem('pl_active_assessment_id') || INITIAL_ASSIGNMENTS[0].id;
    } catch {
      return INITIAL_ASSIGNMENTS[0].id;
    }
  });

  const [evaluations, setEvaluations] = useState<StudentCriterionEvaluation[]>(() =>
    safeParseStorage<StudentCriterionEvaluation[]>('pl_assessment_evaluations', [])
  );

  const [criteriaBank, setCriteriaBank] = useState<RubricCriterion[]>(() =>
    safeParseStorage<RubricCriterion[]>(
      'pl_criteria_bank',
      INITIAL_CRITERIA_BANK.map((c, idx) => ({ ...c, id: `bank_init_${idx}` }))
    )
  );

  // 8b. Classroom Observations (Náslechy) state
  const [observations, setObservations] = useState<ObservationRecord[]>(() => {
    const saved = localStorage.getItem('pl_observations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore invalid json
      }
    }
    return [createBlankObservation(getT(language).observations.defaultTopic)];
  });

  const [activeObservationId, setActiveObservationId] = useState<string>(() => {
    const saved = localStorage.getItem('pl_active_observation_id');
    return saved || '';
  });

  // 8c. ADDIE Model state
  const [addieProjects, setAddieProjects] = useState<AddieProject[]>(() => {
    const saved = localStorage.getItem('pl_addie_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore invalid json
      }
    }
    return [createBlankAddieProject(getT(language).addie.defaultProjectTitle)];
  });

  const [activeAddieId, setActiveAddieId] = useState<string>(() => {
    const saved = localStorage.getItem('pl_active_addie_id');
    return saved || '';
  });

  // 9. PDF Export Modal state
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalData, setPdfModalData] = useState<{
    title: string;
    subtitle?: string;
    contentHtml: string;
    filename: string;
  }>({
    title: '',
    contentHtml: '',
    filename: 'export',
  });

  // Current active project, active assignment, active observation & active ADDIE project
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  const currentAssignment = useMemo(() => {
    return assignments.find((a) => a.id === activeAssignmentId) || assignments[0] || null;
  }, [assignments, activeAssignmentId]);

  const currentObservation = useMemo(() => {
    return observations.find((o) => o.id === activeObservationId) || observations[0] || null;
  }, [observations, activeObservationId]);

  const currentAddieProject = useMemo(() => {
    return addieProjects.find((p) => p.id === activeAddieId) || addieProjects[0] || null;
  }, [addieProjects, activeAddieId]);

  // Global keydown typewriter sound hook
  useEffect(() => {
    if (!typewriterEnabled) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if modifier keys like Ctrl/Meta are held (e.g. Ctrl+C)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName?.toLowerCase();
      const isInput =
        tagName === 'input' ||
        tagName === 'textarea' ||
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true';

      if (isInput) {
        const isEnter = e.key === 'Enter';
        const isSpace = e.key === ' ';
        const isBackspace = e.key === 'Backspace';
        playTypewriterSound(isEnter, isSpace, isBackspace);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [typewriterEnabled]);

  // Synchronize with localStorage
  useEffect(() => {
    safeSaveStorage('pl_language', language);
  }, [language]);

  useEffect(() => {
    safeSaveStorage('pl_typewriter_sound', String(typewriterEnabled));
  }, [typewriterEnabled]);

  useEffect(() => {
    safeSaveStorage('pl_ambient_enabled', String(ambientEnabled));
    safeSaveStorage('pl_ambient_sound', ambientSound);
    safeSaveStorage('pl_ambient_volume', String(ambientVolume));
  }, [ambientEnabled, ambientSound, ambientVolume]);

  // If ambient was saved enabled across reload, unlock Web Audio on first user gesture
  useEffect(() => {
    if (!ambientEnabled) {
      stopAmbientSound();
      return;
    }
    startAmbientSound(ambientSound, ambientVolume / 100);
    const resumeOnGesture = () => {
      startAmbientSound(ambientSound, ambientVolume / 100);
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };
    window.addEventListener('pointerdown', resumeOnGesture, { once: true, passive: true });
    window.addEventListener('keydown', resumeOnGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };
  }, [ambientEnabled, ambientSound]);

  useEffect(() => {
    if (ambientEnabled) {
      setAmbientVolume(ambientVolume / 100);
    }
  }, [ambientVolume, ambientEnabled]);

  const handleToggleAmbient = () => {
    setAmbientEnabled((prev) => {
      const next = !prev;
      if (next) {
        startAmbientSound(ambientSound, ambientVolume / 100);
      } else {
        stopAmbientSound();
      }
      return next;
    });
  };

  const handleSelectAmbientSound = (sound: AmbientSoundType) => {
    setAmbientSound(sound);
    setAmbientEnabled(true);
    startAmbientSound(sound, ambientVolume / 100);
  };

  const handleChangeAmbientVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(100, vol));
    setAmbientVolumeState(clamped);
    if (ambientEnabled) {
      setAmbientVolume(clamped / 100);
    }
  };

  useEffect(() => {
    safeSaveStorage('pl_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    safeSaveStorage('pl_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    safeSaveStorage('pl_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    safeSaveStorage('pl_seating_rules', JSON.stringify(seatingRules));
  }, [seatingRules]);

  useEffect(() => {
    safeSaveStorage('pl_classroom_config', JSON.stringify(classroomConfig));
  }, [classroomConfig]);

  useEffect(() => {
    safeSaveStorage('pl_journal_entries', JSON.stringify(journalEntries));
  }, [journalEntries]);

  useEffect(() => {
    safeSaveStorage('pl_journal_prompts', JSON.stringify(journalPrompts));
  }, [journalPrompts]);

  useEffect(() => {
    safeSaveStorage('pl_edudesign_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    safeSaveStorage('pl_active_project_id', activeProjectId);
  }, [activeProjectId]);

  useEffect(() => {
    safeSaveStorage('pl_assessment_assignments', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    safeSaveStorage('pl_active_assessment_id', activeAssignmentId);
  }, [activeAssignmentId]);

  useEffect(() => {
    safeSaveStorage('pl_assessment_evaluations', JSON.stringify(evaluations));
  }, [evaluations]);

  useEffect(() => {
    safeSaveStorage('pl_criteria_bank', JSON.stringify(criteriaBank));
  }, [criteriaBank]);

  useEffect(() => {
    safeSaveStorage('pl_observations', JSON.stringify(observations));
  }, [observations]);

  useEffect(() => {
    if (currentObservation) {
      safeSaveStorage('pl_active_observation_id', currentObservation.id);
    }
  }, [currentObservation]);

  useEffect(() => {
    safeSaveStorage('pl_addie_projects', JSON.stringify(addieProjects));
  }, [addieProjects]);

  useEffect(() => {
    if (currentAddieProject) {
      safeSaveStorage('pl_active_addie_id', currentAddieProject.id);
    }
  }, [currentAddieProject]);

  // Open PDF / Print export modal
  const handleOpenPrintModal = () => {
    const savedDeskSnapshot = safeParseStorage<{
      layout?: string;
      rows?: number;
      cols?: number;
      activeSubject?: string;
      desks?: DeskSlot[];
    } | null>('pl_seating_desks', null);

    const hasMatchingSavedDesks =
      savedDeskSnapshot &&
      Array.isArray(savedDeskSnapshot.desks) &&
      savedDeskSnapshot.desks.length > 0 &&
      savedDeskSnapshot.layout === classroomConfig.layout &&
      savedDeskSnapshot.rows === classroomConfig.rows &&
      savedDeskSnapshot.cols === classroomConfig.cols &&
      savedDeskSnapshot.activeSubject === classroomConfig.activeSubject;

    const computedDesks = hasMatchingSavedDesks
      ? savedDeskSnapshot!.desks!
      : generateOptimalSeating(students, classroomConfig, seatingRules, classroomConfig.activeSubject);

    const data = generatePrintableHtml(activeTab, {
      students,
      config: classroomConfig,
      desks: computedDesks,
      journalEntries,
      prompts: journalPrompts,
      project: currentProject,
      assignment: currentAssignment,
      evaluations,
      observation: currentObservation,
      addieProject: currentAddieProject,
      language,
    });
    setPdfModalData(data);
    setPdfModalOpen(true);
  };

  const handleOpenCustomPrintModal = (data: {
    title: string;
    subtitle?: string;
    contentHtml: string;
    filename: string;
  }) => {
    setPdfModalData(data);
    setPdfModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Unified Header & Global Navigation */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        language={language}
        onSelectLanguage={setLanguage}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        onPrint={handleOpenPrintModal}
        typewriterEnabled={typewriterEnabled}
        onToggleTypewriter={() => setTypewriterEnabled(!typewriterEnabled)}
        ambientEnabled={ambientEnabled}
        ambientSound={ambientSound}
        ambientVolume={ambientVolume}
        onToggleAmbient={handleToggleAmbient}
        onSelectAmbientSound={handleSelectAmbientSound}
        onChangeAmbientVolume={handleChangeAmbientVolume}
      />

      {/* Main Sub-Application Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'hub' && (
          <Rozcestnik
            language={language}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'seating' && (
          <SeatingApp
            language={language}
            isDark={isDark}
            students={students}
            onUpdateStudents={setStudents}
            rules={seatingRules}
            onUpdateRules={setSeatingRules}
            config={classroomConfig}
            onUpdateConfig={setClassroomConfig}
            onPrint={handleOpenPrintModal}
          />
        )}

        {activeTab === 'journal' && (
          <JournalApp
            language={language}
            isDark={isDark}
            entries={journalEntries}
            onUpdateEntries={setJournalEntries}
            prompts={journalPrompts}
            onUpdatePrompts={setJournalPrompts}
            onPrint={handleOpenPrintModal}
            onPrintCustomHtml={handleOpenCustomPrintModal}
            typewriterEnabled={typewriterEnabled}
            onToggleTypewriter={() => setTypewriterEnabled((v) => !v)}
          />
        )}

        {activeTab === 'edudesign' && (
          <EduDesignApp
            language={language}
            isDark={isDark}
            projects={projects}
            onUpdateProjects={setProjects}
            activeProjectId={activeProjectId}
            onSelectProject={setActiveProjectId}
            onPrint={handleOpenPrintModal}
          />
        )}

        {activeTab === 'wellbeing' && (
          <WellbeingApp
            language={language}
            isDark={isDark}
            onPrint={handleOpenPrintModal}
            onPrintCustomHtml={handleOpenCustomPrintModal}
          />
        )}

        {activeTab === 'assessment' && (
          <AssessmentApp
            language={language}
            isDark={isDark}
            assignments={assignments}
            onUpdateAssignments={setAssignments}
            activeAssignmentId={activeAssignmentId}
            onSelectAssignmentId={setActiveAssignmentId}
            evaluations={evaluations}
            onUpdateEvaluations={setEvaluations}
            criteriaBank={criteriaBank}
            onUpdateCriteriaBank={setCriteriaBank}
            students={students}
            onUpdateStudents={setStudents}
            onPrintCustomHtml={handleOpenCustomPrintModal}
          />
        )}

        {activeTab === 'observations' && (
          <ObservationsApp
            language={language}
            isDark={isDark}
            observations={observations}
            onUpdateObservations={setObservations}
            activeObservationId={currentObservation?.id || ''}
            onSelectObservationId={setActiveObservationId}
            onPrintCustomHtml={handleOpenCustomPrintModal}
          />
        )}

        {activeTab === 'addie' && (
          <AddieApp
            language={language}
            isDark={isDark}
            projects={addieProjects}
            onUpdateProjects={setAddieProjects}
            activeProjectId={currentAddieProject?.id || ''}
            onSelectProjectId={setActiveAddieId}
            onPrintCustomHtml={handleOpenCustomPrintModal}
          />
        )}

        {activeTab === 'about' && (
          <AboutApp
            language={language}
            onPrintCustomHtml={handleOpenCustomPrintModal}
          />
        )}
      </main>

      {/* Global PDF & Print Export Modal */}
      <PdfExportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={pdfModalData.title}
        subtitle={pdfModalData.subtitle || ''}
        documentContentHtml={pdfModalData.contentHtml}
        filenamePrefix={pdfModalData.filename}
        language={language}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 no-print transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {getT(language).appTitle}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
              {getT(language).footer.localSave}
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            {getT(language).footer.tagline} &bull; Česky &bull; English &bull; Polski
          </div>
        </div>
      </footer>
    </div>
  );
}
