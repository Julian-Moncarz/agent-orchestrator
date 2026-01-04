// src/agent-name.ts

/**
 * Common stop words that don't add meaning to agent names
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although',
  'this', 'that', 'these', 'those', 'it', 'its', 'my', 'your', 'our',
  'their', 'his', 'her', 'me', 'you', 'us', 'them', 'him',
  'please', 'hey', 'hi', 'hello', 'thanks', 'ok', 'okay',
  'want', 'like', 'get', 'make', 'put', 'go', 'going',
]);

/**
 * Maximum length for the generated agent name (excluding suffix)
 */
const MAX_NAME_LENGTH = 20;

/**
 * Number of meaningful words to extract from the task prompt
 */
const WORDS_TO_EXTRACT = 3;

/**
 * Set to track generated names within the current session for uniqueness
 */
const usedNames = new Set<string>();

/**
 * Reset the used names set (useful for testing)
 */
export function resetUsedNames(): void {
  usedNames.clear();
}

/**
 * Extract meaningful words from a task prompt
 */
function extractMeaningfulWords(prompt: string): string[] {
  // Normalize: lowercase and remove special characters except hyphens
  const normalized = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  // Split into words and filter out stop words and short words
  const words = normalized
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));

  return words;
}

/**
 * Generate a short, unique suffix for name uniqueness
 */
function generateSuffix(): string {
  return Math.random().toString(36).slice(2, 5);
}

/**
 * Generate a descriptive agent name from a task prompt.
 *
 * Examples:
 * - "Create README.md file" → "readme-file"
 * - "Fix authentication bug" → "fix-auth-bug"
 * - "List all TypeScript files" → "list-typescript-files"
 *
 * @param taskPrompt The task description to derive the name from
 * @returns A kebab-case agent name, max ~20 chars
 */
export function generateAgentName(taskPrompt: string): string {
  const words = extractMeaningfulWords(taskPrompt);

  // Take first N meaningful words
  let nameWords = words.slice(0, WORDS_TO_EXTRACT);

  // If no meaningful words found, use a fallback
  if (nameWords.length === 0) {
    nameWords = ['agent'];
  }

  // Join with hyphens to create kebab-case name
  let baseName = nameWords.join('-');

  // Truncate if too long
  if (baseName.length > MAX_NAME_LENGTH) {
    baseName = baseName.slice(0, MAX_NAME_LENGTH);
    // Clean up if we cut in the middle of a word
    const lastHyphen = baseName.lastIndexOf('-');
    if (lastHyphen > 0 && baseName.length - lastHyphen < 3) {
      baseName = baseName.slice(0, lastHyphen);
    }
  }

  // Check for uniqueness and add suffix if needed
  let finalName = baseName;
  if (usedNames.has(finalName)) {
    finalName = `${baseName}-${generateSuffix()}`;
  }

  // Register the name as used
  usedNames.add(finalName);

  return finalName;
}
