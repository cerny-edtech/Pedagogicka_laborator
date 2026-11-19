import {
  AddieProject,
  CalendarTask,
  ClassroomConfig,
  CriteriaAssignment,
  CriterionLevel,
  DeskSlot,
  JournalEntry,
  JournalPrompt,
  Language,
  LearningProject,
  ObservationRecord,
  Student,
  StudentCriterionEvaluation,
  WellbeingCheckIn,
  WellbeingGoal,
} from '../types';
import {
  computeEvaluationResult,
  computeGradeBoundaries,
  getMaxAssignmentPoints,
} from './assessmentUtils';
import { getT } from '../i18n/translations';
import { getLocalizedCalendarTaskTitle, getLocalizedJournalPrompt } from './initialData';
import { buildStructuredMasterPrompt } from '../components/addie/addieHelpers';
import {
  computeAddieProjectMetrics,
  formatDurationSeconds,
} from '../components/addie/addieMetrics';
import { loadAboutContent } from '../components/about/aboutData';
import { buildAboutPrintableHtml } from '../components/about/AboutApp';

export interface PrintableDocData {
  title: string;
  subtitle?: string;
  contentHtml: string;
  filename: string;
}

export interface CoachReportPayload {
  paragraphReport: string;
  weeklyTips: { title: string; habit: string; category: string }[];
  nvcNeedHighlight?: string;
  encouragement?: string;
  source?: string;
}

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

function getLocalIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildRubricPrintableHtml(
  assignment: CriteriaAssignment,
  language: Language = 'cs'
): PrintableDocData {
  const t = getT(language);
  const maxPoints = getMaxAssignmentPoints(assignment.criteria);
  const passPct = assignment.passingPercentage || 60;
  const passMin = Math.ceil((passPct / 100) * maxPoints);
  const boundaries = computeGradeBoundaries(maxPoints, passPct);

  const formal = assignment.criteria.filter((c) => c.category === 'formal');
  const content = assignment.criteria.filter((c) => c.category === 'content');

  const renderRows = (list: typeof assignment.criteria) =>
    list.length === 0
      ? `<tr><td colspan="4" style="color:#64748b;">${t.assessment.zeroCriteria}</td></tr>`
      : list
          .map(
            (c) => `
            <tr>
              <td><strong>${escHtml(c.name)}</strong></td>
              <td>${escMultiline(c.description)}</td>
              <td style="text-align:center;">${c.weight} / 10</td>
              <td style="text-align:center;"><strong>${c.weight * 3} ${t.assessment.pointsUnit}</strong></td>
            </tr>`
          )
          .join('');

  const contentHtml = `
    <div class="card-box">
      <p style="margin:0;"><strong>${t.assessment.subjectLabel}:</strong> ${escHtml(assignment.subject || '-')} &nbsp;|&nbsp;
      <strong>${t.assessment.totalMaxPointsLabel}:</strong> ${maxPoints} ${t.assessment.pointsUnit} &nbsp;|&nbsp;
      <strong>${t.assessment.passMinPointsLabel}:</strong> ${passMin} ${t.assessment.pointsUnit} (${passPct}%)</p>
      <p style="margin:8px 0 0 0;">${escMultiline(assignment.description || '')}</p>
      <p style="margin:8px 0 0 0; color:#b45309; font-size:12px;"><strong>${t.assessment.zeroVetoTitle}:</strong> ${t.assessment.zeroVetoDesc}</p>
    </div>

    <h3>${t.assessment.gradeScaleHeading}</h3>
    <ul>
      <li><strong>${t.assessment.levelLabels[3]}</strong></li>
      <li><strong>${t.assessment.levelLabels[2]}</strong></li>
      <li><strong>${t.assessment.levelLabels[1]}</strong></li>
      <li><strong>${t.assessment.levelLabels[0]}</strong></li>
    </ul>

    <h3>${t.assessment.formalCriteria} (${formal.length})</h3>
    <table>
      <thead><tr><th>${t.assessment.critNameLabel}</th><th>${t.assessment.critDescLabel}</th><th>${t.assessment.weightLabel}</th><th>Max</th></tr></thead>
      <tbody>${renderRows(formal)}</tbody>
    </table>

    <h3>${t.assessment.contentCriteria} (${content.length})</h3>
    <table>
      <thead><tr><th>${t.assessment.critNameLabel}</th><th>${t.assessment.critDescLabel}</th><th>${t.assessment.weightLabel}</th><th>Max</th></tr></thead>
      <tbody>${renderRows(content)}</tbody>
    </table>

    <h3>${t.assessment.boundariesHeading}</h3>
    <table>
      <thead><tr><th>${t.assessment.gradeCol}</th><th>${t.assessment.rangePctCol}</th><th>${t.assessment.pointsRangeCol}</th><th>${t.assessment.meaningCol}</th></tr></thead>
      <tbody>
        ${boundaries
          .map(
            (b) => `
            <tr>
              <td style="text-align:center;"><strong>${b.grade}</strong></td>
              <td style="text-align:center;">${b.minPct}–${b.maxPct} %</td>
              <td style="text-align:center;"><strong>${b.minPoints}–${b.maxPoints} ${t.assessment.pointsUnit}</strong></td>
              <td>${t.assessment.gradeMeanings[b.grade]}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  return {
    title: `${assignment.title} — ${t.assessment.title}`,
    subtitle: `${t.assessment.scaleHeader}`,
    contentHtml,
    filename: 'kriterialni_rubrika',
  };
}

