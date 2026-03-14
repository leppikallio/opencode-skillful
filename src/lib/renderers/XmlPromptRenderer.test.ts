/**
 * XmlPromptRenderer Tests
 *
 * Test coverage for real use cases:
 * - Rendering SkillResource objects (file content)
 * - Rendering SkillSearchResults objects
 * - XML character escaping for security
 */

import { describe, expect, it } from 'vitest';
import { createXmlPromptRenderer } from './XmlPromptRenderer.ts';

describe('XmlPromptRenderer', () => {
  const renderer = createXmlPromptRenderer();

  it('should have xml format identifier', () => {
    expect(renderer.format).toBe('xml');
  });

  it('should reject Skill objects (full-skill rendering removed)', () => {
    const skill = {
      name: 'rest-api',
      fullPath: '/skills/rest-api',
      toolName: 'skill_rest_api',
      description: 'REST API design patterns',
      content: 'REST API patterns content',
      path: '/skills/rest-api/SKILL.md',
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
      skill_name: 'security-patterns',
      resource_path: 'references/owasp-guidelines.md',
      resource_mimetype: 'text/markdown',
      content: 'OWASP Top 10 security guidelines...',
    };

    const result = renderer.render({ data, type: 'SkillResource' });

    expect(result).toContain('<SkillResource>');
    expect(result).toContain('</SkillResource>');
    expect(result).toContain('<skill_name>security-patterns</skill_name>');
    expect(result).toContain('<resource_path>references/owasp-guidelines.md</resource_path>');
    expect(result).toContain('<content>OWASP Top 10 security guidelines...</content>');
  });

  it('should render SkillSearchResults object', () => {
    const data = {
      query: 'testing',
      skills: [
        { name: 'unit-testing', description: 'Unit testing best practices' },
        { name: 'integration-testing', description: 'Integration test patterns' },
      ],
      summary: {
        total: 20,
        matches: 2,
        feedback: 'Found 2 skills matching "testing"',
        usage_hint: 'Load with: skill name="unit-testing"',
      },
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });

    expect(result).toContain('<SkillSearchResults>');
    expect(result).toContain('</SkillSearchResults>');
    expect(result).toContain('<query>testing</query>');
    expect(result).toContain('<skills>');
    expect(result).toContain('<name>unit-testing</name>');
    expect(result).toContain('<name>integration-testing</name>');
    expect(result).toContain('<matches>2</matches>');

    // Contract: arrays are rendered as repeated elements (one <skills> per item).
    expect((result.match(/<skills>/g) ?? []).length).toBe(2);
  });

  it('should render usage_hint in SkillSearchResults summary', () => {
    const data = {
      query: 'testing',
      skills: [{ name: 'unit-testing', description: 'Unit testing best practices' }],
      summary: {
        total: 20,
        matches: 1,
        feedback: 'Found 1 skill matching "testing"',
        usage_hint: 'Load with: skill name="unit-testing"',
      },
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' } as unknown as Parameters<
      typeof renderer.render
    >[0]);

    expect(result).toContain('<usage_hint>');
    expect(result).toContain('Load with: skill name=&quot;unit-testing&quot;');
  });

  it('should escape special XML characters for security', () => {
    const data = {
      skill_name: 'dangerous-content',
      resource_path: 'test.md',
      resource_mimetype: 'text/markdown',
      content: 'Content with <tags> & ampersands "quoted"',
    };

    const result = renderer.render({ data, type: 'SkillResource' });

    expect(result).toContain('&lt;tags&gt;');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
    expect(result).not.toContain('<tags>');
  });

  it('should omit undefined optional fields from SkillSearchResults output', () => {
    const data = {
      query: 'testing',
      skills: [{ name: 'unit-testing', description: 'Unit testing best practices' }],
      summary: {
        total: 20,
        matches: 1,
        feedback: 'Found 1 skill matching "testing"',
        usage_hint: 'Load with: skill name="unit-testing"',
      },
      debug: undefined,
    };

    const result = renderer.render({ data, type: 'SkillSearchResults' });

    expect(result).not.toContain('<debug');
  });

  // Full Skill rendering was removed in favor of SkillResource + SkillSearchResults only.
});
