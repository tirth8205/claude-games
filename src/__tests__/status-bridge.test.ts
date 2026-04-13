import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import {
  STATUS_FILE,
  readAgentState,
  writeAgentState,
  initStatusFile,
  cleanupStatusFile,
  getStatusDisplay,
  getHookCommands,
  type AgentState,
} from '../status-bridge.js';

// Clean up status file between tests
beforeEach(async () => {
  try { await unlink(STATUS_FILE); } catch {}
});

afterEach(async () => {
  try { await unlink(STATUS_FILE); } catch {}
});

describe('readAgentState', () => {
  it('returns default state when file does not exist', async () => {
    const state = await readAgentState();
    expect(state.status).toBe('working');
    expect(state.message).toContain('working');
  });

  it('reads valid state from file', async () => {
    const testState: AgentState = {
      status: 'done',
      message: 'all done',
      timestamp: Date.now(),
    };
    await writeFile(STATUS_FILE, JSON.stringify(testState), 'utf-8');

    const state = await readAgentState();
    expect(state.status).toBe('done');
    expect(state.message).toBe('all done');
  });

  it('returns default state for invalid JSON', async () => {
    await writeFile(STATUS_FILE, 'not json at all', 'utf-8');
    const state = await readAgentState();
    expect(state.status).toBe('working');
  });

  it('returns default state for JSON with wrong shape (M-3)', async () => {
    await writeFile(STATUS_FILE, JSON.stringify({ status: 42, timestamp: 'not a number' }), 'utf-8');
    const state = await readAgentState();
    expect(state.status).toBe('working');
  });

  it('returns default state for JSON with invalid status value (M-3)', async () => {
    await writeFile(STATUS_FILE, JSON.stringify({ status: 'hacked', message: 'pwned', timestamp: Date.now() }), 'utf-8');
    const state = await readAgentState();
    expect(state.status).toBe('working');
  });

  it('strips ANSI escape sequences from message (H-1)', async () => {
    const malicious: AgentState = {
      status: 'working',
      message: '\x1b[31mred text\x1b[0m normal',
      timestamp: Date.now(),
    };
    await writeFile(STATUS_FILE, JSON.stringify(malicious), 'utf-8');

    const state = await readAgentState();
    expect(state.message).toBe('red text normal');
    expect(state.message).not.toContain('\x1b');
  });

  it('strips ANSI from tool field (H-1)', async () => {
    const malicious: AgentState = {
      status: 'working',
      message: 'ok',
      tool: '\x1b[1mBash\x1b[0m',
      timestamp: Date.now(),
    };
    await writeFile(STATUS_FILE, JSON.stringify(malicious), 'utf-8');

    const state = await readAgentState();
    expect(state.tool).toBe('Bash');
  });

  it('handles stale working status gracefully', async () => {
    const stale: AgentState = {
      status: 'working',
      message: 'old message',
      timestamp: Date.now() - 60_000, // 60 seconds ago
    };
    await writeFile(STATUS_FILE, JSON.stringify(stale), 'utf-8');

    const state = await readAgentState();
    expect(state.status).toBe('working');
    expect(state.message).toBe('old message');
  });

  it('handles clock rollback (E-2)', async () => {
    const future: AgentState = {
      status: 'working',
      message: 'future message',
      timestamp: Date.now() + 60_000, // 60 seconds in the future (clock rolled back)
    };
    await writeFile(STATUS_FILE, JSON.stringify(future), 'utf-8');

    // Should still return the state (Math.abs handles negative age)
    const state = await readAgentState();
    expect(state.status).toBe('working');
    expect(state.message).toBe('future message');
  });
});

describe('writeAgentState', () => {
  it('writes state to the status file', async () => {
    const state: AgentState = {
      status: 'done',
      message: 'finished',
      timestamp: 12345,
    };
    await writeAgentState(state);

    const raw = await readFile(STATUS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('done');
    expect(parsed.message).toBe('finished');
    expect(parsed.timestamp).toBe(12345);
  });
});

describe('initStatusFile', () => {
  it('creates the status file with working state', async () => {
    await initStatusFile();
    expect(existsSync(STATUS_FILE)).toBe(true);

    const state = await readAgentState();
    expect(state.status).toBe('working');
  });
});

describe('cleanupStatusFile', () => {
  it('removes the status file', async () => {
    await initStatusFile();
    expect(existsSync(STATUS_FILE)).toBe(true);

    await cleanupStatusFile();
    expect(existsSync(STATUS_FILE)).toBe(false);
  });

  it('does not throw when file already gone', async () => {
    // Should not throw even if file doesn't exist
    await expect(cleanupStatusFile()).resolves.toBeUndefined();
  });
});

describe('getStatusDisplay', () => {
  it('shows green dot for working status', () => {
    const display = getStatusDisplay({ status: 'working', message: 'running tests', timestamp: Date.now() });
    expect(display.dotColor).toBe('green');
    expect(display.urgent).toBe(false);
    expect(display.text).toBe('running tests');
  });

  it('shows blue dot for done status', () => {
    const display = getStatusDisplay({ status: 'done', timestamp: Date.now() });
    expect(display.dotColor).toBe('blue');
    expect(display.urgent).toBe(true);
    expect(display.text).toContain('done');
  });

  it('shows yellow dot for waiting_for_input status', () => {
    const display = getStatusDisplay({ status: 'waiting_for_input', timestamp: Date.now() });
    expect(display.dotColor).toBe('yellow');
    expect(display.urgent).toBe(true);
  });

  it('shows red dot for error status', () => {
    const display = getStatusDisplay({ status: 'error', message: 'something broke', timestamp: Date.now() });
    expect(display.dotColor).toBe('red');
    expect(display.urgent).toBe(true);
    expect(display.text).toBe('something broke');
  });

  it('handles unknown status with default', () => {
    const display = getStatusDisplay({ status: 'unknown' as any, timestamp: Date.now() });
    expect(display.dotColor).toBe('green');
    expect(display.urgent).toBe(false);
  });
});

describe('getHookCommands', () => {
  it('returns commands for all three hook types', () => {
    const hooks = getHookCommands();
    expect(hooks.PostToolUse).toBeTruthy();
    expect(hooks.Stop).toBeTruthy();
    expect(hooks.Notification).toBeTruthy();
  });

  it('hook commands use atomic writes (E-6)', () => {
    const hooks = getHookCommands();
    // All commands should write to .tmp first then mv
    expect(hooks.PostToolUse).toContain('.tmp');
    expect(hooks.PostToolUse).toContain('mv');
    expect(hooks.Stop).toContain('.tmp');
    expect(hooks.Stop).toContain('mv');
    expect(hooks.Notification).toContain('.tmp');
    expect(hooks.Notification).toContain('mv');
  });

  it('hook commands include valid JSON status values', () => {
    const hooks = getHookCommands();
    expect(hooks.PostToolUse).toContain('"status":"working"');
    expect(hooks.Stop).toContain('"status":"done"');
    expect(hooks.Notification).toContain('"status":"waiting_for_input"');
  });
});
