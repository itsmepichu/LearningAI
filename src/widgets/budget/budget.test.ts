import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PROJECT_IDS } from '../kit/testing.ts'
import { APPROVAL_LIMIT, BUDGETS, budgetEvents, usd } from './run.ts'

const S = BUDGETS.harbor
const statuses = (budget: number, amount: number) => budgetEvents(S, budget, amount).map((e) => e.status)

test('money formats from whole cents', () => {
  assert.equal(usd(5), '$0.05')
  assert.equal(usd(123), '$1.23')
})

test('a generous budget and a small amount run straight through', () => {
  assert.deepEqual(statuses(100, 40), ['Done', 'Done', 'Done', 'Done', 'Done', 'Done', 'Task complete'])
})

test('the approval limit is inclusive: exactly the limit does not pause', () => {
  assert.ok(!statuses(100, APPROVAL_LIMIT).includes('Paused'))
  assert.ok(statuses(100, APPROVAL_LIMIT + 5).includes('Paused'))
})

test('a pause is followed by the approval, and the run then goes on', () => {
  const s = statuses(100, 80)
  assert.equal(s[s.indexOf('Paused') + 1], 'Approved')
  assert.equal(s.at(-1), 'Task complete')
})

test('the task stops before a step that would pass the budget, without paying for it', () => {
  const events = budgetEvents(S, 10, 40)
  assert.equal(events.at(-1)!.status, 'Budget exhausted')
  assert.equal(events.at(-1)!.spent, 7)
  assert.match(events.at(-1)!.title, /get_account_usage/)
})

test('a budget equal to the total cost is enough', () => {
  const total = S.steps.reduce((n, s) => n + s.cents, 0)
  assert.equal(total, 23)
  assert.equal(budgetEvents(S, total, 40).at(-1)!.status, 'Task complete')
  assert.equal(budgetEvents(S, total - 1, 40).at(-1)!.status, 'Budget exhausted')
})

test('spending only ever rises', () => {
  const spent = budgetEvents(S, 100, 80).map((e) => e.spent)
  assert.deepEqual(spent, [...spent].sort((a, b) => a - b))
})

test('the settings the notes ask for end the way the notes imply', () => {
  assert.equal(budgetEvents(BUDGETS.store, 10, 80).at(-1)!.status, 'Budget exhausted')
  const travel = budgetEvents(BUDGETS.travel, 20, 120).map((e) => e.status)
  assert.ok(travel.includes('Paused'))
  assert.equal(travel.at(-1), 'Budget exhausted')
})

for (const id of PROJECT_IDS) {
  test(`${id}: exactly one step proposes the action, with an approver`, () => {
    const s = BUDGETS[id]
    assert.equal(s.steps.filter((x) => x.proposes).length, 1)
    assert.ok(s.approver)
    assert.equal(s.steps.length, 6)
  })
}
