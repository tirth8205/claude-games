#!/usr/bin/env node

// CLI entry point
// Usage:
//   claude-games          Launch the games
//   claude-games setup    Print hook configuration for Claude Code

import { launchGames } from './index.js';
import { getHookCommands, STATUS_FILE } from './status-bridge.js';
import { enableDemoMode } from './utils.js';

const args = process.argv.slice(2);
const command = args[0];

// --demo flag: seed randomness for deterministic GIF recording
if (args.includes('--demo')) {
  enableDemoMode();
}

if (command === 'setup') {
  // Print the hook configuration users need to add to Claude Code
  const hooks = getHookCommands();

  console.log(`
\x1b[38;2;218;119;86m┌─────────────────────────────────────────────────────────┐
│  claude-games — hook setup                              │
└─────────────────────────────────────────────────────────┘\x1b[0m

To get \x1b[1mreal-time agent status\x1b[0m in the game (see when Claude is
done or needs your input), add these hooks to your Claude Code
settings.

\x1b[2mStatus file: ${STATUS_FILE}\x1b[0m

\x1b[1mOption 1: Add to your project\x1b[0m
Create or edit \x1b[33m.claude/settings.json\x1b[0m in your project root:

\x1b[36m{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "command": ${JSON.stringify(hooks.PostToolUse)}
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "command": ${JSON.stringify(hooks.Stop)}
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "command": ${JSON.stringify(hooks.Notification)}
      }
    ]
  }
}\x1b[0m

\x1b[1mOption 2: Add globally\x1b[0m
Edit \x1b[33m~/.claude/settings.json\x1b[0m to apply across all projects.
Same JSON as above.

\x1b[2m─────────────────────────────────────────────────────────\x1b[0m
\x1b[2mWithout hooks, everything still works — the status bar
just shows a generic "working" message instead of live updates.\x1b[0m
`);
} else {
  launchGames();
}
