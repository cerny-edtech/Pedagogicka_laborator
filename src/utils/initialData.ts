import { Student, SeatingPairRule, JournalPrompt, SeasonalCover, EducationalObject, NvcNeed, WellbeingExercise, CalendarTask } from '../types';

export const INITIAL_STUDENTS: Student[] = [
  { id: 's1', lastName: 'Novák', firstName: 'Jan', gender: 'M', grades: { math: [3, 4, 3], nativeLang: [2, 3], science: [3, 4], history: [2, 2], foreignLang: [3, 3], art: [1, 1] } },
  { id: 's2', lastName: 'Svobodová', firstName: 'Eva', gender: 'F', grades: { math: [1, 2, 1], nativeLang: [1, 1], science: [1, 2], history: [1, 1], foreignLang: [1, 2], art: [1, 1] } },
  { id: 's3', lastName: 'Dvořák', firstName: 'Tomáš', gender: 'M', grades: { math: [4, 5, 4], nativeLang: [3, 4], science: [4, 4], history: [3, 3], foreignLang: [4, 5], art: [2, 2] } },
  { id: 's4', lastName: 'Černá', firstName: 'Tereza', gender: 'F', grades: { math: [2, 2, 3], nativeLang: [1, 2], science: [2, 3], history: [1, 2], foreignLang: [2, 1], art: [1, 1] } },
  { id: 's5', lastName: 'Procházka', firstName: 'Filip', gender: 'M', grades: { math: [4, 4, 5], nativeLang: [4, 3], science: [5, 4], history: [3, 4], foreignLang: [4, 4], art: [3, 2] } },
  { id: 's6', lastName: 'Kučerová', firstName: 'Adéla', gender: 'F', grades: { math: [1, 1, 2], nativeLang: [1, 1], science: [1, 1], history: [1, 2], foreignLang: [1, 1], art: [1, 1] } },
  { id: 's7', lastName: 'Veselý', firstName: 'David', gender: 'M', grades: { math: [2, 3, 2], nativeLang: [2, 2], science: [3, 2], history: [2, 3], foreignLang: [2, 2], art: [1, 2] } },
  { id: 's8', lastName: 'Horáková', firstName: 'Lucie', gender: 'F', grades: { math: [3, 3, 4], nativeLang: [2, 3], science: [3, 3], history: [2, 2], foreignLang: [3, 2], art: [1, 1] } },
  { id: 's9', lastName: 'Marek', firstName: 'Martin', gender: 'M', grades: { math: [5, 4, 5], nativeLang: [4, 4], science: [4, 5], history: [4, 4], foreignLang: [5, 4], art: [2, 3] } },
  { id: 's10', lastName: 'Pospíšilová', firstName: 'Kristýna', gender: 'F', grades: { math: [2, 1, 2], nativeLang: [1, 1], science: [2, 2], history: [1, 1], foreignLang: [1, 2], art: [1, 1] } },
  { id: 's11', lastName: 'Němec', firstName: 'Jakub', gender: 'M', grades: { math: [3, 2, 3], nativeLang: [3, 2], science: [2, 3], history: [2, 2], foreignLang: [3, 3], art: [1, 2] } },
  { id: 's12', lastName: 'Benešová', firstName: 'Veronika', gender: 'F', grades: { math: [3, 4, 4], nativeLang: [3, 3], science: [4, 3], history: [3, 3], foreignLang: [3, 4], art: [2, 1] } },
  { id: 's13', lastName: 'Kratochvíl', firstName: 'Ondřej', gender: 'M', grades: { math: [1, 2, 1], nativeLang: [2, 1], science: [1, 2], history: [2, 1], foreignLang: [1, 1], art: [1, 1] } },
  { id: 's14', lastName: 'Fialová', firstName: 'Barbora', gender: 'F', grades: { math: [4, 4, 3], nativeLang: [3, 3], science: [4, 4], history: [3, 4], foreignLang: [3, 3], art: [2, 2] } },
  { id: 's15', lastName: 'Urban', firstName: 'Michal', gender: 'M', grades: { math: [2, 2, 3], nativeLang: [2, 3], science: [3, 2], history: [2, 2], foreignLang: [2, 3], art: [1, 1] } },
  { id: 's16', lastName: 'Sedláčková', firstName: 'Klára', gender: 'F', grades: { math: [1, 1, 1], nativeLang: [1, 2], science: [1, 1], history: [1, 1], foreignLang: [1, 1], art: [1, 1] } },
  { id: 's17', lastName: 'Kovář', firstName: 'Lukáš', gender: 'M', grades: { math: [3, 4, 4], nativeLang: [4, 3], science: [3, 4], history: [4, 3], foreignLang: [4, 4], art: [2, 3] } },
  { id: 's18', lastName: 'Šimková', firstName: 'Eliška', gender: 'F', grades: { math: [2, 3, 2], nativeLang: [2, 2], science: [2, 2], history: [2, 1], foreignLang: [2, 2], art: [1, 1] } },
];

export const INITIAL_RULES: SeatingPairRule[] = [
  { id: 'r1', student1Id: 's1', student2Id: 's2', type: 'positive' }, // Novák + Svobodová buddy pair
  { id: 'r2', student1Id: 's3', student2Id: 's5', type: 'negative' }, // Dvořák & Procházka must NOT sit together
];

