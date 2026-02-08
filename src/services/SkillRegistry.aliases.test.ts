import { describe, expect, test } from 'bun:test';
import { createMockSkill } from '../mocks';
import { createSkillRegistry, createSkillRegistryController } from './SkillRegistry';

describe('SkillRegistry aliases', () => {
  test('resolves kebab and snake forms for discovered skills', async () => {
    const config = {
      basePaths: ['/skills'],
      debug: false,
      promptRenderer: 'xml' as const,
      modelRenderers: {},
    };

    const registry = await createSkillRegistry(config, console);
    await registry.initialise();

    const bySnake = registry.controller.get('test_skill');
    const byKebab = registry.controller.get('test-skill');
    const paiLower = registry.controller.get('pai');

    expect(bySnake).toBeDefined();
    expect(byKebab).toBeDefined();
    expect(bySnake?.toolName).toBe(byKebab?.toolName);
    expect(paiLower?.toolName).toBe('PAI');
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
