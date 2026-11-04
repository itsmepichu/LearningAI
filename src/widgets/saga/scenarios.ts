import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import type { SagaStep } from './events'

export interface SagaScenario {
  task: string
  steps: SagaStep[]
}

const SOURCE: Record<ProjectId, { file: string; column: string }> = {
  harbor: { file: 'tickets.csv', column: 'ticket_id' },
  store: { file: 'orders.csv', column: 'order_id' },
  bank: { file: 'disputes.csv', column: 'case_id' },
  travel: { file: 'bookings.csv', column: 'booking_id' },
}

export const SAGAS: Record<ProjectId, SagaScenario> = {
  harbor: {
    task: 'a service credit on ticket',
    steps: [
      { action: 'open a credit case', undo: 'close the credit case', failure: 'The case system timed out' },
      { action: 'reserve the credit on the account', undo: 'release the reserved credit', failure: 'An admin has locked the account' },
      { action: 'post the credit to the invoice', undo: 'reverse the invoice credit', failure: 'Billing rejected the credit' },
      { action: 'email the customer', undo: null, failure: 'The mail provider rejected the address' },
    ],
  },
  store: {
    task: 'an exchange on order',
    steps: [
      { action: 'reserve the replacement item', undo: 'release the replacement item', failure: 'The item has just sold out' },
      { action: 'book the return pickup', undo: 'cancel the pickup', failure: 'The courier has no slots left' },
      { action: 'charge the price difference', undo: 'refund the price difference', failure: 'The UPI payment was declined' },
      { action: 'send the confirmation message', undo: null, failure: 'The messaging service is down' },
    ],
  },
  bank: {
    task: 'a provisional credit on case',
    steps: [
      { action: 'place a hold on the disputed amount', undo: 'release the hold', failure: 'The transaction was not found' },
      { action: 'post the provisional credit', undo: 'reverse the provisional credit', failure: 'Core banking rejected the posting' },
      { action: 'update the case status', undo: 'restore the previous case status', failure: 'The case system timed out' },
      { action: 'notify the customer', undo: null, failure: 'The notification service is down' },
    ],
  },
  travel: {
    task: 'a package on booking',
    steps: [
      { action: 'reserve the flight', undo: 'cancel the flight', failure: 'The fare is no longer available' },
      { action: 'reserve the hotel', undo: 'cancel the hotel', failure: 'No rooms are left' },
      { action: 'charge the card', undo: 'refund the card', failure: 'The card was declined' },
      { action: 'send the confirmation email', undo: null, failure: 'The mail provider rejected the address' },
    ],
  },
}

/** The first record in the project's dataset gives the saga a real reference for its idempotency keys. */
export async function loadSagaRef(p: Project, read: DataReader): Promise<{ file: string; ref: string }> {
  const { file, column } = SOURCE[p.id]
  const [row] = await read.csv(file, 1)
  return { file, ref: row[column] }
}
