import {
  CriteriaAssignment,
  CriterionLevel,
  RubricCriterion,
  StudentCriterionEvaluation,
  Language,
} from '../types';

export interface GradeBoundary {
  grade: 1 | 2 | 3 | 4 | 5;
  label: Record<Language, string>;
  minPct: number;
  maxPct: number;
  minPoints: number;
  maxPoints: number;
  note?: Record<Language, string>;
}

export interface ComputedEvaluationResult {
  totalPoints: number;
  maxPoints: number;
  formalPoints: number;
  formalMax: number;
  contentPoints: number;
  contentMax: number;
  percentage: number;
  hasZeroVeto: boolean;
  zeroCriteriaNames: string[];
  grade: 1 | 2 | 3 | 4 | 5;
  passed: boolean;
  isComplete: boolean;
  scoredCount: number;
}

export const LEVEL_LABELS: Record<CriterionLevel, Record<Language, string>> = {
  3: { cs: 'Splnil zcela', en: 'Fully met', pl: 'Spełnione w pełni' },
  2: { cs: 'Splnil částečně', en: 'Partially met', pl: 'Spełnione częściowo' },
  1: { cs: 'Splnil v omezeném rozsahu', en: 'Limited fulfillment', pl: 'Spełnione w ograniczonym zakresie' },
  0: { cs: 'Nesplnil', en: 'Not met', pl: 'Niespełnione' },
};

export const GRADE_LABELS: Record<1 | 2 | 3 | 4 | 5, Record<Language, string>> = {
  1: { cs: '1 – Výborný', en: '1 – Excellent', pl: '1 – Celujący / Bardzo dobry' },
  2: { cs: '2 – Chvalitebný', en: '2 – Very Good', pl: '2 – Dobry plus' },
  3: { cs: '3 – Dobrý', en: '3 – Good', pl: '3 – Dobry' },
  4: { cs: '4 – Dostatečný', en: '4 – Sufficient (Pass)', pl: '4 – Dostateczny (Zdany)' },
  5: { cs: '5 – Nedostatečný (Propadl)', en: '5 – Fail', pl: '5 – Niedostateczny (Niezdany)' },
};

export function getMaxAssignmentPoints(criteria: RubricCriterion[]): number {
  return criteria.reduce((sum, c) => sum + 3 * c.weight, 0);
}

export function computeGradeBoundaries(
  maxPoints: number,
  passingPercentage = 60
): GradeBoundary[] {
  if (maxPoints <= 0) {
    return [
      { grade: 1, label: GRADE_LABELS[1], minPct: 90, maxPct: 100, minPoints: 0, maxPoints: 0 },
      { grade: 2, label: GRADE_LABELS[2], minPct: 80, maxPct: 89.9, minPoints: 0, maxPoints: 0 },
      { grade: 3, label: GRADE_LABELS[3], minPct: 70, maxPct: 79.9, minPoints: 0, maxPoints: 0 },
      { grade: 4, label: GRADE_LABELS[4], minPct: passingPercentage, maxPct: 69.9, minPoints: 0, maxPoints: 0 },
      { grade: 5, label: GRADE_LABELS[5], minPct: 0, maxPct: passingPercentage - 0.1, minPoints: 0, maxPoints: 0 },
    ];
  }

  const p4 = Math.ceil((passingPercentage / 100) * maxPoints);
  const p3 = Math.max(p4, Math.ceil(0.7 * maxPoints));
  const p2 = Math.max(p3, Math.ceil(0.8 * maxPoints));
  const p1 = Math.max(p2, Math.ceil(0.9 * maxPoints));

  return [
    {
      grade: 1,
      label: GRADE_LABELS[1],
      minPct: 90,
      maxPct: 100,
      minPoints: p1,
      maxPoints: maxPoints,
    },
    {
      grade: 2,
      label: GRADE_LABELS[2],
      minPct: 80,
      maxPct: 89.9,
      minPoints: p2,
      maxPoints: Math.max(p2, p1 - 1),
    },
    {
      grade: 3,
      label: GRADE_LABELS[3],
      minPct: 70,
      maxPct: 79.9,
      minPoints: p3,
      maxPoints: Math.max(p3, p2 - 1),
    },
    {
      grade: 4,
      label: GRADE_LABELS[4],
      minPct: passingPercentage,
      maxPct: 69.9,
      minPoints: p4,
      maxPoints: Math.max(p4, p3 - 1),
    },
    {
      grade: 5,
      label: GRADE_LABELS[5],
      minPct: 0,
      maxPct: passingPercentage - 0.1,
      minPoints: 0,
      maxPoints: Math.max(0, p4 - 1),
      note: {
        cs: 'Nebo hodnocení 0 bodů (Nesplnil) v libovolném kritériu.',
        en: 'Or scoring 0 points (Not met) on any single criterion.',
        pl: 'Lub uzyskanie 0 punktów (Niespełnione) w dowolnym kryterium.',
      },
    },
  ];
}

