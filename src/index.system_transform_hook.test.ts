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

describe('Plugin hook surface contract', () => {
  it('exposes system-transform hook that injects compact native-first guidance', async () => {
    const { SkillsPlugin } = await import('./index.ts');
    const plugin = await SkillsPlugin({} as never);

    const hook = (plugin as unknown as Record<string, unknown>)[
      'experimental.chat.system.transform'
    ];

    expect(hook).toBeTypeOf('function');

    const output = { system: [] as string[] };
    await (hook as (input: unknown, output: { system: string[] }) => Promise<void>)({}, output);

    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toContain('skill_find');
    expect(output.system[0]).toContain('skill_resource');
    expect(output.system[0]).not.toContain('skill_use');
    expect(output.system[0].length).toBeLessThanOrEqual(280);
  });

  it('does not duplicate native guidance when hook is applied twice', async () => {
    const { SkillsPlugin } = await import('./index.ts');
    const plugin = await SkillsPlugin({} as never);

    const hook = (plugin as unknown as Record<string, unknown>)[
      'experimental.chat.system.transform'
    ];
    expect(hook).toBeTypeOf('function');

    const output = { system: [] as string[] };

    await (hook as (input: unknown, output: { system: string[] }) => Promise<void>)({}, output);
    await (hook as (input: unknown, output: { system: string[] }) => Promise<void>)({}, output);

    expect(output.system).toHaveLength(1);
  });

  it('native guidance avoids permission-sensitive or destructive instructions', async () => {
    const { getNativeSkillGuidanceText } = await import('./lib/nativeSkillGuidance.ts');
    const guidance = getNativeSkillGuidanceText();

    expect(guidance).not.toContain('skill_use');
    expect(guidance).not.toContain('sudo');
    expect(guidance).not.toContain('rm -rf');
    expect(guidance).not.toContain('git push');
  });

  it('keeps hook compatibility fixture idempotent', async () => {
    const { hookCompatibilityFixture } = await import('./pluginHooksCompatibility.ts');
    const hook = hookCompatibilityFixture['experimental.chat.system.transform'];
    expect(hook).toBeTypeOf('function');

    const output = { system: [] as string[] };
    await (hook as (input: unknown, output: { system: string[] }) => Promise<void>)({}, output);
    await (hook as (input: unknown, output: { system: string[] }) => Promise<void>)({}, output);

    expect(output.system).toHaveLength(1);
  });
});
