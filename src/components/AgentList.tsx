// src/components/AgentList.tsx

import React from 'react';
import { Box, Text } from 'ink';
import { AgentStatus } from '../types.js';

interface AgentCardProps {
  status: AgentStatus;
  isFocused: boolean;
  onSelect: () => void;
}

interface AgentListProps {
  agents: AgentStatus[];
  focusedId: string | null;
  onSelectAgent: (id: string) => void; // Callback for parent to handle - wired in App component
}

const getStatusIndicator = (state: AgentStatus['state']): string => {
  switch (state) {
    case 'needs_input':
      return '\u26A0'; // warning symbol
    default:
      return '\u25CF'; // filled circle
  }
};

const truncateText = (text: string, maxLength: number = 60): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Gets the display text for an agent's status line.
 * Prioritizes showing actual output over LLM-generated summary.
 * If lastOutput is available, extracts the last meaningful line.
 */
export const getDisplaySummary = (agent: AgentStatus): string => {
  // If we have real output, show the last line of it
  if (agent.lastOutput && agent.lastOutput.trim()) {
    // Get the last non-empty line from the output
    const lines = agent.lastOutput.trim().split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      return truncateText(lastLine);
    }
  }

  // Fall back to LLM-generated summary if no output yet
  if (agent.summary && agent.summary.trim()) {
    return truncateText(agent.summary);
  }

  // Default message when nothing is available
  return 'Starting...';
};

export const getStateColor = (state: AgentStatus['state']): string => {
  switch (state) {
    case 'starting':
      return 'yellow';
    case 'working':
      return 'green';
    case 'needs_input':
      return 'red';
    case 'done':
      return 'blue';
    case 'error':
      return 'gray';
    default:
      return 'white';
  }
};

export const AgentList: React.FC<AgentListProps> = ({ agents, focusedId, onSelectAgent }) => {
  if (agents.length === 0) {
    return <Text>No agents running</Text>;
  }

  return (
    <Box flexDirection="column">
      {agents.map((agent) => {
        const isFocused = agent.id === focusedId;
        return (
          <Box
            key={agent.id}
            flexDirection="column"
            borderStyle={isFocused ? 'double' : undefined}
          >
            <Text color={getStateColor(agent.state)}>{getStatusIndicator(agent.state)} {agent.id}</Text>
            <Text>{getDisplaySummary(agent)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
