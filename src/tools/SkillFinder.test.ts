import { describe, expect, it } from 'vitest';

import { createJsonPromptRenderer } from '../lib/renderers/JsonPromptRenderer.ts';
import { createReadyStateMachine } from '../lib/ReadyStateMachine.ts';
import { createSkillFinder } from './SkillFinder.ts';
import type { Skill, SkillRegistry, SkillSearchResult } from '../types.ts';

const createTestProvider = ({
  matchingSkill,
  onReady,
  debugEnabled,
  debugInfo,
}: {
  matchingSkill: Skill;
  onReady?: () => void;
  debugEnabled?: boolean;
  debugInfo?: SkillRegistry['debug'];
}): SkillRegistry => {
  const ready = createReadyStateMachine();
  ready.setStatus('ready');

  return {
    initialise: async () => {},
    config: {
      debug: debugEnabled ?? false,
      basePaths: [],
      promptRenderer: 'json',
    },
    register: async () => ({ discovered: 0, parsed: 0, rejected: 0, errors: [] }),
    controller: {
      ready: {
        ...ready,
        whenReady: async () => {
          onReady?.();
          await ready.whenReady();
        },
      },
      skills: [matchingSkill],
      ids: [matchingSkill.name],
      clear: () => {},
      delete: () => {},
      has: () => false,
      get: () => undefined,
      set: () => {},
    },
    isSkillPath: () => true,
    getToolnameFromSkillPath: () => matchingSkill.toolName,
    search: () =>
      ({
        matches: [matchingSkill],
        totalMatches: 1,
        totalSkills: 1,
        feedback: 'Found 1 match',
        query: {
          include: ['git', 'commit'],
          exclude: [],
          originalQuery: ['git', 'commit'],
          hasExclusions: false,
          termCount: 2,
        },
      }) satisfies SkillSearchResult,
    debug: debugInfo,
    logger: {
      log: () => {},
      debug: () => {},
      error: () => {},
      warn: () => {},
    },
  };
};

describe('SkillFinder outward contract (skill_find)', () => {
  it('returns native-facing skill identifier instead of legacy toolName', async () => {
    let whenReadyCalls: number = 0;

    const matchingSkill: Skill = {
      name: 'writing-git-commits',
      fullPath: '/skills/writing-git-commits',
      toolName: 'skills_writing_git_commits',
      description: 'Guidelines for writing effective git commit messages',
      content: '...',
      path: '/skills/writing-git-commits/SKILL.md',
      scripts: new Map(),
      references: new Map(),
      assets: new Map(),
    };

    const provider = createTestProvider({
      matchingSkill,
      onReady: () => {
        whenReadyCalls += 1;
      },
    });

    const skillFind = createSkillFinder(provider);
    const result = await skillFind({ query: 'git commit' });

    // Contract: tool should always block on registry readiness.
    expect(whenReadyCalls).toBe(1);

    // Contract: skills[].name should surface the native-facing identifier.
    expect(result.skills[0]?.name).toBe('writing-git-commits');
    expect(result.skills[0]?.name).not.toBe(matchingSkill.toolName);
  });

  it('returns compact native skill usage hint', async () => {
    const matchingSkill: Skill = {
      name: 'writing-git-commits',
      fullPath: '/skills/writing-git-commits',
      toolName: 'skills_writing_git_commits',
      description: 'Guidelines for writing effective git commit messages',
      content: '...',
      path: '/skills/writing-git-commits/SKILL.md',
      scripts: new Map(),
      references: new Map(),
      assets: new Map(),
    };

    const provider = createTestProvider({ matchingSkill });

    const skillFind = createSkillFinder(provider);
    const result = await skillFind({ query: 'git commit' });

    // Contract: results include compact next-step guidance for native loading.
    expect(result.summary).toMatchObject({
      usage_hint: 'Load with: skill name="writing-git-commits"',
    });
    const usageHint = (result.summary as unknown as { usage_hint: string }).usage_hint;
    expect(usageHint).not.toContain(matchingSkill.toolName);
    expect(usageHint).toContain(result.skills[0]?.name ?? '');

    // Renderer compatibility: usage guidance survives output rendering.
    const renderer = createJsonPromptRenderer();
    const rendered = renderer.render({ data: result, type: 'SkillSearchResults' });
    expect(rendered).toContain('usage_hint');

    const parsed = JSON.parse(rendered) as {
      SkillSearchResults: { summary: { usage_hint: string } };
    };
    expect(parsed.SkillSearchResults.summary.usage_hint).toContain(
      'skill name="writing-git-commits"'
    );
  });

  it('omits debug payload unless config.debug is enabled', async () => {
    const matchingSkill: Skill = {
      name: 'writing-git-commits',
      fullPath: '/skills/writing-git-commits',
      toolName: 'skills_writing_git_commits',
      description: 'Guidelines for writing effective git commit messages',
      content: '...',
      path: '/skills/writing-git-commits/SKILL.md',
      scripts: new Map(),
      references: new Map(),
      assets: new Map(),
    };

    const debugInfo = {
      discovered: 10,
      parsed: 9,
      rejected: 1,
      errors: ['[NOSKILLERROR] something failed'],
    };

    const providerDebugDisabled = createTestProvider({
      matchingSkill,
      debugEnabled: false,
      debugInfo,
    });

    const skillFindNoDebug = createSkillFinder(providerDebugDisabled);
    const resultNoDebug = await skillFindNoDebug({ query: 'git commit' });
    expect(resultNoDebug).not.toHaveProperty('debug');

    const providerDebugEnabled = createTestProvider({
      matchingSkill,
      debugEnabled: true,
      debugInfo,
    });

    const skillFindWithDebug = createSkillFinder(providerDebugEnabled);
    const resultWithDebug = await skillFindWithDebug({ query: 'git commit' });
    expect(resultWithDebug).toHaveProperty('debug');
    expect(resultWithDebug.debug).toEqual(debugInfo);
  });
});
