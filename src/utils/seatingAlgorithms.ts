import { Student, ClassroomConfig, SeatingPairRule, DeskSlot, StudentCorrelation, Language } from '../types';

// Calculate student average grade across selected subject or all subjects
export function getStudentAverage(student: Student, subject: string = 'all'): number {
  if (subject !== 'all' && student.grades[subject]) {
    const list = student.grades[subject];
    if (list.length === 0) return 2.0;
    const sum = list.reduce((a, b) => a + b, 0);
    return Number((sum / list.length).toFixed(2));
  }

  // Cross-subject average
  const allGrades = Object.values(student.grades).flat();
  if (allGrades.length === 0) return 2.0;
  const sum = allGrades.reduce((a, b) => a + b, 0);
  return Number((sum / allGrades.length).toFixed(2));
}

// Sort students alphabetically strictly by SURNAME (příjmení)
export function sortStudentsByLastName(students: Student[]): Student[] {
  return [...students].sort((a, b) =>
    a.lastName.localeCompare(b.lastName, 'cs', { sensitivity: 'base' })
  );
}

// Generate desks based on classroom layout
export function generateEmptyDesks(config: ClassroomConfig): DeskSlot[] {
  const desks: DeskSlot[] = [];

  if (config.layout === 'standard') {
    // Standard: rows x cols of 2-seat desks (default 5 rows x 3 cols = 15 desks = 30 seats)
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        desks.push({
          deskId: `desk_r${r}_c${c}`,
          row: r,
          col: c,
          studentIds: [null, null],
        });
      }
    }
  } else if (config.layout === 'clusters') {
    // Clusters / Hnízda: Pods of 4 students (2 desks combined)
    // 2 clusters per row, config.rows rows
    const clusterCols = Math.max(2, Math.floor(config.cols * 0.7));
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < clusterCols; c++) {
        desks.push({
          deskId: `cluster_r${r}_c${c}`,
          row: r,
          col: c,
          studentIds: [null, null, null, null],
        });
      }
    }
  } else if (config.layout === 'u_shape') {
    // U-Shape: outer perimeter desks with open side at blackboard (front)
    // Left wing (cols 0, rows 1..N-1)
    // Rear back row (row N-1, cols 0..cols-1)
    // Right wing (col cols-1, rows 1..N-1)
    const uRows = Math.max(4, config.rows);
    const uCols = Math.max(4, config.cols);

    // Left wing (facing inwards)
    for (let r = 0; r < uRows; r++) {
      desks.push({
        deskId: `u_left_r${r}`,
        row: r,
        col: 0,
        studentIds: [null, null],
      });
    }

    // Bottom rear wing
    for (let c = 1; c < uCols - 1; c++) {
      desks.push({
        deskId: `u_back_c${c}`,
        row: uRows - 1,
        col: c,
        studentIds: [null, null],
      });
    }

    // Right wing (facing inwards)
    for (let r = 0; r < uRows; r++) {
      desks.push({
        deskId: `u_right_r${r}`,
        row: r,
        col: uCols - 1,
        studentIds: [null, null],
      });
    }
  }

  return desks;
}