export const INITIAL_JOURNAL_PROMPTS: JournalPrompt[] = [
  {
    id: 'p1',
    key: 'three_positives',
    title: '1. Tři pozitivní věci, které vás dnes potkaly a proč',
    placeholder: 'Napište 3 hezké momenty a co pro vás znamenaly...',
    example: 'Cestou do školy jsem šel přes park - krásně svítilo slunce a já si připadal jako na horách. Bylo to díky tomu, že jsem se odhodlal o 5 minut dříve vstát.',
  },
  {
    id: 'p2',
    key: 'surprise',
    title: '2. Co vás dnes překvapilo a čím',
    placeholder: 'Popište nečekaný moment nebo detail...',
    example: 'Nikdy jsem si nevšiml mozaiky při vstupu do pasáže. Nepravidelně hravé kamínky v kontrastu s funkcionalismem budovy působily nezvykle organicky a vřele.',
  },
  {
    id: 'p3',
    key: 'mindmap',
    title: '3. Myšlenková mapa dnešního dne',
    placeholder: 'Shrňte oblasti činnosti, myšlenky, pocity, ponaučení a alternativy...',
    example: 'Kresba / rozbor v plátně níže: didaktická reflexe, hospodaření s hlasem, úspěch v párové práci.',
  },
  {
    id: 'p4',
    key: 'random_object',
    title: '4. Náhodný předmět a jeho alternativní využití (během 5 minut)',
    placeholder: 'Vyberte libovolnou věc kolem sebe a vymyslete co nejvíce netradičních použití...',
    example: 'Tužka - psaní, čištění škvír, restartování routeru, měření délky, fixace drdolu, palička na bubnování, zarážka dveří.',
  },
  {
    id: 'p5',
    key: 'creative_tool',
    title: '5. Nástroj na podporu kreativity vyzkoušený dnes',
    placeholder: 'Napište název nástroje a k čemu jste jej použili...',
    example: 'Miro / myšlenková mapa na tabuli – společné hledání metafor pro koloběh vody.',
  },
  {
    id: 'p6',
    key: 'unusual_event',
    title: '6. Stalo se dnes něco neobvyklého?',
    placeholder: 'Všimněte si dění na ulici, ve škole, v médiích – čím se lišilo od běžnosti?',
    example: 'Ve třídě najednou nastalo úplné ticho, když jsem začal vyprávět příběh o ztroskotání lodi. Ticho nebylo vynucené, ale přirozeně soustředěné.',
  },
  {
    id: 'p7',
    key: 'creative_barrier',
    title: '7. Překážka kreativity během dne',
    placeholder: 'Chtěli jste být kreativní, ale nešlo to? Únava, obavy, prostředí, časový tlak?',
    example: 'Při přípravě písemky jsem byl unavený a sklouzl ke standardní šabloně namísto otevřené aplikační úlohy. Chyběl mi odstup.',
  },
  {
    id: 'p8',
    key: 'free_sketch_poem',
    title: '8. Kresba obyčejnou tužkou, báseň nebo filozofická reflexe',
    placeholder: 'Využijte vestavěné kreslicí plátno níže nebo zapište báseň či úvahu...',
    example: 'Krátká báseň o křídě a tabuli: Bílý prach na prstech, slova mizí v houbě, ale myšlenka zůstává v hlavě žáka.',
  },
];

// 12 Seasonal high quality covers (3 per season)
export const SEASONAL_COVERS: SeasonalCover[] = [
  // Spring (Jaro)
  {
    id: 'sp1',
    season: 'spring',
    title: 'Jarní probuzení v bukovém lese',
    url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Spring Bloom',
  },
  {
    id: 'sp2',
    season: 'spring',
    title: 'Ranní rosa na mladých lístcích',
    url: 'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Fresh Leaves',
  },
  {
    id: 'sp3',
    season: 'spring',
    title: 'Kvetoucí třešňový sad',
    url: 'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Cherry Blossoms',
  },
  // Summer (Léto)
  {
    id: 'su1',
    season: 'summer',
    title: 'Sluncem prozářená horská louka',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Summer Horizon',
  },
  {
    id: 'su2',
    season: 'summer',
    title: 'Zlatavé obilné pole v podvečer',
    url: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Golden Field',
  },
  {
    id: 'su3',
    season: 'summer',
    title: 'Klidná hladina lesního jezera',
    url: 'https://images.unsplash.com/photo-1439853949127-fa647821eba0?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Calm Water',
  },
  // Autumn (Podzim)
  {
    id: 'au1',
    season: 'autumn',
    title: 'Zlatý podzim v javorovém háji',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Autumn Colors',
  },
  {
    id: 'au2',
    season: 'autumn',
    title: 'Mlžné podzimní ráno v údolí',
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Misty Woods',
  },
  {
    id: 'au3',
    season: 'autumn',
    title: 'Spadané pestrobarevné listí',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Forest Path',
  },
  // Winter (Zima)
  {
    id: 'wi1',
    season: 'winter',
    title: 'Zasněžené horské štíty v tichu',
    url: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Winter Solitude',
  },
  {
    id: 'wi2',
    season: 'winter',
    title: 'Inovatka na smrkových větvích',
    url: 'https://images.unsplash.com/photo-1489674267075-cee793167910?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Frost Pine',
  },
  {
    id: 'wi3',
    season: 'winter',
    title: 'Mrazivé modré ráno v krajině',
    url: 'https://images.unsplash.com/photo-1517299321929-30a7082752d7?auto=format&fit=crop&w=1200&q=80',
    credit: 'Unsplash - Winter Morning',
  },
];

// Pick random seasonal cover based on current calendar month
export function getDefaultSeasonalCover(): SeasonalCover {
  const month = new Date().getMonth(); // 0-11
  let season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring';
  if (month >= 2 && month <= 4) season = 'spring';
  else if (month >= 5 && month <= 7) season = 'summer';
  else if (month >= 8 && month <= 10) season = 'autumn';
  else season = 'winter';

  const matches = SEASONAL_COVERS.filter((c) => c.season === season);
  return matches[Math.floor(Math.random() * matches.length)];
}

