export type Language = 'cs' | 'en' | 'pl';
export type ThemeMode = 'light' | 'dark';
export type AppTab = 'hub' | 'seating' | 'journal' | 'edudesign' | 'wellbeing' | 'assessment' | 'observations' | 'addie' | 'about';

// ----------------- SEATING APP TYPES -----------------
export type Gender = 'M' | 'F';

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  grades: Record<string, number[]>; // subject -> array of marks (1-5)
  notes?: string;
  specialNeeds?: string[]; // e.g. ['ADHD', 'Dyslexie', 'Asistent pedagoga', 'IVP', 'Zrakové znevýhodnění']
  specialNeedsNotes?: string;
}

export type ClassroomLayout = 'standard' | 'u_shape' | 'clusters';
export type BlackboardPosition = 'top' | 'bottom' | 'left' | 'right';

export interface ClassroomConfig {
  layout: ClassroomLayout;
  rows: number;
  cols: number;
  deskCapacity: number;
  blackboardPosition: BlackboardPosition;
  enforceBoyGirl: boolean;
  activeSubject: string; // 'all' or subject key
  studentViewMode?: boolean; // When true: friendly projection mode for kids with no visible grades!
}

export type PairRuleType = 'positive' | 'negative';

export interface SeatingPairRule {
  id: string;
  student1Id: string;
  student2Id: string;
  type: PairRuleType; // 'positive' (friends) | 'negative' (must not sit together)
}

export interface DeskSlot {
  deskId: string;
  row: number;
  col: number;
  studentIds: (string | null)[]; // length = deskCapacity
}

export interface StudentCorrelation {
  studentId: string;
  name: string;
  averageGrade: number;
  distanceFromBoard: number; // 1 (front) to N (back)
  correlationLevel: 'front_higher_need' | 'balanced' | 'rear_high_performer';
}

// ----------------- CREATIVE JOURNAL TYPES -----------------
export type MoodEmoji = '😊' | '🌟' | '🤔' | '🌿' | '💡' | '😴' | '🎨' | '⚡';

