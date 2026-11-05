import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS, projectOf, readerOf } from '../kit/testing.ts'
import { loadAgentScript } from './scenarios.ts'
import { agentEvents, agentSteps, dollars, type AgentScript } from './trace.ts'

const pair = (n: string) => ({ call: `${n}()`, result: `${n} result` })
const SCRIPT: AgentScript = { task: 't', plan: 'p', lookup: pair('lookup'), inspect: pair('inspect'), policy: pair('policy'), act: pair('act'), final: 'done', escalation: 'esc' }

test('a clean run plans, acts four times and answers', () => {
  assert.deepEqual(agentSteps(SCRIPT, false).map((s) => s.kind), ['plan', 'action', 'action', 'action', 'action', 'final'])
})

test('a failing tool is retried once, then the loop detector escalates', () => {
  const steps = agentSteps(SCRIPT, true)
  assert.deepEqual(steps.map((s) => s.kind), ['plan', 'action', 'action', 'action', 'stop'])
  assert.deepEqual(steps.filter((s) => s.failed).length, 2)
  assert.match(steps[3].text, /\(retry\)$/)
  assert.match(steps[4].text, /esc$/)
})

test('the running cost adds up in exact tenths of a cent', () => {
  const events = agentEvents(agentSteps(SCRIPT, false), 10)
  assert.match(events.at(-1)!.detail!, /\$0\.030$/)
  assert.equal(dollars(4), '$0.004')
})

test('a limit below the script cuts the run and escalates', () => {
  const events = agentEvents(agentSteps(SCRIPT, false), 3)
  assert.equal(events.length, 4)
  assert.equal(events[3].status, 'Step limit')
  assert.equal(events[3].tone, 'bad')
})

test('a limit equal to the script does not trigger', () => {
  assert.equal(agentEvents(agentSteps(SCRIPT, false), 6).at(-1)!.status, 'Step 6, Final answer')
})

test('tones show success and failure', () => {
  const failed = agentEvents(agentSteps(SCRIPT, true), 10)
  assert.equal(failed[2].tone, 'bad')
  assert.equal(failed.at(-1)!.tone, 'bad')
  assert.equal(agentEvents(agentSteps(SCRIPT, false), 10).at(-1)!.tone, 'ok')
})

for (const id of PROJECT_IDS) {
  test(`${id}: the script names real records and reads as sentences`, async () => {
    const { file, script } = await loadAgentScript(projectOf(id), readerOf(id))
    const [row] = await readerOf(id).csv(file, 1)
    const reference = id === 'harbor' ? row.account_id : row[{ store: 'order_id', bank: 'case_id', travel: 'booking_id' }[id]]
    assert.ok(script.task.includes(reference), `the task should name ${reference}`)
    for (const text of [script.plan, script.final, script.lookup.result, script.inspect.result, script.policy.result, script.act.result]) {
      assert.ok(text.trim(), 'no empty text')
      assert.ok(!text.endsWith('.'), `the event list adds the full stop: "${text}"`)
      assert.ok(!/undefined/.test(text), text)
    }
  })
}

test('store: the price comes from the order, not a fixed number', async () => {
  const [row] = await readerOf('store').csv('orders.csv', 1)
  const { script } = await loadAgentScript(projectOf('store'), readerOf('store'))
  assert.ok(script.lookup.result.includes(`${row.price_inr} rupees`))
  assert.ok(script.final.includes(`${row.price_inr} rupees`))
})

test('bank and travel: the policy text is quoted from the dataset', async () => {
  const bank = await loadAgentScript(projectOf('bank'), readerOf('bank'))
  const policies = await readerOf('bank').json<{ id: string; text: string }[]>('policies.json')
  assert.ok(policies.find((p) => p.id === 'NB-002')!.text.startsWith(bank.script.policy.result))
  const travel = await loadAgentScript(projectOf('travel'), readerOf('travel'))
  const rules = await readerOf('travel').json<{ id: string; text: string }[]>('fare_rules.json')
  assert.ok(rules.find((p) => p.id === 'SR-007')!.text.startsWith(travel.script.policy.result))
})
