import { parseBuildNumberFromComments } from '../utils/parsers.ts';

export type PullRequestCard = {
  id: number;
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  branchName: string;
  author: { login: string; avatarUrl: string; url: string };
  latestCommit: {
    sha: string;
    message: string;
    authorLogin: string;
    authorAvatarUrl: string;
    authoredAt: string;
    url: string;
  } | null;
  latestComment: {
    body: string;
    createdAt: string;
    updatedAt: string;
    authorLogin: string;
    authorAvatarUrl: string;
    url: string;
  } | null;
  linkedIssue: string | null;
  buildNumber: string | null;
  ciStates: Array<{ name: string; status: string; conclusion: string | null; url: string | null }>;
  reviewStatus: 'draft' | 'pending review' | 'ci failed' | 'approved' | 'approved (no write)' | null;
  approvedCount: number;
  mergedAt?: string | null;
};

const API_BASE = 'https://api.github.com';
const OWNER = 'NTUT-NPC';
const REPO = 'tattoo';
const MAX_PRS = 12;
const MAX_MERGED_PRS = 8;
const TOKEN_STORAGE_KEY = 'github_api_token';
declare const __DEFAULT_GITHUB_TOKEN__: string;

const DEFAULT_GITHUB_TOKEN = (__DEFAULT_GITHUB_TOKEN__ ?? '').trim();

function getTokenFromStorage(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)?.trim() ?? '';
}

function getActiveToken(): string {
  const storedToken = getTokenFromStorage();
  return storedToken || DEFAULT_GITHUB_TOKEN;
}

export function hasSavedGithubToken(): boolean {
  return Boolean(getActiveToken());
}

export function isUsingEnvironmentGithubToken(): boolean {
  return !getTokenFromStorage() && Boolean(DEFAULT_GITHUB_TOKEN);
}

export function saveGithubToken(token: string) {
  if (typeof window === 'undefined') return;

  const normalizedToken = token.trim();

  if (!normalizedToken) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, normalizedToken);
}

function isLikelyGithubToken(value: string): boolean {
  return /^(gh[pousr]_|github_pat_).{10,}$/.test(value);
}

export function validateGithubToken(token: string): { valid: boolean; reason: 'empty' | 'invalid_format' | 'ok' } {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    return { valid: false, reason: 'empty' };
  }

  if (!isLikelyGithubToken(normalizedToken)) {
    return { valid: false, reason: 'invalid_format' };
  }

  return { valid: true, reason: 'ok' };
}

