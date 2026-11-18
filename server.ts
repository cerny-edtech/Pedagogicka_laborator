import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// Server-side GoogleGenAI initialization
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

function safeParseGeminiJson<T>(rawText: string | undefined | null, fallback: T): T {
  const raw = (rawText || '').trim();
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstObj = cleaned.indexOf('{');
    const lastObj = cleaned.lastIndexOf('}');
    const firstArr = cleaned.indexOf('[');
    const lastArr = cleaned.lastIndexOf(']');
    let slice = '';
    if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj) && lastArr > firstArr) {
      slice = cleaned.slice(firstArr, lastArr + 1);
    } else if (firstObj !== -1 && lastObj > firstObj) {
      slice = cleaned.slice(firstObj, lastObj + 1);
    }
    if (slice) {
      try {
        return JSON.parse(slice) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

// Health / status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey),
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: Creative Spark / Academic Creativity Insight
app.post('/api/gemini/creativity-spark', async (req, res) => {
  const { language = 'cs', theme, entrySummary } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  if (!ai) {
    const fallbackSparks: Record<string, string[]> = {
      cs: [
        'Akademický výzkum Teresy Amabile ukazuje, že vnitřní motivace a pocit bezpečí před hodnocením jsou klíčové pro tvůrčí odvahu. Zkuste se dnes zaměřit na to, co děláte čistě pro radost z procesu.',
        'Podle konceptu laterálního myšlení Edwarda de Bono vznikají nejoriginálnější nápady náhodným spojením dvou nesouvisejících pojmů. Vezměte svůj dnešní problém a propojte ho s libovolným předmětem ve třídě.',
        'J. P. Guilford rozdělil myšlení na konvergentní (hledání jedné správné odpovědi) a divergentní (generování mnoha alternativ). Ve vzdělávání často příliš brzy přepínáme do konvergence – dejte svým myšlenkám prostor se rozvinout.',
        'Mihaly Csikszentmihalyi popsal stav „Flow“ jako rovnováhu mezi náročností výzvy a dovednostmi člověka. Kdy jste dnes zažili okamžik, kdy jste ztratili pojem o čase?',
      ],
      en: [
        "Teresa Amabile's research demonstrates that intrinsic motivation and freedom from premature evaluation are critical for creative breakthroughs. What task today brought you genuine joy simply in the process?",
        "According to Edward de Bono's lateral thinking framework, our minds naturally follow established patterns. Break the pattern by linking your main challenge today to an unrelated everyday object.",
        'J. P. Guilford distinguished convergent from divergent thinking. In education, we often rush to convergent judgment. Give your intuition space to branch out into multiple playful avenues.',
      ],
      pl: [
        'Badania Teresy Amabile dowodzą, że wewnętrzna motywacja i brak przedwczesnej oceny stanowią fundament odwagi twórczej. Na czym polegało Twoje dzisiejsze doświadczenie czystej radości tworzenia?',
        'Zgodnie z koncepcją myślenia lateralnego Edwarda de Bono, najbardziej innowacyjne pomysły rodzą się z nieoczekiwanych powiązań. Połącz dzisiejsze wyzwanie z losowym przedmiotem z otoczenia.',
      ],
    };
    const list = fallbackSparks[language] || fallbackSparks.cs;
    const randomSpark = list[Math.floor(Math.random() * list.length)];
    return res.json({ spark: randomSpark, source: 'curated' });
  }

  try {
    const prompt = `Jsi pedagogický a psychologický mentor pro studenty učitelství. 
Vygeneruj inspirativní tvůrčí impuls / výzvu / poznatek z akademického výzkumu kreativity (např. Guilford, Torrance, Amabile, Csikszentmihalyi, De Bono, Sternberg, Runco).
Výstup musí být přesně jeden čtivý odstavec (cca 3-5 vět). 
Odpověz v jazyce: ${langName}.
${theme ? `Kontext / téma dne: ${theme}` : ''}
${entrySummary ? `Uživatel dnes reflektoval: ${entrySummary}` : ''}
Představ stručně myšlenku z výzkumu a přidej konkrétní otázku nebo malý podnět k zamyšlení pro učitele/pedagoga.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    const spark = response.text?.trim() || '';
    return res.json({ spark, source: 'gemini' });
  } catch (err: any) {
    console.error('Gemini spark error:', err);
    return res.json({
      spark:
        language === 'pl'
          ? 'Kreatywność rozwija się w atmosferze otwartości i dociekliwości. Zadaj sobie pytanie: co w dzisiejszym dniu mogło potoczyć się zupełnie inaczej?'
          : language === 'en'
          ? 'Creativity flourishes when we tolerate ambiguity and explore alternative interpretations. What moment today held an unexpected perspective?'
          : 'Kreativita vzkvétá v prostředí tolerance k nejistotě a chybám. Položte si otázku: co v dnešním dni skrývalo nečekanou příležitost k jinému pohledu na věc?',
      source: 'fallback',
    });
  }
});

// Endpoint: Journal Reflection Analysis
app.post('/api/gemini/reflect', async (req, res) => {
  const { entries, timeRange, language = 'cs', customQuestion } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'No entries provided' });
  }

  if (!ai) {
    const summaryText =
      language === 'pl'
        ? `Przeanalizowano ${entries.length} wpisów z okresu (${timeRange}). Zauważalna jest wysoka refleksyjność w obszarze emocji i relacji społecznych. Wpisy wykazują rosnącą wrażliwość na drobne sukcesy pedagogiczne.`
        : language === 'en'
        ? `Analyzed ${entries.length} entries for the period (${timeRange}). Key themes highlight reflective practice, moments of unexpected joy, and evolving pedagogical awareness.`
        : `Analyzováno ${entries.length} zápisů za zvolené období (${timeRange}). Výrazným rysem je citlivost na drobné radosti v průběhu dne a postupné překonávání počáteční únavy. Témata směřují k hlubšímu porozumění vlastní pedagogické roli.`;
    const keyThemes =
      language === 'pl'
        ? ['Wgląd w proces uczenia się', 'Dostrzeganie mikrosukcesów', 'Budowanie relacji z uczniami', 'Zarządzanie energią']
        : language === 'en'
        ? ['Reflective learning', 'Micro-moments of joy', 'Classroom relational dynamics', 'Energy management']
        : ['Reflexe vzdělávacího procesu', 'Mikroradosti všedního dne', 'Sociální vazby ve třídě', 'Hospodaření s pedagogickou energií'];
    const takeaway =
      language === 'pl'
        ? 'Warto nadal pielęgnować zwyczaj zapisywania pytań otwartych po zakończonych lekcjach.'
        : language === 'en'
        ? 'Continue cultivating post-lesson self-inquiry as a deliberate practice for cognitive elasticity.'
        : 'Pokračujte v zaznamenávání otevřených otázek po výuce – slouží jako výborný most mezi didaktickou teorií a živou praxí.';
    const combinedReport = `${summaryText}\n\n• ${keyThemes.join(' • ')}\nOriginality index: 84/100\n\n${takeaway}`;

    return res.json({
      summary: summaryText,
      keyThemes,
      originalityScore: 84,
      pedagogicalTakeaway: takeaway,
      report: combinedReport,
      source: 'curated',
    });
  }

  try {
    const entriesSnippet = entries
      .slice(0, 15)
      .map((e: any, i: number) => `Zápis ${i + 1} (${e.date}, nálada: ${e.mood || 'neuvedena'}): ${JSON.stringify(e.answers || {})}`)
      .join('\n\n');

    const prompt = `Jsi analytik pedagogických reflexí a kreativity. Prostuduj následující deníkové zápisy studenta učitelství z období ${timeRange}:

${entriesSnippet}

${customQuestion ? `Uživatel se specificky zaměřuje na otázku: ${customQuestion}` : ''}

Vygeneruj strukturovanou reflexní zprávu v jazyce ${langName}.
Struktura:
1. Shrnutí vývoje témat, časů a hloubky reflexe (cca 2 odstavce).
2. 3 až 5 klíčových opakujících se témat.
3. Odhad indexu originality a diverzity myšlení (číslo 0-100) s krátkým slovním zdůvodněním.
4. Konkrétní pedagogické doporučení pro další rozvoj učitelské praxe.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    return res.json({
      report: response.text?.trim() || '',
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('Gemini reflection error:', err);
    return res.status(500).json({ error: 'Failed to generate reflection report' });
  }
});

// Endpoint: EduDesign Educational Objects Suggestion
app.post('/api/gemini/edudesign-suggest', async (req, res) => {
  const { goal, bloomLevel, targetGroup, language = 'cs' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  if (!ai) {
    return res.json({
      suggestions: [
        {
          title: language === 'pl' ? 'Symulacja interaktywna' : language === 'en' ? 'Interactive Simulation' : 'Interaktivní simulace',
          type: 'simulation',
          rationale:
            language === 'pl'
              ? 'Pozwala na bezpieczne eksperymentowanie i weryfikację hipotez na poziomie Bloom: Aplikacja / Analiza.'
              : language === 'en'
              ? 'Enables safe exploration and hypothesis testing at Bloom levels Application and Analysis.'
              : 'Umožňuje bezpečné ověřování hypotéz v modelovém prostředí na úrovni aplikace a analýzy.',
          interaction: 'Individuální nebo párová práce s okamžitou zpětnou vazbou.',
          evaluationMethod: 'Reflexní pracovní list s rozborem hraničních stavů.',
        },
        {
          title: language === 'pl' ? 'Studium przypadku (Case Study)' : language === 'en' ? 'Case Study Workshop' : 'Řízená případová studie',
          type: 'case_study',
          rationale: 'Propojuje teoretické koncepty s reálnou praxí a vyžaduje kritické posouzení variant řešení.',
          interaction: 'Skupinová diskuse ve formátu sokratovského semináře.',
          evaluationMethod: 'Strukturovaná rubrika s argumentačními kritérii.',
        },
        {
          title: language === 'pl' ? 'Podcast edukacyjny / Mini-wykład audio' : language === 'en' ? 'Audio Podcast / Micro-lecture' : 'Tematický mikropodcast s glosářem',
          type: 'podcast',
          rationale: 'Vhodné pro asynchronní přípravu předem (Flipped Classroom) na úrovni zapamatování a porozumění.',
          interaction: 'Samostatný poslech s vyhledáváním klíčových momentů.',
          evaluationMethod: 'Vstupní formativní kvíz před prezenční částí.',
        },
        {
          title: language === 'pl' ? 'Współdzielona mapa pojęciowa' : language === 'en' ? 'Collaborative Concept Map' : 'Kolaborativní myšlenková mapa',
          type: 'mindmap',
          rationale: 'Zviditelňuje kognitivní struktury žáků a vztahy mezi pojmy.',
          interaction: 'Společná tvorba v reálném čase.',
          evaluationMethod: 'Vzájemné vrstevnické hodnocení (Peer assessment).',
        },
        {
          title: language === 'pl' ? 'Wyzwanie projektowe (Mini-projekt)' : language === 'en' ? 'Action Mini-Project' : 'Aktivizační mini-projekt',
          type: 'project',
          rationale: 'Naplňuje nejvyšší úroveň Bloomovy taxonomie (Tvoření) skrze konkrétní hmatatelný artefakt.',
          interaction: 'Týmová kooperace v rolích.',
          evaluationMethod: 'Obhajoba artefaktu před třídou s kriteriálním hodnocením.',
        },
      ],
      source: 'curated',
    });
  }

  try {
    const prompt = `Jsi expert na didaktiku a instructional design (konstruktivistické sladění Johna Biggse).
Učitel má vzdělávací cíl: "${goal}"
Úroveň Bloomovy taxonomie: "${bloomLevel}"
Cílová skupina: "${targetGroup || 'studenti pedagogiky / žáci ZŠ/SŠ'}"

Navrhni a podrobně zdůvodni přesně 5 vhodných vzdělávacích objektů (např. podcast, interaktivní simulace, pracovní list, prezentace, video, aplikace, případová studie, sokratovský seminář, infografika, mikromodul atd.), kterými student dosáhne daného cíle.

Odpověz v jazyce: ${langName}.
Formát odpovědi: JSON pole objektů s klíči:
- title: název objektu
- type: stručný kód/typ
- rationale: zdůvodnění výběru ve vazbě na cíl a Bloomovu taxonomii
- interaction: jak s objektem studenti interagují
- evaluationMethod: doporučená metoda ověření splnění cíle`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawParsed = safeParseGeminiJson<any>(response.text, []);
    const parsed = Array.isArray(rawParsed)
      ? rawParsed
      : Array.isArray(rawParsed?.suggestions)
      ? rawParsed.suggestions
      : [];
    return res.json({ suggestions: parsed, source: 'gemini' });
  } catch (err: any) {
    console.error('Gemini edudesign error:', err);
    return res.status(500).json({ error: 'Failed to suggest educational objects' });
  }
});

// Endpoint: Generate Full Educational Object from contextual specifications
app.post('/api/gemini/generate-object', async (req, res) => {
  const { goal, bloomLevel, targetGroup, context, lessonForm, objectType, language = 'cs' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  if (!ai) {
    return res.json({
      title: `${objectType || 'Vzdělávací modul'}: ${goal?.slice(0, 40) || 'Praktická aplikace'}`,
      duration: '45 minut',
      structure: [
        { phase: 'Úvod a motivace (5 min)', description: 'Aktivace prekonceptů skrze bleskovou anketu.' },
        { phase: 'Expozice a interakce (20 min)', description: 'Práce s navrženým objektem ve dvojicích.' },
        { phase: 'Reflexe a syntéza (15 min)', description: 'Sdílení zjištění a formulace zobecnění.' },
        { phase: 'Formatio evaluace (5 min)', description: 'Výstupní propustka (Exit Ticket).' },
      ],
      studentActivity: 'Žáci analyzují předložené materiály, formulují hypotézy a navrhují řešení.',
      teacherRole: 'Průvodce, moderátor diskusí a facilitátor formativní zpětné vazby.',
      assessmentCriteria: [
        { criterion: 'Správné použití terminologie', type: 'nominal', maxPoints: 5 },
        { criterion: 'Schopnost argumentace na příkladu', type: 'nominal', maxPoints: 5 },
        { criterion: 'Odevzdání včas s kompletními náležitostmi', type: 'binary', maxPoints: 1 },
      ],
      gamificationTip: 'Zaveďte společnou tabuli objevů ("Zeď poznání") – každá vyřešená část odemyká další indicii bez vzájemného soupeření.',
      methodologicalTip: 'Pokud někteří žáci skončí dříve, nabídněte jim roli "kritického přítele" pro sousední dvojici.',
      source: 'curated',
    });
  }

  try {
    const prompt = `Jsi špičkový didaktik. Vytvoř detailní vzorový výukový objekt / přípravu podle následujícího zadání:
- Cíl: "${goal}"
- Úroveň Bloomovy taxonomie: "${bloomLevel}"
- Cílová skupina: "${targetGroup}"
- Širší kontext: "${context || 'standardní školní výuka'}"
- Forma výuky: "${lessonForm || 'prezenční seminář'}"
- Typ objektu: "${objectType || 'pracovní list a diskusní scénář'}"

Odpověz v jazyce ${langName}.
Formát: JSON objekt se strukturou:
{
  "title": "výstižný název objektu",
  "duration": "časová dotace",
  "structure": [
    { "phase": "fáze", "description": "popis činnosti" }
  ],
  "studentActivity": "popis aktivní činnosti žáků",
  "teacherRole": "role pedagoga",
  "assessmentCriteria": [
    { "criterion": "popis kritéria", "type": "nominal|binary", "maxPoints": 5 }
  ],
  "gamificationTip": "nekompetitivní mikrogamifikace",
  "methodologicalTip": "praktický metodický tip pro učitele"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    return res.json({ ...parsed, source: 'gemini' });
  } catch (err: any) {
    console.error('Gemini generate object error:', err);
    return res.status(500).json({ error: 'Failed to generate object' });
  }
});

// Endpoint: SMART Goal Validator
app.post('/api/gemini/smart-check', async (req, res) => {
  const { goalText, language = 'cs' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  // Rule 1: Must start with Student "umí/zná/chápe" or equivalents
  const normalized = (goalText || '').trim();
  const startsWithStudent =
    /^Student\s+(umí|zná|chápe|dokáže|analyzuje|vytvoří|rozpozná)/i.test(normalized) ||
    /^Uczeń\s+(potrafi|zna|rozumie|analizuje|tworzy)/i.test(normalized) ||
    /^(The student|Student)\s+(can|knows|understands|is able to|analyzes|creates)/i.test(normalized);

  if (!ai) {
    const isSmart = normalized.length > 25 && startsWithStudent;
    return res.json({
      startsWithStudent,
      isSmart,
      scores: {
        specific: normalized.length > 20 ? 8 : 4,
        measurable: /ověřit|prezentovat|vypočítat|určit|napsat|test|sprawdzić|write|calculate/i.test(normalized) ? 9 : 5,
        achievable: 8,
        relevant: 9,
        timeBound: /do konce|během|za|podczas|within|by the end/i.test(normalized) ? 8 : 4,
      },
      feedback: startsWithStudent
        ? (language === 'pl' ? 'Dobry początek od perspektywy ucznia. Upewnij się, że wskaźnik sukcesu jest mierzalny.' : language === 'en' ? 'Good learner-centered phrasing. Ensure clear measurement criteria.' : 'Výborně, cíl je formulován z pohledu studenta. Zkontrolujte časové ohraničení a měřitelnost výstupu.')
        : (language === 'pl' ? 'Cílem powinno rozpoczynać się od: "Uczeń potrafi / zna / rozumie..."' : language === 'en' ? 'The goal should begin with "The student can / knows / understands..."' : 'Cíl musí začínat formulací: „Student umí / zná / chápe / dokáže...“'),
      improvedSuggestion: startsWithStudent
        ? normalized
        : `Student umí ${normalized.replace(/^(naučit|vysvětlit|předat)\s*/i, '')}`,
      source: 'rule_engine',
    });
  }

  try {
    const prompt = `Jsi pedagogický mentor hodnotící vzdělávací cíle.
Zhodnoť následující formulaci vzdělávacího cíle: "${normalized}"

Pravidla:
1. Musí začínat formulací ze strany studenta: "Student umí / zná / chápe / dokáže..." (v polštině "Uczeń potrafi/zna/rozumie", v angličtině "The student can/knows/understands").
2. Zhodnoť SMART parametry (Specific, Measurable, Achievable, Relevant, Time-bound).
3. Navrhni vylepšenou přesnější formulaci.

Odpověz v jazyce ${langName}.
Formát: JSON objekt:
{
  "startsWithStudent": boolean,
  "isSmart": boolean,
  "scores": {
    "specific": number (1-10),
    "measurable": number (1-10),
    "achievable": number (1-10),
    "relevant": number (1-10),
    "timeBound": number (1-10)
  },
  "feedback": "stručné slovní hodnocení",
  "improvedSuggestion": "vylepšená formulace cíle"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    return res.json({ ...parsed, source: 'gemini' });
  } catch (err: any) {
    console.error('SMART check error:', err);
    return res.json({
      startsWithStudent,
      isSmart: startsWithStudent && normalized.length > 30,
      scores: { specific: 7, measurable: 6, achievable: 8, relevant: 8, timeBound: 6 },
      feedback: startsWithStudent
        ? 'Formulace začíná správně, ověřte ještě jednoznačnou ověřitelnost.'
        : 'Cíl by měl začínat "Student umí / zná / chápe..."',
      improvedSuggestion: startsWithStudent ? normalized : `Student umí ${normalized}`,
      source: 'fallback',
    });
  }
});

// Endpoint: AI Wellbeing Coach for Digital Balance & Weekly Planning
app.post('/api/gemini/wellbeing-coach', async (req, res) => {
  const {
    language = 'cs',
    activeGoals = [],
    checkIns = [],
    diaryEntries = [],
    stats = {},
  } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  // Curated fallback responses if Gemini is unavailable
  const fallbackCoaches: Record<string, any> = {
    cs: {
      paragraphReport:
        'V uplynulých dnech se vám dařilo vědomě reflektovat roli technologií ve výuce i osobním životě. Data z vašeho deníku ukazují, že ve dnech, kdy jste si stanovili jasnou hranici pro odložení pracovního telefonu a zařadili krátké pohybové mikropauzy, byla míra naplnění vašich potřeb (zejména potřeby vnitřního klidu a regenerace) výrazně vyšší. Naopak večerní přetížení notifikacemi koreluje s únavou následující den. Digitální nástroje pro vás nejlépe fungují tehdy, když slouží jako podpora aktivního dialogu se žáky, nikoli jako pasivní náhražka přímé lidské komunikace.',
      weeklyTips: [
        {
          title: 'Digitální západ slunce v 18:00',
          habit: 'Přepněte školní telefon a e-mail do režimu Nerušit nejpozději v 18:00. Vytvoříte si tak 2 hodiny čistého mentálního prostoru před spánkem.',
          category: 'boundaries',
        },
        {
          title: 'Dvouminutový offline rituál před vyučováním',
          habit: 'Před zahájením první hodiny na 2 minuty zavřete notebook a třikrát se zhluboka nadechněte společně se třídou.',
          category: 'mindfulness',
        },
        {
          title: 'Jedno analogové cvičení denně',
          habit: 'V každé lekci nahraďte alespoň jednu obrazovkovou aktivitu fyzickou kartičkou, kresbou na papír nebo diskusí ve dvojici.',
          category: 'pedagogy',
        },
      ],
      nvcNeedHighlight: 'Potřeba vnitřního klidu, regenerace a smysluplnosti',
      encouragement: 'Pamatujte: Péče o vlastní digitální rovnováhu není sobectví, ale základní didaktická dovednost udržitelného učitelství.',
      source: 'curated',
    },
    en: {
      paragraphReport:
        'Over the past week, your reflections demonstrate high awareness of technological boundaries and energy management. Journal entries confirm that intentional device limits in the late afternoon directly correlated with higher emotional resilience and better classroom presence. Digital tools served you best when facilitating collaborative student interaction rather than passive screen time. Moving into the upcoming week, small structural rituals will help sustain this equilibrium without adding mental fatigue.',
      weeklyTips: [
        {
          title: 'Digital Sunset at 6:00 PM',
          habit: 'Switch school notifications and mailbox to Do Not Disturb by 6:00 PM to protect evening restorative rest.',
          category: 'boundaries',
        },
        {
          title: 'Pre-Lesson Grounding Pause',
          habit: 'Close your laptop screen for 90 seconds before class starts to ground your attention and establish presence with students.',
          category: 'mindfulness',
        },
        {
          title: 'One Deliberate Analog Phase',
          habit: 'Anchor at least one core lesson activity in tactile physical paper, index cards, or peer dialogue.',
          category: 'pedagogy',
        },
      ],
      nvcNeedHighlight: 'Need for Rest, Peace of Mind, and Genuine Connection',
      encouragement: 'Protecting your digital wellbeing is the foundation of sustainable teaching.',
      source: 'curated',
    },
    pl: {
      paragraphReport:
        'W minionym tygodniu Twoje refleksje dowodzą wysokiej świadomości w wyznaczaniu granic między światem cyfrowym a regeneracją. Wpisy w dzienniku wskazują, że dni, w których udało się odłożyć powiadomienia służbowe po południu, przyniosły wyraźnie wyższy poziom spokoju i satysfakcji z lekcji. Technologia przynosiła największą wartość, gdy wspierała aktywny dialog z uczniami, a nie pasywne spędzanie czasu przed ekranem.',
      weeklyTips: [
        {
          title: 'Cyfrowy zachód słońca o 18:00',
          habit: 'Wyłącz powiadomienia szkolnej poczty o godzinie 18:00, by zagwarantować sobie przestrzeń na wieczorny odpoczynek.',
          category: 'boundaries',
        },
        {
          title: 'Dwuminutowe wyciszenie przed lekcją',
          habit: 'Przed wejściem do sali zamknij laptop na 2 minuty i wykonaj 3 świadome, spokojne oddechy.',
          category: 'mindfulness',
        },
        {
          title: 'Przynajmniej jedna faza analogowa',
          habit: 'W każdej lekcji zaplanuj przynajmniej jedno ćwiczenie z użyciem papieru, rysunku lub rozmowy w parach.',
          category: 'pedagogy',
        },
      ],
      nvcNeedHighlight: 'Potrzeba spokoju wewnętrznego, odpoczynku i autentycznego kontaktu',
      encouragement: 'Troska o własną równowagę cyfrową jest fundamentem trwałego mistrzostwa pedagogicznego.',
      source: 'curated',
    },
  };

  if (!ai) {
    const fallback = fallbackCoaches[language] || fallbackCoaches.cs;
    return res.json(fallback);
  }

  try {
    const goalsSnippet = activeGoals
      .map((g: any) => `- Cíl [potřeba: ${g.needKey}]: "${g.goalText}" (metrika: ${g.metric || 'neuvedena'})`)
      .join('\n');

    const checkInsSnippet = checkIns
      .slice(-10)
      .map((c: any) => `- Datum ${c.date}, hodnocení naplnění: ${c.rating}/5, poznámka: ${c.reflection || 'bez textu'}`)
      .join('\n');

    const diarySnippet = diaryEntries
      .slice(-10)
      .map((d: any) => `- Datum ${d.date}, nálada: ${d.mood || '🌿'}, dávala technika smysl: ${d.didTechMakeSense ? 'ANO' : 'NE'}, reflexe: "${d.reflection || d.answers || ''}"`)
      .join('\n');

    const prompt = `Jsi pedagogický a psychologický kouč pro učitele se zaměřením na digitální wellbeing a nenásilnou komunikaci (NVC dle M. Rosenberga).
Prostuduj data studenta učitelství / učitele za uplynulý týden:

AKTIVNÍ CÍLE UŽIVATELE:
${goalsSnippet || 'Uživatel zatím neměl vypsané konkrétní cíle.'}

NEDÁVNÉ DENNÍ KONTROLY (CHECK-INS):
${checkInsSnippet || 'Zatím žádné záznamy hodnocení cílů.'}

DENÍK PRÁCE S TECHNOLOGIEMI:
${diarySnippet || 'Zatím žádné podrobné reflexe.'}

DOPLŇUJÍCÍ STATISTIKY:
- Míra smysluplnosti technologií: ${stats.techSenseRatio || '80'}% dnů
- Počet splněných cílů: ${stats.fulfilledGoalsCount || 0}

ÚKOL:
Vytvoř personalizovaný odstavcový report s tipy pro lepší digitální rovnováhu pro NÁSLEDUJÍCÍ TÝDEN v jazyce ${langName}.
Struktura výstupu v přesném JSON formátu:
{
  "paragraphReport": "Jeden až dva čtivé, empatické a odborně podložené odstavce (cca 4-6 vět) shrnující reálný stav rovnováhy, co se dařilo, kde vznikalo přetížení a jak to souvisí s potřebami.",
  "weeklyTips": [
    {
      "title": "Chytlavý název mikro-návyku 1",
      "habit": "Konkrétní, snadno proveditelná akce do rozvrhu na příští týden (max 2 věty).",
      "category": "boundaries"
    },
    {
      "title": "Chytlavý název mikro-návyku 2",
      "habit": "Konkrétní akce podporující všímavost / dech / mikropauzu.",
      "category": "mindfulness"
    },
    {
      "title": "Chytlavý název mikro-návyku 3",
      "habit": "Konkrétní didaktické doporučení pro práci s technikou ve třídě.",
      "category": "pedagogy"
    }
  ],
  "nvcNeedHighlight": "Klíčová vnitřní potřeba podle NVC pro tento týden (např. Potřeba vnitřního klidu a uznání)",
  "encouragement": "Jedna povzbuzující věta pro učitele na závěr."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    return res.json({
      ...parsed,
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('Gemini wellbeing coach error:', err);
    const fallback = fallbackCoaches[language] || fallbackCoaches.cs;
    return res.json({
      ...fallback,
      source: 'fallback',
    });
  }
});

// ----------------- CRITERION ASSESSMENT AI ENDPOINTS -----------------

// 1. Suggest Formal & Content Criteria for an Assignment
app.post('/api/gemini/criteria-suggest', async (req, res) => {
  const { title = '', subject = '', description = '', language = 'cs' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  const fallbackCriteria =
    language === 'pl'
      ? [
          { name: 'Struktura i objętość pracy', description: 'Praca zawiera wstęp, rozwinięcie, podsumowanie i mieści się w zadanym limicie słów.', category: 'formal', weight: 3 },
          { name: 'Poprawność językowa i cytowania', description: 'Tekst zawiera maksymalnie 3 błędy interpunkcyjne/ortograficzne na stronę i poprawne odwołania do źródeł.', category: 'formal', weight: 2 },
          { name: 'Logika argumentacji i dowody', description: 'Każda główna teza jest poparta co najmniej dwoma weryfikowalnymi przykładami lub danymi z literatury.', category: 'content', weight: 8 },
          { name: 'Precyzja pojęć przedmiotowych', description: 'Uczeń poprawnie definiuje i stosuje co najmniej 5 kluczowych pojęć z tematu zadania.', category: 'content', weight: 7 },
        ]
      : language === 'en'
      ? [
          { name: 'Structure and Required Length', description: 'Includes a clear introduction, body, and conclusion within the specified word or slide count.', category: 'formal', weight: 3 },
          { name: 'Citation Formatting and Mechanics', description: 'All external claims include inline citations and at most 2 grammar/spelling errors per page.', category: 'formal', weight: 2 },
          { name: 'Evidence-Based Argumentation', description: 'Each core claim is supported by at least two verifiable facts, examples, or primary sources.', category: 'content', weight: 8 },
          { name: 'Accurate Use of Domain Concepts', description: 'Correctly defines and applies at least 5 core subject concepts in context.', category: 'content', weight: 7 },
        ]
      : [
          { name: 'Struktura a dodržení rozsahu', description: 'Práce obsahuje jasný úvod, stať i závěr a splňuje stanovený rozsah (např. ±10 % normostran nebo bodů osnovy).', category: 'formal', weight: 3 },
          { name: 'Jazyková správnost a citace zdrojů', description: 'Text vykazuje nejvýše 2 pravopisné chyby na stranu a všechny převzaté informace jsou řádně citovány.', category: 'formal', weight: 3 },
          { name: 'Argumentace podložená důkazy', description: 'Každé klíčové tvrzení je doloženo alespoň dvěma konkrétními daty, fakty nebo odkazy na ověřené zdroje.', category: 'content', weight: 8 },
          { name: 'Věcná správnost a práce s pojmy', description: 'Student správně definuje a v souvislostech používá nejméně 5 odborných pojmů z tématu úkolu.', category: 'content', weight: 9 },
          { name: 'Kritické zhodnocení a vlastní závěr', description: 'Závěr práce porovnává alespoň dva různé úhly pohledu a formuluje konkrétní podložené stanovisko.', category: 'content', weight: 6 },
        ];

  if (!ai) {
    return res.json({ criteria: fallbackCriteria, source: 'curated' });
  }

  try {
    const prompt = `Jsi expert na pedagogickou diagnostiku a kriteriální hodnocení.
Navrhni 5 až 6 konkrétních, přísně MĚŘITELNÝCH a objektivně ověřitelných hodnoticích kritérií pro následující studentský úkol:
Název úkolu: ${title}
Předmět / kontext: ${subject}
Popis zadání: ${description}

Pravidla:
- Kritéria rozděl do dvou kategorií: "formal" (formální kritéria: úprava, citace, rozsah, pravopis, odevzdání) a "content" (obsahová kritéria: práce s fakty, argumentace, analýza, věcná správnost).
- Každé kritérium MUSÍ být měřitelné a pozorovatelné přímo v odevzdaném výstupu (žádné subjektivní fráze jako "snažil se", "pěkný dojem").
- Každému kritériu přiřaď doporučenou váhu od 1 do 10 (obsahová mívají obvykle vyšší váhu než formální).
- Odpověz v jazyce: ${langName}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            criteria: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['formal', 'content'] },
                  weight: { type: Type.INTEGER },
                },
                required: ['name', 'description', 'category', 'weight'],
              },
            },
          },
          required: ['criteria'],
        },
      },
    });

    const parsed = safeParseGeminiJson<{ criteria?: any[] }>(response.text, {});
    const normalized = Array.isArray(parsed.criteria)
      ? parsed.criteria.map((c: any) => ({
          name: String(c.name || ''),
          description: String(c.description || ''),
          category: c.category === 'formal' ? 'formal' : 'content',
          weight: Math.min(10, Math.max(1, Number(c.weight) || 5)),
        }))
      : fallbackCriteria;

    return res.json({ criteria: normalized, source: 'gemini' });
  } catch (err: any) {
    console.error('Criteria suggest error:', err);
    return res.json({ criteria: fallbackCriteria, source: 'fallback' });
  }
});

