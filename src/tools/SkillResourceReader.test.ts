import { describe, expect, test } from 'bun:test';
import '../mocks.skillfs';
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

    expect(result.resource_path).toBe('references/guide.md');
    expect(result.content).toContain('# Guide');
  });

  test('reads workflow path via unified resources', async () => {
    const reader = await createReader();
    const result = await reader({
      skill_name: 'phase_a_skill',
      relative_path: 'Workflows/Onboarding.md',
    });

    expect(result.content).toContain('# Canonical Phase A Onboarding');
    expect(result.resource_mimetype).toBe('text/markdown');
  });

  test('normalizes windows-style paths', async () => {
    const reader = await createReader();
    const result = await reader({
      skill_name: 'phase_a_skill',
      relative_path: 'Workflows\\Onboarding.md',
    });

    expect(result.content).toContain('# Canonical Phase A Onboarding');
  });

  test('reads by canonical frontmatter name (skill_resource flow)', async () => {
    const reader = await createReader();

    const canonical = await reader({
      skill_name: 'CanonicalPhaseA',
      relative_path: 'Workflows/Onboarding.md',
    });

    const legacy = await reader({
      skill_name: 'phase_a_skill',
      relative_path: 'Workflows/Onboarding.md',
    });

    expect(canonical.content).toContain('# Canonical Phase A Onboarding');
    expect(legacy.content).toContain('# Canonical Phase A Onboarding');
  });

  test('reads by canonical frontmatter name for non-PAI skills too', async () => {
    const reader = await createReader();

    await expect(
      reader({
        skill_name: 'CanonicalSkill',
        relative_path: 'references/guide.md',
      })
    ).resolves.toMatchObject({
      content: expect.stringContaining('This is canonical'),
    });
  });
});