export function computeEvaluationResult(
  assignment: CriteriaAssignment,
  scores: Record<string, CriterionLevel>
): ComputedEvaluationResult {
  let totalPoints = 0;
  let maxPoints = 0;
  let formalPoints = 0;
  let formalMax = 0;
  let contentPoints = 0;
  let contentMax = 0;
  let scoredCount = 0;
  const zeroCriteriaNames: string[] = [];

  for (const c of assignment.criteria) {
    const cMax = 3 * c.weight;
    maxPoints += cMax;
    if (c.category === 'formal') formalMax += cMax;
    else contentMax += cMax;

    const rawLevel = scores[c.id];
    if (rawLevel !== undefined && rawLevel !== null) {
      scoredCount += 1;
      const earned = rawLevel * c.weight;
      totalPoints += earned;
      if (c.category === 'formal') formalPoints += earned;
      else contentPoints += earned;

      if (rawLevel === 0) {
        zeroCriteriaNames.push(c.name);
      }
    }
  }

  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 1000) / 10 : 0;
  const hasZeroVeto = zeroCriteriaNames.length > 0;
  const passPct = assignment.passingPercentage || 60;

  let grade: 1 | 2 | 3 | 4 | 5 = 5;
  if (hasZeroVeto || percentage < passPct) {
    grade = 5;
  } else if (percentage >= 90) {
    grade = 1;
  } else if (percentage >= 80) {
    grade = 2;
  } else if (percentage >= 70) {
    grade = 3;
  } else {
    grade = 4;
  }

  return {
    totalPoints,
    maxPoints,
    formalPoints,
    formalMax,
    contentPoints,
    contentMax,
    percentage,
    hasZeroVeto,
    zeroCriteriaNames,
    grade,
    passed: grade <= 4,
    isComplete: assignment.criteria.length > 0 && scoredCount === assignment.criteria.length,
    scoredCount,
  };
}

