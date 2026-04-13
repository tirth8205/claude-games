import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatScore,
  clamp,
  getHighScore,
  updateHighScore,
  formatGameTime,
  startGameTimer,
  getGameElapsed,
  setLastGame,
  getLastGame,
  getGameSummary,
  unlockAchievement,
  consumePendingAchievement,
  hasAchievement,
} from '../utils.js';

describe('formatScore', () => {
  it('pads short scores with zeros', () => {
    expect(formatScore(0)).toBe('00000');
    expect(formatScore(42)).toBe('00042');
    expect(formatScore(999)).toBe('00999');
  });

  it('handles exact 5-digit scores', () => {
    expect(formatScore(99999)).toBe('99999');
    expect(formatScore(10000)).toBe('10000');
  });

  it('handles scores exceeding pad width (E-7)', () => {
    expect(formatScore(100000)).toBe('100000');
    expect(formatScore(999999)).toBe('999999');
  });

  it('respects custom pad width', () => {
    expect(formatScore(7, 3)).toBe('007');
    expect(formatScore(1234, 3)).toBe('1234');
  });
});

describe('clamp', () => {
  it('clamps values below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps values above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('handles edge cases at boundaries', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('high scores (session-scoped)', () => {
  it('returns 0 for unknown game', () => {
    expect(getHighScore('nonexistent_game')).toBe(0);
  });

  it('updates and retrieves high scores', () => {
    updateHighScore('test_game_1', 50);
    expect(getHighScore('test_game_1')).toBe(50);
  });

  it('does not downgrade high score', () => {
    updateHighScore('test_game_2', 100);
    updateHighScore('test_game_2', 50);
    expect(getHighScore('test_game_2')).toBe(100);
  });

  it('upgrades high score', () => {
    updateHighScore('test_game_3', 50);
    updateHighScore('test_game_3', 150);
    expect(getHighScore('test_game_3')).toBe(150);
  });
});

describe('formatGameTime', () => {
  it('formats seconds only', () => {
    expect(formatGameTime(0)).toBe('0s');
    expect(formatGameTime(5000)).toBe('5s');
    expect(formatGameTime(59000)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatGameTime(60000)).toBe('1m 00s');
    expect(formatGameTime(90000)).toBe('1m 30s');
    expect(formatGameTime(3600000)).toBe('60m 00s');
  });

  it('pads seconds with leading zero in minute format', () => {
    expect(formatGameTime(65000)).toBe('1m 05s');
  });
});

describe('game timer', () => {
  it('starts timer and measures elapsed time', async () => {
    startGameTimer();
    // Elapsed should be very small right after starting
    const elapsed = getGameElapsed();
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('last game tracking', () => {
  it('tracks the last game played', () => {
    setLastGame('snake', 42);
    const { game, score } = getLastGame();
    expect(game).toBe('snake');
    expect(score).toBe(42);
  });

  it('updates on subsequent plays', () => {
    setLastGame('runner', 100);
    const { game, score } = getLastGame();
    expect(game).toBe('runner');
    expect(score).toBe(100);
  });
});

describe('getGameSummary', () => {
  it('includes game info when a game was played', () => {
    startGameTimer();
    setLastGame('snake', 10);
    const summary = getGameSummary();
    expect(summary).toContain('snake');
    expect(summary).toContain('10 pts');
    expect(summary).toContain('game over');
  });
});

describe('achievements', () => {
  it('unlocks an achievement and returns it', () => {
    const result = unlockAchievement('first_bite');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('first_bite');
    expect(result!.name).toBe('First bite');
  });

  it('returns null on duplicate unlock', () => {
    // first_bite was already unlocked above
    const result = unlockAchievement('first_bite');
    expect(result).toBeNull();
  });

  it('returns null for unknown achievement id', () => {
    const result = unlockAchievement('nonexistent');
    expect(result).toBeNull();
  });

  it('consumes pending achievement', () => {
    unlockAchievement('centurion');
    const pending = consumePendingAchievement();
    expect(pending).not.toBeNull();
    expect(pending!.id).toBe('centurion');

    // Second consume returns null
    const again = consumePendingAchievement();
    expect(again).toBeNull();
  });

  it('tracks unlocked achievements', () => {
    expect(hasAchievement('first_bite')).toBe(true);
    expect(hasAchievement('nonexistent')).toBe(false);
  });
});
