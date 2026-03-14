---
id: codemap01
title: OpenCode Skillful Codebase Map
created_at: 2026-02-05
updated_at: 2026-03-14
area: codebase-structure
tags:
  - architecture
  - codebase-map
learned_from:
  - initial analysis
  - native-first refactor
---

# Codebase Codemap

## State Machine Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPENCODE SKILLFUL PLUGIN                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐      ┌─────────────────┐      ┌──────────────────────────────┐
│   STARTUP   │─────▶│   INITIALIZE    │─────▶│        READY STATE           │
│             │      │                 │      │                              │
│ index.ts    │      │ • getConfig     │      │ Listening for tool calls:    │
│ Plugin()    │      │ • createApi     │      │ • skill_find                 │
└─────────────┘      │ • registry.init │      │ • skill_resource             │
                     └─────────────────┘      │ • native `skill` (host)      │
                                              └──────────────────────────────┘
                                                           │
                     ┌─────────────────────────────────────┼─────────────────┐
                     ▼                                     ▼                 ▼
            ┌────────────────┐               ┌─────────────────┐   ┌─────────────────┐
            │  skill_find    │               │ skill_resource  │   │ native `skill`  │
            │                │               │                 │   │ (host-provided) │
            │ Query parsing  │               │ Read skill file │   │ Load skill text │
            │ Skill search   │               │ Return content  │   │ into session    │
            │ Return results │               │ directly        │   │                 │
            └────────────────┘               └─────────────────┘   └─────────────────┘
                     │                                │
                     └────────────────┬───────────────┘
                                      ▼
                          ┌─────────────────────┐
                          │   PromptRenderer    │
                          │                     │
                          │ Format selection:   │
                          │ • XML (default)     │
                          │ • JSON              │
                          │ • Markdown          │
                          └─────────────────────┘
```

## Module Architecture

```
src/
├── index.ts                 # Plugin entry point, tool definitions, guidance hook
├── api.ts                   # Factory - wires components together
├── config.ts                # Plugin configuration loading
├── types.ts                 # Type definitions
│
├── services/
│   ├── SkillRegistry.ts     # Core: skill discovery, parsing, storage
│   ├── SkillSearcher.ts     # Query parsing & skill matching
│   ├── SkillResourceResolver.ts  # Resolve resource paths
│   ├── MessageModelIdAccountant.ts  # Track model per message
│   └── logger.ts            # Debug logging
│
├── tools/
│   ├── SkillFinder.ts       # skill_find tool creator
│   └── SkillResourceReader.ts  # skill_resource tool creator
│
└── lib/
    ├── SkillFs.ts           # Filesystem operations
    ├── Identifiers.ts       # ID generation utilities
    ├── ReadyStateMachine.ts # Async readiness coordination
    ├── nativeSkillGuidance.ts # Compact native-first guidance text
    ├── getModelFormat.ts    # Model-aware format selection
    ├── createPromptRenderer.ts  # Renderer factory
    ├── xml.ts               # XML utilities
    └── renderers/
        ├── XmlPromptRenderer.ts   # XML format
        ├── JsonPromptRenderer.ts  # JSON format
        └── MdPromptRenderer.ts    # Markdown format
```

## Data Flow

```
┌─────────────────┐
│ Tool Invocation │
│ (skill_find /   │
│  skill_resource)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ ModelAccountant │────▶│ Get Model Info  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ SkillRegistry   │────▶│ Lookup / Search │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ PromptRenderer  │────▶│ Format Content  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Direct tool     │
│ return / prompt │
│ output          │
└─────────────────┘
```

## Key Types

```
Skill {
  toolName: string      # Stable internal identifier (path-based)
  name: string          # Canonical outward-facing name
  description: string   # From frontmatter
  content: string       # Markdown content
  path: string          # Absolute path to SKILL.md
  fullPath: string      # Base directory for resolution
  scripts: Map          # Available scripts
  assets: Map           # Available assets
  references: Map       # Reference files
}

SkillRegistry {
  initialise()          # Discover and parse all skills
  search(query)         # Search skills
  get(idOrAlias)        # Get single skill via canonical/legacy alias
  skills: Skill[]       # All registered skills
}
```
