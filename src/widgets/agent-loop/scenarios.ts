import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadSagaRef } from '../saga/scenarios.ts'
import type { AgentScript } from './trace'

interface Doc {
  id: string
  text: string
}

/** The first sentence of a policy, without its full stop, for an observation line. */
const firstSentence = (docs: Doc[], id: string) => docs.find((d) => d.id === id)!.text.split(/\.\s/)[0].replace(/\.$/, '')

/** One task per project. References and policy wording come from the dataset; the tool results are scripted. */
export async function loadAgentScript(p: Project, read: DataReader): Promise<{ file: string; script: AgentScript }> {
  const { file, ref } = await loadSagaRef(p, read)
  const [row] = await read.csv(file, 1)
  if (p.id === 'store') {
    const price = `${row.price_inr} rupees`
    return {
      file,
      script: {
        task: `Order ${ref} shows as delivered, but the shopper says it never arrived. Refund it if the fault is ours.`,
        plan: 'Look up the order, inspect the delivery events, check the returns rule, then act',
        lookup: { call: `get_order(id="${ref}")`, result: `${ref}: ${row.category}, marked delivered, price ${price}` },
        inspect: { call: `get_shipping_events(order="${ref}")`, result: 'The courier scanned it as delivered with no signature or photo' },
        policy: { call: 'check_returns_policy(reason="not_received")', result: 'Unproven delivery: full refund, automatic up to 500 rupees' },
        act: { call: `propose_refund(order="${ref}")`, result: `Refund RF-77 created for ${price}, computed in code and approved automatically` },
        final: `The courier has no proof of delivery for ${ref}, so I refunded ${price} (refund RF-77). It should reach you in 5 to 7 working days`,
        escalation: `“${ref} marked delivered; delivery events unavailable because of timeouts; no refund issued.”`,
      },
    }
  }
  if (p.id === 'bank') {
    const docs = await read.json<Doc[]>('policies.json')
    return {
      file,
      script: {
        task: `Case ${ref}: money was debited but the customer’s UPI payment failed. Credit the customer if the rule allows it.`,
        plan: 'Open the case, find the transaction, read the rule, then act',
        lookup: { call: `get_case(id="${ref}")`, result: `${ref}: open, reason ${row.reason}` },
        inspect: { call: `get_transaction(case="${ref}")`, result: 'Debit found, no matching credit after 2 working days' },
        policy: { call: 'get_policy(id="NB-002")', result: firstSentence(docs, 'NB-002') },
        act: { call: `propose_provisional_credit(case="${ref}")`, result: 'Credit CR-77 created, with the amount computed in code, and sent for approval' },
        final: `The debit on ${ref} was not reversed within 2 working days, so I raised provisional credit CR-77. It is waiting for approval by the operations team`,
        escalation: `“${ref} is a failed UPI payment; transaction data unavailable because of timeouts; no credit raised.”`,
      },
    }
  }
  if (p.id === 'travel') {
    const docs = await read.json<Doc[]>('fare_rules.json')
    return {
      file,
      script: {
        task: `Booking ${ref}: the airline cancelled the flight because of fog. Rebook the traveller or refund them.`,
        plan: 'Open the booking, confirm the disruption, read the rule, then act',
        lookup: { call: `get_booking(id="${ref}")`, result: `${ref}: ${row.product}, ${row.origin} to ${row.destination}, with its flight cancelled by the airline` },
        inspect: { call: `get_disruptions(booking="${ref}")`, result: 'Fog on the travel date, with flights cancelled across the route' },
        policy: { call: 'get_fare_rule(id="SR-007")', result: firstSentence(docs, 'SR-007') },
        act: { call: `propose_rebooking(booking="${ref}")`, result: 'Rebooking RB-77 proposed on the next available flight, at no charge' },
        final: `Fog cancelled the flight on ${ref}, so I proposed a free rebooking on the next available flight (RB-77). You can choose a full refund instead`,
        escalation: `“${ref} was cancelled by the airline; disruption data unavailable because of timeouts; nothing changed.”`,
      },
    }
  }
  return {
    file,
    script: {
      task: `Account ${row.account_id}: why was invoice INV-2291 charged twice? Fix it if the error is ours.`,
      plan: 'Look up the invoice, inspect the payment events, check the refund rule, then act',
      lookup: { call: 'search_invoices(id="INV-2291")', result: 'INV-2291: two charges of $49.00 on 1 October (ch_1, ch_2)' },
      inspect: { call: 'get_payment_events(invoice="INV-2291")', result: 'ch_2 came from an automatic retry after a gateway timeout, with no idempotency key' },
      policy: { call: 'check_refund_policy(reason="duplicate_charge")', result: 'Duplicate charges: full refund, automatic up to $50' },
      act: { call: 'propose_refund(charge="ch_2")', result: 'Refund R-77 created for $49.00, computed in code and approved automatically' },
      final: 'INV-2291 was charged twice because a payment retry ran without an idempotency key. I refunded the duplicate charge ch_2 ($49.00, refund R-77)',
      escalation: '“INV-2291 double charge confirmed; payment events unavailable because of timeouts; no refund issued.”',
    },
  }
}