export interface JournalPrompt {
  id: string;
  key: string;
  title: string;
  placeholder: string;
  example: string;
  isCustom?: boolean;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mood: MoodEmoji;
  answers: Record<string, string>; // promptId -> answer
  sketches: string[]; // base64 PNGs
  photoUrl?: string;
  audioNote?: string; // base64 audio data URL
  audioDuration?: number;
  sparkReceived?: string;
  reflectionNotes?: string;
  didTechMakeSense?: boolean;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonalCover {
  id: string;
  season: Season;
  title: string;
  url: string;
  credit: string;
}

// ----------------- EDUDESIGN ARCHITECT TYPES -----------------
export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

export interface SubGoal {
  id: string;
  text: string;
  bloomLevel: BloomLevel;
  bloomVerbs?: string[];
  smartFeedback?: {
    startsWithStudent: boolean;
    isSmart: boolean;
    scores?: Record<string, number>;
    feedback?: string;
    improvedSuggestion?: string;
  };
}

export interface AssessmentCriterion {
  id: string;
  name: string;
  type: 'binary' | 'nominal';
  maxPoints: number;
  weight: number;
  description: string;
}

export interface EducationalObject {
  id: string;
  title: string;
  type: string;
  duration: string;
  targetSubGoalIds: string[];
  studentActivity: string;
  teacherRole: string;
  verificationMethod: string;
  implementationDetails: string;
  assessmentCriteria: AssessmentCriterion[];
  gamificationTip?: string;
  methodologicalTip?: string;
}

export interface ProjectVersion {
  id: string;
  timestamp: string;
  note: string;
  snapshot: string; // JSON
}

export interface LearningProject {
  id: string;
  title: string;
  subject: string;
  targetGroup: string;
  context: string;
  lessonForm: string;
  generalGoal: string;
  subGoals: SubGoal[];
  learningObjects: EducationalObject[];
  createdAt: string;
  updatedAt: string;
  history: ProjectVersion[];
}

// ----------------- DIGITAL WELLBEING TYPES -----------------
export interface NvcNeed {
  key: string;
  category: 'autonomy' | 'integrity' | 'connection' | 'meaning' | 'play' | 'peace';
  label: Record<Language, string>;
  description: Record<Language, string>;
  isCustom?: boolean;
}

export interface WellbeingGoal {
  id: string;
  needKey: string;
  needCustomText?: string;
  goalText: string;
  metric: string;
  startDate: string;
  active: boolean;
}

export interface WellbeingCheckIn {
  id: string;
  date: string;
  goalId: string;
  completed: boolean;
  rating: number; // 1-5
  reflection: string;
}

export interface WellbeingExercise {
  id: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  category: 'mindfulness' | 'screen_detox' | 'focus' | 'movement';
  duration: string;
  upvoted?: boolean;
  downvoted?: boolean;
}

export interface TechDiaryEntry {
  id: string;
  date: string;
  mood: MoodEmoji;
  didTechMakeSense: boolean; // Replaced screen time as requested
  reflection: string;
  imageUrl?: string;
  tasksDoneToday: string[];
}

export interface CalendarTask {
  id: string;
  title: string;
  time: string;
  category: 'teaching' | 'prep' | 'rest' | 'personal';
  completed: boolean;
}

// ----------------- CRITERION ASSESSMENT TYPES -----------------
export type CriterionCategory = 'formal' | 'content';
export type CriterionLevel = 0 | 1 | 2 | 3; // 3 = zcela, 2 = částečně, 1 = omezeně, 0 = nesplnil

export interface CriterionValidationResult {
  isMeasurable: boolean;
  hasSubjectiveBias: boolean;
  warningMessage: string;
  suggestedName?: string;
  suggestedDescription?: string;
}

export interface CommentValidationResult {
  isObjective: boolean;
  hasLabelingOrOpinion: boolean;
  warningMessage: string;
  objectiveRewrite?: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  category: CriterionCategory;
  weight: number; // 1 - 10
  validation?: CriterionValidationResult;
}

export interface CriteriaAssignment {
  id: string;
  title: string;
  subject: string;
  description: string;
  passingPercentage: number; // default 60
  criteria: RubricCriterion[];
  generalNote?: string;
  generalNoteValidation?: CommentValidationResult;
  createdAt: string;
  updatedAt: string;
}

export interface StudentCriterionEvaluation {
  id: string;
  assignmentId: string;
  studentId: string;
  scores: Record<string, CriterionLevel>; // criterionId -> 0 | 1 | 2 | 3
  criterionNotes?: Record<string, string>; // optional per-criterion concrete justification / improvement tip
  teacherComment: string;
  commentValidation?: CommentValidationResult;
  aiSummary?: string;
  updatedAt: string;
}

// ----------------- LESSON OBSERVATIONS (NÁSLECHY) TYPES -----------------
export interface ObservationRecord {
  id: string;
  seminarTopic: string;
  dateTime: string;
  observerName?: string;
  observedTeacherName?: string;
  reflective: {
    learned: [string, string, string];
    delighted: [string, string, string];
    application: string;
    furtherLearning: string;
    expectationsMet: string;
  };
  evaluative: {
    lessonGoals: string;
    methodsAndAchievement: string;
    safeAtmosphere: string;
    recommendations: [string, string, string];
    improvementsNextTime: string;
    groupConnection: string;
    clarity: string;
    metaphorAndReason: string;
    issuesObserved: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ----------------- ADDIE MODEL DESIGNER TYPES -----------------
export type AddieDeliverableMode = 'digital_object' | 'classic_lesson';
export type AddiePhaseKey =
  | 'analysis'
  | 'design'
  | 'development'
  | 'implementation'
  | 'evaluation';
export type AddieStepKey = AddiePhaseKey | 'visualization';
export type AddieCriterionStatus = 'pending' | 'met' | 'partial' | 'not_met';

export interface AddieClarifyingQuestion {
  id: string;
  question: string;
  answer: string;
}

export interface AddieAnalysisPrecision {
  summaryCritique: string;
  refinedSuggestions: {
    designChallenge: string;
    targetGroup: string;
    priorKnowledgeAndContinuity: string;
    availableResources: string;
    competition: string;
  };
  clarifyingQuestions: AddieClarifyingQuestion[];
  lastUpdated: string;
}

export interface AddieAnalysis {
  designChallenge: string;
  outputTypeHint: AddieDeliverableMode;
  targetGroup: string;
  priorKnowledgeAndContinuity: string;
  availableResources: string;
  competition: string;
  plannedCycles: number;
  aiPrecisionFeedback?: AddieAnalysisPrecision;
}

export interface AddieDesignOption {
  id: string;
  title: string;
  archetype: string;
  summary: string;
  targetFit: string;
  differentiationFromCompetition: string;
  resourceAlignment: string;
  keyFeatures: string[];
  isCustom?: boolean;
}

export interface AddieDesign {
  options: AddieDesignOption[];
  selectedOptionId: string;
  editedSolution: {
    title: string;
    archetype: string;
    summary: string;
    pedagogicalRationale: string;
    structureOutline: string;
    keyFeatures: string[];
  };
}

export interface AddieDevelopmentStep {
  id: string;
  order: number;
  title: string;
  description: string;
  deliverable: string;
  duration: string;
}

export interface AddieDevelopment {
  steps: AddieDevelopmentStep[];
  tools: string[];
  professions: string[];
  resourcesAllocation: string;
  alignmentCheckNote: string;
}

export interface AddieChatMessage {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
}

export interface AddieImplementation {
  deliverableMode: AddieDeliverableMode;
  artifactTitle: string;
  generatedArtifact: string;
  refinementQuestions: AddieClarifyingQuestion[];
  dialogMessages: AddieChatMessage[];
  implementationNotes: string;
  finalMasterPrompt?: string;
  finalMasterPromptUpdatedAt?: string;
}

export interface AddieEvaluationMethod {
  id: string;
  title: string;
  methodType: string;
  targetMetric: string;
  howToConduct: string;
  successCriterion: string;
  embeddedFeature?: string;
  selected: boolean;
  isCustom?: boolean;
  criterionStatus?: AddieCriterionStatus;
  measuredResult?: string;
}

export interface AddieEvaluation {
  methods: AddieEvaluationMethod[];
  cycleReflection: string;
  nextCycleFocus: string;
}

export interface AddieCycle {
  cycleNumber: number;
  createdAt: string;
  updatedAt: string;
  completedSteps: AddieStepKey[];
  phaseTimeSeconds?: Partial<Record<AddiePhaseKey, number>>;
  analysis: AddieAnalysis;
  design: AddieDesign;
  development: AddieDevelopment;
  implementation: AddieImplementation;
  evaluation: AddieEvaluation;
}

export interface AddieProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeCycleNumber: number;
  cycles: AddieCycle[];
}
