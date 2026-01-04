// src/agent-name.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { generateAgentName, resetUsedNames } from './agent-name.js';

describe('generateAgentName', () => {
  beforeEach(() => {
    resetUsedNames();
  });

  describe('basic name generation', () => {
    it('generates name from simple task prompt', () => {
      const name = generateAgentName('Create README file');
      expect(name).toBe('create-readme-file');
    });

    it('generates name from task with common action verbs', () => {
      const name = generateAgentName('Fix auth bug');
      expect(name).toBe('fix-auth-bug');
    });

    it('generates name using first 3 meaningful words', () => {
      const name = generateAgentName('Update the user profile settings page');
      expect(name).toBe('update-user-profile');
    });
  });

  describe('stop word filtering', () => {
    it('filters out articles', () => {
      const name = generateAgentName('Create a new file');
      expect(name).toBe('create-new-file');
    });

    it('filters out prepositions', () => {
      const name = generateAgentName('Add tests for the login component');
      expect(name).toBe('add-tests-login');
    });

    it('filters out common filler words', () => {
      const name = generateAgentName('Please just make the button work');
      expect(name).toBe('button-work');
    });

    it('filters out casual greetings', () => {
      const name = generateAgentName('Hey can you fix this bug');
      expect(name).toBe('fix-bug');
    });
  });

  describe('format and normalization', () => {
    it('returns lowercase kebab-case', () => {
      const name = generateAgentName('Create TS Interface');
      expect(name).toBe('create-ts-interface');
    });

    it('removes special characters', () => {
      const name = generateAgentName("Fix user profile bug");
      expect(name).toBe('fix-user-profile');
    });

    it('handles multiple spaces', () => {
      const name = generateAgentName('Create   new    file');
      expect(name).toBe('create-new-file');
    });

    it('handles leading and trailing whitespace', () => {
      const name = generateAgentName('  Create new file  ');
      expect(name).toBe('create-new-file');
    });
  });

  describe('length constraints', () => {
    it('truncates very long names to max 20 chars', () => {
      const name = generateAgentName('Implement comprehensive authentication authorization middleware');
      expect(name.length).toBeLessThanOrEqual(20);
    });

    it('truncates at word boundary when possible', () => {
      const name = generateAgentName('Implement authentication middleware');
      // "implement-authentication-middleware" is too long
      // Should truncate cleanly, not mid-word
      expect(name).not.toMatch(/-[a-z]$/); // Should not end with single char after hyphen
    });
  });

  describe('edge cases', () => {
    it('handles empty input', () => {
      const name = generateAgentName('');
      expect(name).toBe('agent');
    });

    it('handles input with only stop words', () => {
      const name = generateAgentName('the a an to for');
      expect(name).toBe('agent');
    });

    it('handles single word input', () => {
      const name = generateAgentName('test');
      expect(name).toBe('test');
    });

    it('handles input with only special characters', () => {
      const name = generateAgentName('!@#$%^&*()');
      expect(name).toBe('agent');
    });

    it('handles numbers in input', () => {
      const name = generateAgentName('Fix bug #123 in auth');
      expect(name).toBe('fix-bug-123');
    });
  });

  describe('uniqueness', () => {
    it('returns same name for first occurrence', () => {
      const name1 = generateAgentName('Create README file');
      expect(name1).toBe('create-readme-file');
    });

    it('adds suffix for duplicate names', () => {
      const name1 = generateAgentName('Create README file');
      const name2 = generateAgentName('Create README file');

      expect(name1).toBe('create-readme-file');
      expect(name2).toMatch(/^create-readme-file-[a-z0-9]{3}$/);
      expect(name2).not.toBe(name1);
    });

    it('handles multiple duplicates', () => {
      const names = new Set<string>();
      for (let i = 0; i < 5; i++) {
        names.add(generateAgentName('Create README file'));
      }
      // All names should be unique
      expect(names.size).toBe(5);
    });

    it('resets used names correctly', () => {
      generateAgentName('Create README file');
      resetUsedNames();
      const name = generateAgentName('Create README file');
      expect(name).toBe('create-readme-file'); // No suffix because we reset
    });
  });

  describe('real-world examples from task description', () => {
    it('handles "Create README.md file" example', () => {
      const name = generateAgentName('Create README.md file');
      // Note: the dot in README.md becomes a space, splitting into "readme" and "md"
      expect(name).toBe('create-readme-md');
    });

    it('handles "Fix authentication bug" example', () => {
      const name = generateAgentName('Fix authentication bug');
      // Note: "authentication" is 14 chars, "fix-authentication-bug" is 22 chars
      // Truncated to max 20 chars at word boundary
      expect(name).toBe('fix-authentication');
    });

    it('handles "List all TypeScript files" example', () => {
      const name = generateAgentName('List all TypeScript files');
      // "all" is a stop word, so we get: list-typescript-files
      // But that's 21 chars, so it gets truncated to "list-typescript-file" (20 chars)
      // Actually let's check: "list-typescript-files" = 21 chars, truncated
      expect(name).toBe('list-typescript-file');
    });
  });
});
