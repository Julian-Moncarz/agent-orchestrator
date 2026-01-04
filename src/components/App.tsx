// src/components/App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AgentList } from './AgentList.js';
import { FocusedAgent } from './FocusedAgent.js';
import { getStore, addAgent, updateAgentStatus, appendAgentOutput, setFocusedAgent } from '../store.js';
import { cleanInput } from '../input-cleaner.js';
import { detectStatus } from '../status-detector.js';
import { spawnAgent } from '../adapters/index.js';
import { AgentStatus } from '../types.js';
import { logger } from '../logger.js';
import { generateAgentName } from '../agent-name.js';

const STATUS_REFRESH_INTERVAL = 3000; // 3 seconds

export const App: React.FC = () => {
  const { exit } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);

  // Sync agents from store
  const syncAgents = useCallback(() => {
    const store = getStore();
    const agentStatuses = Array.from(store.agents.values()).map((a) => a.status);
    setAgents(agentStatuses);
    setFocusedId(store.focusedAgentId);
  }, []);

  // Handle input submission
  const handleSubmit = useCallback(async (value: string) => {
    logger.info('app', 'input submitted', { value });

    if (!value.trim() || isProcessing) {
      logger.debug('app', 'ignoring submit', { empty: !value.trim(), isProcessing });
      return;
    }

    setIsProcessing(true);
    setInputValue('');
    setError(null);
    setClarification(null);

    try {
      const cleaned = await cleanInput(value);

      if (cleaned.clarificationNeeded) {
        logger.info('app', 'showing clarification to user', {
          clarification: cleaned.clarificationNeeded,
        });
        setClarification(cleaned.clarificationNeeded);
        return;
      }

      logger.info('app', 'spawning agents', { taskCount: cleaned.tasks.length });

      // Spawn an agent for each task
      for (const task of cleaned.tasks) {
        const agentId = generateAgentName(task.prompt);
        const config = {
          id: agentId,
          type: 'claude-code' as const,
          workingDirectory: process.cwd(),
          task: task.prompt,
          tools: task.suggestedTools,
        };

        logger.debug('app', 'spawning agent', { agentId, task: task.prompt });

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
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('app', 'handleSubmit failed', { error: errorMsg });
      setError(errorMsg);
    } finally {
      setIsProcessing(false);
      logger.debug('app', 'processing complete');
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

    // Handle number keys 1-9 for agent selection (only when not focused)
    if (!focusedId && input >= '1' && input <= '9') {
      const index = parseInt(input, 10) - 1; // Convert to 0-based index
      if (index < agents.length) {
        const agentId = agents[index].id;
        setFocusedAgent(agentId);
        syncAgents();
      }
    }
  });

  // Periodic status refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      const store = getStore();
      for (const [id, agent] of store.agents) {
        if (agent.status.state === 'working' || agent.status.state === 'starting') {
          // Skip status detection for agents with empty output buffers
          // This prevents the LLM from returning nonsense when there's nothing to analyze
          if (agent.outputBuffer.length === 0) {
            logger.debug('app', 'skipping status detection for empty buffer', { agentId: id });
            continue;
          }
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

  // Handle unfocusing agent
  const handleUnfocus = useCallback(() => {
    setFocusedAgent(null);
    syncAgents();
  }, [syncAgents]);

  // Get the focused agent's data if one is focused
  const getFocusedAgentData = useCallback(() => {
    if (!focusedId) return null;
    const store = getStore();
    return store.agents.get(focusedId);
  }, [focusedId]);

  const focusedAgentData = getFocusedAgentData();

  // Render focused view if an agent is focused
  if (focusedId && focusedAgentData) {
    return (
      <FocusedAgent
        id={focusedId}
        output={focusedAgentData.outputBuffer}
        status={focusedAgentData.status.state}
        onBack={handleUnfocus}
      />
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Agent Orchestrator</Text>
      <Text dimColor>ESC to exit | Enter to submit task | 1-9 to focus agent</Text>

      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {clarification && (
        <Box marginTop={1}>
          <Text color="yellow">Clarification needed: {clarification}</Text>
        </Box>
      )}

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
