import type { Hooks } from '@opencode-ai/plugin';

import { getNativeSkillGuidanceText } from './lib/nativeSkillGuidance';

export const hookCompatibilityFixture: Partial<Hooks> = {
  'experimental.chat.system.transform': async (_input, output) => {
    const guidance = getNativeSkillGuidanceText();
    if (!output.system.includes(guidance)) {
      output.system.push(guidance);
    }
  },
};
