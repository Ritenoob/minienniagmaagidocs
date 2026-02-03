# AGENTS.md - Copilot CLI Bundle

## Overview

This document provides complete instructions for AI coding agents working with or extending the Copilot CLI Bundle - an autonomous, ML-powered development assistant.

---

## 🚨 CRITICAL RULES

### NEVER DO

```
❌ NEVER execute arbitrary shell commands without validation
❌ NEVER modify files outside the project directory
❌ NEVER expose API keys or secrets
❌ NEVER bypass the skill/workflow execution system
❌ NEVER disable ML learning without explicit request
❌ NEVER skip error handling in handlers
❌ NEVER hardcode paths or configurations
❌ NEVER create infinite loops in workflows
❌ NEVER ignore rate limits on MCP servers
❌ NEVER store sensitive data in memory without encryption
```

### ALWAYS DO

```
✅ ALWAYS validate input before processing
✅ ALWAYS use the skill system for reusable operations
✅ ALWAYS handle errors gracefully with Result pattern
✅ ALWAYS log operations for debugging
✅ ALWAYS respect file system boundaries
✅ ALWAYS use agents through the orchestrator
✅ ALWAYS persist state before shutdown
✅ ALWAYS check preconditions in workflows
✅ ALWAYS provide progress feedback for long operations
✅ ALWAYS document new skills and agents
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI ENTRY POINT                          │
│                            (cli.js)                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────────┐
│  ORCHESTRATOR   │  │   WORKFLOW    │  │  MCP SERVERS    │
│                 │  │    ENGINE     │  │                 │
│  - Task Queue   │  │  - DAG Exec   │  │  - Filesystem   │
│  - Routing      │  │  - Templates  │  │  - Git          │
│  - ML Engine    │  │  - State      │  │  - Shell        │
│  - Metrics      │  │               │  │  - Analysis     │
└────────┬────────┘  └───────┬───────┘  └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                          AGENTS                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│  │ Analyzer  │ │ Refactor  │ │   Test    │ │  Security │        │
│  │           │ │           │ │ Generator │ │  Scanner  │        │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
│                                                                  │
│  Each agent has: Memory, Skills, ML Integration, Metrics         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SKILL REGISTRY                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Filesystem│ │   Code   │ │   Git    │ │   Data   │           │
│  │  Skills  │ │  Skills  │ │  Skills  │ │  Skills  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Agent System (`agents/core.js`)

#### Agent Base Class

```javascript
class Agent {
  constructor(config) {
    this.id           // Unique identifier
    this.name         // Human-readable name
    this.type         // Agent category
    this.state        // idle | running | paused | error
    this.memory       // AgentMemory instance
    this.skills       // Map<name, Skill>
    this.mlEngine     // ML engine reference
    this.metrics      // Performance tracking
  }
  
  // Core methods
  async initialize()
  async shutdown()
  registerSkill(skill)
  async executeSkill(name, params)
  
  // Communication
  send(targetAgentId, message)
  receive(message)
  on(event, callback)
  emit(event, data)
}
```

#### Agent Memory System

```javascript
class AgentMemory {
  // Short-term (session)
  remember(key, value, ttl)
  recall(key)
  forget(key)
  
  // Long-term (persistent)
  store(key, value, metadata)
  retrieve(key)
  
  // Working memory (current context)
  pushContext(item)
  popContext()
  getContext(n)
  
  // Episodic (experiences)
  recordEpisode(episode)
  searchEpisodes(query)
  
  // Semantic (learned facts)
  learn(concept, knowledge)
  reinforce(concept, knowledge)
  getKnowledge(concept)
}
```

### 2. Skill System (`skills/library.js`)

#### Skill Structure

```javascript
class Skill {
  name           // Unique identifier
  description    // Human-readable description
  category       // Grouping (filesystem, code, git, etc.)
  tags           // Search tags
  inputSchema    // JSON Schema for validation
  outputSchema   // Expected output format
  handler        // async (params) => result
  timeout        // Max execution time
  retries        // Retry count on failure
}
```

#### Available Skill Categories

| Category | Skills | Purpose |
|----------|--------|---------|
| `filesystem` | read-file, write-file, list-directory, find-files, copy-file, delete-file | File operations |
| `code` | parse-ast, transform-code, format-code, minify-code, generate-code | Code manipulation |
| `git` | git-status, git-log, git-diff, git-commit, git-branch | Version control |
| `text` | search-text, replace-text, extract-text, parse-json, format-json, count-words | Text processing |
| `shell` | run-command, npm-install, npm-run | Shell execution |
| `data` | map-data, filter-data, group-data, sort-data, aggregate-data | Data transformation |
| `utility` | generate-uuid, hash-string, encode-base64, decode-base64, get-current-time, sleep | Utilities |

### 3. Workflow Engine (`workflows/engine.js`)

#### Workflow Structure

```javascript
class Workflow {
  id             // Unique identifier
  name           // Human-readable name
  description    // Purpose
  steps          // Map<stepId, WorkflowStep>
  variables      // Shared variables
  exitCondition  // Early exit condition
}