// 20 rich educational object templates for EduDesign
export const EDUCATIONAL_OBJECT_TEMPLATES: Partial<EducationalObject>[] = [
  {
    title: 'Interaktivní simulace jevu',
    type: 'simulation',
    duration: '25 min',
    studentActivity: 'Žáci manipulují s parametry modelu (např. PhET), ověřují hypotézy a zaznamenávají hraniční stavy.',
    teacherRole: 'Facilitátor, klade návodné otázky a pomáhá odhalovat miskoncepce.',
    verificationMethod: 'Reflexní protokol s hypotézou a zhodnocením výsledků.',
    implementationDetails: 'Rozdělení do dvojic u tabletů s předem definovaným badatelským zadáním.',
  },
  {
    title: 'Řízená případová studie (Case Study)',
    type: 'case_study',
    duration: '35 min',
    studentActivity: 'Četba reálné situace, identifikace dilemat a formulace doporučeného řešení v týmu.',
    teacherRole: 'Moderátor závěrečné plenární diskuse a sokratovského rozboru.',
    verificationMethod: 'Strukturovaná argumentační matice s obhajobou rozhodnutí.',
    implementationDetails: 'Předložení dvou protichůdných perspektiv k jedné reálné události.',
  },
  {
    title: 'Tematický mikropodcast s poslechovým glosářem',
    type: 'podcast',
    duration: '15 min',
    studentActivity: 'Asynchronní poslech 8minutové epizody, doplňování Cornellových poznámek.',
    teacherRole: 'Tvůrce audia nebo kurátor ověřeného zdroje s doplňujícími otázkami.',
    verificationMethod: 'Formativní bleskový kvíz s otevřenou otázkou na porozumění.',
    implementationDetails: 'Využití formátu Flipped Classroom (poslech předem doma).',
  },
  {
    title: 'Strukturovaný pracovní list s gradovanou náročností',
    type: 'worksheet',
    duration: '20 min',
    studentActivity: 'Samostatné řešení úloh od základní reprodukce po transfer a tvorbu analogií.',
    teacherRole: 'Poskytování individuální dopomoci žákům v zóně nejbližšího vývoje.',
    verificationMethod: 'Vzájemná sebekontrola podle autorského klíče s komentářem.',
    implementationDetails: 'Tři úrovně náročnosti (hvězdičky) s možností volby vlastní výzvy.',
  },
  {
    title: 'Interaktivní prezentace s vloženými anketami',
    type: 'presentation',
    duration: '25 min',
    studentActivity: 'Reakce na živé hlasování (Mentimeter / Slido), diskuse o rozptylu odpovědí.',
    teacherRole: 'Prezentující, okamžitě reaguje na zjištěné mezery v porozumění třídy.',
    verificationMethod: 'Analýza posunu v porozumění mezi vstupním a výstupním hlasováním.',
    implementationDetails: 'Vložení otázky na prověření konceptu každých 7 minut.',
  },
  {
    title: 'Výukové mikrovideo s integrovanými otázkami',
    type: 'video',
    duration: '12 min',
    studentActivity: 'Sledování animovaného výkladu s automatickým zastavením na kontrolních bodech.',
    teacherRole: 'Sleduje dashboard odpovědí a vybírá nejčastější chyby k diskusi.',
    verificationMethod: 'Průběžné skóre z interaktivních otázek ve videu (např. Edpuzzle).',
    implementationDetails: 'Krátké video do 5 minut délky, 3 cílené otázky.',
  },
  {
    title: 'Specializovaná webová aplikace / nástroj',
    type: 'app',
    duration: '30 min',
    studentActivity: 'Tvorba vizualizace dat, geografického mapování nebo programovacího skriptu.',
    teacherRole: 'Technická a metodická podpora, navigace v pokročilých funkcích.',
    verificationMethod: 'Sdílený odkaz na vytvořený funkční digitální artefakt.',
    implementationDetails: 'Práce v prohlížeči bez nutnosti složité instalace.',
  },
  {
    title: 'Sokratovský seminář a diskusní kruh',
    type: 'socratic',
    duration: '40 min',
    studentActivity: 'Kritická rozprava nad filozofickým textem bez hledání jediné pravdy.',
    teacherRole: 'Mlčící facilitátor hlídající pravidla naslouchání a kulturu dialogu.',
    verificationMethod: 'Pozorovací arch zapojení a kvality argumentace (vnější kruh hodnotí vnitřní).',
    implementationDetails: 'Uspořádání do kruhu nebo akvária (Fishbowl).',
  },
  {
    title: 'Digitální úniková hra (Escape Room)',
    type: 'escape_room',
    duration: '45 min',
    studentActivity: 'Kooperativní luštění šifer a úloh k odemčení postupných stop.',
    teacherRole: 'Správce nápověd ("nápovědná karta") a časoměřič.',
    verificationMethod: 'Úspěšné prolomení finálního kódu v časovém limitu s reflexí chyb.',
    implementationDetails: 'Příběhový narativ propojující 4 mezipředmětová témata.',
  },
  {
    title: 'Kolaborativní myšlenková mapa pojmů',
    type: 'mindmap',
    duration: '25 min',
    studentActivity: 'Společné propojování pojmů na digitálním plátně s definováním vztahů.',
    teacherRole: 'Komentuje slepá místa a provokuje otázkami po hierarchii konceptů.',
    verificationMethod: 'Vrstevnické posouzení (Peer review) mezi dvěma skupinami.',
    implementationDetails: 'Barevné kódování kategorií a minimálně 3 úrovně větvení.',
  },
  {
    title: 'Vrstevnická dílna zpětné vazby (Peer Review)',
    type: 'peer_review',
    duration: '30 min',
    studentActivity: 'Čtení prací spolužáků a psaní konstruktivní zpětné vazby podle rubriky.',
    teacherRole: 'Kalibruje kritéria na ukázkovém anonymním textu.',
    verificationMethod: 'Kvalita formulované zpětné vazby (dvě ocenění + jedno doporučení).',
    implementationDetails: 'Metoda "Dvě hvězdy a jedno přání".',
  },
  {
    title: 'Situační hraní rolí (Roleplay Simulation)',
    type: 'roleplay',
    duration: '35 min',
    studentActivity: 'Ztělesnění historické postavy, vědce či vyjednavače s obhajobou jeho pozice.',
    teacherRole: 'Režisér, zastavuje simulaci pro bleskovou metareflexi pocitů.',
    verificationMethod: 'Závěrečný de-briefing a de-roling rozhovor o motivacích postav.',
    implementationDetails: 'Předem připravené karty postav s tajnými cíli a mantinely.',
  },
  {
    title: 'Badatelský laboratorní experiment',
    type: 'lab',
    duration: '45 min',
    studentActivity: 'Měření veličin, formulace výzkumné otázky a grafická interpretace dat.',
    teacherRole: 'Dohlíží na bezpečnost a metodickou čistotu měření.',
    verificationMethod: 'Protokol s vyčíslením nejistot měření a diskusí odchylek.',
    implementationDetails: 'Dostupné senzory nebo běžné pomůcky z kuchyně.',
  },
  {
    title: 'Akademická debata ve formátu Karl Popper',
    type: 'debate',
    duration: '45 min',
    studentActivity: 'Afirmativní a negativní argumentace na kontroverzní tezi s přísným časoměrem.',
    teacherRole: 'Rozhodčí dbající na věcnost a absenci argumentačních faulů.',
    verificationMethod: 'Hodnoticí lístek rozhodčích s rozborem síly argumentačních linií.',
    implementationDetails: 'Teze: "Umělá inteligence by měla nahradit tradiční testování znalostí."',
  },
  {
    title: 'Adaptivní mikromodul s okamžitou větvící logikou',
    type: 'micromodule',
    duration: '15 min',
    studentActivity: 'Průchod interaktivním obsahem, kde nesprávná odpověď nabízí vysvětlující odbočku.',
    teacherRole: 'Architekt vzdělávací cesty v LMS.',
    verificationMethod: 'Systémový log splnění všech klíčových kontrolních uzlů.',
    implementationDetails: 'Délka jednotlivých kroků do 90 sekund.',
  },
  {
    title: 'Interaktivní sada kartiček s rozloženým opakováním',
    type: 'flashcards',
    duration: '10 min',
    studentActivity: 'Aktivní vybavování pojmů (Spaced Repetition / Retrieval Practice).',
    teacherRole: 'Předkládá sady s vyváženým poměrem definic a příkladů z praxe.',
    verificationMethod: 'Míra úspěšného vybavení v 3. opakovacím cyklu.',
    implementationDetails: 'Algoritmus Leitnerova systému v aplikaci.',
  },
  {
    title: 'Vizuální infografika / plakát shrnující koncept',
    type: 'infographic',
    duration: '40 min',
    studentActivity: 'Syntéza rozsáhlého textu do vizuálního schématu s ikonami a daty.',
    teacherRole: 'Kritik kompozice a didaktické srozumitelnosti sdělení.',
    verificationMethod: 'Vernisáž plakátů ve třídě s nalepovacími poznámkami s dotazy.',
    implementationDetails: 'Využití grafické šablony (Canva) s pravidlem 60-30-10.',
  },
  {
    title: 'Programovací pískoviště (Coding Playground)',
    type: 'coding',
    duration: '35 min',
    studentActivity: 'Úprava existujícího funkčního kódu za účelem vyřešení nového zadání.',
    teacherRole: 'Live debugging konzultant a mentor algoritmického myšlení.',
    verificationMethod: 'Úspěšný průchod automatických jednotkových testů (Unit tests).',
    implementationDetails: 'Předpřipravený repozitář s chybějícími funkcemi k doplnění.',
  },
  {
    title: 'Audio esej / osobní pedagogická úvaha',
    type: 'audio_essay',
    duration: '20 min',
    studentActivity: 'Nahrání 3minutové strukturované úvahy o vlastním didaktickém pokroku.',
    teacherRole: 'Posluchač, poskytuje formativní hlasovou reakci.',
    verificationMethod: 'Kriteriální rubrika pro hloubku metakognitivního vhledu.',
    implementationDetails: 'Nahrání na diktafon v telefonu a uložení do sdílené složky.',
  },
  {
    title: 'Terénní akční miniprojekt v okolí školy',
    type: 'field_project',
    duration: '50 min',
    studentActivity: 'Sběr reálných dat v terénu (fotodokumentace, rozhovory s kolemjdoucími, vzorky).',
    teacherRole: 'Průvodce v terénu a garant bezpečnosti akce.',
    verificationMethod: 'Stručná terénní zpráva s doporučením pro místní komunitu.',
    implementationDetails: 'Mapování bezbariérovosti nebo ekologických stop v sousedství.',
  },
];