// Helper: find matched subjective/bias terms using Unicode-safe word boundaries
function findMatchedTerms(text: string, patterns: string[]): string[] {
  const matches: string[] = [];
  for (const pat of patterns) {
    const re = new RegExp(`(?:^|[^a-záčďéěíňóřšťúůýžąćęłńóśźż])(${pat})(?=$|[^a-záčďéěíňóřšťúůýžąćęłńóśźż])`, 'i');
    const m = text.match(re);
    if (m && m[1]) {
      const cleaned = m[1].trim();
      if (cleaned && !matches.some((x) => x.toLowerCase() === cleaned.toLowerCase())) {
        matches.push(cleaned);
      }
    }
  }
  return matches;
}

// 2. Validate Criterion Measurability & Absence of Subjective Feeling (STRICT AUDIT)
app.post('/api/gemini/criteria-validate', async (req, res) => {
  const { name = '', description = '', category = 'content', language = 'cs' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const combined = `${name} ${description}`.trim();

  // Strictly boundary-safe patterns (will NOT false-positive on "citace", "cituje", "princip", etc.)
  const subjectiveCriterionPatterns = [
    // Effort / attitude / inner states (CS)
    'snaž[a-záčďéěíňóřšťúůýž]*',
    'snah[aouěy]?',
    'usil[a-záčďéěíňóřšťúůýž]*',
    'úsil[íi]',
    'píl[ei]',
    'piln[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'ochot[a-záčďéěíňóřšťúůýž]*',
    'záje?m[a-záčďéěíňóřšťúůýž]*',
    'aktivit[auy]',
    'aktivn[íě][a-záčďéěíňóřšťúůýž]*',
    'nadšen[íýáé][a-záčďéěíňóřšťúůýž]*',
    'motivac[ei]',
    'přístup[a-záčďéěíňóřšťúůýž]*',
    'pečliv[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'zodpovědn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'samostatn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    // Feelings / impressions (CS) - note: 'cit' only as standalone word, never 'citace'
    'cit', 'citu', 'citem',
    'cít[íi][a-záčďéěíňóřšťúůýž]*',
    'pocit[a-záčďéěíňóřšťúůýž]*',
    'doje?m[a-záčďéěíňóřšťúůýž]*',
    'působ[íi][a-záčďéěíňóřšťúůýž]*',
    'připad[aá][a-záčďéěíňóřšťúůýž]*',
    'zdá se',
    'líb[íi]',
    'nelíb[íi]',
    'osobn[íě]',
    'subjektivn[íě][a-záčďéěíňóřšťúůýž]*',
    'mysl[íi]m',
    // Unquantified aesthetic / vague quality adjectives & mental claims (CS)
    'pěkn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'hezk[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'krásn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'skvěl[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'výborn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'úžasn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'dobr[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'dobře',
    'špatn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'kvalitn[íě][a-záčďéěíňóřšťúůýž]*',
    'zajímav[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'přehledn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'srozumiteln[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'smyslupln[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'logick[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'kreativn[íě][a-záčďéěíňóřšťúůýž]*',
    'origináln[íě][a-záčďéěíňóřšťúůýž]*',
    'nápadit[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'poutav[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'vkusn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'úhledn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'vhodn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'přiměřen[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'dostatečn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'zdařil[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'poveden[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'úspěšn[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'bohat[ýáéěo][a-záčďéěíňóřšťúůýž]*',
    'vysok[áé] úrovn[a-záčďéěíňóřšťúůýž]*',
    'talent[a-záčďéěíňóřšťúůýž]*',
    'nadán[íýáé]',
    'pochop[a-záčďéěíňóřšťúůýž]*',
    'rozum[íi][a-záčďéěíňóřšťúůýž]*',
    'ovládá[a-záčďéěíňóřšťúůýž]*',
    'zvládl[a-záčďéěíňóřšťúůýž]*',
    // English subjective/vague indicators
    'tried hard', 'tried', 'effort', 'nice', 'nicely', 'pretty',
    'good impression', 'good', 'great', 'excellent', 'awesome', 'amazing',
    'feels like', 'seems', 'interesting', 'clear', 'clearly', 'logical', 'logically',
    'creative', 'creatively', 'original', 'engaging', 'neat', 'neatly',
    'enthusiasm', 'attitude', 'adequate', 'sufficient', 'appropriate', 'quality',
    'high level', 'understands?', 'meaningful', 'well done',
    // Polish subjective/vague indicators
    'starał[a-zćęłńóśźż]*', 'starania', 'chęci', 'ładn[a-zćęłńóśźż]*',
    'miłe wrażenie', 'wrażenie', 'ciekaw[a-zćęłńóśźż]*', 'czytelny',
    'zrozumiał[a-zćęłńóśźż]*', 'logiczny', 'dobry', 'dobrze', 'świetn[a-zćęłńóśźż]*',
    'kreatywn[a-zćęłńóśźż]*', 'oryginaln[a-zćęłńóśźż]*', 'zgrabn[a-zćęłńóśźż]*',
    'zaangażowanie', 'odpowiedni[a-zćęłńóśźż]*', 'wysoki poziom',
  ];

  const matchedSubjectiveTerms = findMatchedTerms(combined, subjectiveCriterionPatterns);

  const hasObservableAnchor =
    /\d|alespoň|minimálně|nejvýše|maximálně|všech|všechna|všechny|každ[ýáé]|žádn[ýáé]|bez\s+chy|obsahuje|uvádí|definuje|porovnává|dolož|cituje|citac|odkazuj|splňuje\s+(?:norm|podmínk|rozsah)|odpovídá\s+norm|vyčísl|formát|rozsah|normostran|stran|slov|zdroj|pramen|odkaz|příklad|důkaz|argument|tabulk|graf|schéma|at least|at most|minimum|maximum|contains|includes|defines|compares|cites|citations|verifiable|all\s+claims|without\s+errors|words|pages|sources|examples|evidence|co najmniej|maksymalnie|zawiera|definiuje|porównuje|cytuje|wszystkie|żadnych|słów|stron|źródeł|przykładów/i.test(
      combined
    );

  const trimmedDesc = description.trim();
  const trimmedName = name.trim();
  const subjectiveHit = matchedSubjectiveTerms.length > 0;
  const tooVague =
    (!trimmedName && !trimmedDesc) ||
    trimmedDesc.length < 18 ||
    !hasObservableAnchor;
  const heuristicFail = subjectiveHit || tooVague;

  const quotedTerms = matchedSubjectiveTerms.map((w) => `„${w}“`).join(', ');

  const strictWarningMessage = subjectiveHit
    ? language === 'pl'
      ? `ODRZUT W RYGORYSTYCZNIEJ KONTROLI: Kryterium zawiera subiektywne lub niemierzalne określenia (${quotedTerms}). Zastąp je wyłącznie policzalnymi, obserwowalnymi wskaźnikami w oddanej pracy.`
      : language === 'en'
      ? `STRICT AUDIT REJECTION: Criterion contains subjective, effort-based, or vague terms (${quotedTerms}). Replace them with strictly observable, countable indicators on the submitted work.`
      : `PŘÍSNÁ KONTROLA OBJEKTIVITY (SUBJEKTIVNÍ): Kritérium obsahuje subjektivní hodnocení, dojem nebo nekvantifikovaný výraz (${quotedTerms}). Nahraďte je výhradně pozorovatelnými a spočitatelnými znaky v odevzdané práci.`
    : tooVague
    ? language === 'pl'
      ? 'KRYTERIUM ZBYT OGÓLNE (NIEMIERZALNE): Brak konkretnego progu lub warunku obserwowalnego (np. liczba źródeł, wymagane elementy, limit błędów). Doprecyzuj opis tak, aby dwóch oceniających przyznało tę samą punktację.'
      : language === 'en'
      ? 'NOT MEASURABLE ENOUGH: Description lacks concrete observable thresholds or required counts/conditions (e.g., exact number of sources, components, or error limit). Specify verifiable rules so two independent graders match scores.'
      : 'KRITÉRIUM NENÍ DOSTATEČNĚ MĚŘITELNÉ: Popis je příliš krátký nebo postrádá konkrétní pozorovatelný práh či důkaz (např. přesný počet argumentů/zdrojů, ověřitelnou normu či rozsah), podle něhož se dva nezávislí učitelé vždy shodnou na stejném skóre.'
    : language === 'pl'
    ? 'OBIEKTYWNE I MIERZALNE: Kryterium spełnia rygorystyczne wymagania obserwowalności bez subiektywnych ocen.'
    : language === 'en'
    ? 'OBJECTIVE & MEASURABLE: Criterion specifies concrete observable indicators without subjective impressions or bias.'
    : 'OBJEKTIVNÍ A MĚŘITELNÉ: Kritérium prošlo přísnou kontrolou — neobsahuje subjektivní pojmy a opírá se o konkrétní pozorovatelné znaky v práci.';

  const safeLabel = trimmedName || (language === 'en' ? 'Criterion' : language === 'pl' ? 'Kryterium' : 'Kritérium');
  const defaultRewriteName =
    language === 'pl'
      ? `${safeLabel} (wskaźnik obserwowalny)`
      : language === 'en'
      ? `${safeLabel} (Observable Indicator)`
      : `${safeLabel} (měřitelný ukazatel)`;

  const defaultRewriteDesc =
    language === 'pl'
      ? `Oddana praca zawiera co najmniej 3 konkretne, weryfikowalne elementy lub dowody potwierdzające „${safeLabel}” wraz z odwołaniem do źródeł (bez oceny starań czy wrażenia).`
      : language === 'en'
      ? `Submitted work includes at least 3 concrete, verifiable elements, cited facts, or structural components fulfilling "${safeLabel}", measurable without subjective impression.`
      : `Odevzdaná práce obsahuje alespoň 3 konkrétní ověřitelné prvky, fakta nebo citace vztahující se ke kritériu „${safeLabel}“ se splněním stanovené normy bez hodnocení snahy či dojmu.`;

  const fallbackResponse = {
    isMeasurable: !heuristicFail,
    hasSubjectiveBias: subjectiveHit,
    warningMessage: strictWarningMessage,
    suggestedName: heuristicFail ? defaultRewriteName : trimmedName,
    suggestedDescription: heuristicFail ? defaultRewriteDesc : trimmedDesc,
    source: 'heuristic',
  };

  if (!ai) {
    return res.json(fallbackResponse);
  }

  try {
    const prompt = `Jsi NEKOMPROMISNÍ, extrémně přísný metodik kriteriálního hodnocení. Tvým úkolem je odhalit JAKÝKOLIV náznak subjektivity, osobního pocitu učitele, neověřitelného přídavného jména nebo vágnosti v hodnoticím kritériu.

Kategorie: ${category === 'formal' ? 'Formální kritérium' : 'Obsahové kritérium'}
Název kritéria: "${name}"
Popis kritéria: "${description}"

PŘÍSNÁ PRAVIDLA AUDITU (buď opravdu přísný, raději zamítni než pusť vágní text!):
1. Kritérium NESMÍ hodnotit snahu, motivaci, píli, aktivitu nebo přístup studenta (např. „snažil se“, „je vidět snaha“, „aktivně přistupoval“ -> okamžitě hasSubjectiveBias=true, isMeasurable=false).
2. Kritérium NESMÍ obsahovat nekvantifikovaná subjektivní přídavná jména závisející na vkusu či pocitu hodnotitele (např. „pěkný“, „hezký“, „dobrý“, „kvalitní“, „zajímavý“, „přehledný“, „srozumitelný“, „logický“, „kreativní“, „dostatečný“, „správný“ bez přesné normy či prahu -> okamžitě hasSubjectiveBias=true, isMeasurable=false!).
3. Kritérium je MĚŘITELNÉ (isMeasurable=true) POUZE tehdy, pokud obsahuje konkrétní pozorovatelné znaky, prahy nebo počitatelné podmínky (např. kolik zdrojů, jaké konkrétní kroky, jaký přesný počet chyb je tolerován, citace dle normy), na kterých se dva různí učitelé objektivně shodnou na škále 3-2-1-0.

Odpověz v jazyce ${langName}:
- isMeasurable: true POUZE pokud splňuje všechna 3 pravidla výše bez výjimky.
- hasSubjectiveBias: true pokud obsahuje jakýkoliv pocit, dojem, snahu nebo subjektivní adjektivum.
- warningMessage: přesné, přísné vysvětlení, které konkrétní slovo nebo mezera brání objektivnímu měření (nebo potvrzení, že kritérium je přísně objektivní a měřitelné).
- suggestedName: konkrétní vylepšený název kritéria.
- suggestedDescription: konkrétní, přísně měřitelná formulace s číselnými či jasně pozorovatelnými ukazateli.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMeasurable: { type: Type.BOOLEAN },
            hasSubjectiveBias: { type: Type.BOOLEAN },
            warningMessage: { type: Type.STRING },
            suggestedName: { type: Type.STRING },
            suggestedDescription: { type: Type.STRING },
          },
          required: ['isMeasurable', 'hasSubjectiveBias', 'warningMessage', 'suggestedName', 'suggestedDescription'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    // Strict merge: deterministic heuristic rejects cannot be bypassed by permissive LLM output
    const mergedHasBias = Boolean(parsed.hasSubjectiveBias) || subjectiveHit;
    const mergedIsMeasurable = Boolean(parsed.isMeasurable) && !heuristicFail;

    return res.json({
      isMeasurable: mergedIsMeasurable,
      hasSubjectiveBias: mergedHasBias,
      warningMessage:
        !mergedIsMeasurable && parsed.isMeasurable !== false
          ? strictWarningMessage
          : parsed.warningMessage || strictWarningMessage,
      suggestedName: parsed.suggestedName || fallbackResponse.suggestedName,
      suggestedDescription: parsed.suggestedDescription || fallbackResponse.suggestedDescription,
      source: 'gemini+strict',
    });
  } catch (err: any) {
    console.error('Criteria validate error:', err);
    return res.json(fallbackResponse);
  }
});

// 3. Validate Teacher Comment for Subjectivity & Labeling (STRICT ANTI-BIAS AUDIT)
app.post('/api/gemini/comment-validate', async (req, res) => {
  const { comment = '', language = 'cs' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const trimmedComment = comment.trim();

  // Strict boundary-safe patterns: labeling, generalizations, teacher opinions/feelings, unsubstantiated praise/blame
  const strictBiasPatterns = [
    // Labeling & character judgments (CS)
    'lín[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'flákač[a-záčďéěíňóřšťúůýž]*',
    'hloup[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'neschopn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'nepozorn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'odflákl[a-záčďéěíňóřšťúůýž]*',
    'odbyl[a-záčďéěíňóřšťúůýž]*',
    'nezajímá',
    'šprt[a-záčďéěíňóřšťúůýž]*',
    'chytr[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'šikovn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'nadan[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'nadán[íýáé]',
    'talent[a-záčďéěíňóřšťúůýž]*',
    'nezodpovědn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'povrchn[íě][a-záčďéěíňóřšťúůýž]*',
    'chaotick[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'laick[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'průměrn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'slab[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'nudn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'hrozn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'strašn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'trapn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'katastrof[a-záčďéěíňóřšťúůýž]*',
    'skvěl[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'úžasn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'pěkn[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'hezk[ýáéě][a-záčďéěíňóřšťúůýž]*',
    'super', 'bezva',
    // Generalizations
    'vždycky', 'vždy', 'nikdy', 'zase', 'opět', 'pokaždé',
    // Personal teacher feelings/opinions/unfounded praise or demands
    'myslím', 'věřím', 'domnívám', 'připadá mi', 'zdá se mi', 'cítím',
    'nelíbí se mi', 'líbí se mi', 'líb[íi]', 'očekával jsem', 'zklamal[a-záčďéěíňóřšťúůýž]*',
    'potěšil[a-záčďéěíňóřšťúůýž]*', 'mrzí mě',
    'dobrá práce', 'skvělá práce', 'výborná práce', 'povedlo se',
    'máš na víc', 'mohl bys víc', 'mohla bys víc', 'více se snaž',
    'snah[aouy]?', 'snaž[a-záčďéěíňóřšťúůýž]*', 'neochot[a-záčďéěíňóřšťúůýž]*',
    'příště lépe', 'jen tak dál', 'asi jsi', 'jsi',
    // English
    'lazy', 'careless', 'smart', 'clever', 'gifted', 'stupid', 'always', 'never', 'again',
    'i feel', 'i think', 'seems to me', 'in my opinion', 'disappointed',
    'good job', 'great work', 'nice work', 'poor work', 'you tried', 'make more effort', 'superficial', 'chaotic',
    // Polish
    'leniwy', 'głupi', 'nieuważny', 'zdolny', 'zawsze', 'nigdy', 'myślę', 'uważam',
    'wydaje mi się', 'czuję', 'dobra robota', 'świetna praca', 'postaraj się', 'słabe', 'chaotyczne',
  ];

  const matchedBiasTerms = findMatchedTerms(trimmedComment, strictBiasPatterns);

  const hasConcreteWorkReference =
    /(kapitol|odstav|úvod|stať|závěr|argument|zdroj|pramen|citac|výpoč|vzorec|graf|tabulk|struktur|chyb|pravopis|defin|důkaz|příklad|úloh|kritér|teze|řešen|postup|text|výsledk|chybí|chybělo|obsahuje|dol[ož]|uved|chapter|paragraph|introduction|conclusion|argument|source|citation|calculation|formula|graph|table|structure|error|spelling|definition|evidence|example|criterion|thesis|missing|includes|rozdział|akapit|wstęp|zakończenie|argument|źródł|cytow|oblicz|wykres|tabel|struktur|błąd|definicj|dowód|przykład|kryter|teza|brakuje|zawiera)/i.test(
      trimmedComment
    );

  const wordCount = trimmedComment ? trimmedComment.split(/\s+/).length : 0;
  const unsubstantiatedShort = wordCount > 0 && wordCount < 5 && !hasConcreteWorkReference;
  const regexBias = matchedBiasTerms.length > 0;
  const strictHasBias = regexBias || unsubstantiatedShort || (wordCount > 0 && !hasConcreteWorkReference);
  const quotedBias = matchedBiasTerms.map((w) => `„${w}“`).join(', ');

  const warningText = regexBias
    ? language === 'pl'
      ? `ODRZUT W AUDYCIE OBIEKTYWNOŚCI: Komentarz zawiera etykietowanie, uogólnienia lub subiektywną opinię (${quotedBias}) zamiast oceny konkretnych dowodów w pracy.`
      : language === 'en'
      ? `STRICT ANTI-BIAS ALERT: The comment contains student labeling, generalizations, or personal opinions (${quotedBias}) instead of specific evidence from the work.`
      : `PŘÍSNÉ VAROVÁNÍ PŘED SUBJEKTIVITOU: Komentář obsahuje nálepkování studenta, zevšeobecňování, dojem nebo osobní názor učitele (${quotedBias}) místo věcné evaluace konkrétních projevů v práci.`
    : !hasConcreteWorkReference && wordCount > 0
    ? language === 'pl'
      ? 'BRAK ODNIESIENIA DO KONKRETÓW PRACY: Komentarz brzmi jak ogólna opinia zamiast opisu konkretnych elementów zadania (np. argumentów, źródeł, struktury, błędów). Doprecyzuj ocenę pracy.'
      : language === 'en'
      ? 'LACKS WORK-SPECIFIC EVIDENCE: The comment reads as a general impression rather than referencing concrete elements of the artifact (e.g., arguments, citations, structure, calculations).'
      : 'KOMENTÁŘ POSTRÁDÁ KONKRÉTNÍ EVALUACI PRÁCE: Text působí jako obecný soud nebo dojem učitele, protože neuvádí žádné konkrétní prvky odevzdaného výstupu (např. argumenty, citace, strukturu, kroky řešení). Hodnoťte práci, ne studenta.'
    : language === 'pl'
    ? 'OBIEKTYWNA EWALUACJA: Komentarz jest rzeczowy, pozbawiony etykiet i bezpośrednio ocenia konkretne elementy pracy.'
    : language === 'en'
    ? 'OBJECTIVE EVALUATION: The comment is strictly objective, free of labeling/personal opinion, and evaluates concrete elements of the work.'
    : 'OBJEKTIVNÍ EVALUACE: Komentář prošel přísnou kontrolou — je věcný, bez nálepkování i osobních dojmů a hodnotí výhradně konkrétní projevy v práci.';

  const defaultRewrite =
    language === 'pl'
      ? 'W oddanej pracy poprawnie sformułowano wstęp oraz podstawową tezę, jednak w dwóch kluczowych argumentach brakuje odwołań do zweryfikowanych źródeł, a w zakończeniu brakuje porównania przeciwstawnych stanowisk. Aby poprawić wynik, uzupełnij co najmniej dwa cytowane dowody oraz rozwiń podsumowanie.'
      : language === 'en'
      ? 'The submitted artifact establishes a clear introduction and thesis, but two main claims lack supporting citations and the conclusion omits comparative evidence. To improve, add at least two verifiable sources and explicitly connect them to your final claim.'
      : 'V odevzdané práci je přehledně zpracován úvod a základní teze zadání, avšak u dvou hlavních argumentů chybí doložení ověřenými zdroji a závěr neobsahuje srovnání odlišných pohledů. Pro zlepšení doplňte alespoň dva konkrétní prameny a podrobnější rozbor závěru.';

  const fallbackResult = {
    isObjective: !strictHasBias,
    hasLabelingOrOpinion: strictHasBias,
    warningMessage: warningText,
    objectiveRewrite: strictHasBias ? defaultRewrite : trimmedComment,
    source: 'heuristic',
  };

  if (!ai) {
    return res.json(fallbackResult);
  }

  try {
    const prompt = `Jsi NEKOMPROMISNÍ auditor formativního hodnocení a anti-bias komunikace.
Zkontroluj přísně následující volný komentář učitele ke studentské práci:
"${trimmedComment}"

PŘÍSNÁ PRAVIDLA HODNOCENÍ (buď maximálně kritický!):
1. Názory učitele na povahu studenta, jeho píli či schopnosti NIKDY nepatří do evaluace („jsi šikovný/líný“, „odfláknuté“, „nezajímá tě to“, „máš navíc“ -> hasLabelingOrOpinion=true, isObjective=false).
2. Subjektivní pocity, domněnky a osobní vkus učitele jsou NEPŘÍPUSTNÉ („myslím si“, „připadá mi“, „zdá se mi“, „věřím“, „líbí/nelíbí se mi“, „asi“, „očekával jsem“ -> isObjective=false).
3. Zevšeobecňování („vždycky“, „nikdy“, „zase“, „opět“) je nálepkující -> isObjective=false.
4. Prázdná pochvala nebo kritika bez uvedení konkrétního důkazu v textu/práci („dobrá práce“, „chybí více snahy“, „slabé“, „pěkné“) NENÍ objektivní evaluace práce -> isObjective=false!
Komentář je objektivní (isObjective=true) POUZE tehdy, pokud popisuje konkrétní splněné či chybějící prvky odevzdaného výstupu a dává věcný návod ke zlepšení bez hodnoticích nálepek.

Vyhodnoť přísně v jazyce ${langName}:
- isObjective: true pouze při 100% splnění všech 4 pravidel.
- hasLabelingOrOpinion: true při jakémkoliv porušení pravidel 1-4.
- warningMessage: jasně pojmenuj problematickou část textu a proč je subjektivní či nálepkující (nebo potvrď přísnou objektivitu).
- objectiveRewrite: profesionální, čistě popisná evaluace zaměřená výhradně na konkrétní znaky práce a kroky ke zlepšení.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isObjective: { type: Type.BOOLEAN },
            hasLabelingOrOpinion: { type: Type.BOOLEAN },
            warningMessage: { type: Type.STRING },
            objectiveRewrite: { type: Type.STRING },
          },
          required: ['isObjective', 'hasLabelingOrOpinion', 'warningMessage', 'objectiveRewrite'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    // Strict merge: deterministic bias checks cannot be bypassed
    const mergedBias = Boolean(parsed.hasLabelingOrOpinion) || strictHasBias;
    const mergedObjective = Boolean(parsed.isObjective) && !strictHasBias;

    return res.json({
      isObjective: mergedObjective,
      hasLabelingOrOpinion: mergedBias,
      warningMessage:
        !mergedObjective && parsed.isObjective !== false
          ? warningText
          : parsed.warningMessage || warningText,
      objectiveRewrite: parsed.objectiveRewrite || fallbackResult.objectiveRewrite,
      source: 'gemini+strict',
    });
  } catch (err: any) {
    console.error('Comment validate error:', err);
    return res.json(fallbackResult);
  }
});

// 4. Generate Natural-Language Student Evaluation Summary (with Criterion-by-Criterion Breakdown & Improvement Advice)
app.post('/api/gemini/student-evaluation-summary', async (req, res) => {
  const {
    studentFirstName = 'Studente',
    studentLastName = '',
    assignmentTitle = 'Úkol',
    criteriaBreakdown = [],
    teacherComment = '',
    totalPoints = 0,
    maxPoints = 0,
    percentage = 0,
    grade = 5,
    hasZeroVeto = false,
    language = 'cs',
  } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  const levelText = (lvl: number) => {
    if (language === 'pl') return lvl === 3 ? 'spełnione w pełni' : lvl === 2 ? 'spełnione częściowo' : lvl === 1 ? 'spełnione w ograniczonym zakresie' : 'niespełnione';
    if (language === 'en') return lvl === 3 ? 'fully met' : lvl === 2 ? 'partially met' : lvl === 1 ? 'met to a limited extent' : 'not met';
    return lvl === 3 ? 'splnil(a) zcela' : lvl === 2 ? 'splnil(a) částečně' : lvl === 1 ? 'splnil(a) v omezeném rozsahu' : 'nesplnil(a)';
  };

  const perCriterionDetailedLines = (Array.isArray(criteriaBreakdown) ? criteriaBreakdown : [])
    .map((c: any) => {
      const catLabel =
        language === 'pl'
          ? c.category === 'formal' ? 'Formalne' : 'Merytoryczne'
          : language === 'en'
          ? c.category === 'formal' ? 'Formal' : 'Content'
          : c.category === 'formal' ? 'Formální' : 'Obsahové';
      const notePart = c.teacherNote ? ` ${c.teacherNote}` : '';
      const improveAdvice =
        c.level < 3
          ? language === 'pl'
            ? ` Co poprawić: uzupełnić wskaźniki opisane w kryterium („${c.description || c.name}”), aby uzyskać pełne ${c.maxPoints} pkt.`
            : language === 'en'
            ? ` How to improve: explicitly fulfill "${c.description || c.name}" to earn the full ${c.maxPoints} pts.`
            : ` Co zlepšit: dopracovat konkrétní požadavky kritéria („${c.description || c.name}“), abys dosáhl(a) plného počtu ${c.maxPoints} b.`
          : language === 'pl'
          ? ' Kryterium w pełni opanowane – utrzymaj ten poziom.'
          : language === 'en'
          ? ' Fully demonstrated — keep up this standard.'
          : ' Kritérium je splněno v plném rozsahu bez ztráty bodů.';
      return `• [${catLabel}] ${c.name}: ${c.earnedPoints}/${c.maxPoints} b. (${levelText(c.level)}).${notePart}${improveAdvice}`;
    })
    .join('\n');

  const fallbackSummary =
    language === 'pl'
      ? `Cześć ${studentFirstName},\n\ndziękujemy za przesłanie zadania „${assignmentTitle}”. Łącznie zdobyłeś/aś ${totalPoints} z ${maxPoints} punktów (${percentage} %).${hasZeroVeto ? ' Ponieważ w co najmniej jednym kryterium pojawiło się 0 punktów, ocena końcowa to automatycznie 5.' : ''} Twoja ocena końcowa to: ${grade}.\n\nSzczegółowe rozpisanie punktów za poszczególne kryteria:\n${perCriterionDetailedLines}\n\n${teacherComment ? `Komentarz do pracy: ${teacherComment}` : ''}`
      : language === 'en'
      ? `Hi ${studentFirstName},\n\nThank you for submitting "${assignmentTitle}". You earned ${totalPoints} out of ${maxPoints} weighted points (${percentage}%).${hasZeroVeto ? ' Because at least one criterion received 0 points, the final grade is automatically 5.' : ''} Your final grade is ${grade}.\n\nDetailed breakdown by criterion:\n${perCriterionDetailedLines}\n\n${teacherComment ? `Evaluation feedback: ${teacherComment}` : ''}`
      : `Ahoj ${studentFirstName},\n\nděkuji za odevzdání úkolu „${assignmentTitle}“. Za práci jsi získal(a) celkem ${totalPoints} z ${maxPoints} vážených bodů (${percentage} %).${hasZeroVeto ? ' Protože alespoň jedno kritérium bylo ohodnoceno 0 body (nesplněno), výsledná známka je dle pravidel hodnocení 5.' : ''} Tvá výsledná známka za tento úkol je ${grade}.\n\nPodrobný rozpis bodů po jednotlivých kritériích (proč jsi body získal/a a co zlepšit):\n${perCriterionDetailedLines}\n\n${teacherComment ? `Celková evaluace práce: ${teacherComment}` : ''}`;

  if (!ai) {
    return res.json({ summary: fallbackSummary, source: 'curated' });
  }

  try {
    const breakdownStr = (Array.isArray(criteriaBreakdown) ? criteriaBreakdown : [])
      .map(
        (c: any) =>
          `- [${c.category === 'formal' ? 'Formální' : 'Obsahové'}] ${c.name} (váha ${c.weight}): ${levelText(c.level)} (${c.earnedPoints}/${c.maxPoints} b.) | Požadavek kritéria: ${c.description || '-'} | Poznámka hodnotitele ke kritériu: ${c.teacherNote || 'bez poznámky'}`
      )
      .join('\n');

    const prompt = `Jsi empatický a extrémně srozumitelný pedagog, který studentovi předává písemnou zpětnou vazbu z kriteriálního hodnocení.
Převeď následující strukturovaná data do srozumitelného, adresného a motivačního textu v jazyce ${langName}:

Křestní jméno studenta: ${studentFirstName} (Celé jméno: ${studentFirstName} ${studentLastName})
Název úkolu: ${assignmentTitle}
Celkové skóre: ${totalPoints} / ${maxPoints} vážených bodů (${percentage} %)
Nulové veto (0 bodů v některém kritériu => známka 5): ${hasZeroVeto ? 'ANO' : 'NE'}
VÝSLEDNÁ ZNÁMKA (1 nejlepší, 5 propadl): ${grade}

Podrobné výsledky v jednotlivých kritériích:
${breakdownStr}

Komentář učitele k práci:
"${teacherComment || 'Bez doplňujícího komentáře.'}"

POŽADAVKY NA VÝSTUP (VELMI DŮLEŽITÉ):
1. Oslov studenta přímo jeho KŘESTNÍM JMENEM (v češtině a polštině použij správný 5. pád / vokativ, např. „Milý Jakube,“ nebo „Ahoj Emo,“).
2. Jasně uveď celkový výsledek (${totalPoints}/${maxPoints} b., ${percentage} %) a VÝSLEDNOU ZNÁMKU (${grade}). Pokud zafungovalo nulové veto (0 b. v libovolném kritériu -> známka 5), srozumitelně vysvětli proč.
3. PEČLIVĚ ROZEPIŠ KAŽDÉ JEDNOTLIVÉ KRITÉRIUM (použij přehledné odrážky):
   - Uveď přesný bodový zisk (např. 16 / 24 b.) a slovní stupeň splnění.
   - Vysvětli studentovi, ZA CO přesně tento počet bodů získal (vycházej z popisu kritéria a případné poznámky hodnotitele).
   - Pokud nezískal plný počet bodů (tj. úroveň 2, 1 nebo 0), vždy uveď KONKRÉTNÍ NÁVOD, CO PŘÍŠTĚ ZLEPŠIT / DOPLNIT, aby získal maximum bodů.
4. Na závěr přirozeně zapracuj celkovou evaluaci učitele bez jakéhokoliv nálepkování osoby studenta.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    const summary = response.text?.trim() || fallbackSummary;
    return res.json({ summary, source: 'gemini' });
  } catch (err: any) {
    console.error('Student summary error:', err);
    return res.json({ summary: fallbackSummary, source: 'fallback' });
  }
});

// 5. Parse unstructured Google Doc assignment text via AI if needed
app.post('/api/gemini/parse-assignment-doc', async (req, res) => {
  const { rawText = '', docTitle = '', language = 'cs' } = req.body;
  if (!ai) {
    return res.status(400).json({ error: 'Gemini API key unavailable for unstructured text parsing.' });
  }
  try {
    const prompt = `Extrahuj ze zdrojového textu Google Dokumentu strukturované zadání úkolu a hodnoticí kritéria.
Název dokumentu: "${docTitle}"
Text dokumentu:
${rawText.slice(0, 12000)}

Rozděl kritéria na "formal" (formální) a "content" (obsahová) a extrahuj váhu 1-10 (pokud není uvedena, nastav 5).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subject: { type: Type.STRING },
            description: { type: Type.STRING },
            criteria: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['formal', 'content'] },
                  weight: { type: Type.INTEGER },
                },
                required: ['name', 'description', 'category', 'weight'],
              },
            },
          },
          required: ['title', 'description', 'criteria'],
        },
      },
    });
    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    return res.json({ assignment: parsed, source: 'gemini' });
  } catch (err: any) {
    console.error('Doc parse error:', err);
    return res.status(500).json({ error: 'Failed to parse document via AI' });
  }
});

