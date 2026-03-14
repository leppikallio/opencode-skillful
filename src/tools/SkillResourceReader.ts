/**
 * SkillResourceReader Tool - Safe Skill Resource Access
 *
 * WHY: Skills contain bundled resources that need to be retrieved safely.
 * This tool resolves the requested resource through the registry-backed
 * resource resolver and returns a direct DTO for rendering/tool responses.
 *
 * CRITICAL SECURITY: Resources are pre-indexed at parse time. This tool can only
 * retrieve resources that were explicitly registered in the skill's resource maps.
 * It cannot request arbitrary paths like "../../etc/passwd".
 *
 * PATH NORMALIZATION:
 * - Incoming relative paths are normalized to forward slashes and stripped of
 *   leading separators before resolver lookup and before returning the DTO.
 *
 * RETURN VALUE: Direct SkillResourceInjection payload with:
 * - skill_name
 * - resource_path
 * - resource_mimetype
 * - content
 *
 * READY STATE: Must wait for registry initialization before accessing skills
 *
 * @param provider SkillRegistry instance (must be initialized first)
 * @returns Async function callable by OpenCode as skill_resource tool
 */

import { createSkillResourceResolver } from '../services/SkillResourceResolver.ts';
import type { SkillRegistry, SkillResourceInjection } from '../types.ts';

export function createSkillResourceReader(provider: SkillRegistry) {
  const skillResourceResolver = createSkillResourceResolver(provider);

  return async (args: {
    skill_name: string;
    relative_path: string;
  }): Promise<SkillResourceInjection> => {
    await provider.controller.ready.whenReady();

    const normalizedPath = args.relative_path.replace(/\\/g, '/').replace(/^\/+/, '');

    const resource = await skillResourceResolver({
      skill_name: args.skill_name,
      type: 'resource',
      relative_path: normalizedPath,
    });

    return {
      skill_name: args.skill_name,
      resource_path: normalizedPath,
      resource_mimetype: resource.mimeType,
      content: resource.content,
    };
  };
}
