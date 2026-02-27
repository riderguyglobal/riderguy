'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles, Crown, ChevronUp } from 'lucide-react';
import type { GamificationBadge } from '@/hooks/use-gamification';

// ── Level-Up Celebration Modal ──────────────────────────────
interface LevelUpProps {
  level: number;
  levelName: string;
  onDismiss: () => void;
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'from-slate-400 to-slate-500',
  2: 'from-emerald-400 to-emerald-600',
  3: 'from-orange-400 to-orange-600',
  4: 'from-blue-400 to-blue-600',
  5: 'from-purple-400 to-purple-600',
  6: 'from-amber-400 to-amber-600',
  7: 'from-rose-400 via-amber-400 to-violet-400',
};

const LEVEL_ICONS = ['🏁', '🏃', '🔥', '⚡', '🎯', '👑', '🌟'];

export function LevelUpCelebration({ level, levelName, onDismiss }: LevelUpProps) {
  const [show, setShow] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; size: number }>>([]);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    // Generate floating particles
    const p = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
      size: 2 + Math.random() * 4,
    }));
    setParticles(p);
  }, []);

  const gradientClass = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={onDismiss}
      />

      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-amber-400/40 animate-float pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${3 + p.delay}s`,
          }}
        />
      ))}

      {/* Modal */}
      <div
        className={`relative z-10 w-[85vw] max-w-sm transition-all duration-700 ${
          show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-8'
        }`}
      >
        <div className="rounded-3xl overflow-hidden">
          {/* Header gradient */}
          <div className={`relative bg-gradient-to-br ${gradientClass} p-8 text-center`}>
            {/* Glow ring */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-40 h-40 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-28 h-28 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>

            {/* Level icon */}
            <div className="relative">
              <span className="text-6xl drop-shadow-2xl">{LEVEL_ICONS[level - 1] ?? '🏁'}</span>
            </div>

            {/* Close */}
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="bg-card-elevated p-6 text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <ChevronUp className="h-5 w-5 text-accent-400 animate-bounce" />
              <span className="text-accent-400 text-sm font-bold uppercase tracking-widest">Level Up!</span>
              <ChevronUp className="h-5 w-5 text-accent-400 animate-bounce" />
            </div>

            <h2 className="text-primary text-2xl font-black">
              Level {level}
            </h2>
            <p className={`text-lg font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
              {levelName}
            </p>

            <p className="text-muted text-sm leading-relaxed">
              Keep going! Higher levels unlock lower commission rates and exclusive perks.
            </p>

            <button
              onClick={onDismiss}
              className="mt-4 w-full py-3.5 rounded-2xl gradient-accent text-white font-bold text-sm tracking-wide btn-press glow-accent"
            >
              Let&apos;s Go!
            </button>
          </div>
        </div>
      </div>

      {/* Global float animation */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-30px) scale(1.2); opacity: 0.8; }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

// ── Badge Unlock Celebration ────────────────────────────────
interface BadgeCelebrationProps {
  badges: GamificationBadge[];
  onDismiss: () => void;
}

export function BadgeCelebration({ badges, onDismiss }: BadgeCelebrationProps) {
  const [show, setShow] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);

  const badge = badges[currentIndex];
  if (!badge) return null;

  const isLast = currentIndex >= badges.length - 1;

  const handleNext = () => {
    if (isLast) {
      onDismiss();
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}
        onClick={onDismiss}
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-[85vw] max-w-sm transition-all duration-500 ${
          show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <div className="glass-elevated rounded-3xl p-8 text-center">
          {/* Close */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-muted hover:text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Sparkle header */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">Badge Unlocked!</span>
            <Sparkles className="h-5 w-5 text-amber-400" />
          </div>

          {/* Badge icon */}
          <div className="relative inline-flex mb-4">
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl scale-150 animate-pulse" />
            <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 border-2 border-amber-400/30 flex items-center justify-center">
              <span className="text-5xl">{badge.icon}</span>
            </div>
          </div>

          {/* Badge info */}
          <h3 className="text-primary text-xl font-black mb-1">{badge.name}</h3>
          <p className="text-muted text-sm mb-1">{badge.description}</p>

          {badge.xpReward > 0 && (
            <p className="text-accent-400 text-sm font-semibold">+{badge.xpReward} XP</p>
          )}

          {/* Counter */}
          {badges.length > 1 && (
            <p className="text-subtle text-xs mt-3">
              {currentIndex + 1} of {badges.length}
            </p>
          )}

          {/* Action */}
          <button
            onClick={handleNext}
            className="mt-5 w-full py-3.5 rounded-2xl gradient-accent text-white font-bold text-sm tracking-wide btn-press glow-accent"
          >
            {isLast ? 'Awesome!' : 'Next Badge'}
          </button>
        </div>
      </div>
    </div>
  );
}
