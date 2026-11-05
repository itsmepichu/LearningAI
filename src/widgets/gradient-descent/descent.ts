/** Gradient descent on a real function with a local and a global minimum. Pure. */
export const loss = (x: number) => 0.1 * x * x + Math.sin(x) + 3
export const slope = (x: number) => 0.2 * x + Math.cos(x)

/** Past this, the run has diverged and further steps mean nothing. */
const DIVERGED = 1e3

/** One update, or the same point once the run has diverged. */
export const descend = (x: number, rate: number) => (Math.abs(x) > DIVERGED ? x : x - rate * slope(x))

export function run(start: number, rate: number, steps: number): number[] {
  const xs = [start]
  for (let i = 0; i < steps; i++) xs.push(descend(xs[xs.length - 1], rate))
  return xs
}
