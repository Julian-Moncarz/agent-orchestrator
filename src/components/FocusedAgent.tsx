// src/components/FocusedAgent.tsx

import React from 'react';
import { Box, Text } from 'ink';

export interface FocusedAgentProps {
  id: string;
  output: string;
  status: string;
  onBack: () => void;
}

const MAX_OUTPUT_LINES = 30;

export const FocusedAgent: React.FC<FocusedAgentProps> = ({
  id,
  output,
  status,
}) => {
  // Get last 30 lines of output
  const lines = output.split('\n');
  const displayLines = lines.slice(-MAX_OUTPUT_LINES);
  const displayOutput = displayLines.join('\n');

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box>
        <Text bold color="cyan">{id}</Text>
        <Text> - </Text>
        <Text color="yellow">{status}</Text>
      </Box>

      {/* Hint */}
      <Text dimColor>Press ESC to go back</Text>

      {/* Output area with border */}
      <Box
        flexDirection="column"
        borderStyle="single"
        marginTop={1}
        paddingX={1}
      >
        <Text>{displayOutput}</Text>
      </Box>
    </Box>
  );
};