// 6. Observation Sheet (Náslechy) Per-Field AI Assistant
app.post('/api/gemini/observation-assist', async (req, res) => {
  const {
    language = 'cs',
    section = 'reflective',
    fieldKey = '',
    fieldQuestion = '',
    seminarTopic = '',
    dateTime = '',
    currentValue = '',
    isTripleList = false,
  } = req.body;

  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const currentText = Array.isArray(currentValue)
    ? currentValue.filter(Boolean).join(' | ')
    : String(currentValue || '').trim();

  const buildCuratedFallback = () => {
    const topicLabel = seminarTopic || (language === 'en' ? 'this seminar' : language === 'pl' ? 'tego seminarium' : 'tohoto semináře');

    if (language === 'en') {
      if (isTripleList) {
        const items =
          section === 'reflective'
            ? [
                `Specific didactic insight or concept observed during ${topicLabel} (e.g., how a transition or question opened discussion).`,
                `A concrete classroom moment showing how theory connected to practice.`,
                `One personal realization about my own teaching habits or student perspective.`,
              ]
            : [
                `Preserve the clear opening structure / framing that helped orient learners in ${topicLabel}.`,
                `Add a short 2-minute pair-share checkpoint before plenary discussion so quieter students can test ideas.`,
                `Explicitly summarize the main takeaway on the board or slide before concluding.`,
              ];
        return {
          guidingQuestions: [
            'Which concrete observable moment (what was said or done) supports this point?',
            section === 'reflective'
              ? 'Why did this moment stand out for your future teaching?'
              : 'How specifically can the instructor implement this recommendation next time?',
          ],
          pedagogicalTip:
            section === 'reflective'
              ? 'Focus on specific moments you witnessed rather than broad summaries.'
              : 'Actionable recommendations describe a concrete behavior and its expected benefit for learners.',
          suggestedAnswer: items.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          suggestedItems: items,
          source: 'curated',
        };
      }
      return {
        guidingQuestions: [
          `What observable evidence from ${topicLabel} best answers "${fieldQuestion}"?`,
          section === 'reflective'
            ? 'How will you translate this insight into a concrete step in your own teaching?'
            : 'How did students visibly react to the instructor’s approach?',
        ],
        pedagogicalTip:
          section === 'reflective'
            ? 'Connect your observation directly to a concrete classroom decision you want to try or deepen.'
            : 'Keep feedback descriptive and respectful — refer to observable actions and learner responses rather than personality labels.',
        suggestedAnswer: currentText
          ? `${currentText} — Specifically, during ${topicLabel}, this became visible through concrete interaction between the instructor and participants, which suggests...`
          : `During ${topicLabel}, it was clear that... (add a concrete moment or phrase you observed and explain its effect on learning).`,
        source: 'curated',
      };
    }

    if (language === 'pl') {
      if (isTripleList) {
        const items =
          section === 'reflective'
            ? [
                `Konkretna metoda lub koncepcja zaobserwowana podczas zajęć „${topicLabel}”.`,
                `Konkretna reakcja grupy, która pokazała skuteczność zastosowanego podejścia.`,
                `Własny wniosek dotyczący tego, na co chcę zwracać uwagę w mojej praktyce.`,
              ]
            : [
                `Utrzymać przejrzyste wprowadzenie celów i struktury na początku zajęć „${topicLabel}”.`,
                `Dodać krótką 2-minutową pracę w parach przed dyskusją na forum, aby włączyć cichsze osoby.`,
                `Wyraźnie podsumować kluczowy wniosek na zakończenie bloku.`,
              ];
        return {
          guidingQuestions: [
            'Jaka konkretna zaobserwowana sytuacja potwierdza ten punkt?',
            section === 'reflective'
              ? 'Dlaczego ten moment okazał się dla Ciebie ważny?'
              : 'W jaki sposób prowadzący może od razu zastosować tę wskazówkę?',
          ],
          pedagogicalTip:
            section === 'reflective'
              ? 'Odwołuj się do konkretnych sytuacji z lekcji zamiast ogólnych haseł.'
              : 'Dobra rekomendacja opisuje konkretne działanie i jego efekt dla uczących się.',
          suggestedAnswer: items.map((s, i) => `${i + 1}. ${s}`).join('\n'),
          suggestedItems: items,
          source: 'curated',
        };
      }
      return {
        guidingQuestions: [
          `Jakie konkretne sytuacje z zajęć „${topicLabel}” odpowiadają na pytanie: „${fieldQuestion}”?`,
          section === 'reflective'
            ? 'Co konkretnie przeniesiesz z tego doświadczenia do własnego nauczania?'
            : 'Po czym było widać reakcję uczestników?',
        ],
        pedagogicalTip:
          section === 'reflective'
            ? 'Połącz obserwację z konkretnym planem działania w swojej przyszłej klasie.'
            : 'Formułuj informację zwrotną opisowo, bez etykietowania — opisuj zachowanie i jego wpływ na grupę.',
        suggestedAnswer: currentText
          ? `${currentText} — Podczas zajęć „${topicLabel}” było to szczególnie widoczne w sposobie pracy z grupą, co pokazuje, że...`
          : `Podczas zajęć „${topicLabel}” można było zaobserwować, że... (dopisz konkretny przykład z sali i jego wpływ na grupę).`,
        source: 'curated',
      };
    }

    // Czech curated fallback
    if (isTripleList) {
      const items =
        section === 'reflective'
          ? fieldKey === 'delighted'
            ? [
                `Konkrétní moment nebo aktivita ze semináře „${topicLabel}“, která vzbudila aktivní zájem skupiny.`,
                `Způsob, jakým vyučující reagoval na nečekaný dotaz či vstup studentů.`,
                `Práce s tempem hodiny a zapojením všech účastníků do diskuse.`,
              ]
            : [
                `Konkrétní didaktický princip či metoda z tématu „${topicLabel}“, kterou mohu rovnou využít.`,
                `Uvědomění si souvislosti mezi cílem hodiny a zvolenou aktivitou studentů.`,
                `Poznatek o tom, jak malé změny v zadání instrukcí ovlivňují porozumění skupiny.`,
              ]
          : [
              `Zachovat jasné strukturování a aktivní zapojování studentů osvědčené v semináři „${topicLabel}“.`,
              `Zařadit krátký prostor pro formulaci myšlenek ve dvojici (1–2 minuty) před společnou diskusí, aby se zapojili i tišší studenti.`,
              `Závěr hodiny podpořit krátkým shrnutím klíčových bodů či výstupní otázkou pro studenty.`,
            ];
      return {
        guidingQuestions: [
          'Která konkrétní situace, věta nebo aktivita z náslechu tento bod dokládá?',
          section === 'reflective'
            ? 'Proč je právě tento postřeh důležitý pro vaši vlastní učitelskou praxi?'
            : 'Co konkrétně by měl vyučující zachovat nebo vyzkoušet příště jinak a proč?',
        ],
        pedagogicalTip:
          section === 'reflective'
            ? 'Pište konkrétně o tom, co jste přímo zažili a co si z toho odnášíte pro vlastní výuku.'
            : 'Věcné doporučení pro hodnoceného popisuje pozorované chování a jeho dopad na učení skupiny, bez obecných frází.',
        suggestedAnswer: items.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        suggestedItems: items,
        source: 'curated',
      };
    }

    const perFieldHints: Record<string, { q: string[]; tip: string; draft: string }> = {
      application: {
        q: [
          'Ve které konkrétní vyučovací hodině nebo situaci byste tento postup využili?',
          'Jaký jeden malý krok vyzkoušíte hned při nejbližší příležitosti?',
        ],
        tip: 'Propojte pozorování s konkrétním transferem do vlastní praxe (kdy, v jakém předmětu, s jakým efektem).',
        draft: `Poznatky ze semináře „${topicLabel}“ dokážu aplikovat tak, že do vlastní výuky zařadím pozorovaný postup při uvádění úkolu a ověřím si na krátké reflexi žáků, zda podpořil jejich samostatnost.`,
      },
      furtherLearning: {
        q: [
          'Jaká otázka vám po skončení hodiny zůstala otevřená?',
          'Kterou metodu nebo téma byste chtěli vidět či nastudovat hlouběji?',
        ],
        tip: 'Dobrá reflexe identifikuje konkrétní zónu dalšího profesního růstu.',
        draft: `Na základě tématu „${topicLabel}“ bych se chtěl(a) dále zaměřit na prohloubení metod aktivního zapojování méně průbojných studentů a na techniky formativního ověřování porozumění v průběhu hodiny.`,
      },
      expectationsMet: {
        q: [
          'S jakým očekáváním jste na náslech přicházeli a v čem se potvrdilo nebo změnilo?',
          'Co vás oproti původní představě nejvíce překvapilo?',
        ],
        tip: 'Porovnejte své výchozí očekávání s realitou hodiny – i nesoulad může být cenným zjištěním.',
        draft: `V porovnání s mým očekáváním před seminářem „${topicLabel}“ hodina naplnila teoretický rámec a navíc mě příjemně překvapila míra praktického zapojení účastníků v reálném čase.`,
      },
      lessonGoals: {
        q: [
          'Byl cíl sdělen explicitně na začátku, nebo vyplynul z aktivit v průběhu hodiny?',
          'Co konkrétně měli studenti na konci hodiny umět, chápat nebo vyzkoušet?',
        ],
        tip: 'Rozlišujte mezi tím, jak cíl formuloval vyučující, a tím, jak jej vnímal pozorovatel z pohledu studentů.',
        draft: `Cíl semináře „${topicLabel}“ byl představen v úvodu a z pohledu pozorovatele směřoval k tomu, aby si účastníci dokázali propojit probírané pojmy s konkrétní situací v praxi.`,
      },
      methodsAndAchievement: {
        q: [
          'Jaké konkrétní výukové metody vyučující použil (výklad, diskuse, skupinová práce, případová studie)?',
          'Podle jakých důkazů u studentů poznal, že cíle bylo dosaženo?',
        ],
        tip: 'Hodnoťte soulad mezi cílem, zvolenými metodami a závěrečným ověřením (konstruktivistické sladění).',
        draft: `Vyučující kombinoval krátký úvodní výklad s řízenou diskusí a prací na příkladech. Způsob zapojení a závěrečné reakce studentů ukázaly, že cíl hodiny byl naplněn ve většině klíčových bodů.`,
      },
      safeAtmosphere: {
        q: [
          'Jak vyučující reagoval na dotazy, nejistotu nebo případnou chybu studenta?',
          'Jak se studenti zapojovali – hlásili se spontánně a nebáli se nesouhlasit?',
        ],
        tip: 'Popište konkrétní verbální i neverbální projevy, které pocit bezpečí posilovaly nebo oslabovaly.',
        draft: `Atmosféra působila otevřeně a bezpečně: vyučující dával dostatek času na rozmyšlenou, oceňoval i dílčí podněty a na dotazy reagoval věcně bez zlehčování, což podporovalo ochotu ptát se.`,
      },
      improvementsNextTime: {
        q: [
          'Která fáze hodiny ztratila tempo nebo působila pro skupinu méně přehledně?',
          'Jakou konkrétní drobnou úpravu časování nebo zadání by stálo za to příště vyzkoušet?',
        ],
        tip: 'Návrh změny směřujte ke konkrétní části hodiny, nikoli k osobě vyučujícího.',
        draft: `Příště by pomohlo vyhradit o několik minut více na závěrečnou syntézu a zadávat instrukce ke skupinové aktivitě i vizuálně (na tabuli/slidu), aby si studenti zadání nemuseli doptávat.`,
      },
      groupConnection: {
        q: [
          'Jak vyučující navazoval kontakt v úvodu (oční kontakt, pohyb v prostoru, práce se jmény, humor)?',
          'Jak reagoval ve chvíli, kdy pozornost skupiny kolísala?',
        ],
        tip: 'Všímejte si vzájemné interakce – napojení není jen projev vyučujícího, ale i živá odezva skupiny.',
        draft: `Vyučující se se skupinou napojil přirozeným oslovením na začátku, udržoval oční kontakt s celou místností a pružně reagoval na vstupy z publika, čímž udržel pozornost i při náročnějších pasážích.`,
      },
      clarity: {
        q: [
          'Byly odborné pojmy vysvětleny na příkladech a byly instrukce k aktivitám jednoznačné?',
          'Nastal moment, kdy studenti nevěděli, co přesně mají dělat?',
        ],
        tip: 'Rozlišujte srozumitelnost výkladu (hlas, tempo, struktura) a jasnost instrukcí k úkolům.',
        draft: `Výklad byl po stránce tempa, struktury i dikce srozumitelný a opřený o názorné příklady; u složitějších zadání by srozumitelnost ještě zvýšila krátká kontrolní otázka, zda všichni instrukci rozumí.`,
      },
      metaphorAndReason: {
        q: [
          'K čemu byste atmosféru a dynamiku hodiny přirovnali (např. společná plavba, dílna, orchestr, horská túra)?',
          'Co přesně v průběhu hodiny tuto metaforu nejlépe vystihuje?',
        ],
        tip: 'Skvělá metafora zachytí roli vyučujícího i aktivitu studentů a je podložená konkrétním důvodem.',
        draft: `Hodina mi připomínala vedenou řemeslnou dílnu: vyučující na začátku jasně ukázal nástroje a bezpečnostní rámec, pak nechal účastníky zkoušet vlastní postupy a průběžně jim pomáhal dolaďovat detaily.`,
      },
      issuesObserved: {
        q: [
          'Vyskytly se organizační, technické, časové nebo komunikační zádrhely?',
          'Jak na ně vyučující reagoval a jaký měly vliv na průběh hodiny?',
        ],
        tip: 'Pokud se žádný závažný problém neobjevil, uveďte i drobné provozní situace (časový skluz, technika, akustika) a způsob jejich zvládnutí.',
        draft: `Zásadní problémy se v hodině neobjevily; drobným omezením byl pouze mírný časový skluz v prostřední části, který však vyučující věcně vyřešil zkrácením doplňkového příkladu.`,
      },
    };

    const spec = perFieldHints[fieldKey] || {
      q: ['Co konkrétního jste v daném aspektu během hodiny pozorovali?', 'Jaký to mělo dopad na učení a atmosféru?'],
      tip: 'Opřete svou odpověď o konkrétní příklad přímo z pozorovaného semináře.',
      draft: `V průběhu semináře „${topicLabel}“ jsem si všiml(a), že...`,
    };

    return {
      guidingQuestions: spec.q,
      pedagogicalTip: spec.tip,
      suggestedAnswer: currentText ? `${currentText} — ${spec.draft}` : spec.draft,
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildCuratedFallback());
  }

  try {
    const roleGuidance =
      section === 'reflective'
        ? 'Sekce je zaměřena na HODNOTITELE (studenta/pozorovatele) — pomoz mu rozvinout hlubokou sebereflexi, všímavost ke konkrétním momentům a přenos poznatků do vlastní budoucí učitelské praxe.'
        : 'Sekce je zaměřena na HODNOCENÉHO (vyučujícího) — pomoz pozorovateli formulovat věcnou, popisnou, respektující a konkrétní formativní zpětnou vazbu bez jakéhokoliv nálepkování osoby.';

    const prompt = `Jsi zkušený didaktický mentor pro studenty učitelství, kteří píší reflektivní a hodnotící arch z náslechu hodiny.
Téma semináře/hodiny: "${seminarTopic || 'neuvedeno'}"
Datum a čas: "${dateTime || 'neuvedeno'}"
Sekce: ${section} (${roleGuidance})
Otázka v archu: "${fieldQuestion}"
Aktuální poznámky/rozepsaný text studenta: "${currentText || '(student zatím nic nenapsal)'}"
Typ pole: ${isTripleList ? 'Seznam přesně 3 očíslovaných bodů (1., 2., 3.)' : 'Otevřená odpověď'}

ÚKOL:
Pomoz studentovi tuto položku promyslet a naformulovat v jazyce ${langName}.
- Pokud student již něco napsal, navaž na jeho myšlenky a pomoz je konkretizovat a didakticky prohloubit.
- Pokud zatím nic nenapsal, nabídni 2–3 cílené navigační otázky, krátký metodický tip a konkrétní vzorový návrh odpovědi (s místem pro doplnění vlastního zážitku z hodiny).
${isTripleList ? '- Protože jde o 3bodovou otázku, vygeneruj v poli "suggestedItems" přesně 3 konkrétní samostatné body.' : ''}

Vrať PŘESNÝ JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            guidingQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            pedagogicalTip: { type: Type.STRING },
            suggestedAnswer: { type: Type.STRING },
            suggestedItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['guidingQuestions', 'pedagogicalTip', 'suggestedAnswer'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    if (isTripleList && (!Array.isArray(parsed.suggestedItems) || parsed.suggestedItems.length < 3)) {
      const splitLines = String(parsed.suggestedAnswer || '')
        .split('\n')
        .map((l) => l.replace(/^\d+\.\s*/, '').trim())
        .filter(Boolean);
      parsed.suggestedItems = [
        splitLines[0] || parsed.suggestedAnswer || '',
        splitLines[1] || '',
        splitLines[2] || '',
      ];
    }
    return res.json({ ...parsed, source: 'gemini' });
  } catch (err: any) {
    console.error('Observation assist error:', err);
    return res.json(buildCuratedFallback());
  }
});

// ----------------- ADDIE MODEL AI ENDPOINTS -----------------

// 1. Step 1 (Analysis): Clarify, sharpen, and ask follow-up questions
app.post('/api/gemini/addie-analyze', async (req, res) => {
  const {
    language = 'cs',
    analysis = {},
    answeredQuestions = [],
    cycleNumber = 1,
    previousCycleSummary = '',
  } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';

  const challenge = String(analysis.designChallenge || '').trim();
  const target = String(analysis.targetGroup || '').trim();
  const prior = String(analysis.priorKnowledgeAndContinuity || '').trim();
  const resources = String(analysis.availableResources || '').trim();
  const competition = String(analysis.competition || '').trim();
  const cycles = Number(analysis.plannedCycles || 2);

  const buildFallback = () => {
    if (language === 'en') {
      return {
        summaryCritique:
          `Analysis for Cycle ${cycleNumber} (${cycles} planned cycles): Specify measurable target outcomes, prerequisite mastery gaps, and realistic resource constraints so all 5 solutions stay tightly scoped.`,
        refinedSuggestions: {
          designChallenge: challenge
            ? `${challenge} — framed around one verifiable learner problem and tangible output within Cycle ${cycleNumber}.`
            : 'Interactive modular learning experience addressing a clear conceptual bottleneck.',
          targetGroup: target || 'Pre-service teachers / upper-secondary learners with mixed digital fluency.',
          priorKnowledgeAndContinuity:
            prior || 'Builds on foundational concepts covered previously; bridges into independent applied transfer.',
          availableResources:
            resources || 'Limited prep hours, standard browser/classroom equipment, no dedicated external budget.',
          competition:
            competition || 'Existing textbooks and static slide decks lack immediate formative feedback and active agency.',
        },
        clarifyingQuestions: [
          { id: 'aq1', question: 'What exact misunderstanding or skill gap should learners overcome after using this?', answer: '' },
          { id: 'aq2', question: 'Will learners use this solo asynchronously, in pairs, or during a teacher-led block?', answer: '' },
          { id: 'aq3', question: 'What hard constraint (time, device access, reading level) must not be exceeded?', answer: '' },
          { id: 'aq4', question: 'What concrete evidence will prove Cycle 1 worked better than existing alternatives?', answer: '' },
        ],
        source: 'curated',
      };
    }
    if (language === 'pl') {
      return {
        summaryCritique:
          `Analiza dla cyklu ${cycleNumber} (planowane cykle: ${cycles}): Doprecyzuj mierzalny rezultat uczenia się, próg wiedzy wstępnej i ograniczenia czasowe/techniczne.`,
        refinedSuggestions: {
          designChallenge: challenge
            ? `${challenge} — skoncentrowane na jednym kluczowym problemie dydaktycznym i mierzalnym efekcie w cyklu ${cycleNumber}.`
            : 'Interaktywny obiekt edukacyjny lub scenariusz zajęć rozwiązujący konkretne wąskie gardło wiedzy.',
          targetGroup: target || 'Studenci pedagogiki lub uczniowie starszych klas o zróżnicowanym doświadczeniu.',
          priorKnowledgeAndContinuity:
            prior || 'Nawiązuje do podstawowych pojęć teoretycznych i prowadzi do praktycznego zastosowania.',
          availableResources:
            resources || 'Ograniczony czas przygotowania, standardowe wyposażenie sali lub przeglądarka, praca własna.',
          competition:
            competition || 'Istniejące materiały są zbyt statyczne i nie dają natychmiastowej informacji zwrotnej.',
        },
        clarifyingQuestions: [
          { id: 'aq1', question: 'Jaką jedną kluczową trudność pojęciową lub błąd uczniów rozwiązanie musi przełamać?', answer: '' },
          { id: 'aq2', question: 'Czy uczestnicy będą pracować indywidualnie zdalnie, czy w parach podczas zajęć stacjonarnych?', answer: '' },
          { id: 'aq3', question: 'Jakie twarde ograniczenia (czas lekcji, sprzęt, budżet = 0) trzeba bezwzględnie zachować?', answer: '' },
          { id: 'aq4', question: 'Po czym konkretnie poznasz w tym cyklu przewagę nad dotychczasowymi materiałami?', answer: '' },
        ],
        source: 'curated',
      };
    }
    return {
      summaryCritique:
        `Audit zadání pro ${cycleNumber}. cyklus (plánováno ${cycles} cyklů): Pro silný návrh je vhodné zpřesnit měřitelný přínos pro cílovou skupinu, konkrétní návaznost na předchozí učivo a reálné limity zdrojů.`,
      refinedSuggestions: {
        designChallenge: challenge
          ? `${challenge} — zaměřeno na konkrétní didaktický problém s ověřitelným výstupem v ${cycleNumber}. cyklu.`
          : 'Interaktivní vzdělávací objekt nebo strukturovaná výuka řešící konkrétní obtížně pochopitelný koncept.',
        targetGroup: target || 'Cílová skupina s jasně definovaným věkem, motivací a mírou digitální samostatnosti.',
        priorKnowledgeAndContinuity:
          prior || 'Navazuje na základní orientaci v tématu a posouvá studenty od teorie k aktivní aplikaci.',
        availableResources:
          resources || 'Časová dotace učitele/autora, dostupné technologie ve třídě a nulový či nízký finanční rozpočet.',
        competition:
          competition || 'Stávající materiály (prezentace, učebnice) jsou převážně pasivní a nenabízejí individualizovanou zpětnou vazbu.',
      },
      clarifyingQuestions: [
        { id: 'aq1', question: 'Jakou konkrétní chybu nebo neporozumění u cílové skupiny má produkt primárně odstranit?', answer: '' },
        { id: 'aq2', question: 'V jakém režimu bude výstup používán (samostatně doma, ve dvojicích v hodině, s vedením vyučujícího)?', answer: '' },
        { id: 'aq3', question: 'Jaké je nejtvrdší omezení ze zdrojů (např. max. čas přípravy, absence placených licencí, technika ve třídě)?', answer: '' },
        { id: 'aq4', question: 'Čím konkrétně má vaše řešení předčit popsanou konkurenci hned v tomto vývojovém cyklu?', answer: '' },
      ],
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildFallback());
  }

  try {
    const qaSnippet = Array.isArray(answeredQuestions) && answeredQuestions.length > 0
      ? answeredQuestions.map((q: any) => `- Otázka: ${q.question}\n  Odpověď uživatele: ${q.answer || '(nezodpovězeno)'}`).join('\n')
      : '(Zatím žádné doplňující odpovědi)';

    const prompt = `Jsi seniorní instructional designer pracující podle modelu ADDIE.
Uživatel vyplnil vstupní ANALÝZU pro ${cycleNumber}. vývojový cyklus (celkem chce stihnout ${cycles} cyklů):
1) Designová výzva a zamýšlený výstup (${analysis.outputTypeHint === 'classic_lesson' ? 'klasická výuka' : 'digitální vzdělávací objekt'}): "${challenge || '(neuvedeno)'}"
2) Cílová skupina: "${target || '(neuvedeno)'}"
2b) Co už ví a na co objekt navazuje: "${prior || '(neuvedeno)'}"
3) Zdroje k dispozici: "${resources || '(neuvedeno)'}"
4) Konkurence: "${competition || '(neuvedeno)'}"
${previousCycleSummary ? `\nKontext z předchozího iteračního cyklu:\n${previousCycleSummary}` : ''}
${qaSnippet ? `\nDosavadní doplňující otázky a odpovědi uživatele:\n${qaSnippet}` : ''}

