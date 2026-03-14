/**
 * SkillFinder Tool - Natural Language Skill Discovery
 *
 * WHY: This tool wraps SkillSearcher with ready-state synchronization.
 * Users call skill_find("git commits") to search for relevant skills.
 * The tool must block until the registry is fully initialized before searching.
 *
 * CRITICAL PATTERN: `await provider.controller.ready.whenReady()`
 * This line ensures that skill discovery has completed before we attempt to
 * search. Without this, early calls would search an empty registry.
 *
 * RETURN VALUE: Object with:
 * - query: original query for user reference
 * - skills: matched skills with canonical name and description
 * - summary: metadata (total skills, matches found, feedback message, usage hint)
 * - debug: registry debug info (only if enabled in config)
 *
 * TOOL REGISTRATION: This factory is called in api.ts like:
 *   findSkills: createSkillFinder(registry)
 * Which returns an async function that OpenCode registers as a tool.
 *
 * FEEDBACK: The feedback message explains the query interpretation to the user:
 *   "Searching for: **git commit** | Found 3 matches"
 *
 * @param provider SkillRegistry instance (must be initialized first)
 * @returns Async function callable by OpenCode as skill_find tool
 */

import type { SkillRegistry } from '../types.ts';

const escapeForDoubleQuotedHint = (value: string): string => {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

/**
 * Creates a tool function that searches for skills
 */
export function createSkillFinder(provider: SkillRegistry) {
  return async (args: { query: string | string[] }) => {
    await provider.controller.ready.whenReady();

    const result = provider.search(args.query);

    const skills = result.matches.map((skill) => ({
      name: skill.name,
      description: skill.description,
    }));

    const usageHint =
      skills.length > 0
        ? `Load with: skill name="${escapeForDoubleQuotedHint(skills[0].name)}"`
        : 'Load with: skill name="<skill-name>"';

    const response = {
      query: args.query,
      skills,
      summary: {
        total: provider.controller.skills.length,
        matches: result.totalMatches,
        feedback: result.feedback,
        usage_hint: usageHint,
      },
    };

    // Debug payload is opt-in (config.debug) to keep the outward contract lean.
    if (provider.config.debug) {
      return {
        ...response,
        debug: provider.debug,
      };
    }

    return response;
  };
}
