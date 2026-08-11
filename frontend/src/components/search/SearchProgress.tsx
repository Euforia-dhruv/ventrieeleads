'use client';

import { Loader2, Globe, Search, Mail, Link2, Cpu, BarChart3 } from 'lucide-react';

interface SearchProgressProps {
  currentStep: number;
  message?: string;
}

const STEPS = [
  { label: 'Searching providers...', icon: Globe },
  { label: 'Finding businesses...', icon: Search },
  { label: 'Extracting contacts...', icon: Mail },
  { label: 'Discovering social links...', icon: Link2 },
  { label: 'Running AI analysis...', icon: Cpu },
  { label: 'Scoring leads...', icon: BarChart3 },
];

export default function SearchProgress({ currentStep, message }: SearchProgressProps) {
  const pct = Math.min(100, Math.round((currentStep / 100) * 100));
  const activeStep = Math.min(STEPS.length - 1, Math.floor((currentStep / 100) * STEPS.length));
  const displayMessage = message || STEPS[activeStep].label;

  return (
    <div className="glass-card rounded-xl p-3 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-white">{displayMessage}</span>
            <span className="text-[10px] text-[hsl(215,16%,45%)]">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {/* Step indicators */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i < activeStep ? 'bg-green-500' : i === activeStep ? 'bg-blue-500 animate-pulse-glow' : 'bg-white/[0.1]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
