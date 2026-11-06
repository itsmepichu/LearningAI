/**
 * Shared types and data helpers for the runnable snippets. Runnable Python for the Code section of a topic: a short program the reader can run, edit and run again in Pyodide.
 * Each snippet builds its files from the selected project's dataset (or is `neutral` and needs none). Plain data and
 * strings, so a test can run every snippet, for every project, through a local Python and check what it prints.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export interface SnippetBundle {
  code: string
  files: Record<string, string>
  /** Dataset files the bundle is built from, for the source line. Empty for a neutral snippet. */
  sources: string[]
}

export interface Snippet {
  title: string
  /** What the program does, in a sentence. */
  brief: string
  /** What the output does and does not show. */
  proves: string
  /** Shows no example data, so it is the same for every project. */
  neutral?: boolean
  build: (p: Project, read: DataReader) => Promise<SnippetBundle>
  /** Test only: Python run after the snippet, in its namespace, that must not raise. */
  check: string
}

export interface Message {
  language: string
  text: string
}

/** Each project's customer messages with their language, without repeats: up to 400 in English and 40 in each other language. */
export async function projectMessages(p: Project, read: DataReader): Promise<{ rows: Message[]; sources: string[] }> {
  let rows: Message[]
  let sources: string[]
  if (p.id === 'store') {
    sources = ['reviews.json', 'chats.json']
    rows = [...((await read.json('reviews.json')) as Message[]), ...((await read.json('chats.json')) as Message[])]
  } else {
    const files: Record<string, string> = { harbor: 'tickets.csv', bank: 'disputes.csv', travel: 'requests.csv' }
    sources = [files[p.id]]
    rows = (await read.csv(files[p.id])) as unknown as Message[]
  }
  const seen = new Set<string>()
  const count: Record<string, number> = {}
  const out: Message[] = []
  for (const r of rows) {
    const key = r.language + '\u0000' + r.text
    if (seen.has(key)) continue
    seen.add(key)
    const n = (count[r.language] = (count[r.language] ?? 0) + 1)
    if (n <= (r.language === 'en' ? 400 : 40)) out.push({ language: r.language, text: r.text })
  }
  return { rows: out, sources }
}

export const fromMessages = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources } = await projectMessages(p, read)
  return { code, files: { 'messages.json': JSON.stringify(rows) }, sources }
}
export const neutral = (code: string) => async (): Promise<SnippetBundle> => ({ code, files: {}, sources: [] })


export interface Labelled {
  text: string
  label: string
}

/** Each project's labelled English text: what a classifier learns from, and what the label means. */
export async function projectLabelled(p: Project, read: DataReader): Promise<{ rows: Labelled[]; sources: string[]; what: string }> {
  if (p.id === 'store') {
    const rows = (await read.csv('products.csv')) as unknown as { title: string; category: string }[]
    return { rows: rows.map((r) => ({ text: r.title, label: r.category })), sources: ['products.csv'], what: 'product titles and their category' }
  }
  const spec: Record<string, [string, string, string]> = {
    harbor: ['tickets.csv', 'category', 'support tickets and their category'],
    bank: ['disputes.csv', 'reason', 'dispute messages and their reason'],
    travel: ['requests.csv', 'intent', 'customer requests and their intent'],
  }
  const [file, field, what] = spec[p.id]
  const rows = (await read.csv(file)) as unknown as Record<string, string>[]
  return { rows: rows.filter((r) => r.language === 'en').map((r) => ({ text: r.text, label: r[field] })), sources: [file], what }
}

export interface Doc {
  id: string
  title: string
  text: string
}

/** Each project's reference documents: policies, fare rules, or (for the store) one line per product. */
export async function projectDocs(p: Project, read: DataReader): Promise<{ docs: Doc[]; sources: string[] }> {
  if (p.id === 'store') {
    const rows = (await read.csv('products.csv')) as unknown as Record<string, string>[]
    const docs = rows.map((r) => ({
      id: r.sku,
      title: r.title,
      text: `${r.title} costs ${Number(r.price_inr).toLocaleString('en-IN')} rupees and is rated ${r.rating} from ${r.review_count} reviews.`,
    }))
    return { docs, sources: ['products.csv'] }
  }
  const file = { harbor: 'policies.json', bank: 'policies.json', travel: 'fare_rules.json' }[p.id as 'harbor' | 'bank' | 'travel']
  const rows = (await read.json(file)) as (Doc & { current?: boolean })[]
  return { docs: rows.filter((d) => d.current !== false).map((d) => ({ id: d.id, title: d.title, text: d.text })), sources: [file] }
}