class WorkflowStep {
  id             // Step identifier
  name           // Step name
  skill          // Skill to execute
  handler        // Custom handler function
  subworkflow    // Nested workflow ID
  input          // Input mapping (supports $variable references)
  dependencies   // Array of prerequisite step IDs
  condition      // Execution condition
  retries        // Retry configuration
  onError        // 'fail' | 'continue'
}
```

#### Built-in Workflows

| Workflow | Purpose | Steps |
|----------|---------|-------|
| `code-review` | Automated code review | analyze-structure → analyze-complexity → find-smells → security-scan → suggest-refactorings → generate-report |
| `test-generation` | Generate tests | find-source-files → analyze-coverage → generate-tests |
| `documentation-generation` | Generate docs | analyze-structure → generate-readme → find-source-files → generate-api-docs |
| `refactoring` | Refactoring suggestions | find-smells → analyze-complexity → suggest-refactorings → simplify-conditionals → convert-to-async |
| `security-audit` | Security analysis | check-secrets → audit-dependencies → scan-vulnerabilities |
| `project-setup` | Initialize project | analyze-structure → generate-readme → generate-gitignore → setup-testing |
| `cicd-pipeline` | Generate CI/CD | analyze-project → detect-framework → generate-github-actions |

### 4. MCP Servers (`mcp-servers/index.js`)

#### Server Types

| Server | Tools | Purpose |
|--------|-------|---------|
| `filesystem` | read_file, write_file, list_directory, delete_file, search_files | File operations |
| `git` | git_status, git_log, git_diff, git_commit | Version control |
| `shell` | run_command, npm_install | Shell execution |
| `analysis` | analyze_complexity, find_patterns, extract_functions | Code analysis |
| `memory` | store, retrieve, list_keys, delete, search | Persistent storage |

#### Creating Custom MCP Server

```javascript
const { MCPServer } = require('./mcp-servers');

const server = new MCPServer({
  name: 'custom-server',
  description: 'My custom tools'
});

server.registerTool({
  name: 'my_tool',
  description: 'Does something',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string' }
    },
    required: ['param']
  },
  handler: async ({ param }) => {
    // Implementation
    return { result: 'done' };
  }
});

await server.start();
```

### 5. Prompt System (`prompts/index.js`)

#### System Prompts

| Prompt | Purpose |
|--------|---------|
| `orchestrator` | Master coordination instructions |
| `codeAnalyzer` | Code analysis guidelines |
| `refactorer` | Refactoring principles |
| `testGenerator` | Test creation guidelines |
| `documenter` | Documentation standards |
| `securityScanner` | Security analysis rules |

#### Prompt Builder

```javascript
const { PromptBuilder } = require('./prompts');

const prompt = new PromptBuilder()
  .system(systemPrompts.codeAnalyzer)
  .context(contextTemplates.repositoryContext, analysis)
  .task(taskPrompts.analyzeCode, code, 'javascript')
  .constraint('Focus on performance issues')
  .example('Input: const x = 1', 'Output: Simple variable declaration')
  .outputFormat('JSON with issues array')
  .build();
```

---

## Specialized Agents

### CodeAnalyzerAgent

**Skills:**
- `analyze-structure` - Directory/file structure analysis
- `analyze-complexity` - Cyclomatic/cognitive complexity
- `find-code-smells` - Anti-pattern detection
- `analyze-dependencies` - Import/export analysis
- `generate-metrics-report` - Comprehensive metrics

### RefactoringAgent

**Skills:**
- `suggest-refactorings` - Identify improvement opportunities
- `extract-function` - Extract code to new function
- `rename-symbol` - Rename across codebase
- `simplify-conditionals` - Reduce conditional complexity
- `convert-callbacks-to-async` - Modernize async code

### TestingAgent

**Skills:**
- `generate-unit-tests` - Create test files
- `analyze-coverage` - Test coverage analysis
- `generate-test-data` - Create fixtures and mocks

### DocumentationAgent

**Skills:**
- `generate-jsdoc` - Create JSDoc comments
- `generate-readme` - Create README.md
- `generate-api-docs` - API documentation

### SecurityAgent

**Skills:**
- `scan-vulnerabilities` - Code vulnerability detection
- `check-secrets` - Hardcoded secret detection
- `audit-dependencies` - Dependency vulnerability check

---

## ML Engine

### Q-Learning for Agent Selection

```javascript
// State encoding: agent + skill combination
const state = `${agent.id}:${skillName}`;

