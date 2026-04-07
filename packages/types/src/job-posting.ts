// ============================================================
// Job Posting Types
// ============================================================

export type JobPostStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: JobType;
  description: string;
  requirements: string | null;
  status: JobPostStatus;
  createdById: string;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};
