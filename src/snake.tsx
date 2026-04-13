// Snake — GitHub Contribution Graph Edition
// The board looks like GitHub's contribution heatmap.
// Snake body uses GitHub's green gradient with directional head.
// Food is the mini Claude logo in terracotta.
// Achievements: "First bite" (first food), "Snaked it" (length 10), "Commit streak" (5 without turning).

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  COLORS,
  SNAKE_GREENS,
  FOOD_CHAR,
  getHighScore,
  updateHighScore,
  formatScore,
  getTerminalSize,
  setLastGame,
  unlockAchievement,
} from './utils.js';
import { StatusBar } from './status-bar.js';
import { readAgentState } from './status-bridge.js';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };
type GameState = 'waiting' | 'playing' | 'paused' | 'gameover' | 'won';

const GAME_NAME = 'snake';

const VELOCITY: Record<Direction, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

// Directional head characters — gives the snake a face
const HEAD_CHAR: Record<Direction, string> = {
  UP: '▲▲',
  DOWN: '▼▼',
  LEFT: '◀◀',
  RIGHT: '▶▶',
};

// Body uses solid block for contrast against the grid
const BODY_CHAR = '██';
// Tail tapers off
const TAIL_CHAR = '░░';

/** Compute grid dimensions from terminal size */
function computeGridDims(termCols: number, termRows: number) {
  return {
    gridCols: Math.min(40, Math.floor((termCols - 4) / 2)),
    gridRows: Math.min(20, Math.floor((termRows - 14) / 1)),
  };
}

interface SnakeGameProps {
  onExit: () => void;
}

