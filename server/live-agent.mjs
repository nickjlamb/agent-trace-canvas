import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBCRAWL_BIN = path.resolve(__dirname, '..', 'node_modules/@pharmatools/pubcrawl/dist/index.js')

// Focused tool subset, mapped to canvas node kinds.
const TOOL_KIND = {
  search_pubmed: 'tool_call',
  get_abstract: 'retrieval',
  get_full_text: 'retrieval',
  find_related: 'tool_call',
  format_citation: 'tool_call',
  search_trials: 'tool_call',
  get_trial: 'tool_call',
}
const ALLOWED = Object.keys(TOOL_KIND)

const SYSTEM = `You are a biomedical literature agent. Answer the user's question ONLY by using the provided PubCrawl tools to find real evidence, then give a concise, cited answer.

Rules:
- ALWAYS call search_pubmed first, then get_abstract for the key paper(s), before answering. Cite PMIDs in square brackets.
- Prefer the primary trial's quantitative result with its confidence interval. Note important caveats (e.g. clinical vs statistical significance, safety).
- Be concise — a few sentences. When you have enough evidence, give a final answer with NO further tool calls.
- If the question is not about biomedical, clinical, or drug/trial literature, reply in one sentence that you only answer biomedical evidence questions, and do not call any tools.`

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['pass', 'warn', 'fail'] },
    score: { type: 'number' },
    note: { type: 'string' },
  },
  required: ['status', 'score', 'note'],
}

// Single shared MCP client (spawned once, reused across runs).
let mcpClient = null
let mcpToolsCache = null
async function getMcp() {
  if (mcpClient) return mcpClient
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [PUBCRAWL_BIN],
    stderr: 'ignore',
  })
  const c = new Client({ name: 'agent-trace-canvas-live', version: '1.0.0' }, { capabilities: {} })
  await c.connect(transport)
  mcpClient = c
  return c
}

function textOf(content) {
  return (content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
}

/**
 * Run a real literature agent (Claude + PubCrawl MCP), emitting canvas
 * trace events through onEvent: {type:'node'|'edge'|'run_complete', ...}.
 * The caller emits run_start before invoking this.
 */
export async function runLiveAgent({ question, model, maxSteps, anthropic, onEvent }) {
  const mcp = await getMcp()
  if (!mcpToolsCache) {
    const { tools } = await mcp.listTools()
    mcpToolsCache = tools
      .filter((t) => ALLOWED.includes(t.name))
      .map((t) => ({
        name: t.name,
        description: (t.description || '').slice(0, 280),
        input_schema: t.inputSchema || { type: 'object', properties: {} },
      }))
  }
  // Static tools + system → cache the prefix across the run's calls.
  const tools = mcpToolsCache.map((t) => ({ ...t }))
  if (tools.length) tools[tools.length - 1].cache_control = { type: 'ephemeral' }
  const system = [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }]

  const messages = [{ role: 'user', content: question }]

  let counter = 0
  let prevId = null
  const nextId = () => 'n' + ++counter
  const emitNode = (node) => {
    onEvent({ type: 'node', node })
    if (prevId) onEvent({ type: 'edge', edge: { from: prevId, to: node.id } })
    prevId = node.id
  }

  let answer = null

  for (let step = 0; step < maxSteps; step++) {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system,
      tools,
      messages,
    })
    messages.push({ role: 'assistant', content: resp.content })

    const text = textOf(resp.content)
    const toolUses = resp.content.filter((b) => b.type === 'tool_use')

    if (toolUses.length === 0) {
      answer = text || '(no answer produced)'
      emitNode({
        id: nextId(),
        kind: 'model_call',
        label: 'Answer',
        input: 'Synthesize a cited answer from the retrieved evidence',
        output: answer,
        tokens: { in: resp.usage.input_tokens, out: resp.usage.output_tokens },
        eval: { status: 'pass', score: 0.9, note: 'Final answer produced' },
      })
      break
    }

    if (step === 0 && text) {
      emitNode({
        id: nextId(),
        kind: 'model_call',
        label: 'Plan',
        input: question,
        output: text.slice(0, 500),
        tokens: { in: resp.usage.input_tokens, out: resp.usage.output_tokens },
        eval: { status: 'pass', score: 0.92, note: 'Planned the approach' },
      })
    }

    const toolResults = []
    for (const tu of toolUses) {
      const kind = TOOL_KIND[tu.name] || 'tool_call'
      let out = '',
        isErr = false
      try {
        const r = await mcp.callTool({ name: tu.name, arguments: tu.input })
        out = (r.content || []).map((c) => c.text || '').join('\n')
        if (r.isError) isErr = true
      } catch (e) {
        out = 'Tool error: ' + e.message
        isErr = true
      }
      const evalResult = isErr
        ? { status: 'fail', score: 0.2, note: 'Tool call errored' }
        : out.trim()
          ? { status: 'pass', score: 0.95, note: 'Returned data' }
          : { status: 'warn', score: 0.5, note: 'Empty result' }
      emitNode({
        id: nextId(),
        kind,
        label: tu.name,
        input: JSON.stringify(tu.input).slice(0, 300),
        output: out.slice(0, 700),
        eval: evalResult,
      })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: out.slice(0, 4000),
        is_error: isErr,
      })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  if (answer === null) {
    answer = 'Reached the step limit before producing a final answer.'
    emitNode({
      id: nextId(),
      kind: 'model_call',
      label: 'Answer (truncated)',
      output: answer,
      eval: { status: 'warn', score: 0.4, note: 'Step limit reached' },
    })
  }

  // Faithfulness eval as a decision node (real second model call).
  try {
    const evidence = messages
      .filter((m) => m.role === 'user' && Array.isArray(m.content))
      .flatMap((m) => m.content)
      .filter((c) => c.type === 'tool_result')
      .map((c) => (typeof c.content === 'string' ? c.content : ''))
      .join('\n')
      .slice(0, 6000)
    const grade = await anthropic.messages.create({
      model,
      max_tokens: 400,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low', format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
      system:
        'You grade whether an answer is faithful to retrieved evidence, using ONLY that evidence. pass = every claim supported; warn = partially supported or overstated magnitude; fail = a key claim is unsupported.',
      messages: [
        {
          role: 'user',
          content: `Question: ${question}\n\nAnswer: ${answer}\n\nEvidence:\n${evidence}\n\nGrade the answer's faithfulness.`,
        },
      ],
    })
    const v = JSON.parse(textOf(grade.content) || '{}')
    if (v.status) {
      emitNode({
        id: nextId(),
        kind: 'decision',
        label: 'Faithfulness check',
        input: 'Grade the answer against the retrieved evidence',
        output: v.note || '',
        eval: { status: v.status, score: typeof v.score === 'number' ? v.score : 0.8, note: v.note || '' },
      })
    }
  } catch {
    /* eval is best-effort; skip on error */
  }

  onEvent({ type: 'run_complete' })
}