// Format Assignment + Criteria + Weights into a clean Google Doc text (including structured block for lossless re-import)
export function serializeAssignmentForGoogleDoc(
  assignment: CriteriaAssignment,
  language: Language = 'cs'
): string {
  const maxPoints = getMaxAssignmentPoints(assignment.criteria);
  const boundaries = computeGradeBoundaries(maxPoints, assignment.passingPercentage);
  const formal = assignment.criteria.filter((c) => c.category === 'formal');
  const content = assignment.criteria.filter((c) => c.category === 'content');

  const lbl =
    language === 'en'
      ? {
          header: 'ASSIGNMENT BRIEF & CRITERION ASSESSMENT RUBRIC',
          title: 'Assignment',
          subject: 'Subject / Area',
          pass: `Passing threshold: ${assignment.passingPercentage}% (0 points on any criterion results in Grade 5)`,
          desc: 'INSTRUCTIONS:',
          noDesc: '(No description)',
          scale: 'SCORING SCALE PER CRITERION:',
          s3: '3 pts: Fully met',
          s2: '2 pts: Partially met',
          s1: '1 pt: Limited fulfillment',
          s0: '0 pts: Not met (automatic Grade 5)',
          formal: `FORMAL CRITERIA (${formal.length}):`,
          content: `CONTENT CRITERIA (${content.length}):`,
          weight: 'Weight',
          descCrit: 'Description',
          bounds: `GRADE BOUNDARIES (Total maximum: ${maxPoints} weighted pts):`,
          grade: 'Grade',
          pts: 'pts',
          note: 'TEACHER METHODOLOGICAL NOTE:',
        }
      : language === 'pl'
      ? {
          header: 'ZADANIE I OCENIANIE KRYTERIALNE',
          title: 'Zadanie',
          subject: 'Przedmiot / Obszar',
          pass: `Próg zaliczenia: ${assignment.passingPercentage} % (0 punktów w dowolnym kryterium oznacza ocenę 5)`,
          desc: 'OPIS ZADANIA:',
          noDesc: '(Brak opisu)',
          scale: 'SKALA OCENIANIA DLA KAŻDEGO KRYTERIUM:',
          s3: '3 pkt: Spełnione w pełni',
          s2: '2 pkt: Spełnione częściowo',
          s1: '1 pkt: Spełnione w ograniczonym zakresie',
          s0: '0 pkt: Niespełnione (automatyczna ocena 5)',
          formal: `KRYTERIA FORMALNE (${formal.length}):`,
          content: `KRYTERIA MERYTORYCZNE (${content.length}):`,
          weight: 'Waga',
          descCrit: 'Opis',
          bounds: `PROGI PUNKTOWE OCEN (Maksimum całkowite: ${maxPoints} ważonych pkt):`,
          grade: 'Ocena',
          pts: 'pkt',
          note: 'NOTATKA METODYCZNA NAUCZYCIELA:',
        }
      : {
          header: 'ZADÁNÍ ÚKOLU A KRITERIÁLNÍ HODNOCENÍ',
          title: 'Název úkolu',
          subject: 'Předmět / Oblast',
          pass: `Hranice úspěšnosti: ${assignment.passingPercentage} % (při 0 bodech v libovolném kritériu je známka 5)`,
          desc: 'POPIS ZADÁNÍ:',
          noDesc: '(Bez popisu)',
          scale: 'HODNOTICÍ ŠKÁLA PRO KAŽDÉ KRITÉRIUM:',
          s3: '3 body: Splnil zcela',
          s2: '2 body: Splnil částečně',
          s1: '1 bod: Splnil v omezeném rozsahu',
          s0: '0 bodů: Nesplnil (automaticky vede k výsledné známce 5)',
          formal: `FORMÁLNÍ KRITÉRIA (${formal.length}):`,
          content: `OBSAHOVÁ KRITÉRIA (${content.length}):`,
          weight: 'Váha',
          descCrit: 'Popis',
          bounds: `BODOVÉ HRANICE ZNÁMEK (Celkové maximum: ${maxPoints} vážených bodů):`,
          grade: 'Známka',
          pts: 'b.',
          note: 'METODICKÁ POZNÁMKA UČITELE:',
        };

  const lines: string[] = [
    lbl.header,
    `========================================`,
    `${lbl.title}: ${assignment.title}`,
    `${lbl.subject}: ${assignment.subject}`,
    lbl.pass,
    ``,
    lbl.desc,
    assignment.description || lbl.noDesc,
    ``,
    lbl.scale,
    `- ${lbl.s3}`,
    `- ${lbl.s2}`,
    `- ${lbl.s1}`,
    `- ${lbl.s0}`,
    ``,
    lbl.formal,
    ...formal.map(
      (c, i) => `${i + 1}. ${c.name} [${lbl.weight}: ${c.weight}/10 | Max: ${c.weight * 3} ${lbl.pts}]\n   ${lbl.descCrit}: ${c.description}`
    ),
    ``,
    lbl.content,
    ...content.map(
      (c, i) => `${i + 1}. ${c.name} [${lbl.weight}: ${c.weight}/10 | Max: ${c.weight * 3} ${lbl.pts}]\n   ${lbl.descCrit}: ${c.description}`
    ),
    ``,
    lbl.bounds,
    ...boundaries.map(
      (b) => `- ${lbl.grade} ${b.grade}: ${b.minPoints}–${b.maxPoints} ${lbl.pts} (${b.minPct}–${b.maxPct} %)`
    ),
    ``,
  ];

  if (assignment.generalNote) {
    lines.push(lbl.note);
    lines.push(assignment.generalNote);
    lines.push(``);
  }

  // Machine-readable JSON payload for 100% lossless re-import from Google Docs
  const payload = {
    version: 1,
    title: assignment.title,
    subject: assignment.subject,
    description: assignment.description,
    passingPercentage: assignment.passingPercentage,
    generalNote: assignment.generalNote || '',
    criteria: assignment.criteria.map((c) => ({
      name: c.name,
      description: c.description,
      category: c.category,
      weight: c.weight,
    })),
  };

  lines.push(`[KRITERIALNI_HODNOCENI_DATA]`);
  lines.push(JSON.stringify(payload, null, 2));
  lines.push(`[/KRITERIALNI_HODNOCENI_DATA]`);

  return lines.join('\n');
}

