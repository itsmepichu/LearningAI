/**
 * 11.2: one agent run as a loop, with the selected project's task from the 11.2 figure. The task, tool calls and
 * observations are the course's script for that project, built from its dataset; costs are the figure's illustrative
 * per-step costs. Pure.
 */
import { loadAgentScript } from '../../agent-loop/scenarios.ts'
import { agentSteps, dollars, type AgentScript } from '../../agent-loop/trace.ts'
import type { Story, WalkStep } from '../story.ts'

export interface AgentSeed {
  file: string
  script: AgentScript
}

/** The step limit the 11.2 figure starts with. */
const MAX_STEPS = 6

export const AGENT: Story<AgentSeed> = {
  id: 'agent',
  section: '11.2',
  title: 'One agent run, round the loop',
  nodes: [
    { id: 'task', label: 'Task', x: 70, y: 150 },
    { id: 'model', label: 'Model decides', x: 230, y: 70 },
    { id: 'validate', label: 'Validate call', x: 400, y: 70 },
    { id: 'tool', label: 'Run tool', x: 560, y: 70 },
    { id: 'observe', label: 'Observation', x: 560, y: 230 },
    { id: 'limits', label: 'Check limits', x: 400, y: 230 },
    { id: 'approve', label: 'Approval', x: 230, y: 230 },
    { id: 'done', label: 'Final answer', x: 70, y: 260 },
  ],
  edges: [
    { from: 'task', to: 'model' }, { from: 'model', to: 'validate' }, { from: 'validate', to: 'tool' }, { from: 'tool', to: 'observe' },
    { from: 'observe', to: 'limits' }, { from: 'limits', to: 'model' }, { from: 'model', to: 'approve' }, { from: 'approve', to: 'done' }, { from: 'model', to: 'done' },
  ],
  load: loadAgentScript,
  files: (s) => [s.file],
  note: (p) =>
    `The task and the tool results are the course's script for ${p.company}, built from its dataset as in the 11.2 figure; no model runs here. Costs per step are that figure's illustrative ones.`,
  steps: (_p, { script: s }): WalkStep[] => {
    const run = agentSteps(s, false)
    const failing = agentSteps(s, true)
    const spent = run.reduce((n, st) => n + st.mills, 0)
    const loopRows = run.filter((st) => st.kind === 'action').map((st, i) => [i + 1, st.text, st.observation ?? ''])
    return [
      {
        title: 'A task arrives',
        text: `“${s.task}” Unlike a fixed workflow, the steps are not known in advance: the agent has to look things up before it knows what to do. That is the only reason to pay for an agent's extra calls and risk.`,
        nodes: ['task'],
      },
      {
        title: 'The model plans and picks a tool',
        text: `The model reads the task, the tool descriptions and the conversation so far, and decides on a plan: “${s.plan}”. Its first decision is a structured tool call, not prose.`,
        nodes: ['model'],
        edges: [['task', 'model']],
        detail: { kind: 'code', label: 'The model’s first call', text: s.lookup.call },
      },
      {
        title: 'Code validates the call',
        text: 'Before anything runs, code checks the call against the tool’s schema (names, types, allowed values) and the user’s permissions: may this user read this record? A call that fails validation goes back to the model as an error message, not to the tool.',
        nodes: ['validate'],
        edges: [['model', 'validate']],
      },
      {
        title: 'The tool runs, and its result becomes an observation',
        text: `The tool runs with a timeout and returns: “${s.lookup.result}”. That observation is appended to the conversation, and the model reads it on its next turn. Tool output is data, not instructions: text inside it that says “ignore your rules” must not be obeyed (16.2).`,
        nodes: ['tool', 'observe'],
        edges: [['validate', 'tool'], ['tool', 'observe']],
      },
      {
        title: 'Check the limits, then go round again',
        text: `Each turn, code checks a step limit (${MAX_STEPS} here), a cost budget and whether the agent is repeating itself. Within the limits the loop continues: the model inspects (“${s.inspect.result}”), then reads the rule (“${s.policy.result}”).`,
        nodes: ['limits', 'model'],
        edges: [['observe', 'limits'], ['limits', 'model']],
        detail: { kind: 'table', caption: 'The loop so far: call and observation per step', head: ['Step', 'Call', 'Observation'], rows: loopRows.slice(0, 3) },
      },
      {
        title: 'An action that changes something waits for approval',
        text: `With the facts and the rule in hand, the model proposes the action: ${s.act.call}. Amounts are computed in code, not by the model, and anything above a threshold goes to a person (11.7). The result: “${s.act.result}”.`,
        nodes: ['model', 'approve'],
        edges: [['model', 'approve']],
        detail: { kind: 'code', label: 'The proposed action', text: s.act.call },
      },
      {
        title: 'The final answer',
        text: `The model stops calling tools and answers: “${s.final}”. The run took ${run.length} model turns and cost about ${dollars(spent)} at the figure's illustrative rates. Every call, observation and approval is logged with the run's id.`,
        nodes: ['done'],
        edges: [['approve', 'done']],
      },
      {
        title: 'When a tool keeps failing',
        text: `Suppose the inspection tool times out twice in a row with the same arguments. The loop detector stops the run after ${failing.length} steps instead of retrying forever, and escalates with what it has established: ${s.escalation} Stopping safely, with a clear hand-off, is part of the loop's design, not an error path added later.`,
        nodes: ['limits', 'done'],
        edges: [['limits', 'model'], ['model', 'done']],
      },
    ]
  },
}
