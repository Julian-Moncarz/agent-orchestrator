// src/components/App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AgentList } from './AgentList.js';
import { getStore, addAgent, updateAgentStatus, appendAgentOutput, setFocusedAgent } from '../store.js';
import { cleanInput } from '../input-cleaner.js';
import { detectStatus } from '../status-detector.js';
import { spawnAgent } from '../adapters/index.js';
import { AgentStatus } from '../types.js';

const STATUS_REFRESH_INTERVAL = 3000; // 3 seconds

export const App: React.FC = () => {
  const { exit } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync agents from store
  const syncAgents = useCallback(() => {
    const store = getStore();
    const agentStatuses = Array.from(store.agents.values()).map((a) => a.status);
    setAgents(agentStatuses);
    setFocusedId(store.focusedAgentId);
  }, []);

  // Handle input submission
  const handleSubmit = useCallback(async (value: string) => {
    if (!value.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputValue('');

    try {
      const cleaned = await cleanInput(value);

      if (cleaned.clarificationNeeded) {
        // For MVP, just log clarification needed
        // In a full implementation, we'd show this to the user
        return;
      }

      // Spawn an agent for each task
      for (const task of cleaned.tasks) {
        const agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const config = {
          id: agentId,
          type: 'claude-code' as const,
          workingDirectory: process.cwd(),
          task: task.prompt,
          tools: task.suggestedTools,
        };

        const handle = spawnAgent(config);
        addAgent(config, handle);

        // Set up output handling
        handle.onOutput((chunk) => {
          appendAgentOutput(agentId, chunk);
        });

        handle.onExit(() => {
          updateAgentStatus(agentId, { state: 'done' });
          syncAgents();
        });
      }

      syncAgents();
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, syncAgents]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (focusedId) {
        // Unfocus current agent
        setFocusedAgent(null);
        syncAgents();
      } else {
        // Exit the app
        exit();
      }
    }
  });

  // Periodic status refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      const store = getStore();
      for (const [id, agent] of store.agents) {
        if (agent.status.state === 'working' || agent.status.state === 'starting') {
          try {
            const newStatus = await detectStatus(id, agent.outputBuffer);
            updateAgentStatus(id, newStatus);
          } catch {
            // Ignore detection errors
          }
        }
      }
      syncAgents();
    }, STATUS_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [syncAgents]);

  // Initial sync
  useEffect(() => {
    syncAgents();
  }, [syncAgents]);

  // Handle agent selection
  const handleSelectAgent = useCallback((id: string) => {
    setFocusedAgent(id);
    syncAgents();
  }, [syncAgents]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Agent Orchestrator</Text>
      <Text dimColor>ESC to exit | Enter to submit task</Text>

      <Box marginTop={1}>
        <Text>&gt; </Text>
        <TextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={isProcessing ? 'Processing...' : 'Enter task...'}
        />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <AgentList
          agents={agents}
          focusedId={focusedId}
          onSelectAgent={handleSelectAgent}
        />
      </Box>
    </Box>
  );
};