// Parse Google Doc text back into CriteriaAssignment fields
export function parseAssignmentFromGoogleDocText(
  rawText: string,
  fallbackTitle: string
): Omit<CriteriaAssignment, 'id' | 'createdAt' | 'updatedAt'> | null {
  // 1. Try structured JSON block first
  const match = rawText.match(
    /\[KRITERIALNI_HODNOCENI_DATA\]([\s\S]*?)\[\/KRITERIALNI_HODNOCENI_DATA\]/
  );
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && Array.isArray(parsed.criteria)) {
        return {
          title: parsed.title || fallbackTitle,
          subject: parsed.subject || 'Obecný předmět',
          description: parsed.description || '',
          passingPercentage: Number(parsed.passingPercentage) || 60,
          generalNote: parsed.generalNote || '',
          criteria: parsed.criteria.map((c: any, idx: number) => ({
            id: `crit_imp_${Date.now()}_${idx}`,
            name: String(c.name || `Kritérium ${idx + 1}`),
            description: String(c.description || ''),
            category: c.category === 'formal' ? 'formal' : 'content',
            weight: Math.min(10, Math.max(1, Number(c.weight) || 5)),
          })),
        };
      }
    } catch {
      // Fall through to regex parser
    }
  }

  // 2. Fallback regex parser for human-edited Google Docs
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  let title = fallbackTitle;
  let subject = 'Importováno z Google Docs';
  let description = '';
  const criteria: RubricCriterion[] = [];
  let currentCat: 'formal' | 'content' = 'content';
  let inDescription = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Název úkolu:')) {
      title = line.replace('Název úkolu:', '').trim() || title;
      inDescription = false;
    } else if (line.startsWith('Předmět / Oblast:')) {
      subject = line.replace('Předmět / Oblast:', '').trim() || subject;
      inDescription = false;
    } else if (line.startsWith('POPIS ZADÁNÍ:')) {
      inDescription = true;
    } else if (line.startsWith('HODNOTICÍ ŠKÁLA')) {
      inDescription = false;
    } else if (line.startsWith('FORMÁLNÍ KRITÉRIA')) {
      currentCat = 'formal';
      inDescription = false;
    } else if (line.startsWith('OBSAHOVÁ KRITÉRIA')) {
      currentCat = 'content';
      inDescription = false;
    } else if (line.startsWith('BODOVÉ HRANICE')) {
      inDescription = false;
      break;
    } else if (inDescription && line) {
      description += (description ? '\n' : '') + line;
    } else {
      const critMatch = line.match(/^\d+\.\s+(.+?)\s*\[Váha:\s*(\d+)/i);
      if (critMatch) {
        const nextLine = lines[i + 1] || '';
        const desc = nextLine.startsWith('Popis:') ? nextLine.replace('Popis:', '').trim() : '';
        criteria.push({
          id: `crit_imp_${Date.now()}_${criteria.length}`,
          name: critMatch[1].trim(),
          description: desc,
          category: currentCat,
          weight: Math.min(10, Math.max(1, Number(critMatch[2]) || 5)),
        });
      }
    }
  }

  if (criteria.length > 0 || description.length > 0) {
    return {
      title,
      subject,
      description,
      passingPercentage: 60,
      criteria,
    };
  }

  return null;
}

export const INITIAL_CRITERIA_BANK: Omit<RubricCriterion, 'id'>[] = [
  {
    name: 'Struktura a rozsah práce',
    description: 'Práce obsahuje úvod, jádro a závěr a dodržuje stanovený rozsah (±10 %).',
    category: 'formal',
    weight: 3,
  },
  {
    name: 'Práce se zdroji a citace',
    description: 'Všechny převzaté myšlenky a data obsahují řádný odkaz na zdroj dle citační normy.',
    category: 'formal',
    weight: 4,
  },
  {
    name: 'Pravopisná a typografická čistota',
    description: 'Text obsahuje maximálně 2 pravopisné chyby na normostranu a jednotné formátování.',
    category: 'formal',
    weight: 2,
  },
  {
    name: 'Věcná správnost a přesnost pojmů',
    description: 'Student používá odborné pojmy v přesném významu bez faktických omylů.',
    category: 'content',
    weight: 9,
  },
  {
    name: 'Doložení argumentů důkazy',
    description: 'Každé hlavní tvrzení v textu je podepřeno alespoň dvěma ověřitelnými fakty nebo příklady.',
    category: 'content',
    weight: 8,
  },
  {
    name: 'Kritická reflexe a vlastní závěr',
    description: 'Závěr porovnává minimálně dva úhly pohledu a shrnuje podložené zjištění.',
    category: 'content',
    weight: 6,
  },
];