// NVC Needs according to Marshall Rosenberg
export const NVC_NEEDS: NvcNeed[] = [
  {
    key: 'autonomy',
    category: 'autonomy',
    label: { cs: 'Autonomie a svoboda volby', en: 'Autonomy & Choice', pl: 'Autonomia i wolność wyboru' },
    description: { cs: 'Potřeba mít vliv na svůj čas, volit vlastní pedagogické metody a směr.', en: 'Need for agency over time, teaching styles, and personal path.', pl: 'Potrzeba wpływu na swój czas i metody dydaktyczne.' },
  },
  {
    key: 'physical_wellbeing',
    category: 'autonomy',
    label: { cs: 'Fyzická pohoda a odpočinek', en: 'Physical Rest & Health', pl: 'Regeneracja fizyczna i odpoczynek' },
    description: { cs: 'Kvalitní spánek, odpočinek očí od displejů, procházka na vzduchu.', en: 'Restorative sleep, eye rest from screens, movement.', pl: 'Dobry sen, odpoczynek oczu od ekranów, ruch na świeżym powietrzu.' },
  },
  {
    key: 'connection',
    category: 'connection',
    label: { cs: 'Hluboké lidské spojení', en: 'Genuine Human Connection', pl: 'Głęboka relacja i kontakt' },
    description: { cs: 'Skutečný kontakt s kolegy a žáky namísto pouhé digitální směny zpráv.', en: 'Authentic interaction with colleagues and students beyond chat apps.', pl: 'Prawdziwe spotkanie z ludźmi zamiast samej wymiany wiadomości.' },
  },
  {
    key: 'competence_meaning',
    category: 'meaning',
    label: { cs: 'Smysluplnost a přínos', en: 'Meaning & Contribution', pl: 'Poczucie sensu i wkładu' },
    description: { cs: 'Vědomí, že práce má reálný pozitivní dopad na rozvoj mladých lidí.', en: 'Knowing that pedagogical efforts make a meaningful difference.', pl: 'Poczucie, że praca realnie wspiera rozwój uczniów.' },
  },
  {
    key: 'play_spontaneity',
    category: 'play',
    label: { cs: 'Hravost a lehkost', en: 'Playfulness & Spontaneity', pl: 'Zabawa i spontaniczność' },
    description: { cs: 'Schopnost nebrat se příliš vážně, humor ve sborovně a prostor pro hru.', en: 'Humor, lightness, and creative room to experiment without fear.', pl: 'Poczucie humoru, przestrzeń na zabawę i lekkość w działaniu.' },
  },
  {
    key: 'inner_peace',
    category: 'peace',
    label: { cs: 'Vnitřní klid a ticho', en: 'Peace & Digital Silence', pl: 'Wewnętrzny spokój i cisza cyfrowa' },
    description: { cs: 'Čas bez notifikací, mentální prostor pro soustředění a dech.', en: 'Space free of notification pings, quiet reflection, breathing.', pl: 'Czas bez powiadomień, mentalna przestrzeń na skupienie i oddech.' },
  },
];

export const INITIAL_WELLBEING_EXERCISES: WellbeingExercise[] = [
  {
    id: 'e1',
    category: 'screen_detox',
    duration: '5 min',
    title: { cs: 'Zlatá hodinka bez displeje před spaním', en: 'Screen-Free Twilight Hour', pl: 'Godzina bez ekranu przed snem' },
    description: {
      cs: 'Odložte telefon do vedlejší místnosti 45 minut před ulehnutím. Místo toho vezměte papírovou knihu nebo si připravte bylinkový čaj.',
      en: 'Leave all devices outside the bedroom 45 minutes before sleep. Read a physical book or enjoy a warm herbal tea.',
      pl: 'Odłóż telefon do drugiego pokoju 45 minut przed snem. Sięgnij po książkę papierową lub ciepłą herbatę.',
    },
  },
  {
    id: 'e2',
    category: 'mindfulness',
    duration: '3 min',
    title: { cs: 'Mikropauza 20-20-20 ve sborovně', en: '20-20-20 Vision Micro-Break', pl: 'Mikroprzerwa dla wzroku 20-20-20' },
    description: {
      cs: 'Každých 20 minut práce na počítači se podívejte na bod vzdálený alespoň 6 metrů (z okna na koruny stromů) po dobu 20 sekund a zhluboka vydechněte.',
      en: 'Every 20 minutes of screen work, gaze at a distant horizon (out the window at trees) for 20 seconds and release shoulder tension.',
      pl: 'Co 20 minut spójrz przez okno na odległy punkt na co najmniej 20 sekund i weź głęboki wydech.',
    },
  },
  {
    id: 'e3',
    category: 'focus',
    duration: '15 min',
    title: { cs: 'Digitální jednokolejnost (Single-tasking)', en: 'Strict Single-Tasking Window', pl: 'Jedno zadanie naraz (Single-tasking)' },
    description: {
      cs: 'Zavřete všechny záložky v prohlížeči kromě té jediné, na které zrovna píšete přípravu. Vypněte zvuk e-mailového klienta na 25 minut.',
      en: 'Close all browser tabs except the single preparation document. Silence inbox notifications for 25 minutes.',
      pl: 'Zamknij wszystkie karty przeglądarki poza jednym dokumentem. Wycisz powiadomienia e-mail na 25 minut.',
    },
  },
  {
    id: 'e4',
    category: 'movement',
    duration: '4 min',
    title: { cs: 'Protažení učitelské krční páteře a ramen', en: 'Teacher Posture Reset', pl: 'Rozciągnięcie karku i barków' },
    description: {
      cs: 'Postavte se k oknu, jemně zakružte rameny dozadu, otevřete hrudník a protáhněte svaly šíje. Doplňte sklenici čerstvé vody.',
      en: 'Stand tall near a window, roll shoulders back, open chest, and drink a tall glass of clean water.',
      pl: 'Stań przy oknie, zrób kilka krążeń barkami w tył, rozluźnij szyję i wypij szklankę wody.',
    },
  },
];

