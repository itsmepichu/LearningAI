export const ACTIVATIONS = {
  ReLU: (z: number) => Math.max(0, z),
  GELU: (z: number) => 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z ** 3))),
  sigmoid: (z: number) => 1 / (1 + Math.exp(-z)),
  tanh: (z: number) => Math.tanh(z),
  'none (linear)': (z: number) => z,
} as const
export type ActivationName = keyof typeof ACTIVATIONS
export const INPUTS: [number, number] = [1, 0.5]

/** One neuron with fixed inputs: weighted sum plus bias, then the activation. */
export function neuron(w1: number, w2: number, b: number, act: ActivationName) {
  const z = w1 * INPUTS[0] + w2 * INPUTS[1] + b
  return { z, a: ACTIVATIONS[act](z) }
}
