// Alternate screen buffer management + return summary
// Uses ANSI escape sequences to enter/exit the terminal's alternate screen
// (the same mechanism used by vim, less, htop, etc.)
// This preserves the main Claude Code output — when the game exits,
// the user's scrollback is exactly where they left it.

import * as React from 'react';
import { render, type Instance } from 'ink';
import { getGameSummary } from './utils.js';

// ANSI escape sequences for alternate screen buffer
const ENTER_ALT_SCREEN = '\x1b[?1049h';
const EXIT_ALT_SCREEN = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_SCREEN = '\x1b[2J\x1b[H';

let inkInstance: Instance | null = null;
let isAltScreen = false;

// Guard to make cleanup truly idempotent across overlapping signal/exit paths.
// Without this, uncaughtException -> cleanup -> process.exit(1) -> 'exit' event
// -> cleanup again could cause double writes. The isAltScreen check already
// short-circuits most of the work, but this flag makes the contract explicit.
let cleanupDone = false;

/**
 * Enter the alternate screen buffer and render an Ink component.
 * The main terminal output is preserved underneath.
 */
export function enterAlternateScreen(component: React.ReactElement): Instance {
  if (isAltScreen) {
    exitAlternateScreen(false);
  }

  // Enter alternate screen buffer
  process.stdout.write(ENTER_ALT_SCREEN);
  process.stdout.write(HIDE_CURSOR);
  process.stdout.write(CLEAR_SCREEN);
  isAltScreen = true;
  cleanupDone = false;

  // Render the Ink component into the alternate screen
  inkInstance = render(component, {
    exitOnCtrlC: false, // We handle exit ourselves
  });

  return inkInstance;
}

/**
 * Exit the alternate screen buffer and restore the main terminal.
 * If showSummary is true, flash the game summary before restoring.
 */
export function exitAlternateScreen(showSummary: boolean = true): void {
  if (inkInstance) {
    inkInstance.unmount();
    inkInstance = null;
  }

  if (isAltScreen) {
    process.stdout.write(SHOW_CURSOR);
    process.stdout.write(EXIT_ALT_SCREEN);
    isAltScreen = false;
  }

  // Flash return summary — the fun receipt moment
  if (showSummary) {
    const summary = getGameSummary();
    // Terracotta ANSI color (closest 256-color: 173)
    const terracotta = '\x1b[38;2;218;119;86m';
    const reset = '\x1b[0m';
    process.stdout.write(`\n${terracotta}☕ ${summary}${reset}\n\n`);
  }
}

/**
 * SIGTSTP handler for Ctrl+Z suspend.
 * Leaves alt screen to show the shell prompt but keeps Ink mounted
 * so game state is preserved. Removes itself before re-sending
 * SIGTSTP to avoid infinite recursion; SIGCONT re-registers it.
 */
function handleSigtstp(): void {
  if (isAltScreen) {
    process.stdout.write(SHOW_CURSOR);
    process.stdout.write(EXIT_ALT_SCREEN);
    // Note: we do NOT set isAltScreen = false here — the game is only
    // suspended, not exited. We need to remember we were in alt screen
    // so SIGCONT can restore it.
  }
  // Remove this listener temporarily to let the default SIGTSTP behavior
  // actually suspend the process, then re-emit the signal.
  process.removeListener('SIGTSTP', handleSigtstp);
  process.kill(process.pid, 'SIGTSTP');
}

/**
 * Ensure cleanup happens even on unexpected exit.
 * This prevents leaving the terminal in alternate screen mode
 * if the process crashes or is killed.
 */
export function registerCleanup(): void {
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;

    if (isAltScreen) {
      if (inkInstance) {
        inkInstance.unmount();
        inkInstance = null;
      }
      process.stdout.write(SHOW_CURSOR);
      process.stdout.write(EXIT_ALT_SCREEN);
      isAltScreen = false;
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup); // L-5: handle terminal hangup

  // L-8: uncaughtException calls cleanup then exits. The cleanupDone guard
  // prevents the 'exit' handler from running cleanup a second time.
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error('claude-games: unexpected error', err);
    process.exit(1);
  });

  // E-4: SIGTSTP (Ctrl+Z) — leave alt screen to let the shell show its prompt,
  // but keep Ink mounted so game state is preserved.
  process.on('SIGTSTP', handleSigtstp);

  // E-4: SIGCONT (resume after Ctrl+Z) — re-enter alt screen and force a
  // full redraw so the game UI reappears cleanly.
  process.on('SIGCONT', () => {
    if (isAltScreen) {
      process.stdout.write(ENTER_ALT_SCREEN);
      process.stdout.write(HIDE_CURSOR);
      process.stdout.write(CLEAR_SCREEN);
    }
    // Re-register the SIGTSTP handler (it was removed before suspending).
    if (process.listenerCount('SIGTSTP') === 0) {
      process.on('SIGTSTP', handleSigtstp);
    }
  });

  // E-14: SIGUSR1 — Node.js default behavior dumps diagnostic info to stdout
  // which corrupts the alternate screen buffer. Swallow it silently.
  process.on('SIGUSR1', () => {
    // No-op: prevents Node.js default SIGUSR1 behavior from writing to stdout.
  });
}

export function isInAlternateScreen(): boolean {
  return isAltScreen;
}