export const INITIAL_CALENDAR_TASKS: CalendarTask[] = [
  { id: 't1', title: 'Příprava badatelské lekce fyziky (8.A)', time: '08:00 - 08:45', category: 'prep', completed: true },
  { id: 't2', title: 'Výuka: Zasedací pořádek v U-tvaru pro diskusi', time: '09:00 - 10:35', category: 'teaching', completed: true },
  { id: 't3', title: 'Pauza bez mobilu na školním dvoře', time: '11:40 - 12:00', category: 'rest', completed: false },
  { id: 't4', title: 'Konzultace s kolegou ohledně párového sezení', time: '13:00 - 13:30', category: 'teaching', completed: false },
  { id: 't5', title: 'Zápis reflexe do kreativního deníku', time: '15:00 - 15:15', category: 'personal', completed: false },
];

export function getLocalizedJournalPrompt(prompt: JournalPrompt, lang: 'cs' | 'en' | 'pl'): JournalPrompt {
  if (lang === 'cs') return prompt;
  const localizedMap: Record<string, { en: { title: string; placeholder: string; example: string }; pl: { title: string; placeholder: string; example: string } }> = {
    three_positives: {
      en: {
        title: '1. Three positive moments from today and why they mattered',
        placeholder: 'Write 3 meaningful positive moments and why they happened...',
        example: 'Walked through the park before school — crisp sunlight helped me slow down before lessons because I left 5 minutes earlier.',
      },
      pl: {
        title: '1. Trzy pozytywne wydarzenia z dzisiaj i ich przyczyna',
        placeholder: 'Opisz 3 miłe momenty i co dla Ciebie znaczyły...',
        example: 'Spacer przez park w drodze do szkoły – poranne słońce dało mi spokój przed lekcjami, bo wyszedłem 5 minut wcześniej.',
      },
    },
    surprise: {
      en: {
        title: '2. What surprised you today and why',
        placeholder: 'Describe an unexpected detail, reaction, or classroom observation...',
        example: 'A quiet student asked a profound follow-up question once we switched from lecturing to pair discussion.',
      },
      pl: {
        title: '2. Co Cię dzisiaj zaskoczyło i dlaczego',
        placeholder: 'Opisz niespodziewany moment, reakcję lub obserwację z klasy...',
        example: 'Cichy uczeń zadał niezwykle trafne pytanie pogłębiające, gdy przeszliśmy z wykładu na dyskusję w parach.',
      },
    },
    mindmap: {
      en: {
        title: '3. Mind map of today’s teaching and insights',
        placeholder: 'Summarize areas of activity, ideas, emotions, lessons learned, and alternatives...',
        example: 'Visualized in the sketchpad below: voice pacing, inquiry questioning, smoother transition between tasks.',
      },
      pl: {
        title: '3. Mapa myśli dzisiejszego dnia',
        placeholder: 'Podsumuj działania, myśli, emocje, wnioski i alternatywy...',
        example: 'Rozrysowane na płótnie poniżej: zarządzanie głosem, pytania otwarte, płynniejsze przejście między zadaniami.',
      },
    },
    random_object: {
      en: {
        title: '4. Random object and its alternative uses (5-minute divergent drill)',
        placeholder: 'Pick any everyday object nearby and brainstorm as many unusual uses as possible...',
        example: 'Pencil — bookmark, rhythm stick, plant support, pointer, improvised protractor pivot.',
      },
      pl: {
        title: '4. Losowy przedmiot i jego alternatywne zastosowania (w 5 minut)',
        placeholder: 'Wybierz dowolny przedmiot obok siebie i wymyśl jak najwięcej nietypowych zastosowań...',
        example: 'Ołówek – zakładka do książki, pałeczka rytmiczna, podpórka do rośliny, wskaźnik na tablicy.',
      },
    },
    creative_tool: {
      en: {
        title: '5. Creative tool or technique tried today',
        placeholder: 'Name the pedagogical or digital tool and how you applied it...',
        example: 'Collaborative whiteboard metaphors — pairs sketched analogies for cellular transport.',
      },
      pl: {
        title: '5. Narzędzie wspierające kreatywność wypróbowane dzisiaj',
        placeholder: 'Podaj nazwę narzędzia i do czego zostało użyte...',
        example: 'Wspólna mapa metafor na tablicy – pary tworzyły analogie do krążenia wody w przyrodzie.',
      },
    },
    unusual_event: {
      en: {
        title: '6. Did anything unusual happen today?',
        placeholder: 'Notice something out of the ordinary in the classroom, hallway, or conversation...',
        example: 'Complete focused silence settled in naturally the moment we framed the historical dilemma as a real-life story.',
      },
      pl: {
        title: '6. Czy zdarzyło się dziś coś niezwykłego?',
        placeholder: 'Zwróć uwagę na nietypowe zdarzenie w klasie, szkole lub w drodze do pracy...',
        example: 'W sali zapadła pełna skupienia cisza dokładnie wtedy, gdy historyczny dylemat przedstawiłem jako żywą opowieść.',
      },
    },
    creative_barrier: {
      en: {
        title: '7. Creative barrier encountered during the day',
        placeholder: 'Wanted to innovate but got stuck? Fatigue, time pressure, fear of error?',
        example: 'Time pressure before the bell nudged me toward a standard worksheet instead of an open inquiry prompt.',
      },
      pl: {
        title: '7. Przeszkoda dla kreatywności w ciągu dnia',
        placeholder: 'Chciało się działać twórczo, ale coś przeszkodziło? Zmęczenie, presja czasu, rutyna?',
        example: 'Pośpiech przed dzwonkiem skłonił mnie do rutynowego testu zamiast otwartego zadania problemowego.',
      },
    },
    free_sketch_poem: {
      en: {
        title: '8. Pencil sketch, short poem, or philosophical reflection',
        placeholder: 'Use the integrated sketchpad below or compose a short poem or reflection...',
        example: 'White chalk dust on fingertips — words fade from the board, yet questions linger in the students’ minds.',
      },
      pl: {
        title: '8. Rysunek ołówkiem, krótki wiersz lub refleksja filozoficzna',
        placeholder: 'Skorzystaj ze szkicownika poniżej lub zapisz wiersz czy swobodną refleksję...',
        example: 'Biały pył kredy na dłoniach – słowa znikają z tablicy, ale pytania zostają w myślach uczniów.',
      },
    },
  };

  const match = localizedMap[prompt.key]?.[lang];
  if (!match) return prompt;
  return { ...prompt, ...match };
}

