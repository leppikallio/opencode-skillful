/* eslint-disable no-console */
import { mock } from 'bun:test';
import { Volume } from 'memfs';
import path from 'node:path';

const mockDebug: boolean = process.env.SKILLFS_MOCK_DEBUG === '1';
const debugLog = (...args: unknown[]) => {
  if (!mockDebug) {
    return;
  }

  console.log(...args);
};

mock.module('./lib/SkillFs.ts', async () => {
  const memdisk = Volume.fromJSON(
    {
      './test-skill/SKILL.md': `---
name: test_skill
description: Use this skill to test the mock file system during development.
---
#Test Skill
This is a test skill.
`,
      './test-skill/references/guide.md': '# Guide\nThis is a guide.',
      './test-skill/scripts/build.sh': '#!/bin/bash\necho "Building..."',
      './test-skill/assets/logo.svg': '<svg></svg>',
      './test-skill/Workflows/QuickStart.md': '# Quick Start\nDo this first.',
      './test-skill/Tools/Helper.ts': 'export const helper = true;\n',
      './test-skill/README.md': '# Test Skill\nRoot-level docs.',

      './legacy-skill/SKILL.md': `---
name: CanonicalSkill
description: Canonical name differs from directory basename for tests.
---
# Legacy Skill
This skill exists to test canonical identity behavior.
`,
      './legacy-skill/references/guide.md': '# Canonical Guide\nThis is canonical.',

      './phase-a-skill/SKILL.md': `---
name: CanonicalPhaseA
description: Canonical phase A skill for resource indexing and canonical lookups.
---
# Phase A Skill
This skill exists to test canonical resource indexing behavior.
`,
      './phase-a-skill/Workflows/Onboarding.md': '# Canonical Phase A Onboarding\n',
      './phase-a-skill/Tools/Runner.ts': 'export const runner = true;\n',
      './phase-a-skill/README.md': '# Canonical Phase A\n',
      './phase-a-skill/CoreStack.md': '# Core Stack\n',
      './phase-a-skill/SYSTEM/ARCHITECTURE.md': '# Architecture\n',
      './phase-a-skill/Components/10-intro.md': '# Intro\n',
      './phase-a-skill/USER/README.md': '# Sensitive user profile\n',
      './phase-a-skill/WORK/notes.md': '# Work scratch\n',
      './phase-a-skill/node_modules/fake/readme.md': '# Ignore me\n',

      './no-name-skill/SKILL.md': `---
description: Skill without frontmatter name uses directory basename.
---
# No Name Skill
This skill exists to test basename fallback.
`,
      './no-name-skill/references/guide.md': '# Fallback Guide\nThis is fallback.',

      './non-string-name-skill/SKILL.md': `---
name: 123
description: Non-string frontmatter name should not crash discovery.
---
# Non-string Name Skill
This skill exists to test a safe fallback.
`,

      './collision-one/SKILL.md': `---
name: CollisionSkill
description: First colliding canonical name for registry init test.
---
# Collision One
`,
      './collision-two/SKILL.md': `---
name: collisionskill
description: Second colliding canonical name differing by case only.
---
# Collision Two
`,
    },
    '/skills'
  );

  const readFile = async (filePath: string) => {
    const data = await memdisk.promises.readFile(filePath, { encoding: 'utf-8' });
    return data.toString();
  };

  return {
    // Override file system calls to use memfs
    doesPathExist: (filePath: string): boolean => {
      debugLog(`[MOCK] skillfs.doesPathExist`, filePath);
      return memdisk.existsSync(filePath);
    },

    /**
     * Find skill paths by searching for SKILL.md files
     * @param basePath Base directory to search
     * @returns Array of discovered skill paths
     *
     * @see {@link createDiscoveredSkillPath}
     * @see {@link SkillFs}
     */
    findSkillPaths: async (basePath: string) => {
      debugLog(`[MOCK] skillfs.findSkillPaths`, basePath);
      const results = await memdisk.promises.glob('**/SKILL.md', {
        cwd: basePath,
      });

      debugLog(`[MOCK] skillfs.findSkillPaths results:`, results);
      return results.map((relativePath) => path.join(basePath, relativePath));
    },
    // Override other FS-dependent functions as needed
    /**
     * List skill files in a given subdirectory
     * @param skillPath Path to the skill directory
     * @param subdirectory Subdirectory to list files from
     * @returns Array of file paths
     *
     * @see {@link SkillFs}
     */
    listSkillFiles: (skillPath: string, subdirectory: string): string[] => {
      debugLog(`[MOCK] skillfs.listSkillFiles`, skillPath, subdirectory);
      let results: string[] = [];
      try {
        results = memdisk.globSync('**/*', {
          cwd: `${skillPath}/${subdirectory}`,
        });
      } catch {
        return [];
      }

      return results.map((relativePath) => path.join(skillPath, subdirectory, relativePath));
    },

    /**
     * Read the content of a skill file
     * @param path Full path to the skill file
     * @returns File content as string
     *
     * @see {@link SkillFs}
     */
    readSkillFile: (filePath: string) => {
      debugLog(`[MOCK] skillfs.readSkillFile`, filePath);
      return readFile(filePath);
    },

    /**
     * Read a skill resource file
     * @param path Full path to the resource file
     * @returns File content as string
     *
     * @see {@link SkillFs}
     */
    readSkillResource: (filePath: string) => {
      debugLog(`[MOCK] skillfs.readSkillResource`, filePath);
      return readFile(filePath);
    },

    /**
     * Detect MIME type from file extension
     * @param filePath Path to the file
     * @returns MIME type string
     */
    detectMimeType: (filePath: string): string => {
      const ext = filePath.toLowerCase().split('.').pop() || '';

      const mimeTypes: Record<string, string> = {
        sh: 'application/x-sh',
        bash: 'application/x-sh',
        zsh: 'application/x-sh',
        py: 'text/x-python',
        js: 'application/javascript',
        ts: 'application/typescript',
        node: 'application/javascript',
        md: 'text/markdown',
        txt: 'text/plain',
        pdf: 'application/pdf',
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        json: 'application/json',
        yaml: 'application/yaml',
        yml: 'application/yaml',
        xml: 'application/xml',
        csv: 'text/csv',
        html: 'text/html',
        css: 'text/css',
      };

      return mimeTypes[ext] || 'application/octet-stream';
    },
  };
});

debugLog('[MOCK] skillfs.mock.ready');