export function buildStudentEvaluationPrintableHtml(
  assignment: CriteriaAssignment,
  student: Student,
  evaluation: StudentCriterionEvaluation,
  language: Language = 'cs'
): PrintableDocData {
  const t = getT(language);
  const res = computeEvaluationResult(assignment, evaluation.scores);

  const lvlLabel = (lvl: CriterionLevel | undefined) => {
    if (lvl === undefined) return '-';
    return t.assessment.levelLabels[lvl];
  };

  const rows = assignment.criteria
    .map((c) => {
      const lvl = evaluation.scores[c.id];
      const earned = lvl !== undefined ? lvl * c.weight : 0;
      const max = 3 * c.weight;
      const teacherNote = evaluation.criterionNotes?.[c.id];
      const whyText = teacherNote || c.description;
      const improveText =
        lvl === undefined
          ? '-'
          : lvl < 3
          ? `${t.assessment.improveDefaultPrefix} ${c.description}`
          : t.assessment.fullMasteryText;

      return `
        <tr>
          <td>
            <strong>${escHtml(c.name)}</strong><br/>
            <span style="font-size:10.5px;color:#64748b;">${c.category === 'formal' ? t.assessment.formalCriteria : t.assessment.contentCriteria} (${t.assessment.weightLabel} ${c.weight})</span>
          </td>
          <td>${escHtml(lvlLabel(lvl))}</td>
          <td style="text-align:center;"><strong>${earned} / ${max}</strong></td>
          <td>
            <div><strong>${t.assessment.whyPointsLabel}</strong> ${escMultiline(whyText)}</div>
            ${
              lvl !== undefined
                ? `<div style="margin-top:4px; color:${lvl < 3 ? '#b45309' : '#047857'};"><strong>${t.assessment.whatToImproveLabel}</strong> ${escMultiline(improveText)}</div>`
                : ''
            }
          </td>
        </tr>`;
    })
    .join('');

  const contentHtml = `
    <div class="card-box">
      <p style="margin:0; font-size:14px;">
        <strong>${t.assessment.dashAvgScore}:</strong> ${res.totalPoints} / ${res.maxPoints} ${t.assessment.pointsUnit} (${res.percentage} %) &nbsp;|&nbsp;
        <strong>${t.assessment.gradeCol}: <span style="font-size:18px; color:${res.grade <= 4 ? '#0369a1' : '#dc2626'};">${res.grade}</span></strong>
      </p>
      ${res.hasZeroVeto ? `<p style="color:#dc2626; margin:6px 0 0 0;"><em>${t.assessment.zeroVetoAlert}</em></p>` : ''}
    </div>

    ${
      evaluation.aiSummary
        ? `<h3>${t.assessment.studentSummaryHeading}</h3>
           <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px; background:#ffffff;">
             ${escMultiline(evaluation.aiSummary)}
           </div>`
        : ''
    }

    <h3>${t.assessment.detailedBreakdownTitle}</h3>
    <table>
      <thead>
        <tr>
          <th>${t.assessment.critNameLabel}</th>
          <th>${t.assessment.scaleHeader.split(' ')[0]}</th>
          <th>${t.assessment.pointsUnit}</th>
          <th>${t.assessment.whyPointsLabel} / ${t.assessment.whatToImproveLabel}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${
      evaluation.teacherComment
        ? `<h3>${t.assessment.teacherCommentLabel}</h3>
           <div class="card-box">${escMultiline(evaluation.teacherComment)}</div>`
        : ''
    }
  `;

  return {
    title: `${student.firstName} ${student.lastName} — ${assignment.title}`,
    subtitle: `${t.assessment.studentSummaryHeading}`,
    contentHtml,
    filename: `hodnoceni_${student.lastName}_${student.firstName}`,
  };
}

