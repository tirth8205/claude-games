// Claude Runner — the Claude sparkle mascot dodges terminal-themed obstacles
// The character is the exact Claude Code startup logo in terracotta.
// Achievements: "Centurion" (score 100), "Speed demon" (survive past 200).

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  COLORS,
  RUNNER_FRAMES,
  RUNNER_DUCK,
  getHighScore,
  updateHighScore,
  formatScore,
  getTerminalSize,
  setLastGame,
  unlockAchievement,
} from './utils.js';
import { StatusBar } from './status-bar.js';
import { readAgentState } from './status-bridge.js';

type GameState = 'waiting' | 'playing' | 'paused' | 'gameover';

const GAME_NAME = 'runner';
const TICK_MS = 50;       // ~20fps base frame rate
const GROUND_Y = 14;      // Ground row in the play area
const GRAVITY = 0.55;
const JUMP_VELOCITY = -3; // Tuned so max height ≈ 9 rows (stays inside the frame)
const MAX_JUMP_Y = 10;    // Hard clamp — never exceed GROUND_Y - CHAR_HEIGHT
const CHAR_HEIGHT = 3;
const DUCK_HEIGHT = 2;
const MAX_SPEED = 2.8;    // E-10: asymptotic speed cap

// Obstacle types — real terminal / dev artifacts you'd recognize in a terminal session
type ObstacleType = 'segfault' | 'npm_err' | 'stack' | 'git_conflict' | 'panic' | 'null' | 'error_banner' | 'pipe';

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: ObstacleType;
  char: string[];
  color: string;
}

interface Cloud {
  x: number;
  y: number;
  text: string;
}

interface ClaudeRunnerProps {
  onExit: () => void;
}

// E-7: Score display helper — handles scores > 99999 gracefully
function displayScore(score: number): string {
  if (score > 99999) return String(score);
  return formatScore(score);
}

