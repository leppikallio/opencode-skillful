import { describe, expect, test } from 'bun:test';
import '../mocks.skillfs';
import { createSkillResourceResolver } from './SkillResourceResolver';
import { createSkillRegistry } from './SkillRegistry';

/**
 * Unit tests for SkillResourceResolver service
 * Tests resource path resolution and file loading with memfs
 */

describe('SkillResourceResolver', () => {
  async function createMockResolver() {
    const config = {
      basePaths: ['/skills', '/place/that/doesnt/exist'],
      debug: false,
      promptRenderer: 'xml' as const,
      modelRenderers: {},
    };
    const registry = await createSkillRegistry(config, console);
    await registry.initialise();
    return createSkillResourceResolver(registry);
  }

  describe('resolveSkillResource', () => {
    /**
     * Test: Successfully read reference type resources from memfs
     *
     * - Setup mock resolver with in-memory file system
     * - Request a reference resource from a test skill
     * - Verify the content matches expected data
     *
     * @note relative references to resource files must
     * be relative to the SKILL.md location
     */
    test('should successfully read reference type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'reference',
        relative_path: 'references/guide.md',
      });
      expect(resource.content).toBe('# Guide\nThis is a guide.');
    });

    test('should successfully read script type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'script',
        relative_path: 'scripts/build.sh',
      });
      expect(resource.content).toBe('#!/bin/bash\necho "Building..."');
    });

    test('should successfully read asset type resources from memfs', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'test_skill',
        type: 'asset',
        relative_path: 'assets/logo.svg',
      });
      expect(resource.content).toBe('<svg></svg>');
      expect(resource.mimeType).toBe('image/svg+xml');
    });

    test('should handle skill not found error', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'nonexistent-skill',
          type: 'reference',
          relative_path: 'references/guide.md',
        })
      ).rejects.toThrow(/Skill not found/i);
    });

    test('should prevent path traversal attempts with ../', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: '../../../etc/passwd',
        })
      ).rejects.toThrow(/Resource not found/i);
    });

    test('should prevent multiple path traversal escape attempts', async () => {
      const resolver = await createMockResolver();
      const traversalAttempts = ['../../../etc/passwd', '../../secrets.txt', '../.ssh/id_rsa'];

      for (const attempt of traversalAttempts) {
        await expect(
          resolver({
            skill_name: 'test_skill',
            type: 'reference',
            relative_path: attempt,
          })
        ).rejects.toThrow(/Resource not found/i);
      }
    });

    test('should handle missing resource files with clear error', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: 'references/nonexistent.md',
        })
      ).rejects.toThrow(/Resource not found/i);
    });

    test('should safely handle absolute paths (normalized to skill dir)', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: '/etc/passwd',
        })
      ).rejects.toThrow(/Resource not found/i);
    });

    test('should validate that resolved path stays within skill boundary', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'test_skill',
          type: 'reference',
          relative_path: '../other-skill/file.md',
        })
      ).rejects.toThrow(/Resource not found/i);
    });

    test('should resolve workflow resources through unified map', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'phase_a_skill',
        type: 'workflow',
        relative_path: 'Onboarding.md',
      });

      expect(resource.content).toContain('# Canonical Phase A Onboarding');
      expect(resource.absolute_path).toContain('/phase-a-skill/Workflows/Onboarding.md');
    });

    test('should resolve tool resources through unified map', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'phase_a_skill',
        type: 'tool',
        relative_path: 'Runner.ts',
      });

      expect(resource.content).toContain('runner');
      expect(resource.absolute_path).toContain('/phase-a-skill/Tools/Runner.ts');
    });

    test('should resolve generic resource paths without explicit type', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'phase_a_skill',
        type: 'resource',
        relative_path: 'README.md',
      });

      expect(resource.content).toContain('# Canonical Phase A');
      expect(resource.absolute_path).toContain('/phase-a-skill/README.md');
    });

    test('should support direct full-path lookup when type carries path', async () => {
      const resolver = await createMockResolver();
      const resource = await resolver({
        skill_name: 'phase_a_skill',
        type: 'Workflows/Onboarding.md',
        relative_path: '',
      });

      expect(resource.absolute_path).toContain('/phase-a-skill/Workflows/Onboarding.md');
    });

    test('should resolve resources by canonical frontmatter name and legacy aliases', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'CanonicalPhaseA',
          type: 'workflow',
          relative_path: 'Onboarding.md',
        })
      ).resolves.toMatchObject({
        content: expect.stringContaining('# Canonical Phase A Onboarding'),
      });

      const legacy = await resolver({
        skill_name: 'phase_a_skill',
        type: 'workflow',
        relative_path: 'Onboarding.md',
      });

      expect(legacy.content).toContain('# Canonical Phase A Onboarding');
    });

    test('should resolve non-PAI skills by canonical frontmatter name', async () => {
      const resolver = await createMockResolver();

      await expect(
        resolver({
          skill_name: 'CanonicalSkill',
          type: 'reference',
          relative_path: 'references/guide.md',
        })
      ).resolves.toMatchObject({
        content: expect.stringContaining('This is canonical'),
      });
    });
  });
});
