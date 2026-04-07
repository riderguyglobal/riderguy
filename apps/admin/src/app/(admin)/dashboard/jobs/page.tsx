'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, getApiClient } from '@riderguy/auth';
import { ProtectedRoute } from '@riderguy/auth';
import { UserRole, JobPosting, JOB_TYPE_LABELS } from '@riderguy/types';
import type { JobType, JobPostStatus } from '@riderguy/types';
import { Button, Spinner, Input } from '@riderguy/ui';

// ── Helpers ──

const STATUS_BADGES: Record<JobPostStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-red-100 text-red-700',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Component ──

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<(JobPosting & { createdBy?: { firstName: string; lastName: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JobPosting | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<JobType>('FULL_TIME');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const api = getApiClient();
      const { data } = await api.get('/job-postings/admin');
      setJobs(data.data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const resetForm = () => {
    setTitle('');
    setDepartment('');
    setLocation('');
    setType('FULL_TIME');
    setDescription('');
    setRequirements('');
    setStatus('DRAFT');
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (job: JobPosting) => {
    setEditing(job);
    setTitle(job.title);
    setDepartment(job.department);
    setLocation(job.location);
    setType(job.type);
    setDescription(job.description);
    setRequirements(job.requirements || '');
    setStatus(job.status === 'CLOSED' ? 'DRAFT' : job.status);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const api = getApiClient();
      const payload = { title, department, location, type, description, requirements: requirements || undefined, status };

      if (editing) {
        await api.patch(`/job-postings/admin/${editing.id}`, payload);
      } else {
        await api.post('/job-postings/admin', payload);
      }

      resetForm();
      await fetchJobs();
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: JobPostStatus) => {
    try {
      const api = getApiClient();
      await api.patch(`/job-postings/admin/${id}`, { status: newStatus });
      await fetchJobs();
    } catch {
      // handle silently
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job posting?')) return;
    try {
      const api = getApiClient();
      await api.delete(`/job-postings/admin/${id}`);
      await fetchJobs();
    } catch {
      // handle silently
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage career listings displayed on the marketing website.
            </p>
          </div>
          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-brand-500 text-white hover:bg-brand-600"
          >
            + New Job Posting
          </Button>
        </div>

        {/* ── Create / Edit Form ── */}
        {showForm && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              {editing ? 'Edit Job Posting' : 'New Job Posting'}
            </h2>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Job Title *</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Operations Manager" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Department *</label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} required placeholder="e.g. Operations" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Location *</label>
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} required placeholder="e.g. Accra, Ghana" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Job Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as JobType)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {Object.entries(JOB_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Describe the role, responsibilities, and what the candidate will be doing..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Requirements</label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="List qualifications, skills, or experience needed (optional)..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-auto"
                >
                  <option value="DRAFT">Draft (not visible on website)</option>
                  <option value="PUBLISHED">Published (live on website)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saving} className="bg-brand-500 text-white hover:bg-brand-600">
                  {saving ? 'Saving...' : editing ? 'Update Job' : 'Create Job'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── Job Listings Table ── */}
        {loading ? (
          <div className="mt-12 flex justify-center">
            <Spinner className="h-8 w-8 text-brand-500" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="mt-12 rounded-xl border bg-white p-12 text-center">
            <p className="text-lg font-medium text-gray-900">No job postings yet</p>
            <p className="mt-1 text-sm text-gray-500">Create your first job posting to display it on the careers page.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Title</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Department</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Location</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Published</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                        {job.createdBy && (
                          <p className="text-xs text-gray-400">
                            by {job.createdBy.firstName} {job.createdBy.lastName}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{job.department}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{job.location}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{JOB_TYPE_LABELS[job.type]}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[job.status]}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-500">{formatDate(job.publishedAt)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(job)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                            Edit
                          </button>
                          {job.status === 'DRAFT' && (
                            <button onClick={() => handleStatusChange(job.id, 'PUBLISHED')} className="text-xs font-medium text-green-600 hover:text-green-700">
                              Publish
                            </button>
                          )}
                          {job.status === 'PUBLISHED' && (
                            <button onClick={() => handleStatusChange(job.id, 'CLOSED')} className="text-xs font-medium text-amber-600 hover:text-amber-700">
                              Close
                            </button>
                          )}
                          {job.status === 'CLOSED' && (
                            <button onClick={() => handleStatusChange(job.id, 'PUBLISHED')} className="text-xs font-medium text-green-600 hover:text-green-700">
                              Reopen
                            </button>
                          )}
                          <button onClick={() => handleDelete(job.id)} className="text-xs font-medium text-red-600 hover:text-red-700">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
