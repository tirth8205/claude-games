// Alternate screen buffer management + return summary
// Uses ANSI escape sequences to enter/exit the terminal's alternate screen
// (the same mechanism used by vim, less, htop, etc.)
// This preserves the main Claude Code output — when the game exits,
// the user's scrollback is exactly where they left it.

import * as React from 'react';
import { render, type Instance } from 'ink';
import { getRecessSummary } from './utils.js';

// ANSI escape sequences for alternate screen buffer
const ENTER_ALT_SCREEN = '\x1b[?1049h';
const EXIT_ALT_SCREEN = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_SCREEN = '\x1b[2J\x1b[H';

let inkInstance: Instance | null = null;
let isAltScreen = false;

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

  // Render the Ink component into the alternate screen
  inkInstance = render(component, {
    exitOnCtrlC: false, // We handle exit ourselves
  });

  return inkInstance;
}

/**
 * Exit the alternate screen buffer and restore the main terminal.
 * If showSummary is true, flash the recess summary before restoring.
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
    const summary = getRecessSummary();
    // Terracotta ANSI color (closest 256-color: 173)
    const terracotta = '\x1b[38;2;218;119;86m';
    const reset = '\x1b[0m';
    process.stdout.write(`\n${terracotta}☕ ${summary}${reset}\n\n`);
  }
}

/**
 * Ensure cleanup happens even on unexpected exit.
 * This prevents leaving the terminal in alternate screen mode
 * if the process crashes or is killed.
 */
export function registerCleanup(): void {
  const cleanup = () => {
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
  process.on('uncaughtException', (err) => {
    cleanup();
    console.error('claude-games: unexpected error', err);
    process.exit(1);
  });
}

export function isInAlternateScreen(): boolean {
  return isAltScreen;
}