// Pedagogical seating algorithm:
// 1. Higher grade averages (worse grades in 1-5 scale) go to front rows (row 0, row 1...).
// 2. Boy + Girl paired together if enforceBoyGirl is true.
// 3. Positive pairs (buddies) seated together.
// 4. Negative pairs never seated in the same desk.
// 5. No student left completely alone in a desk if another student can share.
export function generateOptimalSeating(
  students: Student[],
  config: ClassroomConfig,
  rules: SeatingPairRule[],
  subject: string = 'all'
): DeskSlot[] {
  const desks = generateEmptyDesks(config);
  if (students.length === 0) return desks;

  const studentMap = new Map(students.map((s) => [s.id, s]));
  const assigned = new Set<string>();

  // Helper: check if two students can sit together
  const canPairTogether = (s1Id: string, s2Id: string) => {
    // Check negative rules
    const hasNegative = rules.some(
      (r) =>
        r.type === 'negative' &&
        ((r.student1Id === s1Id && r.student2Id === s2Id) ||
          (r.student1Id === s2Id && r.student2Id === s1Id))
    );
    if (hasNegative) return false;

    // Check gender constraint
    if (config.enforceBoyGirl) {
      const s1 = studentMap.get(s1Id);
      const s2 = studentMap.get(s2Id);
      if (s1 && s2 && s1.gender === s2.gender) {
        return false;
      }
    }
    return true;
  };

  // Helper: check if two students MUST sit together
  const mustPairTogether = (s1Id: string, s2Id: string) => {
    return rules.some(
      (r) =>
        r.type === 'positive' &&
        ((r.student1Id === s1Id && r.student2Id === s2Id) ||
          (r.student1Id === s2Id && r.student2Id === s1Id))
    );
  };

  // Sort students by average descending (5.0 worse first -> placed in front rows)
  const sortedStudents = [...students].sort((a, b) => {
    const avgA = getStudentAverage(a, subject);
    const avgB = getStudentAverage(b, subject);
    return avgB - avgA; // worse grades (higher numbers) first
  });

  // Collect positive buddy pairs first
  const fixedPairs: [Student, Student][] = [];
  for (const rule of rules) {
    if (rule.type === 'positive') {
      const s1 = studentMap.get(rule.student1Id);
      const s2 = studentMap.get(rule.student2Id);
      if (s1 && s2 && !assigned.has(s1.id) && !assigned.has(s2.id)) {
        fixedPairs.push([s1, s2]);
        assigned.add(s1.id);
        assigned.add(s2.id);
      }
    }
  }

  // Sort desks: front rows first (row 0 closest to blackboard)
  desks.sort((a, b) => a.row - b.row);

  let deskIdx = 0;

  // 1. Place fixed buddy pairs in desks according to their combined average
  fixedPairs.sort((pairA, pairB) => {
    const avgA = (getStudentAverage(pairA[0], subject) + getStudentAverage(pairA[1], subject)) / 2;
    const avgB = (getStudentAverage(pairB[0], subject) + getStudentAverage(pairB[1], subject)) / 2;
    return avgB - avgA;
  });

  for (const [s1, s2] of fixedPairs) {
    while (deskIdx < desks.length && desks[deskIdx].studentIds.filter((id) => id !== null).length > 0) {
      deskIdx++;
    }
    if (deskIdx < desks.length) {
      desks[deskIdx].studentIds[0] = s1.id;
      desks[deskIdx].studentIds[1] = s2.id;
      deskIdx++;
    }
  }

  // 2. Pair remaining students
  const remaining = sortedStudents.filter((s) => !assigned.has(s.id));
  const boys = remaining.filter((s) => s.gender === 'M');
  const girls = remaining.filter((s) => s.gender === 'F');

  // Fill desks row by row
  for (const desk of desks) {
    const capacity = desk.studentIds.length;
    let occupied = desk.studentIds.filter((id) => id !== null).length;

    while (occupied < capacity) {
      let chosen: Student | null = null;

      if (config.enforceBoyGirl) {
        // Look at current desk occupant
        const currentOccupantId = desk.studentIds[0];
        const currentOccupant = currentOccupantId ? studentMap.get(currentOccupantId) : null;

        if (!currentOccupant) {
          // First in desk: pick from the gender with more remaining students
          const pool = boys.length >= girls.length ? boys : girls;
          chosen = pool.shift() || (pool === boys ? girls.shift() : boys.shift()) || null;
        } else {
          // Must pair with opposite gender if available
          const pool = currentOccupant.gender === 'M' ? girls : boys;
          // Find first candidate that doesn't violate negative pairing
          const candidateIdx = pool.findIndex((cand) => canPairTogether(currentOccupant.id, cand.id));
          if (candidateIdx >= 0) {
            chosen = pool.splice(candidateIdx, 1)[0];
          } else {
            // Fallback: take from opposite or any
            chosen = pool.shift() || (pool === boys ? girls.shift() : boys.shift()) || null;
          }
        }
      } else {
        // Enforce boy/girl is OFF: pick next student with worst average
        // Ensure no negative pairing
        const firstOccupantId = desk.studentIds[0];
        if (firstOccupantId) {
          const idx = remaining.findIndex(
            (cand) => !assigned.has(cand.id) && canPairTogether(firstOccupantId, cand.id)
          );
          if (idx >= 0) {
            chosen = remaining.splice(idx, 1)[0];
          }
        }
        if (!chosen) {
          const idx = remaining.findIndex((cand) => !assigned.has(cand.id));
          if (idx >= 0) {
            chosen = remaining.splice(idx, 1)[0];
          }
        }
      }

      if (!chosen) break;

      // Assign to first open slot in desk
      const openSlot = desk.studentIds.indexOf(null);
      if (openSlot >= 0) {
        desk.studentIds[openSlot] = chosen.id;
        assigned.add(chosen.id);
        occupied++;
      } else {
        break;
      }
    }
  }

  // Post-check: ensure no student sits alone if another desk can be condensed
  ensureNoLonelyStudents(desks);

  return desks;
}

