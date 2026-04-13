// claude-games — library entry point
// Exports launchGames() for programmatic use.
// For CLI usage, see cli.ts.

import React from 'react';
import { enterAlternateScreen, exitAlternateScreen, registerCleanup } from './renderer.js';
import { Menu } from './menu.js';
import { startGameTimer } from './utils.js';
import { initStatusFile, cleanupStatusFile } from './status-bridge.js';

// Register cleanup handlers to restore terminal state on unexpected exit
registerCleanup();

/**
 * Launch the game selection menu in an alternate screen buffer.
 * Initializes the status bridge file so hooks can write to it.
 */
export async function launchGames(): Promise<void> {
  if (!process.stdout.isTTY) {
    console.error('claude-games requires an interactive terminal. Cannot run in a pipe or redirected output.');
    process.exit(1);
  }

  startGameTimer();
  await initStatusFile();

  const handleExit = async () => {
    await cleanupStatusFile();
    exitAlternateScreen(true);
  };

  // handleExit is async but onExit expects sync — wrap it
  const onExit = () => { handleExit().catch(() => {}); };

  const app = React.createElement(Menu, { onExit });
  enterAlternateScreen(app);
}

export default launchGames;
