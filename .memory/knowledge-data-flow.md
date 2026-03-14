---
id: dataflow1
title: Data Flow Diagram
created_at: 2026-02-05
updated_at: 2026-03-14
area: data-flow
tags:
  - architecture
  - data-flow
learned_from:
  - initial analysis
  - native-first refactor
---

# Data Flow

## Plugin Initialization Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           INITIALIZATION                                │
└──────────────────────────────────────────────────────────────────────────┘

     ┌─────────┐
     │ OpenCode│
     │  Host   │
     └────┬────┘
          │ loads plugin
          ▼
     ┌─────────┐      ┌──────────┐
     │ index.ts│─────▶│ config.ts│
     │ Plugin()│      │          │
     └────┬────┘      └────┬─────┘
          │                │
          │                ▼
          │         ┌──────────────┐
          │         │PluginConfig  │
          │         │ • basePaths  │
          │         │ • debug      │
          │         │ • renderers  │
          │         └──────┬───────┘
          │                │
          ▼                ▼
     ┌─────────┐      ┌──────────────┐
     │ api.ts  │◀─────│ createApi()  │
     │         │      └──────────────┘
     └────┬────┘
          │ creates
          ▼
     ┌──────────────────────────────────────────┐
     │              API Object                   │
     │  ┌─────────────┐  ┌─────────────────┐    │
     │  │Logger       │  │SkillRegistry    │    │
     │  └─────────────┘  │  (not init yet) │    │
     │                   └─────────────────┘    │
     │  ┌─────────────┐  ┌─────────────────┐    │
     │  │findSkills() │  │readResource()   │    │
     │  └─────────────┘  └─────────────────┘    │
     └──────────────────────────────────────────┘
          │
          │ registry.initialise()
          ▼
     ┌─────────────────────────────────────┐
     │         SKILL DISCOVERY              │
     │                                      │
     │  For each basePath:                  │
     │    └─▶ findSkillPaths()             │
     │         └─▶ register()              │
     │              └─▶ parseSkill()       │
     │                   └─▶ store.set()   │
     └─────────────────────────────────────┘
```

## Tool Execution Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    PLUGIN TOOL EXECUTION FLOW                            │
└──────────────────────────────────────────────────────────────────────────┘

  User Request                    Tool Context
       │                              │
       ▼                              ▼
  ┌───────────────┐              ┌───────────┐
  │ skill_find /  │              │ messageID │
  │ skill_resource│              │ sessionID │
  └──────┬────────┘              └─────┬─────┘
         │                              │
         ▼                              ▼
  ┌──────────────────────────────────────────┐
  │        MessageModelIdAccountant           │
  │  getModelInfo({messageID, sessionID})    │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │           getModelFormat()               │
  │  • Check config.modelRenderers           │
  │  • Match provider:model pattern          │
  │  • Return: 'xml' | 'json' | 'md'         │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │          api.findSkills / readResource   │
  │  • Search skills or resolve resource     │
  │  • Registry-backed alias resolution      │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │         promptRenderer.getFormatter()    │
  │  • Select renderer by format             │
  │  • XmlPromptRenderer                     │
  │  • JsonPromptRenderer                    │
  │  • MdPromptRenderer                      │
  └─────────────────────┬────────────────────┘
                        │
                        ▼
  ┌──────────────────────────────────────────┐
  │           renderer({data, type})         │
  │  • Format tool output                    │
  │  • Return to chat / tool result          │
  └──────────────────────────────────────────┘
```

## Search Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      SKILL_FIND SEARCH FLOW                             │
└──────────────────────────────────────────────────────────────────────────┘

  Query String
       │
       ▼
  ┌─────────────────────┐
  │   parseQuery()      │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ For each skill:     │
  │ shouldIncludeSkill()│
  │ rankSkill()         │
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────┐
  │ Match summary +     │
  │ canonical skill ids │
  └─────────────────────┘
```