ÚKOL (odpověz v jazyce ${langName}):
1. V "summaryCritique" stručně a věcně zhodnoť kvalitu zadání (co je silné, co je ještě vágní a na co si dát pozor při iterativním vývoji).
2. V "refinedSuggestions" navrhni precizovanou, konkrétnější a konstruktivně použitelnou formulaci každého z 5 bodů analýzy tak, aby respektovala vše, co uživatel napsal (včetně jeho odpovědí na doplňující otázky, pokud už nějaké vyplnil).
3. V "clarifyingQuestions" polož 4 konkrétní, pronikavé doptávací otázky, které uživateli pomohou zadání ještě lépe vyostřit.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryCritique: { type: Type.STRING },
            refinedSuggestions: {
              type: Type.OBJECT,
              properties: {
                designChallenge: { type: Type.STRING },
                targetGroup: { type: Type.STRING },
                priorKnowledgeAndContinuity: { type: Type.STRING },
                availableResources: { type: Type.STRING },
                competition: { type: Type.STRING },
              },
              required: ['designChallenge', 'targetGroup', 'priorKnowledgeAndContinuity', 'availableResources', 'competition'],
            },
            clarifyingQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                },
                required: ['id', 'question'],
              },
            },
          },
          required: ['summaryCritique', 'refinedSuggestions', 'clarifyingQuestions'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    const questions = Array.isArray(parsed.clarifyingQuestions)
      ? parsed.clarifyingQuestions.map((q: any, i: number) => {
          const prev = Array.isArray(answeredQuestions)
            ? answeredQuestions.find((pq: any) => pq.id === q.id || pq.question === q.question)
            : null;
          return {
            id: String(q.id || `aq_${i + 1}`),
            question: String(q.question || ''),
            answer: prev ? String(prev.answer || '') : '',
          };
        })
      : buildFallback().clarifyingQuestions;

    return res.json({
      summaryCritique: String(parsed.summaryCritique || ''),
      refinedSuggestions: parsed.refinedSuggestions || buildFallback().refinedSuggestions,
      clarifyingQuestions: questions,
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('ADDIE analyze error:', err);
    return res.json(buildFallback());
  }
});

