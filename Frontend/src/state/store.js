/**
 * Tiny observable store with event emitter.
 * Usage: store.set({ key: value }) → emits 'change' with {key, value, state}
 */
export function createStore(initial = {}) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get state() { return state; },

    get(key) { return state[key]; },

    set(patch) {
      state = { ...state, ...patch };
      for (const fn of listeners) {
        fn({ state, patch });
      }
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Subscribe to changes of a specific key */
    on(key, fn) {
      return this.subscribe(({ patch }) => {
        if (key in patch) fn(patch[key]);
      });
    },
  };
}

/**
 * asyncState helper — tracks phases: idle | loading | done | error
 * Returns an object with { status, data, error }
 */
export function asyncState() {
  return {
    status: 'idle',  // 'idle' | 'loading' | 'done' | 'error'
    data: null,
    error: null,
  };
}

export function asyncLoading() {
  return { status: 'loading', data: null, error: null };
}

export function asyncDone(data) {
  return { status: 'done', data, error: null };
}

export function asyncError(error) {
  return { status: 'error', data: null, error };
}
