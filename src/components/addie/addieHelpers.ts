import { AddieCycle, AddieProject, AddieStepKey, Language } from '../../types';
import { triggerBlobDownload } from '../../utils/clipboard';

export function getAddieStepCompletion(
  cycle: AddieCycle,
  project?: AddieProject
): Record<AddieStepKey, boolean> {
  const analysisDone = Boolean(
    cycle.analysis.designChallenge.trim() ||
      cycle.analysis.targetGroup.trim() ||
      cycle.analysis.priorKnowledgeAndContinuity.trim() ||
      cycle.analysis.availableResources.trim() ||
      cycle.analysis.competition.trim()
  );

  const designDone = Boolean(
    cycle.design.editedSolution.title.trim() ||
      cycle.design.editedSolution.summary.trim() ||
      cycle.design.editedSolution.pedagogicalRationale.trim() ||
      cycle.design.selectedOptionId
  );

  const developmentDone = Boolean(
    cycle.development.steps.length > 0 ||
      cycle.development.tools.length > 0 ||
      cycle.development.professions.length > 0 ||
      cycle.development.resourcesAllocation.trim() ||
      cycle.development.alignmentCheckNote.trim()
  );

  const implementationDone = Boolean(
    cycle.implementation.generatedArtifact.trim() ||
      cycle.implementation.artifactTitle.trim() ||
      cycle.implementation.implementationNotes.trim() ||
      cycle.implementation.finalMasterPrompt?.trim()
  );

  const evaluationDone = Boolean(
    cycle.evaluation.methods.some((m) => m.selected || m.title.trim()) ||
      cycle.evaluation.cycleReflection.trim() ||
      cycle.evaluation.nextCycleFocus.trim()
  );

  const visualizationDone = Boolean(
    cycle.implementation.finalMasterPrompt?.trim() ||
      (analysisDone && designDone && implementationDone && evaluationDone) ||
      (project && project.cycles.length > 1)
  );

  return {
    analysis: analysisDone,
    design: designDone,
    development: developmentDone,
    implementation: implementationDone,
    evaluation: evaluationDone,
    visualization: visualizationDone,
  };
}

