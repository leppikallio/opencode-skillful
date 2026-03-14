/**
 * MdPromptRenderer Tests
 *
 * Test coverage for real use cases:
 * - Rendering SkillResource objects (file content)
 * - Rendering SkillSearchResults objects
 * - HTML character escaping for security
 * - Special values handling (null, undefined)
 */

import { describe, expect, it } from 'vitest';
import { createMdPromptRenderer } from './MdPromptRenderer.ts';

describe('MdPromptRenderer', () => {
  const renderer = createMdPromptRenderer();

  it('should have md format identifier', () => {
    expect(renderer.format).toBe('md');
  });

  it('should reject Skill objects (full-skill rendering removed)', () => {
    const skill = {
      name: 'git-workflows',
      fullPath: '/home/user/.opencode/skills/git-workflows',
      toolName: 'skill_git_workflows',
      description: 'Git workflow patterns and best practices',
      content: '# Git Workflows\n\n## Feature Branch Workflow\n\nStandard approach...',
      path: '/home/user/.opencode/skills/git-workflows/SKILL.md',
      scripts: new Map(),
      references: new Map(),
      assets: new Map(),
      metadata: { version: '1.0.0', author: 'Team' },
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
      content: 'REST Guidelines content here',
    };

    const result = renderer.render({ data, type: 'SkillResource' });

    expect(result).toContain('### skill_name\n- **skill_name**: *api-design*');
    expect(result).toContain(
      '### resource_path\n- **resource_path**: *references/rest-guidelines.md*'
    );
    expect(result).toContain('### resource_mimetype\n- **resource_mimetype**: *text/markdown*');
    expect(result).toContain('### content\n- **content**: *REST Guidelines content here*');

    // Lean contract: resource injection contains only these fields.
    expect(result).not.toContain('fullPath');
    expect(result).not.toContain('toolName');
    expect(result).not.toContain('scripts');
  });

  it('should render SkillSearchResults object', () => {
    const data = {
      query: 'authentication',
      skills: [
        { name: 'oauth-setup', description: 'OAuth implementation guide' },
        { name: 'jwt-patterns', description: 'JWT patterns and best practices' },
      ],
      summary: {
        total: 15,
        matches: 2,
        feedback: 'Found 2 skills matching "authentication"',
        usage_hint: 'Load with: skill name="oauth-setup"',
      },
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });

    expect(result).toContain('### query\n- **query**: *authentication*');
    expect(result).toContain('### skills');
    expect(result).toContain('- **name**: *oauth-setup*');
    expect(result).toContain('- **name**: *jwt-patterns*');
    expect(result).toContain('### summary');
    expect(result).toContain('- **matches**: *2*');

    // Lean contract: search results list only name + description.
    expect(result).not.toContain('fullPath');
    expect(result).not.toContain('toolName');
  });

  it('should preserve usage_hint in SkillSearchResults payload', () => {
    const data = {
      query: 'authentication',
      skills: [{ name: 'oauth-setup', description: 'OAuth implementation guide' }],
      summary: {
        total: 15,
        matches: 1,
        feedback: 'Found 1 skill matching "authentication"',
        usage_hint: 'Load with: skill name="oauth-setup"',
      },
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' } as unknown as Parameters<
      typeof renderer.render
    >[0]);

    expect(result).toContain('usage_hint');
    expect(result).toContain('Load with: skill name=&quot;oauth-setup&quot;');
  });

  it('should HTML-escape special characters for security', () => {
    const data = {
      skill_name: 'xss-test',
      resource_path: 'test.md',
      resource_mimetype: 'text/markdown',
      content: '<script>alert("xss")</script> & dangerous',
    };

    const result = renderer.render({ data, type: 'SkillResource' });

    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&amp;');
    expect(result).not.toContain('<script>');
  });

  it('should skip null and undefined values in search results', () => {
    const data = {
      query: 'test',
      skills: [{ name: 'skill1', description: 'Test skill' }],
      summary: {
        total: 10,
        matches: 1,
        feedback: 'Found 1 skill',
        usage_hint: 'Load with: skill name="skill1"',
      },
      debug: undefined,
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });

    expect(result).toContain('skill1');
    expect(result).toContain('Found 1 skill');
    expect(result).not.toContain('debug');
  });

  it('should omit undefined optional fields from SkillSearchResults output', () => {
    const data = {
      query: 'test',
      skills: [{ name: 'skill1', description: 'Test skill' }],
      summary: {
        total: 10,
        matches: 1,
        feedback: 'Found 1 skill',
        usage_hint: 'Load with: skill name="skill1"',
      },
      debug: undefined,
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });

    expect(result).not.toContain('debug');
  });
});
