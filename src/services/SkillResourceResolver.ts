import type { Skill, SkillRegistry } from '../types';

import { readSkillFile } from '../lib/SkillFs';

/**
 * Skill resources are mapped on startup as a dictionary of relative paths to resource metadata.
 *
 * This resolver uses that mapping to solve several things:
 *
 * - locate and read the actual resource files.
 * - ensure the requested path isn't outside the skill directory (security).
 * - return the content and mime type of the resource.
 */
export function createSkillResourceResolver(provider: SkillRegistry) {
  const toPosixPath = (value: string): string => value.replace(/\\/g, '/');

  const normalizeResourcePath = (value: string): string => {
    return toPosixPath(value).replace(/^\/+/, '').replace(/\/+$/, '');
  };

  const isUnsafeResourcePath = (value: string): boolean => {
    const normalized = normalizeResourcePath(value);
    if (!normalized) {
      return true;
    }

    // Absolute path attempts (unix/windows)
    if (value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) {
      return true;
    }

    const segments = normalized.split('/').filter(Boolean);
    return segments.includes('..');
  };

  const findInMap = (
    resourceMap: Skill['scripts'] | Skill['references'] | Skill['assets'] | Skill['resources'],
    candidates: string[]
  ) => {
    for (const candidate of candidates) {
      const normalized = normalizeResourcePath(candidate);
      if (!normalized) continue;

      const exact = resourceMap?.get(normalized);
      if (exact) {
        return exact;
      }
    }

    // Case-insensitive fallback (useful for folder capitalization like Workflows/)
    const lowered = new Map<string, { absolutePath: string; mimeType: string }>();
    for (const [key, value] of resourceMap?.entries() || []) {
      lowered.set(key.toLowerCase(), value);
    }

    for (const candidate of candidates) {
      const normalized = normalizeResourcePath(candidate).toLowerCase();
      if (!normalized) continue;

      const match = lowered.get(normalized);
      if (match) {
        return match;
      }
    }

    return undefined;
  };

  const legacyCandidates = (prefix: string, relativePath: string): string[] => {
    const normalized = normalizeResourcePath(relativePath);
    if (!normalized) {
      return [];
    }

    if (normalized.toLowerCase().startsWith(`${prefix.toLowerCase()}/`)) {
      return [normalized];
    }

    return [normalized, `${prefix}/${normalized}`];
  };

  const resolveLegacyResource = (skill: Skill, type: string, relativePath: string) => {
    const loweredType = type.toLowerCase();

    if (loweredType === 'script' || loweredType === 'scripts') {
      return findInMap(skill.scripts, legacyCandidates('scripts', relativePath));
    }

    if (loweredType === 'asset' || loweredType === 'assets') {
      return findInMap(skill.assets, legacyCandidates('assets', relativePath));
    }

    if (loweredType === 'reference' || loweredType === 'references') {
      return findInMap(skill.references, legacyCandidates('references', relativePath));
    }

    return undefined;
  };

  const resolveUnifiedResource = (skill: Skill, type: string, relativePath: string) => {
    const normalizedType = normalizeResourcePath(type);
    const normalizedRelative = normalizeResourcePath(relativePath);

    if (!skill.resources || skill.resources.size === 0) {
      return undefined;
    }

    const loweredType = normalizedType.toLowerCase();

    if (loweredType === 'workflow' || loweredType === 'workflows') {
      const candidates = [
        normalizedRelative,
        normalizedRelative ? `Workflows/${normalizedRelative}` : 'Workflows',
      ];
      return findInMap(skill.resources, candidates);
    }

    if (loweredType === 'tool' || loweredType === 'tools') {
      const candidates = [normalizedRelative, normalizedRelative ? `Tools/${normalizedRelative}` : 'Tools'];
      return findInMap(skill.resources, candidates);
    }

    // Generic lookup: relative_path is already full path inside skill
    if (
      loweredType === 'resource' ||
      loweredType === 'resources' ||
      loweredType === '' ||
      loweredType === 'doc' ||
      loweredType === 'docs'
    ) {
      const candidates = [normalizedRelative];

      // legacy-compat inside unified map
      if (!normalizedRelative.toLowerCase().startsWith('workflows/')) {
        candidates.push(`Workflows/${normalizedRelative}`);
      }
      if (!normalizedRelative.toLowerCase().startsWith('tools/')) {
        candidates.push(`Tools/${normalizedRelative}`);
      }

      return findInMap(skill.resources, candidates);
    }

    // Type-prefixed lookup (e.g. type=Workflows, relative=Onboarding.md)
    const typedPath = normalizedRelative
      ? `${normalizedType}/${normalizedRelative}`
      : normalizedType;
    return findInMap(skill.resources, [typedPath, normalizedRelative]);
  };

  return async (args: {
    skill_name: string;
    type: string;
    relative_path: string;
  }): Promise<{
    absolute_path: string;
    content: string;
    mimeType: string;
  }> => {
    // Try to find skill by toolName first, then by name (backward compat)
    const skill = provider.controller.get(args.skill_name);
    if (!skill) {
      throw new Error(`Skill not found: ${args.skill_name}`);
    }

    const rawType = args.type || 'resource';
    const rawRelativePath = args.relative_path || '';

    const lookupPath = rawRelativePath || rawType;

    if (isUnsafeResourcePath(lookupPath)) {
      throw new Error(
        `Resource not found: Skill "${args.skill_name}" does not have a ${rawType} at path "${args.relative_path}"`
      );
    }

    let resourceEntry = resolveLegacyResource(skill, rawType, rawRelativePath);

    if (!resourceEntry) {
      resourceEntry = resolveUnifiedResource(skill, rawType, rawRelativePath);
    }

    const loweredRawType = rawType.toLowerCase();
    if (
      !resourceEntry &&
      ['resource', 'resources', 'doc', 'docs'].includes(loweredRawType) &&
      rawRelativePath
    ) {
      const normalizedRelative = normalizeResourcePath(rawRelativePath);
      const loweredRelative = normalizedRelative.toLowerCase();

      if (loweredRelative.startsWith('references/')) {
        resourceEntry = resolveLegacyResource(skill, 'reference', normalizedRelative);
      } else if (loweredRelative.startsWith('scripts/')) {
        resourceEntry = resolveLegacyResource(skill, 'script', normalizedRelative);
      } else if (loweredRelative.startsWith('assets/')) {
        resourceEntry = resolveLegacyResource(skill, 'asset', normalizedRelative);
      }

      if (!resourceEntry) {
        resourceEntry = resolveLegacyResource(skill, 'reference', normalizedRelative);
      }
      if (!resourceEntry) {
        resourceEntry = resolveLegacyResource(skill, 'script', normalizedRelative);
      }
      if (!resourceEntry) {
        resourceEntry = resolveLegacyResource(skill, 'asset', normalizedRelative);
      }
    }

    // Fallback for direct full-path request via type value only
    if (!resourceEntry && rawRelativePath === '') {
      resourceEntry = resolveUnifiedResource(skill, 'resource', rawType);
      if (!resourceEntry) {
        resourceEntry = resolveLegacyResource(skill, 'reference', rawType);
      }
      if (!resourceEntry) {
        resourceEntry = resolveLegacyResource(skill, 'script', rawType);
      }
      if (!resourceEntry) {
        resourceEntry = resolveLegacyResource(skill, 'asset', rawType);
      }
    }

    if (!resourceEntry) {
      throw new Error(
        `Resource not found: Skill "${args.skill_name}" does not have a ${rawType} at path "${args.relative_path}"`
      );
    }

    try {
      const content = await readSkillFile(resourceEntry.absolutePath);

      return {
        absolute_path: resourceEntry.absolutePath,
        content,
        mimeType: resourceEntry.mimeType,
      };
    } catch (error) {
      throw new Error(
        `Failed to read resource at ${resourceEntry.absolutePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}
