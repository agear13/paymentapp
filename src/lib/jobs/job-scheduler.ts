/**
 * Job Scheduler
 * Manages background job execution with logging and error handling
 */

import { loggers } from '@/lib/logger';

export interface JobConfig {
  name: string;
  description: string;
  schedule?: string; // Cron expression (for documentation)
  enabled: boolean;
}

export interface JobResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
  duration: number;
}

export interface JobExecution {
  jobName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  result: JobResult;
  error?: string;
}

/**
 * Job execution history (in-memory, consider moving to database for persistence)
 */
const jobExecutionHistory: Map<string, JobExecution[]> = new Map();
const MAX_HISTORY_PER_JOB = 100;

/**
 * Execute a job with logging and error handling
 */
export async function executeJob(
  config: JobConfig,
  jobFunction: () => Promise<JobResult>
): Promise<JobExecution> {
  const startTime = new Date();

  loggers.jobs.info(
    {
      jobName: config.name,
      description: config.description,
      enabled: config.enabled,
    },
    'Starting job execution'
  );

  let result: JobResult;
  let error: string | undefined;
  let success = false;

  try {
    if (!config.enabled) {
      result = {
        success: false,
        message: 'Job is disabled',
        duration: 0,
      };
    } else {
      result = await jobFunction();
      success = result.success;
    }
  } catch (err: any) {
    error = err.message;
    result = {
      success: false,
      error: err.message,
      duration: Date.now() - startTime.getTime(),
    };

    loggers.jobs.error(
      {
        jobName: config.name,
        error: err.message,
        stack: err.stack,
      },
      'Job execution failed with exception'
    );
  }

  const endTime = new Date();
  const duration = endTime.getTime() - startTime.getTime();

  const execution: JobExecution = {
    jobName: config.name,
    startTime,
    endTime,
    duration,
    success,
    result,
    error,
  };

  // Store execution history
  const history = jobExecutionHistory.get(config.name) || [];
  history.unshift(execution);
  if (history.length > MAX_HISTORY_PER_JOB) {
    history.pop();
  }
  jobExecutionHistory.set(config.name, history);

  loggers.jobs.info(
    {
      jobName: config.name,
      success,
      duration: `${duration}ms`,
      result: result.message || result.data,
    },
    'Job execution completed'
  );

  return execution;
}

/**
 * Get job execution history
 */
export function getJobHistory(jobName: string, limit = 10): JobExecution[] {
  const history = jobExecutionHistory.get(jobName) || [];
  return history.slice(0, limit);
}

/**
 * Get all job execution history
 */
export function getAllJobHistory(): Map<string, JobExecution[]> {
  return new Map(jobExecutionHistory);
}

/**
 * Clear job history
 */
export function clearJobHistory(jobName?: string): void {
  if (jobName) {
    jobExecutionHistory.delete(jobName);
    loggers.jobs.info({ jobName }, 'Job history cleared');
  } else {
    jobExecutionHistory.clear();
    loggers.jobs.info('All job history cleared');
  }
}

/**
 * Get job statistics
 */
export function getJobStats(jobName: string): {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastExecution: JobExecution | null;
  successRate: number;
} {
  const history = jobExecutionHistory.get(jobName) || [];

  if (history.length === 0) {
    return {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      lastExecution: null,
      successRate: 0,
    };
  }

  const successCount = history.filter((h) => h.success).length;
  const failureCount = history.length - successCount;
  const totalDuration = history.reduce((sum, h) => sum + h.duration, 0);
  const averageDuration = Math.round(totalDuration / history.length);
  const successRate = (successCount / history.length) * 100;

  return {
    totalExecutions: history.length,
    successCount,
    failureCount,
    averageDuration,
    lastExecution: history[0] || null,
    successRate: Math.round(successRate * 100) / 100,
  };
}






