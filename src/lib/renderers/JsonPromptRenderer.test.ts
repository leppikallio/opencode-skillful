/**
 * JsonPromptRenderer Tests
 *
 * Test coverage for real use cases:
 * - Rendering SkillResource objects (file content)
 * - Rendering SkillSearchResults objects (search results)
 * - Proper JSON formatting with indentation
 */

import { describe, expect, it } from 'vitest';
import { createJsonPromptRenderer } from './JsonPromptRenderer.ts';

describe('JsonPromptRenderer', () => {
  const renderer = createJsonPromptRenderer();

  it('should have json format identifier', () => {
    expect(renderer.format).toBe('json');
  });

  it('should reject Skill objects (full-skill rendering removed)', () => {
    const skill = {
      name: 'auth-patterns',
      fullPath: '/home/user/.opencode/skills/auth-patterns',
      toolName: 'skill_auth_patterns',
      description: 'Common authentication patterns and best practices',
      content: '# Authentication Patterns\n\nStandard approaches...',
      path: '/home/user/.opencode/skills/auth-patterns/SKILL.md',
      scripts: new Map(),
      references: new Map(),
      assets: new Map(),
    };

    expect(() =>
      renderer.render({ data: skill, type: 'Skill' } as unknown as Parameters<
        typeof renderer.render
      >[0])
    ).toThrow(/Unsupported render type/);
  });

  it('should render SkillResource object (file content)', () => {
    const data = {
      skill_name: 'api-design',
      resource_path: 'references/rest-guidelines.md',
      resource_mimetype: 'text/markdown',
      content: '# REST API Guidelines\n\n## Best Practices\n\n...',
    };

    const result = renderer.render({ data, type: 'SkillResource' });

    expect(result).toBe(JSON.stringify({ SkillResource: data }, null, 2));

    const parsed = JSON.parse(result) as { SkillResource: typeof data };
    expect(parsed).toEqual({ SkillResource: data });
  });

  it('should render SkillSearchResults object', () => {
    const data = {
      query: 'authentication',
      skills: [
        { name: 'auth-patterns', description: 'Common auth patterns' },
        { name: 'oauth-setup', description: 'OAuth implementation guide' },
      ],
      summary: {
        total: 25,
        matches: 2,
        feedback: 'Found 2 skills matching "authentication"',
        usage_hint: 'Load with: skill name="auth-patterns"',
      },
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });

    expect(result).toBe(JSON.stringify({ SkillSearchResults: data }, null, 2));

    const parsed = JSON.parse(result) as { SkillSearchResults: typeof data };
    expect(parsed).toEqual({ SkillSearchResults: data });
  });

  it('should preserve usage_hint in SkillSearchResults payload', () => {
    const data = {
      query: 'authentication',
      skills: [{ name: 'auth-patterns', description: 'Common auth patterns' }],
      summary: {
        total: 25,
        matches: 1,
        feedback: 'Found 1 skill matching "authentication"',
        usage_hint: 'Load with: skill name="auth-patterns"',
      },
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' } as unknown as Parameters<
      typeof renderer.render
    >[0]);
    const parsed = JSON.parse(result) as {
      SkillSearchResults: { summary: { usage_hint: string } };
    };

    expect(result).toContain('"usage_hint"');
    expect(parsed.SkillSearchResults.summary.usage_hint).toBe(
      'Load with: skill name="auth-patterns"'
    );
  });

  it('should omit undefined optional fields from SkillSearchResults payload', () => {
    const data = {
      query: 'authentication',
      skills: [{ name: 'auth-patterns', description: 'Common auth patterns' }],
      summary: {
        total: 25,
        matches: 1,
        feedback: 'Found 1 skill matching "authentication"',
        usage_hint: 'Load with: skill name="auth-patterns"',
      },
      debug: undefined,
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });
    const parsed = JSON.parse(result) as {
      SkillSearchResults: { debug?: unknown };
    };

    expect(parsed.SkillSearchResults.debug).toBeUndefined();
    expect(result).not.toContain('"debug"');
  });
});