export function buildAssessmentDashboardPrintableHtml(
  assignment: CriteriaAssignment,
  students: Student[],
  evaluations: StudentCriterionEvaluation[],
  language: Language = 'cs'
): PrintableDocData {
  const t = getT(language);
  const evalMap = new Map(evaluations.map((e) => [e.studentId, e]));

  const rows = students
    .map((s) => {
      const ev = evalMap.get(s.id);
      const name = escHtml(`${s.lastName} ${s.firstName}`);
      if (!ev) {
        return `<tr><td>${name}</td><td colspan="4" style="color:#94a3b8;">-</td></tr>`;
      }
      const res = computeEvaluationResult(assignment, ev.scores);
      return `
        <tr>
          <td><strong>${name}</strong></td>
          <td style="text-align:center;">${res.totalPoints} / ${res.maxPoints}</td>
          <td style="text-align:center;">${res.percentage} %</td>
          <td style="text-align:center;"><strong>${res.grade}</strong></td>
          <td>${escHtml((ev.teacherComment || '').slice(0, 140))}</td>
        </tr>`;
    })
    .join('');

  return {
    title: `${assignment.title} — ${t.assessment.dashSummaryTableTitle}`,
    subtitle: `${t.assessment.dashTitle}`,
    contentHtml: `
      <table>
        <thead>
          <tr>
            <th>${t.seating.lastName} & ${t.seating.firstName}</th>
            <th>${t.assessment.pointsRangeCol}</th>
            <th>%</th>
            <th>${t.assessment.gradeCol}</th>
            <th>${t.assessment.teacherCommentLabel}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `,
    filename: 'kriterialni_dashboard_tridy',
  };
}

export function buildJournalPrintableHtml(
  entry: JournalEntry | undefined,
  prompts: JournalPrompt[],
  language: Language = 'cs'
): PrintableDocData {
  const t = getT(language);
  if (!entry) {
    return {
      title: t.journal.title,
      subtitle: t.journal.subtitle,
      contentHtml: `<p>-</p>`,
      filename: 'kreativni_denik',
    };
  }

  const promptBlocks = prompts
    .map((rawPrompt) => {
      const p = getLocalizedJournalPrompt(rawPrompt, language);
      const ans = entry.answers?.[rawPrompt.id] || entry.answers?.[rawPrompt.key] || '';
      return `
        <div class="card-box">
          <div style="font-weight:700; color:#1e293b; margin-bottom:4px;">${escHtml(p.title)}</div>
          <div style="color:#334155;">${ans ? escMultiline(ans) : '<span style="color:#94a3b8;">-</span>'}</div>
        </div>
      `;
    })
    .join('');

  const sketchHtml =
    entry.sketches && entry.sketches.length > 0
      ? `<h3>${t.journal.sketchpadTitle}</h3>${entry.sketches
          .map(
            (src) =>
              `<img src="${escHtml(src)}" style="max-width:440px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:10px; display:block;" />`
          )
          .join('')}`
      : '';

  const sparkHtml = entry.sparkReceived
    ? `<div style="border:1px solid #c7d2fe; background:#eef2ff; border-radius:8px; padding:12px; margin-top:12px;">
        <strong style="color:#3730a3;">${t.journal.academicSparkTitle}:</strong><br/>
        <span>${escMultiline(entry.sparkReceived)}</span>
      </div>`
    : '';

  return {
    title: `${t.journal.title} — ${entry.date} (${entry.mood || '✨'})`,
    subtitle: t.journal.subtitle,
    contentHtml: `${promptBlocks}${sketchHtml}${sparkHtml}`,
    filename: `denik_${entry.date}`,
  };
}

