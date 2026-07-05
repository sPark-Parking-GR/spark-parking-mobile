import { useEffect, useMemo, useRef } from 'react'

export interface DebouncedCallback<A extends unknown[]> {
  (...args: A): void
  // Drop a pending invocation so a now-stale call never fires.
  cancel: () => void
}

export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): DebouncedCallback<A> {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return useMemo(() => {
    const debounced = ((...args: A) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => fnRef.current(...args), delay)
    }) as DebouncedCallback<A>
    debounced.cancel = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }
    return debounced
  }, [delay])
}
