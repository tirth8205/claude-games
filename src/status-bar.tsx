// Agent Status Bar — persistent across all game screens
// Reads real agent state from the status bridge file (written by Claude Code hooks).
// Falls back to a generic "working" state if hooks aren't configured.
// Flashes achievements when they unlock.
// Shows urgent alerts when Claude is done or needs input.

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import {
  COLORS,
  getRecessElapsed,
  formatRecessTime,
  consumePendingAchievement,
  type Achievement,
  getTerminalSize,
} from './utils.js';
import { readAgentState, getStatusDisplay, type AgentState } from './status-bridge.js';

// Dot color map
const DOT_COLORS: Record<string, { bright: string; dim: string }> = {
  green:  { bright: COLORS.successGreen, dim: COLORS.successGreenDim },
  yellow: { bright: '#e3b341',           dim: '#5c4a1e' },
  blue:   { bright: '#58a6ff',           dim: '#1a3a5c' },
  red:    { bright: COLORS.errorRed,     dim: '#5c1a1a' },
};

export const StatusBar: React.FC = () => {
  const [pulseOn, setPulseOn] = useState(true);
  const [elapsed, setElapsed] = useState('0s');
  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'working',
    message: 'claude is working...',
    timestamp: Date.now(),
  });
  const termSize = getTerminalSize();

  // Pulse the status dot
  useEffect(() => {
    const interval = setInterval(() => setPulseOn(p => !p), 800);
    return () => clearInterval(interval);
  }, []);

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatRecessTime(getRecessElapsed()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll agent state from the status bridge file
  useEffect(() => {
    const interval = setInterval(async () => {
      const state = await readAgentState();
      setAgentState(state);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for pending achievements
  useEffect(() => {
    const interval = setInterval(() => {
      const a = consumePendingAchievement();
      if (a) {
        setAchievement(a);
        setTimeout(() => setAchievement(null), 3000);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const display = getStatusDisplay(agentState);
  const dotColor = DOT_COLORS[display.dotColor] ?? DOT_COLORS.green;
  const barWidth = Math.min(termSize.cols - 2, 80);
  const divider = '─'.repeat(barWidth);

  return (
    <Box flexDirection="column" alignItems="center" width="100%">
      {/* Achievement flash */}
      {achievement && (
        <Box marginBottom={0} justifyContent="center">
          <Text color={COLORS.terracotta} bold>
            {'▜▛ '}{achievement.name}{' — '}{achievement.description}
          </Text>
        </Box>
      )}

      {/* Urgent alert — when Claude is done or needs input */}
      {display.urgent && (
        <Box justifyContent="center" marginBottom={0}>
          <Text
            color={display.dotColor === 'yellow' ? '#e3b341' : display.dotColor === 'blue' ? '#58a6ff' : COLORS.errorRed}
            bold
          >
            {'>>> '}{display.text}{' <<<'}
          </Text>
        </Box>
      )}

      <Text color={COLORS.border}>{divider}</Text>

      <Box flexDirection="row" justifyContent="center" width={barWidth}>
        <Text color={pulseOn ? dotColor.bright : dotColor.dim}>{'● '}</Text>
        <Text color={display.urgent ? COLORS.textPrimary : COLORS.textMuted}>
          {display.text}
        </Text>
        <Text color={COLORS.border}>{'  ║  '}</Text>
        <Text color={COLORS.textSecondary}>recess: </Text>
        <Text color={COLORS.textPrimary}>{elapsed}</Text>
        <Text color={COLORS.border}>{'  ║  '}</Text>
        <Text color={COLORS.textMuted}>esc to return</Text>
      </Box>

      <Text color={COLORS.border}>{divider}</Text>
    </Box>
  );
};
