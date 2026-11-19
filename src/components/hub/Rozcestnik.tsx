import React from 'react';
import {
  Users,
  BookOpen,
  Sparkles,
  Heart,
  ClipboardCheck,
  Eye,
  RotateCw,
  ArrowRight,
  Info,
} from 'lucide-react';
import { AppTab, Language } from '../../types';
import { translations } from '../../i18n/translations';

interface RozcestnikProps {
  language: Language;
  onSelectTab: (tab: AppTab) => void;
}

export const Rozcestnik: React.FC<RozcestnikProps> = ({ language, onSelectTab }) => {
  const t = translations[language];

  const modules = [
    {
      id: 'seating' as AppTab,
      title: t.hub.modules.seating.title,
      desc: t.hub.modules.seating.desc,
      icon: <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50',
      features: t.hub.moduleFeatures.seating,
    },
    {
      id: 'journal' as AppTab,
      title: t.hub.modules.journal.title,
      desc: t.hub.modules.journal.desc,
      icon: <BookOpen className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-amber-500/50',
      features: t.hub.moduleFeatures.journal,
    },
    {
      id: 'edudesign' as AppTab,
      title: t.hub.modules.edudesign.title,
      desc: t.hub.modules.edudesign.desc,
      icon: <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50',
      features: t.hub.moduleFeatures.edudesign,
    },
    {
      id: 'wellbeing' as AppTab,
      title: t.hub.modules.wellbeing.title,
      desc: t.hub.modules.wellbeing.desc,
      icon: <Heart className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-rose-500/50',
      features: t.hub.moduleFeatures.wellbeing,
    },
    {
      id: 'assessment' as AppTab,
      title: t.hub.modules.assessment.title,
      desc: t.hub.modules.assessment.desc,
      icon: <ClipboardCheck className="w-6 h-6 text-sky-600 dark:text-sky-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-sky-500/50',
      features: t.hub.moduleFeatures.assessment,
    },
    {
      id: 'observations' as AppTab,
      title: t.hub.modules.observations.title,
      desc: t.hub.modules.observations.desc,
      icon: <Eye className="w-6 h-6 text-violet-600 dark:text-violet-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-violet-500/50',
      features: t.hub.moduleFeatures.observations,
    },
    {
      id: 'addie' as AppTab,
      title: t.hub.modules.addie.title,
      desc: t.hub.modules.addie.desc,
      icon: <RotateCw className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      accent: 'border-slate-200 dark:border-slate-800 hover:border-teal-500/50',
      features: t.hub.moduleFeatures.addie,
    },
  ];

  // Always keep "O projektu" strictly as the last card in the list
  const aboutModule = {
    id: 'about' as AppTab,
    title: t.hub.modules.about.title,
    desc: t.hub.modules.about.desc,
    icon: <Info className="w-6 h-6 text-slate-700 dark:text-slate-300" />,
    accent: 'border-slate-200 dark:border-slate-800 hover:border-slate-500/50',
    features: t.hub.moduleFeatures.about,
  };

  const orderedModules = [...modules, aboutModule];

  return (
    <div className="space-y-6 py-2 max-w-7xl mx-auto">
      {/* Grid of Main Sub-Applications with "O projektu" always last */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {orderedModules.map((m) => (
          <div
            key={m.id}
            className={`group rounded-2xl border bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${m.accent}`}
          >
            <div className="space-y-4">
              <div className="p-3 w-fit rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                {m.icon}
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {m.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  {m.desc}
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {m.features.map((f, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80"
                  >
                    ✓ {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSelectTab(m.id)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-600 text-white font-semibold text-xs tracking-wide transition-all shadow-xs cursor-pointer"
              >
                <span>{t.hub.launchApp}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
