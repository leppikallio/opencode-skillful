/**
 * JsonPromptRenderer - Format objects as JSON
 *
 * WHY: Some LLM models (especially GPT family) have strong JSON parsing
 * and prefer structured JSON data over XML for reliability and clarity.
 */

import type { PromptRenderer } from '../../types.ts';

export const createJsonPromptRenderer = (): PromptRenderer => {
  const renderer: PromptRenderer = {
    format: 'json' as const,
    render(args) {
      if (args.type === 'SkillResource' || args.type === 'SkillSearchResults') {
        return JSON.stringify({ [args.type]: args.data }, null, 2);
      }

      throw new Error('Unsupported render type');
    },
  };

  return renderer;
};
