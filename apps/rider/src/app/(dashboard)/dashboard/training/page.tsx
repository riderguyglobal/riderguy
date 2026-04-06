'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@riderguy/auth';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  Lock,
  ChevronRight,
  Star,
  Shield,
  Zap,
  TrendingUp,
  Play,
} from 'lucide-react';

// ── Types ──

interface Course {
  id: string;
  title: string;
  description: string;
  category: 'onboarding' | 'safety' | 'skills' | 'certification' | 'specialized';
  status: 'not_started' | 'in_progress' | 'completed' | 'locked';
  progress: number; // 0-100
  totalModules: number;
  completedModules: number;
  estimatedMinutes: number;
  certificateId?: string;
}

interface Certification {
  id: string;
  title: string;
  issuedAt: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'pending';
}

// ── Fallback data (used when API is unavailable) ──

const FALLBACK_COURSES: Course[] = [
  {
    id: 'onboarding-101',
    title: 'Rider Onboarding',
    description: 'Learn the basics of using the RiderGuy platform, accepting orders, and completing deliveries.',
    category: 'onboarding',
    status: 'completed',
    progress: 100,
    totalModules: 5,
    completedModules: 5,
    estimatedMinutes: 30,
    certificateId: 'cert-onboarding',
  },
  {
    id: 'road-safety',
    title: 'Road Safety Fundamentals',
    description: 'Defensive riding techniques, traffic rules, and accident prevention for motorcycle riders.',
    category: 'safety',
    status: 'in_progress',
    progress: 60,
    totalModules: 8,
    completedModules: 5,
    estimatedMinutes: 45,
  },
  {
    id: 'customer-service',
    title: 'Customer Service Excellence',
    description: 'Communication skills, handling difficult situations, and delivering a professional experience.',
    category: 'skills',
    status: 'in_progress',
    progress: 30,
    totalModules: 6,
    completedModules: 2,
    estimatedMinutes: 40,
  },
  {
    id: 'food-handling',
    title: 'Food Safety & Handling',
    description: 'Proper food handling, temperature control, and hygiene standards for food deliveries.',
    category: 'certification',
    status: 'not_started',
    progress: 0,
    totalModules: 4,
    completedModules: 0,
    estimatedMinutes: 25,
  },
  {
    id: 'vehicle-maintenance',
    title: 'Basic Vehicle Maintenance',
    description: 'Daily checks, tire maintenance, oil changes, and when to seek professional help.',
    category: 'skills',
    status: 'not_started',
    progress: 0,
    totalModules: 6,
    completedModules: 0,
    estimatedMinutes: 35,
  },
  {
    id: 'advanced-navigation',
    title: 'Advanced Navigation & Route Optimization',
    description: 'Master efficient routing, shortcut strategies, and handling complex multi-stop deliveries.',
    category: 'specialized',
    status: 'locked',
    progress: 0,
    totalModules: 5,
    completedModules: 0,
    estimatedMinutes: 30,
  },
];

const FALLBACK_CERTIFICATIONS: Certification[] = [
  {
    id: 'cert-onboarding',
    title: 'RiderGuy Certified Rider',
    issuedAt: '2026-03-15',
    status: 'active',
  },
];

// ── Helpers ──

const CATEGORY_CONFIG = {
  onboarding: { label: 'Onboarding', color: 'bg-blue-500/15 text-blue-400', icon: BookOpen },
  safety: { label: 'Safety', color: 'bg-red-500/15 text-red-400', icon: Shield },
  skills: { label: 'Skills', color: 'bg-amber-500/15 text-amber-400', icon: Zap },
  certification: { label: 'Certification', color: 'bg-brand-500/15 text-brand-400', icon: Award },
  specialized: { label: 'Specialized', color: 'bg-purple-500/15 text-purple-400', icon: Star },
};

const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  locked: 'Locked',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Page Component ──