export function buildStructuredMasterPrompt(
  cycle: AddieCycle,
  projectTitle: string,
  language: Language = 'cs'
): string {
  const sol = cycle.design.editedSolution;
  const selectedEval = (cycle.evaluation.methods || []).filter((m) => m.selected);
  const devSteps = cycle.development.steps || [];
  const isLesson = cycle.implementation.deliverableMode === 'classic_lesson';
  const totalCycles = cycle.analysis.plannedCycles || 1;

  const answeredQs = (cycle.implementation.refinementQuestions || [])
    .filter((q) => q.answer.trim())
    .map((q, idx) => `   ${idx + 1}. ${q.question}\n      -> ${q.answer}`)
    .join('\n');

  if (language === 'en') {
    const evalBlocks = selectedEval.length
      ? selectedEval
          .map(
            (m, i) =>
              `   ${i + 1}. ${m.title || 'Evaluation Instrument'} [${m.methodType || 'Formative'}]\n` +
              `      - What it measures: ${m.targetMetric || '-'}\n` +
              `      - Embedded feature inside the object: ${m.embeddedFeature || m.howToConduct || 'Interactive learner checkpoint + teacher summary export'}\n` +
              `      - Success threshold: ${m.successCriterion || '-'}`
          )
          .join('\n\n')
      : '   1. Built-in Pre/Post 3-item check + learner confidence pulse + JSON/text summary export for Cycle evaluation.';

    const stepBlocks = devSteps.length
      ? devSteps
          .map(
            (s) =>
              `   ${s.order}. ${s.title || 'Build Step'} (${s.duration || '-'})\n` +
              `      - Action: ${s.description || '-'}\n` +
              `      - Concrete deliverable: ${s.deliverable || '-'}`
          )
          .join('\n')
      : '   1. Lock core learning scenario\n   2. Build interactive UI & scaffolded tasks\n   3. Wire embedded evaluation instruments';

    return [
      `====================================================================`,
      `GOOGLE AI STUDIO MASTER PROMPT — ADDIE MODEL (CYCLE ${cycle.cycleNumber} OF ${totalCycles})`,
      `PROJECT: ${cycle.implementation.artifactTitle || sol.title || projectTitle}`,
      `====================================================================`,
      ``,
      `ROLE & BUILD INSTRUCTION`,
      isLesson
        ? `Create a complete, interactive digital companion app + facilitator toolkit (React + TypeScript + Tailwind CSS) that supports this classroom lesson and embeds all evaluation tools directly inside the interface.`
        : `Build a complete, production-ready interactive educational web application (React + TypeScript + Tailwind CSS) ready to run immediately, with all ADDIE stages and embedded evaluation instruments wired into the user experience.`,
      ``,
      `--------------------------------------------------------------------`,
      `STEP 1 (A — ANALYSIS): PROBLEM, AUDIENCE & CONSTRAINTS`,
      `--------------------------------------------------------------------`,
      `- Design Challenge & Goal: ${cycle.analysis.designChallenge || '(not specified yet)'}`,
      `- Target Group: ${cycle.analysis.targetGroup || '-'}`,
      `- Prior Knowledge & Continuity: ${cycle.analysis.priorKnowledgeAndContinuity || '-'}`,
      `- Available Resources & Constraints: ${cycle.analysis.availableResources || '-'}`,
      `- Edge Over Existing Competition: ${cycle.analysis.competition || '-'}`,
      ``,
      `--------------------------------------------------------------------`,
      `STEP 2 (D — DESIGN): PEDAGOGICAL ARCHITECTURE`,
      `--------------------------------------------------------------------`,
      `- Solution Name: ${sol.title || '-'}`,
      `- Pedagogical Approach / Archetype: ${sol.archetype || '-'}`,
      `- Core Mechanism: ${sol.summary || '-'}`,
      `- Pedagogical Rationale: ${sol.pedagogicalRationale || '-'}`,
      `- Flow / Structure Outline: ${sol.structureOutline || '-'}`,
      `- Key Features:`,
      ...(sol.keyFeatures || []).filter(Boolean).map((f, i) => `  ${i + 1}. ${f}`),
      ``,
      `--------------------------------------------------------------------`,
      `STEP 3 (D — DEVELOPMENT): ACTION STEPS, TOOLS & ROLES`,
      `--------------------------------------------------------------------`,
      `Build Sequence:`,
      stepBlocks,
      `- Tools & Stack: ${(cycle.development.tools || []).join(', ') || 'React, TypeScript, Tailwind CSS'}`,
      `- Team Roles / Perspectives Covered: ${(cycle.development.professions || []).join(', ') || 'Didactic Designer, Developer'}`,
      `- Resource Rule: ${cycle.development.resourcesAllocation || '-'}`,
      ``,
      `--------------------------------------------------------------------`,
      `STEP 4 (I — IMPLEMENTATION): FUNCTIONAL & INTERACTIVE SPECIFICATION`,
      `--------------------------------------------------------------------`,
      cycle.implementation.generatedArtifact || '(Draft implementation spec in Step 4)',
      ...(answeredQs ? ['', 'Creator Tuning Specifications (from Step 4 Dialog):', answeredQs] : []),
      ...(cycle.implementation.implementationNotes
        ? ['', `Deployment Notes: ${cycle.implementation.implementationNotes}`]
        : []),
      ``,
      `--------------------------------------------------------------------`,
      `STEP 5 (E — EVALUATION): TOOLS EMBEDDED DIRECTLY INSIDE THE OBJECT`,
      `--------------------------------------------------------------------`,
      `CRITICAL REQUIREMENT: Do NOT treat evaluation as an external PDF. Implement the following evaluation instruments directly inside the application UI (e.g., dedicated Evaluation/Telemetry drawer, built-in Pre/Post check, and Teacher/Cycle JSON & printable summary export):`,
      ``,
      evalBlocks,
      ...(cycle.evaluation.nextCycleFocus
        ? ['', `Priority Improvement Target for Cycle ${cycle.cycleNumber + 1}: ${cycle.evaluation.nextCycleFocus}`]
        : []),
      ``,
      `--------------------------------------------------------------------`,
      `STEP 6: UX, STRUCTURAL & VERIFICATION CHECKLIST FOR AI STUDIO`,
      `--------------------------------------------------------------------`,
      `1. Organize the app into clear, visible stages so any learner or teacher immediately sees what to do next.`,
      `2. Persist progress and evaluation responses in localStorage and provide a one-click Evaluation Report export (JSON / copy summary) for the next ADDIE iteration.`,
      `3. Ensure full light/dark legibility, responsive layout, clean typography, and zero non-functional placeholder controls.`,
    ].join('\n');
  }

  if (language === 'pl') {
    const evalBlocks = selectedEval.length
      ? selectedEval
          .map(
            (m, i) =>
              `   ${i + 1}. ${m.title || 'Narzędzie ewaluacyjne'} [${m.methodType || 'Formatywne'}]\n` +
              `      - Co mierzy: ${m.targetMetric || '-'}\n` +
              `      - Funkcja wbudowana bezpośrednio w obiekt: ${m.embeddedFeature || m.howToConduct || 'Wbudowany punkt kontrolny + eksport raportu z cyklu'}\n` +
              `      - Kryterium sukcesu: ${m.successCriterion || '-'}`
          )
          .join('\n\n')
      : '   1. Wbudowany mikro-test Pre/Post + szybka ankieta zrozumiałości + eksport raportu JSON/tekst dla kolejnego cyklu.';

    const stepBlocks = devSteps.length
      ? devSteps
          .map(
            (s) =>
              `   ${s.order}. ${s.title || 'Krok'} (${s.duration || '-'})\n` +
              `      - Działanie: ${s.description || '-'}\n` +
              `      - Rezultat: ${s.deliverable || '-'}`
          )
          .join('\n')
      : '   1. Zdefiniowanie scenariusza dydaktycznego\n   2. Budowa interaktywnego prototypu\n   3. Wbudowanie modułu ewaluacji';

    return [
      `====================================================================`,
      `GŁÓWNY PROMPT DO GOOGLE AI STUDIO — MODEL ADDIE (CYKL ${cycle.cycleNumber} Z ${totalCycles})`,
      `PROJEKT: ${cycle.implementation.artifactTitle || sol.title || projectTitle}`,
      `====================================================================`,
      ``,
      `ROLA I CEL WDROŻENIA`,
      isLesson
        ? `Stwórz interaktywną aplikację towarzyszącą dla nauczyciela i uczniów (React + TypeScript + Tailwind CSS), która wspiera poniższy scenariusz lekcji i ma bezpośrednio wbudowane narzędzia ewaluacyjne.`
        : `Zbuduj kompletną, gotową do uruchomienia interaktywną aplikację edukacyjną (React + TypeScript + Tailwind CSS), która realizuje wszystkie etapy modelu ADDIE i ma bezpośrednio wbudowane narzędzia ewaluacji.`,
      ``,
      `--------------------------------------------------------------------`,
      `KROK 1 (A — ANALIZA): WYZWANIE, GRUPA DOCELOWA I OGRANICZENIA`,
      `--------------------------------------------------------------------`,
      `- Wyzwanie projektowe i cel: ${cycle.analysis.designChallenge || '(nie wypełniono)'}`,
      `- Grupa docelowa: ${cycle.analysis.targetGroup || '-'}`,
      `- Wiedza wstępna i ciągłość: ${cycle.analysis.priorKnowledgeAndContinuity || '-'}`,
      `- Dostępne zasoby: ${cycle.analysis.availableResources || '-'}`,
      `- Przewaga nad konkurencją: ${cycle.analysis.competition || '-'}`,
      ``,
      `--------------------------------------------------------------------`,
      `KROK 2 (D — PROJEKTOWANIE): ARCHITEKTURA DYDAKTYCZNA`,
      `--------------------------------------------------------------------`,
      `- Nazwa rozwiązania: ${sol.title || '-'}`,
      `- Podejście / archetyp: ${sol.archetype || '-'}`,
      `- Główny mechanizm: ${sol.summary || '-'}`,
      `- Uzasadnienie dydaktyczne: ${sol.pedagogicalRationale || '-'}`,
      `- Struktura / przebieg: ${sol.structureOutline || '-'}`,
      `- Kluczowe elementy:`,
      ...(sol.keyFeatures || []).filter(Boolean).map((f, i) => `  ${i + 1}. ${f}`),
      ``,
      `--------------------------------------------------------------------`,
      `KROK 3 (D — ROZWÓJ): KOLEJNE KROKI, NARZĘDZIA I ROLE`,
      `--------------------------------------------------------------------`,
      `Plan realizacji:`,
      stepBlocks,
      `- Narzędzia i technologie: ${(cycle.development.tools || []).join(', ') || 'React, TypeScript, Tailwind CSS'}`,
      `- Role i profesje: ${(cycle.development.professions || []).join(', ') || 'Projektant dydaktyczny, Programista'}`,
      `- Zasady użycia zasobów: ${cycle.development.resourcesAllocation || '-'}`,
      ``,
      `--------------------------------------------------------------------`,
      `KROK 4 (I — WDROŻENIE): SPECYFIKACJA FUNKCJONALNA`,
      `--------------------------------------------------------------------`,
      cycle.implementation.generatedArtifact || '(Uzupełnij lub wygeneruj treść w Kroku 4)',
      ...(answeredQs ? ['', 'Doprecyzowania autora z dialogu (Krok 4):', answeredQs] : []),
      ...(cycle.implementation.implementationNotes
        ? ['', `Notatki wdrożeniowe: ${cycle.implementation.implementationNotes}`]
        : []),
      ``,
      `--------------------------------------------------------------------`,
      `KROK 5 (E — EWALUACJA): NARZĘDZIA WBUDOWANE BEZPOŚREDNIO W OBIEKT`,
      `--------------------------------------------------------------------`,
      `KLUCZOWE WYMAGANIE: Ewaluacja NIE jest oddzielnym dokumentem — zaimplementuj poniższe instrumenty ewaluacyjne bezpośrednio w interfejsie aplikacji (np. zakładka Ewaluacja, wbudowany test Pre/Post, zapis interakcji oraz eksport raportu dla prowadzącego):`,
      ``,
      evalBlocks,
      ...(cycle.evaluation.nextCycleFocus
        ? ['', `Priorytet na Cykl ${cycle.cycleNumber + 1}: ${cycle.evaluation.nextCycleFocus}`]
        : []),
      ``,
      `--------------------------------------------------------------------`,
      `KROK 6: CHECKLISTA JAKOŚCI I ITERACJI DLA GOOGLE AI STUDIO`,
      `--------------------------------------------------------------------`,
      `1. Wyraźnie oddziel poszczególne kroki pracy użytkownika, aby zawsze wiedział, co ma zrobić dalej.`,
      `2. Zapisuj postępy i dane ewaluacyjne w localStorage oraz udostępnij eksport wyników (JSON / podsumowanie tekstowe) do kolejnego cyklu ADDIE.`,
      `3. Zapewnij tryb jasny i ciemny, przejrzystą typografię oraz brak niedziałających przycisków.`,
    ].join('\n');
  }

  // Czech (default)
  const evalBlocks = selectedEval.length
    ? selectedEval
        .map(
          (m, i) =>
            `   ${i + 1}. ${m.title || 'Evaluační nástroj'} [${m.methodType || 'Formativní'}]\n` +
            `      - Co sleduje/měří: ${m.targetMetric || '-'}\n` +
            `      - Přímá implementace uvnitř objektu: ${m.embeddedFeature || m.howToConduct || 'Vestavěný kontrolní bod pro studenta + souhrnný export pro učitele'}\n` +
            `      - Měřitelné kritérium úspěchu: ${m.successCriterion || '-'}`
        )
        .join('\n\n')
    : '   1. Vestavěný vstupní/výstupní mikro-test (Pre/Post), rychlý ukazatel srozumitelnosti na konci aktivity a export dat z evaluace pro další cyklus.';

  const stepBlocks = devSteps.length
    ? devSteps
        .map(
          (s) =>
            `   ${s.order}. ${s.title || 'Krok vývoje'} (${s.duration || '-'})\n` +
            `      - Akce: ${s.description || '-'}\n` +
            `      - Výstup kroku: ${s.deliverable || '-'}`
        )
        .join('\n')
    : '   1. Uzamčení výukového scénáře\n   2. Sestavení funkčního prototypu\n   3. Zapojení vestavěných evaluačních nástrojů';

  return [
    `====================================================================`,
    `KOMPLETNÍ ZADÁNÍ (PROMPT) PRO GOOGLE AI STUDIO — MODEL ADDIE (${cycle.cycleNumber}. Z ${totalCycles} CYKLŮ)`,
    `PROJEKT: ${cycle.implementation.artifactTitle || sol.title || projectTitle}`,
    `====================================================================`,
    ``,
    `ROLE A HLAVNÍ CÍL`,
    isLesson
      ? `Vytvoř přehlednou interaktivní webovou aplikaci jako digitální podporu a evaluační doprovod pro tuto vyučovací lekci (React + TypeScript + Tailwind CSS), kde jsou všechny vybrané evaluační nástroje zabudované přímo uvnitř aplikace.`
      : `Vytvoř kompletní, okamžitě funkční interaktivní webový vzdělávací objekt (React + TypeScript + Tailwind CSS), který přesně naplňuje všechny fáze modelu ADDIE a má vybrané evaluační nástroje implementované přímo ve svém uživatelském rozhraní.`,
    ``,
    `--------------------------------------------------------------------`,
    `KROK 1 (A — ANALÝZA): VÝZVA, CÍLOVÁ SKUPINA A LIMITY`,
    `--------------------------------------------------------------------`,
    `- Designová výzva a co vyvinout: ${cycle.analysis.designChallenge || '(zatím nevyplněno)'}`,
    `- Cílová skupina: ${cycle.analysis.targetGroup || '-'}`,
    `- Vstupní znalosti a návaznost: ${cycle.analysis.priorKnowledgeAndContinuity || '-'}`,
    `- Dostupné zdroje a omezení: ${cycle.analysis.availableResources || '-'}`,
    `- Odlišení od konkurence: ${cycle.analysis.competition || '-'}`,
    ``,
    `--------------------------------------------------------------------`,
    `KROK 2 (D — NÁVRH): DIDAKTICKÁ ARCHITEKTURA ŘEŠENÍ`,
    `--------------------------------------------------------------------`,
    `- Název zvoleného řešení: ${sol.title || '-'}`,
    `- Didaktický přístup / forma: ${sol.archetype || '-'}`,
    `- Hlavní princip řešení: ${sol.summary || '-'}`,
    `- Pedagogické zdůvodnění: ${sol.pedagogicalRationale || '-'}`,
    `- Navržená struktura / scénář: ${sol.structureOutline || '-'}`,
    `- Klíčové funkční prvky:`,
    ...(sol.keyFeatures || []).filter(Boolean).map((f, i) => `  ${i + 1}. ${f}`),
    ``,
    `--------------------------------------------------------------------`,
    `KROK 3 (D — VÝVOJ): REALIZAČNÍ KROKY, NÁSTROJE A ROLE`,
    `--------------------------------------------------------------------`,
    `Postup výstavby (krok za krokem):`,
    stepBlocks,
    `- Použité nástroje a technologie: ${(cycle.development.tools || []).join(', ') || 'React, TypeScript, Tailwind CSS'}`,
    `- Zajištěné profese / role: ${(cycle.development.professions || []).join(', ') || 'Didaktik, Vývojář'}`,
    `- Pravidlo práce se zdroji: ${cycle.development.resourcesAllocation || '-'}`,
    ``,
    `--------------------------------------------------------------------`,
    `KROK 4 (I — IMPLEMENTACE): PŘESNÁ SPECIFIKACE CHOVÁNÍ A OBSAHU`,
    `--------------------------------------------------------------------`,
    cycle.implementation.generatedArtifact || '(Zadání z kroku 4 nebylo dosud vygenerováno — doplňte v kroku Implementace.)',
    ...(answeredQs ? ['', 'Doplněná upřesnění z ladicího dialogu (Krok 4):', answeredQs] : []),
    ...(cycle.implementation.implementationNotes
      ? ['', `Poznámky k nasazení a pilotáži: ${cycle.implementation.implementationNotes}`]
      : []),
    ``,
    `--------------------------------------------------------------------`,
    `KROK 5 (E — EVALUACE): NÁSTROJE IMPLEMENTOVANÉ PŘÍMO DO OBJEKTU`,
    `--------------------------------------------------------------------`,
    `DŮLEŽITÝ POŽADAVEK: Evaluace NESMÍ být jen externí papírový dodatek. Implementuj všechny následující evaluační nástroje přímo jako součást vyvíjeného objektu (např. jako přepínatelný panel „Evaluace & Data pro učitele“, vestavěné diagnostické mikro-úkoly a tlačítko pro stažení anonymizovaného evaluačního výstupu v JSON/textu):`,
    ``,
    evalBlocks,
    ...(cycle.evaluation.nextCycleFocus
      ? ['', `Prioritní zaměření pro ${cycle.cycleNumber + 1}. iterační cyklus: ${cycle.evaluation.nextCycleFocus}`]
      : []),
    ``,
    `--------------------------------------------------------------------`,
    `KROK 6: CHECKLIST PRO GOOGLE AI STUDIO (ABY VÝSTUP HNED FUNGOVAL)`,
    `--------------------------------------------------------------------`,
    `1. Rozděl aplikaci do jasně oddělených, srozumitelných kroků s vizuálním potvrzením splnění (zelené zvýraznění dokončeného kroku), aby uživatel přesně věděl, co má dělat.`,
    `2. Ukládej interakce studenta i nasbíraná evaluační data do localStorage a nabídni jedno kliknutí pro export výsledků evaluace (JSON nebo čitelný souhrn) zpět do dalšího ADDIE cyklu.`,
    `3. Dodrž čisté responzivní rozhraní pro světlý i tmavý režim, přehlednou typografii a 100% funkční ovládací prvky bez maket.`,
  ].join('\n');
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  triggerBlobDownload(filename, content, mimeType);
}