// Randomize seating for exams or spontaneous activities
export function generateRandomSeating(students: Student[], config: ClassroomConfig): DeskSlot[] {
  const desks = generateEmptyDesks(config);
  if (students.length === 0) return desks;

  const shuffled = [...students].sort(() => Math.random() - 0.5);
  let studentIdx = 0;

  for (const desk of desks) {
    for (let s = 0; s < desk.studentIds.length; s++) {
      if (studentIdx < shuffled.length) {
        desk.studentIds[s] = shuffled[studentIdx].id;
        studentIdx++;
      } else {
        desk.studentIds[s] = null;
      }
    }
  }

  return desks;
}

// Ensure no student sits alone in a 2-person desk if an empty slot exists elsewhere
function ensureNoLonelyStudents(desks: DeskSlot[]) {
  const lonelyDesks = desks.filter(
    (d) => d.studentIds.filter((id) => id !== null).length === 1 && d.studentIds.length === 2
  );
  if (lonelyDesks.length >= 2) {
    // Pair two lonely students together!
    const d1 = lonelyDesks[0];
    const d2 = lonelyDesks[1];
    const studentToMove = d2.studentIds[0] || d2.studentIds[1];
    if (studentToMove) {
      d1.studentIds[1] = studentToMove;
      d2.studentIds[0] = null;
      d2.studentIds[1] = null;
    }
  }
}

// Split class 50:50 primarily alphabetical by surname with gender balance & buddy constraints
export function splitClassIntoTwoGroups(
  students: Student[],
  rules: SeatingPairRule[]
): { group1: Student[]; group2: Student[] } {
  // Sort alphabetically strictly by SURNAME
  const sorted = sortStudentsByLastName(students);

  const group1: Student[] = [];
  const group2: Student[] = [];
  const assigned = new Set<string>();

  // Respect positive buddy pairs: they must be in the same group!
  for (const rule of rules) {
    if (rule.type === 'positive') {
      const s1 = sorted.find((s) => s.id === rule.student1Id);
      const s2 = sorted.find((s) => s.id === rule.student2Id);
      if (s1 && s2 && !assigned.has(s1.id) && !assigned.has(s2.id)) {
        if (group1.length <= group2.length) {
          group1.push(s1, s2);
        } else {
          group2.push(s1, s2);
        }
        assigned.add(s1.id);
        assigned.add(s2.id);
      }
    }
  }

  // Distribute remaining with gender balancing and alphabetical order
  const remainingBoys = sorted.filter((s) => !assigned.has(s.id) && s.gender === 'M');
  const remainingGirls = sorted.filter((s) => !assigned.has(s.id) && s.gender === 'F');

  let targetGroup1 = true;
  while (remainingBoys.length > 0 || remainingGirls.length > 0) {
    const target = targetGroup1 ? group1 : group2;
    // Balance genders
    const g1Boys = group1.filter((s) => s.gender === 'M').length;
    const g2Boys = group2.filter((s) => s.gender === 'M').length;

    let picked: Student | undefined;
    if (g1Boys <= g2Boys && remainingBoys.length > 0) {
      picked = remainingBoys.shift();
    } else if (remainingGirls.length > 0) {
      picked = remainingGirls.shift();
    } else {
      picked = remainingBoys.shift();
    }

    if (picked) {
      target.push(picked);
      assigned.add(picked.id);
    }
    targetGroup1 = !targetGroup1;
  }

  return {
    group1: sortStudentsByLastName(group1),
    group2: sortStudentsByLastName(group2),
  };
}