export const INITIAL_ASSIGNMENTS: CriteriaAssignment[] = [
  {
    id: 'assign_demo_1',
    title: 'Esej: Využití digitálních technologií ve výuce',
    subject: 'Obecná didaktika',
    description:
      'Student napíše strukturovanou argumentační esej v rozsahu 2 normostran, ve které zhodnotí přínosy a rizika vybraného digitálního nástroje s oporou o odbornou literaturu.',
    passingPercentage: 60,
    criteria: [
      {
        id: 'c_f1',
        name: 'Struktura a rozsah práce',
        description: 'Esej má úvod s tezí, rozvíjející stať a závěr v rozsahu 1,8 až 2,2 normostrany.',
        category: 'formal',
        weight: 3,
      },
      {
        id: 'c_f2',
        name: 'Citace zdrojů dle normy',
        description: 'Všechna převzatá tvrzení odkazují na alespoň 3 odborné zdroje uvedené v seznamu literatury.',
        category: 'formal',
        weight: 4,
      },
      {
        id: 'c_c1',
        name: 'Didaktická argumentace',
        description: 'Práce předkládá alespoň 3 konkrétní pedagogické argumenty pro a 2 proti nasazení nástroje.',
        category: 'content',
        weight: 8,
      },
      {
        id: 'c_c2',
        name: 'Propojení teorie s praxí',
        description: 'Obsahuje konkrétní návrh aktivity do vyučovací hodiny včetně očekávaného výsledku učení.',
        category: 'content',
        weight: 9,
      },
    ],
    generalNote: 'Hodnotíme konkrétní argumenty a strukturu odevzdaného textu.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function buildEvaluationCsv(
  assignment: CriteriaAssignment,
  students: { id: string; firstName: string; lastName: string }[],
  evaluations: StudentCriterionEvaluation[],
  language: Language = 'cs'
): string {
  const evalMap = new Map(evaluations.map((e) => [e.studentId, e]));
  const lbl =
    language === 'en'
      ? {
          last: 'Last Name',
          first: 'First Name',
          w: 'w.',
          formal: 'Formal pts',
          content: 'Content pts',
          total: 'Total pts',
          max: 'Max pts',
          pct: 'Score (%)',
          veto: 'Zero Veto',
          grade: 'Grade',
          comment: 'Teacher Comment',
          summary: 'AI Feedback Summary',
          ungraded: 'Not graded',
          yes: 'YES',
          no: 'NO',
        }
      : language === 'pl'
      ? {
          last: 'Nazwisko',
          first: 'Imię',
          w: 'waga',
          formal: 'Punkty formalne',
          content: 'Punkty merytoryczne',
          total: 'Suma punktów',
          max: 'Maksimum punktów',
          pct: 'Wynik (%)',
          veto: 'Weto zerowe',
          grade: 'Ocena',
          comment: 'Komentarz nauczyciela',
          summary: 'Informacja zwrotna AI',
          ungraded: 'Nieoceniony',
          yes: 'TAK',
          no: 'NIE',
        }
      : {
          last: 'Příjmení',
          first: 'Křestní jméno',
          w: 'váha',
          formal: 'Formální body',
          content: 'Obsahové body',
          total: 'Celkem bodů',
          max: 'Maximum bodů',
          pct: 'Úspěšnost (%)',
          veto: 'Nulové veto',
          grade: 'Známka',
          comment: 'Komentář učitele',
          summary: 'AI Summary pro studenta',
          ungraded: 'Nehodnoceno',
          yes: 'ANO',
          no: 'NE',
        };

  const headers = [
    lbl.last,
    lbl.first,
    ...assignment.criteria.map((c) => `${c.name} (${lbl.w} ${c.weight}) [0-3]`),
    lbl.formal,
    lbl.content,
    lbl.total,
    lbl.max,
    lbl.pct,
    lbl.veto,
    lbl.grade,
    lbl.comment,
    lbl.summary,
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = students.map((s) => {
    const ev = evalMap.get(s.id);
    if (!ev) {
      return [
        s.lastName,
        s.firstName,
        ...assignment.criteria.map(() => ''),
        '',
        '',
        '',
        getMaxAssignmentPoints(assignment.criteria),
        '',
        '',
        lbl.ungraded,
        '',
        '',
      ].map(escapeCsv);
    }

    const res = computeEvaluationResult(assignment, ev.scores);
    return [
      s.lastName,
      s.firstName,
      ...assignment.criteria.map((c) => (ev.scores[c.id] !== undefined ? ev.scores[c.id] : '')),
      res.formalPoints,
      res.contentPoints,
      res.totalPoints,
      res.maxPoints,
      res.percentage,
      res.hasZeroVeto ? lbl.yes : lbl.no,
      res.grade,
      ev.teacherComment || '',
      ev.aiSummary || '',
    ].map(escapeCsv);
  });

  return '\ufeff' + [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.join(';'))].join('\n');
}
