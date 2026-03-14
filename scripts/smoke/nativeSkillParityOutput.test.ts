import { describe, expect, it } from 'vitest';

import {
  collectAssistantText,
  lastNonEmptyLine,
  type JsonEvent,
} from './nativeSkillParityOutput.ts';

describe('native skill parity smoke output parsing', () => {
  it('accepts PAI header as long as final line is OK', () => {
    const events: JsonEvent[] = [
      { type: 'text', part: { text: '♻︎ Entering the PAI ALGORITHM…\n' } },
      { type: 'text', part: { text: '...lots of content...\n\nOK\n' } },
    ];

    const out = collectAssistantText(events);
    expect(lastNonEmptyLine(out)).toBe('OK');
  });

  it('returns undefined for empty or whitespace-only output', () => {
    expect(lastNonEmptyLine('')).toBeUndefined();
    expect(lastNonEmptyLine('\n\n   \n')).toBeUndefined();
  });
});