// 2. Step 2 (Design): Generate 5 genuinely diverse solutions grounded strictly in Analysis
app.post('/api/gemini/addie-design', async (req, res) => {
  const { language = 'cs', analysis = {}, cycleNumber = 1, previousCycleSummary = '' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const challenge = String(analysis.designChallenge || '').trim() || 'Vzdělávací řešení';
  const target = String(analysis.targetGroup || '').trim() || 'Cílová skupina';
  const resources = String(analysis.availableResources || '').trim() || 'Standardní zdroje';

  const buildFallback = () => {
    if (language === 'en') {
      return {
        options: [
          {
            id: 'opt_1',
            title: `Interactive Diagnostic Sandbox for "${challenge.slice(0, 42)}"`,
            archetype: 'Interactive Simulation / Digital Sandbox',
            summary: `Learners manipulate variables directly inside a guided browser simulation tailored for ${target}, receiving immediate conceptual feedback.`,
            targetFit: `Directly addresses ${target} by turning abstract prior concepts into visible cause-and-effect trials.`,
            differentiationFromCompetition: 'Replaces passive reading with hands-on experimentation and instant misconception checks.',
            resourceAlignment: `Built iteratively using lightweight web tools compatible with: ${resources}.`,
            keyFeatures: ['Live parameter experimentation', 'Guided misconception prompts', 'Rapid cycle-1 prototype check'],
          },
          {
            id: 'opt_2',
            title: 'Real-World Case Dilemma Workshop',
            archetype: 'Problem-Based Learning (PBL)',
            summary: `Small teams resolve an authentic scenario anchored in "${challenge}", weighing competing evidence before defending a solution.`,
            targetFit: `Connects prior knowledge of ${target} with applied decision-making.`,
            differentiationFromCompetition: 'Moves beyond textbook drills into open-ended, defensible reasoning.',
            resourceAlignment: `Requires minimal tooling and fits within ${resources}.`,
            keyFeatures: ['Authentic dilemma brief', 'Structured role cards', 'Peer defense rubric'],
          },
          {
            id: 'opt_3',
            title: 'Micro-Learning Flipped Sprint + Retrieval Cards',
            archetype: 'Flipped Micro-Scaffolding',
            summary: `Short 5-minute pre-exposure cards activate prior knowledge before intensive guided practice on "${challenge}".`,
            targetFit: `Reduces cognitive overload for ${target} by chunking prerequisites first.`,
            differentiationFromCompetition: 'Eliminates long monologues in favor of spaced micro-checkpoints.',
            resourceAlignment: `Easy to assemble in iterative batches inside ${resources}.`,
            keyFeatures: ['5-min pre-check', 'Spaced retrieval deck', 'Misconception heatmap'],
          },
          {
            id: 'opt_4',
            title: 'Cooperative Game-Loop & Peer Critique Studio',
            archetype: 'Non-Competitive Gamified Studio',
            summary: `Learners progress through escalating design challenges where pairs unlock next stages by reviewing each other’s reasoning.`,
            targetFit: `Boosts engagement and peer explanation among ${target}.`,
            differentiationFromCompetition: 'Shifts assessment from solitary grading to structured peer dialogue.',
            resourceAlignment: `Adaptable for both digital cards and printable classroom packs within ${resources}.`,
            keyFeatures: ['Progressive challenge tiers', 'Peer-review protocol', 'Shared class synthesis board'],
          },
          {
            id: 'opt_5',
            title: 'Socratic Branching Dialogue Companion',
            archetype: 'Adaptive Guided Inquiry',
            summary: `A branching decision tree or AI-guided dialogue challenges learners’ assumptions step by step without giving away answers prematurely.`,
            targetFit: `Meets ${target} at their exact prior knowledge threshold.`,
            differentiationFromCompetition: 'Offers personalized scaffolding instead of one-size-fits-all worksheets.',
            resourceAlignment: `Deliverable as a single interactive flow or prompt template matching ${resources}.`,
            keyFeatures: ['Adaptive hints', 'Diagnostic branching', 'Personal takeaway summary'],
          },
        ],
        source: 'curated',
      };
    }
    if (language === 'pl') {
      return {
        options: [
          {
            id: 'opt_1',
            title: `Interaktywny symulator i laboratorium („${challenge.slice(0, 38)}”)`,
            archetype: 'Symulacja interaktywna',
            summary: `Uczestnicy (${target}) testują zmienne w bezpiecznym środowisku i obserwują natychmiastowe konsekwencje dydaktyczne.`,
            targetFit: 'Przekłada abstrakcyjne pojęcia wstępne na konkretne manipulacje.',
            differentiationFromCompetition: 'W przeciwieństwie do statycznych prezentacji daje natychmiastową informację zwrotną.',
            resourceAlignment: `Dopasowane do zadeklarowanych zasobów: ${resources}.`,
            keyFeatures: ['Manipulacja parametrami', 'Błyskawiczna weryfikacja hipotez', 'Szybki prototyp do testów'],
          },
          {
            id: 'opt_2',
            title: 'Warsztat studium przypadku (Case Study)',
            archetype: 'Nauczanie problemowe (PBL)',
            summary: `Zespoły rozwiązują autentyczny dylemat osadzony w wyzwaniu „${challenge}”, broniąc decyzji przed grupą.`,
            targetFit: 'Łączy dotychczasową wiedzę grupy z realnym kontekstem.',
            differentiationFromCompetition: 'Zastępuje odtwórcze zadania analizą realnych napięć.',
            resourceAlignment: `Realistyczne do wdrożenia przy zasobach: ${resources}.`,
            keyFeatures: ['Autentyczny scenariusz', 'Karty ról', 'Krótka obrona rozwiązań'],
          },
          {
            id: 'opt_3',
            title: 'Moduł mikro-nauczania + Odwrócona klasa',
            archetype: 'Microlearning i Flipped Classroom',
            summary: 'Krótkie pigułki wiedzy przed zajęciami wyrównują poziom wyjściowy i uwalniają czas na ćwiczenia praktyczne.',
            targetFit: 'Chroni przed przeciążeniem poznawczym.',
            differentiationFromCompetition: 'Zamiast długiego wykładu dostarcza skoncentrowane mikrozadania.',
            resourceAlignment: `Łatwe do rozbudowy w kolejnych cyklach przy zasobach: ${resources}.`,
            keyFeatures: ['5-minutowe wprowadzenie', 'Karty powtórkowe', 'Zadania praktyczne na zajęciach'],
          },
          {
            id: 'opt_4',
            title: 'Kooperacyjne studio z pętlą informacji zwrotnej',
            archetype: 'Niekompetytywna grywalizacja',
            summary: 'Uczestnicy przechodzą przez kolejne etapy tworzenia artefaktu i odblokowują wskazówki poprzez wzajemny przegląd.',
            targetFit: 'Wzmacnia zaangażowanie i argumentację rówieśniczą.',
            differentiationFromCompetition: 'Buduje współpracę zamiast rywalizacji.',
            resourceAlignment: `Zgodne z możliwościami: ${resources}.`,
            keyFeatures: ['Stopniowane wyzwania', 'Protokół recenzji koleżeńskiej', 'Wspólna tablica wniosków'],
          },
          {
            id: 'opt_5',
            title: 'Adaptacyjny przewodnik sokratejski',
            archetype: 'Kierowane odkrywanie (Inquiry)',
            summary: 'Rozgałęziony scenariusz pytań dopasowuje podpowiedzi do poziomu wiedzy wstępnej uczestnika.',
            targetFit: 'Indywidualizuje ścieżkę w ramach jednej grupy.',
            differentiationFromCompetition: 'Elastycznie reaguje na błędy zamiast jednolitych kart pracy.',
            resourceAlignment: `Możliwe do wykonania w jednym cyklu przy zasobach: ${resources}.`,
            keyFeatures: ['Diagnostyczne rozgałęzienia', 'Podpowiedzi bez gotowych odpowiedzi', 'Podsumowanie refleksyjne'],
          },
        ],
        source: 'curated',
      };
    }
    return {
      options: [
        {
          id: 'opt_1',
          title: `Interaktivní simulační laboratoř pro „${challenge.slice(0, 38)}“`,
          archetype: 'Interaktivní simulace / digitální objekt',
          summary: `Cílová skupina (${target}) přímo mění parametry modelu a okamžitě pozoruje dopady v bezpečném experimentálním prostředí.`,
          targetFit: 'Překládá předchozí teoretické znalosti do hmatatelných souvislostí příčiny a následku.',
          differentiationFromCompetition: 'Na rozdíl od pasivních textů či slidů nutí k aktivní manipulaci a okamžitě odhaluje miskoncepce.',
          resourceAlignment: `Navrženo tak, aby šlo v ${cycleNumber}. cyklu realizovat v rámci zdrojů: ${resources}.`,
          keyFeatures: ['Interaktivní ovládání proměnných', 'Okamžitá diagnostická zpětná vazba', 'Rychlý prototyp pro pilotní ověření'],
        },
        {
          id: 'opt_2',
          title: 'Řízená případová dílna (Problem-Based Learning)',
          archetype: 'Badatelský případový seminář',
          summary: `Účastníci ve dvojicích řeší autentické dilema ze zadání „${challenge}“, argumentují důkazy a porovnávají protichůdné varianty.`,
          targetFit: 'Respektuje dosavadní zkušenosti cílové skupiny a propojuje je s reálným rozhodováním.',
          differentiationFromCompetition: 'Oproti běžným učebnicím nepředkládá hotové poučky, ale staví učení na obhajobě vlastního řešení.',
          resourceAlignment: `Nízká technická náročnost, plně v souladu se zdroji: ${resources}.`,
          keyFeatures: ['Autentický scénář z praxe', 'Strukturovaná práce s důkazy', 'Závěrečná obhajoba před skupinou'],
        },
        {
          id: 'opt_3',
          title: 'Mikro-učební sprint s převrácenou přípravou (Flipped Micro)',
          archetype: 'Microlearning + Flipped Classroom',
          summary: 'Krátký 5minutový vstupní impuls srovná výchozí znalosti předem a hlavní čas věnuje aktivnímu tréninku a reflexi.',
          targetFit: 'Vyrovnává rozdíly v tom, co už cílová skupina ví a na co objekt navazuje.',
          differentiationFromCompetition: 'Odstraňuje zdlouhavý frontální výklad a soustředí se na krátké cykly procvičení.',
          resourceAlignment: `Snadno rozšiřitelné napříč iteracemi při zachování zdrojů: ${resources}.`,
          keyFeatures: ['Vstupní diagnostický mikro-kvíz', 'Modulární kartičky úloh', 'Rychlý přenos do praxe'],
        },
        {
          id: 'opt_4',
          title: 'Kooperativní únikový / herní cyklus s vrstevnickou kritikou',
          archetype: 'Nekompetitivní gamifikace & Peer Review',
          summary: 'Týmy procházejí postupnými výzvami a odemykají další úroveň tím, že věcně zhodnotí postup sousedního týmu.',
          targetFit: 'Podporuje vnitřní motivaci a schopnost formulovat kritéria kvality.',
          differentiationFromCompetition: 'Místo izolovaného testování vytváří bezpečnou týmovou dynamiku a vzájemné učení.',
          resourceAlignment: `Lze postavit digitálně i papírově podle možností: ${resources}.`,
          keyFeatures: ['Postupné odemykání výzev', 'Strukturovaná vrstevnická zpětná vazba', 'Sdílená mapa poznatků'],
        },
        {
          id: 'opt_5',
          title: 'Sokratovský větvící se průvodce a adaptivní trenažér',
          archetype: 'Adaptivní řízené objevování',
          summary: 'Rozhodovací dialog vede každého uživatele jinou cestou podle jeho odpovědí a klade naváděcí otázky místo prozrazení řešení.',
          targetFit: 'Přizpůsobuje tempo individuální úrovni předchozích znalostí cílové skupiny.',
          differentiationFromCompetition: 'Nahrazuje jednotný pracovní list dynamickou reakcí na konkrétní chyby či nejistotu.',
          resourceAlignment: `Vhodné pro rychlé nasazení v AI/webovém prostředí v mezích: ${resources}.`,
          keyFeatures: ['Diagnostické větvení kroků', 'Nápovědy odstupňované dle potřeby', 'Individuální závěrečné shrnutí'],
        },
      ],
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildFallback());
  }

  try {
    const prompt = `Jsi expert na pedagogický a instrukční design (model ADDIE).
Na základě uživatelské ANALÝZY navrhni PĚT (5) CO NEJVÍCE ROZMANITÝCH možných řešení problému (od interaktivních digitálních přístupů přes badatelskou/případovou výuku, gamifikaci, adaptivní scénáře až po kooperativní či microlearning modely). Každé řešení musí přímo vycházet z konkrétního zadání uživatele!

ZADÁNÍ UŽIVATELE (Cyklus ${cycleNumber}, plánováno celkem ${analysis.plannedCycles || 2} cyklů):
- Designová výzva a produkt: "${challenge}" (preferovaná povaha výstupu: ${analysis.outputTypeHint === 'classic_lesson' ? 'klasická výuková lekce' : 'digitální vzdělávací objekt / nástroj'})
- Cílová skupina: "${target}"
- Co už ví a na co navazuje: "${analysis.priorKnowledgeAndContinuity || 'neuvedeno'}"
- Dostupné zdroje: "${resources}"
- Konkurence: "${analysis.competition || 'neuvedeno'}"
${previousCycleSummary ? `\nZjištění z předchozího iteračního cyklu:\n${previousCycleSummary}` : ''}

POŽADAVKY (jazyk ${langName}):
- Vygeneruj přesně 5 navzájem výrazně odlišných řešení (různé didaktické archetypy a formy).
- U každého vysvětli:
  - title: výstižný název řešení
  - archetype: didaktický přístup / forma
  - summary: konkrétní popis řešení postavený přímo na uživatelově výzvě
  - targetFit: proč sedí přesně dané cílové skupině a jejím předchozím znalostem
  - differentiationFromCompetition: čím překonává popsanou konkurenci
  - resourceAlignment: jak se vejde do dostupných zdrojů a iterativního tempa
  - keyFeatures: 3 konkrétní klíčové prvky řešení`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  archetype: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  targetFit: { type: Type.STRING },
                  differentiationFromCompetition: { type: Type.STRING },
                  resourceAlignment: { type: Type.STRING },
                  keyFeatures: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['title', 'archetype', 'summary', 'targetFit', 'differentiationFromCompetition', 'resourceAlignment', 'keyFeatures'],
              },
            },
          },
          required: ['options'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    const opts = Array.isArray(parsed.options) && parsed.options.length > 0
      ? parsed.options.slice(0, 5).map((o: any, i: number) => ({
          id: String(o.id || `opt_${i + 1}`),
          title: String(o.title || ''),
          archetype: String(o.archetype || ''),
          summary: String(o.summary || ''),
          targetFit: String(o.targetFit || ''),
          differentiationFromCompetition: String(o.differentiationFromCompetition || ''),
          resourceAlignment: String(o.resourceAlignment || ''),
          keyFeatures: Array.isArray(o.keyFeatures) ? o.keyFeatures.map(String) : [],
        }))
      : buildFallback().options;

    return res.json({ options: opts, source: 'gemini' });
  } catch (err: any) {
    console.error('ADDIE design error:', err);
    return res.json(buildFallback());
  }
});

