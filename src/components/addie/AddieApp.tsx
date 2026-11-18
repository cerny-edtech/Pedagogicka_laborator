import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  FileText,
  FileJson,
  Upload,
  Printer,
  Copy,
  Check,
  Send,
  ArrowRight,
  ArrowLeft,
  RotateCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Users,
  ListOrdered,
  MessageSquare,
  Sliders,
  Download,
  Circle,
  BarChart3,
  Clock,
} from 'lucide-react';
import {
  AddieCriterionStatus,
  AddieCycle,
  AddieDeliverableMode,
  AddieDesignOption,
  AddieDevelopmentStep,
  AddieEvaluationMethod,
  AddiePhaseKey,
  AddieProject,
  AddieStepKey,
  Language,
} from '../../types';
import { getT } from '../../i18n/translations';
import { buildAddiePrintableHtml, PrintableDocData } from '../../utils/printExport';
import { copyTextToClipboard, triggerBlobDownload } from '../../utils/clipboard';
import {
  createRealGoogleDoc,
  hasCachedToken,
  initAuth,
  logoutGoogle,
  signInWithGoogle,
} from '../../services/googleDocsService';
import { AddieCycleVisualizer, PreviousCyclePanel } from './AddieCycleVisualizer';
import { AddieProjectVisualizationTab } from './AddieProjectVisualizationTab';
import {
  ADDIE_PHASES,
  computeAddieProjectMetrics,
  formatDurationSeconds,
  getCyclePhaseSeconds,
} from './addieMetrics';
import {
  buildStructuredMasterPrompt,
  downloadTextFile,
  getAddieStepCompletion,
} from './addieHelpers';

interface AddieAppProps {
  language: Language;
  isDark: boolean;
  projects: AddieProject[];
  onUpdateProjects: (projects: AddieProject[]) => void;
  activeProjectId: string;
  onSelectProjectId: (id: string) => void;
  onPrintCustomHtml: (data: PrintableDocData) => void;
}

export function createBlankAddieCycle(cycleNumber = 1, seedFrom?: AddieCycle): AddieCycle {
  const now = new Date().toISOString();
  if (seedFrom) {
    return {
      cycleNumber,
      createdAt: now,
      updatedAt: now,
      completedSteps: [],
      phaseTimeSeconds: {},
      analysis: {
        designChallenge: seedFrom.analysis.designChallenge,
        outputTypeHint: seedFrom.analysis.outputTypeHint,
        targetGroup: seedFrom.analysis.targetGroup,
        priorKnowledgeAndContinuity: seedFrom.analysis.priorKnowledgeAndContinuity,
        availableResources: seedFrom.analysis.availableResources,
        competition: seedFrom.analysis.competition,
        plannedCycles: seedFrom.analysis.plannedCycles,
      },
      design: {
        options: [],
        selectedOptionId: '',
        editedSolution: { ...seedFrom.design.editedSolution },
      },
      development: {
        steps: seedFrom.development.steps.map((s) => ({ ...s })),
        tools: [...seedFrom.development.tools],
        professions: [...seedFrom.development.professions],
        resourcesAllocation: seedFrom.development.resourcesAllocation,
        alignmentCheckNote: seedFrom.development.alignmentCheckNote,
      },
      implementation: {
        deliverableMode: seedFrom.implementation.deliverableMode,
        artifactTitle: seedFrom.implementation.artifactTitle,
        generatedArtifact: seedFrom.implementation.generatedArtifact,
        refinementQuestions: [],
        dialogMessages: [],
        implementationNotes: seedFrom.evaluation.nextCycleFocus
          ? `${seedFrom.evaluation.nextCycleFocus}`
          : '',
      },
      evaluation: {
        methods: seedFrom.evaluation.methods.map((m) => ({
          ...m,
          id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          criterionStatus: 'pending',
          measuredResult: '',
        })),
        cycleReflection: '',
        nextCycleFocus: '',
      },
    };
  }

  return {
    cycleNumber,
    createdAt: now,
    updatedAt: now,
    completedSteps: [],
    phaseTimeSeconds: {},
    analysis: {
      designChallenge: '',
      outputTypeHint: 'digital_object',
      targetGroup: '',
      priorKnowledgeAndContinuity: '',
      availableResources: '',
      competition: '',
      plannedCycles: 2,
    },
    design: {
      options: [],
      selectedOptionId: '',
      editedSolution: {
        title: '',
        archetype: '',
        summary: '',
        pedagogicalRationale: '',
        structureOutline: '',
        keyFeatures: [],
      },
    },
    development: {
      steps: [],
      tools: [],
      professions: [],
      resourcesAllocation: '',
      alignmentCheckNote: '',
    },
    implementation: {
      deliverableMode: 'digital_object',
      artifactTitle: '',
      generatedArtifact: '',
      refinementQuestions: [],
      dialogMessages: [],
      implementationNotes: '',
    },
    evaluation: {
      methods: [],
      cycleReflection: '',
      nextCycleFocus: '',
    },
  };
}

