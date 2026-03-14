# Project Summary

**Project**: opencode-skillful  
**Repository**: https://github.com/zenobi-us/opencode-skillful  
**Description**: OpenCode Skills Plugin - Native-first skill discovery and resource access companion for OpenCode

## Current Status

- **Active Epic**: None
- **Active Phase**: None
- **Last Updated**: 2026-02-05

## Project Overview

This is an OpenCode plugin that provides native-first skill discovery and resource access. OpenCode's built-in `skill` tool handles skill loading; this plugin adds `skill_find` for discovery and `skill_resource` for bundled resource reads.

### Key Features

- Discovers SKILL.md files from multiple directories
- Validates skills against Anthropic's spec (YAML frontmatter + Markdown)
- Provides 2 plugin tools: `skill_find`, `skill_resource`
- Supports multiple prompt formats (XML, JSON, Markdown)
- Model-aware format selection

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (ES2021+)
- **Testing**: Vitest
- **Linting**: ESLint + Prettier
- **Build**: `mise run build`

## Next Milestones

- No active milestones

## Recent Completions

- Initial memory system setup (2026-02-05)
