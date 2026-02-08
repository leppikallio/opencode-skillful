import { describe, expect, test } from 'bun:test';
import { createSkillRegistry } from '../services/SkillRegistry';
import { createSkillResourceReader } from './SkillResourceReader';

describe('SkillResourceReader', () => {
  async function createReader() {
    const config = {
      basePaths: ['/skills', '/place/that/doesnt/exist'],
      debug: false,
      promptRenderer: 'xml' as const,
      modelRenderers: {},
    };

    const registry = await createSkillRegistry(config, console);
    await registry.initialise();
    return createSkillResourceReader(registry);
  }

  test('reads legacy reference paths', async () => {
    const reader = await createReader();
    const result = await reader({
      skill_name: 'test_skill',
      relative_path: 'references/guide.md',
    });

    expect(result.injection.resource_path).toBe('references/guide.md');
    expect(result.injection.content).toContain('# Guide');
  });

  test('reads PAI workflow path via unified resources', async () => {
    const reader = await createReader();
    const result = await reader({
      skill_name: 'PAI',
      relative_path: 'Workflows/Onboarding.md',
    });

    expect(result.injection.content).toContain('# Onboarding');
    expect(result.injection.resource_mimetype).toBe('text/markdown');
  });

  test('normalizes windows-style paths', async () => {
    const reader = await createReader();
    const result = await reader({
      skill_name: 'PAI',
      relative_path: 'Workflows\\Onboarding.md',
    });

    expect(result.injection.content).toContain('# Onboarding');
  });
});