export const ClaudeRunnerGame: React.FC<ClaudeRunnerProps> = ({ onExit }) => {
  // M-4: Store playWidth in state so it updates on terminal resize
  const [playWidth, setPlayWidth] = useState(() => {
    const termSize = getTerminalSize();
    return Math.min(termSize.cols - 2, 100);
  });

  const [state, setState] = useState<GameState>('waiting');
  const [score, setScore] = useState(0);
  const [playerY, setPlayerY] = useState(0);
  const [velocityY, setVelocityY] = useState(0);
  const [isDucking, setIsDucking] = useState(false);
  const [frame, setFrame] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [clouds, setClouds] = useState<Cloud[]>([]);
  const [gameSpeed, setGameSpeed] = useState(1.2);
  const [milestone, setMilestone] = useState('');

  const stateRef = useRef<GameState>('waiting');
  const scoreRef = useRef(0);
  const playerYRef = useRef(0);
  const velocityYRef = useRef(0);
  const isDuckingRef = useRef(false);
  const frameRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const cloudsRef = useRef<Cloud[]>([]);
  const gameSpeedRef = useRef(1.2);
  const tickCountRef = useRef(0);
  const lastObstacleRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // E-9: Mounted ref guard for async callbacks
  const mountedRef = useRef(true);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { playerYRef.current = playerY; }, [playerY]);
  useEffect(() => { velocityYRef.current = velocityY; }, [velocityY]);
  useEffect(() => { isDuckingRef.current = isDucking; }, [isDucking]);
  useEffect(() => { frameRef.current = frame; }, [frame]);
  useEffect(() => { obstaclesRef.current = obstacles; }, [obstacles]);
  useEffect(() => { cloudsRef.current = clouds; }, [clouds]);
  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);

  // E-9: Track mount/unmount for async safety
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // M-4: Listen for terminal resize events and update playWidth
  useEffect(() => {
    const handleResize = () => {
      const termSize = getTerminalSize();
      setPlayWidth(Math.min(termSize.cols - 2, 100));
    };
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);

  // L-10 / E-12: Memoize obstacle pool — only recreated when playWidth changes
  const obstaclePool = useMemo<Array<() => Obstacle>>(() => [
    // ── Ground obstacles (jump over) ──────────────────────────

    // Segfault — compact box
    () => ({
      x: playWidth, width: 6, height: 2, type: 'segfault' as ObstacleType,
      char: ['┌────┐', '│ 11 │'],
      color: COLORS.errorRed,
    }),
    // npm ERR! — M-5: width corrected to 6 to match widest line ('ERR! █' = 6 chars)
    () => ({
      x: playWidth, width: 6, height: 2, type: 'npm_err' as ObstacleType,
      char: ['npm █ ', 'ERR! █'],
      color: COLORS.errorRed,
    }),
    // Stack trace — short fragment
    () => ({
      x: playWidth, width: 6, height: 3, type: 'stack' as ObstacleType,
      char: ['at <>:', '  at :', '  ^^^ '],
      color: COLORS.textSecondary,
    }),
    // Git conflict
    () => ({
      x: playWidth, width: 6, height: 3, type: 'git_conflict' as ObstacleType,
      char: ['<<HEAD', '══════', '>>main'],
      color: '#e3b341',
    }),
    // Panic
    () => ({
      x: playWidth, width: 7, height: 2, type: 'panic' as ObstacleType,
      char: ['panic! ', '██████ '],
      color: COLORS.errorRed,
    }),
    // null / NaN / void — M-5: width corrected to 6 to match visual '│' + 4char + '│' = 6
    // Also fixed top border to match: '┌────┐' = 6 chars
    () => {
      const vals = ['null', ' NaN', 'void'];
      const v = vals[Math.floor(Math.random() * vals.length)];
      return {
        x: playWidth, width: 6, height: 2, type: 'null' as ObstacleType,
        char: ['┌────┐', '│' + v + '│'],
        color: COLORS.textMuted,
      };
    },
    // Broken pipe
    () => ({
      x: playWidth, width: 5, height: 2, type: 'pipe' as ObstacleType,
      char: ['EPIPE', '█████'],
      color: COLORS.textSecondary,
    }),
    // 404
    () => ({
      x: playWidth, width: 5, height: 2, type: 'segfault' as ObstacleType,
      char: ['┌───┐', '│404│'],
      color: COLORS.errorRed,
    }),
    // Exit code 1
    () => ({
      x: playWidth, width: 4, height: 3, type: 'stack' as ObstacleType,
      char: ['exit', 'code', ' (1)'],
      color: COLORS.errorRed,
    }),

    // ── Aerial obstacles (duck under) ─────────────────────────

    // FATAL
    () => ({
      x: playWidth, width: 7, height: 1, type: 'error_banner' as ObstacleType,
      char: ['▌FATAL▐'],
      color: COLORS.errorRed,
    }),
    // 500
    () => ({
      x: playWidth, width: 5, height: 1, type: 'error_banner' as ObstacleType,
      char: ['▌500▐'],
      color: COLORS.errorRed,
    }),
    // SIGKILL
    () => ({
      x: playWidth, width: 6, height: 1, type: 'error_banner' as ObstacleType,
      char: ['▌KILL▐'],
      color: '#f0883e',
    }),
    // DENIED
    () => ({
      x: playWidth, width: 6, height: 1, type: 'error_banner' as ObstacleType,
      char: ['▌ 403▐'],
      color: COLORS.errorRed,
    }),
  ], [playWidth]);

  const createObstacle = useCallback((): Obstacle => {
    const factory = obstaclePool[Math.floor(Math.random() * obstaclePool.length)];
    return factory();
  }, [obstaclePool]);

  // Main game tick
  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;

    const count = tickCountRef.current++;
    const speed = gameSpeedRef.current;

    // Score every 3 ticks
    if (count % 3 === 0) {
      const newScore = scoreRef.current + 1;
      setScore(newScore);
      setLastGame('runner', newScore);

      // Achievements
      if (newScore === 100) unlockAchievement('centurion');
      if (newScore === 200) unlockAchievement('speed_demon');

      // Hidden easter eggs at special score numbers
      const EASTER_EGGS: Record<number, string> = {
        404: 'score not found',
        418: "i'm a teapot",
        500: 'internal server error',
        502: 'bad gateway',
        666: 'the devil ships to prod on fridays',
        777: 'jackpot! no bugs here',
        1000: '▜▛ LEGENDARY',
        1024: '1 KB of pure skill',
        1337: 'h4x0r',
        1500: 'you should be reviewing that PR',
        2000: '▜▛ are you even working?',
        2048: 'wrong game',
        3000: 'claude finished ages ago',
        8080: 'localhost vibes',
        9001: "it's over 9000!",
      };

      const egg = EASTER_EGGS[newScore];
      if (egg) {
        setMilestone(egg);
        setTimeout(() => {
          if (mountedRef.current) setMilestone('');
        }, 2500);
      }

      // Speed up every 100 points
      if (newScore > 0 && newScore % 100 === 0) {
        if (!egg) {
          setMilestone('▜▛ nice!');
          setTimeout(() => {
            if (mountedRef.current) setMilestone('');
          }, 1500);
        }
        // E-10: Asymptotic speed curve — approaches MAX_SPEED but never reaches it
        setGameSpeed(1.2 + (MAX_SPEED - 1.2) * (1 - Math.exp(-newScore / 800)));
      }
    }

    // Animate running frame
    if (count % 3 === 0) {
      setFrame(f => (f + 1) % 2);
    }

    // Physics — clamp so the character never leaves the visible frame
    let newY = playerYRef.current;
    let newVel = velocityYRef.current;

    if (newY > 0 || newVel < 0) {
      newVel += GRAVITY;
      newY -= newVel;
      if (newY <= 0) {
        newY = 0;
        newVel = 0;
      }
      if (newY > MAX_JUMP_Y) {
        newY = MAX_JUMP_Y;
        newVel = 0; // start falling immediately at the cap
      }
      setPlayerY(newY);
      setVelocityY(newVel);
    }

    // Move obstacles
    const moveAmount = 2 * speed;
    const movedObs = obstaclesRef.current
      .map(o => ({ ...o, x: o.x - moveAmount }))
      .filter(o => o.x > -10);

    // Spawn obstacles — tighter gaps, more frequent at higher speed
    const ticksSinceLast = count - lastObstacleRef.current;
    const minGap = Math.max(12, 28 - Math.floor(speed * 5));
    if (ticksSinceLast > minGap && Math.random() < 0.07 * speed) {
      movedObs.push(createObstacle());
      lastObstacleRef.current = count;
    }

    // Collision detection (forgiving hitboxes)
    const charX = 5;
    const charW = 6;
    const currentlyDucking = isDuckingRef.current;
    const charH = currentlyDucking ? DUCK_HEIGHT : CHAR_HEIGHT;
    const charBottom = newY;

    for (const obs of movedObs) {
      // Forgiving margins — 2 chars of slack on each side
      const obsLeft = obs.x + 2;
      const obsRight = obs.x + obs.width - 2;
      const playerLeft = charX + 2;
      const playerRight = charX + charW - 2;

      if (playerRight > obsLeft && playerLeft < obsRight) {
        if (obs.type === 'error_banner') {
          // Aerial obstacles — must duck to avoid
          if (!currentlyDucking && charBottom < 3) {
            setState('gameover');
            updateHighScore(GAME_NAME, scoreRef.current);
            setLastGame('runner', scoreRef.current);
            return;
          }
        } else {
          // Ground obstacles — must jump over
          const obsTop = obs.height;
          if (charBottom < obsTop) {
            setState('gameover');
            updateHighScore(GAME_NAME, scoreRef.current);
            setLastGame('runner', scoreRef.current);
            return;
          }
        }
      }
    }

    setObstacles(movedObs);

    // Clouds (parallax)
    const movedClouds = cloudsRef.current
      .map(c => ({ ...c, x: c.x - 0.5 * speed }))
      .filter(c => c.x > -20);

    if (Math.random() < 0.012) {
      // Floating dev comments and terminal artifacts instead of clouds
      const cloudTexts = [
        '// TODO: fix later',
        '// HACK',
        '// FIXME',
        '/* eslint-disable */',
        '# deprecated',
        '$ _',
        '>>> ',
        '// works on my machine',
        '// don\'t touch this',
        '// no idea why this works',
      ];
      movedClouds.push({
        x: playWidth + 5,
        y: 1 + Math.floor(Math.random() * 5),
        text: cloudTexts[Math.floor(Math.random() * cloudTexts.length)],
      });
    }
    setClouds(movedClouds);
  }, [createObstacle, playWidth]);

  // Start/stop game loop — respects pause
  useEffect(() => {
    if (state === 'playing') {
      tickCountRef.current = 0;
      lastObstacleRef.current = 0;
      tickRef.current = setInterval(tick, TICK_MS);
    }
    if (state === 'paused') {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state, tick]);

  // Auto-pause when Claude finishes or needs input
  // E-9: Check mountedRef before calling setState in async callback
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!mountedRef.current) return;
      if (stateRef.current !== 'playing') return;
      const agentState = await readAgentState();
      if (!mountedRef.current) return;
      if (agentState.status === 'done' || agentState.status === 'waiting_for_input') {
        setState('paused');
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Input
  useInput((input: string, key: { escape?: boolean; upArrow?: boolean; downArrow?: boolean; return?: boolean }) => {
    if (input === 'q' || key.escape) {
      if (tickRef.current) clearInterval(tickRef.current);
      onExit();
      return;
    }

    // Toggle pause
    if (input === 'p') {
      if (state === 'playing') {
        setState('paused');
      } else if (state === 'paused') {
        setState('playing');
      }
      return;
    }

    if (state === 'waiting') {
      if (input === ' ' || key.upArrow) {
        setState('playing');
        setPlayerY(0);
        setVelocityY(0);
        setObstacles([]);
        setClouds([]);
        setScore(0);
        setGameSpeed(1.2);
      }
      return;
    }

    // Resume from pause
    if (state === 'paused') {
      if (input === ' ' || key.upArrow || key.downArrow) {
        setState('playing');
      }
      return;
    }

    if (state === 'gameover') {
      if (input === ' ') {
        setState('playing');
        setPlayerY(0);
        setVelocityY(0);
        setObstacles([]);
        setClouds([]);
        setScore(0);
        setGameSpeed(1.2);
        setFrame(0);
      }
      return;
    }

    // Playing
    if (input === ' ' || key.upArrow) {
      if (playerYRef.current <= 0) {
        setVelocityY(JUMP_VELOCITY);
        setPlayerY(1);
        setIsDucking(false);
      }
    } else if (key.downArrow) {
      if (playerYRef.current <= 0) {
        setIsDucking(true);
        lastDownRef.current = Date.now(); // reset hold timer on each repeat
      }
    }
  });

  // Duck stays active while down arrow is held — release on any other key or no input
  // We track the last time down was pressed; if no repeat within 120ms, release
  const lastDownRef = useRef(0);
  useEffect(() => {
    if (!isDucking || state !== 'playing') return;
    const check = setInterval(() => {
      if (Date.now() - lastDownRef.current > 120) {
        setIsDucking(false);
      }
    }, 60);
    return () => clearInterval(check);
  }, [isDucking, state]);

  // Build the scene as a character grid
  const renderScene = (): React.ReactElement => {
    const sceneHeight = GROUND_Y + 2;
    const lines: string[] = Array(sceneHeight).fill('').map(() => ' '.repeat(playWidth));

    // Clouds
    for (const cloud of clouds) {
      const row = Math.floor(cloud.y);
      const col = Math.floor(cloud.x);
      if (row >= 0 && row < sceneHeight && col >= 0 && col < playWidth) {
        const line = lines[row];
        const end = Math.min(col + cloud.text.length, playWidth);
        lines[row] = line.substring(0, col) + cloud.text.substring(0, end - col) + line.substring(end);
      }
    }

    // Ground — scrolling dashed line with cursor dots
    const groundPattern = '─ · ─ ─ · ─ · ─ ─ · ';
    let ground = '';
    while (ground.length < playWidth) ground += groundPattern;
    lines[GROUND_Y] = ground.substring(0, playWidth);

    const charLines = isDucking ? RUNNER_DUCK : RUNNER_FRAMES[frame];
    const jumpOffset = Math.floor(playerY);

    // Obstacle elements — each uses its own color from the pool
    const obsElements: React.ReactElement[] = [];
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const col = Math.floor(obs.x);
      if (col < -obs.width || col >= playWidth) continue;

      for (let h = 0; h < obs.char.length; h++) {
        let row: number;
        if (obs.type === 'error_banner') {
          // Aerial obstacles float at head height
          row = GROUND_Y - 4;
        } else {
          // Ground obstacles sit on the ground line
          row = GROUND_Y - obs.char.length + h;
        }
        if (row >= 0 && row < sceneHeight && col >= 0) {
          obsElements.push(
            <Box key={`obs-${i}-${h}`} position="absolute" marginLeft={col} marginTop={row}>
              <Text color={obs.color}>{obs.char[h]}</Text>
            </Box>
          );
        }
      }
    }

    return (
      <Box flexDirection="column" width={playWidth} height={sceneHeight} position="relative">
        {lines.map((line, i) => (
          <Box key={`line-${i}`}>
            <Text color={i === GROUND_Y ? COLORS.border : COLORS.textMuted}>{line}</Text>
          </Box>
        ))}

        {obsElements}

        {/* Player character */}
        <Box position="absolute" marginLeft={5} marginTop={GROUND_Y - charLines.length - jumpOffset}>
          <Box flexDirection="column">
            {charLines.map((line, i) => (
              <Text key={`char-${i}`} color={state === 'gameover' ? COLORS.textMuted : COLORS.terracotta} bold>
                {line}
              </Text>
            ))}
          </Box>
        </Box>
      </Box>
    );
  };

  const highScore = getHighScore(GAME_NAME);

  return (
    <Box flexDirection="column" alignItems="center">
      {/* Header */}
      <Box marginBottom={1} flexDirection="row" justifyContent="space-between" width={playWidth}>
        <Box>
          <Text color={COLORS.textSecondary} bold>CLAUDE RUNNER</Text>
          {milestone ? (
            <Text color={COLORS.terracotta} bold>  {milestone}</Text>
          ) : null}
        </Box>
        <Box>
          {/* E-7: Use displayScore to handle scores > 99999 gracefully */}
          <Text color={COLORS.terracotta}>{displayScore(score)}</Text>
          <Text color={COLORS.textMuted}>  HI </Text>
          <Text color={COLORS.textSecondary}>{displayScore(Math.max(highScore, score))}</Text>
        </Box>
      </Box>

      {/* Game area */}
      <Box borderStyle="single" borderColor={COLORS.border} overflow="hidden">
        {renderScene()}
      </Box>

      {/* Status text */}
      <Box marginTop={1}>
        {state === 'waiting' && (
          <Text color={COLORS.textSecondary}>Press SPACE or UP to start</Text>
        )}
        {state === 'paused' && (
          <Box flexDirection="column" alignItems="center">
            <Text color={COLORS.terracottaLight} bold>PAUSED</Text>
            <Text color={COLORS.textSecondary}>Press P or SPACE to resume · Q to quit</Text>
          </Box>
        )}
        {state === 'gameover' && (
          <Box flexDirection="column" alignItems="center">
            <Text color={COLORS.errorRed} bold>Game Over!</Text>
            <Text color={COLORS.textSecondary}>Score: {displayScore(score)}</Text>
            <Text color={COLORS.textMuted}>Press SPACE to restart · Q to quit</Text>
          </Box>
        )}
        {state === 'playing' && (
          <Text color={COLORS.textMuted}>SPACE/UP to jump · DOWN to duck · P to pause · Q/Esc to quit</Text>
        )}
      </Box>

      {/* Agent status bar */}
      <Box marginTop={1} width="100%">
        <StatusBar />
      </Box>
    </Box>
  );
};
