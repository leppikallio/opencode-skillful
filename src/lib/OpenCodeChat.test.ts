import { describe, expect, test } from 'bun:test';

import { createInstructionInjector } from './OpenCodeChat';

type PromptArgs = {
  path: { id: string };
  body: {
    noReply: true;
    parts: Array<{ type: 'text'; text: string; synthetic?: true }>;
  };
};

type PromptFn = (payload: PromptArgs) => Promise<{ data: true }>;

type MinimalPluginInput = {
  client: {
    session: {
      prompt: PromptFn;
    };
  };
};

describe('createInstructionInjector', () => {
  test('injects noReply synthetic text part', async () => {
    const calls: PromptArgs[] = [];
    const prompt: PromptFn = async (payload) => {
      calls.push(payload);
      return { data: true };
    };

    const ctx: MinimalPluginInput = {
      client: {
        session: {
          prompt,
        },
      },
    };

    const inject = createInstructionInjector(
      ctx as unknown as Parameters<typeof createInstructionInjector>[0]
    );
    await inject('hello', { sessionId: 'ses_123' });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      path: { id: 'ses_123' },
      body: {
        noReply: true,
        parts: [{ type: 'text', text: 'hello', synthetic: true }],
      },
    });
  });
});
