/**
 * Runs the v3 vanilla widgets inside a React-rendered page.
 * The generated module (widgets.js) receives timer functions from here so every
 * interval, timeout and animation frame it starts can be cancelled on unmount.
 */
export interface LegacyHandle {
  rerender: () => void
  dispose: () => void
}

export async function mountLegacyWidgets(root: HTMLElement): Promise<LegacyHandle> {
  const { mountLegacy } = await import('./widgets.js')
  const intervals = new Set<number>()
  const timeouts = new Set<number>()
  const frames = new Set<number>()
  let disposed = false
  const rt: Record<string, unknown> = {
    setInterval: (fn: TimerHandler, ms?: number, ...a: unknown[]) => {
      const id = window.setInterval(fn, ms, ...a)
      intervals.add(id)
      return id
    },
    setTimeout: (fn: (...x: unknown[]) => void, ms?: number, ...a: unknown[]) => {
      const id = window.setTimeout((...x: unknown[]) => {
        timeouts.delete(id)
        if (!disposed) fn(...x)
      }, ms, ...a)
      timeouts.add(id)
      return id
    },
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      const id = window.requestAnimationFrame((t) => {
        frames.delete(id)
        if (!disposed) fn(t)
      })
      frames.add(id)
      return id
    },
  }
  try {
    mountLegacy(root, rt)
  } catch (e) {
    console.error('legacy widget mount failed', e)
  }
  return {
    rerender: () => (rt.rerender as (() => void) | undefined)?.(),
    dispose: () => {
      disposed = true
      intervals.forEach((i) => clearInterval(i))
      timeouts.forEach((i) => clearTimeout(i))
      frames.forEach((i) => cancelAnimationFrame(i))
    },
  }
}
