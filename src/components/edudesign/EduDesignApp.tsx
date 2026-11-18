import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Sparkles,
  Target,
  Layers,
  BookCheck,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowRight,
  Printer,
  RefreshCw,
  Lightbulb,
  Gamepad2,
  ListChecks,
  AlertTriangle,
} from 'lucide-react';
import {
  LearningProject,
  SubGoal,
  EducationalObject,
  BloomLevel,
  Language,
} from '../../types';
import { translations } from '../../i18n/translations';
import {
  EDUCATIONAL_OBJECT_TEMPLATES,
  getLocalizedEduTemplate,
} from '../../utils/initialData';

interface EduDesignAppProps {
  language: Language;
  isDark: boolean;
  projects: LearningProject[];
  onUpdateProjects: (projects: LearningProject[]) => void;
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onPrint: () => void;
}

export const EduDesignApp: React.FC<EduDesignAppProps> = ({
  language,
  projects,
  onUpdateProjects,
  activeProjectId,
  onSelectProject,
  onPrint,
}) => {
  const t = translations[language].edudesign;

  // Active step / tab: goals | bloom | objects | evaluation | map
  const [activeTab, setActiveTab] = useState<'goals' | 'bloom' | 'objects' | 'evaluation' | 'map'>('goals');

  // Inline notices (no window.alert / window.confirm)
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Currently selected project
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  const uiText = useMemo(() => {
    if (language === 'en') {
      return {
        alignmentBadge: 'Constructive Alignment',
        ruleHeader: 'Rule: Must start learner-centered',
        projectTitleLabel: 'Project Title',
        subjectFieldLabel: 'Subject / Discipline',
        subGoalLabel: 'Sub-Goal',
        subGoalGoalPrefix: 'Goal',
        durationLabel: 'Duration',
        typeLabel: 'Type',
        gamificationLabel: 'Gamification:',
        methodTipLabel: 'Methodological tip:',
        templatesCatalogTitle: 'Catalog of 20 ready-to-use didactic templates:',
        evalGuideSubtitle: 'Checks whether criteria are scored binary (pass/fail) or nominal (weighted rubric scale).',
        binaryHint: 'Ideal for formal deliverables (submitted on time, required length met, mandatory attachments included).',
        nominalHint: 'Ideal for depth of reasoning, originality, terminology accuracy, and quality of synthesis.',
        verifCatalogHeading: 'Concrete implementation options for verification methods:',
        mapSubtitle: 'Visual flow linking General Goal → Sub-Goals → Learning Objects → Verification Methods without overlapping bubbles.',
        node1Title: '1. General Learning Goal',
        node2Title: '2. Specific Sub-Goals & Bloom’s Taxonomy',
        node3Title: '3. Learning Objects & Interaction Mode',
        node4Title: '4. Gamification & Methodological Reflection',
        verificationShort: 'Verification:',
        gamificationMapText: 'Cooperative clue unlocking without competition: each pair contributes one validated hypothesis check toward the shared class poster.',
        methodTipMapText: 'Include a 3-minute silent reflection pause before final synthesis so quieter students can organize their thoughts before sharing.',
        aiModalTitle: 'AI Recommended Learning Objects for Goal',
        rationaleLabel: 'Rationale:',
        interactionLabel: 'Interaction:',
        evalMethodLabel: 'Verification:',
        generateModalTitle: 'Generate Educational Object from Prompt',
        generateModalDesc: 'Provide classroom context parameters to generate a tailored educational object structure.',
        generateTargetLabel: 'Target group description',
        generateContextLabel: 'Broader context & classroom setup',
        generateFormLabel: 'Lesson format & timing',
        generateTypeLabel: 'Preferred object type',
        cancelBtn: 'Cancel',
        generateNowBtn: 'Generate Object',
        lastProjectErr: 'Cannot delete the last project. Create a new project first.',
        genObjectErr: 'Failed to generate educational object.',
        defaultGroup: 'Lower-secondary students (Grade 8)',
        defaultContext: 'Classroom instruction with team collaboration tables',
        defaultForm: '45-minute seminar block',
        defaultType: 'Interactive inquiry worksheet',
        useActionPrefix: '+',
        qualityCriterionName: 'Quality',
        goalAttainmentCriterionName: 'Goal attainment',
      };
    }
    if (language === 'pl') {
      return {
        alignmentBadge: 'Wyrównanie konstruktywistyczne',
        ruleHeader: 'Zasada: Musi zaczynać się od ucznia',
        projectTitleLabel: 'Nazwa projektu',
        subjectFieldLabel: 'Przedmiot / Dziedzina',
        subGoalLabel: 'Cel cząstkowy',
        subGoalGoalPrefix: 'Cel',
        durationLabel: 'Czas trwania',
        typeLabel: 'Typ',
        gamificationLabel: 'Grywalizacja:',
        methodTipLabel: 'Wskazówka metodyczna:',
        templatesCatalogTitle: 'Katalog 20 szablonów dydaktycznych do natychmiastowego użycia:',
        evalGuideSubtitle: 'Monitoruje, czy kryteria są oceniane binarnie (zaliczone/niezaliczone) czy nominalnie (skala z wagami).',
        binaryHint: 'Idealne do wymogów formalnych (oddanie w terminie, zachowana objętość, komplet załączników).',
        nominalHint: 'Idealne dla głębi argumentacji, oryginalności, precyzji terminologii i jakości syntezy.',
        verifCatalogHeading: 'Konkretne możliwości wdrożenia metod weryfikacji:',
        mapSubtitle: 'Mapa wizualna łącząca Cel główny → Cele cząstkowe → Obiekty edukacyjne → Metody weryfikacji bez nakładających się elementów.',
        node1Title: '1. Główny cel edukacyjny',
        node2Title: '2. Szczegółowe cele cząstkowe i taksonomia Blooma',
        node3Title: '3. Obiekty edukacyjne i sposób interakcji',
        node4Title: '4. Mikrogrywalizacja i wskazówka metodyczna',
        verificationShort: 'Weryfikacja:',
        gamificationMapText: 'Kooperatywne odkrywanie wskazówek bez rywalizacji: każda para dokłada jedną zweryfikowaną hipotezę do wspólnego plakatu klasy.',
        methodTipMapText: 'Zaplanuj 3-minutową chwilę cichej refleksji przed finalną syntezą, aby bardziej introwertyczni uczniowie uporządkowali wypowiedź.',
        aiModalTitle: 'Rekomendowane obiekty edukacyjne do celu (AI)',
        rationaleLabel: 'Uzasadnienie:',
        interactionLabel: 'Interakcja:',
        evalMethodLabel: 'Weryfikacja:',
        generateModalTitle: 'Wygeneruj obiekt edukacyjny według wytycznych',
        generateModalDesc: 'Uzupełnij kontekst klasy, aby wygenerować dopasowaną strukturę obiektu dydaktycznego.',
        generateTargetLabel: 'Opis grupy docelowej',
        generateContextLabel: 'Szerszy kontekst i zaplecze sali',
        generateFormLabel: 'Forma zajęć i czas',
        generateTypeLabel: 'Preferowany typ obiektu',
        cancelBtn: 'Anuluj',
        generateNowBtn: 'Wygeneruj obiekt',
        lastProjectErr: 'Nie można usunąć ostatniego projektu. Najpierw utwórz nowy.',
        genObjectErr: 'Błąd podczas generowania obiektu.',
        defaultGroup: 'Uczniowie klasy 8 szkoły podstawowej',
        defaultContext: 'Zajęcia stacjonarne w klasie z możliwością pracy w grupach',
        defaultForm: 'Blok seminaryjny 45 minut',
        defaultType: 'Interaktywna karta badawcza',
        useActionPrefix: '+',
        qualityCriterionName: 'Jakość wykonania',
        goalAttainmentCriterionName: 'Osiągnięcie celu',
      };
    }
    return {
      alignmentBadge: 'Konstruktivistické sladění',
      ruleHeader: 'Pravidlo: Musí začínat formulací ze strany žáka',
      projectTitleLabel: 'Název projektu',
      subjectFieldLabel: 'Předmět / Obor',
      subGoalLabel: 'Dílčí cíl',
      subGoalGoalPrefix: 'Cíl',
      durationLabel: 'Časová dotace',
      typeLabel: 'Typ',
      gamificationLabel: 'Gamifikace:',
      methodTipLabel: 'Metodický tip:',
      templatesCatalogTitle: 'Katalog 20 didaktických šablon k okamžitému použití:',
      evalGuideSubtitle: 'Průvodce sleduje, zda jsou kritéria hodnocena binárně (splněno/nesplněno) nebo nominálně (škála s váhami).',
      binaryHint: 'Vhodné pro formální náležitosti (odevzdáno včas, dodržen rozsah, obsahuje povinné přílohy).',
      nominalHint: 'Vhodné pro hloubku argumentace, originalitu, přesnost terminologie a kvalitu syntézy.',
      verifCatalogHeading: 'Konkrétní možnosti implementace ověřovacích metod:',
      mapSubtitle: 'Vizuální mapa propojující Hlavní cíl → Podcíle → Vzdělávací objekty → Metody ověření s jasným odstupem a bez překrývání bublin.',
      node1Title: '1. Hlavní vzdělávací cíl (General Goal)',
      node2Title: '2. Dílčí specifické podcíle & Bloomova taxonomie',
      node3Title: '3. Vzdělávací objekty & Způsob interakce',
      node4Title: '4. Mikrogamifikace & Metodický tip',
      verificationShort: 'Ověření:',
      gamificationMapText: 'Kooperativní odemykání indicií bez soutěže: každá dvojice přispěje jedním validním ověřením hypotézy k celotřídnímu vědeckému plakátu.',
      methodTipMapText: 'Zařaďte 3minutový silent reflection moment před závěrečnou syntézou, aby si i introverznější žáci ujasnili formulaci před sdílením.',
      aiModalTitle: 'Doporučené vzdělávací objekty k dosažení cíle (AI)',
      rationaleLabel: 'Zdůvodnění:',
      interactionLabel: 'Interakce:',
      evalMethodLabel: 'Ověření:',
      generateModalTitle: 'Vygenerovat vzdělávací objekt podle zadání',
      generateModalDesc: 'Doplňte kontextové parametry třídy pro vygenerování přesné struktury výukového objektu.',
      generateTargetLabel: 'Popis cílové skupiny',
      generateContextLabel: 'Širší kontext a zázemí',
      generateFormLabel: 'Forma výuky a čas',
      generateTypeLabel: 'Preferovaný typ objektu',
      cancelBtn: 'Zrušit',
      generateNowBtn: 'Vygenerovat objekt',
      lastProjectErr: 'Nelze smazat poslední projekt. Vytvořte nejprve nový.',
      genObjectErr: 'Chyba při generování objektu.',
      defaultGroup: 'Žáci 2. stupně ZŠ (8. ročník)',
      defaultContext: 'Klasická výuka ve třídě s možností práce v týmech',
      defaultForm: 'Seminární blok 45 minut',
      defaultType: 'Interaktivní badatelský list',
      useActionPrefix: '+',
      qualityCriterionName: 'Kvalita zpracování',
      goalAttainmentCriterionName: 'Naplnění cíle',
    };
  }, [language]);

  // AI 5-Objects modal state
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = useState<boolean>(false);

  // Generate full object modal state
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [generateTargetGroup, setGenerateTargetGroup] = useState<string>(uiText.defaultGroup);
  const [generateContext, setGenerateContext] = useState<string>(uiText.defaultContext);
  const [generateForm, setGenerateForm] = useState<string>(uiText.defaultForm);
  const [generateType, setGenerateType] = useState<string>(uiText.defaultType);
  const [isGeneratingFullObject, setIsGeneratingFullObject] = useState<boolean>(false);

  // Verification method implementation choices localized
  const verificationMethodsCatalog = useMemo((): Record<string, string[]> => {
    if (language === 'en') {
      return {
        'Formative Exit Ticket': [
          'Digital form (Google Forms / MS Forms) with 1 key conceptual question',
          'Paper exit card handed at the classroom door at lesson end',
          'Peer pair self-check highlighting remaining uncertainties',
        ],
        'Criterion Rubric for Artifact Assessment': [
          '4×3 matrix with verbal performance descriptors shared upfront',
          'Analytic weighting (Content 40%, Reasoning 40%, Form 20%)',
          'Two-round assessment (draft -> formative feedback -> final version)',
        ],
        'Peer Assessment': [
          '“Two Stars and a Wish” protocol (2 strengths, 1 actionable step)',
          'Anonymous rotation of drafts in a circle with rubric notes',
          'Critical-friend pair check during mid-task workshop',
        ],
        'Oral Defense & Class Presentation': [
          'PechaKucha format (20 slides × 20 seconds)',
          'Classroom Gallery Walk / Idea Marketplace',
          'Moderated Q&A with 3 opponent questions from the audience',
        ],
        'Practical Simulation / Transfer Test': [
          'Solving a transfer task in an unfamiliar real-world context',
          'Live testing of a built prototype / program / model',
          'Concept Inventory diagnostic quiz with targeted distractors',
        ],
      };
    }
    if (language === 'pl') {
      return {
        'Kształtująca wejściówka wyjściowa (Exit Ticket)': [
          'Formularz cyfrowy (Google Forms / MS Forms) z 1 kluczowym pytaniem koncepcyjnym',
          'Papierowa karteczka z odpowiedzią oddawana przy wyjściu z sali',
          'Samokontrola w parach ze wskazaniem trudniejszych miejsc',
        ],
        'Rubryka kryterialna oceny artefaktu': [
          'Macierz 4×3 ze słownymi deskryptorami przedstawiona uczniom przed zadaniem',
          'Punktacja analityczna (treść 40%, argumentacja 40%, forma 20%)',
          'Ocena dwuetapowa (szkic -> informacja zwrotna -> wersja finalna)',
        ],
        'Ocena koleżeńska (Peer Assessment)': [
          'Metoda „Dwie gwiazdy i jedno życzenie” (2 pochwały, 1 zalecenie)',
          'Anonimowa rotacja prac w kręgu z komentarzem do rubryki',
          '„Krytyczny przyjaciel” w parze podczas pracy nad projektem',
        ],
        'Obrona i prezentacja przed klasą': [
          'Format PechaKucha (20 slajdów po 20 sekund)',
          'Targi pomysłów / Wernisaż plakatów w klasie',
          'Moderowana dyskusja z 3 pytaniami oponentów z sali',
        ],
        'Praktyczna weryfikacja w symulacji / teście': [
          'Rozwiązanie zadania transferowego w nieznanym wcześniej kontekście',
          'Testowanie na żywo stworzonego programu lub modelu',
          'Test koncepcyjny (Concept Inventory) z dystraktorami',
        ],
      };
    }
    return {
      'Formativní výstupní propustka (Exit Ticket)': [
        'Digitální formulář (Google Forms / MS Forms) s 1 klíčovou konceptuální otázkou',
        'Papírový lísteček s odpovědí odevzdaný u dveří na konci hodiny',
        'Párová sebekontrola s označením nejistot',
      ],
      'Kriteriální rubrika pro hodnocení artefaktu': [
        'Matice 4x3 se slovními deskriptory výkonu předaná žákům předem',
        'Analytické bodování (obsah 40%, argumentace 40%, forma 20%)',
        'Dvoukolové hodnocení (návrh -> zpětná vazba -> finální verze)',
      ],
      'Vrstevnické hodnocení (Peer Assessment)': [
        'Metoda „Dvě hvězdy a jedno přání“ (2 ocenění, 1 doporučení)',
        'Anonymní rotace prací v kruhu s komentářem',
        'Kritický přítel ve dvojici během rozpracování',
      ],
      'Obhajoba a prezentace před třídou': [
        'PechaKucha formát (20 slidů po 20 sekundách)',
        'Tržiště nápadů / Vernisáž plakátů ve třídě',
        'Řízená diskuse se 3 oponentními dotazy z publika',
      ],
      'Praktické ověření v simulaci / testu': [
        'Řešení transferové úlohy na neznámém kontextu',
        'Live testování vytvořeného programu / modelu',
        'Konceptový test (Concept Inventory) s distraktory',
      ],
    };
  }, [language]);

  // Helper to update current project
  const updateProject = (updated: LearningProject) => {
    const nextProjects = projects.map((p) => (p.id === updated.id ? updated : p));
    onUpdateProjects(nextProjects);
  };

  // Delete project handler (inline confirm, no window.alert/confirm)
  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) {
      setInlineError(uiText.lastProjectErr);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setInlineError(null), 4000);
      return;
    }
    if (confirmDeleteId === projectId) {
      const filtered = projects.filter((p) => p.id !== projectId);
      onUpdateProjects(filtered);
      onSelectProject(filtered[0].id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(projectId);
    }
  };

  // Create new project handler
  const handleCreateNewProject = () => {
    const newId = `proj_${Date.now()}`;
    const sg1Id = `sg_${Date.now()}_1`;
    const sg2Id = `sg_${Date.now()}_2`;
    const newProj: LearningProject =
      language === 'en'
        ? {
            id: newId,
            title: t.newProjectDefaultName,
            subject: 'Computer Science & Social Studies',
            targetGroup: 'High school Year 1',
            context: 'In-person seminar in computer lab',
            lessonForm: 'Inquiry-based group seminar',
            generalGoal: 'The student can analyze recommender algorithms and evaluate their ethical impact.',
            subGoals: [
              { id: sg1Id, text: 'The student explains how collaborative filtering shapes feed ranking.', bloomLevel: 'understand' },
              { id: sg2Id, text: 'The student evaluates filter-bubble risks using empirical examples.', bloomLevel: 'evaluate' },
            ],
            learningObjects: [
              {
                id: `obj_${Date.now()}_1`,
                title: 'Interactive Case Study on Algorithmic Feeds',
                type: 'case_study',
                duration: '30 min',
                targetSubGoalIds: [sg1Id],
                studentActivity: 'Teams audit a sample feed scenario and propose transparent ranking rules.',
                teacherRole: 'Socratic discussion facilitator.',
                verificationMethod: 'Criterion Rubric',
                implementationDetails: '4×3 matrix with descriptors distributed beforehand',
                assessmentCriteria: [
                  { id: 'c1', name: 'Terminology precision', type: 'nominal', maxPoints: 5, weight: 1, description: 'Accurate use of filter bubble and engagement bias terms' },
                  { id: 'c2', name: 'Timely submission', type: 'binary', maxPoints: 1, weight: 1, description: 'Submitted within lesson window' },
                ],
                gamificationTip: 'Shared unlocking board: each solved dimension reveals the next case layer cooperatively.',
                methodologicalTip: 'Have students write down one personal algorithmic feed encounter before group discussion.',
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            history: [],
          }
        : language === 'pl'
        ? {
            id: newId,
            title: t.newProjectDefaultName,
            subject: 'Informatyka i wiedza o społeczeństwie',
            targetGroup: 'Uczniowie 1. klasy liceum',
            context: 'Seminarium stacjonarne w pracowni komputerowej',
            lessonForm: 'Zajęcia grupowe metodą badawczą',
            generalGoal: 'Uczeń potrafi analizować algorytmy rekomendacji i oceniać ich skutki etyczne.',
            subGoals: [
              { id: sg1Id, text: 'Uczeń wyjaśnia zasadę działania algorytmu rekomendacji treści.', bloomLevel: 'understand' },
              { id: sg2Id, text: 'Uczeń ocenia zagrożenia baniek informacyjnych w mediach społecznościowych.', bloomLevel: 'evaluate' },
            ],
            learningObjects: [
              {
                id: `obj_${Date.now()}_1`,
                title: 'Interaktywne studium przypadku algorytmów feedu',
                type: 'case_study',
                duration: '30 min',
                targetSubGoalIds: [sg1Id],
                studentActivity: 'Zespoły analizują scenariusz i projektują przejrzystą modyfikację feedu.',
                teacherRole: 'Facilitator dyskusji sokratejskiej.',
                verificationMethod: 'Rubryka kryterialna',
                implementationDetails: 'Macierz 4×3 przedstawiona uczniom na starcie zajęć',
                assessmentCriteria: [
                  { id: 'c1', name: 'Precyzja terminologii', type: 'nominal', maxPoints: 5, weight: 1, description: 'Poprawne użycie pojęć bańka informacyjna i engagement' },
                  { id: 'c2', name: 'Terminowość oddania', type: 'binary', maxPoints: 1, weight: 1, description: 'Dotrzymanie limitu czasu' },
                ],
                gamificationTip: 'Wspólna tablica odblokowywania: każdy rozwiązany wątek odsłania kolejną warstwę problemu.',
                methodologicalTip: 'Poproś uczniów, by przed dyskusją zapisali jedno własne doświadczenie z algorytmem.',
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            history: [],
          }
        : {
            id: newId,
            title: t.newProjectDefaultName,
            subject: 'Informatika a společenské vědy',
            targetGroup: 'Studenti 1. ročníku SŠ',
            context: 'Prezenční seminář v počítačové učebně',
            lessonForm: 'Skupinová výuka s badatelským prvkem',
            generalGoal: 'Student umí analyzovat algoritmy a vysvětlit jejich etické dopady.',
            subGoals: [
              { id: sg1Id, text: 'Student vysvětlí princip fungování doporučovacího algoritmu.', bloomLevel: 'understand' },
              { id: sg2Id, text: 'Student zhodnotí etická rizika bublin sociálních sítí.', bloomLevel: 'evaluate' },
            ],
            learningObjects: [
              {
                id: `obj_${Date.now()}_1`,
                title: 'Interaktivní případová studie algoritmického doporučování',
                type: 'case_study',
                duration: '30 min',
                targetSubGoalIds: [sg1Id],
                studentActivity: 'Žáci v týmu rozebírají scénář a navrhují úpravu feedu.',
                teacherRole: 'Facilitátor sokratovské diskuse.',
                verificationMethod: 'Kriteriální rubrika pro hodnocení artefaktu',
                implementationDetails: 'Matice 4x3 se slovními deskriptory výkonu předaná žákům předem',
                assessmentCriteria: [
                  { id: 'c1', name: 'Přesnost terminologie', type: 'nominal', maxPoints: 5, weight: 1, description: 'Správné použití pojmů filter bubble a engagement' },
                  { id: 'c2', name: 'Odevzdání včas', type: 'binary', maxPoints: 1, weight: 1, description: 'Dodržení časového limitu' },
                ],
                gamificationTip: 'Společná odemykací nástěnka: každý vyřešený aspekt případu odkrývá další vrstvu kontextu bez vzájemného soupeření.',
                methodologicalTip: 'Požádejte žáky, aby si před diskusí zapsali jednu svoji vlastní zkušenost s algoritmem.',
              },
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            history: [],
          };
    onUpdateProjects([...projects, newProj]);
    onSelectProject(newId);
    setConfirmDeleteId(null);
  };

  // SMART Goal Checker
  const checkGoalStartsNotice = (goalText: string) => {
    const normalized = (goalText || '').trim();
    return (
      /^Student\s+(umí|zná|chápe|dokáže|analyzuje|vytvoří|rozpozná|vysvětlí|zhodnotí)/i.test(normalized) ||
      /^Uczeń\s+(potrafi|zna|rozumie|analizuje|tworzy|wyjaśnia|ocenia)/i.test(normalized) ||
      /^(The student|Student|Learners?)\s+(can|knows|understands|is able to|analyzes|explains|evaluates|creates)/i.test(normalized)
    );
  };

  // AI 5 Objects fetcher
  const handleAskAiForObjects = async (subGoal: SubGoal) => {
    setIsLoadingAiSuggestions(true);
    setInlineError(null);
    setShowAiModal(true);
    try {
      const res = await fetch('/api/gemini/edudesign-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: subGoal.text,
          bloomLevel: subGoal.bloomLevel,
          targetGroup: currentProject?.targetGroup,
          language,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiSuggestions(data.suggestions || []);
    } catch (err) {
      console.error(err);
      setInlineError(uiText.genObjectErr);
      setShowAiModal(false);
    } finally {
      setIsLoadingAiSuggestions(false);
    }
  };

  const openGenerateModal = () => {
    setGenerateTargetGroup(currentProject?.targetGroup || uiText.defaultGroup);
    setGenerateContext(currentProject?.context || uiText.defaultContext);
    setGenerateForm(currentProject?.lessonForm || uiText.defaultForm);
    setGenerateType(uiText.defaultType);
    setShowGenerateModal(true);
  };

  // AI Full Object generator
  const handleGenerateFullObject = async () => {
    if (!currentProject) return;
    setIsGeneratingFullObject(true);
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/generate-object', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: currentProject.generalGoal,
          bloomLevel: currentProject.subGoals[0]?.bloomLevel || 'apply',
          targetGroup: generateTargetGroup,
          context: generateContext,
          lessonForm: generateForm,
          objectType: generateType,
          language,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const newObj: EducationalObject = {
        id: `obj_gen_${Date.now()}`,
        title: data.title || generateType,
        type: 'generated',
        duration: data.duration || '45 min',
        targetSubGoalIds: currentProject.subGoals.map((s) => s.id),
        studentActivity: data.studentActivity || '-',
        teacherRole: data.teacherRole || '-',
        verificationMethod: Object.keys(verificationMethodsCatalog)[1] || 'Rubric',
        implementationDetails: '',
        assessmentCriteria: (data.assessmentCriteria || []).map((c: any, i: number) => ({
          id: `crit_${Date.now()}_${i}`,
          name: c.criterion || `${uiText.qualityCriterionName} ${i + 1}`,
          type: c.type === 'binary' ? 'binary' : 'nominal',
          maxPoints: c.maxPoints || 5,
          weight: 1,
          description: c.criterion,
        })),
        gamificationTip: data.gamificationTip || uiText.gamificationMapText,
        methodologicalTip: data.methodologicalTip || uiText.methodTipMapText,
      };

      updateProject({
        ...currentProject,
        learningObjects: [...currentProject.learningObjects, newObj],
      });
      setShowGenerateModal(false);
    } catch (err) {
      console.error(err);
      setInlineError(uiText.genObjectErr);
    } finally {
      setIsGeneratingFullObject(false);
    }
  };

  if (!currentProject) return null;

  return (
    <div className="space-y-6">
      {inlineError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{inlineError}</span>
        </div>
      )}

      {/* Top Banner: Project Selector, New Project, Delete Project, Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {currentProject.title}
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {uiText.alignmentBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentProject.subject} &bull; {currentProject.targetGroup}
            </p>
          </div>
        </div>

        {/* Project Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentProject.id}
            onChange={(e) => {
              onSelectProject(e.target.value);
              setConfirmDeleteId(null);
            }}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 font-semibold"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateNewProject}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold cursor-pointer"
            title={t.newProject}
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{t.newProject}</span>
          </button>

          {confirmDeleteId === currentProject.id ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleDeleteProject(currentProject.id)}
                className="px-2.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                {t.deleteProject}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer"
              >
                {uiText.cancelBtn}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleDeleteProject(currentProject.id)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer"
              title={t.deleteProject}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            title={t.exportPdf}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.exportPdf}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs: Cíle kept verbatim per domain constraint! */}
      <div className="flex overflow-x-auto gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl no-scrollbar no-print">
        {[
          { id: 'goals', label: t.tabs.goals, icon: <Target className="w-4 h-4" /> },
          { id: 'bloom', label: t.tabs.bloom, icon: <Layers className="w-4 h-4" /> },
          { id: 'objects', label: t.tabs.objects, icon: <BookCheck className="w-4 h-4" /> },
          { id: 'evaluation', label: t.tabs.evaluation, icon: <ListChecks className="w-4 h-4" /> },
          { id: 'map', label: t.tabs.map, icon: <CheckCircle2 className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* STEP 1: CÍLE & SMART FORMULATION */}
      {activeTab === 'goals' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <span>{t.generalGoal}</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-500">
                {uiText.ruleHeader}
              </span>
            </div>

            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                checkGoalStartsNotice(currentProject.generalGoal)
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <span className="font-bold block">
                  {checkGoalStartsNotice(currentProject.generalGoal)
                    ? t.studentStartsOk
                    : t.studentStartsFail}
                </span>
                <span className="text-[11px] opacity-90">
                  {t.studentStartsNotice}
                </span>
              </div>
            </div>

            <textarea
              rows={3}
              value={currentProject.generalGoal}
              onChange={(e) => updateProject({ ...currentProject, generalGoal: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3.5 text-xs text-slate-900 dark:text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={t.generalGoalPlaceholder}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-medium text-slate-500">{uiText.projectTitleLabel}</label>
                <input
                  type="text"
                  value={currentProject.title}
                  onChange={(e) => updateProject({ ...currentProject, title: e.target.value })}
                  className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">{uiText.subjectFieldLabel}</label>
                <input
                  type="text"
                  value={currentProject.subject}
                  onChange={(e) => updateProject({ ...currentProject, subject: e.target.value })}
                  className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500">{t.targetGroupLabel}</label>
                <input
                  type="text"
                  value={currentProject.targetGroup}
                  onChange={(e) => updateProject({ ...currentProject, targetGroup: e.target.value })}
                  className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.subGoalsTitle} ({currentProject.subGoals.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  const newSubGoal: SubGoal = {
                    id: `sg_${Date.now()}`,
                    text: t.subGoalPlaceholder,
                    bloomLevel: 'analyze',
                  };
                  updateProject({
                    ...currentProject,
                    subGoals: [...currentProject.subGoals, newSubGoal],
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.addSubGoal}</span>
              </button>
            </div>

            <div className="space-y-3">
              {currentProject.subGoals.map((sg, idx) => (
                <div
                  key={sg.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-500">
                      {uiText.subGoalLabel} {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = currentProject.subGoals.filter((s) => s.id !== sg.id);
                        updateProject({ ...currentProject, subGoals: updated });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={sg.text}
                    onChange={(e) => {
                      const updated = currentProject.subGoals.map((s) =>
                        s.id === sg.id ? { ...s, text: e.target.value } : s
                      );
                      updateProject({ ...currentProject, subGoals: updated });
                    }}
                    className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: BLOOM TAXONOMY */}
      {activeTab === 'bloom' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>{t.bloomTitle}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.bloomSubtitle}
              </p>
            </div>

            <div className="space-y-4">
              {currentProject.subGoals.map((sg, idx) => (
                <div
                  key={sg.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {uiText.subGoalGoalPrefix} {idx + 1}: {sg.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAskAiForObjects(sg)}
                      className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs hover:bg-indigo-100 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t.aiRecommendObjects}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as BloomLevel[]).map((lvl) => {
                      const isSelected = sg.bloomLevel === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            const updated = currentProject.subGoals.map((s) =>
                              s.id === sg.id ? { ...s, bloomLevel: lvl } : s
                            );
                            updateProject({ ...currentProject, subGoals: updated });
                          }}
                          className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {t.bloomCategories[lvl]}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {t.activeVerbsLabel}
                    </span>
                    {t.bloomVerbs[sg.bloomLevel]?.map((verb) => (
                      <span key={verb} className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono">
                        {verb}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: LEARNING OBJECTS & 20 TEMPLATES */}
      {activeTab === 'objects' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t.templatesTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.templatesSubtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={openGenerateModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.aiGenerateFullObject}</span>
            </button>
          </div>

          <div className="space-y-4">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {t.selectedObjectsTitle} ({currentProject.learningObjects.length}):
            </span>
            {currentProject.learningObjects.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                {t.noSelectedObjects}
              </div>
            ) : (
              currentProject.learningObjects.map((obj) => (
                <div
                  key={obj.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-base font-bold text-slate-900 dark:text-white block">
                        {obj.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {uiText.durationLabel}: {obj.duration} &bull; {uiText.typeLabel}: {obj.type}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = currentProject.learningObjects.filter((o) => o.id !== obj.id);
                        updateProject({ ...currentProject, learningObjects: updated });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title={t.removeObject}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {t.studentActivityLabel}
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {obj.studentActivity}
                      </p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        {t.teacherRoleLabel}
                      </span>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {obj.teacherRole}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1 text-xs">
                    {obj.gamificationTip && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-900/60">
                        <Gamepad2 className="w-3.5 h-3.5 text-purple-500" />
                        <span><strong>{uiText.gamificationLabel}</strong> {obj.gamificationTip}</span>
                      </div>
                    )}
                    {obj.methodologicalTip && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span><strong>{uiText.methodTipLabel}</strong> {obj.methodologicalTip}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              {uiText.templatesCatalogTitle}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EDUCATIONAL_OBJECT_TEMPLATES.map((rawTmpl, i) => {
                const tmpl = getLocalizedEduTemplate(rawTmpl, language);
                return (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between gap-3 text-xs hover:border-emerald-400 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block mb-1">
                        {tmpl.title}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {tmpl.duration} &bull; {tmpl.studentActivity?.slice(0, 72)}...
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newObj: EducationalObject = {
                          id: `obj_tmpl_${Date.now()}_${i}`,
                          title: tmpl.title || 'Object',
                          type: tmpl.type || 'template',
                          duration: tmpl.duration || '30 min',
                          targetSubGoalIds: currentProject.subGoals.map((s) => s.id),
                          studentActivity: tmpl.studentActivity || '',
                          teacherRole: tmpl.teacherRole || '',
                          verificationMethod: tmpl.verificationMethod || 'Rubric',
                          implementationDetails: tmpl.implementationDetails || '',
                          assessmentCriteria: [
                            { id: `c_${Date.now()}`, name: uiText.qualityCriterionName, type: 'nominal', maxPoints: 5, weight: 1, description: tmpl.verificationMethod || '' },
                          ],
                          gamificationTip: uiText.gamificationMapText,
                          methodologicalTip: uiText.methodTipMapText,
                        };
                        updateProject({
                          ...currentProject,
                          learningObjects: [...currentProject.learningObjects, newObj],
                        });
                      }}
                      className="w-full py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-[11px] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 cursor-pointer"
                    >
                      {uiText.useActionPrefix} {t.useTemplateBtn}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: EVALUATION CRITERIA & VERIFICATION METHODS */}
      {activeTab === 'evaluation' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-emerald-600" />
                <span>{t.evaluationGuide}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {uiText.evalGuideSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs space-y-1">
                <span className="font-bold text-emerald-950 dark:text-emerald-300">
                  {t.binaryDesc}
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {uiText.binaryHint}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs space-y-1">
                <span className="font-bold text-indigo-950 dark:text-indigo-300">
                  {t.nominalDesc}
                </span>
                <p className="text-slate-600 dark:text-slate-400">
                  {uiText.nominalHint}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {uiText.verifCatalogHeading}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(verificationMethodsCatalog).map(([method, implementations]) => (
                  <div
                    key={method}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs space-y-2"
                  >
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {method}
                    </span>
                    <ul className="space-y-1.5 text-slate-600 dark:text-slate-400">
                      {implementations.map((impl, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">&bull;</span>
                          <span>{impl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: CONSTRUCTIVE ALIGNMENT MAP */}
      {activeTab === 'map' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{t.constructiveAlignmentAudit}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {uiText.mapSubtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={onPrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{t.exportPdf}</span>
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-8">
              <div className="max-w-xl mx-auto p-4 rounded-2xl bg-indigo-600 text-white shadow-md text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                  {uiText.node1Title}
                </span>
                <p className="font-bold text-sm sm:text-base leading-snug">
                  {currentProject.generalGoal}
                </p>
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowRight className="w-5 h-5 rotate-90" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center block">
                  {uiText.node2Title}
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentProject.subGoals.map((sg, i) => (
                    <div
                      key={sg.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {uiText.subGoalLabel} {i + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded font-bold uppercase text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {t.bloomCategories[sg.bloomLevel]}
                        </span>
                      </div>
                      <p className="font-medium text-slate-800 dark:text-slate-200 leading-snug">
                        {sg.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowRight className="w-5 h-5 rotate-90" />
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center block">
                  {uiText.node3Title}
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentProject.learningObjects.map((obj, i) => (
                    <div
                      key={obj.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-2xs space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {i + 1}. {obj.title}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {obj.duration}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                        <strong>{t.studentActivityLabel}</strong> {obj.studentActivity}
                      </p>
                      <div className="pt-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                        <strong>{uiText.verificationShort}</strong> {obj.verificationMethod}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center text-slate-400">
                <ArrowRight className="w-5 h-5 rotate-90" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-xs space-y-1.5">
                  <span className="font-bold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                    <Gamepad2 className="w-4 h-4 text-purple-600" />
                    <span>{t.gamificationProposal}</span>
                  </span>
                  <p className="text-purple-900/80 dark:text-purple-300 leading-relaxed">
                    {uiText.gamificationMapText}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs space-y-1.5">
                  <span className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>{t.methodologicalTip}</span>
                  </span>
                  <p className="text-amber-900/80 dark:text-amber-300 leading-relaxed">
                    {uiText.methodTipMapText}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI 5 OBJECTS SUGGESTION MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {uiText.aiModalTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isLoadingAiSuggestions ? (
              <div className="py-12 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-600 mx-auto mb-2" />
                <span>{t.loadingObjectDetail}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {aiSuggestions.map((s, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {i + 1}. {s.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newObj: EducationalObject = {
                            id: `obj_ai_${Date.now()}_${i}`,
                            title: s.title,
                            type: s.type || 'ai_suggested',
                            duration: '30 min',
                            targetSubGoalIds: currentProject.subGoals.map((g) => g.id),
                            studentActivity: s.interaction || '-',
                            teacherRole: '-',
                            verificationMethod: s.evaluationMethod || '-',
                            implementationDetails: s.rationale || '',
                            assessmentCriteria: [
                              { id: `c_ai_${i}`, name: uiText.goalAttainmentCriterionName, type: 'nominal', maxPoints: 5, weight: 1, description: s.evaluationMethod || '' },
                            ],
                            gamificationTip: uiText.gamificationMapText,
                            methodologicalTip: uiText.methodTipMapText,
                          };
                          updateProject({
                            ...currentProject,
                            learningObjects: [...currentProject.learningObjects, newObj],
                          });
                          setShowAiModal(false);
                        }}
                        className="px-2.5 py-1 rounded bg-indigo-600 text-white font-bold hover:bg-indigo-700 cursor-pointer shrink-0"
                      >
                        {uiText.useActionPrefix} {t.useTemplateBtn}
                      </button>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      <strong>{uiText.rationaleLabel}</strong> {s.rationale}
                    </p>
                    <div className="text-[11px] text-slate-500">
                      <strong>{uiText.interactionLabel}</strong> {s.interaction} &bull; <strong>{uiText.evalMethodLabel}</strong> {s.evaluationMethod}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GENERATE FULL OBJECT DIALOG MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {uiText.generateModalTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {uiText.generateModalDesc}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">{uiText.generateTargetLabel}</label>
                <input
                  type="text"
                  value={generateTargetGroup}
                  onChange={(e) => setGenerateTargetGroup(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">{uiText.generateContextLabel}</label>
                <input
                  type="text"
                  value={generateContext}
                  onChange={(e) => setGenerateContext(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">{uiText.generateFormLabel}</label>
                <input
                  type="text"
                  value={generateForm}
                  onChange={(e) => setGenerateForm(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">{uiText.generateTypeLabel}</label>
                <input
                  type="text"
                  value={generateType}
                  onChange={(e) => setGenerateType(e.target.value)}
                  className="w-full mt-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
              >
                {uiText.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleGenerateFullObject}
                disabled={isGeneratingFullObject}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isGeneratingFullObject ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isGeneratingFullObject ? t.generatingObjects : uiText.generateNowBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

