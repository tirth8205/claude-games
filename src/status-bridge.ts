// Status Bridge — real-time connection between Claude Code and the game
//
// How it works:
// 1. Claude Code hooks write JSON status to a temp file on key events
// 2. The game polls this file every second
// 3. The status bar updates to reflect actual agent state
//
// Without hooks configured, everything still works — the status bar
// just shows a generic "working" state instead of real-time updates.

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Shared file path — hooks write here, game reads from here
export const STATUS_FILE = join(tmpdir(), 'claude-games-status.json');

export type AgentStatus = 'working' | 'done' | 'waiting_for_input' | 'error' | 'unknown';

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
 * Read the current agent state from the status file.
 * Returns a default "working" state if the file doesn't exist
 * or hooks aren't configured — the game works either way.
 */
export async function readAgentState(): Promise<AgentState> {
  try {
    if (!existsSync(STATUS_FILE)) {
      return DEFAULT_STATE;
    }
    const raw = await readFile(STATUS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AgentState;

    // If the status is older than the threshold, it might be stale
    // (Claude could have finished and the hook didn't fire)
    const age = Date.now() - parsed.timestamp;
    if (age > STALE_THRESHOLD_MS && parsed.status === 'working') {
      return { ...parsed, message: parsed.message ?? 'claude is working...' };
    }

    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
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
 */
export async function cleanupStatusFile(): Promise<void> {
  try {
    const { unlink } = await import('fs/promises');
    if (existsSync(STATUS_FILE)) {
      await unlink(STATUS_FILE);
    }
  } catch {
    // Best effort
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

export function getHookCommands(): {
  PostToolUse: string;
  Stop: string;
  Notification: string;
} {
  const f = STATUS_FILE;
  return {
    // After each tool use — agent is actively working
    PostToolUse:
      `echo '{"status":"working","message":"claude is working...","timestamp":'$(date +%s000)'}' > "${f}"`,
    // When the agent stops — it's either done or waiting
    Stop:
      `echo '{"status":"done","message":"claude is done! switch back to review","timestamp":'$(date +%s000)'}' > "${f}"`,
    // On notification (e.g. permission prompts) — needs input
    Notification:
      `echo '{"status":"waiting_for_input","message":"claude needs your input!","timestamp":'$(date +%s000)'}' > "${f}"`,
  };
}
