import { Language } from '../../types';

export type AboutCardId = 'license' | 'faq' | 'methodology' | 'author';

export interface AboutBlock {
  heading: string;
  body: string;
}

export interface AboutFaqItem {
  question: string;
  answer: string;
}

export interface AboutCardData {
  id: AboutCardId;
  title: string;
  cardSummary: string;
  metaLabel: string;
  subtitle: string;
  leadText: string;
  blocks: AboutBlock[];
  faqItems?: AboutFaqItem[];
}

export type AboutContentMap = Record<AboutCardId, AboutCardData>;

export const ABOUT_CARD_ORDER: AboutCardId[] = ['license', 'faq', 'methodology', 'author'];

export const ABOUT_STORAGE_KEY_PREFIX = 'pl_about_content_v2_';

export const DEFAULT_ABOUT_CONTENT: Record<Language, AboutContentMap> = {
  cs: {
    license: {
      id: 'license',
      title: 'Licence',
      cardSummary: 'Aplikace a metodické podklady jsou poskytovány pod licencí CC BY-NC-SA.',
      metaLabel: 'CC BY-NC-SA · Otevřené vzdělávací zdroje',
      subtitle: 'Licence CC BY-NC-SA',
      leadText:
        'Projekt a jeho vzdělávací materiály jsou šířeny pod veřejnou licencí Creative Commons CC BY-NC-SA (Uveďte původ – Neužívejte komerčně – Zachovejte licenci).',
      blocks: [
        {
          heading: 'Podmínky licence CC BY-NC-SA',
          body: '• BY (Uveďte původ): Při dalším sdílení, úpravách nebo citování je nutné uvést autora projektu (Doc. RNDr. Michal Černý, Ph.D., KISK FF MU).\n• NC (Neužívejte komerčně): Dílo a jeho součásti nesmějí být využívány ke komerčním účelům.\n• SA (Zachovejte licenci): Pokud materiál upravíte, doplníte nebo na něj navážete, musíte výsledek šířit pod stejnou nebo kompatibilní licencí CC BY-NC-SA.',
        },
        {
          heading: 'Využití ve výuce a uživatelské výstupy',
          body: 'Prostředí je volně využitelné pro studijní, seminární a nekomerční vzdělávací účely. Vlastní výstupy vytvořené uživateli (rubriky, zápisky z náslechů, zasedací pořádky či návrhy ADDIE) zůstávají v jejich správě.',
        },
      ],
    },
    faq: {
      id: 'faq',
      title: 'FAQ',
      cardSummary: 'Odpovědi na nejčastější praktické dotazy studentů a vyučujících k provozu, datům i AI funkcím.',
      metaLabel: 'Nejčastější dotazy · Rozklikávací přehled',
      subtitle: 'Často kladené otázky (FAQ)',
      leadText:
        'Přehled nejčastějších otázek spojených s používáním jednotlivých subaplikací, ukládáním dat a exporty.',
      blocks: [
        {
          heading: 'Práce s otázkami a odpověďmi',
          body: 'Sekce FAQ shromažďuje srozumitelné odpovědi na technické i metodické dotazy, se kterými se uživatelé setkávají při práci v seminářích i praxi.',
        },
      ],
      faqItems: [
        {
          question: 'Kde jsou uložena data studentů, rubriky a moje zápisky?',
          answer:
            'Pracovní data se ukládají průběžně lokálně přímo ve Vašem internetovém prohlížeči (localStorage). Pokud si vyžádáte export do Google Docs, Google Sheets nebo PDF/JSON souboru, vytvoří se dokument přímo ve Vašem úložišti či počítači.',
        },
        {
          question: 'Musím pro používání aplikace propojovat Google účet?',
          answer:
            'Ne, naprostá většina funkcí (zasedací pořádek, deník, EduDesign, Wellbeing, kriteriální hodnocení, náslechy i ADDIE) funguje ihned bez přihlášení. Google účet se připojuje volitelně pouze tehdy, když chcete exportovat či importovat soubory přímo do Google Docs nebo Google Sheets.',
        },
        {
          question: 'Jak funguje AI kontrola a nakolik se na ni mohu spolehnout?',
          answer:
            'AI asistenti slouží jako metodická podpora – například v Kriteriálním hodnocení přísně hlídají subjektivní či vágní formulace a navrhují měřitelné přepisy, v Násleších pomáhají formulovat otázky. Konečné pedagogické rozhodnutí vždy činí učitel nebo student.',
        },
        {
          question: 'Jak si mohu práci zálohovat nebo přenést na jiný počítač?',
          answer:
            'U strukturovaných modulů (Náslechy, Model ADDIE) můžete stáhnout kompletní datový soubor ve formátu JSON a později jej znovu nahrát. Pro archivaci a sdílení je k dispozici také jednotný export do PDF či tisk.',
        },
      ],
    },
    methodology: {
      id: 'methodology',
      title: 'Metodika',
      cardSummary: 'Jde o experimentální edukační prostředí sloužící studentům k tomu, aby si dokázali představit, jak fungují vzdělávací teorie.',
      metaLabel: 'Experimentální edukační prostředí',
      subtitle: 'Základní metodické vymezení',
      leadText:
        'Jde o experimentální edukační prostředí sloužící studentům k tomu, aby si dokázali představit, jak fungují vzdělávací teorie.',
      blocks: [
        {
          heading: 'Účel prostředí',
          body: 'Jde o experimentální edukační prostředí sloužící studentům k tomu, aby si dokázali představit, jak fungují vzdělávací teorie.',
        },
      ],
    },
    author: {
      id: 'author',
      title: 'Autor',
      cardSummary: 'Doc. RNDr. Michal Černý, Ph.D. — Katedra informačních studií a knihovnictví FF MU v Brně (cerny@kisk.cz).',
      metaLabel: 'KISK FF MU Brno · cerny@kisk.cz',
      subtitle: 'Doc. RNDr. Michal Černý, Ph.D.',
      leadText:
        'Doc. RNDr. Michal Černý, Ph.D. působí na Katedře informačních studií a knihovnictví Filozofické fakulty Masarykovy univerzity v Brně, kde se věnuje výzkumu i výuce.',
      blocks: [
        {
          heading: 'Akademické působení a zaměření',
          body: 'Doc. RNDr. Michal Černý, Ph.D. působí na Katedře informačních studií a knihovnictví Filozofické fakulty Masarykovy univerzity v Brně, kde se věnuje výzkumu i výuce. Vystudoval učitelství fyziky a informatiky, teologii a sociální pedagogiku, habilitoval se v oboru ICT ve vzdělávání. Ve své akademické práci se zaměřuje především na filozofii informace a výchovy, informační gramotnost, rozvoj digitálních kompetencí a využití nových technologií, včetně virtuální reality a umělé inteligence, ve vzdělávacím prostředí.',
        },
        {
          heading: 'Publikační činnost a spolupráce',
          body: 'Vedle působení na univerzitě se zabývá publikační činností a tvorbou metodických materiálů pro učitele a knihovníky. Je autorem řady odborných i popularizačních textů zaměřených na digitální technologie, efektivní učení a digitální wellbeing. Na tématech spojených s proměnou vzdělávání v digitální éře dlouhodobě spolupracuje také s dalšími vzdělávacími a odbornými institucemi v České republice.',
        },
        {
          heading: 'Kontakt',
          body: 'E-mail: cerny@kisk.cz',
        },
      ],
    },
  },
  en: {
    license: {
      id: 'license',
      title: 'License',
      cardSummary: 'This application and its methodological materials are licensed under CC BY-NC-SA.',
      metaLabel: 'CC BY-NC-SA · Open Educational Resource',
      subtitle: 'CC BY-NC-SA License',
      leadText:
        'This project and its educational materials are distributed under the Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA) license.',
      blocks: [
        {
          heading: 'CC BY-NC-SA License Terms',
          body: '• BY (Attribution): Credit must be given to the author (Assoc. Prof. RNDr. Michal Černý, Ph.D., Department of Information and Library Studies, Faculty of Arts, Masaryk University).\n• NC (NonCommercial): The material may not be used for commercial purposes.\n• SA (ShareAlike): If you remix, transform, or build upon the material, you must distribute your contributions under the same CC BY-NC-SA license.',
        },
        {
          heading: 'Educational Use & User Outputs',
          body: 'The environment is freely usable for study, seminars, and non-commercial educational activities. All user-created artifacts remain under full user control.',
        },
      ],
    },
    faq: {
      id: 'faq',
      title: 'FAQ',
      cardSummary: 'Practical answers for students and educators regarding storage, exports, and AI checks.',
      metaLabel: 'Frequently asked questions · Interactive list',
      subtitle: 'Frequently Asked Questions (FAQ)',
      leadText:
        'Answers to common practical questions about working across modules, saving data, and using built-in AI support tools.',
      blocks: [
        {
          heading: 'About This FAQ',
          body: 'Select any question below to expand the detailed explanation.',
        },
      ],
      faqItems: [
        {
          question: 'Where are student records, rubrics, and reflections stored?',
          answer:
            'Working state is saved continuously in your browser’s localStorage. When you trigger exports to Google Docs, Google Sheets, PDF, or JSON, files are written directly to your Google account or downloaded locally.',
        },
        {
          question: 'Do I have to connect a Google account to use the modules?',
          answer:
            'No. All modules work immediately without signing in. Google connection is optional and only requested when exporting or importing Google Docs and Google Sheets.',
        },
        {
          question: 'How does the AI verification assist teachers and students?',
          answer:
            'AI assistants act as methodological scaffolds—for instance, flagging subjective adjectives in rubrics or helping phrase observation prompts. Final pedagogical judgment always rests with the educator.',
        },
        {
          question: 'How can I back up or transfer my work between devices?',
          answer:
            'Modules such as Observations and ADDIE support full JSON export and re-import. All modules also support clean PDF/print export.',
        },
      ],
    },
    methodology: {
      id: 'methodology',
      title: 'Methodology',
      cardSummary: 'An experimental educational environment designed to help students visualize how educational theories work in practice.',
      metaLabel: 'Experimental educational environment',
      subtitle: 'Core Methodological Scope',
      leadText:
        'This is an experimental educational environment designed to help students imagine and understand how educational theories operate in practice.',
      blocks: [
        {
          heading: 'Purpose of the Environment',
          body: 'This is an experimental educational environment designed to help students imagine and understand how educational theories operate in practice.',
        },
      ],
    },
    author: {
      id: 'author',
      title: 'Author',
      cardSummary: 'Assoc. Prof. RNDr. Michal Černý, Ph.D. — Department of Information and Library Studies, Masaryk University (cerny@kisk.cz).',
      metaLabel: 'KISK FF MU Brno · cerny@kisk.cz',
      subtitle: 'Doc. RNDr. Michal Černý, Ph.D.',
      leadText:
        'Assoc. Prof. RNDr. Michal Černý, Ph.D. works at the Department of Information and Library Studies, Faculty of Arts, Masaryk University in Brno, focusing on both research and teaching.',
      blocks: [
        {
          heading: 'Academic Profile & Research Focus',
          body: 'Assoc. Prof. RNDr. Michal Černý, Ph.D. teaches and conducts research at the Department of Information and Library Studies, Faculty of Arts, Masaryk University in Brno. He studied Physics and Informatics Teaching, Theology, and Social Pedagogy, and completed his habilitation in ICT in Education. His academic work focuses primarily on the philosophy of information and education, information literacy, digital competence development, and the use of emerging technologies—including virtual reality and artificial intelligence—in educational environments.',
        },
        {
          heading: 'Publications & Institutional Collaboration',
          body: 'Alongside his university work, he publishes and creates methodological materials for teachers and librarians. He is the author of numerous scholarly and popular texts on digital technologies, effective learning, and digital wellbeing, and maintains long-term collaborations with educational and professional institutions across the Czech Republic on transforming education in the digital era.',
        },
        {
          heading: 'Contact',
          body: 'Email: cerny@kisk.cz',
        },
      ],
    },
  },
  pl: {
    license: {
      id: 'license',
      title: 'Licencja',
      cardSummary: 'Aplikacja oraz materiały metodyczne są udostępniane na licencji CC BY-NC-SA.',
      metaLabel: 'CC BY-NC-SA · Otwarte zasoby edukacyjne',
      subtitle: 'Licencja CC BY-NC-SA',
      leadText:
        'Projekt i jego materiały edukacyjne są udostępniane na licencji Creative Commons Uznanie autorstwa – Użycie niekomercyjne – Na tych samych warunkach (CC BY-NC-SA).',
      blocks: [
        {
          heading: 'Warunki licencji CC BY-NC-SA',
          body: '• BY (Uznanie autorstwa): Należy podać autora projektu (doc. RNDr. Michal Černý, Ph.D., KISK FF MU).\n• NC (Użycie niekomercyjne): Utwór nie może być wykorzystywany do celów komercyjnych.\n• SA (Na tych samych warunkach): Modyfikacje i utwory zależne należy rozpowszechniać na tej samej licencji CC BY-NC-SA.',
        },
        {
          heading: 'Zastosowanie w edukacji i dane użytkowników',
          body: 'Środowisko jest bezpłatnie dostępne do celów dydaktycznych, seminaryjnych i niekomercyjnych. Wszystkie treści tworzone przez użytkowników pozostają pod ich kontrolą.',
        },
      ],
    },
    faq: {
      id: 'faq',
      title: 'FAQ',
      cardSummary: 'Odpowiedzi na najczęstsze pytania studentów i wykładowców dotyczące danych, eksportu i AI.',
      metaLabel: 'Najczęstsze pytania · Rozwijana lista',
      subtitle: 'Najczęstsze pytania (FAQ)',
      leadText:
        'Zbiór praktycznych odpowiedzi dotyczących działania poszczególnych modułów, prywatności danych i eksportu dokumentów.',
      blocks: [
        {
          heading: 'Jak korzystać z sekcji FAQ',
          body: 'Kliknij dowolne pytanie poniżej, aby rozwinąć pełną odpowiedź.',
        },
      ],
      faqItems: [
        {
          question: 'Gdzie zapisywane są dane uczniów, rubryki i notatki?',
          answer:
            'Dane robocze zapisywane są automatycznie w pamięci lokalnej przeglądarki (localStorage). Eksport do Google Docs, Google Sheets, PDF lub JSON trafia bezpośrednio na konto Google użytkownika lub na jego urządzenie.',
        },
        {
          question: 'Czy muszę logować się przez Google, aby korzystać z aplikacji?',
          answer:
            'Nie. Wszystkie moduły działają od razu bez logowania. Połączenie konta Google jest opcjonalne i wymagane wyłącznie przy eksporcie lub imporcie z Google Docs i Google Sheets.',
        },
        {
          question: 'Jak działa weryfikacja AI w modułach?',
          answer:
            'Asystenci AI pełnią rolę wsparcia metodycznego – np. wykrywają subiektywne określenia w kryteriach oceniania i pomagają formułować pytania obserwacyjne. Ostateczna decyzja należy zawsze do nauczyciela.',
        },
        {
          question: 'Jak mogę utworzyć kopię zapasową lub przenieść projekt?',
          answer:
            'Moduły Hospitacje i ADDIE umożliwiają pełny eksport i ponowny import plików JSON, a cała aplikacja wspiera wydruk i eksport do formatu PDF.',
        },
      ],
    },
    methodology: {
      id: 'methodology',
      title: 'Metodyka',
      cardSummary: 'Eksperymentalne środowisko edukacyjne pomagające studentom wyobrazić sobie działanie teorii edukacyjnych w praktyce.',
      metaLabel: 'Eksperymentalne środowisko edukacyjne',
      subtitle: 'Podstawowe założenia metodyczne',
      leadText:
        'Jest to eksperymentalne środowisko edukacyjne służące studentom do tego, aby potrafili sobie wyobrazić, jak działają teorie edukacyjne.',
      blocks: [
        {
          heading: 'Cel środowiska',
          body: 'Jest to eksperymentalne środowisko edukacyjne służące studentom do tego, aby potrafili sobie wyobrazić, jak działają teorie edukacyjne.',
        },
      ],
    },
    author: {
      id: 'author',
      title: 'Autor',
      cardSummary: 'Doc. RNDr. Michal Černý, Ph.D. — Katedra Studiów Informacyjnych i Bibliotekoznawstwa Wydziału Filozoficznego Uniwersytetu Masaryka w Brnie (cerny@kisk.cz).',
      metaLabel: 'KISK FF MU Brno · cerny@kisk.cz',
      subtitle: 'Doc. RNDr. Michal Černý, Ph.D.',
      leadText:
        'Doc. RNDr. Michal Černý, Ph.D. pracuje w Katedrze Studiów Informacyjnych i Bibliotekoznawstwa na Wydziale Filozoficznym Uniwersytetu Masaryka w Brnie, gdzie zajmuje się badaniami i dydaktyką.',
      blocks: [
        {
          heading: 'Działalność akademicka i obszary badań',
          body: 'Doc. RNDr. Michal Černý, Ph.D. pracuje w Katedrze Studiów Informacyjnych i Bibliotekoznawstwa Wydziału Filozoficznego Uniwersytetu Masaryka w Brnie, gdzie prowadzi badania i zajęcia dydaktyczne. Ukończył nauczanie fizyki i informatyki, teologię oraz pedagogikę społeczną, a habilitację uzyskał w zakresie ICT w edukacji. W swojej pracy naukowej koncentruje się przede wszystkim na filozofii informacji i wychowania, kompetencjach informacyjnych i cyfrowych oraz wykorzystaniu nowych technologii – w tym wirtualnej rzeczywistości i sztucznej inteligencji – w środowisku edukacyjnym.',
        },
        {
          heading: 'Publikacje i współpraca',
          body: 'Poza pracą na uczelni zajmuje się działalnością publikacyjną oraz tworzeniem materiałów metodycznych dla nauczycieli i bibliotekarzy. Jest autorem licznych tekstów naukowych i popularnonaukowych poświęconych technologiom cyfrowym, efektywnemu uczeniu się i dobrostanowi cyfrowemu. W obszarze przemian edukacji w erze cyfrowej długofalowo współpracuje również z innymi instytucjami edukacyjnymi i eksperckimi w Republice Czeskiej.',
        },
        {
          heading: 'Kontakt',
          body: 'E-mail: cerny@kisk.cz',
        },
      ],
    },
  },
};

