/**
 * XmlPromptRenderer - Format objects as XML (current default)
 *
 * WHY: Claude models are trained extensively on XML and prefer structured
 * XML injection for skill metadata and search results. This maintains the
 * current behavior as the default and recommended format for Claude models.
 */

import type { PromptRenderer } from '../../types.ts';
import { jsonToXml } from '../xml.ts';

export const createXmlPromptRenderer = () => {
  const renderer: PromptRenderer = {
    format: 'xml' as const,

    render(args) {
      if (args.type === 'SkillResource') {
        return jsonToXml(args.data, 'SkillResource');
      }
      if (args.type === 'SkillSearchResults') {
        return jsonToXml(args.data, 'SkillSearchResults');
      }

      throw new Error('Unsupported render type');
    },
  };

  return renderer;
};
