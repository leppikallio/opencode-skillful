/**
 * OpenCode Skills Plugin
 *
 * Implements a native-first OpenCode skills companion plugin.
 *
 * Features:
 * - Discovers SKILL.md files from .opencode/skills/, ~/.opencode/skills/, and ~/.config/opencode/skills/
 * - Validates skills against Anthropic's spec (YAML frontmatter + Markdown)
 * - Provides unified skill discovery and resource access via two main tools:
 *   - skill_find(): Search for skills by free-text query
 *   - skill_resource(): Read bundled skill resources by skill name and path
 * - Leaves skill loading to native OpenCode `skill(...)`
 * - Returns rendered resource payloads directly from `skill_resource`
 * - Supports nested skills with proper naming
 * - Supports multiple prompt formats (XML, JSON, Markdown) with model-aware selection
 *
 * Design Decisions:
 * - Consolidates plugin behavior into discovery/resource helpers instead of a parallel loader
 * - Skills are discovered resources, not always-on capabilities
 * - Native OpenCode owns skill loading; the plugin stays layered on top
 * - Tool restrictions handled at agent level (not skill level)
 * - Tool responses are rendered directly instead of silently injected into chat
 * - Base directory context enables relative path resolution
 * - Skills require restart to reload (acceptable trade-off)
 * - Prompt format selection: model-aware via modelRenderers config, default XML
 *
 * @see https://github.com/anthropics/skills
 */

import { tool, ToolContext, type Plugin } from '@opencode-ai/plugin';

import { createApi } from './api';
import { getPluginConfig } from './config';
import { createPromptRenderer } from './lib/createPromptRenderer';
import { getModelFormat } from './lib/getModelFormat';
import { getNativeSkillGuidanceText } from './lib/nativeSkillGuidance';
import { createMessageModelIdAccountant } from './services/MessageModelIdAccountant';

export const SkillsPlugin: Plugin = async (ctx) => {
  const config = await getPluginConfig(ctx);
  const api = await createApi(config);
  const promptRenderer = createPromptRenderer();
  const modelIdAccountant = createMessageModelIdAccountant();

  api.registry.initialise();

  return {
    'chat.message': async (input) => {
      if (!input.messageID || !input.model?.providerID || !input.model?.modelID) {
        return;
      }

      // Track model usage per message
      modelIdAccountant.track({
        messageID: input.messageID,
        providerID: input.model.providerID,
        modelID: input.model.modelID,
        sessionID: input.sessionID,
      });
    },
    'experimental.chat.system.transform': async (_input, output) => {
      const guidance = getNativeSkillGuidanceText();
      if (!output.system.includes(guidance)) {
        output.system.push(guidance);
      }
    },
    async event(args) {
      switch (args.event.type) {
        case 'message.removed':
          modelIdAccountant.untrackMessage(args.event.properties);
          break;
        case 'session.deleted':
          modelIdAccountant.untrackSession(args.event.properties.info.id);
          break;
      }
    },
    tool: {
      skill_find: tool({
        description: `Search for skills using natural query syntax`,
        args: {
          query: tool.schema
            .union([tool.schema.string(), tool.schema.array(tool.schema.string())])
            .describe('The search query string or array of strings.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const messageID = toolCtx.messageID;
          const sessionID = toolCtx.sessionID;
          const modelInfo = modelIdAccountant.getModelInfo({ messageID, sessionID });

          // Resolve the appropriate format for the current model
          const format = getModelFormat({
            config,
            modelId: modelInfo?.modelID,
            providerId: modelInfo?.providerID,
          });
          const renderer = promptRenderer.getFormatter(format);

          const results = await api.findSkills(args);
          const output = renderer({ data: results, type: 'SkillSearchResults' });
          return output;
        },
      }),

      skill_resource: tool({
        description: `Read a resource file from a skill.`,
        args: {
          skill_name: tool.schema.string().describe('The skill id to read the resource from.'),
          relative_path: tool.schema
            .string()
            .describe('The relative path to the resource file within the skill directory.'),
        },
        execute: async (args, toolCtx: ToolContext) => {
          const messageID = toolCtx.messageID;
          const sessionID = toolCtx.sessionID;
          const modelInfo = modelIdAccountant.getModelInfo({ messageID, sessionID });

          // Resolve the appropriate format for the current model
          const format = getModelFormat({
            config,
            modelId: modelInfo?.modelID,
            providerId: modelInfo?.providerID,
          });

          const renderer = promptRenderer.getFormatter(format);

          // Read the resource from the skill
          const result = await api.readResource(args);

          const output = renderer({ data: result, type: 'SkillResource' });
          return output;
        },
      }),
    },
  };
};

export default SkillsPlugin;
