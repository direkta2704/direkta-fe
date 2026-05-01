interface BreakerState {
  failures: number;
  successes: number;
  lastFailure: number;
  open: boolean;
  openedAt: number;
}

const breakers = new Map<string, BreakerState>();

const WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const FAILURE_THRESHOLD = 0.25; // 25%
const MIN_REQUESTS = 4; // minimum requests before tripping
const COOLDOWN_MS = 15 * 60 * 1000; // 15 min cooldown before auto-retry

function getState(key: string): BreakerState {
  if (!breakers.has(key)) {
    breakers.set(key, { failures: 0, successes: 0, lastFailure: 0, open: false, openedAt: 0 });
  }
  return breakers.get(key)!;
}

function resetIfStale(state: BreakerState) {
  const now = Date.now();
  if (state.lastFailure && now - state.lastFailure > WINDOW_MS) {
    state.failures = 0;
    state.successes = 0;
  }
}

export function isCircuitOpen(portal: string): boolean {
  const state = getState(portal);

  // Auto-close after cooldown
  if (state.open && Date.now() - state.openedAt > COOLDOWN_MS) {
    state.open = false;
    state.failures = 0;
    state.successes = 0;
    console.log(`[CircuitBreaker] ${portal}: auto-closed after cooldown`);
  }

  return state.open;
}

export function recordSuccess(portal: string) {
  const state = getState(portal);
  resetIfStale(state);
  state.successes++;
}

export function recordFailure(portal: string) {
  const state = getState(portal);
  resetIfStale(state);
  state.failures++;
  state.lastFailure = Date.now();

  const total = state.failures + state.successes;
  if (total >= MIN_REQUESTS && state.failures / total >= FAILURE_THRESHOLD) {
    state.open = true;
    state.openedAt = Date.now();
    console.error(`[CircuitBreaker] ${portal}: OPEN — ${state.failures}/${total} failures (${(state.failures / total * 100).toFixed(0)}%)`);
  }
}

export function manualTrip(portal: string) {
  const state = getState(portal);
  state.open = true;
  state.openedAt = Date.now();
  console.log(`[CircuitBreaker] ${portal}: manually tripped`);
}

export function manualReset(portal: string) {
  const state = getState(portal);
  state.open = false;
  state.failures = 0;
  state.successes = 0;
  console.log(`[CircuitBreaker] ${portal}: manually reset`);
}

export function getStatus(portal: string): { open: boolean; failures: number; successes: number; rate: number } {
  const state = getState(portal);
  const total = state.failures + state.successes;
  return {
    open: state.open,
    failures: state.failures,
    successes: state.successes,
    rate: total > 0 ? state.failures / total : 0,
  };
}