// 3. Step 3 (Development): Concrete steps, tools, professions & resources keeping strict alignment with Brief
app.post('/api/gemini/addie-develop', async (req, res) => {
  const { language = 'cs', analysis = {}, design = {}, cycleNumber = 1, previousCycleSummary = '' } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const sol = design.editedSolution || {};

  const buildFallback = () => {
    if (language === 'en') {
      return {
        steps: [
          { id: 's1', order: 1, title: 'Scope Lock & Content Skeleton', description: `Extract exact learning milestones from "${analysis.designChallenge || 'the challenge'}" aligned with "${sol.title || 'selected design'}".`, deliverable: 'Validated outline & prerequisite map', duration: '2 hours' },
          { id: 's2', order: 2, title: 'Core Prototype Assembly', description: 'Build the minimal functional interactive object or lesson kit using the available resource stack.', deliverable: 'Working Cycle Prototype v1', duration: '4 hours' },
          { id: 's3', order: 3, title: 'Internal Didactic & Usability Check', description: 'Verify alignment against target group prior knowledge and competition gaps.', deliverable: 'Annotated revision checklist', duration: '1.5 hours' },
          { id: 's4', order: 4, title: 'Micro-Pilot Preparation', description: 'Prepare instructions, timing plan, and observation rubric for Cycle 1 pilot.', deliverable: 'Ready-to-implement package', duration: '1.5 hours' },
        ],
        tools: ['Google Docs / Workspace', 'LLM Prototyping Studio', 'Formative Feedback Sheet', 'Visual Diagramming Tool'],
        professions: ['Didactic Designer / Teacher', 'Subject-Matter Reviewer', 'Interactive Content Builder', 'Target Learner Tester'],
        resourcesAllocation: `Scoped directly to user resources (${analysis.availableResources || 'standard prep capacity'}) with modular components reusable in the next cycle.`,
        alignmentCheckNote: `Every step preserves the original target (${analysis.targetGroup || 'target learners'}) and continuity (${analysis.priorKnowledgeAndContinuity || 'core prerequisites'}).`,
        source: 'curated',
      };
    }
    if (language === 'pl') {
      return {
        steps: [
          { id: 's1', order: 1, title: 'Specyfikacja treści i celów', description: `Rozpisanie kluczowych kroków dla wyzwania „${analysis.designChallenge || ''}” i wybranego rozwiązania „${sol.title || ''}”.`, deliverable: 'Struktura merytoryczna', duration: '2 godz.' },
          { id: 's2', order: 2, title: 'Budowa prototypu roboczego', description: 'Utworzenie materiałów lub obiektu interaktywnego zgodnie z dostępnymi zasobami.', deliverable: 'Prototyp cyklu', duration: '4 godz.' },
          { id: 's3', order: 3, title: 'Weryfikacja spójności z grupą docelową', description: 'Kontrola poziomu trudności względem wiedzy wstępnej oraz przewagi nad konkurencją.', deliverable: 'Lista poprawek', duration: '1,5 godz.' },
          { id: 's4', order: 4, title: 'Przygotowanie wdrożenia i pilotażu', description: 'Opracowanie instrukcji prowadzenia i kart obserwacyjnych na potrzeby ewaluacji.', deliverable: 'Pakiet wdrożeniowy', duration: '1,5 godz.' },
        ],
        tools: ['Dokumenty Google / edytor tekstu', 'Narzędzie do prototypowania / AI Studio', 'Arkusz kryteriów obserwacji'],
        professions: ['Projektant dydaktyczny / Nauczyciel', 'Ekspert merytoryczny', 'Twórca materiałów interaktywnych', 'Tester z grupy docelowej'],
        resourcesAllocation: `Harmonogram dostosowany do zasobów użytkownika (${analysis.availableResources || 'standardowe zasoby'}) w ramach cyklu ${cycleNumber}.`,
        alignmentCheckNote: `Plan zachowuje pełną spójność z wyzwaniem i grupą docelową (${analysis.targetGroup || ''}).`,
        source: 'curated',
      };
    }
    return {
      steps: [
        { id: 's1', order: 1, title: 'Uzamčení scénáře a didaktické kostry', description: `Převedení zvoleného návrhu „${sol.title || 'řešení'}“ do konkrétních výukových kroků navazujících na předchozí znalosti skupiny.`, deliverable: 'Strukturovaný scénář a mapa pojmů', duration: '2 hod' },
        { id: 's2', order: 2, title: 'Tvorba funkčního prototypu / podkladů', description: `Sestavení hlavního vzdělávacího objektu nebo metodických karet pro výzvu „${analysis.designChallenge || ''}“ v mezích dostupných zdrojů.`, deliverable: `Funkční prototyp ${cycleNumber}. cyklu`, duration: '4 hod' },
        { id: 's3', order: 3, title: 'Kontrola souladu s cílovkou a konkurencí', description: 'Ověření srozumitelnosti jazyka pro cílovou skupinu a kontrola, že výstup skutečně překonává slabiny konkurence.', deliverable: 'Revizní protokol prototypu', duration: '1,5 hod' },
        { id: 's4', order: 4, title: 'Příprava pilotního nasazení a sběru dat', description: 'Příprava instrukcí pro studenty/učitele a nastavení hodnoticího archu před implementací.', deliverable: 'Balíček připravený k implementaci', duration: '1,5 hod' },
      ],
      tools: ['Google Docs / sdílený pracovní prostor', 'Google AI Studio / generátor interaktivních objektů', 'Nástroj pro tvorbu vizuálních schémat', 'Formulář pro sběr zpětné vazby'],
      professions: ['Didaktik / autor výuky (garant cílů)', 'Odborný garant předmětu (věcná správnost)', 'Tvůrce digitálního objektu / metodik', 'Pilotní tester z cílové skupiny'],
      resourcesAllocation: `Rozvržení sil přesně respektuje zadané zdroje uživatele („${analysis.availableResources || 'běžné zdroje'}“) a rozděluje práci tak, aby se stihl celý ${cycleNumber}. z ${analysis.plannedCycles || 2} cyklů.`,
      alignmentCheckNote: `Ověřena návaznost na původní zadání: výzva („${String(analysis.designChallenge || '').slice(0, 60)}“), cílová skupina (${analysis.targetGroup || '-'}) a její dosavadní znalosti.`,
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildFallback());
  }

  try {
    const prompt = `Jsi projektový manažer a seniorní didaktik modelu ADDIE ve fázi VÝVOJ (Development).
MUSÍŠ přísně držet původní zadání uživatele z Analýzy i zvolené (a uživatelem upravené) řešení z Návrhu!

PŮVODNÍ ZADÁNÍ (Analýza - Cyklus ${cycleNumber}/${analysis.plannedCycles || 2}):
- Designová výzva: "${analysis.designChallenge || ''}"
- Cílová skupina: "${analysis.targetGroup || ''}"
- Co už ví a na co navazuje: "${analysis.priorKnowledgeAndContinuity || ''}"
- Dostupné zdroje uživatele: "${analysis.availableResources || ''}"
- Konkurence: "${analysis.competition || ''}"

ZVOLENÉ A UPRAVENÉ ŘEŠENÍ (Návrh):
- Název: "${sol.title || ''}"
- Archetyp: "${sol.archetype || ''}"
- Koncept: "${sol.summary || ''}"
- Didaktické zdůvodnění: "${sol.pedagogicalRationale || ''}"
- Osnova: "${sol.structureOutline || ''}"
${previousCycleSummary ? `\nKontext z předchozího cyklu:\n${previousCycleSummary}` : ''}

ÚKOL (odpověz v jazyce ${langName}):
1. Stanov 4 až 6 konkrétních, logicky navazujících KROKŮ VÝVOJE (steps), které se musí odehrát, aby vznikl reálný výstup v rámci tohoto iteračního cyklu.
2. Vypiš konkrétní POUŽITÉ NÁSTROJE (tools) přiměřené zdrojům uživatele.
3. Vypiš potřebné PROFESE / ROLE (professions), které se na vývoji podílejí (i když některé zastane sám uživatel v různých kloboucích).
4. V "resourcesAllocation" popiš konkrétní využití zdrojů z bodu 3 Analýzy.
5. V "alignmentCheckNote" potvrď a shrň, jak vývojový plán drží původní zadání uživatele.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  deliverable: { type: Type.STRING },
                  duration: { type: Type.STRING },
                },
                required: ['title', 'description', 'deliverable', 'duration'],
              },
            },
            tools: { type: Type.ARRAY, items: { type: Type.STRING } },
            professions: { type: Type.ARRAY, items: { type: Type.STRING } },
            resourcesAllocation: { type: Type.STRING },
            alignmentCheckNote: { type: Type.STRING },
          },
          required: ['steps', 'tools', 'professions', 'resourcesAllocation', 'alignmentCheckNote'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps.map((s: any, idx: number) => ({
          id: `dev_step_${idx + 1}_${Date.now()}`,
          order: idx + 1,
          title: String(s.title || ''),
          description: String(s.description || ''),
          deliverable: String(s.deliverable || ''),
          duration: String(s.duration || ''),
        }))
      : buildFallback().steps;

    return res.json({
      steps,
      tools: Array.isArray(parsed.tools) ? parsed.tools.map(String) : buildFallback().tools,
      professions: Array.isArray(parsed.professions) ? parsed.professions.map(String) : buildFallback().professions,
      resourcesAllocation: String(parsed.resourcesAllocation || ''),
      alignmentCheckNote: String(parsed.alignmentCheckNote || ''),
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('ADDIE develop error:', err);
    return res.json(buildFallback());
  }
});

// 4. Step 4 (Implementation Init): Generate copy-ready AI Studio Prompt OR Classic Lesson Plan + at least 5 tuning questions
app.post('/api/gemini/addie-implement-init', async (req, res) => {
  const {
    language = 'cs',
    deliverableMode = 'digital_object',
    analysis = {},
    design = {},
    development = {},
    cycleNumber = 1,
  } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const sol = design.editedSolution || {};
  const isLesson = deliverableMode === 'classic_lesson';

  const buildFallback = () => {
    const questions =
      language === 'en'
        ? [
            { id: 'iq1', question: 'What exact visual tone, interaction pace, or classroom atmosphere do you want learners to experience first?', answer: '' },
            { id: 'iq2', question: 'Should the output emphasize individual self-paced exploration or pair/group collaboration?', answer: '' },
            { id: 'iq3', question: 'Which single hardest concept from prior knowledge needs an extra scaffold or worked example?', answer: '' },
            { id: 'iq4', question: 'How long is one typical session (e.g., 15-min micro-module vs. 45/90-min seminar) and what timing limits apply?', answer: '' },
            { id: 'iq5', question: 'What accessibility, differentiation, or anti-cheating/formative guardrails must be built into the final version?', answer: '' },
          ]
        : language === 'pl'
        ? [
            { id: 'iq1', question: 'Jaki dokładny styl interakcji i pierwsze wrażenie mają odebrać uczestnicy w pierwszych 2 minutach?', answer: '' },
            { id: 'iq2', question: 'Czy materiał ma wspierać głównie pracę indywidualną, czy dialog w parach / małych zespołach?', answer: '' },
            { id: 'iq3', question: 'Które pojęcie wstępne wymaga dodatkowego przykładu lub uproszczonego rusztowania (scaffolding)?', answer: '' },
            { id: 'iq4', question: 'Jaki jest dokładny czas pracy (np. 15 min mikro-zadanie czy 45/90 min lekcji)?', answer: '' },
            { id: 'iq5', question: 'Jakie wymagania dostępności, różnicowania trudności lub oceny formatywnej są dla Ciebie kluczowe?', answer: '' },
          ]
        : [
            { id: 'iq1', question: 'Jakou konkrétní atmosféru, vizuální styl nebo první dojem má objekt/lekce v úvodních 2 minutách vyvolat?', answer: '' },
            { id: 'iq2', question: 'Má výstup primárně vést k samostatné práci jednotlivce, nebo ke kooperaci ve dvojicích a skupinách?', answer: '' },
            { id: 'iq3', question: 'Který konkrétní pojem nebo návaznost z předchozího učiva potřebuje extra oporu (worked example / nápovědu)?', answer: '' },
            { id: 'iq4', question: 'Jaký je přesný časový rámec použití (např. 15min mikro-aktivita vs. 45/90min vyučovací blok)?', answer: '' },
            { id: 'iq5', question: 'Jaká specifika diferenciace (pro slabší/pokročilé žáky) nebo formativní zpětné vazby nesmí chybět?', answer: '' },
          ];

    const artifact = isLesson
      ? language === 'en'
        ? `LESSON PLAN — ${sol.title || analysis.designChallenge || 'ADDIE Cycle ' + cycleNumber}\nTarget Group: ${analysis.targetGroup || '-'}\nPrior Knowledge Continuity: ${analysis.priorKnowledgeAndContinuity || '-'}\n\n1. Warm-Up & Pre-Concept Activation (8 min)\n- Short diagnostic hook connecting prior knowledge to "${analysis.designChallenge || ''}".\n\n2. Guided Exploration / Core Activity (20 min)\n- Learners execute "${sol.title || 'the designed activity'}" using ${development.tools?.join(', ') || 'prepared materials'}.\n\n3. Synthesis & Peer Reflection (12 min)\n- Pairs compare solutions and articulate takeaways.\n\n4. Formative Exit Check (5 min)\n- Quick verification aligned with Cycle ${cycleNumber} goals.`
        : `NÁVRH VYUČOVACÍ LEKCE — ${sol.title || analysis.designChallenge || 'Cyklus ' + cycleNumber}\nCílová skupina: ${analysis.targetGroup || '-'}\nNávaznost na předchozí učivo: ${analysis.priorKnowledgeAndContinuity || '-'}\nZdroje a pomůcky: ${development.tools?.join(', ') || analysis.availableResources || '-'}\n\n1. Evokace a aktivace prekonceptů (7 min)\n- Krátká vstupní situace propojující dosavadní znalosti studentů s výzvou: ${analysis.designChallenge || ''}.\n\n2. Hlavní badatelská / výuková aktivita (22 min)\n- Realizace zvoleného řešení (${sol.archetype || 'aktivní učení'}): ${sol.summary || ''}\n- Role učitele: facilitace, kladení doplňujících otázek, sledování průběžného porozumění.\n\n3. Sdílení, argumentace a syntéza (11 min)\n- Porovnání výsledků mezi skupinami a explicitní překonání častých chyb oproti klasickým materiálům.\n\n4. Formativní ověření a uzavření (5 min)\n- Stručný výstupní check (Exit Ticket) pro vyhodnocení ${cycleNumber}. iteračního cyklu.`
      : language === 'en'
        ? `ROLE & GOAL\nBuild a focused interactive educational web application in React + TypeScript + Tailwind CSS for: ${sol.title || analysis.designChallenge}.\n\nTARGET AUDIENCE & CONTINUITY\n- Learners: ${analysis.targetGroup}\n- Prior knowledge & bridge: ${analysis.priorKnowledgeAndContinuity}\n\nCORE PEDAGOGICAL MECHANISM (${sol.archetype || 'Interactive Sandbox'})\n${sol.summary}\n\nREQUIRED FEATURES\n${(sol.keyFeatures || []).map((f: string, i: number) => `${i + 1}. ${f}`).join('\n') || '1. Interactive exploration\n2. Immediate diagnostic feedback\n3. Guided reflection prompt'}\n\nCOMPETITIVE ADVANTAGE & CONSTRAINTS\n- Differentiate from: ${analysis.competition}\n- Operate cleanly under resources: ${analysis.availableResources}\n- Include light/dark clarity, clean typography, no mock/dead controls, and exportable learner summary.`
        : `ZADÁNÍ PRO GOOGLE AI STUDIO (PROMPT PRO TVORBU VZDĚLÁVACÍHO OBJEKTU — CYKLUS ${cycleNumber})\n\nROLE A CÍL\nVytvoř přehlednou, interaktivní webovou vzdělávací miniaplikaci (React + TypeScript + Tailwind CSS) na téma: ${sol.title || analysis.designChallenge}.\n\nCÍLOVÁ SKUPINA A NÁVAZNOST\n- Pro koho je objekt určen: ${analysis.targetGroup || '-'}\n- Na co navazuje a co uživatel už zná: ${analysis.priorKnowledgeAndContinuity || '-'}\n\nDIDAKTICKÝ KONCEPT (${sol.archetype || 'Interaktivní objekt'})\n${sol.summary || analysis.designChallenge || '-'}\n\nKLÍČOVÉ FUNKCE A STRUKTURA\n${(sol.keyFeatures || []).map((f: string, i: number) => `${i + 1}. ${f}`).join('\n') || '1. Interaktivní manipulace s modelem\n2. Okamžitá formativní zpětná vazba bez prozrazení odpovědi napoprvé\n3. Závěrečná sebereflexe a export výsledku'}\n\nODLIŠENÍ OD KONKURENCE A LIMITY\n- Překonej slabiny konkurence: ${analysis.competition || 'pasivní výklad bez interakce'}\n- Respektuj zdroje a podmínky nasazení: ${analysis.availableResources || 'běžný prohlížeč ve třídě'}\n- Zajisti čisté UI ve světlém i tmavém režimu, bez zbytečného balastu a s jasnými pokyny pro studenty.`;

    return {
      artifactTitle: sol.title || analysis.designChallenge || `ADDIE Cyklus ${cycleNumber}`,
      generatedArtifact: artifact,
      refinementQuestions: questions,
      aiIntroMessage:
        language === 'en'
          ? 'I generated the initial implementation draft and prepared 5 refinement questions below. Answer any of them or tell me in chat what to adjust!'
          : language === 'pl'
          ? 'Przygotowałem wstępny projekt wdrożenia oraz 5 pytań doprecyzowujących poniżej. Odpowiedz na nie lub napisz na czacie, co zmienić!'
          : 'Připravil jsem výchozí implementační zadání a 5 konkrétních ladicích otázek níže. Odpovězte na ně nebo napište do dialogu, jak výstup doladit k vaší naprosté spokojenosti.',
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildFallback());
  }

  try {
    const devStepsText = Array.isArray(development.steps)
      ? development.steps.map((s: any) => `${s.order}. ${s.title}: ${s.description}`).join('\n')
      : '';

    const prompt = `Jsi expert na instructional design a prompt engineering pro vzdělávání.
Připravuješ krok 4 modelu ADDIE (IMPLEMENTACE) pro ${cycleNumber}. vývojový cyklus v režimu:
${isLesson ? 'KLASICKÁ VÝUKOVÁ LEKCE (připrav kompletní, přímo použitelný návrh vyučovací lekce / metodický scénář se stopáží, aktivitami žáků, rolí učitele, pomůckami a ověřením cíle)' : 'VZDĚLÁVACÍ OBJEKT / APLIKACE (připrav kompletní, detailní a rovnou zkopírovatelný PROMPT pro Google AI Studio nebo podobný AI nástroj, který vygeneruje funkční vzdělávací objekt)'}.

KONTEXT Z PŘEDCHOZÍCH FÁZÍ:
- Výzva (Analýza): "${analysis.designChallenge || ''}"
- Cílová skupina: "${analysis.targetGroup || ''}"
- Co už ví a na co navazuje: "${analysis.priorKnowledgeAndContinuity || ''}"
- Zdroje: "${analysis.availableResources || ''}"
- Konkurence: "${analysis.competition || ''}"
- Zvolený Návrh: "${sol.title || ''}" (${sol.archetype || ''}) — ${sol.summary || ''}
- Didaktické zdůvodnění a osnova: "${sol.pedagogicalRationale || ''}" | "${sol.structureOutline || ''}"
- Vývojový plán (kroky & nástroje): ${devStepsText} | Nástroje: ${(development.tools || []).join(', ')}

ÚKOL (odpověz v jazyce ${langName}):
1. V "artifactTitle" uveď název promptu nebo lekce.
2. V "generatedArtifact" napiš plnohodnotný, vysoce strukturovaný a přímo použitelný ${isLesson ? 'návrh lekce' : 'prompt pro Google AI Studio'} (včetně cílů, interakce, pedagogických pojistek a technických/metodických požadavků).
3. V "refinementQuestions" vytvoř PŘESNĚ 5 (minimálně 5!) cílených ladicích otázek na uživatele, které pomohou výstup v dalším dialogu ještě přesněji vyladit podle jeho představ (např. tón, časová dotace, úroveň autonomie žáka, diferenciace, technické nebo organizační detaily).
4. V "aiIntroMessage" napiš krátké přivítání do ladicího dialogu (1-2 věty).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            artifactTitle: { type: Type.STRING },
            generatedArtifact: { type: Type.STRING },
            refinementQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  question: { type: Type.STRING },
                },
                required: ['id', 'question'],
              },
            },
            aiIntroMessage: { type: Type.STRING },
          },
          required: ['artifactTitle', 'generatedArtifact', 'refinementQuestions', 'aiIntroMessage'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    const fb = buildFallback();
    let qs = Array.isArray(parsed.refinementQuestions)
      ? parsed.refinementQuestions.map((q: any, i: number) => ({
          id: String(q.id || `iq_${i + 1}`),
          question: String(q.question || ''),
          answer: '',
        }))
      : fb.refinementQuestions;
    // Guarantee at least 5 questions
    while (qs.length < 5 && fb.refinementQuestions[qs.length]) {
      qs.push(fb.refinementQuestions[qs.length]);
    }

    return res.json({
      artifactTitle: String(parsed.artifactTitle || fb.artifactTitle),
      generatedArtifact: String(parsed.generatedArtifact || fb.generatedArtifact),
      refinementQuestions: qs,
      aiIntroMessage: String(parsed.aiIntroMessage || fb.aiIntroMessage),
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('ADDIE implement-init error:', err);
    return res.json(buildFallback());
  }
});