export function buildWellbeingPrintableHtml(params: {
  goals: WellbeingGoal[];
  checkIns: WellbeingCheckIn[];
  diaryDate: string;
  diaryMood: string;
  didTechMakeSense: boolean;
  diaryReflection: string;
  coachReport: CoachReportPayload | null;
  tasks: CalendarTask[];
  language: Language;
}): PrintableDocData {
  const { goals, checkIns, diaryDate, diaryMood, didTechMakeSense, diaryReflection, coachReport, tasks, language } = params;
  const t = getT(language);

  const goalsHtml =
    goals.length === 0
      ? `<p>${t.wellbeing.noActiveGoals}</p>`
      : `<ul>${goals
          .map((g) => {
            const recent = checkIns.filter((c) => c.goalId === g.id);
            const avg =
              recent.length > 0
                ? (recent.reduce((s, c) => s + c.rating, 0) / recent.length).toFixed(1)
                : '-';
            return `<li><strong>${escHtml(g.goalText)}</strong> (${escHtml(g.metric || '-')}) — ${t.seating.avgLabel}: ${avg}/5</li>`;
          })
          .join('')}</ul>`;

  const coachHtml = coachReport
    ? `
      <h3>${t.wellbeing.coachTitle}</h3>
      <div class="card-box">
        <p>${escMultiline(coachReport.paragraphReport)}</p>
        ${coachReport.nvcNeedHighlight ? `<p><strong>${t.wellbeing.coachCoreNeedLabel}:</strong> ${escHtml(coachReport.nvcNeedHighlight)}</p>` : ''}
        <ul>
          ${(coachReport.weeklyTips || []).map((tip) => `<li><strong>${escHtml(tip.title)}:</strong> ${escHtml(tip.habit)}</li>`).join('')}
        </ul>
        ${coachReport.encouragement ? `<p><em>${escHtml(coachReport.encouragement)}</em></p>` : ''}
      </div>`
    : '';

  const tasksHtml =
    tasks.length === 0
      ? `<p>${t.wellbeing.noTasks}</p>`
      : `<table>
          <thead><tr><th>${t.wellbeing.newTaskTimePlaceholder}</th><th>${t.wellbeing.addPersonalTask}</th><th>Status</th></tr></thead>
          <tbody>
            ${tasks
              .map(
                (tk) =>
                  `<tr><td>${escHtml(tk.time)}</td><td>${escHtml(getLocalizedCalendarTaskTitle(tk, language))}</td><td style="text-align:center;">${tk.completed ? '✓' : '○'}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>`;

  return {
    title: `${t.wellbeing.title} — ${escHtml(diaryDate)}`,
    subtitle: t.wellbeing.subtitle,
    contentHtml: `
      <div class="card-box">
        <p style="margin:0;"><strong>${t.wellbeing.moodToday}</strong> ${escHtml(diaryMood)} &nbsp;|&nbsp;
        <strong>${t.wellbeing.techSenseQuestion}</strong> ${didTechMakeSense ? t.wellbeing.yesBtn : t.wellbeing.noBtn}</p>
        <p style="margin:8px 0 0 0;">${diaryReflection ? escMultiline(diaryReflection) : '-'}</p>
      </div>
      <h3>${t.wellbeing.activeGoalsTitle}</h3>
      ${goalsHtml}
      ${coachHtml}
      <h3>${t.wellbeing.tasksPreviewTitle}</h3>
      ${tasksHtml}
    `,
    filename: `wellbeing_${diaryDate}`,
  };
}

export function buildObservationPrintableHtml(
  obs: ObservationRecord,
  language: Language = 'cs'
): PrintableDocData {
  const t = getT(language).observations;
  const escapeHtml = (val: string) =>
    String(val || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

  const renderTriple = (title: string, items: [string, string, string]) => {
    const filled = items.map((s, idx) => `<li><strong>${idx + 1}.</strong> ${s?.trim() ? escapeHtml(s) : '<span style="color:#94a3b8;">-</span>'}</li>`).join('');
    return `
      <div class="card-box">
        <div style="font-weight:700; color:#0f172a; margin-bottom:6px;">${title}</div>
        <ol style="margin:0; padding-left:18px; list-style:none;">${filled}</ol>
      </div>
    `;
  };

  const renderBlock = (title: string, value: string) => `
    <div class="card-box">
      <div style="font-weight:700; color:#0f172a; margin-bottom:4px;">${title}</div>
      <div style="color:#334155;">${value?.trim() ? escapeHtml(value) : '<span style="color:#94a3b8;">-</span>'}</div>
    </div>
  `;

  return {
    title: `${t.title}`,
    subtitle: `${t.seminarTopicLabel}: ${obs.seminarTopic || '-'} | ${t.dateTimeLabel}: ${obs.dateTime || '-'}`,
    contentHtml: `
      <div class="card-box">
        <p style="margin:0;"><strong>${t.seminarTopicLabel}:</strong> ${escapeHtml(obs.seminarTopic || '-')}</p>
        <p style="margin:4px 0 0 0;"><strong>${t.dateTimeLabel}:</strong> ${escapeHtml(obs.dateTime || '-')}</p>
        ${obs.observerName ? `<p style="margin:4px 0 0 0;"><strong>${t.observerNameLabel}:</strong> ${escapeHtml(obs.observerName)}</p>` : ''}
        ${obs.observedTeacherName ? `<p style="margin:4px 0 0 0;"><strong>${t.observedNameLabel}:</strong> ${escapeHtml(obs.observedTeacherName)}</p>` : ''}
      </div>

      <h3>${t.reflectiveSectionTitle}</h3>
      ${renderTriple(t.reflectiveQuestions.learnedTitle, obs.reflective.learned)}
      ${renderTriple(t.reflectiveQuestions.delightedTitle, obs.reflective.delighted)}
      ${renderBlock(t.reflectiveQuestions.applicationTitle, obs.reflective.application)}
      ${renderBlock(t.reflectiveQuestions.furtherLearningTitle, obs.reflective.furtherLearning)}
      ${renderBlock(t.reflectiveQuestions.expectationsMetTitle, obs.reflective.expectationsMet)}

      <h3>${t.evaluativeSectionTitle}</h3>
      ${renderBlock(t.evaluativeQuestions.lessonGoalsTitle, obs.evaluative.lessonGoals)}
      ${renderBlock(t.evaluativeQuestions.methodsAndAchievementTitle, obs.evaluative.methodsAndAchievement)}
      ${renderBlock(t.evaluativeQuestions.safeAtmosphereTitle, obs.evaluative.safeAtmosphere)}
      ${renderTriple(t.evaluativeQuestions.recommendationsTitle, obs.evaluative.recommendations)}
      ${renderBlock(t.evaluativeQuestions.improvementsNextTimeTitle, obs.evaluative.improvementsNextTime)}
      ${renderBlock(t.evaluativeQuestions.groupConnectionTitle, obs.evaluative.groupConnection)}
      ${renderBlock(t.evaluativeQuestions.clarityTitle, obs.evaluative.clarity)}
      ${renderBlock(t.evaluativeQuestions.metaphorAndReasonTitle, obs.evaluative.metaphorAndReason)}
      ${renderBlock(t.evaluativeQuestions.issuesObservedTitle, obs.evaluative.issuesObserved)}
    `,
    filename: `naslech_${(obs.seminarTopic || 'arch').toLowerCase().replace(/[^a-z0-9]+/gi, '_')}`,
  };
}

export function buildAddiePrintableHtml(
  project: AddieProject,
  language: Language = 'cs'
): PrintableDocData {
  const t = getT(language).addie;
  const pv = t.projectViz;
  const metrics = computeAddieProjectMetrics(project, 'all');
  const esc = (s: string | undefined | null) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

  const lifespanSummaryHtml = `
    <div style="border:1px solid #cbd5e1; background:#f8fafc; border-radius:10px; padding:14px; margin-bottom:18px; page-break-inside:avoid;">
      <h3 style="margin-top:0; margin-bottom:10px; color:#0f172a;">${esc(pv.title)}</h3>
      <table>
        <thead>
          <tr>
            <th>${esc(pv.kpis.iterations)}</th>
            <th>${esc(pv.kpis.totalTime)}</th>
            <th>${esc(pv.kpis.criteriaMet)}</th>
            <th>${esc(pv.kpis.lifespan)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${metrics.totalIterationsCreated} / ${metrics.plannedIterationsTarget}</strong> (${metrics.avgPhasesCompleted}/5 ${esc(pv.kpis.iterationsAvgPhases)})</td>
            <td><strong>${formatDurationSeconds(metrics.totalTrackedSeconds)}</strong></td>
            <td><strong>${metrics.criteriaTotals.met}/${metrics.criteriaTotals.selectedCount} (${metrics.criteriaTotals.metRatePct}%)</strong></td>
            <td><strong>${metrics.lifespanDays} ${esc(pv.kpis.lifespanDaysUnit)}</strong></td>
          </tr>
        </tbody>
      </table>
      <table style="margin-top:10px;">
        <thead>
          <tr>
            <th>${esc(pv.timeLoggerPhaseLabel)}</th>
            <th>${esc(pv.totalCol)}</th>
            <th>${esc(pv.shareCol)}</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.phaseRows
            .map(
              (row) =>
                `<tr><td>${esc(pv.phaseShort[row.phase])}</td><td>${formatDurationSeconds(row.totalSeconds)}</td><td>${row.sharePct}%</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  const cyclesHtml = (project.cycles || [])
    .map((cycle) => {
      const selectedEval = (cycle.evaluation.methods || []).filter((m) => m.selected);
      return `
        <div style="border:1px solid #cbd5e1; border-radius:10px; padding:14px; margin-bottom:16px; page-break-inside:avoid;">
          <h3 style="margin-top:0; color:#4f46e5;">${t.cycleBadge} ${cycle.cycleNumber} ${t.ofLabel} ${cycle.analysis.plannedCycles || project.cycles.length}</h3>

          <p><strong>${t.steps.analysis}:</strong></p>
          <ul>
            <li><strong>${t.analysis.q1Label}:</strong> ${esc(cycle.analysis.designChallenge) || '-'}</li>
            <li><strong>${t.analysis.q2aLabel}:</strong> ${esc(cycle.analysis.targetGroup) || '-'}</li>
            <li><strong>${t.analysis.q2bLabel}:</strong> ${esc(cycle.analysis.priorKnowledgeAndContinuity) || '-'}</li>
            <li><strong>${t.analysis.q3Label}:</strong> ${esc(cycle.analysis.availableResources) || '-'}</li>
            <li><strong>${t.analysis.q4Label}:</strong> ${esc(cycle.analysis.competition) || '-'}</li>
          </ul>

          <p><strong>${t.steps.design}:</strong></p>
          <div class="card-box">
            <strong>${esc(cycle.design.editedSolution.title) || '-'}</strong> (${esc(cycle.design.editedSolution.archetype) || '-'})<br/>
            ${esc(cycle.design.editedSolution.summary) || '-'}
          </div>

          <p><strong>${t.steps.development}:</strong></p>
          <table>
            <thead><tr><th>#</th><th>${t.development.stepsTitle}</th><th>${t.development.stepDeliverablePlaceholder}</th><th>${t.development.stepDurationPlaceholder}</th></tr></thead>
            <tbody>
              ${
                (cycle.development.steps || [])
                  .map(
                    (s) =>
                      `<tr><td>${s.order}</td><td><strong>${esc(s.title)}</strong><br/>${esc(s.description)}</td><td>${esc(s.deliverable)}</td><td>${esc(s.duration)}</td></tr>`
                  )
                  .join('') || '<tr><td colspan="4">-</td></tr>'
              }
            </tbody>
          </table>
          <p style="font-size:12px;"><strong>${t.development.toolsTitle}:</strong> ${esc((cycle.development.tools || []).join(', ')) || '-'}<br/>
          <strong>${t.development.professionsTitle}:</strong> ${esc((cycle.development.professions || []).join(', ')) || '-'}</p>

          <p><strong>${t.steps.implementation} (${cycle.implementation.deliverableMode === 'classic_lesson' ? t.analysis.outputLesson : t.analysis.outputDigital}):</strong></p>
          <div style="border:1px solid #e2e8f0; background:#f8fafc; padding:10px; border-radius:6px; font-size:12px; margin-bottom:10px;">
            ${esc(cycle.implementation.generatedArtifact) || '-'}
          </div>

          <p><strong>${t.steps.evaluation}:</strong></p>
          <ul>
            ${
              selectedEval
                .map((m) => {
                  const statusText = t.criterionStatuses[m.criterionStatus || 'pending'];
                  return `<li><strong>${esc(m.title)}</strong> [${esc(m.methodType)}] — <strong>${esc(statusText)}</strong>: ${esc(m.howToConduct)} — <em>${esc(m.successCriterion)}</em>${
                    m.measuredResult
                      ? `<br/><strong>${esc(t.measuredResultLabel)}:</strong> ${esc(m.measuredResult)}`
                      : ''
                  }${
                    m.embeddedFeature
                      ? `<br/><span style="color:#047857;"><strong>${t.evaluation.embeddedFeatureLabel}:</strong> ${esc(m.embeddedFeature)}</span>`
                      : ''
                  }</li>`;
                })
                .join('') || '<li>-</li>'
            }
          </ul>
          ${cycle.evaluation.cycleReflection ? `<p><strong>${t.evaluation.reflectionTitle}:</strong> ${esc(cycle.evaluation.cycleReflection)}</p>` : ''}

          <p><strong>${t.visualization.masterPromptTitle}:</strong></p>
          <div style="border:1px solid #cbd5e1; background:#f8fafc; padding:10px; border-radius:6px; font-family:monospace; font-size:11px; margin-bottom:10px;">
            ${esc(
              cycle.implementation.finalMasterPrompt?.trim() ||
                buildStructuredMasterPrompt(cycle, project.title, language)
            )}
          </div>
        </div>
      `;
    })
    .join('');

  return {
    title: `${t.title}: ${project.title || t.defaultProjectTitle}`,
    subtitle: `${t.visualization.completedCyclesLabel} ${project.cycles.length}`,
    contentHtml: `${lifespanSummaryHtml}${cyclesHtml}`,
    filename: `addie_${(project.title || 'projekt').toLowerCase().replace(/[^a-z0-9]+/gi, '_')}`,
  };
}

export function generatePrintableHtml(
  tab: string,
  data: {
    students?: Student[];
    config?: ClassroomConfig;
    desks?: DeskSlot[];
    journalEntries?: JournalEntry[];
    prompts?: JournalPrompt[];
    project?: LearningProject | null;
    assignment?: CriteriaAssignment | null;
    evaluations?: StudentCriterionEvaluation[];
    observation?: ObservationRecord | null;
    addieProject?: AddieProject | null;
    language?: Language;
  }
): PrintableDocData {
  const language: Language = data.language || 'cs';
  const t = getT(language);

  if (tab === 'seating') {
    const config = data.config || { rows: 5, cols: 3, layout: 'standard', deskCapacity: 2, blackboardPosition: 'top', enforceBoyGirl: true, activeSubject: 'all' };
    const desks = data.desks || [];
    const students = data.students || [];

    const getStudentName = (sId: string | null | undefined) => {
      if (!sId) return `<span style="color:#94a3b8;">${t.seating.emptySeat}</span>`;
      const st = students.find((s) => s.id === sId);
      if (!st) return `<span style="color:#94a3b8;">${t.seating.emptySeat}</span>`;
      return `<strong>${escHtml(st.firstName)} ${escHtml(st.lastName)}</strong>`;
    };

    const maxRow = Math.max(config.rows - 1, ...desks.map((d) => d.row), 0);
    const maxCol = Math.max(config.cols - 1, ...desks.map((d) => d.col), 0);

    const gridRowsHtml: string[] = [];
    for (let r = 0; r <= maxRow; r++) {
      const cells: string[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const desk = desks.find((d) => d.row === r && d.col === c);
        if (!desk && desks.length > 0 && config.layout === 'u_shape') {
          cells.push(`<div style="flex:1; padding:10px;"></div>`);
          continue;
        }
        const s0 = getStudentName(desk?.studentIds?.[0]);
        const s1 = getStudentName(desk?.studentIds?.[1]);
        cells.push(`
          <div style="flex:1; border:2px solid #cbd5e1; border-radius:10px; padding:8px; background:#f8fafc;">
            <div style="font-size:10px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px; text-align:center;">
              ${t.seating.deskLabel} ${r + 1}.${c + 1}
            </div>
            <div style="display:flex; gap:6px; font-size:12px;">
              <div style="flex:1; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:7px; text-align:center;">${s0}</div>
              <div style="flex:1; background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:7px; text-align:center;">${s1}</div>
            </div>
          </div>
        `);
      }
      gridRowsHtml.push(`<div style="display:flex; gap:10px; margin-bottom:10px;">${cells.join('')}</div>`);
    }

    return {
      title: `${t.seating.title} (${t.seating.studentViewBtn})`,
      subtitle: t.seating.layouts[config.layout],
      contentHtml: `
        <div style="background:#0f172a; color:#ffffff; text-align:center; padding:10px; border-radius:8px; font-weight:700; font-size:12px; letter-spacing:0.1em; margin-bottom:14px;">
          ${t.seating.blackboardStudent}
        </div>
        ${gridRowsHtml.join('')}
        <p style="font-size:11px; color:#64748b; margin-top:12px; text-align:center;">
          ${t.seating.studentViewActiveBadge}
        </p>
      `,
      filename: 'zasedaci_poradek',
    };
  }

  if (tab === 'journal') {
    const entries = Array.isArray(data.journalEntries) ? data.journalEntries : [];
    const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
    return buildJournalPrintableHtml(latest, data.prompts || [], language);
  }

  if (tab === 'edudesign') {
    const p = data.project;
    if (!p) {
      return { title: t.edudesign.title, subtitle: t.edudesign.subtitle, contentHtml: `<p>-</p>`, filename: 'edudesign' };
    }
    return {
      title: p.title || t.edudesign.title,
      subtitle: `${t.edudesign.targetGroupLabel}: ${p.targetGroup || '-'}`,
      contentHtml: `
        <div class="card-box">
          <strong>${t.edudesign.generalGoal}:</strong><br/>${escMultiline(p.generalGoal || '-')}
        </div>
        <h3>${t.edudesign.subGoalsTitle}</h3>
        <ul>${(p.subGoals || []).map((g) => `<li><strong>[${escHtml(t.edudesign.bloomCategories[g.bloomLevel])}]</strong> ${escHtml(g.text)}</li>`).join('') || '<li>-</li>'}</ul>
        <h3>${t.edudesign.selectedObjectsTitle}</h3>
        <table>
          <thead><tr><th>${t.edudesign.tabs.objects}</th><th>${t.edudesign.studentActivityLabel}</th><th>${t.edudesign.teacherRoleLabel}</th><th>${t.edudesign.alignmentEvalCol}</th></tr></thead>
          <tbody>
            ${
              (p.learningObjects || [])
                .map(
                  (o) =>
                    `<tr><td><strong>${escHtml(o.title)}</strong> (${escHtml(o.duration)})</td><td>${escMultiline(o.studentActivity)}</td><td>${escMultiline(o.teacherRole)}</td><td>${escMultiline(o.verificationMethod)}</td></tr>`
                )
                .join('') || '<tr><td colspan="4">-</td></tr>'
            }
          </tbody>
        </table>
      `,
      filename: 'edudesign_priprava',
    };
  }

  if (tab === 'wellbeing') {
    let goals: WellbeingGoal[] = [];
    let checkIns: WellbeingCheckIn[] = [];
    let tasks: CalendarTask[] = [];
    let coachReport: CoachReportPayload | null = null;
    let diaryData: {
      diaryDate?: string;
      diaryMood?: string;
      didTechMakeSense?: boolean;
      diaryReflection?: string;
    } = {};
    try {
      const g = localStorage.getItem('pl_wellbeing_goals');
      if (g) goals = JSON.parse(g);
      const c = localStorage.getItem('pl_wellbeing_checkins');
      if (c) checkIns = JSON.parse(c);
      const tk = localStorage.getItem('pl_wellbeing_tasks');
      if (tk) tasks = JSON.parse(tk);
      const cr = localStorage.getItem('pl_wellbeing_coach_report');
      if (cr) coachReport = JSON.parse(cr);
      const d = localStorage.getItem('pl_wellbeing_diary');
      if (d) diaryData = JSON.parse(d);
    } catch {
      // ignore localStorage read fallback
    }
    const today = getLocalIsoDate();
    return buildWellbeingPrintableHtml({
      goals,
      checkIns,
      diaryDate: diaryData.diaryDate || today,
      diaryMood: diaryData.diaryMood || '🌿',
      didTechMakeSense: typeof diaryData.didTechMakeSense === 'boolean' ? diaryData.didTechMakeSense : true,
      diaryReflection: diaryData.diaryReflection || '',
      coachReport,
      tasks,
      language,
    });
  }

  if (tab === 'assessment' && data.assignment) {
    return buildRubricPrintableHtml(data.assignment, language);
  }

  if (tab === 'observations' && data.observation) {
    return buildObservationPrintableHtml(data.observation, language);
  }

  if (tab === 'addie' && data.addieProject) {
    return buildAddiePrintableHtml(data.addieProject, language);
  }

  if (tab === 'about') {
    const aboutData = loadAboutContent(language);
    return buildAboutPrintableHtml(aboutData, language, null);
  }

  return {
    title: `${t.appTitle} — ${t.appSubtitle}`,
    subtitle: t.hub.badge,
    contentHtml: `
      <ul>
        <li><strong>${t.nav.seating}:</strong> ${t.hub.modules.seating.desc}</li>
        <li><strong>${t.nav.journal}:</strong> ${t.hub.modules.journal.desc}</li>
        <li><strong>${t.nav.edudesign}:</strong> ${t.hub.modules.edudesign.desc}</li>
        <li><strong>${t.nav.wellbeing}:</strong> ${t.hub.modules.wellbeing.desc}</li>
        <li><strong>${t.nav.assessment}:</strong> ${t.hub.modules.assessment.desc}</li>
        <li><strong>${t.nav.observations}:</strong> ${t.hub.modules.observations.desc}</li>
        <li><strong>${t.nav.addie}:</strong> ${t.hub.modules.addie.desc}</li>
        <li><strong>${t.nav.about}:</strong> ${t.hub.modules.about.desc}</li>
      </ul>
    `,
    filename: 'pedagogicka_laborator',
  };
}