export const SnakeGame: React.FC<SnakeGameProps> = ({ onExit }) => {
  const termSize = getTerminalSize();
  const initialDims = computeGridDims(termSize.cols, termSize.rows);

  // M-4: Store grid dimensions in state so they can update on terminal resize
  const [gridCols, setGridCols] = useState(initialDims.gridCols);
  const [gridRows, setGridRows] = useState(initialDims.gridRows);

  // E-9: Mounted ref guard — prevent setState calls after unmount in async callbacks
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Game state (E-1: added 'won')
  const [state, setState] = useState<GameState>('waiting');
  const [snake, setSnake] = useState<Point[]>([{ x: Math.floor(initialDims.gridCols / 2), y: Math.floor(initialDims.gridRows / 2) }]);
  const [food, setFood] = useState<Point>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [score, setScore] = useState(0);
  const [speed, setSpeed] = useState(150);
  const [foodPulse, setFoodPulse] = useState(false);
  const dirRef = useRef<Direction>('RIGHT');
  const stateRef = useRef<GameState>('waiting');
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(0);
  const speedRef = useRef(150);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gridColsRef = useRef(gridCols);
  const gridRowsRef = useRef(gridRows);

  // Achievement tracking
  const streakRef = useRef(0);
  const lastDirOnEatRef = useRef<Direction>('RIGHT');

  useEffect(() => { snakeRef.current = snake; }, [snake]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { gridColsRef.current = gridCols; }, [gridCols]);
  useEffect(() => { gridRowsRef.current = gridRows; }, [gridRows]);

  // M-4: Terminal resize handling — update grid dimensions and clamp snake positions
  useEffect(() => {
    const onResize = () => {
      if (!mountedRef.current) return;
      const size = getTerminalSize();
      const { gridCols: newCols, gridRows: newRows } = computeGridDims(size.cols, size.rows);
      setGridCols(newCols);
      setGridRows(newRows);

      // Clamp snake positions to fit inside the new grid
      setSnake(prev =>
        prev.map(p => ({
          x: Math.min(p.x, newCols - 1),
          y: Math.min(p.y, newRows - 1),
        }))
      );

      // Clamp food position too
      setFood(prev => ({
        x: Math.min(prev.x, newCols - 1),
        y: Math.min(prev.y, newRows - 1),
      }));
    };

    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  // Food pulse animation — blinks between bright and normal terracotta
  useEffect(() => {
    const interval = setInterval(() => setFoodPulse(p => !p), 400);
    return () => clearInterval(interval);
  }, []);

  // Place food at a random empty cell
  const placeFood = useCallback((currentSnake: Point[], cols: number, rows: number): Point => {
    const occupied = new Set(currentSnake.map(p => `${p.x},${p.y}`));
    const empty: Point[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!occupied.has(`${x},${y}`)) {
          empty.push({ x, y });
        }
      }
    }
    if (empty.length === 0) return { x: -1, y: -1 };
    return empty[Math.floor(Math.random() * empty.length)];
  }, []);

  // Initialize food
  // Deps are intentionally limited to run only on mount — placeFood and snake
  // are read from their initial values; subsequent food placement happens in tick().
  useEffect(() => {
    setFood(placeFood(snake, gridCols, gridRows));
  }, []); // L-6: Intentionally run only on mount; see comment above

  // Game tick
  const tick = useCallback(() => {
    if (stateRef.current !== 'playing') return;

    const currentSnake = snakeRef.current;
    const currentFood = foodRef.current;
    const dir = dirRef.current;
    const vel = VELOCITY[dir];
    const head = currentSnake[0];
    const cols = gridColsRef.current;
    const rows = gridRowsRef.current;

    // Wrap around edges
    const newHead: Point = {
      x: (head.x + vel.x + cols) % cols,
      y: (head.y + vel.y + rows) % rows,
    };

    // Self collision
    const willEat = newHead.x === currentFood.x && newHead.y === currentFood.y;
    const bodyToCheck = willEat ? currentSnake : currentSnake.slice(0, -1);
    if (bodyToCheck.some(p => p.x === newHead.x && p.y === newHead.y)) {
      setState('gameover');
      updateHighScore(GAME_NAME, scoreRef.current);
      setLastGame('snake', scoreRef.current);
      return;
    }

    const newSnake = [newHead, ...currentSnake];
    if (willEat) {
      const newScore = scoreRef.current + 1;
      setScore(newScore);
      setLastGame('snake', newScore);

      // E-1: Check win condition — if no empty cells remain, player wins
      const newFood = placeFood(newSnake, cols, rows);
      if (newFood.x === -1 && newFood.y === -1) {
        // Snake fills the entire grid — victory!
        setSnake(newSnake);
        updateHighScore(GAME_NAME, newScore);
        setState('won');
        return;
      }
      setFood(newFood);

      if (newScore % 5 === 0) {
        setSpeed(s => Math.max(60, s - 10));
      }

      if (newScore === 1) unlockAchievement('first_bite');
      if (newSnake.length >= 10) unlockAchievement('snaked_it');

      if (dir === lastDirOnEatRef.current) {
        streakRef.current++;
        if (streakRef.current >= 5) unlockAchievement('commit_streak');
      } else {
        streakRef.current = 1;
        lastDirOnEatRef.current = dir;
      }
    } else {
      newSnake.pop();
    }

    setSnake(newSnake);
  }, [placeFood]);

  // Game loop — stops when paused
  useEffect(() => {
    if (state === 'playing') {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(tick, speed);
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
  }, [state, speed, tick]);

  // Auto-pause when Claude finishes or needs input
  // E-9: Guard setState calls with mountedRef
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
  useInput((input: string, key: { escape?: boolean; upArrow?: boolean; downArrow?: boolean; leftArrow?: boolean; rightArrow?: boolean; return?: boolean }) => {
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
      let startDir: Direction | null = null;
      if (key.upArrow || input === 'w') startDir = 'UP';
      else if (key.downArrow || input === 's') startDir = 'DOWN';
      else if (key.leftArrow || input === 'a') startDir = 'LEFT';
      else if (key.rightArrow || input === 'd') startDir = 'RIGHT';
      if (startDir) {
        dirRef.current = startDir;
        setDirection(startDir);
        setState('playing');
      }
      return;
    }

    // Resume from pause with any direction key too
    if (state === 'paused') {
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow ||
          input === 'w' || input === 'a' || input === 's' || input === 'd' || input === ' ') {
        setState('playing');
      }
      return;
    }

    // E-1: Handle restart from both gameover and won states
    if (state === 'gameover' || state === 'won') {
      if (input === ' ') {
        const startSnake = [{ x: Math.floor(gridCols / 2), y: Math.floor(gridRows / 2) }];
        setSnake(startSnake);
        setFood(placeFood(startSnake, gridCols, gridRows));
        dirRef.current = 'RIGHT';
        setDirection('RIGHT');
        setScore(0);
        setSpeed(150);
        streakRef.current = 0;
        setState('playing');
      }
      return;
    }

    let newDir: Direction | null = null;
    if (key.upArrow || input === 'w') newDir = 'UP';
    else if (key.downArrow || input === 's') newDir = 'DOWN';
    else if (key.leftArrow || input === 'a') newDir = 'LEFT';
    else if (key.rightArrow || input === 'd') newDir = 'RIGHT';

    if (newDir && OPPOSITE[newDir] !== dirRef.current) {
      dirRef.current = newDir;
      setDirection(newDir);
    }
  });

  // Color for a snake segment — smooth gradient from head to tail
  const getSegmentColor = (index: number, total: number): string => {
    if (total <= 1) return SNAKE_GREENS[0];
    const ratio = index / (total - 1);
    const colorIndex = Math.min(Math.floor(ratio * SNAKE_GREENS.length), SNAKE_GREENS.length - 1);
    return SNAKE_GREENS[colorIndex];
  };

  // Checkerboard tint for empty cells — subtle depth like GitHub's actual grid
  const getEmptyBg = (x: number, y: number): string => {
    return (x + y) % 2 === 0 ? COLORS.surface : '#1a2030';
  };

  // L-9: O(1) snake rendering — build a lookup map once per render
  // Maps "x,y" -> index in the snake array, so renderCell avoids O(n) findIndex
  const snakeLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < snake.length; i++) {
      map.set(`${snake[i].x},${snake[i].y}`, i);
    }
    return map;
  }, [snake]);

  // Render a single cell
  const renderCell = (x: number, y: number): React.ReactElement => {
    // L-9: O(1) lookup instead of snake.findIndex()
    const snakeIndex = snakeLookup.get(`${x},${y}`) ?? -1;
    const isFood = food.x === x && food.y === y;

    // Snake head — directional arrow character
    if (snakeIndex === 0) {
      const headColor = SNAKE_GREENS[0];
      return (
        <Text key={`${x},${y}`} color={headColor} backgroundColor="#0a1a0a" bold>
          {HEAD_CHAR[direction]}
        </Text>
      );
    }

    // Snake body — solid blocks with gradient color
    if (snakeIndex > 0) {
      const color = getSegmentColor(snakeIndex, snake.length);
      const isLast = snakeIndex === snake.length - 1;
      const char = isLast && snake.length > 2 ? TAIL_CHAR : BODY_CHAR;
      return (
        <Text key={`${x},${y}`} color={color} backgroundColor="#0a1a0a">
          {char}
        </Text>
      );
    }

    // Food — mini Claude logo, pulsing between bright and normal
    if (isFood) {
      return (
        <Text
          key={`${x},${y}`}
          color={foodPulse ? COLORS.terracottaLight : COLORS.terracotta}
          backgroundColor={COLORS.surface}
          bold
        >
          {FOOD_CHAR}
        </Text>
      );
    }

    // Empty cell — subtle checkerboard
    return (
      <Text key={`${x},${y}`} backgroundColor={getEmptyBg(x, y)}>
        {'  '}
      </Text>
    );
  };

  const renderGrid = (): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];
    for (let y = 0; y < gridRows; y++) {
      const cells: React.ReactElement[] = [];
      for (let x = 0; x < gridCols; x++) {
        cells.push(renderCell(x, y));
      }
      rows.push(
        <Box key={`row-${y}`} flexDirection="row">
          {cells}
        </Box>
      );
    }
    return rows;
  };

  const highScore = getHighScore(GAME_NAME);

  // E-7: Handle score display overflow — use dynamic padding width for large scores
  const scorePad = Math.max(5, String(score).length);
  const highPad = Math.max(5, String(highScore).length);

  return (
    <Box flexDirection="column" alignItems="center">
      {/* Header */}
      <Box marginBottom={1} flexDirection="row" justifyContent="center">
        <Text color={COLORS.textSecondary} bold>SNAKE</Text>
        <Text color={COLORS.textMuted}>  </Text>
        <Text color={COLORS.terracotta}>Score: {formatScore(score, scorePad)}</Text>
        <Text color={COLORS.textMuted}>  </Text>
        <Text color={COLORS.textSecondary}>Best: {formatScore(highScore, highPad)}</Text>
      </Box>

      {/* Grid — rounded border */}
      <Box flexDirection="column" borderStyle="round" borderColor={COLORS.border}>
        {renderGrid()}
      </Box>

      {/* Contribution legend */}
      <Box marginTop={1} flexDirection="row" justifyContent="center">
        <Text color={COLORS.textMuted}>Less </Text>
        <Text backgroundColor={COLORS.surface}>  </Text>
        <Text> </Text>
        <Text backgroundColor={COLORS.green1}>  </Text>
        <Text> </Text>
        <Text backgroundColor={COLORS.green2}>  </Text>
        <Text> </Text>
        <Text backgroundColor={COLORS.green3}>  </Text>
        <Text> </Text>
        <Text backgroundColor={COLORS.green4}>  </Text>
        <Text color={COLORS.textMuted}> More</Text>
        <Text>  </Text>
        <Text color={COLORS.terracotta} bold>{FOOD_CHAR}</Text>
      </Box>

      {/* Status */}
      <Box marginTop={1}>
        {state === 'waiting' && (
          <Box flexDirection="column" alignItems="center">
            <Text color={COLORS.terracotta} bold>{FOOD_CHAR}</Text>
            <Text color={COLORS.textSecondary}>Arrow keys or WASD to start</Text>
          </Box>
        )}
        {state === 'paused' && (
          <Box flexDirection="column" alignItems="center">
            <Text color={COLORS.terracottaLight} bold>PAUSED</Text>
            <Text color={COLORS.textSecondary}>Press P or any key to resume · Q to quit</Text>
          </Box>
        )}
        {state === 'gameover' && (
          <Box flexDirection="column" alignItems="center">
            <Text color={COLORS.errorRed} bold>Game Over!</Text>
            <Text color={COLORS.textSecondary}>Score: {score} contributions</Text>
            <Text color={COLORS.textMuted}>Press SPACE to restart · Q to quit</Text>
          </Box>
        )}
        {state === 'won' && (
          <Box flexDirection="column" alignItems="center">
            <Text color={COLORS.successGreen} bold>You Win! Perfect Game!</Text>
            <Text color={COLORS.textSecondary}>Score: {score} contributions — the grid is full!</Text>
            <Text color={COLORS.textMuted}>Press SPACE to restart · Q to quit</Text>
          </Box>
        )}
        {state === 'playing' && (
          <Text color={COLORS.textMuted}>P to pause · Q/Esc to quit · {score} contributions</Text>
        )}
      </Box>

      {/* Agent status bar */}
      <Box marginTop={1} width="100%">
        <StatusBar />
      </Box>
    </Box>
  );
};
