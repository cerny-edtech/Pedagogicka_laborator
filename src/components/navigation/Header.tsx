import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Globe,
  Headphones,
  Coffee,
  CloudRain,
  Flame,
  Check,
  Power,
} from 'lucide-react';
import { AppTab, Language } from '../../types';
import { getT } from '../../i18n/translations';
import { AmbientSoundType } from '../../utils/ambientAudio';
import { playTypewriterSound } from '../../utils/typewriterAudio';
import logoImg from '../../assets/images/pedlab_minimal_logo_1794603510952.jpg';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  language: Language;
  onSelectLanguage: (lang: Language) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onPrint: () => void;
  typewriterEnabled: boolean;
  onToggleTypewriter: () => void;
  ambientEnabled: boolean;
  ambientSound: AmbientSoundType;
  ambientVolume: number;
  onToggleAmbient: () => void;
  onSelectAmbientSound: (sound: AmbientSoundType) => void;
  onChangeAmbientVolume: (volume: number) => void;
}

const LANGUAGE_OPTIONS: { code: Language; label: string; short: string }[] = [
  { code: 'cs', label: 'Čeština', short: 'CS' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'pl', label: 'Polski', short: 'PL' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  language,
  onSelectLanguage,
  isDark,
  onToggleTheme,
  onPrint,
  typewriterEnabled,
  onToggleTypewriter,
  ambientEnabled,
  ambientSound,
  ambientVolume,
  onToggleAmbient,
  onSelectAmbientSound,
  onChangeAmbientVolume,
}) => {
  const t = getT(language);
  const [logoError, setLogoError] = useState(false);
  const [ambientOpen, setAmbientOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const ambientRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  const isInsideSubApp = activeTab !== 'hub';

  // Close popovers on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ambientRef.current && !ambientRef.current.contains(target)) {
        setAmbientOpen(false);
      }
      if (langRef.current && !langRef.current.contains(target)) {
        setLangOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAmbientOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const ambientOptions: {
    id: AmbientSoundType;
    letter: string;
    label: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'cafe',
      letter: 'a)',
      label: t.header.ambientSounds.cafe,
      icon: <Coffee className="w-4 h-4" />,
    },
    {
      id: 'rain',
      letter: 'b)',
      label: t.header.ambientSounds.rain,
      icon: <CloudRain className="w-4 h-4" />,
    },
    {
      id: 'fire',
      letter: 'c)',
      label: t.header.ambientSounds.fire,
      icon: <Flame className="w-4 h-4" />,
    },
  ];

  const activeAmbientIcon = !ambientEnabled ? (
    <Headphones className="w-3.5 h-3.5" />
  ) : ambientSound === 'cafe' ? (
    <Coffee className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
  ) : ambientSound === 'rain' ? (
    <CloudRain className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
  ) : (
    <Flame className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md no-print transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Minimalist White-Bg Brand Logo + App Title + Back-to-Hub Link */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSelectTab('hub')}
            className="flex items-center gap-3 text-left group focus:outline-none cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              {!logoError ? (
                <img
                  src={logoImg}
                  alt={t.appTitle}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain p-0.5 bg-white"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-slate-900"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H12v16H4.5A2.5 2.5 0 0 0 2 21.5z" />
                  <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H12v16h7.5A2.5 2.5 0 0 1 22 21.5z" />
                  <circle cx="12" cy="7.5" r="1.4" fill="#4F46E5" stroke="none" />
                </svg>
              )}
            </div>
            <span className="font-bold text-slate-900 dark:text-white tracking-tight text-base whitespace-nowrap">
              {t.appTitle}
            </span>
          </button>

          {isInsideSubApp && (
            <div className="flex items-center gap-2 min-w-0">
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 hidden sm:block" />
              <button
                type="button"
                onClick={() => onSelectTab('hub')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-700 dark:text-slate-200 dark:hover:text-indigo-300 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.header.backToHub}</span>
              </button>
              <span className="hidden md:inline-block text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate max-w-[210px]">
                {t.nav[activeTab]}
              </span>
            </div>
          )}
        </div>

        {/* Right: Typewriter, Ambient Sound Popup, Compact Language Dropdown, Print/PDF, Theme */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 1. Typewriter Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              if (!typewriterEnabled) {
                playTypewriterSound(false, false, false);
              }
              onToggleTypewriter();
            }}
            title={typewriterEnabled ? t.header.typewriterTooltipOn : t.header.typewriterTooltipOff}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap shrink-0 cursor-pointer ${
              typewriterEnabled
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            {typewriterEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{t.header.typewriterLabel}</span>
          </button>

          {/* 2. Universal Ambient Background Sound Button + Popover */}
          <div className="relative" ref={ambientRef}>
            <button
              type="button"
              onClick={() => {
                setLangOpen(false);
                setAmbientOpen((prev) => !prev);
              }}
              title={t.header.ambientTooltip}
              aria-expanded={ambientOpen}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition whitespace-nowrap shrink-0 cursor-pointer ${
                ambientEnabled
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800/70'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {activeAmbientIcon}
              <span className="hidden sm:inline">
                {ambientEnabled ? t.header.ambientSounds[ambientSound] : t.header.ambientLabel}
              </span>
            </button>

            {ambientOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-4 z-50 space-y-4">
                {/* Popover Header + Master Power Toggle */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {t.header.ambientTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t.header.ambientSubtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleAmbient}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                      ambientEnabled
                        ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{ambientEnabled ? t.header.ambientTurnOff : t.header.ambientTurnOn}</span>
                  </button>
                </div>

                {/* 3 Ambient Sound Choices: Cafe, Rain, Fire */}
                <div className="space-y-1.5">
                  {ambientOptions.map((opt) => {
                    const isSelected = ambientSound === opt.id;
                    const isPlayingThis = ambientEnabled && isSelected;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectAmbientSound(opt.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          isPlayingThis
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                            : isSelected
                            ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`p-1.5 rounded-lg ${
                              isPlayingThis
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {opt.icon}
                          </span>
                          <span>
                            {opt.letter} {opt.label}
                          </span>
                        </div>
                        {isPlayingThis && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>

                {/* Volume Slider */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="ambient-volume-slider"
                      className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                      {t.header.ambientVolume}
                    </label>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {ambientVolume} %
                    </span>
                  </div>
                  <input
                    id="ambient-volume-slider"
                    type="range"
                    min={0}
                    max={100}
                    value={ambientVolume}
                    onChange={(e) => onChangeAmbientVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Compact Single-Button Language Switcher */}
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => {
                setAmbientOpen(false);
                setLangOpen((prev) => !prev);
              }}
              title={t.header.languageSelectorTitle}
              aria-expanded={langOpen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="uppercase">{language}</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {langOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-1.5 z-50 space-y-0.5">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const active = language === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => {
                        onSelectLanguage(opt.code);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[10px] font-mono opacity-75">{opt.short}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Print / PDF */}
          <button
            type="button"
            onClick={onPrint}
            title={t.nav.print}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden lg:inline">{t.nav.print}</span>
          </button>

          {/* 5. Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? t.nav.light : t.nav.dark}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition shrink-0 cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
