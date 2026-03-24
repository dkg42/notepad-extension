import type { BulkImportJob, BulkImportProgress } from '@/types';
import { addSourceUrl } from '@/services/notebooklm-api';

const DELAY_MS = 500;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/** In-memory store for active import jobs. Lives in the background service worker. */
const jobs = new Map<string, BulkImportJob>();

/** Track cancellation signals. */
const cancelSignals = new Map<string, boolean>();

function createProgress(total: number): BulkImportProgress {
  return { total, completed: 0, failed: 0, errors: [], currentUrl: null };
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addUrlWithRetry(
  notebookId: string,
  url: string,
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await addSourceUrl(notebookId, url);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes('429') || msg.includes('rate');
      if (!isRateLimit || attempt === MAX_RETRIES) throw err;
      await delay(BASE_BACKOFF_MS * Math.pow(2, attempt));
    }
  }
}

/**
 * Processes a bulk import job sequentially with throttling.
 * Runs asynchronously in the background — callers should not await this.
 */
async function processJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'running';

  for (let i = 0; i < job.urls.length; i++) {
    if (cancelSignals.get(jobId)) {
      job.status = 'cancelled';
      cancelSignals.delete(jobId);
      return;
    }

    const url = job.urls[i];
    job.progress.currentUrl = url;

    try {
      await addUrlWithRetry(job.notebookId, url);
      job.progress.completed++;
    } catch (err: unknown) {
      job.progress.failed++;
      job.progress.errors.push({
        url,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Throttle between calls to avoid rate limits
    if (i < job.urls.length - 1) {
      await delay(DELAY_MS);
    }
  }

  job.progress.currentUrl = null;
  job.status = 'completed';
}

export const importJobService = {
  /** Creates a new bulk import job and starts processing it. Returns the job ID. */
  createAndStart(notebookId: string, urls: string[]): string {
    const id = crypto.randomUUID();
    const job: BulkImportJob = {
      id,
      notebookId,
      urls,
      status: 'pending',
      progress: createProgress(urls.length),
      createdAt: Date.now(),
    };
    jobs.set(id, job);
    // Fire and forget — callers poll for progress
    void processJob(id);
    return id;
  },

  /** Returns current progress for a job, or null if the job doesn't exist. */
  getProgress(jobId: string): (BulkImportProgress & { status: BulkImportJob['status'] }) | null {
    const job = jobs.get(jobId);
    if (!job) return null;
    return { ...job.progress, status: job.status };
  },

  /** Signals a running job to cancel after the current URL finishes. */
  cancel(jobId: string): boolean {
    const job = jobs.get(jobId);
    if (!job || job.status !== 'running') return false;
    cancelSignals.set(jobId, true);
    return true;
  },

  /** Removes a completed/cancelled job from memory. */
  cleanup(jobId: string): void {
    jobs.delete(jobId);
    cancelSignals.delete(jobId);
  },
};