export default function TrainingPage() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState<'courses' | 'certifications'>('courses');

  const { data: courses = FALLBACK_COURSES } = useQuery({
    queryKey: ['training-courses'],
    queryFn: async () => {
      const res = await api.get('/riders/training/courses');
      return res.data as Course[];
    },
    retry: false,
  });

  const { data: certifications = FALLBACK_CERTIFICATIONS } = useQuery({
    queryKey: ['training-certifications'],
    queryFn: async () => {
      const res = await api.get('/riders/training/certifications');
      return res.data as Certification[];
    },
    retry: false,
  });

  const completedCount = courses.filter((c) => c.status === 'completed').length;
  const inProgressCount = courses.filter((c) => c.status === 'in_progress').length;
  const overallProgress = courses.length > 0
    ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length)
    : 0;

  return (
    <div className="min-h-[100dvh] bg-page">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-subtle hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-secondary" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-primary">Training & Certification</h1>
            <p className="text-xs text-tertiary">Your learning journey</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* ── Progress Overview ── */}
        <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-brand-100">Overall Progress</p>
              <p className="mt-1 text-3xl font-bold">{overallProgress}%</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <TrendingUp className="h-7 w-7" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <div className="mt-4 flex items-center gap-4 text-sm text-brand-100">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {completedCount} completed
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {inProgressCount} in progress
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="h-4 w-4" />
              {certifications.filter((c) => c.status === 'active').length} certificates
            </span>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex rounded-xl bg-surface-subtle p-1">
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === 'courses'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Courses ({courses.length})
          </button>
          <button
            onClick={() => setActiveTab('certifications')}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
              activeTab === 'certifications'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Certifications ({certifications.length})
          </button>
        </div>

        {/* ── Course List ── */}
        {activeTab === 'courses' && (
          <div className="space-y-3">
            {courses.map((course) => {
              const catConfig = CATEGORY_CONFIG[course.category];
              const CatIcon = catConfig.icon;
              const isLocked = course.status === 'locked';

              return (
                <div
                  key={course.id}
                  className={`rounded-2xl border bg-card p-4 transition-all ${
                    isLocked
                      ? 'border-themed opacity-60'
                      : 'border-themed hover:border-brand-500/30 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${catConfig.color}`}>
                      {isLocked ? (
                        <Lock className="h-5 w-5" />
                      ) : (
                        <CatIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-primary truncate">{course.title}</h3>
                        {course.status === 'completed' && (
                          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-tertiary line-clamp-2">{course.description}</p>

                      <div className="mt-2.5 flex items-center gap-3 text-xs text-secondary">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catConfig.color}`}>
                          {catConfig.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {course.estimatedMinutes} min
                        </span>
                        <span>
                          {course.completedModules}/{course.totalModules} modules
                        </span>
                      </div>

                      {/* Progress bar */}
                      {!isLocked && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-surface-subtle">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                course.status === 'completed' ? 'bg-brand-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-secondary">{course.progress}%</span>
                        </div>
                      )}

                      {/* Action button */}
                      {!isLocked && course.status !== 'completed' && (
                        <button className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-500">
                          <Play className="h-3.5 w-3.5" />
                          {course.status === 'in_progress' ? 'Continue Course' : 'Start Course'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Certifications List ── */}
        {activeTab === 'certifications' && (
          <div className="space-y-3">
            {certifications.length === 0 ? (
              <div className="rounded-2xl border border-themed bg-card p-8 text-center">
                <Award className="mx-auto h-10 w-10 text-tertiary" />
                <p className="mt-3 text-sm font-medium text-primary">No certifications yet</p>
                <p className="mt-1 text-xs text-tertiary">
                  Complete courses to earn certifications and unlock new opportunities.
                </p>
              </div>
            ) : (
              certifications.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center gap-4 rounded-2xl border border-themed bg-card p-4"
                >
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                    cert.status === 'active' ? 'bg-brand-500/15 text-brand-500' : 'bg-red-500/15 text-red-400'
                  }`}>
                    <Award className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-primary">{cert.title}</h3>
                    <p className="mt-0.5 text-xs text-tertiary">
                      Issued: {formatDate(cert.issuedAt)}
                      {cert.expiresAt && ` · Expires: ${formatDate(cert.expiresAt)}`}
                    </p>
                    <span className={`mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      cert.status === 'active'
                        ? 'bg-brand-500/15 text-brand-400'
                        : cert.status === 'expired'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {cert.status === 'active' ? 'Active' : cert.status === 'expired' ? 'Expired' : 'Pending'}
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-tertiary" />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