async function request(path: string) {
  const token = getActiveToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${path}`);
  }

  return response.json();
}

export async function fetchPullRequestMergeState(number: number): Promise<{ merged: boolean; state: string }> {
  const pr = await request(`/repos/${OWNER}/${REPO}/pulls/${number}`);
  return {
    merged: Boolean(pr.merged_at),
    state: pr.state ?? 'unknown',
  };
}

const PR_CI_WORKFLOW_SCOPE: Record<string, string[]> = {
  'flutter analyze': ['analyze'],
  'pr preview': ['prepare', 'android', 'ios'],
};

const ciStateCache = new Map<string, { fetchedAt: number; value: Array<{ name: string; status: string; conclusion: string | null; url: string | null }> }>();
const CI_STATE_CACHE_TTL_MS = 60_000;

function normalizeJobName(value: string) {
  return value.trim().toLowerCase();
}

async function fetchCiStatesByWorkflowScope(sha: string) {
  const cached = ciStateCache.get(sha);
  if (cached && Date.now() - cached.fetchedAt < CI_STATE_CACHE_TTL_MS) {
    return cached.value;
  }

  const runsPayload = await request(`/repos/${OWNER}/${REPO}/actions/runs?head_sha=${sha}&per_page=20`);
  const workflowRuns = (runsPayload.workflow_runs ?? []).filter((run: any) => {
    const workflowName = normalizeJobName(String(run?.name ?? ''));
    return workflowName in PR_CI_WORKFLOW_SCOPE && (run?.event === 'pull_request' || run?.event === 'workflow_dispatch');
  });

  const latestJobByName = new Map<string, { name: string; status: string; conclusion: string | null; url: string | null; startedAt: number }>();

  for (const run of workflowRuns) {
    const allowedJobs = new Set(PR_CI_WORKFLOW_SCOPE[normalizeJobName(run.name)] ?? []);
    if (!allowedJobs.size) continue;

    const jobsPayload = await request(`/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs?per_page=100`);
    for (const job of jobsPayload.jobs ?? []) {
      const jobName = normalizeJobName(String(job?.name ?? ''));
      if (!allowedJobs.has(jobName)) continue;
      const startedAt = new Date(job.started_at ?? job.created_at ?? run.created_at).getTime();
      const existing = latestJobByName.get(jobName);
      if (existing && existing.startedAt >= startedAt) continue;

      latestJobByName.set(jobName, {
        name: jobName,
        status: job.status ?? 'queued',
        conclusion: job.conclusion,
        url: job.html_url ?? run.html_url,
        startedAt,
      });
    }
  }

  const normalized = ['analyze', 'prepare', 'ios', 'android']
    .map((name) => latestJobByName.get(name))
    .filter((item): item is { name: string; status: string; conclusion: string | null; url: string | null; startedAt: number } => Boolean(item))
    .map(({ startedAt: _, ...item }) => item);

  ciStateCache.set(sha, { fetchedAt: Date.now(), value: normalized });
  return normalized;
}

function isFailedCiState(item: { status: string; conclusion: string | null }) {
  const status = item.status?.toLowerCase?.() ?? '';
  const conclusion = item.conclusion?.toLowerCase?.() ?? '';
  return status === 'failure' || conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'cancelled';
}

function inferReviewStatus(params: {
  draft: boolean;
  ciStates: Array<{ status: string; conclusion: string | null }>;
  hasWriteApproved: boolean;
  hasAnyApproved: boolean;
  hasChangesRequested: boolean;
}): PullRequestCard['reviewStatus'] {
  if (params.draft) {
    return 'draft';
  }

  if (params.ciStates.some((item) => isFailedCiState(item))) {
    return 'ci failed';
  }

  if (params.hasWriteApproved && !params.hasChangesRequested) {
    return 'approved';
  }

  if (params.hasAnyApproved && !params.hasChangesRequested) {
    return 'approved (no write)';
  }

  return 'pending review';
}

function getLatestReviewsByAuthor(reviews: any[]) {
  const latestReviewsByAuthor = new Map<string, string>();
  reviews.forEach((review) => {
    const login = review.user?.login;
    if (!login) return;

    latestReviewsByAuthor.set(login, review.state ?? '');
  });

  return latestReviewsByAuthor;
}

const permissionCache = new Map<string, boolean>();

async function hasWritePermission(login: string): Promise<boolean> {
  const cacheKey = login.toLowerCase();
  if (permissionCache.has(cacheKey)) return permissionCache.get(cacheKey) as boolean;

  try {
    const payload = await request(`/repos/${OWNER}/${REPO}/collaborators/${encodeURIComponent(login)}/permission`);
    const permission = String(payload.permission ?? '').toLowerCase();
    const result = permission === 'admin' || permission === 'write' || permission === 'maintain';
    permissionCache.set(cacheKey, result);
    return result;
  } catch {
    permissionCache.set(cacheKey, false);
    return false;
  }
}

async function getReviewApprovalSummary(reviews: any[]) {
  const latestReviewsByAuthor = getLatestReviewsByAuthor(reviews);
  const reviewEntries = [...latestReviewsByAuthor.entries()];
  const hasChangesRequested = reviewEntries.some(([, state]) => state === 'CHANGES_REQUESTED');
  const approvedAuthors = reviewEntries.filter(([, state]) => state === 'APPROVED').map(([login]) => login);
  const approvedAuthorPermissions = await Promise.all(approvedAuthors.map((login) => hasWritePermission(login)));
  const writeApprovedCount = approvedAuthorPermissions.filter(Boolean).length;

  return {
    hasChangesRequested,
    hasWriteApproved: writeApprovedCount > 0,
    hasAnyApproved: approvedAuthors.length > 0,
    approvedCount: approvedAuthors.length,
  };
}

async function fetchLinkedIssueNumber(prNumber: number): Promise<string | null> {
  try {
    const timeline = await request(`/repos/${OWNER}/${REPO}/issues/${prNumber}/timeline?per_page=100`);
    const connectedEvent = [...timeline].reverse().find((event: any) => event?.event === 'connected' && event?.subject?.type === 'Issue');
    if (connectedEvent?.subject?.number) return String(connectedEvent.subject.number);
  } catch {
    return null;
  }

  return null;
}

function isBotActor(user: any): boolean {
  const login = user?.login?.toLowerCase?.() ?? '';
  const userType = user?.type?.toLowerCase?.() ?? '';

  return userType === 'bot' || login.endsWith('[bot]');
}

export async function fetchPrCards(): Promise<PullRequestCard[]> {
  const pulls = await request(
    `/repos/${OWNER}/${REPO}/pulls?state=open&sort=updated&direction=desc&per_page=${MAX_PRS}`,
  );

  const cards = await Promise.all(
    pulls.map(async (pr: any) => {
      const [commits, issueComments, reviewComments, reviews, linkedIssue] = await Promise.all([
        request(`/repos/${OWNER}/${REPO}/pulls/${pr.number}/commits?per_page=100`),
        request(`/repos/${OWNER}/${REPO}/issues/${pr.number}/comments?per_page=100`),
        request(`/repos/${OWNER}/${REPO}/pulls/${pr.number}/comments?per_page=100`),
        request(`/repos/${OWNER}/${REPO}/pulls/${pr.number}/reviews?per_page=100`),
        fetchLinkedIssueNumber(pr.number),
      ]);

      const latestCommitRaw = commits.at(-1) ?? null;
      const latestCommit = latestCommitRaw
        ? {
            sha: latestCommitRaw.sha,
            message: latestCommitRaw.commit?.message ?? '',
            authoredAt: latestCommitRaw.commit?.author?.date ?? pr.updated_at,
            authorLogin: latestCommitRaw.author?.login ?? latestCommitRaw.commit?.author?.name ?? 'unknown',
            authorAvatarUrl: latestCommitRaw.author?.avatar_url ?? pr.user.avatar_url,
            url: latestCommitRaw.html_url,
          }
        : null;

      const mergedComments = [...issueComments, ...reviewComments]
        .filter((comment) => !isBotActor(comment?.user))
        .sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
      const latestCommentRaw = mergedComments[0] ?? null;
      const latestComment = latestCommentRaw
        ? {
            body: latestCommentRaw.body ?? '',
            createdAt: latestCommentRaw.created_at,
            updatedAt: latestCommentRaw.updated_at,
            authorLogin: latestCommentRaw.user?.login ?? 'unknown',
            authorAvatarUrl: latestCommentRaw.user?.avatar_url ?? pr.user.avatar_url,
            url: latestCommentRaw.html_url,
          }
        : null;

      const sha = latestCommit?.sha ?? pr.head.sha;
      const { buildNumber } = parseBuildNumberFromComments(issueComments);
      const ciStates = await fetchCiStatesByWorkflowScope(sha);
      const reviewSummary = await getReviewApprovalSummary(reviews);

      return {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        updatedAt: pr.updated_at,
        branchName: pr.head?.ref ?? 'unknown',
        author: {
          login: pr.user.login,
          avatarUrl: pr.user.avatar_url,
          url: pr.user.html_url,
        },
        latestCommit,
        latestComment,
        linkedIssue,
        buildNumber,
        ciStates,
        reviewStatus: inferReviewStatus({ draft: Boolean(pr.draft), ciStates, ...reviewSummary }),
        approvedCount: reviewSummary.approvedCount,
      } as PullRequestCard;
    }),
  );

  return cards.sort((a, b) => {
    const aDraftRank = a.reviewStatus === 'draft' ? 1 : 0;
    const bDraftRank = b.reviewStatus === 'draft' ? 1 : 0;
    if (aDraftRank !== bDraftRank) {
      return aDraftRank - bDraftRank;
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function fetchRecentlyMergedPrCards(): Promise<PullRequestCard[]> {
  const pulls = await request(
    `/repos/${OWNER}/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=${MAX_MERGED_PRS * 3}`,
  );

  const mergedPulls = pulls
    .filter((pr: any) => Boolean(pr.merged_at))
    .sort((a: any, b: any) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime())
    .slice(0, MAX_MERGED_PRS);

  return mergedPulls.map((pr: any) => ({
    id: pr.id,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    updatedAt: pr.merged_at ?? pr.updated_at,
    mergedAt: pr.merged_at,
    branchName: pr.head?.ref ?? 'unknown',
    author: {
      login: pr.user?.login ?? 'unknown',
      avatarUrl: pr.user?.avatar_url ?? '',
      url: pr.user?.html_url ?? pr.html_url,
    },
    latestCommit: null,
    latestComment: null,
    linkedIssue: null,
    buildNumber: null,
    ciStates: [],
    reviewStatus: null,
    approvedCount: 0,
  })) as PullRequestCard[];
}
