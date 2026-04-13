---
name: games
description: Terminal arcade games to play while waiting for Claude to complete tasks
---

When the user wants to play games or kill time while waiting, launch the claude-games game menu. This opens an alternate terminal screen with two games:

1. **Claude Runner** — The Claude sparkle mascot dodges code errors and syntax blocks in a side-scrolling runner
2. **Snake** — GitHub contribution graph edition where food cells are mini Claude logos in terracotta

The games run entirely in the terminal using Ink/React components. They do NOT consume tokens, make API calls, or interfere with Claude's background work.

Controls:
- Menu: Arrow keys or 1/2 to select, Enter to launch, Q/Esc to exit
- Claude Runner: Space/Up to jump, Down to duck, Q/Esc to quit
- Snake: Arrow keys or WASD to move, Q/Esc to quit
