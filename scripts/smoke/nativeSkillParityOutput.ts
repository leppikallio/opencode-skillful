export type JsonEvent = {
  type: string;
  part?: {
    text?: string;
  };
};

export function collectAssistantText(events: JsonEvent[]): string {
  return events
    .filter((e) => e.type === 'text')
    .map((e) => e.part?.text)
    .filter((t): t is string => typeof t === 'string')
    .join('');
}

export function lastNonEmptyLine(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.at(-1);
}
