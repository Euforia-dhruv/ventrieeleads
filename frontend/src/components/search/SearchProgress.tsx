'use client';

import { Globe, Search, Mail, Phone, Link2, AtSign, Share2, Cpu, BarChart3, Target, CheckCircle2, Loader2 } from 'lucide-react';

interface SearchProgressProps {
  currentStep: number;
  steps?: string[];
}

const DEFAULT_STEPS = [
  'Parsing your search query...',
  'Resolving locations worldwide...',
  'Discovering companies...',
  'Checking websites...',
  'Finding emails & phones...',
  'Discovering social links...',
  'Detecting technology...',
  'Running AI audit...',
  'Generating scores...',
  'Enriching data...',
];

const STEP_ICONS = [Globe, Globe, Search, Globe, Mail, Link2, AtSign, Share2, Cpu, BarChart3, Target, CheckCircle2];

export default function SearchProgress({ currentStep, steps = DEFAULT_STEPS }: SearchProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Discovering companies</h3>
            <p className="text-sm text-slate-400">This usually takes 10-30 seconds</p>
          </div>
        </div>

        <div className="space-y-2">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[i] || Search;
            const isComplete = i < currentStep;
            const isCurrent = i === currentStep;
            const isPending = i > currentStep;

            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  isComplete
                    ? 'bg-green-500/10 text-green-400'
                    : isCurrent
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'text-slate-600'
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4 shrink-0 opacity-40" />
                )}
                <span className={`text-sm ${isPending ? 'opacity-40' : ''}`}>{step}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
