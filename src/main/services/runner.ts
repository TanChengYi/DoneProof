import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { redactAndLimit } from '../domain/redaction';

export interface CommandSpec {
  id: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
  redactionLiterals?: string[];
}

export interface CommandResult {
  status: 'passed' | 'failed' | 'unproven';
  exitCode: number | null;
  durationMs: number;
  output: string;
  truncated: boolean;
  reason?: string;
}

export interface RunnerHooks {
  onOutput?: (chunk: string, stream: 'stdout' | 'stderr') => void;
}

export interface SafeRunner {
  run(spec: CommandSpec, hooks?: RunnerHooks, signal?: AbortSignal): Promise<CommandResult>;
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams): void {
  if (!child.pid || child.killed) return;
  if (process.platform === 'win32') {
    execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => undefined);
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

export function createRunner(): SafeRunner {
  return {
    async run(spec, hooks = {}, signal) {
      const startedAt = performance.now();
      return await new Promise<CommandResult>((resolve) => {
        let child: ChildProcessWithoutNullStreams;
        let settled = false;
        let terminationReason: string | undefined;
        let output = '';
        let outputBytes = 0;
        let truncated = false;
        const pending: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };
        const tailSize = Math.max(1_024, ...(spec.redactionLiterals ?? []).map((item) => item.length + 128));

        const append = (value: string, stream: 'stdout' | 'stderr') => {
          if (!value) return;
          const remaining = Math.max(0, spec.maxOutputBytes - outputBytes);
          const result = redactAndLimit(value, { maxBytes: remaining, literals: spec.redactionLiterals ?? [] });
          if (result.output) {
            output += result.output;
            outputBytes += Buffer.byteLength(result.output);
            hooks.onOutput?.(result.output, stream);
          }
          if (result.truncated || Buffer.byteLength(value) > remaining) truncated = true;
        };

        const receive = (value: Buffer, stream: 'stdout' | 'stderr') => {
          pending[stream] += value.toString('utf8');
          if (pending[stream].length > tailSize) {
            const boundary = pending[stream].length - tailSize;
            append(pending[stream].slice(0, boundary), stream);
            pending[stream] = pending[stream].slice(boundary);
          }
        };

        const flush = () => {
          append(pending.stdout, 'stdout');
          append(pending.stderr, 'stderr');
          pending.stdout = '';
          pending.stderr = '';
        };

        const finish = (result: Omit<CommandResult, 'durationMs' | 'output' | 'truncated'>) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          signal?.removeEventListener('abort', onAbort);
          flush();
          resolve({ ...result, durationMs: Math.round(performance.now() - startedAt), output, truncated });
        };

        const stop = (reason: string) => {
          terminationReason = reason;
          terminateProcessTree(child);
        };

        const onAbort = () => stop('Cancelled by user');
        const timeout = setTimeout(() => stop(`Timed out after ${spec.timeoutMs} ms`), spec.timeoutMs);

        try {
          child = spawn(spec.executable, spec.args, {
            cwd: spec.cwd,
            shell: false,
            windowsHide: true,
            detached: process.platform !== 'win32'
          });
        } catch (error) {
          finish({ status: 'failed', exitCode: null, reason: `Unable to start: ${(error as Error).message}` });
          return;
        }

        child.stdout.on('data', (chunk: Buffer) => receive(chunk, 'stdout'));
        child.stderr.on('data', (chunk: Buffer) => receive(chunk, 'stderr'));
        child.once('error', (error) => finish({ status: 'failed', exitCode: null, reason: `Unable to start: ${error.message}` }));
        child.once('close', (exitCode) => {
          if (terminationReason) finish({ status: 'unproven', exitCode: null, reason: terminationReason });
          else if (exitCode === 0) finish({ status: 'passed', exitCode: 0 });
          else finish({ status: 'failed', exitCode, reason: `Exited with code ${exitCode ?? 'unknown'}` });
        });

        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      });
    }
  };
}