// Compute Pearson correlation between row index (distance from blackboard) and student average grade
export function computeSeatingCorrelation(
  desks: DeskSlot[],
  students: Student[],
  subject: string = 'all',
  language: Language = 'cs'
): {
  pearsonR: number;
  correlations: StudentCorrelation[];
  frontRowAvg: number;
  backRowAvg: number;
  interpretation: string;
} {
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const points: { row: number; avg: number; studentId: string; name: string }[] = [];

  for (const desk of desks) {
    for (const sid of desk.studentIds) {
      if (sid && studentMap.has(sid)) {
        const student = studentMap.get(sid)!;
        const avg = getStudentAverage(student, subject);
        points.push({
          row: desk.row + 1, // 1 to N
          avg,
          studentId: sid,
          name: `${student.lastName} ${student.firstName}`,
        });
      }
    }
  }

  if (points.length < 2) {
    return {
      pearsonR: 0,
      correlations: [],
      frontRowAvg: 0,
      backRowAvg: 0,
      interpretation:
        language === 'pl'
          ? 'Zbyt mało danych do obliczenia korelacji.'
          : language === 'en'
          ? 'Not enough data to compute correlation.'
          : 'Nedostatek dat pro výpočet korelace.',
    };
  }

  const n = points.length;
  const meanX = points.reduce((acc, p) => acc + p.row, 0) / n;
  const meanY = points.reduce((acc, p) => acc + p.avg, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (const p of points) {
    const dx = p.row - meanX;
    const dy = p.avg - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const denom = Math.sqrt(denX * denY);
  const r = denom === 0 ? 0 : Number((num / denom).toFixed(3));

  const frontRowPoints = points.filter((p) => p.row <= 2);
  const backRowPoints = points.filter((p) => p.row >= 3);

  const frontRowAvg =
    frontRowPoints.length > 0
      ? Number((frontRowPoints.reduce((acc, p) => acc + p.avg, 0) / frontRowPoints.length).toFixed(2))
      : 0;
  const backRowAvg =
    backRowPoints.length > 0
      ? Number((backRowPoints.reduce((acc, p) => acc + p.avg, 0) / backRowPoints.length).toFixed(2))
      : 0;

  const correlations: StudentCorrelation[] = points.map((p) => {
    let level: 'front_higher_need' | 'balanced' | 'rear_high_performer' = 'balanced';
    if (p.row <= 2 && p.avg >= 2.5) {
      level = 'front_higher_need';
    } else if (p.row >= 3 && p.avg <= 2.0) {
      level = 'rear_high_performer';
    }
    return {
      studentId: p.studentId,
      name: p.name,
      averageGrade: p.avg,
      distanceFromBoard: p.row,
      correlationLevel: level,
    };
  });

  let interpretation = '';
  if (r < -0.3) {
    interpretation =
      language === 'pl'
        ? 'Silna ujemna korelacja: uczniowie wymagający większego wsparcia (wyższa średnia ocen) siedzą w przednich rzędach blisko tablicy, zgodnie z celem dydaktycznym.'
        : language === 'en'
        ? 'Strong negative correlation: students needing more support sit closer to the front board, matching the instructional goal.'
        : 'Silná negativní korelace: Studenti s vyšší potřebou podpory (horším průměrem) sedí v předních řadách u tabule, což odpovídá didaktickému záměru.';
  } else if (r > 0.3) {
    interpretation =
      language === 'pl'
        ? 'Dodatnia korelacja: w przednich rzędach siedzą raczej uczniowie z lepszymi wynikami. Rozważ przesunięcie osób potrzebujących wsparcia bliżej tablicy.'
        : language === 'en'
        ? 'Positive correlation: higher-performing students occupy the front rows. Consider moving students needing support closer to the board.'
        : 'Pozitivní korelace: V předních řadách sedí spíše žáci s lepším prospěchem. Zvažte posunutí žáků vyžadujících dopomoc blíže k tabuli.';
  } else {
    interpretation =
      language === 'pl'
        ? 'Zrównoważone rozmieszczenie: wyniki uczniów są rozłożone równomiernie w przestrzeni sali.'
        : language === 'en'
        ? 'Balanced distribution: academic averages are evenly distributed across the classroom.'
        : 'Vyvážené rozmístění: Prospěch žáků je rovnoměrně rozprostřen napříč prostorem učebny.';
  }

  return {
    pearsonR: r,
    correlations,
    frontRowAvg,
    backRowAvg,
    interpretation,
  };
}

// Heatmap color generator based on desk grade average
export function getDeskHeatmapStyle(deskAvg: number | null, isDark: boolean = false): {
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
} {
  if (deskAvg === null) {
    return {
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.6)',
      borderColor: isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)',
      labelColor: isDark ? '#94a3b8' : '#64748b',
    };
  }

  // 1.0 (best) -> 5.0 (worst)
  if (deskAvg <= 1.8) {
    // Green / Emerald
    return {
      backgroundColor: isDark ? 'rgba(6, 95, 70, 0.35)' : 'rgba(209, 250, 229, 0.75)',
      borderColor: isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(52, 211, 153, 0.8)',
      labelColor: isDark ? '#6ee7b7' : '#065f46',
    };
  } else if (deskAvg <= 2.8) {
    // Amber / Yellow
    return {
      backgroundColor: isDark ? 'rgba(146, 64, 14, 0.35)' : 'rgba(254, 243, 199, 0.75)',
      borderColor: isDark ? 'rgba(245, 158, 11, 0.6)' : 'rgba(251, 191, 36, 0.8)',
      labelColor: isDark ? '#fde68a' : '#92400e',
    };
  } else {
    // Coral / Warm Red
    return {
      backgroundColor: isDark ? 'rgba(153, 27, 27, 0.35)' : 'rgba(254, 226, 226, 0.75)',
      borderColor: isDark ? 'rgba(239, 68, 68, 0.6)' : 'rgba(248, 113, 113, 0.8)',
      labelColor: isDark ? '#fca5a5' : '#991b1b',
    };
  }
}