/** One numeric column per project, with a grouping column, for the summary and supervised examples. */
export const NUMBER_COLUMNS: Record<string, { file: string; column: string; what: string; group: string }> = {
  harbor: { file: 'tickets.csv', column: 'resolved_hours', what: 'hours to resolve a ticket', group: 'priority' },
  store: { file: 'orders.csv', column: 'price_inr', what: 'order price in rupees', group: 'category' },
  bank: { file: 'transactions.csv', column: 'amount_inr', what: 'transaction amount in rupees', group: 'channel' },
  travel: { file: 'bookings.csv', column: 'fare_inr', what: 'booking fare in rupees', group: 'product' },
}

type Row = Record<string, string>
interface TableSpec {
  file: string
  target: string
  isPositive: (r: Row) => boolean
  features: Record<string, (r: Row) => number>
  leak: [string, (r: Row) => number]
  slice: string
  month: (r: Row) => string
}

/** Each project's yes/no prediction task on its table: numeric features, a rare outcome, a leaky column, a slice and a month. */
const TABLES: Record<string, TableSpec> = {
  harbor: {
    file: 'tickets.csv',
    target: 'high or urgent ticket',
    isPositive: (r) => r.priority === 'high' || r.priority === 'urgent',
    features: {
      security: (r) => +(r.category === 'security'),
      bug: (r) => +(r.category === 'bug'),
      chat: (r) => +(r.channel === 'chat'),
      night: (r) => +(Number(r.created.slice(11, 13)) < 6),
    },
    leak: ['resolved_hours', (r) => Number(r.resolved_hours)],
    slice: 'channel',
    month: (r) => r.created.slice(0, 7),
  },
  store: {
    file: 'orders.csv',
    target: 'returned order',
    isPositive: (r) => r.returned === '1',
    features: {
      price_inr: (r) => Number(r.price_inr),
      delivery_days: (r) => Number(r.delivery_days),
      festive_sale: (r) => Number(r.festive_sale),
      cash_on_delivery: (r) => +(r.payment === 'COD'),
      city_tier: (r) => Number(r.city_tier),
    },
    leak: ['refund_amount_inr', (r) => Number(r.refund_amount_inr)],
    slice: 'category',
    month: (r) => r.order_date.slice(0, 7),
  },
  bank: {
    file: 'transactions.csv',
    target: 'fraudulent transaction',
    isPositive: (r) => r.fraud === '1',
    features: {
      amount_vs_customer_avg: (r) => Number(r.amount_vs_customer_avg),
      is_foreign: (r) => Number(r.is_foreign),
      txns_last_24h: (r) => Number(r.txns_last_24h),
      night: (r) => +(Number(r.hour) < 6),
    },
    leak: ['chargeback_filed', (r) => Number(r.chargeback_filed)],
    slice: 'channel',
    month: (r) => r.timestamp.slice(0, 7),
  },
  travel: {
    file: 'bookings.csv',
    target: 'cancelled booking',
    isPositive: (r) => r.cancelled === '1',
    features: {
      lead_days: (r) => Number(r.lead_days),
      refundable: (r) => Number(r.refundable),
      fare_inr: (r) => Number(r.fare_inr),
      passengers: (r) => Number(r.passengers),
    },
    leak: ['cancellation_fee_inr', (r) => Number(r.cancellation_fee_inr)],
    slice: 'product',
    month: (r) => r.booked_on.slice(0, 7),
  },
}

/** The project's prediction task as plain arrays, ready to write to `table.json`. */
export async function projectTable(p: Project, read: DataReader) {
  const t = TABLES[p.id]
  const rows = (await read.csv(t.file)) as unknown as Row[]
  const names = Object.keys(t.features)
  return {
    sources: [t.file],
    table: {
      target: t.target,
      features: names,
      X: rows.map((r) => names.map((n) => t.features[n](r))),
      y: rows.map((r) => +t.isPositive(r)),
      leak_name: t.leak[0],
      leak: rows.map((r) => t.leak[1](r)),
      slice_name: t.slice,
      slice: rows.map((r) => r[t.slice]),
      month: rows.map((r) => t.month(r)),
    },
  }
}