export function loadAboutContent(language: Language): AboutContentMap {
  const fallback = DEFAULT_ABOUT_CONTENT[language] || DEFAULT_ABOUT_CONTENT.cs;
  try {
    const raw = localStorage.getItem(`${ABOUT_STORAGE_KEY_PREFIX}${language}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AboutContentMap>;
    const merged: AboutContentMap = { ...fallback };
    for (const key of ABOUT_CARD_ORDER) {
      if (parsed && parsed[key] && typeof parsed[key] === 'object') {
        merged[key] = {
          ...fallback[key],
          ...parsed[key],
          id: key,
          blocks: Array.isArray(parsed[key]!.blocks) ? parsed[key]!.blocks! : fallback[key].blocks,
          faqItems:
            key === 'faq'
              ? Array.isArray(parsed[key]!.faqItems)
                ? parsed[key]!.faqItems
                : fallback[key].faqItems
              : undefined,
        };
      }
    }
    return merged;
  } catch {
    return fallback;
  }
}

export function saveAboutContent(language: Language, content: AboutContentMap): void {
  try {
    localStorage.setItem(`${ABOUT_STORAGE_KEY_PREFIX}${language}`, JSON.stringify(content));
  } catch (err) {
    console.warn('Could not persist about content:', err);
  }
}

export function resetAboutContent(language: Language): AboutContentMap {
  try {
    localStorage.removeItem(`${ABOUT_STORAGE_KEY_PREFIX}${language}`);
  } catch {
    // ignore storage removal errors
  }
  return DEFAULT_ABOUT_CONTENT[language] || DEFAULT_ABOUT_CONTENT.cs;
}
