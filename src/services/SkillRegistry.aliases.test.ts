import { describe, expect, test } from 'bun:test';
import '../mocks.skillfs';
import { createMockSkill } from '../mocks';
import { createSkillRegistry, createSkillRegistryController } from './SkillRegistry';

describe('SkillRegistry aliases', () => {
  async function createRegistry(debug: boolean = false) {
    const config = {
      basePaths: ['/skills'],
      debug,
      promptRenderer: 'xml' as const,
      modelRenderers: {},
    };

    const registry = await createSkillRegistry(config, console);
    await registry.initialise();
    return registry;
  }

  test('resolves kebab and snake forms for discovered skills', async () => {
    const registry = await createRegistry();

    const bySnake = registry.controller.get('test_skill');
    const byKebab = registry.controller.get('test-skill');
    const phaseBySnake = registry.controller.get('phase_a_skill');
    const phaseByKebab = registry.controller.get('phase-a-skill');

    expect(bySnake).toBeDefined();
    expect(byKebab).toBeDefined();
    expect(bySnake?.toolName).toBe(byKebab?.toolName);

    expect(phaseBySnake).toBeDefined();
    expect(phaseByKebab).toBeDefined();
    expect(phaseBySnake?.toolName).toBe(phaseByKebab?.toolName);
  });

  test('fails clearly during initialise on canonical-name collisions (case-insensitive)', async () => {
    const registry = await createRegistry(true);
    const combined = (registry.debug?.errors ?? []).join('\n');

    expect(registry.debug).toBeDefined();
    expect(registry.debug?.discovered).toBeGreaterThan(0);
    expect(combined).toContain('CollisionSkill');
    expect(combined).toContain('collisionskill');
    expect(registry.debug?.rejected).toBeGreaterThan(0);
    expect(registry.debug?.parsed).toBeLessThan(registry.debug?.discovered ?? 0);
  });

  test('throws on alias collisions to avoid silent shadowing', () => {
    const controller = createSkillRegistryController();

    controller.set(
      'foo_bar',
      createMockSkill({
        name: 'foo-bar',
        toolName: 'foo_bar',
      })
    );

    expect(() =>
      controller.set(
        'foo-bar',
        createMockSkill({
          name: 'foo-bar-v2',
          toolName: 'foo-bar',
        })
      )
    ).toThrow('[AliasCollision]');
  });
});
