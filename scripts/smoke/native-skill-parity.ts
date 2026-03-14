import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { collectAssistantText, lastNonEmptyLine } from './nativeSkillParityOutput.ts';

const { Response } = globalThis;

type SmokeConfig = {
  opencodeHostPath: string;
  opencodeModel?: string;
  keepTempDir: boolean;
};

type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type JsonEvent = {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: {
    tool?: string;
    type?: string;
    text?: string;
    state?: {
      input?: unknown;
    };
  };
};

type ToolUseEvent = {
  tool: string;
  input: Record<string, unknown>;
};

function expandHome(inputPath: string): string {
  if (inputPath === '~') {
    return homedir();
  }
  if (inputPath.startsWith('~/')) {
    return path.join(homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function parseArgs(argv: string[]): { keepTempDir: boolean } {
  const keepTempDir = argv.includes('--keep-temp');
  return { keepTempDir };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function runOpencode(args: {
  opencodeHostPath: string;
  projectDir: string;
  model?: string;
  message: string;
}): Promise<RunResult> {
  const opencodeRootNodeModules = path.join(args.opencodeHostPath, 'node_modules');
  const bootstrapped = await Bun.file(opencodeRootNodeModules).exists();

  const baseArgs: string[] = ['run', '--format', 'json', '--dir', args.projectDir];
  if (args.model) {
    baseArgs.push('--model', args.model);
  }
  baseArgs.push(args.message);

  const proc = (() => {
    if (bootstrapped) {
      const opencodePkg = path.join(args.opencodeHostPath, 'packages', 'opencode');
      const entrypoint = path.join(opencodePkg, 'src', 'index.ts');
      return Bun.spawn(
        ['bun', 'run', '--cwd', opencodePkg, '--conditions=browser', entrypoint, ...baseArgs],
        {
          stdout: 'pipe',
          stderr: 'pipe',
          stdin: 'ignore',
          env: process.env,
        }
      );
    }

    // Fallback: use installed CLI from PATH.
    return Bun.spawn(['opencode', ...baseArgs], {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
      env: process.env,
    });
  })();

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}

function parseJsonLines(text: string): JsonEvent[] {
  const out: JsonEvent[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (parsed && typeof parsed === 'object') {
        out.push(parsed as JsonEvent);
      }
    } catch {
      // Ignore non-JSON lines to keep this usable across host changes.
      continue;
    }
  }
  return out;
}

function toolIds(events: JsonEvent[]): string[] {
  const tools: string[] = [];
  for (const e of events) {
    if (e.type !== 'tool_use') continue;
    const tool = e.part?.tool;
    if (typeof tool === 'string') {
      tools.push(tool);
    }
  }
  return tools;
}

function toolUseEvents(events: JsonEvent[]): ToolUseEvent[] {
  const out: ToolUseEvent[] = [];
  for (const e of events) {
    if (e.type !== 'tool_use') continue;
    const tool = e.part?.tool;
    const input = e.part?.state?.input;
    if (typeof tool !== 'string' || !input || typeof input !== 'object' || Array.isArray(input)) {
      continue;
    }
    out.push({ tool, input: input as Record<string, unknown> });
  }
  return out;
}

function assertExactKeys(
  input: Record<string, unknown>,
  expectedKeys: string[],
  label: string
): void {
  const actualKeys = Object.keys(input).sort();
  const wantedKeys = [...expectedKeys].sort();

  assert(
    JSON.stringify(actualKeys) === JSON.stringify(wantedKeys),
    `${label} expected keys ${JSON.stringify(wantedKeys)} but got ${JSON.stringify(actualKeys)}`
  );
}

async function main(): Promise<void> {
  const { keepTempDir } = parseArgs(process.argv.slice(2));

  const config: SmokeConfig = {
    opencodeHostPath: expandHome(process.env.OPENCODE_HOST_PATH ?? '~/Projects/opencode'),
    opencodeModel: process.env.OPENCODE_SMOKE_MODEL,
    keepTempDir,
  };

  const pluginEntrypoint = path.resolve(import.meta.dir, '../../src/index.ts');
  const pluginUrl = pathToFileURL(pluginEntrypoint).href;

  const skillName = 'smoke-native-skill-parity';
  const skillDescription = 'Smoke test skill for opencode-skillful native parity.';
  const resourceRelPath = 'references/guide.md';
  const resourceContent = 'native-skill-parity: OK';

  const tempRoot = await mkdtemp(path.join(tmpdir(), 'opencode-skillful-native-skill-parity-'));
  const projectDir = tempRoot;

  try {
    const opencodeJsoncPath = path.join(projectDir, '.opencode', 'opencode.jsonc');
    const skillDir = path.join(projectDir, '.opencode', 'skills', skillName);

    await mkdir(path.dirname(opencodeJsoncPath), { recursive: true });
    await writeFile(
      opencodeJsoncPath,
      JSON.stringify(
        {
          plugin: [pluginUrl],
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    await mkdir(path.join(skillDir, 'references'), { recursive: true });

    const skillMd = [
      '---',
      `name: ${skillName}`,
      `description: ${skillDescription}`,
      '---',
      '',
      '# Smoke Skill',
      '',
      'This skill exists only for the native-skill parity smoke test.',
      '',
      'Expected behavior:',
      '- The agent can find this skill via skill_find',
      '- The agent loads this skill via native skill name="..."',
      '- The agent reads references/guide.md via skill_resource',
      '',
    ].join('\n');

    await writeFile(path.join(skillDir, 'SKILL.md'), skillMd, 'utf8');
    await writeFile(path.join(skillDir, resourceRelPath), resourceContent + '\n', 'utf8');

    const message = [
      'Native-skill parity smoke test. Follow these steps exactly:',
      `1) Call tool skill_find with query "${skillName}".`,
      `2) Call tool skill with name "${skillName}" (NOT skill_use).`,
      `3) Call tool skill_resource with skill_name "${skillName}" and relative_path "${resourceRelPath}".`,
      '4) Reply with a final line exactly: OK',
    ].join('\n');

    const result = await runOpencode({
      opencodeHostPath: config.opencodeHostPath,
      projectDir,
      model: config.opencodeModel,
      message,
    });

    assert(
      result.exitCode === 0,
      [
        'OpenCode run failed.',
        `exitCode=${result.exitCode}`,
        config.opencodeModel ? `model=${config.opencodeModel}` : 'model=(default)',
        `opencodeHostPath=${config.opencodeHostPath}`,
        `projectDir=${projectDir}`,
        result.stderr.trim() ? `stderr:\n${result.stderr.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    );

    const events = parseJsonLines(result.stdout);
    const tools = toolIds(events);
    const toolEvents = toolUseEvents(events);
    const orderedTools = toolEvents.map((event) => event.tool);

    assert(tools.length === 3, `Expected exactly 3 tool_use events; got ${tools.length}`);
    assert(
      orderedTools.join(',') === 'skill_find,skill,skill_resource',
      `Expected tool order skill_find,skill,skill_resource; got: ${JSON.stringify(orderedTools)}`
    );
    assert(!tools.includes('skill_use'), 'Unexpected tool_use: skill_use (must be native skill)');

    const [findEvent, skillEvent, resourceEvent] = toolEvents;
    assertExactKeys(findEvent?.input ?? {}, ['query'], 'skill_find input');
    assert(
      findEvent?.input.query === skillName,
      'Expected skill_find query to match smoke skill name'
    );
    assertExactKeys(skillEvent?.input ?? {}, ['name'], 'skill input');
    assert(
      skillEvent?.input.name === skillName,
      'Expected native skill() name to match smoke skill name'
    );
    assertExactKeys(
      resourceEvent?.input ?? {},
      ['relative_path', 'skill_name'],
      'skill_resource input'
    );
    assert(
      resourceEvent?.input.skill_name === skillName &&
        resourceEvent?.input.relative_path === resourceRelPath,
      'Expected skill_resource input to match smoke skill name and resource path'
    );

    const assistantOutput = collectAssistantText(events).trim();
    assert(
      assistantOutput.length > 0,
      'Expected at least 1 assistant text event (assistant output was empty)'
    );

    const finalText = lastNonEmptyLine(assistantOutput);
    assert(
      finalText === 'OK',
      `Expected assistant final non-empty line 'OK'; got: ${JSON.stringify(finalText)}`
    );

    process.stdout.write('OK\n');
  } finally {
    if (!config.keepTempDir) {
      await rm(projectDir, { recursive: true, force: true });
    } else {
      process.stderr.write(`Keeping temp project dir: ${projectDir}\n`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[ERROR] ${message}\n`);
  process.exit(1);
});
