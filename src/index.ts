// claude-games — library entry point
// Exports launchRecess() for programmatic use.
// For CLI usage, see cli.ts.

import React from 'react';
import { enterAlternateScreen, exitAlternateScreen, registerCleanup } from './renderer.js';
import { Menu } from './menu.js';
import { startRecessTimer } from './utils.js';
import { initStatusFile, cleanupStatusFile } from './status-bridge.js';

// Register cleanup handlers to restore terminal state on unexpected exit
registerCleanup();

/**
 * Launch the game selection menu in an alternate screen buffer.
 * Initializes the status bridge file so hooks can write to it.
 */
export async function launchRecess(): Promise<void> {
  startRecessTimer();
  await initStatusFile();

  const handleExit = async () => {
    await cleanupStatusFile();
    exitAlternateScreen(true);
  };

  // handleExit is async but onExit expects sync — wrap it
  const onExit = () => { handleExit(); };

  const app = React.createElement(Menu, { onExit });
  enterAlternateScreen(app);
}

export default launchRecess;
