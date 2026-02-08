import { describe, test, expect } from 'bun:test';
import { createSkillRegistry } from './SkillRegistry';

describe('SkillRegistry Phase A resource indexing', () => {
  async function createRegistry() {
    const config = {
      basePaths: ['/skills'],
      debug: false,
      promptRenderer: 'xml' as const,
      modelRenderers: {},
    };

    const registry = await createSkillRegistry(config, console);
    await registry.initialise();
    return registry;
  }

  test('indexes Workflows, Tools, and root markdown docs for standard skills', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('test_skill');

    expect(skill).toBeDefined();
    expect(skill?.resources?.has('Workflows/QuickStart.md')).toBe(true);
    expect(skill?.resources?.has('Tools/Helper.ts')).toBe(true);
    expect(skill?.resources?.has('README.md')).toBe(true);
    expect(skill?.resources?.has('SKILL.md')).toBe(false);
  });

  test('adds PAI-specific SYSTEM and Components markdown resources', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('PAI');

    expect(skill).toBeDefined();
    expect(skill?.resources?.has('Workflows/Onboarding.md')).toBe(true);
    expect(skill?.resources?.has('Tools/Inference.ts')).toBe(true);
    expect(skill?.resources?.has('CoreStack.md')).toBe(true);
    expect(skill?.resources?.has('SYSTEM/PAISYSTEMARCHITECTURE.md')).toBe(true);
    expect(skill?.resources?.has('Components/10-intro.md')).toBe(true);
  });

  test('applies exclusion guardrails to indexed resources', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('PAI');

    expect(skill).toBeDefined();
    expect(skill?.resources?.has('USER/README.md')).toBe(false);
    expect(skill?.resources?.has('WORK/notes.md')).toBe(false);
    expect(skill?.resources?.has('node_modules/fake/readme.md')).toBe(false);
  });

  test('preserves legacy scripts/references/assets indexing', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('test_skill');

    expect(skill).toBeDefined();
    expect(skill?.scripts.has('scripts/build.sh')).toBe(true);
    expect(skill?.references.has('references/guide.md')).toBe(true);
    expect(skill?.assets.has('assets/logo.svg')).toBe(true);
  });
});