export function createBlankAddieProject(defaultTitle = 'Nový ADDIE projekt'): AddieProject {
  const now = new Date().toISOString();
  return {
    id: `addie_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: defaultTitle,
    createdAt: now,
    updatedAt: now,
    activeCycleNumber: 1,
    cycles: [createBlankAddieCycle(1)],
  };
}

const STEP_ORDER: AddieStepKey[] = [
  'analysis',
  'design',
  'development',
  'implementation',
  'evaluation',
  'visualization',
];

export const AddieApp: React.FC<AddieAppProps> = ({
  language,
  projects,
  onUpdateProjects,
  activeProjectId,
  onSelectProjectId,
  onPrintCustomHtml,
}) => {
  const t = getT(language).addie;

  const [workspaceTab, setWorkspaceTab] = useState<'workflow' | 'visualization'>('workflow');
  const [activeStep, setActiveStep] = useState<AddieStepKey>('analysis');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Loading & feedback states
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [copiedArtifact, setCopiedArtifact] = useState(false);

  // Google Workspace Auth & Export states
  const [googleConnected, setGoogleConnected] = useState<boolean>(() => hasCachedToken());
  const [googleUserEmail, setGoogleUserEmail] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [exportingDocs, setExportingDocs] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'ok' | 'err';
    msg: string;
    url?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Local input helpers
  const [newToolInput, setNewToolInput] = useState('');
  const [newProfessionInput, setNewProfessionInput] = useState('');
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

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

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  const activeCycle = useMemo(() => {
    if (!activeProject) return null;
    return (
      activeProject.cycles.find((c) => c.cycleNumber === activeProject.activeCycleNumber) ||
      activeProject.cycles[activeProject.cycles.length - 1] ||
      null
    );
  }, [activeProject]);

  const previousCycle = useMemo(() => {
    if (!activeProject || !activeCycle || activeCycle.cycleNumber <= 1) return null;
    return activeProject.cycles.find((c) => c.cycleNumber === activeCycle.cycleNumber - 1) || null;
  }, [activeProject, activeCycle]);

  // Active ADDIE phase timer refs (tracks real user time in phases 1-5 without stale closures)
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const onUpdateProjectsRef = useRef(onUpdateProjects);
  onUpdateProjectsRef.current = onUpdateProjects;
  const activeContextRef = useRef<{
    projectId: string;
    cycleNumber: number;
    step: AddieStepKey;
    tab: 'workflow' | 'visualization';
  }>({
    projectId: activeProject?.id || '',
    cycleNumber: activeCycle?.cycleNumber || 1,
    step: activeStep,
    tab: workspaceTab,
  });

  useEffect(() => {
    const commitSeconds = (
      ctx: { projectId: string; cycleNumber: number; step: AddieStepKey; tab: 'workflow' | 'visualization' },
      seconds: number
    ) => {
      if (
        seconds < 1 ||
        ctx.tab !== 'workflow' ||
        !ADDIE_PHASES.includes(ctx.step as AddiePhaseKey) ||
        !ctx.projectId
      ) {
        return;
      }
      const phase = ctx.step as AddiePhaseKey;
      const currentProjects = projectsRef.current;
      const targetProj = currentProjects.find((p) => p.id === ctx.projectId);
      if (!targetProj) return;
      const updated = currentProjects.map((p) => {
        if (p.id !== ctx.projectId) return p;
        return {
          ...p,
          cycles: p.cycles.map((c) => {
            if (c.cycleNumber !== ctx.cycleNumber) return c;
            const prevSec = getCyclePhaseSeconds(c, phase);
            return {
              ...c,
              phaseTimeSeconds: {
                ...(c.phaseTimeSeconds || {}),
                [phase]: prevSec + seconds,
              },
            };
          }),
        };
      });
      onUpdateProjectsRef.current(updated);
    };

    let lastTick = Date.now();
    activeContextRef.current = {
      projectId: activeProject?.id || '',
      cycleNumber: activeCycle?.cycleNumber || 1,
      step: activeStep,
      tab: workspaceTab,
    };

    const flush = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        lastTick = Date.now();
        return;
      }
      const now = Date.now();
      const deltaSec = Math.min(300, Math.floor((now - lastTick) / 1000));
      if (deltaSec >= 1) {
        lastTick = now;
        commitSeconds(activeContextRef.current, deltaSec);
      }
    };

    const intervalId = window.setInterval(flush, 10000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        const deltaSec = Math.min(300, Math.floor((now - lastTick) / 1000));
        lastTick = now;
        commitSeconds(activeContextRef.current, deltaSec);
      } else {
        lastTick = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      const now = Date.now();
      const deltaSec = Math.min(300, Math.floor((now - lastTick) / 1000));
      commitSeconds(activeContextRef.current, deltaSec);
    };
  }, [activeProject?.id, activeCycle?.cycleNumber, activeStep, workspaceTab]);

  const buildPreviousCycleSummaryText = (prev: AddieCycle | null): string => {
    if (!prev) return '';
    const selectedEvals = (prev.evaluation.methods || [])
      .filter((m) => m.selected)
      .map((m) => `${m.title}: ${m.successCriterion}`)
      .join('; ');
    return [
      `Cyklus ${prev.cycleNumber}:`,
      `- Původní výzva: ${prev.analysis.designChallenge}`,
      `- Zvolený návrh: ${prev.design.editedSolution.title} (${prev.design.editedSolution.summary})`,
      `- Klíčové kroky vývoje: ${prev.development.steps.map((s) => s.title).join(', ')}`,
      `- Vybrané evaluační metody: ${selectedEvals || '-'}`,
      `- Zjištění z evaluace: ${prev.evaluation.cycleReflection || '-'}`,
      `- Priorita pro další cyklus: ${prev.evaluation.nextCycleFocus || '-'}`,
    ].join('\n');
  };

  const updateActiveProject = (updater: (p: AddieProject) => AddieProject) => {
    if (!activeProject) return;
    const next = updater({
      ...activeProject,
      updatedAt: new Date().toISOString(),
    });
    onUpdateProjects(projects.map((p) => (p.id === next.id ? next : p)));
  };

  const updateActiveCycle = (updater: (c: AddieCycle) => AddieCycle) => {
    if (!activeProject || !activeCycle) return;
    updateActiveProject((proj) => ({
      ...proj,
      cycles: proj.cycles.map((c) =>
        c.cycleNumber === activeCycle.cycleNumber
          ? updater({ ...c, updatedAt: new Date().toISOString() })
          : c
      ),
    }));
  };

  if (!activeProject || !activeCycle) return null;

  const handleCreateNewProject = () => {
    const fresh = createBlankAddieProject(t.defaultProjectTitle);
    onUpdateProjects([fresh, ...projects]);
    onSelectProjectId(fresh.id);
    setActiveStep('analysis');
    setConfirmDeleteId(null);
    setStatusBanner(null);
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== id);
    onUpdateProjects(remaining);
    if (activeProject.id === id && remaining[0]) {
      onSelectProjectId(remaining[0].id);
    }
    setConfirmDeleteId(null);
  };

  // Google Auth handlers
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

  // Build Google Docs plain-text document covering all iterative cycles + lifespan metrics
  const buildAddieGoogleDocText = (project: AddieProject): string => {
    const pv = t.projectViz;
    const metrics = computeAddieProjectMetrics(project, 'all');
    const lines: string[] = [
      `${t.title}: ${project.title || t.defaultProjectTitle}`,
      '====================================================================',
      `${pv.kpis.iterations}: ${metrics.totalIterationsCreated} / ${metrics.plannedIterationsTarget}`,
      `${pv.kpis.totalTime}: ${formatDurationSeconds(metrics.totalTrackedSeconds)}`,
      `${pv.kpis.criteriaMet}: ${metrics.criteriaTotals.met}/${metrics.criteriaTotals.selectedCount} (${metrics.criteriaTotals.metRatePct}%)`,
      ...metrics.phaseRows.map(
        (r) => `  - ${pv.phaseShort[r.phase]}: ${formatDurationSeconds(r.totalSeconds)} (${r.sharePct}%)`
      ),
      '',
    ];

    project.cycles.forEach((c) => {
      const selectedEvals = (c.evaluation.methods || []).filter((m) => m.selected);
      lines.push(
        `>>> ${t.cycleBadge.toUpperCase()} ${c.cycleNumber} ${t.ofLabel} ${c.analysis.plannedCycles || project.cycles.length} <<<`,
        '--------------------------------------------------------------------',
        `[1] ${t.steps.analysis}`,
        `- ${t.analysis.q1Label} ${c.analysis.designChallenge || '-'}`,
        `- ${t.analysis.q2aLabel} ${c.analysis.targetGroup || '-'}`,
        `- ${t.analysis.q2bLabel} ${c.analysis.priorKnowledgeAndContinuity || '-'}`,
        `- ${t.analysis.q3Label} ${c.analysis.availableResources || '-'}`,
        `- ${t.analysis.q4Label} ${c.analysis.competition || '-'}`,
        '',
        `[2] ${t.steps.design}`,
        `- ${c.design.editedSolution.title || '-'} (${c.design.editedSolution.archetype || '-'})`,
        `  ${c.design.editedSolution.summary || '-'}`,
        c.design.editedSolution.pedagogicalRationale
          ? `  ${t.design.solRationaleLabel}: ${c.design.editedSolution.pedagogicalRationale}`
          : '',
        '',
        `[3] ${t.steps.development}`,
        ...(c.development.steps || []).map(
          (s) => `  ${s.order}. ${s.title} (${s.duration}): ${s.description} -> [${s.deliverable}]`
        ),
        `- ${t.development.toolsTitle}: ${(c.development.tools || []).join(', ') || '-'}`,
        `- ${t.development.professionsTitle}: ${(c.development.professions || []).join(', ') || '-'}`,
        `- ${t.development.resourcesTitle}: ${c.development.resourcesAllocation || '-'}`,
        '',
        `[4] ${t.steps.implementation} (${c.implementation.deliverableMode === 'classic_lesson' ? t.analysis.outputLesson : t.analysis.outputDigital})`,
        c.implementation.generatedArtifact || '-',
        '',
        `[5] ${t.steps.evaluation}`,
        ...selectedEvals.map(
          (m) =>
            `  • ${m.title} (${m.methodType}) [${t.criterionStatuses[m.criterionStatus || 'pending']}]: ${m.howToConduct} | ${t.evaluation.criterionLabel}: ${m.successCriterion}${
              m.measuredResult ? ` | ${t.measuredResultLabel}: ${m.measuredResult}` : ''
            }${
              m.embeddedFeature ? ` | ${t.evaluation.embeddedFeatureLabel}: ${m.embeddedFeature}` : ''
            }`
        ),
        c.evaluation.cycleReflection ? `- ${t.evaluation.reflectionTitle}: ${c.evaluation.cycleReflection}` : '',
        c.evaluation.nextCycleFocus ? `- ${t.evaluation.nextFocusLabel}: ${c.evaluation.nextCycleFocus}` : '',
        '',
        `[6] ${t.visualization.masterPromptTitle}`,
        c.implementation.finalMasterPrompt?.trim() ||
          buildStructuredMasterPrompt(c, project.title, language),
        '',
        ''
      );
    });

    return lines.filter((l) => l !== undefined).join('\n');
  };

  const handleExportGoogleDocs = async () => {
    setExportingDocs(true);
    setStatusBanner(null);
    try {
      const ok = googleConnected || (await handleGoogleConnect());
      if (!ok) {
        setExportingDocs(false);
        return;
      }
      const docTitle = `ADDIE — ${activeProject.title || t.defaultProjectTitle}`;
      const { documentUrl } = await createRealGoogleDoc(docTitle, buildAddieGoogleDocText(activeProject));
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
    const slug = (activeProject.title || 'addie_projekt')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_');
    triggerBlobDownload(
      `addie_${slug}.json`,
      JSON.stringify(activeProject, null, 2),
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
        if (!parsed || !Array.isArray(parsed.cycles) || parsed.cycles.length === 0) {
          setStatusBanner({ type: 'err', msg: t.jsonImportError });
          return;
        }
        const now = new Date().toISOString();
        const imported: AddieProject = {
          ...createBlankAddieProject(t.defaultProjectTitle),
          ...parsed,
          id: `addie_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          updatedAt: now,
          cycles: parsed.cycles.map((c: any, idx: number) => ({
            ...createBlankAddieCycle(idx + 1),
            ...c,
            cycleNumber: Number(c.cycleNumber) || idx + 1,
          })),
        };
        onUpdateProjects([imported, ...projects]);
        onSelectProjectId(imported.id);
        setStatusBanner({ type: 'ok', msg: t.jsonImportSuccess });
      } catch {
        setStatusBanner({ type: 'err', msg: t.jsonImportError });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportPdf = () => {
    onPrintCustomHtml(buildAddiePrintableHtml(activeProject, language));
  };

  // ---------------- STEP 1: ANALYSIS AI ----------------
  const handleAiRefineAnalysis = async () => {
    setLoadingAction('analyze');
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/addie-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          analysis: activeCycle.analysis,
          answeredQuestions: activeCycle.analysis.aiPrecisionFeedback?.clarifyingQuestions || [],
          cycleNumber: activeCycle.cycleNumber,
          previousCycleSummary: buildPreviousCycleSummaryText(previousCycle),
        }),
      });
      if (!res.ok) throw new Error('Analyze request failed');
      const data = await res.json();
      updateActiveCycle((c) => ({
        ...c,
        analysis: {
          ...c.analysis,
          aiPrecisionFeedback: {
            summaryCritique: data.summaryCritique || '',
            refinedSuggestions: data.refinedSuggestions,
            clarifyingQuestions: data.clarifyingQuestions || [],
            lastUpdated: new Date().toISOString(),
          },
        },
      }));
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  const applyAllRefinedAnalysis = () => {
    const sug = activeCycle.analysis.aiPrecisionFeedback?.refinedSuggestions;
    if (!sug) return;
    updateActiveCycle((c) => ({
      ...c,
      analysis: {
        ...c.analysis,
        designChallenge: sug.designChallenge || c.analysis.designChallenge,
        targetGroup: sug.targetGroup || c.analysis.targetGroup,
        priorKnowledgeAndContinuity:
          sug.priorKnowledgeAndContinuity || c.analysis.priorKnowledgeAndContinuity,
        availableResources: sug.availableResources || c.analysis.availableResources,
        competition: sug.competition || c.analysis.competition,
      },
    }));
  };

  // ---------------- STEP 2: DESIGN AI (5 DIVERSE SOLUTIONS) ----------------
  const handleAiGenerateDesigns = async () => {
    setLoadingAction('design');
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/addie-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          analysis: activeCycle.analysis,
          cycleNumber: activeCycle.cycleNumber,
          previousCycleSummary: buildPreviousCycleSummaryText(previousCycle),
        }),
      });
      if (!res.ok) throw new Error('Design request failed');
      const data = await res.json();
      const options: AddieDesignOption[] = Array.isArray(data.options) ? data.options : [];
      updateActiveCycle((c) => ({
        ...c,
        design: {
          ...c.design,
          options,
        },
      }));
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  const selectDesignOption = (opt: AddieDesignOption) => {
    updateActiveCycle((c) => ({
      ...c,
      design: {
        ...c.design,
        selectedOptionId: opt.id,
        editedSolution: {
          title: opt.title,
          archetype: opt.archetype,
          summary: opt.summary,
          pedagogicalRationale: `${opt.targetFit} ${opt.differentiationFromCompetition}`.trim(),
          structureOutline: '',
          keyFeatures: [...(opt.keyFeatures || [])],
        },
      },
    }));
  };

  const handleSelectCustomDesign = () => {
    updateActiveCycle((c) => ({
      ...c,
      design: {
        ...c.design,
        selectedOptionId: 'custom',
        editedSolution: {
          title: c.design.editedSolution.title || activeCycle.analysis.designChallenge.slice(0, 50) || t.design.customBtn,
          archetype: c.design.editedSolution.archetype || '',
          summary: c.design.editedSolution.summary || '',
          pedagogicalRationale: c.design.editedSolution.pedagogicalRationale || '',
          structureOutline: c.design.editedSolution.structureOutline || '',
          keyFeatures: c.design.editedSolution.keyFeatures || [],
        },
      },
    }));
  };

  // ---------------- STEP 3: DEVELOPMENT AI ----------------
  const handleAiGenerateDevelopment = async () => {
    setLoadingAction('develop');
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/addie-develop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          analysis: activeCycle.analysis,
          design: activeCycle.design,
          cycleNumber: activeCycle.cycleNumber,
          previousCycleSummary: buildPreviousCycleSummaryText(previousCycle),
        }),
      });
      if (!res.ok) throw new Error('Develop request failed');
      const data = await res.json();
      updateActiveCycle((c) => ({
        ...c,
        development: {
          steps: Array.isArray(data.steps) ? data.steps : [],
          tools: Array.isArray(data.tools) ? data.tools : [],
          professions: Array.isArray(data.professions) ? data.professions : [],
          resourcesAllocation: data.resourcesAllocation || '',
          alignmentCheckNote: data.alignmentCheckNote || '',
        },
      }));
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  const addCustomDevStep = () => {
    const newStep: AddieDevelopmentStep = {
      id: `dev_${Date.now()}`,
      order: activeCycle.development.steps.length + 1,
      title: '',
      description: '',
      deliverable: '',
      duration: '1 hod',
    };
    updateActiveCycle((c) => ({
      ...c,
      development: {
        ...c.development,
        steps: [...c.development.steps, newStep],
      },
    }));
  };

  // ---------------- STEP 4: IMPLEMENTATION & 5-QUESTION DIALOG AI ----------------
  const handleAiInitImplementation = async (modeOverride?: AddieDeliverableMode) => {
    const targetMode = modeOverride || activeCycle.implementation.deliverableMode;
    setLoadingAction('implement-init');
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/addie-implement-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          deliverableMode: targetMode,
          analysis: activeCycle.analysis,
          design: activeCycle.design,
          development: activeCycle.development,
          cycleNumber: activeCycle.cycleNumber,
        }),
      });
      if (!res.ok) throw new Error('Implement init failed');
      const data = await res.json();
      updateActiveCycle((c) => ({
        ...c,
        implementation: {
          ...c.implementation,
          deliverableMode: targetMode,
          artifactTitle: data.artifactTitle || '',
          generatedArtifact: data.generatedArtifact || '',
          refinementQuestions: Array.isArray(data.refinementQuestions) ? data.refinementQuestions : [],
          dialogMessages: data.aiIntroMessage
            ? [
                {
                  id: `msg_${Date.now()}`,
                  role: 'ai',
                  content: data.aiIntroMessage,
                  timestamp: new Date().toISOString(),
                },
              ]
            : [],
        },
      }));
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAiImplementChat = async (customUserMessage?: string) => {
    const msgToSend = (customUserMessage ?? chatInput).trim();
    if (!msgToSend && !activeCycle.implementation.refinementQuestions.some((q) => q.answer.trim())) {
      return;
    }

    setLoadingAction('implement-chat');
    setInlineError(null);

    const updatedHistory = msgToSend
      ? [
          ...activeCycle.implementation.dialogMessages,
          {
            id: `u_${Date.now()}`,
            role: 'user' as const,
            content: msgToSend,
            timestamp: new Date().toISOString(),
          },
        ]
      : [...activeCycle.implementation.dialogMessages];

    if (msgToSend) setChatInput('');

    try {
      const res = await fetch('/api/gemini/addie-implement-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          deliverableMode: activeCycle.implementation.deliverableMode,
          currentArtifact: activeCycle.implementation.generatedArtifact,
          refinementQuestions: activeCycle.implementation.refinementQuestions,
          dialogHistory: updatedHistory,
          userMessage: msgToSend,
          analysis: activeCycle.analysis,
        }),
      });
      if (!res.ok) throw new Error('Implement chat failed');
      const data = await res.json();
      updateActiveCycle((c) => ({
        ...c,
        implementation: {
          ...c.implementation,
          generatedArtifact: data.updatedArtifact || c.implementation.generatedArtifact,
          dialogMessages: [
            ...updatedHistory,
            {
              id: `ai_${Date.now()}`,
              role: 'ai',
              content: data.reply || '',
              timestamp: new Date().toISOString(),
            },
          ],
        },
      }));
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCopyArtifact = async () => {
    const ok = await copyTextToClipboard(activeCycle.implementation.generatedArtifact || '');
    if (ok) {
      setCopiedArtifact(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedArtifact(false), 2000);
    }
  };

  // ---------------- STEP 5: EVALUATION AI ----------------
  const handleAiGenerateEvaluation = async (seed = 0) => {
    setLoadingAction('evaluate');
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/addie-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          analysis: activeCycle.analysis,
          design: activeCycle.design,
          implementation: activeCycle.implementation,
          cycleNumber: activeCycle.cycleNumber,
          regenerateSeed: seed,
        }),
      });
      if (!res.ok) throw new Error('Evaluate request failed');
      const data = await res.json();
      const customMethods = activeCycle.evaluation.methods.filter((m) => m.isCustom);
      const aiMethods: AddieEvaluationMethod[] = Array.isArray(data.methods) ? data.methods : [];
      updateActiveCycle((c) => ({
        ...c,
        evaluation: {
          ...c.evaluation,
          methods: seed > 0 ? aiMethods : [...aiMethods, ...customMethods],
        },
      }));
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddCustomEvalMethod = () => {
    const custom: AddieEvaluationMethod = {
      id: `ev_custom_${Date.now()}`,
      title: '',
      methodType: '',
      targetMetric: '',
      howToConduct: '',
      successCriterion: '',
      embeddedFeature: '',
      selected: true,
      isCustom: true,
    };
    updateActiveCycle((c) => ({
      ...c,
      evaluation: {
        ...c.evaluation,
        methods: [...c.evaluation.methods, custom],
      },
    }));
  };

  // ---------------- COMPILE FINAL AI STUDIO MASTER PROMPT WITH EMBEDDED EVALUATION ----------------
  const handleAiCompileMasterPrompt = async (jumpToVisualization = false) => {
    setLoadingAction('compile-master');
    setInlineError(null);
    try {
      const res = await fetch('/api/gemini/addie-compile-final-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          projectTitle: activeProject.title,
          cycle: activeCycle,
        }),
      });
      if (!res.ok) throw new Error('Compile prompt failed');
      const data = await res.json();
      const compiled =
        String(data.finalPrompt || '').trim() ||
        buildStructuredMasterPrompt(activeCycle, activeProject.title, language);
      updateActiveCycle((c) => ({
        ...c,
        implementation: {
          ...c.implementation,
          finalMasterPrompt: compiled,
          finalMasterPromptUpdatedAt: new Date().toISOString(),
        },
      }));
      if (jumpToVisualization) {
        setActiveStep('visualization');
      }
    } catch {
      setInlineError(t.errorMsg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ---------------- STEP 6: START NEXT ITERATIVE CYCLE ----------------
  const handleStartNextCycle = () => {
    const highestCycle = Math.max(...activeProject.cycles.map((c) => c.cycleNumber));
    const nextNum = highestCycle + 1;
    const baseCycle =
      activeProject.cycles.find((c) => c.cycleNumber === highestCycle) || activeCycle;
    const nextCycle = createBlankAddieCycle(nextNum, baseCycle);
    updateActiveProject((proj) => ({
      ...proj,
      activeCycleNumber: nextNum,
      cycles: [...proj.cycles, nextCycle],
    }));
    setWorkspaceTab('workflow');
    setActiveStep('analysis');
  };

  // ---------------- LIFESPAN VISUALIZATION MUTATION HANDLERS ----------------
  const handleUpdateCyclePhaseSeconds = (
    cycleNumber: number,
    phase: AddiePhaseKey,
    seconds: number
  ) => {
    const clamped = Math.max(0, Math.round(seconds));
    updateActiveProject((proj) => ({
      ...proj,
      cycles: proj.cycles.map((c) =>
        c.cycleNumber === cycleNumber
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              phaseTimeSeconds: {
                ...(c.phaseTimeSeconds || {}),
                [phase]: clamped,
              },
            }
          : c
      ),
    }));
  };

  const handleUpdateCycleCriterion = (
    cycleNumber: number,
    methodId: string,
    patch: { criterionStatus?: AddieCriterionStatus; measuredResult?: string }
  ) => {
    updateActiveProject((proj) => ({
      ...proj,
      cycles: proj.cycles.map((c) =>
        c.cycleNumber === cycleNumber
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              evaluation: {
                ...c.evaluation,
                methods: c.evaluation.methods.map((m) =>
                  m.id === methodId ? { ...m, ...patch } : m
                ),
              },
            }
          : c
      ),
    }));
  };

  const handleJumpToCycleStep = (cycleNumber: number, step: AddieStepKey) => {
    updateActiveProject((proj) => ({
      ...proj,
      activeCycleNumber: cycleNumber,
    }));
    setActiveStep(step);
    setWorkspaceTab('workflow');
  };

  const projectMetricsSummary = useMemo(
    () => computeAddieProjectMetrics(activeProject, 'all'),
    [activeProject]
  );

  const currentStepIdx = STEP_ORDER.indexOf(activeStep);
  const stepCompletion = getAddieStepCompletion(activeCycle, activeProject);

  return (
    <div className="space-y-6">
      {/* Hidden JSON import file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportJson}
        className="hidden"
      />

      {/* Top Project & Export Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 shrink-0">
              <RotateCw className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Google Auth */}
            {googleConnected ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[130px]">{googleUserEmail || 'Google'}</span>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  title={t.signOutGoogleTitle}
                  className="p-0.5 hover:text-rose-600 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleConnect}
                disabled={authLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{authLoading ? t.connectingGoogle : t.connectGoogleBtn}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportGoogleDocs}
              disabled={exportingDocs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer disabled:opacity-60"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{exportingDocs ? t.exportingDocs : t.exportDocsBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{t.exportJsonBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.importJsonBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t.exportPdfBtn}</span>
            </button>
          </div>
        </div>

        {/* Project selector + Cycle selector + New/Delete */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <label htmlFor="addie-proj-select" className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.projectLabel}
            </label>
            <select
              id="addie-proj-select"
              value={activeProject.id}
              onChange={(e) => {
                onSelectProjectId(e.target.value);
                setConfirmDeleteId(null);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white max-w-[260px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || t.defaultProjectTitle} ({p.cycles.length}×)
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleCreateNewProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.newProjectBtn}</span>
            </button>

            {projects.length > 1 && (
              confirmDeleteId === activeProject.id ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(activeProject.id)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t.confirmDeleteBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    {t.cancelBtn}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(activeProject.id)}
                  title={t.deleteProjectBtn}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
          </div>

          {/* Iterative Cycle Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            {activeProject.cycles.map((c) => {
              const active = c.cycleNumber === activeCycle.cycleNumber;
              return (
                <button
                  key={c.cycleNumber}
                  type="button"
                  onClick={() =>
                    updateActiveProject((p) => ({
                      ...p,
                      activeCycleNumber: c.cycleNumber,
                    }))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums border transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  {t.cycleBadge} {c.cycleNumber}
                </button>
              );
            })}
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums ml-1">
              ({t.ofLabel} {activeCycle.analysis.plannedCycles || 1} {t.plannedLabel})
            </span>
          </div>
        </div>

        {/* Top-Level Workspace Tabs: Iterative Workflow vs. Project-Lifespan Visualization */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-1 gap-1">
            <button
              type="button"
              onClick={() => setWorkspaceTab('workflow')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                workspaceTab === 'workflow'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{t.workspaceTabs.workflow}</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceTab('visualization')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                workspaceTab === 'visualization'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.workspaceTabs.visualization}</span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {projectMetricsSummary.totalIterationsCreated}× · {projectMetricsSummary.criteriaTotals.met}/{projectMetricsSummary.criteriaTotals.selectedCount}
              </span>
            </button>
          </div>

          {workspaceTab === 'workflow' &&
            ADDIE_PHASES.includes(activeStep as AddiePhaseKey) && (
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{t.activeTimerLabel}</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {formatDurationSeconds(
                    getCyclePhaseSeconds(activeCycle, activeStep as AddiePhaseKey)
                  )}
                </span>
              </div>
            )}
        </div>

        {/* Status Banner */}
        {(statusBanner || inlineError) && (
          <div
            className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-medium ${
              inlineError || statusBanner?.type === 'err'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {inlineError || statusBanner?.type === 'err' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{inlineError || statusBanner?.msg}</span>
            </div>
            {statusBanner?.url && (
              <a
                href={statusBanner.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
              >
                {t.openDocBtn}
              </a>
            )}
          </div>
        )}
      </div>

      {workspaceTab === 'visualization' ? (
        <AddieProjectVisualizationTab
          project={activeProject}
          language={language}
          onUpdatePhaseSeconds={handleUpdateCyclePhaseSeconds}
          onUpdateCriterion={handleUpdateCycleCriterion}
          onJumpToCycleStep={handleJumpToCycleStep}
          onStartNextCycle={handleStartNextCycle}
        />
      ) : (
        <>
      {/* 6-Step Clearly Separated ADDIE Navigation (Turns Entirely Green When Filled) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {STEP_ORDER.map((stepKey) => {
          const isCurrent = activeStep === stepKey;
          const isFilled = stepCompletion[stepKey];

          const buttonToneClass = isFilled
            ? isCurrent
              ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-400 ring-offset-2 dark:ring-offset-slate-950 shadow-sm'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
            : isCurrent
            ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300 ring-offset-2 dark:ring-offset-slate-950 shadow-sm'
            : 'bg-white dark:bg-slate-900 hover:border-indigo-400 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800';

          return (
            <button
              key={stepKey}
              type="button"
              onClick={() => setActiveStep(stepKey)}
              className={`px-3.5 py-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${buttonToneClass}`}
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <span className="text-xs font-bold truncate">{t.steps[stepKey]}</span>
                {isFilled ? (
                  <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                ) : (
                  <Circle
                    className={`w-4 h-4 shrink-0 ${
                      isCurrent ? 'text-indigo-200' : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 w-full">
                <span
                  className={`text-[11px] truncate ${
                    isFilled
                      ? 'text-emerald-50'
                      : isCurrent
                      ? 'text-indigo-100'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t.stepHints[stepKey]}
                </span>
                <span
                  className={`text-[10px] font-bold shrink-0 ${
                    isFilled
                      ? 'text-emerald-100'
                      : isCurrent
                      ? 'text-indigo-100'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {isFilled ? t.stepFilledLabel : t.stepEmptyLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Previous Iteration Context Panel across Steps 1-5 */}
      {previousCycle && activeStep !== 'visualization' && (
        <PreviousCyclePanel previousCycle={previousCycle} language={language} />
      )}

      {/* ---------------- STEP 1: ANALYSIS ---------------- */}
      {activeStep === 'analysis' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.analysis.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">{t.analysis.desc}</p>
            </div>
            <button
              type="button"
              onClick={handleAiRefineAnalysis}
              disabled={loadingAction === 'analyze'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-60"
            >
              {loadingAction === 'analyze' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{loadingAction === 'analyze' ? t.analysis.aiRefining : t.analysis.aiRefineBtn}</span>
            </button>
          </div>

          {/* Project Title & Deliverable Hint */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.analysis.projectTitleLabel}
              </label>
              <input
                type="text"
                value={activeProject.title}
                onChange={(e) =>
                  updateActiveProject((p) => ({ ...p, title: e.target.value }))
                }
                placeholder={t.analysis.projectTitlePlaceholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.analysis.outputNatureLabel}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['digital_object', 'classic_lesson'] as AddieDeliverableMode[]).map((mode) => {
                  const selected = activeCycle.analysis.outputTypeHint === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        updateActiveCycle((c) => ({
                          ...c,
                          analysis: { ...c.analysis, outputTypeHint: mode },
                          implementation: { ...c.implementation, deliverableMode: mode },
                        }))
                      }
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        selected
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {mode === 'digital_object' ? t.analysis.outputDigital : t.analysis.outputLesson}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5 Core Analysis Questions */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                {t.analysis.q1Label}
              </label>
              <textarea
                rows={3}
                value={activeCycle.analysis.designChallenge}
                onChange={(e) =>
                  updateActiveCycle((c) => ({
                    ...c,
                    analysis: { ...c.analysis, designChallenge: e.target.value },
                  }))
                }
                placeholder={t.analysis.q1Placeholder}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.analysis.q2aLabel}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.analysis.targetGroup}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      analysis: { ...c.analysis, targetGroup: e.target.value },
                    }))
                  }
                  placeholder={t.analysis.q2aPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.analysis.q2bLabel}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.analysis.priorKnowledgeAndContinuity}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      analysis: { ...c.analysis, priorKnowledgeAndContinuity: e.target.value },
                    }))
                  }
                  placeholder={t.analysis.q2bPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.analysis.q3Label}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.analysis.availableResources}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      analysis: { ...c.analysis, availableResources: e.target.value },
                    }))
                  }
                  placeholder={t.analysis.q3Placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.analysis.q4Label}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.analysis.competition}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      analysis: { ...c.analysis, competition: e.target.value },
                    }))
                  }
                  placeholder={t.analysis.q4Placeholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 5. Planned Development Cycles */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.analysis.q5Label}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.analysis.q5Hint}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() =>
                      updateActiveCycle((c) => ({
                        ...c,
                        analysis: { ...c.analysis, plannedCycles: num },
                      }))
                    }
                    className={`w-9 h-9 rounded-xl border text-xs font-bold tabular-nums transition cursor-pointer ${
                      activeCycle.analysis.plannedCycles === num
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1 hidden sm:inline">
                  {t.analysis.cyclesUnit}
                </span>
              </div>
            </div>
          </div>

          {/* AI Precision Critique & Clarifying Questions Panel */}
          {activeCycle.analysis.aiPrecisionFeedback && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t.analysis.aiCritiqueTitle}</span>
                </h4>
                <button
                  type="button"
                  onClick={applyAllRefinedAnalysis}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer"
                >
                  {t.analysis.aiApplyAllBtn}
                </button>
              </div>

              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {activeCycle.analysis.aiPrecisionFeedback.summaryCritique}
              </p>

              {/* Refined field previews */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.analysis.aiSuggestedFormulations}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      ['designChallenge', t.analysis.q1Label],
                      ['targetGroup', t.analysis.q2aLabel],
                      ['priorKnowledgeAndContinuity', t.analysis.q2bLabel],
                      ['availableResources', t.analysis.q3Label],
                      ['competition', t.analysis.q4Label],
                    ] as const
                  ).map(([fieldKey, label]) => {
                    const suggestedVal =
                      activeCycle.analysis.aiPrecisionFeedback?.refinedSuggestions?.[fieldKey] || '';
                    if (!suggestedVal) return null;
                    return (
                      <div
                        key={fieldKey}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex flex-col justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                            {label}
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300">{suggestedVal}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveCycle((c) => ({
                              ...c,
                              analysis: { ...c.analysis, [fieldKey]: suggestedVal },
                            }))
                          }
                          className="self-start px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900/60 text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition cursor-pointer"
                        >
                          {t.analysis.aiApplyOneBtn}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Follow-up Clarifying Questions */}
              <div className="space-y-3 pt-2 border-t border-indigo-200/70 dark:border-indigo-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t.analysis.aiFollowUpTitle}
                  </div>
                  <button
                    type="button"
                    onClick={handleAiRefineAnalysis}
                    disabled={loadingAction === 'analyze'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.analysis.aiReAnalyzeWithAnswersBtn}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeCycle.analysis.aiPrecisionFeedback.clarifyingQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2"
                    >
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {idx + 1}. {q.question}
                      </div>
                      <input
                        type="text"
                        value={q.answer}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateActiveCycle((c) => ({
                            ...c,
                            analysis: {
                              ...c.analysis,
                              aiPrecisionFeedback: c.analysis.aiPrecisionFeedback
                                ? {
                                    ...c.analysis.aiPrecisionFeedback,
                                    clarifyingQuestions:
                                      c.analysis.aiPrecisionFeedback.clarifyingQuestions.map((item) =>
                                        item.id === q.id ? { ...item, answer: val } : item
                                      ),
                                  }
                                : undefined,
                            },
                          }));
                        }}
                        placeholder={t.analysis.aiFollowUpPlaceholder}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- STEP 2: DESIGN (5 DIVERSE SOLUTIONS + CUSTOM) ---------------- */}
      {activeStep === 'design' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.design.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">{t.design.desc}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAiGenerateDesigns}
                  disabled={loadingAction === 'design'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                >
                  {loadingAction === 'design' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{loadingAction === 'design' ? t.design.generating : t.design.generateBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectCustomDesign}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.design.customBtn}</span>
                </button>
              </div>
            </div>

            {activeCycle.design.options.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeCycle.design.options.map((opt, idx) => {
                  const isSelected = activeCycle.design.selectedOptionId === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            0{idx + 1}. {opt.archetype}
                          </span>
                          {isSelected && (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t.design.selectedBadge}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {opt.title}
                        </h4>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {opt.summary}
                        </p>
                        <div className="space-y-1 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                          <div>
                            <strong>{t.design.fitLabel}</strong> {opt.targetFit}
                          </div>
                          <div>
                            <strong>{t.design.diffLabel}</strong> {opt.differentiationFromCompetition}
                          </div>
                          <div>
                            <strong>{t.design.resLabel}</strong> {opt.resourceAlignment}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => selectDesignOption(opt)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 hover:bg-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-600 text-white'
                        }`}
                      >
                        {t.design.selectSolutionBtn}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Editable Selected / Custom Solution Workspace */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">{t.design.editorTitle}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.design.solTitleLabel}
                </label>
                <input
                  type="text"
                  value={activeCycle.design.editedSolution.title}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      design: {
                        ...c.design,
                        editedSolution: { ...c.design.editedSolution, title: e.target.value },
                      },
                    }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.design.solArchetypeLabel}
                </label>
                <input
                  type="text"
                  value={activeCycle.design.editedSolution.archetype}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      design: {
                        ...c.design,
                        editedSolution: { ...c.design.editedSolution, archetype: e.target.value },
                      },
                    }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.design.solSummaryLabel}
              </label>
              <textarea
                rows={3}
                value={activeCycle.design.editedSolution.summary}
                onChange={(e) =>
                  updateActiveCycle((c) => ({
                    ...c,
                    design: {
                      ...c.design,
                      editedSolution: { ...c.design.editedSolution, summary: e.target.value },
                    },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.design.solRationaleLabel}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.design.editedSolution.pedagogicalRationale}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      design: {
                        ...c.design,
                        editedSolution: {
                          ...c.design.editedSolution,
                          pedagogicalRationale: e.target.value,
                        },
                      },
                    }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t.design.solOutlineLabel}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.design.editedSolution.structureOutline}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      design: {
                        ...c.design,
                        editedSolution: {
                          ...c.design.editedSolution,
                          structureOutline: e.target.value,
                        },
                      },
                    }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.design.solFeaturesLabel}
              </label>
              <textarea
                rows={3}
                value={(activeCycle.design.editedSolution.keyFeatures || []).join('\n')}
                onChange={(e) =>
                  updateActiveCycle((c) => ({
                    ...c,
                    design: {
                      ...c.design,
                      editedSolution: {
                        ...c.design.editedSolution,
                        keyFeatures: e.target.value.split('\n'),
                      },
                    },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STEP 3: DEVELOPMENT ---------------- */}
      {activeStep === 'development' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.development.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">{t.development.desc}</p>
            </div>
            <button
              type="button"
              onClick={handleAiGenerateDevelopment}
              disabled={loadingAction === 'develop'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-60"
            >
              {loadingAction === 'develop' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{loadingAction === 'develop' ? t.development.generating : t.development.generateBtn}</span>
            </button>
          </div>

          {/* Anchor box reminding user & AI of original Analysis */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="font-bold text-slate-500 dark:text-slate-400">{t.development.anchorTitle}</div>
              <div className="text-slate-900 dark:text-white font-semibold mt-0.5 line-clamp-2">
                {activeCycle.analysis.designChallenge || t.visualization.noDataText}
              </div>
            </div>
            <div>
              <div className="font-bold text-slate-500 dark:text-slate-400">{t.analysis.q2aLabel}</div>
              <div className="text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-2">
                {activeCycle.analysis.targetGroup || '-'}
              </div>
            </div>
            <div>
              <div className="font-bold text-slate-500 dark:text-slate-400">{t.design.solTitleLabel}</div>
              <div className="text-indigo-700 dark:text-indigo-300 font-semibold mt-0.5 line-clamp-2">
                {activeCycle.design.editedSolution.title || '-'}
              </div>
            </div>
          </div>

          {/* Editable Development Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.development.stepsTitle}</span>
              </h4>
              <button
                type="button"
                onClick={addCustomDevStep}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.development.addStepBtn}</span>
              </button>
            </div>

            <div className="space-y-3">
              {activeCycle.development.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      #{idx + 1}
                    </span>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            development: {
                              ...c.development,
                              steps: c.development.steps.map((s) =>
                                s.id === step.id ? { ...s, title: e.target.value } : s
                              ),
                            },
                          }))
                        }
                        placeholder={t.development.stepTitlePlaceholder}
                        className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                      <input
                        type="text"
                        value={step.duration}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            development: {
                              ...c.development,
                              steps: c.development.steps.map((s) =>
                                s.id === step.id ? { ...s, duration: e.target.value } : s
                              ),
                            },
                          }))
                        }
                        placeholder={t.development.stepDurationPlaceholder}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            steps: c.development.steps
                              .filter((s) => s.id !== step.id)
                              .map((s, i) => ({ ...s, order: i + 1 })),
                          },
                        }))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <textarea
                      rows={2}
                      value={step.description}
                      onChange={(e) =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            steps: c.development.steps.map((s) =>
                              s.id === step.id ? { ...s, description: e.target.value } : s
                            ),
                          },
                        }))
                      }
                      placeholder={t.development.stepDescPlaceholder}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                    <textarea
                      rows={2}
                      value={step.deliverable}
                      onChange={(e) =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            steps: c.development.steps.map((s) =>
                              s.id === step.id ? { ...s, deliverable: e.target.value } : s
                            ),
                          },
                        }))
                      }
                      placeholder={t.development.stepDeliverablePlaceholder}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tools & Professions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tools */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.development.toolsTitle}</span>
              </h4>
              <div className="space-y-2">
                {activeCycle.development.tools.map((tool, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={tool}
                      onChange={(e) =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            tools: c.development.tools.map((x, idx) => (idx === i ? e.target.value : x)),
                          },
                        }))
                      }
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            tools: c.development.tools.filter((_, idx) => idx !== i),
                          },
                        }))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newToolInput}
                    onChange={(e) => setNewToolInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newToolInput.trim()) {
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            tools: [...c.development.tools, newToolInput.trim()],
                          },
                        }));
                        setNewToolInput('');
                      }
                    }}
                    placeholder={t.development.addToolPlaceholder}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newToolInput.trim()) return;
                      updateActiveCycle((c) => ({
                        ...c,
                        development: {
                          ...c.development,
                          tools: [...c.development.tools, newToolInput.trim()],
                        },
                      }));
                      setNewToolInput('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Professions / Roles */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{t.development.professionsTitle}</span>
              </h4>
              <div className="space-y-2">
                {activeCycle.development.professions.map((prof, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={prof}
                      onChange={(e) =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            professions: c.development.professions.map((x, idx) =>
                              idx === i ? e.target.value : x
                            ),
                          },
                        }))
                      }
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            professions: c.development.professions.filter((_, idx) => idx !== i),
                          },
                        }))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newProfessionInput}
                    onChange={(e) => setNewProfessionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newProfessionInput.trim()) {
                        updateActiveCycle((c) => ({
                          ...c,
                          development: {
                            ...c.development,
                            professions: [...c.development.professions, newProfessionInput.trim()],
                          },
                        }));
                        setNewProfessionInput('');
                      }
                    }}
                    placeholder={t.development.addProfessionPlaceholder}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newProfessionInput.trim()) return;
                      updateActiveCycle((c) => ({
                        ...c,
                        development: {
                          ...c.development,
                          professions: [...c.development.professions, newProfessionInput.trim()],
                        },
                      }));
                      setNewProfessionInput('');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resource allocation & alignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.development.resourcesTitle}
              </label>
              <textarea
                rows={3}
                value={activeCycle.development.resourcesAllocation}
                onChange={(e) =>
                  updateActiveCycle((c) => ({
                    ...c,
                    development: { ...c.development, resourcesAllocation: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t.development.alignmentTitle}
              </label>
              <textarea
                rows={3}
                value={activeCycle.development.alignmentCheckNote}
                onChange={(e) =>
                  updateActiveCycle((c) => ({
                    ...c,
                    development: { ...c.development, alignmentCheckNote: e.target.value },
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STEP 4: IMPLEMENTATION (PROMPT / LESSON + 5-QUESTION AI DIALOG) ---------------- */}
      {activeStep === 'implementation' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.implementation.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">{t.implementation.desc}</p>
              </div>
              <button
                type="button"
                onClick={() => handleAiInitImplementation()}
                disabled={loadingAction === 'implement-init'}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shrink-0 disabled:opacity-60"
              >
                {loadingAction === 'implement-init' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {loadingAction === 'implement-init' ? t.implementation.generating : t.implementation.generateBtn}
                </span>
              </button>
            </div>

            {/* Deliverable Mode Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(['digital_object', 'classic_lesson'] as AddieDeliverableMode[]).map((mode) => {
                const active = activeCycle.implementation.deliverableMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      updateActiveCycle((c) => ({
                        ...c,
                        implementation: { ...c.implementation, deliverableMode: mode },
                      }))
                    }
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition cursor-pointer text-left ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {mode === 'digital_object' ? t.implementation.modeObjectBtn : t.implementation.modeLessonBtn}
                  </button>
                );
              })}
            </div>

            {/* 2-Column Workbench: Left = Copyable Prompt / Lesson, Right = 5+ Questions & AI Dialog */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 cols: Generated Prompt / Lesson Plan */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {activeCycle.implementation.deliverableMode === 'classic_lesson'
                      ? t.implementation.artifactLabelLesson
                      : t.implementation.artifactLabelObject}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyArtifact}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-700 dark:hover:bg-indigo-600 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      {copiedArtifact ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedArtifact ? t.implementation.copiedBtn : t.implementation.copyBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const slug = (activeProject.title || 'addie')
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/gi, '_');
                        downloadTextFile(
                          `addie_krok4_${slug}_cyklus_${activeCycle.cycleNumber}.txt`,
                          activeCycle.implementation.generatedArtifact || ''
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.visualization.downloadPromptTxtBtn}</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={activeCycle.implementation.artifactTitle}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      implementation: { ...c.implementation, artifactTitle: e.target.value },
                    }))
                  }
                  placeholder={activeCycle.design.editedSolution.title || activeProject.title}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />

                <textarea
                  rows={16}
                  value={activeCycle.implementation.generatedArtifact}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      implementation: { ...c.implementation, generatedArtifact: e.target.value },
                    }))
                  }
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.implementation.notesLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={activeCycle.implementation.implementationNotes}
                    onChange={(e) =>
                      updateActiveCycle((c) => ({
                        ...c,
                        implementation: { ...c.implementation, implementationNotes: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Right 5 cols: >= 5 Tuning Questions + AI Refinement Chat */}
              <div className="lg:col-span-5 space-y-4">
                {/* 5+ Questions */}
                <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span>{t.implementation.questionsTitle}</span>
                    </h4>
                  </div>

                  {activeCycle.implementation.refinementQuestions.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.implementation.desc}
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {activeCycle.implementation.refinementQuestions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 space-y-1.5"
                        >
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {idx + 1}. {q.question}
                          </div>
                          <input
                            type="text"
                            value={q.answer}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateActiveCycle((c) => ({
                                ...c,
                                implementation: {
                                  ...c.implementation,
                                  refinementQuestions: c.implementation.refinementQuestions.map(
                                    (item) => (item.id === q.id ? { ...item, answer: val } : item)
                                  ),
                                },
                              }));
                            }}
                            placeholder={t.implementation.questionAnswerPlaceholder}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {activeCycle.implementation.refinementQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleAiImplementChat('')}
                      disabled={loadingAction === 'implement-chat'}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                    >
                      {loadingAction === 'implement-chat'
                        ? t.implementation.applyingAnswers
                        : t.implementation.applyAnswersBtn}
                    </button>
                  )}
                </div>

                {/* Live AI Tuning Chat */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{t.implementation.chatTitle}</span>
                  </h4>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {activeCycle.implementation.dialogMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white ml-6'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-4'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && chatInput.trim()) {
                          handleAiImplementChat();
                        }
                      }}
                      placeholder={t.implementation.chatPlaceholder}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAiImplementChat()}
                      disabled={loadingAction === 'implement-chat' || !chatInput.trim()}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-indigo-600 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{t.implementation.sendChatBtn}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STEP 5: EVALUATION ---------------- */}
      {activeStep === 'evaluation' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t.evaluation.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">{t.evaluation.desc}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAiGenerateEvaluation(0)}
                  disabled={loadingAction === 'evaluate'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
                >
                  {loadingAction === 'evaluate' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{loadingAction === 'evaluate' ? t.evaluation.generating : t.evaluation.generateBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAiGenerateEvaluation(Date.now())}
                  disabled={loadingAction === 'evaluate'}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.evaluation.regenerateBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomEvalMethod}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.evaluation.addCustomBtn}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {activeCycle.evaluation.methods.map((method, idx) => (
                <div
                  key={method.id}
                  className={`rounded-2xl border p-4 space-y-3 transition ${
                    method.selected
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={method.selected}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, selected: e.target.checked } : m
                              ),
                            },
                          }))
                        }
                        className="w-4 h-4 accent-emerald-600 rounded"
                      />
                      <span>
                        #{idx + 1} &bull; {t.evaluation.includeToggle}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveCycle((c) => ({
                          ...c,
                          evaluation: {
                            ...c.evaluation,
                            methods: c.evaluation.methods.filter((m) => m.id !== method.id),
                          },
                        }))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.evaluation.methodTitleLabel}
                      </label>
                      <input
                        type="text"
                        value={method.title}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, title: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.evaluation.methodTypeLabel}
                      </label>
                      <input
                        type="text"
                        value={method.methodType}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, methodType: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.evaluation.metricLabel}
                      </label>
                      <input
                        type="text"
                        value={method.targetMetric}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, targetMetric: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.evaluation.conductLabel}
                      </label>
                      <textarea
                        rows={2}
                        value={method.howToConduct}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, howToConduct: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.evaluation.criterionLabel}
                      </label>
                      <textarea
                        rows={2}
                        value={method.successCriterion}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, successCriterion: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Direct In-Object Implementation Specification */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {t.evaluation.embeddedFeatureLabel}
                    </label>
                    <input
                      type="text"
                      value={method.embeddedFeature || ''}
                      onChange={(e) =>
                        updateActiveCycle((c) => ({
                          ...c,
                          evaluation: {
                            ...c.evaluation,
                            methods: c.evaluation.methods.map((m) =>
                              m.id === method.id ? { ...m, embeddedFeature: e.target.value } : m
                            ),
                          },
                        }))
                      }
                      placeholder={t.evaluation.embeddedFeaturePlaceholder}
                      className="w-full px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Criterion Fulfillment Tracking (Aggregated in Visualization Tab) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.criterionStatusLabel}
                      </label>
                      <select
                        value={method.criterionStatus || 'pending'}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id
                                  ? { ...m, criterionStatus: e.target.value as AddieCriterionStatus }
                                  : m
                              ),
                            },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
                      >
                        <option value="pending">{t.criterionStatuses.pending}</option>
                        <option value="met">{t.criterionStatuses.met}</option>
                        <option value="partial">{t.criterionStatuses.partial}</option>
                        <option value="not_met">{t.criterionStatuses.not_met}</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {t.measuredResultLabel}
                      </label>
                      <input
                        type="text"
                        value={method.measuredResult || ''}
                        onChange={(e) =>
                          updateActiveCycle((c) => ({
                            ...c,
                            evaluation: {
                              ...c.evaluation,
                              methods: c.evaluation.methods.map((m) =>
                                m.id === method.id ? { ...m, measuredResult: e.target.value } : m
                              ),
                            },
                          }))
                        }
                        placeholder={t.measuredResultPlaceholder}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Findings & Next Iteration Focus */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.evaluation.reflectionTitle}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.evaluation.cycleReflection}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      evaluation: { ...c.evaluation, cycleReflection: e.target.value },
                    }))
                  }
                  placeholder={t.evaluation.reflectionPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t.evaluation.nextFocusLabel}
                </label>
                <textarea
                  rows={3}
                  value={activeCycle.evaluation.nextCycleFocus}
                  onChange={(e) =>
                    updateActiveCycle((c) => ({
                      ...c,
                      evaluation: { ...c.evaluation, nextCycleFocus: e.target.value },
                    }))
                  }
                  placeholder={t.evaluation.nextFocusPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Direct CTA to Embed Selected Evaluation Tools into Final Google AI Studio Prompt */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleAiCompileMasterPrompt(true)}
                disabled={loadingAction === 'compile-master'}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-60"
              >
                {loadingAction === 'compile-master' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>
                  {loadingAction === 'compile-master'
                    ? t.evaluation.embeddingPrompt
                    : t.evaluation.embedInPromptBtn}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep('visualization')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-xs font-bold text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                <span>{t.steps.visualization}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- STEP 6: VISUALIZATION, NEXT CYCLE & EXPORT ---------------- */}
      {activeStep === 'visualization' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.visualization.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {t.visualization.desc}
              </p>
              {activeProject.cycles.length >= (activeCycle.analysis.plannedCycles || 1) && (
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mt-2">
                  {t.visualization.cycleLimitReachedNote}
                </p>
              )}
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('visualization')}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t.workspaceTabs.visualization}</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartNextCycle}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>
                    {t.visualization.startNextCycleBtn} ({t.cycleBadge}{' '}
                    {Math.max(...activeProject.cycles.map((c) => c.cycleNumber)) + 1})
                  </span>
                </button>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.visualization.startNextCycleHint}
              </span>
            </div>
          </div>

          <AddieCycleVisualizer
            project={activeProject}
            activeCycle={activeCycle}
            language={language}
            isCompilingPrompt={loadingAction === 'compile-master'}
            onSelectCycle={(cycleNum) =>
              updateActiveProject((p) => ({ ...p, activeCycleNumber: cycleNum }))
            }
            onJumpToStep={(step) => setActiveStep(step)}
            onUpdateMasterPrompt={(val) =>
              updateActiveCycle((c) => ({
                ...c,
                implementation: {
                  ...c.implementation,
                  finalMasterPrompt: val,
                  finalMasterPromptUpdatedAt: new Date().toISOString(),
                },
              }))
            }
            onCompileMasterPrompt={() => handleAiCompileMasterPrompt(false)}
          />
        </div>
      )}

      {/* Bottom Step Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={currentStepIdx <= 0}
          onClick={() => currentStepIdx > 0 && setActiveStep(STEP_ORDER[currentStepIdx - 1])}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.prevStepBtn}</span>
        </button>

        <button
          type="button"
          disabled={currentStepIdx >= STEP_ORDER.length - 1}
          onClick={() =>
            currentStepIdx < STEP_ORDER.length - 1 &&
            setActiveStep(STEP_ORDER[currentStepIdx + 1])
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
        >
          <span>{t.nextStepBtn}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
        </>
      )}
    </div>
  );
};
