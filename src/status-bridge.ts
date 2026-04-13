// Status Bridge — real-time connection between Claude Code and the game
//
// How it works:
// 1. Claude Code hooks write JSON status to a temp file on key events
// 2. The game polls this file every second
// 3. The status bar updates to reflect actual agent state
//
// Without hooks configured, everything still works — the status bar
// just shows a generic "working" state instead of real-time updates.

import { readFile, writeFile, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

// Regex to strip ANSI escape sequences (prevents terminal injection via
// crafted status messages). Covers CSI sequences like \x1b[31m, etc.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

// Shared file path — hooks write here, game reads from here.
//
// NOTE (multi-instance limitation): This is a fixed, well-known path so that
// hook shell commands can write to it without needing to discover a dynamic
// name. If multiple game instances run concurrently they will read/write the
// same file, which may cause status cross-talk. In practice only one game
// instance runs at a time, so this is acceptable.
export const STATUS_FILE = join(tmpdir(), 'claude-games-status.json');

// Unique session identifier generated once at import time. Can be used by
// callers that need to disambiguate concurrent sessions.
export const SESSION_ID: string = randomBytes(8).toString('hex');

/**
 * Return the glob-style base pattern for the status file path.
 * Useful for hook configuration or tooling that needs to locate status files.
 */
export function getStatusFilePattern(): string {
  return join(tmpdir(), 'claude-games-status*.json');
}

export type AgentStatus = 'working' | 'done' | 'waiting_for_input' | 'error' | 'unknown';

const VALID_STATUSES: ReadonlySet<string> = new Set<AgentStatus>([
  'working',
  'done',
  'waiting_for_input',
  'error',
  'unknown',
]);

export interface AgentState {
  status: AgentStatus;
  message?: string;     // e.g. "Running tests..." or "Needs approval for Bash"
  tool?: string;        // Last tool used, e.g. "Edit", "Bash"
  timestamp: number;    // Unix ms — lets us detect stale state
}

const DEFAULT_STATE: AgentState = {
  status: 'working',
  message: 'claude is working on your task...',
  timestamp: Date.now(),
};

// How old a status can be before we consider it stale (30 seconds)
const STALE_THRESHOLD_MS = 30_000;

/**
 * Runtime validation of parsed JSON against the AgentState shape.
 * Returns true only when all required fields have the correct types and
 * `status` is one of the known AgentStatus values.
 */
function isValidAgentState(value: unknown): value is AgentState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!VALID_STATUSES.has(obj.status as string)) return false;
  if (obj.message !== undefined && typeof obj.message !== 'string') return false;
  if (obj.tool !== undefined && typeof obj.tool !== 'string') return false;
  if (typeof obj.timestamp !== 'number') return false;
  return true;
}

/**
 * Read the current agent state from the status file.
 * Returns a default "working" state if the file doesn't exist
 * or hooks aren't configured — the game works either way.
 *
 * M-1: Reads directly without a preceding existsSync() to avoid a
 * TOCTOU race; ENOENT is caught in the error handler.
 */
export async function readAgentState(): Promise<AgentState> {
  try {
    const raw = await readFile(STATUS_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    // M-3: Validate the parsed JSON has the expected shape
    if (!isValidAgentState(parsed)) {
      return DEFAULT_STATE;
    }

    // H-1: Sanitize message and tool fields to strip ANSI escape sequences
    if (parsed.message !== undefined) {
      parsed.message = stripAnsi(parsed.message);
    }
    if (parsed.tool !== undefined) {
      parsed.tool = stripAnsi(parsed.tool);
    }

    // E-2: Use Math.abs(age) so clock rollbacks also trigger staleness
    const age = Math.abs(Date.now() - parsed.timestamp);
    if (age > STALE_THRESHOLD_MS && parsed.status === 'working') {
      return { ...parsed, message: parsed.message ?? 'claude is working...' };
    }

    return parsed;
  } catch (err: unknown) {
    // M-1: If the file simply doesn't exist, return the default state.
    // Any other I/O or parse error also falls through to the default.
    if (isNodeError(err) && err.code === 'ENOENT') {
      return DEFAULT_STATE;
    }
    return DEFAULT_STATE;
  }
}

/** Type guard for Node.js system errors that carry a `code` property. */
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

/**
 * Write agent state — called by the hook scripts.
 * This is a utility for generating the hook commands.
 */
export async function writeAgentState(state: AgentState): Promise<void> {
  await writeFile(STATUS_FILE, JSON.stringify(state), 'utf-8');
}

/**
 * Initialize the status file when the game starts.
 * Sets the initial state to "working" so the status bar has something to show.
 */
export async function initStatusFile(): Promise<void> {
  await writeAgentState({
    status: 'working',
    message: 'claude is working on your task...',
    timestamp: Date.now(),
  });
}

/**
 * Clean up the status file when the game exits.
 * Attempts unlink directly; silently ignores ENOENT (already gone).
 */
export async function cleanupStatusFile(): Promise<void> {
  try {
    await unlink(STATUS_FILE);
  } catch {
    // Best effort — file may already be gone (ENOENT) or locked.
  }
}

/**
 * Get the display text for the current status.
 */
export function getStatusDisplay(state: AgentState): {
  text: string;
  dotColor: 'green' | 'yellow' | 'blue' | 'red';
  urgent: boolean;
} {
  switch (state.status) {
    case 'working':
      return {
        text: state.message ?? 'claude is working...',
        dotColor: 'green',
        urgent: false,
      };
    case 'done':
      return {
        text: 'claude is done! switch back to review',
        dotColor: 'blue',
        urgent: true,
      };
    case 'waiting_for_input':
      return {
        text: state.message ?? 'claude needs your input!',
        dotColor: 'yellow',
        urgent: true,
      };
    case 'error':
      return {
        text: state.message ?? 'claude hit an error',
        dotColor: 'red',
        urgent: true,
      };
    default:
      return {
        text: 'claude is working...',
        dotColor: 'green',
        urgent: false,
      };
  }
}

// ─── Hook command generators ──────────────────────────────────────────
// These produce the exact shell commands to put in Claude Code hooks.
//
// E-7 / E-11: The STATUS_FILE path is interpolated inside double quotes
// ("${f}"), which correctly handles spaces and special characters in the
// path (e.g. macOS iCloud paths with spaces).
//
// NOTE: These commands are POSIX shell. On Windows they require a
// POSIX-compatible shell such as Git Bash or WSL.

export function getHookCommands(): {
  PostToolUse: string;
  Stop: string;
  Notification: string;
} {
  const f = STATUS_FILE;
  return {
    // E-6: Atomic writes — write to a .tmp file then mv to avoid partial reads
    // After each tool use — agent is actively working
    PostToolUse:
      `echo '{"status":"working","message":"claude is working...","timestamp":'$(date +%s000)'}' > "${f}.tmp" && mv "${f}.tmp" "${f}"`,
    // When the agent stops — it's either done or waiting
    Stop:
      `echo '{"status":"done","message":"claude is done! switch back to review","timestamp":'$(date +%s000)'}' > "${f}.tmp" && mv "${f}.tmp" "${f}"`,
    // On notification (e.g. permission prompts) — needs input
    Notification:
      `echo '{"status":"waiting_for_input","message":"claude needs your input!","timestamp":'$(date +%s000)'}' > "${f}.tmp" && mv "${f}.tmp" "${f}"`,
  };
}
