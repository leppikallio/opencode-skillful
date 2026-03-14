import { describe, expect, test } from 'bun:test';
import '../mocks.skillfs';
import { stripLeadingHtmlCommentBlocks } from './SkillRegistry';
import { createSkillRegistry } from './SkillRegistry';

describe('stripLeadingHtmlCommentBlocks', () => {
  test('strips a generated comment banner before frontmatter', () => {
    const input = `<!--\nGenerated banner\n-->\n---\nname: demo\ndescription: A sufficiently long demo description.\n---\n# Skill`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output.startsWith('---\nname: demo')).toBe(true);
  });

  test('strips multiple leading comment blocks', () => {
    const input = `<!-- one -->\n\n<!-- two -->\n---\nname: demo\ndescription: A sufficiently long demo description.\n---`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output.startsWith('---\nname: demo')).toBe(true);
  });

  test('removes UTF-8 BOM before frontmatter', () => {
    const input = `\uFEFF---\nname: demo\ndescription: A sufficiently long demo description.\n---`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output.startsWith('---\nname: demo')).toBe(true);
  });

  test('does not alter non-comment leading content', () => {
    const input = `# Intro\n---\nname: demo\ndescription: A sufficiently long demo description.\n---`;

    const output = stripLeadingHtmlCommentBlocks(input);

    expect(output).toBe(input);
  });
});

describe('SkillRegistry frontmatter identity (TDD)', () => {
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

  test('uses frontmatter name as outward-facing skill.name when present', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('phase_a_skill');

    expect(skill).toBeDefined();
    expect(skill?.name).toBe('CanonicalPhaseA');
  });

  test('resolves by frontmatter canonical name when present', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('CanonicalPhaseA');

    expect(skill).toBeDefined();
    expect(skill?.toolName).toBe('phase_a_skill');
  });

  test('uses directory basename when frontmatter name is absent', async () => {
    const registry = await createRegistry();
    const byKebab = registry.controller.get('no-name-skill');
    const bySnake = registry.controller.get('no_name_skill');

    expect(byKebab).toBeDefined();
    expect(bySnake).toBeDefined();
    expect(byKebab?.name).toBe('no-name-skill');
    expect(byKebab?.toolName).toBe(bySnake?.toolName);
  });

  test('ignores non-string frontmatter name and falls back to directory basename', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('non-string-name-skill');

    expect(skill).toBeDefined();
    expect(skill?.name).toBe('non-string-name-skill');
  });

  test('resolves by frontmatter name for other skills too', async () => {
    const registry = await createRegistry();
    const skill = registry.controller.get('CanonicalSkill');

    expect(skill).toBeDefined();
    expect(skill?.toolName).toBe('legacy_skill');
  });
});
