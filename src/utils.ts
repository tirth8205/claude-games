// Shared utilities: colors, scoring, achievements, game timer

// Claude brand colors
export const COLORS = {
  // Primary brand — terracotta
  terracotta: '#da7756',
  terracottaLight: '#e8956a',
  terracottaDark: '#c15f3c',
  cream: '#f4f3ee',

  // Terminal dark theme
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  textPrimary: '#e6edf3',
  textSecondary: '#7d8590',
  textMuted: '#484f58',
  errorRed: '#f85149',
  successGreen: '#3fb950',
  successGreenDim: '#0e4429',

  // GitHub contribution greens
  green4: '#39d353', // brightest (head)
  green3: '#26a641',
  green2: '#006d32',
  green1: '#0e4429', // dimmest (tail)
} as const;

// GitHub green gradient for snake body — head to tail
export const SNAKE_GREENS = [
  COLORS.green4,
  COLORS.green3,
  COLORS.green2,
  COLORS.green1,
] as const;

// Claude logo block art — the sparkle/starburst every user sees on startup
// Each line padded to equal width (10 chars) so they align properly
export const CLAUDE_LOGO = [
  ' ▐▛███▜▌  ',
  '▝▜█████▛▘',
  '  ▘▘ ▝▝  ',
];

// Running animation frames
export const RUNNER_FRAMES = [
  // Frame 1: normal
  [
    ' ▐▛███▜▌',
    '▝▜█████▛▘',
    '  ▘▘ ▝▝',
  ],
  // Frame 2: slight shift
  [
    '  ▐▛███▜▌',
    '▝▜█████▛▘',
    ' ▘▘ ▝▝',
  ],
];

// Ducking pose — compressed to 2 lines
export const RUNNER_DUCK = [
  '▐▛█████▜▌',
  ' ▘▘▘▘▝▝',
];

// Micro Claude logo for snake food (fits in 2-char cell)
export const FOOD_CHAR = '▜▛';

// ─── High Scores (session-scoped, in-memory only) ─────────────────────

const highScores: Record<string, number> = {};

export function getHighScore(game: string): number {
  return highScores[game] ?? 0;
}

export function updateHighScore(game: string, score: number): number {
  const current = highScores[game] ?? 0;
  if (score > current) {
    highScores[game] = score;
  }
  return highScores[game] ?? 0;
}

// Format score as padded number (00000)
export function formatScore(score: number, pad: number = 5): string {
  return String(score).padStart(pad, '0');
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Get terminal dimensions, with fallback
export function getTerminalSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

// ─── Game Timer ──────────────────────────────────────────────────────

let gameStartTime: number = 0;
let lastGamePlayed: string = '';
let lastGameScore: number = 0;

export function startGameTimer(): void {
  gameStartTime = Date.now();
}

export function getGameElapsed(): number {
  if (gameStartTime === 0) return 0;
  return Date.now() - gameStartTime;
}

export function formatGameTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export function setLastGame(game: string, score: number): void {
  lastGamePlayed = game;
  lastGameScore = score;
}

export function getLastGame(): { game: string; score: number } {
  return { game: lastGamePlayed, score: lastGameScore };
}

export function getGameSummary(): string {
  const elapsed = formatGameTime(getGameElapsed());
  const { game, score } = getLastGame();
  if (game) {
    return `game over — you played for ${elapsed} (${game}: ${score} pts)`;
  }
  return `game over — ${elapsed}`;
}

// ─── Session Achievements ─────────────────────────────────────────────
// In-memory only, reset when Claude Code exits. Fun easter-egg flavor.

export interface Achievement {
  id: string;
  name: string;
  description: string;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_bite', name: 'First bite', description: 'eat your first Claude logo in Snake' },
  { id: 'centurion', name: 'Centurion', description: 'score 100 in Claude Runner' },
  { id: 'snaked_it', name: 'Snaked it', description: 'reach snake length of 10' },
  { id: 'speed_demon', name: 'Speed demon', description: 'survive past 200 in Claude Runner' },
  { id: 'commit_streak', name: 'Commit streak', description: 'eat 5 Claude logos without turning in Snake' },
];

const unlockedAchievements = new Set<string>();
let pendingAchievement: Achievement | null = null;

export function unlockAchievement(id: string): Achievement | null {
  if (unlockedAchievements.has(id)) return null;
  const achievement = ACHIEVEMENTS.find(a => a.id === id);
  if (!achievement) return null;
  unlockedAchievements.add(id);
  pendingAchievement = achievement;
  return achievement;
}

export function consumePendingAchievement(): Achievement | null {
  const a = pendingAchievement;
  pendingAchievement = null;
  return a;
}

export function hasAchievement(id: string): boolean {
  return unlockedAchievements.has(id);
}