// Q-value update
newQ = currentQ + learningRate * (reward - currentQ);

// Agent selection
if (Math.random() < explorationRate) {
  return randomAgent; // Explore
}
return agentWithHighestQ; // Exploit
```

### Experience Replay

```javascript
mlEngine.recordExperience({
  skill: 'analyze-complexity',
  params: { filePath: 'index.js' },
  result: { complexity: 15 },
  success: true,
  duration: 150
});

// Find similar past experiences
const similar = mlEngine.findSimilarExperiences('analyze-complexity', params);
```

### Pattern Recognition

```javascript
// Patterns are automatically extracted from experiences
const patterns = mlEngine.patterns.get('analyze-complexity:success');
// { count: 42, avgDuration: 120, contexts: [...] }
```

---

## Adding New Components

### Adding a New Skill

```javascript
// 1. Create skill definition
const mySkill = new Skill({
  name: 'my-skill',
  description: 'Does something useful',
  category: 'custom',
  tags: ['example', 'custom'],
  inputSchema: {
    input: { type: 'string', required: true }
  },
  handler: async ({ input }) => {
    // Implementation
    return { output: processedInput };
  }
});

// 2. Register with skill registry
skillRegistry.register(mySkill);

// 3. Or register with specific agent
agent.registerSkill(mySkill);
```

### Adding a New Agent

```javascript
// 1. Extend Agent base class
class MyAgent extends Agent {
  constructor(config) {
    super({
      ...config,
      name: 'MyAgent',
      type: 'custom',
      description: 'My custom agent'
    });
    
    this.setupSkills();
  }
  
  setupSkills() {
    this.registerSkill(new Skill({
      name: 'my-operation',
      // ... skill config
    }));
  }
}

// 2. Register with orchestrator
orchestrator.registerAgent(new MyAgent());
```

### Adding a New Workflow

```javascript
// Using WorkflowBuilder
const { WorkflowBuilder } = require('./workflows/engine');

const workflow = new WorkflowBuilder('My Workflow')
  .id('my-workflow')
  .description('Does something useful')
  .tags('custom', 'example')
  
  .skill('step1', 'read-file', { path: '$input.filePath' })
  
  .skill('step2', 'analyze-complexity', 
    { filePath: '$input.filePath' },
    { dependencies: ['step1'] }
  )
  
  .handler('step3', async (input, ctx) => {
    return {
      summary: ctx.results['step1'],
      complexity: ctx.results['step2']
    };
  }, { dependencies: ['step1', 'step2'] })
  
  .build();

workflowEngine.register(workflow);
```

### Adding a New MCP Server

```javascript
const { MCPServer } = require('./mcp-servers');

function createMyMCPServer() {
  const server = new MCPServer({
    name: 'my-server',
    description: 'Custom functionality'
  });
  
  server.registerTool({
    name: 'my_tool',
    description: 'My custom tool',
    inputSchema: {
      type: 'object',
      properties: {
        param: { type: 'string' }
      }
    },
    handler: async ({ param }) => {
      return { result: 'processed' };
    }
  });
  
  server.registerResource({
    uri: 'custom://data',
    name: 'Custom Data',
    mimeType: 'application/json',
    handler: async () => ({ data: 'value' })
  });
  
  return server;
}
```

---

## Configuration

### CLI Configuration (`.copilot/config.json`)

```json
{
  "maxConcurrentTasks": 10,
  "autoAnalyze": true,
  "mlEnabled": true,
  "loggingLevel": "info"
}
```

### Environment Variables

```bash
DEBUG=true              # Enable debug logging
COPILOT_CONFIG_DIR=.copilot  # Config directory
ML_LEARNING_RATE=0.1    # ML learning rate
ML_EXPLORATION_RATE=0.2 # ML exploration rate
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `copilot init` | Initialize in current directory |
| `copilot analyze` | Analyze repository |
| `copilot status` | Show system status |
| `copilot agents` | List available agents |
| `copilot skills [category]` | List skills |
| `copilot workflows` | List workflows |
| `copilot run <workflow>` | Execute workflow |
| `copilot review <file>` | Code review |
| `copilot test <file>` | Generate tests |
| `copilot docs [file]` | Generate documentation |
| `copilot security [file]` | Security scan |
| `copilot refactor <file>` | Suggest refactorings |
| `copilot chat` | Interactive mode |
| `copilot help` | Show help |

