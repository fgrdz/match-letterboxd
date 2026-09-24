import type { UserProfile } from '@/domain/models';
import type { MatchResult } from '@/domain/match/types';

export type MatchJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type MatchJobStage =
  | 'queued'
  | 'collecting_profiles'
  | 'calculating_match'
  | 'enriching_movies'
  | 'completed'
  | 'failed';

export interface StoredMatchResult {
  a: UserProfile;
  b: UserProfile;
  match: MatchResult;
  warnings: string[];
  tmdbEnabled: boolean;
}

export interface MatchJob {
  id: string;
  usernameA: string;
  usernameB: string;
  status: MatchJobStatus;
  stage: MatchJobStage;
  progress: number;
  workflowRunId?: string;
  result?: StoredMatchResult;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreatedMatchJob {
  job: MatchJob;
  reused: boolean;
}
