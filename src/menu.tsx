// Game selection menu — the first screen users see when they type /games
// Shows the Claude sparkle logo, game cards, and a status line.

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { COLORS, CLAUDE_LOGO } from './utils.js';
import { SnakeGame } from './snake.js';
import { ClaudeRunnerGame } from './claude-runner.js';
import { StatusBar } from './status-bar.js';

type Screen = 'menu' | 'snake' | 'runner';

interface MenuProps {
  onExit: () => void;
}

export const Menu: React.FC<MenuProps> = ({ onExit }) => {
  const [screen, setScreen] = useState<Screen>('menu');
  const [selected, setSelected] = useState<0 | 1>(0);

  const returnToMenu = () => setScreen('menu');

  if (screen === 'runner') {
    return <ClaudeRunnerGame onExit={returnToMenu} />;
  }
  if (screen === 'snake') {
    return <SnakeGame onExit={returnToMenu} />;
  }

  return <MenuScreen
    selected={selected}
    onSelect={setSelected}
    onLaunch={(game) => setScreen(game)}
    onExit={onExit}
  />;
};

interface MenuScreenProps {
  selected: 0 | 1;
  onSelect: (s: 0 | 1) => void;
  onLaunch: (game: 'runner' | 'snake') => void;
  onExit: () => void;
}

const MenuScreen: React.FC<MenuScreenProps> = ({ selected, onSelect, onLaunch, onExit }) => {
  useInput((input: string, key: { escape?: boolean; leftArrow?: boolean; rightArrow?: boolean; return?: boolean }) => {
    if (input === 'q' || key.escape) {
      onExit();
      return;
    }

    if (key.leftArrow || input === 'a') {
      onSelect(0);
    } else if (key.rightArrow || input === 'd') {
      onSelect(1);
    } else if (input === '1') {
      onLaunch('runner');
    } else if (input === '2') {
      onLaunch('snake');
    } else if (key.return || input === ' ') {
      onLaunch(selected === 0 ? 'runner' : 'snake');
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      {/* Claude logo + title */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Box flexDirection="row" alignItems="center">
          <Box flexDirection="column" marginRight={2} alignItems="center">
            {CLAUDE_LOGO.map((line, i) => {
              const gradient = [COLORS.terracottaLight, COLORS.terracotta, COLORS.terracottaDark];
              return <Text key={i} color={gradient[i]} bold>{line}</Text>;
            })}
          </Box>
          <Box flexDirection="column">
            <Text color={COLORS.textPrimary} bold>claude-games</Text>
            <Text color={COLORS.textMuted}>v1.0.0</Text>
          </Box>
        </Box>
      </Box>

      <Text color={COLORS.textSecondary}>
        your agent is still working. kill time while it ships.
      </Text>

      {/* Game cards */}
      <Box marginY={1} flexDirection="row" justifyContent="center">
        {/* Claude Runner card */}
        <Box
          flexDirection="column"
          borderStyle={selected === 0 ? 'bold' : 'single'}
          borderColor={selected === 0 ? COLORS.terracotta : COLORS.border}
          paddingX={2}
          paddingY={1}
          marginRight={2}
          width={32}
        >
          <Box flexDirection="row">
            <Text color={COLORS.terracotta} bold>▜▛</Text>
            <Text color={COLORS.textPrimary} bold> Claude Runner</Text>
          </Box>
          <Text color={COLORS.textMuted}> </Text>
          <Text color={COLORS.textSecondary}>dodge errors while</Text>
          <Text color={COLORS.textSecondary}>claude ships your code</Text>
          {selected === 0 && (
            <Box marginTop={1}>
              <Text color={COLORS.terracotta}>{'> press enter to play'}</Text>
            </Box>
          )}
        </Box>

        {/* Snake card */}
        <Box
          flexDirection="column"
          borderStyle={selected === 1 ? 'bold' : 'single'}
          borderColor={selected === 1 ? COLORS.successGreen : COLORS.border}
          paddingX={2}
          paddingY={1}
          width={32}
        >
          <Box flexDirection="row">
            <Text color={COLORS.successGreen} bold>{'>>>'}</Text>
            <Text color={COLORS.textPrimary} bold> Snake</Text>
          </Box>
          <Text color={COLORS.textMuted}> </Text>
          <Text color={COLORS.textSecondary}>github contribution</Text>
          <Text color={COLORS.textSecondary}>graph edition</Text>
          {selected === 1 && (
            <Box marginTop={1}>
              <Text color={COLORS.successGreen}>{'> press enter to play'}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Controls hint */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color={COLORS.textMuted}>
          {'<- -> to select  ·  Enter to play  ·  1/2 for quick launch  ·  Q to quit'}
        </Text>
      </Box>

      {/* Agent status bar */}
      <Box marginTop={1} width="100%">
        <StatusBar />
      </Box>
    </Box>
  );
};
