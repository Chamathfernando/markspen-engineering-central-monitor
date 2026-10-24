import React from 'react';
import { Modal } from '../common/Modal';
import { useTheme } from '../../context/ThemeContext';
import { ThemeMode } from '../../types';
import {
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  FileCode,
  Palette,
  Check
} from 'lucide-react';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppearanceModal: React.FC<AppearanceModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, isSaving } = useTheme();

  const themeOptions: Array<{
    id: ThemeMode;
    title: string;
    description: string;
    icon: React.ElementType;
    badge: string;
    accentColor: string;
    previewBg: string;
    previewBorder: string;
    previewCard: string;
    previewText: string;
  }> = [
    {
      id: 'light',
      title: 'Light Mode',
      description: 'Crisp, high-contrast daylight aesthetic with clean white surfaces and slate accents.',
      icon: Sun,
      badge: 'Classic',
      accentColor: 'text-amber-500 bg-amber-50 border-amber-200',
      previewBg: 'bg-slate-100',
      previewBorder: 'border-slate-300',
      previewCard: 'bg-white text-slate-800',
      previewText: 'text-slate-900'
    },
    {
      id: 'dark',
      title: 'Dark Mode',
      description: 'Deep midnight aesthetic engineered for reduced eye strain and high-focus workflows.',
      icon: Moon,
      badge: 'Pro Contrast',
      accentColor: 'text-indigo-400 bg-slate-800 border-indigo-500/30',
      previewBg: 'bg-slate-950',
      previewBorder: 'border-slate-700',
      previewCard: 'bg-slate-900 text-slate-200',
      previewText: 'text-white'
    },
    {
      id: 'colorful',
      title: 'Colorful Mode',
      description: 'Vibrant, energetic palette featuring luminous gradients, playful badges, and rich tones.',
      icon: Sparkles,
      badge: 'Vibrant',
      accentColor: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-200',
      previewBg: 'bg-gradient-to-br from-indigo-100/70 via-purple-100/50 to-pink-100/60',
      previewBorder: 'border-purple-300',
      previewCard: 'bg-white/95 text-slate-900 shadow-sm',
      previewText: 'text-indigo-950'
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Appearance & Theme Settings"
      subtitle="Select your preferred UI color mode and workspace aesthetic"
      maxWidth="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileCode className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Persisted in <strong className="font-mono text-slate-700">settings.json</strong></span>
            {isSaving ? (
              <span className="text-[10px] text-amber-600 font-semibold animate-pulse">(Saving...)</span>
            ) : (
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Synced
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Intro Banner */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0">
            <Palette className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-blue-950 mb-0.5">Interface Mode Selection</h4>
            <p className="text-blue-800 leading-relaxed">
              Switching themes applies in real time across all dashboards, operation tables, dialogs, and navigation menus. Your selection is automatically recorded in <strong>settings.json</strong> in the project directory.
            </p>
          </div>
        </div>

        {/* 3 Theme Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {themeOptions.map(option => {
            const isSelected = theme === option.id;
            const Icon = option.icon;

            return (
              <div
                key={option.id}
                role="button"
                tabIndex={0}
                onClick={() => setTheme(option.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTheme(option.id);
                  }
                }}
                className={`relative flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 text-left outline-none
                  ${isSelected
                    ? 'border-blue-600 bg-blue-50/30 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'}`}
              >
                {/* Active Radio Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl border ${option.accentColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      {option.badge}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                        ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}
                    >
                      {isSelected && <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />}
                    </div>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {option.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">
                  {option.description}
                </p>

                {/* Mini Preview Card */}
                <div className={`p-2.5 rounded-xl border ${option.previewBorder} ${option.previewBg} space-y-2 mt-auto`}>
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-2 rounded-full bg-slate-400/40" />
                    <div className="w-4 h-2 rounded-full bg-blue-500" />
                  </div>
                  <div className={`p-2 rounded-lg border ${option.previewBorder} ${option.previewCard} space-y-1`}>
                    <div className={`text-[10px] font-bold ${option.previewText}`}>
                      {option.title} Workspace
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-300/40" />
                    <div className="w-3/4 h-1.5 rounded-full bg-slate-300/30" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Persistence Confirmation Card */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Currently Active: <strong className="uppercase font-mono text-slate-900">{theme}</strong></span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            Target: <span className="text-slate-800">/settings.json</span>
          </span>
        </div>
      </div>
    </Modal>
  );
};
