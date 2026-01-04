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

const truncateSummary = (summary: string, maxLength: number = 60): string => {
  if (summary.length <= maxLength) {
    return summary;
  }
  return summary.slice(0, maxLength - 3) + '...';
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
            <Text>{truncateSummary(agent.summary)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};