---

## Error Handling

### Result Pattern

```javascript
// Skills return Result objects
const result = await agent.executeSkill('my-skill', params);

if (result.success) {
  console.log(result.result);
} else {
  console.error(result.error);
}
```

### Workflow Error Handling

```javascript
// Per-step error handling
{
  id: 'risky-step',
  skill: 'some-skill',
  retries: 3,
  onError: 'continue' // or 'fail'
}

// Workflow-level
try {
  await workflowEngine.execute('my-workflow', input);
} catch (error) {
  // Handle workflow failure
}
```

---

## Testing

### Running Tests

```bash
npm test                    # All tests
node tests/agents.test.js   # Agent tests
node tests/skills.test.js   # Skill tests
node tests/workflows.test.js # Workflow tests
```

### Writing Tests

```javascript
const { Agent, Skill } = require('./agents/core');

describe('Agent', () => {
  test('should execute skill', async () => {
    const agent = new Agent({ name: 'test' });
    agent.registerSkill(new Skill({
      name: 'test-skill',
      handler: async () => ({ value: 42 })
    }));
    
    const result = await agent.executeSkill('test-skill', {});
    expect(result.success).toBe(true);
    expect(result.result.value).toBe(42);
  });
});
```

---

## Metrics & Monitoring

### Agent Metrics

```javascript
agent.metrics = {
  tasksCompleted: 0,
  tasksFailed: 0,
  avgExecutionTime: 0,
  lastActive: null
};
```

### Orchestrator Stats

```javascript
orchestrator.getStats() // =>
{
  state: 'running',
  agentCount: 5,
  queuedTasks: 2,
  runningTasks: 3,
  metrics: {
    totalTasks: 100,
    completedTasks: 95,
    failedTasks: 5,
    avgTaskDuration: 150
  }
}
```

### ML Engine Stats

```javascript
mlEngine.getStats() // =>
{
  qTableSize: 50,
  patternsCount: 25,
  experienceBufferSize: 1000,
  metrics: {
    totalExperiences: 500,
    patternsLearned: 25,
    decisions: 200
  }
}
```

---

## Best Practices

### 1. Use Skills for Reusable Operations

```javascript
// ✅ Good - Reusable skill
await agent.executeSkill('read-file', { path: 'file.js' });

// ❌ Bad - Direct file access
fs.readFileSync('file.js');
```

### 2. Chain Workflows for Complex Tasks

```javascript
// ✅ Good - Workflow composition
const workflow = new WorkflowBuilder('Review and Test')
  .subworkflow('review', 'code-review', { rootDir: '$input.rootDir' })
  .subworkflow('tests', 'test-generation', 
    { rootDir: '$input.rootDir' },
    { dependencies: ['review'] }
  )
  .build();
```

### 3. Leverage ML for Optimization

```javascript
// The ML engine automatically learns from experience
// Just use the system normally and it improves over time

// Optionally, you can query learned patterns
const patterns = mlEngine.findSimilarExperiences('analyze-complexity', params);
```

### 4. Handle Errors at Every Level

```javascript
// Skill level
const result = await agent.executeSkill('risky-operation', params);
if (!result.success) {
  // Handle gracefully
}

// Workflow level - use onError: 'continue' for non-critical steps
// Orchestrator level - tasks are automatically retried
```

---

## Security Notes

1. **File Access**: All file operations are sandboxed to the project directory
2. **Shell Commands**: Commands are validated before execution
3. **Secrets**: Never log or persist sensitive data
4. **MCP Servers**: Run on localhost only by default
5. **ML Data**: Experience data doesn't include sensitive content

---

## Performance Tips

1. **Batch Operations**: Use `find-files` before individual operations
2. **Cache Results**: Agents cache frequently accessed data
3. **Parallel Execution**: Workflows run independent steps in parallel
4. **Lazy Loading**: MCP servers start on-demand
5. **Memory Limits**: Configure buffer sizes for large repos

---

*AGENTS.md v1.0 | Copilot CLI Bundle*