// 5. Step 4 (Implementation Refinement Dialog): Refine artifact from user's answers + chat message
app.post('/api/gemini/addie-implement-chat', async (req, res) => {
  const {
    language = 'cs',
    deliverableMode = 'digital_object',
    currentArtifact = '',
    refinementQuestions = [],
    dialogHistory = [],
    userMessage = '',
    analysis = {},
  } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const isLesson = deliverableMode === 'classic_lesson';

  const answered = (Array.isArray(refinementQuestions) ? refinementQuestions : []).filter(
    (q: any) => String(q.answer || '').trim().length > 0
  );

  const buildFallback = () => {
    const addendum = [
      ...answered.map((q: any) => `- ${q.question}\n  -> ${q.answer}`),
      ...(userMessage ? [`- ${userMessage}`] : []),
    ].join('\n');

    const updated = addendum
      ? `${currentArtifact}\n\n--- DOLADĚNÍ DLE POŽADAVKŮ UŽIVATELE ---\n${addendum}`
      : currentArtifact;

    return {
      reply:
        language === 'en'
          ? 'I incorporated your refinement answers and instructions directly into the implementation draft. Let me know if you want to adjust timing, tone, or difficulty further.'
          : language === 'pl'
          ? 'Uwzględniłem Twoje odpowiedzi i uwagi bezpośrednio w projekcie wdrożenia. Daj znać, czy chcesz dopracować jeszcze czas, styl lub poziom trudności.'
          : 'Zapracoval jsem vaše odpovědi na ladicí otázky i požadavky přímo do implementačního výstupu vlevo. Chcete ještě upravit tón, časování nebo podporu pro různé skupiny studentů?',
      updatedArtifact: updated,
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildFallback());
  }

  try {
    const qaBlock = (Array.isArray(refinementQuestions) ? refinementQuestions : [])
      .map((q: any, i: number) => `${i + 1}. ${q.question}\n   Odpověď uživatele: ${q.answer || '(zatím nezodpovězeno)'}`)
      .join('\n');

    const chatBlock = (Array.isArray(dialogHistory) ? dialogHistory : [])
      .slice(-8)
      .map((m: any) => `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`)
      .join('\n');

    const prompt = `Jsi spolutvůrce implementačního výstupu v modelu ADDIE (${isLesson ? 'klasická lekce' : 'prompt pro Google AI Studio'}).
Uživatel ladí aktuální verzi výstupu na základě svých odpovědí na otázky a konverzace s tebou.

PŮVODNÍ ZADÁNÍ (Analýza):
- Výzva: "${analysis.designChallenge || ''}"
- Cílová skupina: "${analysis.targetGroup || ''}"

AKTUÁLNÍ TEXT VÝSTUPU (${isLesson ? 'návrh lekce' : 'prompt pro AI Studio'}):
"""
${currentArtifact}
"""

ODPOVĚDI NA 5 LADICÍCH OTÁZEK:
${qaBlock}

DOSAVADNÍ DIALOG:
${chatBlock}

NOVÁ ZPRÁVA UŽIVATELE:
"${userMessage || '(Uživatel požádal o zapracování vyplněných odpovědí z 5 otázek výše.)'}"

ÚKOL (odpověz v jazyce ${langName}):
1. V "updatedArtifact" vrať KOMPLETNÍ, vylepšenou a konzistentní verzi celého ${isLesson ? 'návrhu lekce' : 'promptu pro Google AI Studio'}, do které organicky (ne jen přilepením na konec) zapracuješ všechny uživatelovy odpovědi a novou instrukci.
2. V "reply" stručně shrň, co jsi v textu změnil/vylepšil, a pokud ještě některá z 5 otázek zůstala prázdná nebo vidíš prostor k dalšímu zpřesnění, zdvořile se zeptej.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            updatedArtifact: { type: Type.STRING },
          },
          required: ['reply', 'updatedArtifact'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    return res.json({
      reply: String(parsed.reply || buildFallback().reply),
      updatedArtifact: String(parsed.updatedArtifact || currentArtifact),
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('ADDIE implement-chat error:', err);
    return res.json(buildFallback());
  }
});

// 6. Step 5 (Evaluation): Suggest 5 tailored evaluation methods for the product & target group
app.post('/api/gemini/addie-evaluate', async (req, res) => {
  const {
    language = 'cs',
    analysis = {},
    design = {},
    implementation = {},
    cycleNumber = 1,
    regenerateSeed = 0,
  } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const sol = design.editedSolution || {};

  const buildFallback = () => {
    if (language === 'en') {
      return {
        methods: [
          {
            id: 'ev1',
            title: 'Pre/Post Diagnostic Exit Check',
            methodType: 'Learning Gain Measurement',
            targetMetric: `Conceptual shift on "${analysis.designChallenge?.slice(0, 40) || 'core goal'}"`,
            howToConduct: `Give ${analysis.targetGroup || 'learners'} a 3-question baseline prompt before and an isomorphic transfer item right after.`,
            successCriterion: 'At least 75% of learners resolve the core misconception without hints on the post-item.',
            embeddedFeature: 'Built-in 3-question Pre-Check gate at app launch + automatic isomorphic Post-Check screen displaying learner delta.',
            selected: true,
          },
          {
            id: 'ev2',
            title: 'Think-Aloud Pilot Observation & Friction Telemetry',
            methodType: 'Usability & Cognitive Load Audit',
            targetMetric: 'Clarity of instructions & friction points',
            howToConduct: 'Observe 3–5 representative learners using the Cycle prototype while logging where they hesitate or retry.',
            successCriterion: 'Zero critical dead-ends; learners start the core task within 60 seconds without extra help.',
            embeddedFeature: 'Silent in-app interaction timer, retry counter, and a one-click "Report Confusing Step" micro-flag stored in session log.',
            selected: true,
          },
          {
            id: 'ev3',
            title: 'Student Artifact / Solution Rubric Review',
            methodType: 'Authentic Performance Assessment',
            targetMetric: 'Depth of applied transfer',
            howToConduct: 'Evaluate learner outputs produced during implementation using 3 observable criteria.',
            successCriterion: 'Median score >= 70% across target continuity indicators.',
            embeddedFeature: 'Embedded interactive 3-criterion self-check rubric right before final submission with instant diagnostic feedback.',
            selected: true,
          },
          {
            id: 'ev4',
            title: 'Rapid 2-Minute Pulse Survey (Engagement & Safety)',
            methodType: 'Affective & Motivation Feedback',
            targetMetric: 'Perceived relevance vs. competing materials',
            howToConduct: 'Ask two focused questions: "What helped you learn most?" and "Where did you feel lost or bored?"',
            successCriterion: 'Average clarity/engagement >= 4.0 / 5 and clear prioritization for Cycle ' + (cycleNumber + 1) + '.',
            embeddedFeature: 'Compact 2-question end-of-activity pulse drawer feeding directly into the exportable Teacher Summary JSON.',
            selected: false,
          },
          {
            id: 'ev5',
            title: 'Delayed 7-Day Transfer Check',
            methodType: 'Retention & Durability',
            targetMetric: 'Long-term retention beyond immediate session',
            howToConduct: 'Revisit the core skill one week later with a fresh real-world micro-scenario.',
            successCriterion: 'Learners independently apply the concept without repeating introductory scaffolding.',
            embeddedFeature: 'Built-in "Follow-Up Transfer Challenge" unlockable mode with shareable verification code for teachers.',
            selected: false,
          },
        ],
        source: 'curated',
      };
    }
    if (language === 'pl') {
      return {
        methods: [
          {
            id: 'ev1',
            title: 'Test przyrostu wiedzy (Pre / Post)',
            methodType: 'Ewaluacja efektów uczenia się',
            targetMetric: 'Przełamanie błędnych przekonań wstępnych',
            howToConduct: `Przeprowadź krótką diagnozę przed i po pracy z „${sol.title || 'produktem'}”.`,
            successCriterion: 'Co najmniej 75 % grupy poprawnie stosuje pojęcie w zadaniu transferowym.',
            embeddedFeature: 'Wbudowany 3-pytaniowy ekran startowy Pre-Test i końcowy Post-Test z porównaniem wyniku ucznia.',
            selected: true,
          },
          {
            id: 'ev2',
            title: 'Obserwacja głośnego myślenia i telemetria trudności',
            methodType: 'Test użyteczności i zrozumiałości',
            targetMetric: 'Bariery w instrukcjach i interfejsie',
            howToConduct: `Poproś 3–5 osób z grupy (${analysis.targetGroup || 'docelowej'}) o wykonanie zadania na głos.`,
            successCriterion: 'Brak blokujących momentów niezrozumienia poleceń.',
            embeddedFeature: 'Wbudowany licznik powtórzeń i przycisk „Zgłoś niejasny krok” zapisujący moment zawahania w raporcie.',
            selected: true,
          },
          {
            id: 'ev3',
            title: 'Kryterialna ocena powstałego artefaktu',
            methodType: 'Ocena autentycznego wytworu',
            targetMetric: 'Jakość praktycznego zastosowania',
            howToConduct: 'Sprawdź prace uczestników według 3 mierzalnych kryteriów obserwowalnych.',
            successCriterion: 'Średni wynik grupy przekracza 70 %.',
            embeddedFeature: 'Interaktywna checklista 3 obserwowalnych kryteriów wbudowana w ekran podsumowania ucznia.',
            selected: true,
          },
          {
            id: 'ev4',
            title: 'Mikro-ankieta porównawcza z konkurencją',
            methodType: 'Odbiór i motywacja',
            targetMetric: 'Postrzegana przewaga nad dotychczasowymi materiałami',
            howToConduct: 'Zadaj 2 pytania otwarte o najbardziej pomocny i najbardziej mylący element.',
            successCriterion: 'Konkretna lista ulepszeń do kolejnego cyklu.',
            embeddedFeature: 'Krótka karta ewaluacyjna na zakończenie sesji z eksportem odpowiedzi do pliku JSON dla nauczyciela.',
            selected: false,
          },
          {
            id: 'ev5',
            title: 'Odroczony test transferu (po 7 dniach)',
            methodType: 'Trwałość wiedzy',
            targetMetric: 'Samodzielne użycie umiejętności w nowym kontekście',
            howToConduct: 'Zaproponuj krótkie zadanie powtórkowe po tygodniu od wdrożenia.',
            successCriterion: 'Większość uczestników rozwiązuje zadanie bez powrotu do samouczka.',
            embeddedFeature: 'Osobny tryb „Zadanie powtórkowe po 7 dniach” generujący krótki raport postępu.',
            selected: false,
          },
        ],
        source: 'curated',
      };
    }
    return {
      methods: [
        {
          id: 'ev1',
          title: 'Vstupní a výstupní diagnostický mikro-test (Pre/Post)',
          methodType: 'Měření posunu učení',
          targetMetric: `Překonání výchozí miskoncepce v tématu „${String(analysis.designChallenge || '').slice(0, 36)}“`,
          howToConduct: `Zadejte cílové skupině (${analysis.targetGroup || 'studentům'}) 3 krátké aplikační otázky před použitím výstupu a obdobnou přenosovou úlohu ihned po něm.`,
          successCriterion: 'Alespoň 75 % účastníků vyřeší výstupní transferovou úlohu samostatně bez nápovědy.',
          embeddedFeature: 'Vestavěná vstupní 3otázková rozcvička při spuštění objektu a navazující výstupní výzva se zobrazením posunu studenta.',
          selected: true,
        },
        {
          id: 'ev2',
          title: 'Sledování záseků a srozumitelnosti kroků (Think-Aloud + Telemetrie)',
          methodType: 'Test srozumitelnosti a uživatelské přívětivosti',
          targetMetric: 'Kde se uživatel zasekává nebo tápe v instrukcích',
          howToConduct: 'Nechte 3 až 5 lidí z cílové skupiny projít prototyp a sledujte čas na první krok i opakované chybné pokusy.',
          successCriterion: 'Uživatelé zahájí hlavní činnost do 60 sekund bez nutnosti vysvětlování navíc.',
          embeddedFeature: 'Tiché počítadlo pokusů/času na krok a nenápadné tlačítko „Tady jsem si nebyl(a) jistý(á)“ ukládané do exportu pro učitele.',
          selected: true,
        },
        {
          id: 'ev3',
          title: 'Kriteriální sebehodnocení a kontrola vzniklého výstupu',
          methodType: 'Formativní evaluace artefaktů',
          targetMetric: 'Skutečná kvalita aplikace nových poznatků',
          howToConduct: 'Zhodnoťte odevzdané výsledky nebo odpovědi studentů podle 3 pozorovatelných kritérií bez subjektivních dojmů.',
          successCriterion: 'Minimálně 70 % výstupů prokáže přenos nad rámec pouhého zopakování definic.',
          embeddedFeature: 'Interaktivní 3bodová rubrika přímo před odevzdáním v aplikaci + export splněných kritérií do JSON/souhrnu.',
          selected: true,
        },
        {
          id: 'ev4',
          title: 'Blesková zpětná vazba: Srovnání se stávajícími materiály (Exit Ticket)',
          methodType: 'Srovnání s konkurencí & motivace',
          targetMetric: 'Vnímaná užitečnost a pocit bezpečí při učení',
          howToConduct: 'Na konci položte dvě otázky: „Co vám pomohlo nejvíce?“ a „Co bylo zbytečně složité oproti běžné výuce?“',
          successCriterion: 'Konkrétní seznam 2–3 úprav připravených přímo pro další iterační cyklus ADDIE.',
          embeddedFeature: 'Závěrečný dvouotázkový Exit Ticket modal v aplikaci se souhrnným přehledem v záložce Evaluace.',
          selected: false,
        },
        {
          id: 'ev5',
          title: 'Odložený test transferu po 7 dnech',
          methodType: 'Trvanlivost a přenos v praxi (Kirkpatrick L3)',
          targetMetric: 'Udržení dovednosti s odstupem času',
          howToConduct: 'Po týdnu předložte krátký nový scénář bez předchozího připomínání teorie a sledujte samostatné využití postupu.',
          successCriterion: 'Většina cílové skupiny dokáže postup aktivně použít v novém kontextu.',
          embeddedFeature: 'Přepínatelný režim „Návratový test po týdnu“ s vyhodnocením samostatnosti bez nápovědy.',
          selected: false,
        },
      ],
      source: 'curated',
    };
  };

  if (!ai) {
    return res.json(buildFallback());
  }

  try {
    const prompt = `Jsi expert na pedagogickou evaluaci (Kirkpatrickův model, formativní evaluace, UX testování ve vzdělávání) a návrh vzdělávacího softwaru.
Navrhni PĚT (5) konkrétních, rozmanitých a prakticky proveditelných způsobů EVALUACE šitých přesně na míru tomuto produktu a cílové skupině (Cyklus ${cycleNumber}, variační seed ${regenerateSeed}).
DŮLEŽITÉ: Každý evaluační nástroj musí být navržen tak, aby šel PŘÍMO IMPLEMENTOVAT DO VÝSLEDNÉHO VZDĚLÁVACÍHO OBJEKTU / APLIKACE (nikoli jen jako oddělený papírový dotazník).

PRODUKT A KONTEXT:
- Výzva: "${analysis.designChallenge || ''}"
- Zvolené řešení: "${sol.title || ''}" (${sol.archetype || ''})
- Režim výstupu: ${implementation.deliverableMode === 'classic_lesson' ? 'Klasická výuková lekce' : 'Digitální vzdělávací objekt'}
- Název/zaměření výstupu: "${implementation.artifactTitle || ''}"
- Cílová skupina: "${analysis.targetGroup || ''}"
- Na co navazuje: "${analysis.priorKnowledgeAndContinuity || ''}"
- Dostupné zdroje: "${analysis.availableResources || ''}"

ÚKOL (odpověz v jazyce ${langName}):
Vygeneruj 5 konkrétních způsobů evaluace (každý z jiného úhlu: např. měření posunu učení, uživatelské/didaktické pozorování pilotu, kriteriální evaluace výstupů studentů, srovnání s konkurencí / vnímaný přínos, odložený transfer v čase).
U každé položky uveď:
- title: název evaluační metody
- methodType: typ evaluace (krátký štítek)
- targetMetric: co konkrétně měří nebo sleduje
- howToConduct: přesný postup, jak evaluaci s touto cílovou skupinou provést v mezích dostupných zdrojů
- successCriterion: měřitelné kritérium úspěchu (kdy řekneme, že cyklus uspěl)
- embeddedFeature: konkrétní UI prvek nebo funkce zabudovaná PŘÍMO uvnitř vyvíjeného objektu (např. vestavěný pre/post mikro-test, log záseků a export dat z evaluace pro učitele)`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            methods: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  methodType: { type: Type.STRING },
                  targetMetric: { type: Type.STRING },
                  howToConduct: { type: Type.STRING },
                  successCriterion: { type: Type.STRING },
                  embeddedFeature: { type: Type.STRING },
                },
                required: ['title', 'methodType', 'targetMetric', 'howToConduct', 'successCriterion', 'embeddedFeature'],
              },
            },
          },
          required: ['methods'],
        },
      },
    });

    const parsed = safeParseGeminiJson<Record<string, any>>(response.text, {});
    const methods = Array.isArray(parsed.methods) && parsed.methods.length > 0
      ? parsed.methods.slice(0, 5).map((m: any, i: number) => ({
          id: `ev_${Date.now()}_${i + 1}`,
          title: String(m.title || ''),
          methodType: String(m.methodType || ''),
          targetMetric: String(m.targetMetric || ''),
          howToConduct: String(m.howToConduct || ''),
          successCriterion: String(m.successCriterion || ''),
          embeddedFeature: String(m.embeddedFeature || ''),
          selected: i < 3,
          isCustom: false,
        }))
      : buildFallback().methods;

    return res.json({ methods, source: 'gemini' });
  } catch (err: any) {
    console.error('ADDIE evaluate error:', err);
    return res.json(buildFallback());
  }
});

// 7. Compile Unified Master Google AI Studio Prompt (weaving Steps 1-5 + embedded evaluation tools directly into the object)
app.post('/api/gemini/addie-compile-final-prompt', async (req, res) => {
  const { language = 'cs', projectTitle = '', cycle = {} } = req.body;
  const langName = language === 'pl' ? 'Polish' : language === 'en' ? 'English' : 'Czech';
  const analysis = cycle.analysis || {};
  const design = cycle.design || {};
  const sol = design.editedSolution || {};
  const development = cycle.development || {};
  const implementation = cycle.implementation || {};
  const evaluation = cycle.evaluation || {};
  const selectedEval = (Array.isArray(evaluation.methods) ? evaluation.methods : []).filter(
    (m: any) => m.selected
  );
  const devSteps = Array.isArray(development.steps) ? development.steps : [];
  const answeredQs = (Array.isArray(implementation.refinementQuestions)
    ? implementation.refinementQuestions
    : []
  ).filter((q: any) => String(q.answer || '').trim());

  const buildFallbackPrompt = () => {
    const evalLines = selectedEval.length
      ? selectedEval
          .map(
            (m: any, i: number) =>
              `${i + 1}. ${m.title} (${m.methodType}): ${m.embeddedFeature || m.howToConduct} [Kritérium: ${m.successCriterion}]`
          )
          .join('\n')
      : language === 'en'
      ? '1. Built-in 3-item Pre/Post diagnostic check + learner reflection pulse + exportable JSON/summary report.'
      : language === 'pl'
      ? '1. Wbudowany mikro-test Pre/Post + szybka ocena zrozumiałości + eksport raportu JSON.'
      : '1. Vestavěný 3otázkový vstupní/výstupní mikro-test + rychlý ukazatel srozumitelnosti + export výsledků evaluace v JSON/textu.';

    const stepLines = devSteps.length
      ? devSteps.map((s: any) => `${s.order}. ${s.title} (${s.duration}) — ${s.description} -> [${s.deliverable}]`).join('\n')
      : '1. Core Scenario -> 2. Interactive Prototype -> 3. Embedded Evaluation Module';

    if (language === 'en') {
      return [
        `GOOGLE AI STUDIO MASTER PROMPT — ${implementation.artifactTitle || sol.title || projectTitle}`,
        ``,
        `## STEP 1 (A — ANALYSIS)`,
        `- Challenge: ${analysis.designChallenge || '-'}`,
        `- Target Group: ${analysis.targetGroup || '-'}`,
        `- Prior Knowledge & Continuity: ${analysis.priorKnowledgeAndContinuity || '-'}`,
        `- Available Resources: ${analysis.availableResources || '-'}`,
        `- Differentiation from Competition: ${analysis.competition || '-'}`,
        ``,
        `## STEP 2 (D — DESIGN)`,
        `- Chosen Solution: ${sol.title || '-'} (${sol.archetype || '-'})`,
        `- Concept: ${sol.summary || '-'}`,
        `- Key Features: ${(sol.keyFeatures || []).filter(Boolean).join('; ') || '-'}`,
        ``,
        `## STEP 3 (D — DEVELOPMENT)`,
        stepLines,
        `- Tools: ${(development.tools || []).join(', ') || 'React, TypeScript, Tailwind CSS'}`,
        `- Roles: ${(development.professions || []).join(', ') || 'Instructional Designer, Developer'}`,
        ``,
        `## STEP 4 (I — IMPLEMENTATION)`,
        implementation.generatedArtifact || '-',
        answeredQs.length ? `\nRefinement Answers:\n${answeredQs.map((q: any) => `- ${q.question} -> ${q.answer}`).join('\n')}` : '',
        ``,
        `## STEP 5 (E — EMBEDDED EVALUATION TOOLS INSIDE THE OBJECT)`,
        `Build these evaluation tools directly into the application UI and provide a one-click Teacher Evaluation Export:`,
        evalLines,
        ``,
        `## STEP 6 (EXECUTION & UX RULES)`,
        `- Clearly separate learner stages with green completion states when completed so users always know what to do next.`,
        `- Persist state & evaluation telemetry in localStorage and allow exporting results for the next ADDIE cycle.`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    return [
      `KOMPLETNÍ PROMPT PRO GOOGLE AI STUDIO — ${implementation.artifactTitle || sol.title || projectTitle}`,
      ``,
      `## KROK 1 (A — ANALÝZA): VÝZVA A CÍLOVÁ SKUPINA`,
      `- Designová výzva: ${analysis.designChallenge || '-'}`,
      `- Cílová skupina: ${analysis.targetGroup || '-'}`,
      `- Vstupní znalosti a návaznost: ${analysis.priorKnowledgeAndContinuity || '-'}`,
      `- Dostupné zdroje: ${analysis.availableResources || '-'}`,
      `- Odlišení od konkurence: ${analysis.competition || '-'}`,
      ``,
      `## KROK 2 (D — NÁVRH): DIDAKTICKÁ ARCHITEKTURA`,
      `- Zvolené řešení: ${sol.title || '-'} (${sol.archetype || '-'})`,
      `- Hlavní princip: ${sol.summary || '-'}`,
      `- Klíčové prvky: ${(sol.keyFeatures || []).filter(Boolean).join('; ') || '-'}`,
      ``,
      `## KROK 3 (D — VÝVOJ): KROKY, NÁSTROJE A ROLE`,
      stepLines,
      `- Nástroje: ${(development.tools || []).join(', ') || 'React, TypeScript, Tailwind CSS'}`,
      `- Profese / role: ${(development.professions || []).join(', ') || 'Didaktik, Vývojář'}`,
      ``,
      `## KROK 4 (I — IMPLEMENTACE): CHOVÁNÍ OBJEKTU / LEKCE`,
      implementation.generatedArtifact || '-',
      answeredQs.length ? `\nZapracovaná upřesnění:\n${answeredQs.map((q: any) => `- ${q.question} -> ${q.answer}`).join('\n')}` : '',
      ``,
      `## KROK 5 (E — EVALUAČNÍ NÁSTROJE PŘÍMO V OBJEKTU)`,
      `Implementuj následující evaluační nástroje přímo do uživatelského rozhraní výsledného objektu (včetně panelu Evaluace a exportu dat pro učitele):`,
      evalLines,
      ``,
      `## KROK 6: STRUKTURA A AKČNÍ POŽADAVKY PRO AI STUDIO`,
      `- Jednotlivé kroky práce uživatele jasně odděl a po vyplnění/splnění je vizuálně zvýrazni zeleně, aby bylo vždy jasné, co je hotovo a co dělat dál.`,
      `- Ukládej postup i evaluační data v localStorage a umožni jejich stažení pro další iterační cyklus ADDIE.`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  if (!ai) {
    return res.json({ finalPrompt: buildFallbackPrompt(), source: 'curated' });
  }

  try {
    const devText = devSteps
      .map((s: any) => `${s.order}. ${s.title} (${s.duration}): ${s.description} -> ${s.deliverable}`)
      .join('\n');
    const evalText = selectedEval
      .map(
        (m: any, i: number) =>
          `${i + 1}. ${m.title} [${m.methodType}]\n   - Co měří: ${m.targetMetric}\n   - Jak provést: ${m.howToConduct}\n   - Požadovaná implementace uvnitř objektu: ${m.embeddedFeature || m.howToConduct}\n   - Kritérium úspěchu: ${m.successCriterion}`
      )
      .join('\n');
    const qaText = answeredQs.map((q: any) => `- ${q.question} => ${q.answer}`).join('\n');

    const prompt = `Jsi špičkový instructional designer a prompt architekt pro Google AI Studio.
Tvým úkolem je vytvořit JEDEN UCELLENÝ, PŘÍMO KOPÍROVATELNÝ A SPUSTITELNÝ PROMPT pro Google AI Studio v jazyce ${langName}, který:
1) Má naprosto jasnou, přehlednou strukturu po jednotlivých krocích (KROK 1 Analýza, KROK 2 Návrh, KROK 3 Vývoj, KROK 4 Implementace, KROK 5 Zabudované evaluační nástroje, KROK 6 UX a ověřovací checklist), takže kdokoliv prompt otevře, ihned vidí jednotlivé kroky a přesně ví, co se staví a co má objekt dělat.
2) Přímo do vyvíjeného objektu / aplikace INTEGRUJE všechny vybrané evaluační nástroje z Kroku 5 (např. jako vestavěný vstupní/výstupní mikro-test, počítadlo záseků, interaktivní sebehodnoticí rubriku, exit ticket či export evaluačního JSON/reportu pro učitele), nikoli jako poznámku mimo objekt!

VSTUPNÍ DATA Z MODELU ADDIE (Cyklus ${cycle.cycleNumber || 1} z ${analysis.plannedCycles || 1}):
Název projektu: "${projectTitle || implementation.artifactTitle || sol.title || ''}"
Režim: ${implementation.deliverableMode === 'classic_lesson' ? 'Klasická výuková lekce + interaktivní digitální doprovod' : 'Interaktivní digitální vzdělávací objekt (React + TypeScript + Tailwind CSS)'}

[1. ANALÝZA]
- Výzva: ${analysis.designChallenge || '-'}
- Cílová skupina: ${analysis.targetGroup || '-'}
- Vstupní znalosti a návaznost: ${analysis.priorKnowledgeAndContinuity || '-'}
- Zdroje: ${analysis.availableResources || '-'}
- Konkurence: ${analysis.competition || '-'}

[2. NÁVRH]
- Název řešení: ${sol.title || '-'} (${sol.archetype || '-'})
- Koncept: ${sol.summary || '-'}
- Pedagogické zdůvodnění: ${sol.pedagogicalRationale || '-'}
- Osnova: ${sol.structureOutline || '-'}
- Klíčové prvky: ${(sol.keyFeatures || []).filter(Boolean).join('; ')}

[3. VÝVOJ]
${devText || '-'}
- Nástroje: ${(development.tools || []).join(', ') || '-'}
- Profese: ${(development.professions || []).join(', ') || '-'}
- Alokace zdrojů: ${development.resourcesAllocation || '-'}

[4. IMPLEMENTACE & LADĚNÍ]
${implementation.generatedArtifact || '-'}
${qaText ? `\nOdpovědi na ladicí otázky:\n${qaText}` : ''}
${implementation.implementationNotes ? `\nPoznámky k nasazení: ${implementation.implementationNotes}` : ''}

[5. ZABUDOVANÉ EVALUAČNÍ NÁSTROJE]
${evalText || 'Vestavěný Pre/Post mikro-test, sledování porozumění a export dat z evaluace pro další cyklus.'}
${evaluation.nextCycleFocus ? `Zaměření pro další cyklus: ${evaluation.nextCycleFocus}` : ''}

VÝSTUP:
Vrať přímo čistý text finálního strukturovaného promptu (včetně jasných nadpisů jednotlivých kroků, technických požadavků na vestavěné evaluační komponenty a akčních pravidel pro Google AI Studio). Nepřidávej úvodní zdvořilostní věty typu "Zde je váš prompt".`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
    });

    const finalPrompt = response.text?.trim() || buildFallbackPrompt();
    return res.json({ finalPrompt, source: 'gemini' });
  } catch (err: any) {
    console.error('ADDIE compile-final-prompt error:', err);
    return res.json({ finalPrompt: buildFallbackPrompt(), source: 'fallback' });
  }
});

// Mount Vite or static server
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