export interface ActionItem {
  id: string
  amount: number
  reason: string
}

export interface ProjectActions {
  /** The write action an agent proposes, the record it acts on and the money it moves. */
  action: string
  entity: string
  currency: string
  /** Amounts above this need a person's approval (illustrative). */
  threshold: number
  idPattern: string
  reasons: string[]
  items: ActionItem[]
}

const SLA_HOURS: Record<string, number> = { low: 48, normal: 24, high: 8, urgent: 4 }

/**
 * Each project's money-moving agent action, with up to 150 real cases from its dataset: Harbor's service credits for
 * tickets resolved after their target (an illustrative 10 dollars an hour over, at most 200), the store's refunds on
 * returned orders, the bank's provisional credits on disputes, and the travel agency's refunds on cancelled bookings.
 */
export async function projectActions(p: Project, read: DataReader): Promise<{ actions: ProjectActions; sources: string[] }> {
  let a: Omit<ProjectActions, 'items'>
  let items: ActionItem[]
  let sources: string[]
  if (p.id === 'harbor') {
    const rows = (await read.csv('tickets.csv')) as unknown as Row[]
    sources = ['tickets.csv']
    a = { action: 'issue_credit', entity: 'ticket', currency: 'dollars', threshold: 50, idPattern: '^T-[0-9]{6}$', reasons: ['sla_breach', 'outage', 'billing_error'] }
    items = rows
      .filter((r) => Number(r.resolved_hours) > SLA_HOURS[r.priority])
      .map((r) => ({ id: r.ticket_id, amount: Math.min(200, Math.round(10 * (Number(r.resolved_hours) - SLA_HOURS[r.priority]))), reason: 'sla_breach' }))
  } else if (p.id === 'store') {
    const rows = (await read.csv('orders.csv')) as unknown as Row[]
    sources = ['orders.csv']
    a = { action: 'refund_order', entity: 'order', currency: 'rupees', threshold: 5000, idPattern: '^OD-[0-9]{7}$', reasons: ['damaged', 'wrong_item', 'not_delivered', 'changed_mind'] }
    const reasons = a.reasons
    items = rows.filter((r) => r.returned === '1').map((r, i) => ({ id: r.order_id, amount: Number(r.refund_amount_inr), reason: reasons[i % reasons.length] }))
  } else if (p.id === 'bank') {
    const disputes = (await read.csv('disputes.csv')) as unknown as Row[]
    const txns = (await read.csv('transactions.csv')) as unknown as Row[]
    const amount = new Map(txns.map((t) => [t.txn_id, Number(t.amount_inr)]))
    sources = ['disputes.csv', 'transactions.csv']
    a = { action: 'provisional_credit', entity: 'dispute', currency: 'rupees', threshold: 2500, idPattern: '^DS-[0-9]{5}$', reasons: ['unrecognised', 'duplicate', 'not_received', 'failed_upi', 'amount_differs'] }
    items = disputes.filter((d) => amount.has(d.txn_id)).map((d) => ({ id: d.case_id, amount: amount.get(d.txn_id)!, reason: d.reason }))
  } else {
    const rows = (await read.csv('bookings.csv')) as unknown as Row[]
    sources = ['bookings.csv']
    a = { action: 'refund_booking', entity: 'booking', currency: 'rupees', threshold: 20000, idPattern: '^SN-[0-9]{6}$', reasons: ['traveller_cancelled', 'disruption', 'schedule_change'] }
    items = rows
      .filter((r) => r.cancelled === '1')
      .map((r, i) => ({ id: r.booking_id, amount: Number(r.fare_inr) - Number(r.cancellation_fee_inr), reason: ['traveller_cancelled', 'disruption', 'schedule_change'][i % 3] }))
  }
  return { actions: { ...a, items: items.slice(0, 150) }, sources }
}

/** A snippet built on the project's agent action: writes `actions.json`. */
export const fromActions = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { actions, sources } = await projectActions(p, read)
  return { code, files: { 'actions.json': JSON.stringify(actions) }, sources }
}
