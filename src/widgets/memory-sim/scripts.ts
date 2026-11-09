import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import type { Fact } from './strategies'

export const TURNS = 24

/**
 * A scripted conversation per project. `{ref}` is a record from the dataset and `{company}` comes from projects.json.
 * Each script states its facts at the same turns, and its last turns need those facts, so the projects compare fairly.
 */
const SCRIPTS: Record<ProjectId, { turns: string[]; facts: Fact[] }> = {
  harbor: {
    turns: [
      'Hi, I need help with our {company} subscription.',
      'Our account ID is {ref}.',
      'We are on the EU data-residency plan.',
      'Can you check last month’s invoice?',
      'Thanks. Also the PDF export is slow.',
      'Here is a screenshot of the export screen.',
      'Please reply in German from now on.',
      'Ok, the export works after the update.',
      'Another question about seats.',
      'We have 40 seats today.',
      'Can we add 10 more?',
      'Project Falcon launches on 12 March, so we need them before that.',
      'What would that cost?',
      'Is there a discount for annual billing?',
      'Fine, we will think about it.',
      'Our admin contact is Priya N.',
      'Different topic: API rate limits.',
      'We get 429 errors at peak.',
      'What are our current limits?',
      'Could they be raised?',
      'Thanks, one more thing.',
      'Is the new US-only analytics feature available to us?',
      'And can Priya approve the seat increase?',
      'When must the seats be added at the latest?',
    ],
    facts: [
      { name: 'Account ID {ref}', turn: 2, summary: 'full', store: 'full' },
      { name: 'EU data-residency plan', turn: 3, summary: 'full', store: 'full' },
      { name: 'Reply in German', turn: 7, summary: 'full', store: 'full' },
      { name: 'Falcon launch date 12 March', turn: 12, summary: 'gist', store: 'full' },
      { name: 'Admin contact Priya N.', turn: 16, summary: 'gist', store: 'lost' },
    ],
  },
  store: {
    turns: [
      'Hi, I need help with an order from {company}.',
      'The order ID is {ref}.',
      'Please deliver to my office in Pune, not my home.',
      'Can you check when it ships?',
      'Thanks. Also the app is slow today.',
      'Here is a screenshot of the tracking page.',
      'Please reply in Tamil from now on.',
      'Ok, the page loads now.',
      'Another question, about running shoes.',
      'I normally wear UK 9.',
      'Do you have the Trailfox pair in that size?',
      'My marathon is on 14 March, so I need them before that.',
      'What would delivery cost?',
      'Is there a discount for paying by UPI?',
      'Fine, I will think about it.',
      'My brother Arjun will collect the parcel.',
      'Different topic: returns.',
      'The last mixer jar I bought leaked.',
      'How long do I have to return it?',
      'Could you arrange a pickup?',
      'Thanks, one more thing.',
      'Can the shoes go to the same address as the order?',
      'And can Arjun sign for them?',
      'What is the last day to order so they arrive in time?',
    ],
    facts: [
      { name: 'Order ID {ref}', turn: 2, summary: 'full', store: 'full' },
      { name: 'Deliver to the Pune office', turn: 3, summary: 'full', store: 'full' },
      { name: 'Reply in Tamil', turn: 7, summary: 'full', store: 'full' },
      { name: 'Marathon date 14 March', turn: 12, summary: 'gist', store: 'full' },
      { name: 'Arjun collects the parcel', turn: 16, summary: 'gist', store: 'lost' },
    ],
  },
  bank: {
    turns: [
      'Hi, I need help with a dispute at {company}.',
      'The case number is {ref}.',
      'Statements on my account must go by post only.',
      'Can you check the status?',
      'Thanks. Also the app logged me out.',
      'Here is a screenshot of the error.',
      'Please reply in Tamil from now on.',
      'Ok, I can log in again.',
      'Another question, about my card.',
      'I am travelling next month.',
      'Will my card work abroad?',
      'I fly to Singapore on 12 March, so I need it sorted before then.',
      'What fee would I pay?',
      'Is there a lower markup on any card?',
      'Fine, I will think about it.',
      'My nominee on the account is Meena R.',
      'Different topic: UPI limits.',
      'A payment of mine failed at the limit.',
      'What is my daily limit?',
      'Could it be raised?',
      'Thanks, one more thing.',
      'Can the new statement be sent by email?',
      'And can Meena act on the account while I am away?',
      'What is the last date to raise the limit before I travel?',
    ],
    facts: [
      { name: 'Case {ref}', turn: 2, summary: 'full', store: 'full' },
      { name: 'Statements by post only', turn: 3, summary: 'full', store: 'full' },
      { name: 'Reply in Tamil', turn: 7, summary: 'full', store: 'full' },
      { name: 'Travel date 12 March', turn: 12, summary: 'gist', store: 'full' },
      { name: 'Nominee Meena R.', turn: 16, summary: 'gist', store: 'lost' },
    ],
  },
  travel: {
    turns: [
      'Hi, I need help with a trip booked through {company}.',
      'The booking reference is {ref}.',
      'One of us uses a wheelchair and needs assistance at the airport.',
      'Can you check the flight times?',
      'Thanks. Also the app is slow today.',
      'Here is a screenshot of the itinerary.',
      'Please reply in Tamil from now on.',
      'Ok, the itinerary loads now.',
      'Another question, about the hotel.',
      'We are three adults.',
      'Can we add one more room?',
      'My sister’s wedding is on 18 December, so we must arrive by the 16th.',
      'What would the room cost?',
      'Is there a discount for a longer stay?',
      'Fine, we will think about it.',
      'The booking contact is Kavya S.',
      'Different topic: fog delays.',
      'Last winter our flight was cancelled.',
      'What happens if that happens again?',
      'Could we move to an earlier flight?',
      'Thanks, one more thing.',
      'Does the earlier flight have step-free boarding?',
      'And can Kavya approve the change?',
      'What is the latest flight that still gets us there in time?',
    ],
    facts: [
      { name: 'Booking {ref}', turn: 2, summary: 'full', store: 'full' },
      { name: 'Wheelchair assistance needed', turn: 3, summary: 'full', store: 'full' },
      { name: 'Reply in Tamil', turn: 7, summary: 'full', store: 'full' },
      { name: 'Must arrive by 16 December', turn: 12, summary: 'gist', store: 'full' },
      { name: 'Booking contact Kavya S.', turn: 16, summary: 'gist', store: 'lost' },
    ],
  },
}

const SOURCE: Record<ProjectId, { file: string; column: string }> = {
  harbor: { file: 'tickets.csv', column: 'account_id' },
  store: { file: 'orders.csv', column: 'order_id' },
  bank: { file: 'disputes.csv', column: 'case_id' },
  travel: { file: 'bookings.csv', column: 'booking_id' },
}

export async function loadScript(p: Project, read: DataReader): Promise<{ file: string; turns: string[]; facts: Fact[] }> {
  const { file, column } = SOURCE[p.id]
  const [row] = await read.csv(file, 1)
  const fill = (s: string) => s.replace(/\{ref\}/g, row[column]).replace(/\{company\}/g, p.company)
  const script = SCRIPTS[p.id]
  return { file, turns: script.turns.map(fill), facts: script.facts.map((f) => ({ ...f, name: fill(f.name) })) }
}
