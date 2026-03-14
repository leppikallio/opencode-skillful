# OpenCode Skills Plugin

An interpretation of the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills) for OpenCode, providing native-first skill discovery and resource access.

Differentiators include:

- Conversationally the agent uses `skill_find` to discover skills
- Skills are loaded via OpenCode's native `skill` tool (this plugin does not load skills)
- The agent can use `skill_resource` to read bundled reference material and scripts

## Table of Contents

- [Quick Start](#quick-start) - Get started in 2 minutes
- [Installation](#installation) - Set up the plugin
- [Key Differences from Built-in OpenCode](#key-differences-from-built-in-opencode) - Why choose opencode-skillful
- [Tools Overview](#tools-overview) - skill_find, skill_resource, and native skill
- [Running Skill Scripts](#running-skill-scripts) - How agents execute skill scripts
- [Usage Examples](#usage-examples) - Real-world scenarios
- [Plugin Tools](#plugin-tools) - Detailed tool documentation
- [Configuration](#configuration) - Advanced setup
- [Architecture](#architecture) - How it works internally
- [Migration](#migration) - Moving from legacy loader patterns
- [Real-Host Smoke](#real-host-smoke) - Verify native-first behavior end-to-end
- [Creating Skills](#creating-skills) - Build your own skills

## Quick Start

Get up and running with three common tasks:

### 1. Find Skills by Keyword (Plugin)

```
skill_find query="git commit"
```

Searches for skills related to writing git commits. Returns matching skills sorted by relevance.

### 2. Load a Skill (Native OpenCode)

```
skill name="writing-git-commits"
```

Loads the skill into your chat context using OpenCode's built-in loader.

### 3. Read a Skill Resource (Plugin)

```
skill_resource skill_name="writing-git-commits" relative_path="references/guide.md"
```

Access specific documentation, templates, or scripts from a skill without loading the entire skill.

**Next steps:** See [Usage Examples](#usage-examples) for real-world scenarios, or jump to [Plugin Tools](#plugin-tools) for detailed documentation.

## Installation

Create or edit your OpenCode configuration file (typically `~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-skillful"]
}
```

## Real-Host Smoke

Use the opt-in smoke script to verify the final native-first behavior against a real local OpenCode host:

```bash
bun scripts/smoke/native-skill-parity.ts
```

Prerequisites:

- `~/Projects/opencode` exists, or set `OPENCODE_HOST_PATH` to another OpenCode checkout
- The target host is runnable either from its local `node_modules` or from an installed `opencode` CLI on `PATH`
- This plugin worktree is available locally so the smoke can reference `src/index.ts`

Optional environment variables:

- `OPENCODE_HOST_PATH` - override the default host path (`~/Projects/opencode`)
- `OPENCODE_SMOKE_MODEL` - pin a specific model for the smoke run

Optional flag:

- `--keep-temp` - preserve the temporary smoke project for inspection

Expected pass/fail signals:

- Pass: the command exits successfully and prints exactly `OK`
- Fail: the command exits non-zero and prints an `[ERROR]` line explaining the failed assertion or host/runtime problem

What the smoke validates:

- tool order is exactly `skill_find`, then native `skill`, then `skill_resource`
- tool inputs match the expected smoke-skill name and resource path
- `skill_use` never appears
- the final assistant line is `OK` (some runtimes may add a prefix/header)

## Key Differences from Built-in OpenCode

This plugin takes a different approach than OpenCode's built-in skills implementation:

| Aspect                   | Built-in OpenCode                         | opencode-skillful                                              |
| ------------------------ | ----------------------------------------- | -------------------------------------------------------------- |
| **Skill Loading**        | Native `skill` loader                     | Reuses native `skill` (plugin does not add a second loader)    |
| **Skill Discovery**      | Whatever the runtime already exposes      | Adds search over custom skill directories via `skill_find`     |
| **Resource Access**      | No plugin-specific indexed resource layer | Adds pre-indexed resource reads via `skill_resource`           |
| **Format Configuration** | Default runtime presentation              | Per-model XML/JSON/Markdown rendering for plugin tool outputs  |
| **Migration Posture**    | No plugin migration needed                | Documents the native-first transition away from legacy loading |

### Native-First Loading

Unlike older skill plugins that implemented a separate loader, opencode-skillful stays native-first:

- Skills are loaded via OpenCode's native `skill` tool
- Only the skills you use consume tokens in your conversation
- Reduces context bloat and improves efficiency with large skill libraries
- Perfect for workflows with 50+ skills where you might use 2-3 per conversation

### Provider-Model Specific Format Configuration

Different LLM providers prefer different formats. Configure which format each model receives:

```json
{
  "promptRenderer": "xml",
  "modelRenderers": {
    "claude-3-5-sonnet": "xml",
    "gpt-4": "json",
    "gpt-4-turbo": "json",
    "llama-2-70b": "md"
  }
}
```

This allows you to optimize tool output formatting for each model without creating duplicate skill documentation.

## Running Skill Scripts

Skills can include executable scripts in their `scripts/` directory. This plugin does not execute scripts; it only lets the agent read script contents and metadata with `skill_resource`. If you want a script to run, you (or the agent) still run it via the appropriate native tool, typically `bash` against a known path or a temporary file created from the script contents.

**How it works:**

1. Skills reference scripts in their SKILL.md like: `./scripts/setup.sh`
2. You load the skill via native `skill` so the agent sees the instructions
3. The agent reads the script via `skill_resource`
4. The agent decides how to execute it safely, typically by using a known path or writing the contents to a temporary file and invoking `bash`

**Example:**

Your skill's SKILL.md includes: `./scripts/generate-changelog.sh`

You ask: "Can you run the changelog generator from the build-utils skill?"

The agent:

- Loads the skill with native `skill`
- Reads the script via `skill_resource`
- Executes it with the appropriate native tool once the path or contents are available

**Why this approach?**

Rather than a dedicated script execution tool, agents have full visibility into all skill resources and can intelligently decide when and how to run them based on your instructions and the task context. Scripts are referenced naturally in skill documentation (e.g., "Run `./scripts/setup.sh` to initialize") and agents can work out the paths and execution from context.

## Tools Overview

The system is split between two plugin tools and one native OpenCode tool:

| Tool               | Purpose                         | When to Use                                        |
| ------------------ | ------------------------------- | -------------------------------------------------- |
| **skill_find**     | Discover skills by keyword      | You want to search for relevant skills             |
| **skill_resource** | Read specific files from skills | You need a template, guide, or script from a skill |

Native OpenCode tool (not provided by this plugin):

| Tool      | Purpose              | When to Use                              |
| --------- | -------------------- | ---------------------------------------- |
| **skill** | Load a skill by name | You want the AI to use a skill's content |

See [Plugin Tools](#plugin-tools) for complete documentation.

## Usage Examples

These real-world scenarios show how to use the plugin tools with the native loader:

### Scenario 1: Writing Better Git Commits

**You want:** The AI to help you write a commit message following best practices.

**Steps:**

1. Search for relevant skills:

   ```
   skill_find query="git commit"
   ```

2. Load the skill (native OpenCode):

   ```
    skill name="writing-git-commits"
   ```

3. Ask the AI: "Help me write a commit message for refactoring the auth module"

The AI now has the skill's guidance and can apply best practices to your request.

### Scenario 2: Finding and Exploring a Specific Skill's Resources

**You want:** Access a specific template or guide from a skill without loading the entire skill.

**Steps:**

1. Find skills in a category:

   ```
   skill_find query="testing"
   ```

2. Once you've identified a skill, read its resources:
   ```
   skill_resource skill_name="testing-skill" relative_path="references/test-template.md"
   ```

This is useful when you just need a template or specific document, not full AI guidance.

### Scenario 3: Browsing and Discovering Skills

**You want:** See what skills are available under a specific category.

**Steps:**

1. List all skills:

   ```
   skill_find query="*"
   ```

2. Filter by category:

   ```
   skill_find query="experts"
   ```

3. Search with exclusions:
   ```
   skill_find query="testing -performance"
   ```

This searches for testing-related skills but excludes performance testing.

### Query Syntax Quick Reference

- `*` or empty: List all skills
- `keyword1 keyword2`: AND logic (all terms must match)
- `-term`: Exclude results matching this term
- `"exact phrase"`: Match exact phrase
- `experts`, `superpowers/writing`: Path prefix matching

## Features

- Discover SKILL.md files from multiple locations
- Native-first loading: skills are loaded via OpenCode `skill`
- Path prefix matching for organized skill browsing
- Natural query syntax with negation and quoted phrases
- Skill ranking by relevance (name matches weighted higher)
- Safe resource access without introducing a second skill loader
- **Pluggable prompt rendering** with model-aware format selection (XML, JSON, Markdown)

## Prompt Renderer Configuration

The plugin supports **multiple formats for tool output rendering**, allowing you to optimize results for different LLM models and use cases.

> See the [Configuration](#configuration) section for complete configuration details, including bunfig setup and global/project-level overrides.

### Supported Formats

Choose the format that works best for your LLM:

| Format            | Best For               | Characteristics                                                        |
| ----------------- | ---------------------- | ---------------------------------------------------------------------- |
| **XML** (default) | Claude models          | Human-readable, structured, XML-optimized for Claude                   |
| **JSON**          | GPT and strict parsers | Machine-readable, strict JSON structure, strong parsing support        |
| **Markdown**      | All models             | Readable prose, heading-based structure, easy to read in conversations |

### Configuration Syntax

Set your preferences in `.opencode-skillful.json`:

```json
{
  "promptRenderer": "xml",
  "modelRenderers": {
    "claude-3-5-sonnet": "xml",
    "gpt-4": "json",
    "gpt-4-turbo": "json"
  }
}
```

**How It Works:**

1. Every tool execution checks the current active LLM model
2. If `modelRenderers[modelID]` is configured, that format is used
3. Otherwise, the global `promptRenderer` default is used
4. Results are rendered in the selected format and returned to the chat

### Format Output Examples

#### XML Format (Claude Optimized)

```xml
<Skill>
  <name>git-commits</name>
  <description>Guidelines for writing effective git commit messages</description>
  <toolName>writing_git_commits</toolName>
</Skill>
```

**Advantages:**

- Matches Claude's native instruction format
- Clear tag-based structure
- Excellent readability for complex nested data

#### JSON Format (GPT Optimized)

```json
{
  "name": "git-commits",
  "description": "Guidelines for writing effective git commit messages",
  "toolName": "writing_git_commits"
}
```

**Advantages:**

- Strong parsing support across LLMs
- Strict, validated structure
- Familiar format for language models trained on JSON data

#### Markdown Format (Human Readable)

```markdown
# Skill

### name

- **name**: _git-commits_

### description

- **description**: _Guidelines for writing effective git commit messages_

### toolName

- **toolName**: _writing_git_commits_
```

**Advantages:**

- Most readable in conversations
- Natural language-friendly
- Works well for exploratory workflows

## Skill Discovery Paths

Skills are discovered from these locations (in priority order, last wins on duplicates):

1. `~/.config/opencode/skills/` - Standard XDG config location or (`%APPDATA%/.opencode/skills` for windows users)
2. `.opencode/skills/` - Project-local skills (highest priority)

## Usage in OpenCode

### Finding Skills

```
# List all available skills
skill_find query="*"

# Search by keyword
skill_find query="git commit"

# Exclude terms
skill_find query="testing -performance"
```

### Loading Skills

Skills are loaded by their canonical **skill name**.

This plugin surfaces the canonical skill name from `SKILL.md` frontmatter (`name:`). If `name:` is missing, it falls back to the skill directory name (the folder containing `SKILL.md`).

```
skills/
  writing-git-commits/         # name: writing-git-commits
  experts/
    ai/
      agentic-engineer/        # name: experts-ai-agentic-engineer (example)
```

When loading skills, use the canonical name with native `skill`:

```
# Load a skill by its canonical name
skill name="writing-git-commits"

# Load multiple skills (repeat native loader)
skill name="writing-git-commits"
skill name="experts-ai-agentic-engineer"
```

### Reading Skill Resources

```

# Read a reference document

skill_resource skill_name="writing-git-commits" relative_path="references/style-guide.md"

# Read a template

skill_resource skill_name="brand-guidelines" relative_path="assets/logo-usage.html"

```

Normally you won't need to use `skill_resource` directly, since the LLM will do it for you.

But when writing your skills, there's nothing stopping you from using `skill_resource` to be explicit.

(Just be aware that exotic file types might need special tooling to handle them properly.)

## Migration

Older versions of this plugin documented a plugin-managed skill loading step. In the native-first design, skill loading is handled by OpenCode's built-in `skill` tool, and this plugin focuses on discovery (`skill_find`) and safe resource reads (`skill_resource`).

Common replacements:

```text
# Old: plugin-managed loading step
[plugin loader for <skill-name>]

# New: native OpenCode loader
skill name="<skill-name>"
```

```text
# Old: plugin-managed loading step for multiple skills
[plugin loader for <skill-a>, <skill-b>]

# New: repeat native loader
skill name="<skill-a>"
skill name="<skill-b>"
```

## Plugin Tools

The plugin provides two tools (defined in `src/index.ts`):

### `skill_find`

Search for skills using natural query syntax with intelligent ranking by relevance.

**Parameters:**

- `query`: Search string supporting:
  - `*` or empty: List all skills
  - Path prefixes: `experts`, `superpowers/writing` (prefix matching)
  - Keywords: `git commit` (multiple terms use AND logic)
  - Negation: `-term` (exclude results)
  - Quoted phrases: `"exact match"` (phrase matching)

**Returns:**

- `skills`: matching skills, each with:
  - `name`: canonical skill name (the value you pass to native `skill`)
  - `description`: human-readable description
- `summary`: search metadata
- If config.debug is enabled:
  - `debug`: registry summary (discovered/parsed/rejected/errors)

**Example Response:**

```xml
<SkillSearchResults>
  <query>git commit</query>
  <skills>
    <name>writing-git-commits</name>
    <description>Guidelines for writing effective git commit messages</description>
  </skills>
  <summary>
    <total>42</total>
    <matches>1</matches>
    <feedback>Searching for: &quot;**git commit**&quot; | Found 1 match</feedback>
    <usage_hint>Load with: skill name=&quot;writing-git-commits&quot;</usage_hint>
  </summary>
</SkillSearchResults>
```

Then load it via native OpenCode:

```
skill name="writing-git-commits"
```

### `skill_resource`

Read a specific resource file from a skill's directory and return it in the configured format.

**When to Use:**

- Load specific reference documents or templates from a skill
- Access supporting files without loading the entire skill
- Retrieve examples, guides, configuration templates, or scripts
- Often used after loading a skill via native `skill` (so the LLM sees the skill instructions)

**Parameters:**

- `skill_name`: The skill containing the resource (by toolName/FQDN or short name)
- `relative_path`: Path to the resource relative to the skill directory

**Resource Types:**

Can read any of the three resource types:

- `references/` - Documentation, guides, and reference materials
- `assets/` - Templates and configuration files (text; binary assets need special handling)
- `scripts/` - Executable scripts (shell, Python, etc.) for viewing or analysis

**Returns:**

- MIME type of the resource
- Success confirmation with skill name, resource path, and type

**Behavior:**

- Resolves relative paths within skill directory (e.g., `references/guide.md`, `assets/template.html`, `scripts/setup.sh`)
- Returns a rendered payload (XML/JSON/Markdown) directly to the chat
- Reads files as UTF-8 text (`Bun.file(...).text()`); binary assets are not supported

**Example Responses:**

Reference document:

```
Load Skill Resource

  skill: experts/writing-git-commits
  resource: references/commit-guide.md
  type: text/markdown
```

Script file:

```
Load Skill Resource

  skill: build-utils
  resource: scripts/generate-changelog.sh
  type: text/plain
```

Asset file:

```
Load Skill Resource

  skill: brand-guidelines
  resource: assets/logo-usage.html
  type: text/html
```

## Error Handling

### skill_find Errors

When a search query doesn't match any skills, the response includes feedback:

```xml
<SkillSearchResults query="nonexistent">
  <Skills></Skills>
  <Summary>
    <Total>42</Total>
    <Matches>0</Matches>
    <Feedback>No skills found matching your query</Feedback>
  </Summary>
</SkillSearchResults>
```

### skill_resource Errors

Resource loading failures occur when:

- The skill doesn't exist
- The resource path doesn't exist within the skill
- The file cannot be read due to permissions

The tool returns an error message indicating which skill or resource path was problematic.

## Configuration

The plugin loads configuration from **bunfig**, supporting both project-local and global configuration files:

### Configuration Files

Configuration is loaded in this priority order (highest priority last):

1. **Global config** (standard platform locations):
   - Linux/macOS: `~/.config/opencode-skillful/config.json`
   - Windows: `%APPDATA%/opencode-skillful/config.json`

2. **Project config** (in your project root):
   - `.opencode-skillful.json`

Later configuration files override earlier ones. Use project-local `.opencode-skillful.json` to override global settings for specific projects.

### Configuration Options

#### Plugin Installation

First, register the plugin in your OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-skillful"]
}
```

#### Skill Discovery Configuration

Create `.opencode-skillful.json` in your project root or global config directory:

```json
{
  "debug": false,
  "basePaths": ["~/.config/opencode/skills", ".opencode/skills"],
  "promptRenderer": "xml",
  "modelRenderers": {}
}
```

**Configuration Fields:**

- **debug** (boolean, default: `false`): Enable debug output showing skill discovery stats
  - When enabled, `skill_find` responses include discovered, parsed, rejected, and error counts
  - Useful for diagnosing skill loading and parsing issues

- **basePaths** (array, default: standard locations): Custom skill search directories
  - Paths are searched in priority order; later paths override earlier ones for duplicate skill names
  - Default: `[~/.config/opencode/skills, .opencode/skills]`
  - Use project-local `.opencode/skills/` for project-specific skills
  - Platform-aware paths: automatically resolves to XDG, macOS, or Windows standard locations

- **promptRenderer** (string, default: `'xml'`): Default format for plugin tool output rendering
  - Options: `'xml'` | `'json'` | `'md'`
  - XML (default): Claude-optimized, human-readable structured format
  - JSON: GPT-optimized, strict JSON formatting for strong parsing models
  - Markdown: Human-readable format with headings and nested lists
  - Used when no model-specific renderer is configured

- **modelRenderers** (object, default: `{}`): Per-model format overrides
  - Maps model IDs to preferred formats
  - Overrides global `promptRenderer` for specific models
  - Example: `{ "gpt-4": "json", "claude-3-5-sonnet": "xml" }`

### How Renderer Selection Works

When any plugin tool executes (`skill_find`, `skill_resource`):

1. The plugin queries the OpenCode session to determine the active LLM model
2. Builds a list of model candidates to check, from most to least specific:
   - Full model ID (e.g., `"anthropic-claude-3-5-sonnet"`)
   - Generic model pattern (e.g., `"claude-3-5-sonnet"`)
3. Checks if any candidate exists in `modelRenderers` configuration
   - First match wins (most specific takes precedence)
   - If found, uses that format
4. If no match in `modelRenderers`, falls back to `promptRenderer` default
5. Renders the results in the selected format and returns it to the chat

**Example**: If your config has `"claude-3-5-sonnet": "xml"` and the active model is `"anthropic-claude-3-5-sonnet"`, the plugin will:

- Try matching `"anthropic-claude-3-5-sonnet"` (no match)
- Try matching `"claude-3-5-sonnet"` (match found! Use XML)
- Return `"xml"` format

This allows different models to receive results in their preferred format without needing to specify every model variant. Configure the generic model name once and it works for all provider-prefixed variations.

### Example Configurations

#### Global Configuration for Multi-Model Setup

`~/.config/opencode-skillful/config.json`:

```json
{
  "debug": false,
  "promptRenderer": "xml",
  "modelRenderers": {
    "claude-3-5-sonnet": "xml",
    "claude-3-opus": "xml",
    "gpt-4": "json",
    "gpt-4-turbo": "json",
    "llama-2-70b": "md"
  }
}
```

#### Project-Specific Override

`.opencode-skillful.json` (project root):

```json
{
  "debug": true,
  "basePaths": ["~/.config/opencode/skills", ".opencode/skills", "./vendor/skills"],
  "promptRenderer": "xml",
  "modelRenderers": {
    "gpt-4": "json"
  }
}
```

This project-local config:

- Enables debug output for troubleshooting
- Adds a custom vendor skills directory
- Uses JSON format specifically for GPT-4 when it's the active model
- Falls back to XML for all other models

## Architecture

### System Design Overview

The plugin uses a **layered, modular architecture** with clear separation of concerns and two-phase initialization.

#### Design Principles

- **Async Coordination**: ReadyStateMachine ensures tools don't execute before registry initialization completes
- **Security-First Resource Access**: All resources are pre-indexed at parse time; no path traversal possible
- **Factory Pattern**: Centralized API creation for easy testing and configuration management
- **Native-First Loading**: OpenCode owns skill loading; this plugin stays layered on top

### System Layers

```
┌──────────────────────────────────────────────────────┐
│ Plugin Entry Point (index.ts)                        │
│ - Defines 2 plugin tools: skill_find, skill_resource │
│ - Initializes API factory and config                │
│ - Adds short native guidance to system prompt        │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│ API Factory Layer (api.ts, config.ts)                │
│ - createApi(): initializes logger, registry, tools   │
│ - getPluginConfig(): resolves base paths with proper │
│   precedence (project-local overrides global)        │
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│ Services Layer (src/services/)                       │
│ - SkillRegistry: discovery, parsing, resource       │
│   mapping with ReadyStateMachine coordination        │
│ - SkillSearcher: query parsing + intelligent ranking│
│ - SkillResourceResolver: safe path-based retrieval   │
│ - SkillFs (via lib): filesystem abstraction (mockable)
└──────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────┐
│ Core Libraries (src/lib/)                            │
│ - ReadyStateMachine: async initialization sequencing │
│ - SkillFs: abstract filesystem operations            │
│ - Identifiers: path ↔ tool name conversions          │
│ - xml.ts: JSON → XML serialization                   │
└──────────────────────────────────────────────────────┘
```

### Initialization Flow (Why This Matters)

The plugin uses a **two-phase initialization pattern** to coordinate async discovery with tool execution:

```
PHASE 1: SYNCHRONOUS CREATION
├─ Plugin loads configuration
├─ createApi() called:
│  ├─ Creates logger
│  ├─ Creates SkillRegistry (factory, NOT initialized yet)
│  └─ Returns registry + tool creators
└─ index.ts registers tools immediately

PHASE 2: ASYNCHRONOUS DISCOVERY (Background)
├─ registry.initialise() called
│  ├─ Sets ready state to "loading"
│  ├─ Scans all base paths for SKILL.md files
│  ├─ Parses each file (YAML frontmatter + resources)
│  ├─ Pre-indexes all resources (scripts/assets/references)
│  └─ Sets ready state to "ready"
│
└─ WHY PRE-INDEXING: Prevents path traversal attacks.
   Tools can only retrieve pre-registered resources,
   never arbitrary filesystem paths.

PHASE 3: TOOL EXECUTION (User Requested)
├─ User calls: skill_find("git commits")
├─ Tool executes:
│  ├─ await registry.controller.ready.whenReady()
│  │  (blocks until Phase 2 completes)
│  ├─ Search registry
│  └─ Return results
└─ WHY THIS PATTERN: Multiple tools can call whenReady()
   at different times without race conditions.
   Simple Promise would resolve once; this allows
   concurrent waiters.
```

### Data Flow Diagram: skill_find Query

```
┌─────────────────────────────────────────┐
│ User Query: skill_find("git commit")    │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ skill_find Tool (index.ts)              │
│ - Validates query string                │
│ - Awaits: controller.ready.whenReady()  │
└────────────┬────────────────────────────┘
             ↓ (continues when registry ready)
┌─────────────────────────────────────────┐
│ SkillSearcher.search()                  │
│ - Parse query via search-string library │
│   ("git commit" → include: [git,commit])│
│ - Filter ALL include terms must match   │
│   (name, description, or toolName)      │
│ - Exclude results matching exclude      │
│   terms                                 │
│ - Rank results:                         │
│   * nameMatches × 3 (strong signal)     │
│   * descMatches × 1 (weak signal)       │
│   * exact match bonus +10                │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Results with Feedback                   │
│ - Matched skills array                  │
│ - Sorted by relevance score             │
│ - User-friendly feedback message        │
│   "Searching for: **git commit** |      │
│    Found 3 matches"                     │
└────────────┬────────────────────────────┘
             ↓
┌─────────────────────────────────────────┐
│ Format & Return (index.ts)              │
│ - Render as XML/JSON/Markdown           │
│ - Return to chat                        │
└─────────────────────────────────────────┘
```

### Data Flow Diagram: skill_resource Access

```
┌──────────────────────────────────────────────┐
│ User: skill_resource("git-commits",         │
│                     "scripts/commit.sh")     │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ skill_resource Tool (index.ts)               │
│ - Validate skill_name                       │
│ - Parse path: "scripts/commit.sh"            │
│   ├─ type = "scripts"                        │
│   └─ relative_path = "commit.sh"             │
│ - Assert type is valid (scripts|assets|refs)│
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ SkillResourceResolver                       │
│ - Fetch skill object from registry           │
│ - Look up in skill.scripts Map               │
│   (pre-indexed at parse time)                │
│ - Retrieve: { absolutePath, mimeType }      │
│                                              │
│ ★ SECURITY: Only pre-indexed paths exist    │
│   No way to request ../../../etc/passwd      │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ File I/O (SkillFs abstraction)               │
│ - Read file content from absolutePath        │
│ - Detect MIME type (e.g., text/plain)       │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Return Injection Object                      │
│ {                                            │
│   skill_name,                                │
│   resource_path,                             │
│   resource_mimetype,                         │
│   content                                    │
│ }                                            │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Render & Return                              │
│ - Render as XML/JSON/Markdown                │
│ - Return to chat                             │
└──────────────────────────────────────────────┘
```

### Key Design Decisions and Their Rationale

| Decision                     | Why                                                | Impact                                                       |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| **ReadyStateMachine**        | Ensures tools don't race with async registry setup | Tools are guaranteed registry is ready before execution      |
| **Pre-indexed Resources**    | Prevents path traversal attacks                    | Security: only pre-registered paths retrievable              |
| **Factory Pattern (api.ts)** | Centralizes initialization                         | Easy to test, swap implementations, mock components          |
| **Removed SkillProvider**    | Eliminated unnecessary abstraction                 | Simpler code, direct registry access, easier debugging       |
| **Prompt Rendering**         | Model-aware structured output                      | XML/JSON/Markdown tool results per model configuration       |
| **Two-phase Init**           | Async discovery doesn't block tool registration    | Tools available immediately, discovery happens in background |

### Services Layer Breakdown

#### SkillRegistry (`src/services/SkillRegistry.ts`)

- **Role**: Central skill catalog and discovery engine
- **Responsibilities**:
  1. Scan multiple base paths for SKILL.md files (recursive)
  2. Parse each file's YAML frontmatter (validates schema)
  3. Index all resources (scripts/assets/references) for safe retrieval
  4. Register skills in controller.skills Map by toolName
  5. Coordinate initialization via ReadyStateMachine
- **Key Methods**:
  - `initialise()`: Async discovery and parsing pipeline
  - `register()`: Parse and store skill files
  - `parseSkill()`: Extract metadata and resource paths
- **Error Handling**: Malformed skills logged but don't halt discovery

#### SkillSearcher (`src/services/SkillSearcher.ts`)

- **Role**: Natural language query interpretation and ranking
- **Responsibilities**:
  1. Parse queries using search-string library (Gmail syntax)
  2. Filter: ALL include terms must match (AND logic)
  3. Exclude: Remove results matching exclude terms
  4. Rank by relevance (name matches 3×, description 1×, exact +10)
  5. Generate user-friendly feedback
- **Scoring Formula**: `(nameMatches × 3) + (descMatches × 1) + exactBonus`
- **Edge Cases**: Empty queries or "\*" list all skills

### Tools Layer Overview

The plugin tools are defined in `src/index.ts` and call into the API/services layer.

### Configuration and Path Resolution

```
Configuration Priority (Last Wins):
1. Global: ~/.opencode/skills/ (lowest)
2. Project: ./.opencode/skills/ (highest)

Why This Order:
- Users install global skills once
- Projects override with local versions
- Same skill name in both → project version wins
```

## Contributing

Contributions are welcome! When adding features, follow these principles:

- **Explain the WHY, not the WHAT**: Code comments should document design decisions, not mechanics
- **Keep modules focused**: Each file has one primary responsibility
- **Test async behavior**: Ready state coordination is critical
- **Document algorithms**: Ranking, parsing, and search logic should have detailed comments

## Creating Skills

Skills follow the [Anthropic Agent Skills Specification](https://github.com/anthropics/skills). Each skill is a directory containing a `SKILL.md` file:

```
skills/
  my-skill/
    SKILL.md
    resources/
      template.md
```

### Skill Structure

```
my-skill/
  SKILL.md                 # Required: Skill metadata and instructions
  references/              # Optional: Documentation and guides
    guide.md
    examples.md
  assets/                  # Optional: Binary files and templates
    template.html
    logo.png
  scripts/                 # Optional: Executable scripts
    setup.sh
    generate.py
```

### SKILL.md Format

```yaml
---
name: my-skill
description: A brief description of what this skill does (min 20 chars)
---
# My Skill

Instructions for the AI agent when this skill is loaded...
```

**Requirements:**

- `name` must match the directory name (lowercase, alphanumeric, hyphens only)
- `description` must be at least 20 characters and should be concise (under 500 characters recommended)
  - Focus on when to use the skill, not what it does
  - Include specific triggering conditions and symptoms
  - Use third person for skill guidance text that the model will read
  - Example: "Use when designing REST APIs to establish consistent patterns and improve developer experience"
- Directory name and frontmatter `name` must match exactly

### Resource Types

Skill resources are automatically discovered and categorized:

- **References** (`references/` directory): Documentation, guides, and reference materials
  - Typically Markdown, plaintext, or HTML files
  - Accessed via `skill_resource` for reading documentation
- **Assets** (`assets/` directory): Templates and configuration files (prefer text; binary needs special handling)
  - Can include HTML templates and configuration files
  - Useful for providing templates and examples to the AI
- **Scripts** (`scripts/` directory): Executable scripts that perform actions
  - Shell scripts (.sh), Python scripts (.py), or other executables
  - Can be accessed via `skill_resource` for reading as files
  - Useful for providing automation scripts, code generation, or templates

## Considerations

- Skills are discovered at plugin initialization (requires restart to reload)
- Duplicate skill names are logged and skipped (last path wins)
- Tool restrictions in `allowed-tools` are informational (enforced at agent level)
- Skill loading is handled by native OpenCode `skill`

## Contributing

Contributions are welcome! Please file issues or submit pull requests on the GitHub repository.

## License

MIT License. See the [LICENSE](LICENSE) file for details.