export function getLocalizedEduTemplate(tmpl: Partial<EducationalObject>, lang: 'cs' | 'en' | 'pl'): Partial<EducationalObject> {
  if (lang === 'cs' || !tmpl.type) return tmpl;
  const map: Record<string, { en: Partial<EducationalObject>; pl: Partial<EducationalObject> }> = {
    simulation: {
      en: {
        title: 'Interactive Phenomenon Simulation',
        studentActivity: 'Students manipulate model parameters (e.g., PhET), test hypotheses, and log boundary conditions.',
        teacherRole: 'Facilitator asking guiding questions and uncovering misconceptions.',
        verificationMethod: 'Inquiry protocol comparing initial hypothesis against simulation outcomes.',
        implementationDetails: 'Pair work on tablets with a structured inquiry worksheet.',
      },
      pl: {
        title: 'Interaktywna symulacja zjawiska',
        studentActivity: 'Uczniowie modyfikują parametry modelu (np. PhET), weryfikują hipotezy i zapisują stany brzegowe.',
        teacherRole: 'Facylitator zadający pytania naprowadzające i pomagający odkryć błędne przekonania.',
        verificationMethod: 'Protokół badawczy zestawiający hipotezę z wynikami symulacji.',
        implementationDetails: 'Praca w parach na tabletach według ustrukturyzowanej karty pracy.',
      },
    },
    case_study: {
      en: {
        title: 'Guided Case Study Workshop',
        studentActivity: 'Analyze an authentic scenario, identify core dilemmas, and formulate a defended team recommendation.',
        teacherRole: 'Moderator of plenary synthesis and Socratic probing.',
        verificationMethod: 'Structured argumentation matrix defending the selected decision.',
        implementationDetails: 'Compare two contrasting stakeholder viewpoints on one real event.',
      },
      pl: {
        title: 'Kierowane studium przypadku (Case Study)',
        studentActivity: 'Analiza autentycznej sytuacji, identyfikacja dylematów i wypracowanie rekomendacji w zespole.',
        teacherRole: 'Moderator dyskusji plenarnej i analizy sokratejskiej.',
        verificationMethod: 'Strukturalna matryca argumentacji z obroną wybranej decyzji.',
        implementationDetails: 'Zestawienie dwóch sprzecznych perspektyw dotyczących tego samego wydarzenia.',
      },
    },
    podcast: {
      en: {
        title: 'Topic Micro-Podcast & Listening Glossary',
        studentActivity: 'Asynchronous 8-minute listening with Cornell notes.',
        teacherRole: 'Audio creator or curator providing guiding comprehension prompts.',
        verificationMethod: 'Formative flash quiz with an open synthesis prompt.',
        implementationDetails: 'Flipped Classroom preparation assigned prior to live session.',
      },
      pl: {
        title: 'Tematyczny mikropodcast ze słowniczkiem',
        studentActivity: 'Asynchroniczne wysłuchanie 8-minutowego odcinka z notatkami Cornella.',
        teacherRole: 'Twórca lub kurator nagrania z pytaniami sprawdzającymi zrozumienie.',
        verificationMethod: 'Błyskawiczny quiz formatywny z pytaniem otwartym.',
        implementationDetails: 'Wykorzystanie modelu odwróconej klasy (Flipped Classroom) przed lekcją.',
      },
    },
    worksheet: {
      en: {
        title: 'Differentiated Tiered Worksheet',
        studentActivity: 'Independent progression from foundational recall to concept transfer and analogies.',
        teacherRole: 'Provide targeted scaffolding inside each student’s Zone of Proximal Development.',
        verificationMethod: 'Peer self-check using an annotated answer key.',
        implementationDetails: 'Three difficulty tiers allowing students to select their challenge level.',
      },
      pl: {
        title: 'Karta pracy ze stopniowaną trudnością',
        studentActivity: 'Samodzielne przechodzenie od podstawowej reprodukcji po transfer wiedzy i analogie.',
        teacherRole: 'Indywidualne wsparcie uczniów w strefie najbliższego rozwoju.',
        verificationMethod: 'Wzajemna kontrola według klucza z komentarzem dydaktycznym.',
        implementationDetails: 'Trzy poziomy trudności (gwiazdki) z możliwością wyboru wyzwania.',
      },
    },
    presentation: {
      en: {
        title: 'Interactive Deck with Live Polls',
        studentActivity: 'Respond to live concept polls (Mentimeter/Slido) and debate answer distributions.',
        teacherRole: 'Presenter adapting instruction dynamically based on live misconception data.',
        verificationMethod: 'Shift analysis between pre-poll and post-discussion vote.',
        implementationDetails: 'Embed one diagnostic concept question every 7 minutes.',
      },
      pl: {
        title: 'Interaktywna prezentacja z ankietami na żywo',
        studentActivity: 'Odpowiedzi na żywo w ankietach (Mentimeter/Slido) i dyskusja nad rozkładem zdań.',
        teacherRole: 'Prelegent reagujący natychmiast na luki w zrozumieniu klasy.',
        verificationMethod: 'Porównanie wyników głosowania początkowego i końcowego.',
        implementationDetails: 'Pytanie diagnostyczne wplecione co około 7 minut wykładu.',
      },
    },
    video: {
      en: {
        title: 'Micro-Video with Embedded Checkpoints',
        studentActivity: 'Watch a short visual explanation that pauses automatically for comprehension prompts.',
        teacherRole: 'Review analytics dashboard and address frequent errors in class.',
        verificationMethod: 'Checkpoint accuracy log from interactive video (e.g., Edpuzzle).',
        implementationDetails: 'Under 5 minutes runtime with 3 targeted questions.',
      },
      pl: {
        title: 'Mikrowideo z wbudowanymi pytaniami',
        studentActivity: 'Oglądanie krótkiego wyjaśnienia z automatycznymi pauzami na pytania kontrolne.',
        teacherRole: 'Analizuje odpowiedzi na dashboardzie i omawia najczęstsze błędy.',
        verificationMethod: 'Wynik z pytań osadzonych w wideo (np. Edpuzzle).',
        implementationDetails: 'Film poniżej 5 minut, maksymalnie 3 celowane pytania.',
      },
    },
    app: {
      en: {
        title: 'Specialized Interactive Web Tool',
        studentActivity: 'Create a data visualization, spatial map, or interactive computational model.',
        teacherRole: 'Methodological coach troubleshooting edge cases.',
        verificationMethod: 'Submitted live link to the functional digital artifact.',
        implementationDetails: 'Browser-based workflow requiring zero installation.',
      },
      pl: {
        title: 'Specjalistyczna aplikacja webowa / narzędzie',
        studentActivity: 'Tworzenie wizualizacji danych, mapy lub działającego modelu w przeglądarce.',
        teacherRole: 'Wsparcie techniczne i metodyczne podczas tworzenia artefaktu.',
        verificationMethod: 'Udostępniony link do działającego projektu cyfrowego.',
        implementationDetails: 'Praca bezpośrednio w przeglądarce bez konieczności instalacji.',
      },
    },
    socratic: {
      en: {
        title: 'Socratic Seminar & Dialogue Circle',
        studentActivity: 'Critical inquiry over a primary text anchored in evidence rather than debate winning.',
        teacherRole: 'Silent facilitator safeguarding listening norms and depth of inquiry.',
        verificationMethod: 'Outer-circle peer observation rubric tracking textual citations and questions.',
        implementationDetails: 'Arranged as a double concentric fishbowl circle.',
      },
      pl: {
        title: 'Seminarium sokratejskie i krąg dyskusyjny',
        studentActivity: 'Krytyczna rozmowa nad tekstem źródłowym bez szukania jednego prostego zwycięzcy.',
        teacherRole: 'Milczący facylitator czuwający nad kulturą słuchania i dialogu.',
        verificationMethod: 'Arkusz obserwacji jakości argumentacji (krąg zewnętrzny ocenia wewnętrzny).',
        implementationDetails: 'Ustawienie krzeseł w formie akwarium (Fishbowl).',
      },
    },
    escape_room: {
      en: {
        title: 'Curriculum Digital Escape Room',
        studentActivity: 'Collaborate to solve domain puzzles and unlock sequential clues.',
        teacherRole: 'Timekeeper and hint-card steward.',
        verificationMethod: 'Code completion within time limit plus post-game error debrief.',
        implementationDetails: 'Storyline connecting 4 cross-curricular challenges.',
      },
      pl: {
        title: 'Cyfrowy pokój zagadek (Escape Room)',
        studentActivity: 'Zespołowe rozwiązywanie szyfrów i zadań odblokowujących kolejne wskazówki.',
        teacherRole: 'Opiekun kart podpowiedzi oraz kontroler czasu.',
        verificationMethod: 'Złamanie finałowego kodu i omówienie popełnionych błędów.',
        implementationDetails: 'Fabuła łącząca 4 zadania międzyprzedmiotowe.',
      },
    },
    mindmap: {
      en: {
        title: 'Collaborative Concept Mapping',
        studentActivity: 'Jointly link core concepts on a shared canvas and label causal relationships.',
        teacherRole: 'Probe blind spots and challenge hierarchical connections.',
        verificationMethod: 'Cross-group peer review evaluating conceptual accuracy and linking phrases.',
        implementationDetails: 'Color-coded concept categories with at least 3 branching levels.',
      },
      pl: {
        title: 'Współdzielona mapa pojęciowa',
        studentActivity: 'Wspólne łączenie pojęć na cyfrowym płótnie wraz z opisem relacji między nimi.',
        teacherRole: 'Wskazuje luki logiczne i stawia pytania o hierarchię pojęć.',
        verificationMethod: 'Wzajemna ocena (Peer review) między dwiema grupami.',
        implementationDetails: 'Kolorowe kodowanie kategorii i co najmniej 3 poziomy rozgałęzień.',
      },
    },
    peer_review: {
      en: {
        title: 'Structured Peer Feedback Workshop',
        studentActivity: 'Evaluate anonymized peer drafts using calibrated rubric descriptors.',
        teacherRole: 'Calibrate scoring standards together on a sample text first.',
        verificationMethod: 'Quality of written peer feedback (two strengths + one actionable next step).',
        implementationDetails: 'Two Stars and a Wish protocol.',
      },
      pl: {
        title: 'Warsztat wzajemnej informacji zwrotnej (Peer Review)',
        studentActivity: 'Analiza prac kolegów i formułowanie konstruktywnych uwag według kryteriów.',
        teacherRole: 'Kalibruje kryteria oceniania na anonimowym przykładzie wzorcowym.',
        verificationMethod: 'Jakość sformułowanej informacji zwrotnej (dwa atuty + jedno konkretne zalecenie).',
        implementationDetails: 'Metoda „Dwie gwiazdy i jedno życzenie”.',
      },
    },
    roleplay: {
      en: {
        title: 'Contextual Roleplay Simulation',
        studentActivity: 'Embody historical, scientific, or civic stakeholders and negotiate constraints.',
        teacherRole: 'Director pausing play briefly for metacognitive reflection.',
        verificationMethod: 'Structured debrief and de-roling discussion analyzing stakeholder motives.',
        implementationDetails: 'Pre-built role cards with hidden constraints and goals.',
      },
      pl: {
        title: 'Symulacja z odgrywaniem ról (Roleplay)',
        studentActivity: 'Wcielenie się w postać historyczną, naukowca lub negocjatora z obroną jego racji.',
        teacherRole: 'Reżyser zatrzymujący symulację na krótką metarefleksję.',
        verificationMethod: 'Podsumowujący debriefing na temat motywacji stron konfliktu.',
        implementationDetails: 'Wcześniej przygotowane karty postaci z ukrytymi celami.',
      },
    },
    lab: {
      en: {
        title: 'Inquiry Laboratory Experiment',
        studentActivity: 'Formulate research question, measure variables, and plot empirical data.',
        teacherRole: 'Ensure safety and methodological rigor.',
        verificationMethod: 'Lab report quantifying uncertainty and discussing deviations.',
        implementationDetails: 'Accessible sensors or everyday household lab materials.',
      },
      pl: {
        title: 'Badawczy eksperyment laboratoryjny',
        studentActivity: 'Pomiary wielkości, formułowanie pytań badawczych i interpretacja wykresów.',
        teacherRole: 'Nadzór nad bezpieczeństwem i czystością metodologiczną badania.',
        verificationMethod: 'Raport z oszacowaniem błędów pomiaru i dyskusją odchyleń.',
        implementationDetails: 'Dostępne czujniki lub proste przyrządy z otoczenia ucznia.',
      },
    },
    debate: {
      en: {
        title: 'Karl Popper Academic Debate',
        studentActivity: 'Construct affirmative and negative cases on a resolution under strict timing.',
        teacherRole: 'Adjudicator monitoring evidence quality and logical fallacies.',
        verificationMethod: 'Judge ballot evaluating contention strength and rebuttal precision.',
        implementationDetails: 'Motion example: "AI tools should transform traditional summative testing."',
      },
      pl: {
        title: 'Debata akademicka w formacie Karla Poppera',
        studentActivity: 'Budowa linii argumentacji za i przeciw spornej tezie pod ścisłym limitem czasu.',
        teacherRole: 'Sędzia czuwający nad merytoryką i brakiem błędów logicznych.',
        verificationMethod: 'Karta oceny sędziowskiej analizująca siłę argumentów i kontrargumentów.',
        implementationDetails: 'Teza przykładowa: „Sztuczna inteligencja powinna zastąpić tradycyjne testy wiedzy”.',
      },
    },
    micromodule: {
      en: {
        title: 'Adaptive Branching Micro-Module',
        studentActivity: 'Navigate interactive cards where misconceptions trigger targeted remedial hints.',
        teacherRole: 'Learning pathway architect.',
        verificationMethod: 'Completion log confirming mastery across key checkpoints.',
        implementationDetails: 'Micro-steps under 90 seconds each.',
      },
      pl: {
        title: 'Adaptacyjny mikromoduł z logiką rozgałęzień',
        studentActivity: 'Praca z treścią, w której błędna odpowiedź kieruje do krótkiej ścieżki wyjaśniającej.',
        teacherRole: 'Architekt ścieżek uczenia się w LMS.',
        verificationMethod: 'Log ukończenia wszystkich kluczowych węzłów kontrolnych.',
        implementationDetails: 'Pojedyncze kroki poniżej 90 sekund.',
      },
    },
    flashcards: {
      en: {
        title: 'Spaced-Repetition Retrieval Deck',
        studentActivity: 'Practice active retrieval of core concepts and contextual examples.',
        teacherRole: 'Curate balanced card pairs linking definitions to real applications.',
        verificationMethod: 'Recall accuracy rate in the third repetition cycle.',
        implementationDetails: 'Leitner box algorithm inside flashcard app.',
      },
      pl: {
        title: 'Zestaw fiszek z powtórzeniami rozłożonymi w czasie',
        studentActivity: 'Aktywne wydobywanie pojęć z pamięci (Retrieval Practice).',
        teacherRole: 'Przygotowuje zbalansowane pary definicji i konkretnych przykładów.',
        verificationMethod: 'Skuteczność przywołania informacji w 3. cyklu powtórek.',
        implementationDetails: 'System pudełek Leitnera w aplikacji.',
      },
    },
    infographic: {
      en: {
        title: 'Visual Concept Synthesis Infographic',
        studentActivity: 'Distill a dense source text into an icon-driven, data-backed visual poster.',
        teacherRole: 'Critique visual hierarchy and didactic clarity.',
        verificationMethod: 'Gallery walk with sticky-note peer questions and rubric scoring.',
        implementationDetails: 'Clean layout grid applying 60-30-10 color balance.',
      },
      pl: {
        title: 'Infografika / plakat syntetyzujący zagadnienie',
        studentActivity: 'Synteza rozbudowanego tekstu w przejrzysty schemat wizualny z danymi.',
        teacherRole: 'Recenzent czytelności kompozycji i przejrzystości przekazu.',
        verificationMethod: 'Wernisaż plakatów w klasie z pytaniami na karteczkach samoprzylepnych.',
        implementationDetails: 'Szablon układu oparty na zasadzie proporcji 60-30-10.',
      },
    },
    coding: {
      en: {
        title: 'Guided Coding Sandbox',
        studentActivity: 'Modify or extend working starter code to solve a new constraint.',
        teacherRole: 'Live debugging mentor coaching algorithmic decomposition.',
        verificationMethod: 'Automated unit-test suite passing cleanly.',
        implementationDetails: 'Starter repository with clearly scoped TODO functions.',
      },
      pl: {
        title: 'Piaskownica programistyczna (Coding Playground)',
        studentActivity: 'Modyfikacja działającego kodu startowego w celu rozwiązania nowego problemu.',
        teacherRole: 'Mentor debugowania uczący dekompozycji algorytmicznej.',
        verificationMethod: 'Zaliczenie automatycznych testów jednostkowych (Unit tests).',
        implementationDetails: 'Przygotowane repozytorium z funkcjami do uzupełnienia.',
      },
    },
    audio_essay: {
      en: {
        title: '3-Minute Reflective Audio Essay',
        studentActivity: 'Record a structured 3-minute synthesis reflecting on conceptual growth.',
        teacherRole: 'Active listener delivering brief formative voice feedback.',
        verificationMethod: 'Criterion rubric assessing depth of metacognitive insight.',
        implementationDetails: 'Recorded directly on phone voice recorder and shared privately.',
      },
      pl: {
        title: '3-minutowy esej audio / refleksja dydaktyczna',
        studentActivity: 'Nagranie uporządkowanej 3-minutowej wypowiedzi o własnym postępie w nauce.',
        teacherRole: 'Słuchacz przekazujący krótką głosową informację zwrotną.',
        verificationMethod: 'Rubryka oceniająca głębię wglądu metapoznawczego.',
        implementationDetails: 'Nagranie dyktafonem i zapis we współdzielonym folderze.',
      },
    },
    field_project: {
      en: {
        title: 'Local Community Action Mini-Project',
        studentActivity: 'Collect field data around the school (photos, short interviews, audits).',
        teacherRole: 'Field guide and safety coordinator.',
        verificationMethod: 'Concise field brief featuring one actionable local recommendation.',
        implementationDetails: 'Audit neighborhood accessibility or local green footprint.',
      },
      pl: {
        title: 'Terenowy miniprojekt badawczy w otoczeniu szkoły',
        studentActivity: 'Zbieranie danych w terenie (zdjęcia, krótkie wywiady, obserwacje).',
        teacherRole: 'Przewodnik w terenie i koordynator bezpieczeństwa.',
        verificationMethod: 'Zwięzły raport terenowy z rekomendacją dla lokalnej społeczności.',
        implementationDetails: 'Mapowanie dostępności architektonicznej lub ekologii okolicy.',
      },
    },
  };
  const match = map[tmpl.type]?.[lang];
  return match ? { ...tmpl, ...match } : tmpl;
}

export function getLocalizedCalendarTaskTitle(task: CalendarTask, lang: 'cs' | 'en' | 'pl'): string {
  if (lang === 'cs') return task.title;
  const map: Record<string, { en: string; pl: string }> = {
    'Příprava badatelské lekce fyziky (8.A)': { en: 'Prepare inquiry-based physics lesson (Grade 8A)', pl: 'Przygotowanie lekcji badawczej z fizyki (kl. 8A)' },
    'Výuka: Zasedací pořádek v U-tvaru pro diskusi': { en: 'Teach: U-shape seating seminar discussion', pl: 'Lekcja: układ ławek w U do dyskusji' },
    'Pauza bez mobilu na školním dvoře': { en: 'Screen-free break in the school courtyard', pl: 'Przerwa bez telefonu na szkolnym dziedzińcu' },
    'Konzultace s kolegou ohledně párového sezení': { en: 'Peer consultation on student desk pairings', pl: 'Konsultacja z nauczycielem w sprawie par uczniowskich' },
    'Zápis reflexe do kreativního deníku': { en: 'Write daily entry in Creative Journal', pl: 'Wpis refleksyjny w Dzienniku kreatywnym' },
  };
  return map[task.title]?.[lang] || task.title;
}

