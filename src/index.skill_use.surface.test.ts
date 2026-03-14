import type { ToolContext } from '@opencode-ai/plugin';

import { describe, expect, it, vi } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';

vi.mock('./config.ts', () => {
  const getOpenCodeConfigPaths = (): string[] => {
    const home = homedir();
    const paths: string[] = [];

    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
      paths.push(join(xdgConfig, 'opencode'));
    }

    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        paths.push(join(localAppData, 'opencode'));
      }
      paths.push(join(home, '.config', 'opencode'));
    } else {
      paths.push(join(home, '.config', 'opencode'));
    }

    paths.push(join(home, '.opencode'));
    return paths;
  };

  const expandTildePath = (path: string): string => {
    if (path === '~') {
      return homedir();
    }
    if (path.startsWith('~/')) {
      return join(homedir(), path.slice(2));
    }
    return path;
  };

  return {
    expandTildePath,
    getOpenCodeConfigPaths,
    getPluginConfig: async () => ({
      basePaths: [],
      debug: false,
      promptRenderer: 'xml' as const,
      modelRenderers: {},
    }),
  };
});

vi.mock('./api.ts', () => {
  return {
    createApi: async () => ({
      registry: {
        initialise: async () => {},
      },
      findSkills: async () => ({ skills: [], summary: {} }),
      readResource: async (args: { skill_name: string; relative_path: string }) => ({
        skill_name: args.skill_name,
        resource_path: args.relative_path,
        resource_mimetype: 'text/plain',
        content: 'hello',
      }),
    }),
  };
});

vi.mock('./lib/createPromptRenderer.ts', () => {
  return {
    createPromptRenderer: () => {
      const render = (payload: { data: unknown; type: string }) => JSON.stringify(payload);
      const formatters: Record<'json' | 'xml' | 'md', typeof render> = {
        json: render,
        xml: render,
        md: render,
      };

      return {
        getFormatter: (format: 'json' | 'xml' | 'md') => {
          const formatter = formatters[format];
          if (!formatter) {
            throw new Error(`Unsupported format: ${format}`);
          }
          return formatter;
        },
      };
    },
  };
});

vi.mock('./services/MessageModelIdAccountant.ts', () => {
  return {
    createMessageModelIdAccountant: () => ({
      track: () => {},
      getModelInfo: () => undefined,
      untrackMessage: () => {},
      untrackSession: () => {},
    }),
  };
});

vi.mock('./lib/getModelFormat.ts', () => {
  return {
    getModelFormat: () => 'xml',
  };
});

describe('Plugin tool surface contract', () => {
  it('does not expose skill_use tool', async () => {
    const { SkillsPlugin } = await import('./index.ts');

    const plugin = await SkillsPlugin({} as never);
    expect(plugin.tool).not.toHaveProperty('skill_use');
  });

  it('skill_resource returns rendered payload directly and no longer depends on OpenCodeChat', async () => {
    const { SkillsPlugin } = await import('./index.ts');

    const plugin = await SkillsPlugin({} as never);

    expect(plugin.tool).toBeDefined();
    if (!plugin.tool) {
      throw new Error('plugin.tool missing');
    }

    const args = {
      skill_name: 'test-skill',
      relative_path: 'references/guide.md',
    };

    const expectedResult = {
      skill_name: args.skill_name,
      resource_path: args.relative_path,
      resource_mimetype: 'text/plain',
      content: 'hello',
    };

    const output = await plugin.tool.skill_resource.execute(args, {
      messageID: 'm-1',
      sessionID: 's-1',
    } as unknown as ToolContext);

    expect(JSON.parse(output)).toEqual({
      type: 'SkillResource',
      data: expectedResult,
    });
  });
});
