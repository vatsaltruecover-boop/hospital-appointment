// Lightweight Headless Test Environment & Mock Harness for Node.js
// Provides in-memory storage, window mocks, and assertions for unit & integration testing

class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  get length() {
    return this.store.size;
  }

  key(index) {
    return Array.from(this.store.keys())[index] || null;
  }
}

class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
  }

  postMessage(message) {
    // In-process delivery to other channels if registered
    if (MockBroadcastChannel.subscribers[this.name]) {
      MockBroadcastChannel.subscribers[this.name].forEach((ch) => {
        if (ch !== this && typeof ch.onmessage === 'function') {
          ch.onmessage({ data: message });
        }
      });
    }
  }

  close() {
    if (MockBroadcastChannel.subscribers[this.name]) {
      MockBroadcastChannel.subscribers[this.name] = MockBroadcastChannel.subscribers[this.name].filter(
        (ch) => ch !== this
      );
    }
  }
}

MockBroadcastChannel.subscribers = {};

// Setup Global Environment before modules are loaded
export function setupTestEnvironment() {
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = new MockLocalStorage();
  } else {
    globalThis.localStorage.clear();
  }

  if (typeof globalThis.BroadcastChannel === 'undefined') {
    globalThis.BroadcastChannel = MockBroadcastChannel;
  }

  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
      location: {
        origin: 'http://localhost:3000',
        href: 'http://localhost:3000/doctor',
        pathname: '/doctor',
        search: ''
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  }
}

// Reset store state between tests
export function resetTestState(store) {
  if (globalThis.localStorage) {
    globalThis.localStorage.clear();
  }
  if (store && typeof store.resetToDefault === 'function') {
    store.resetToDefault();
  }
}

// Colored ANSI Assertions and Test Suite Runner
export const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

export class TestRunner {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = 0;
  }

  test(description, fn) {
    this.tests.push({ description, fn });
  }

  async run() {
    console.log(`\n${colors.cyan}${colors.bold}=== Running Suite: ${this.suiteName} ===${colors.reset}`);
    this.startTime = Date.now();

    for (const t of this.tests) {
      try {
        await t.fn();
        this.passed++;
        console.log(`  ${colors.green}✔ PASS${colors.reset} ${t.description}`);
      } catch (err) {
        this.failed++;
        console.error(`  ${colors.red}✖ FAIL${colors.reset} ${t.description}`);
        console.error(`    ${colors.red}Error: ${err.message}${colors.reset}`);
        if (err.stack) {
          const relevantStack = err.stack.split('\n').slice(1, 3).join('\n');
          console.error(`    ${colors.dim}${relevantStack}${colors.reset}`);
        }
      }
    }

    const elapsed = Date.now() - this.startTime;
    console.log(
      `${colors.bold}Summary:${colors.reset} ${this.passed} passed, ${this.failed} failed (${elapsed}ms)\n`
    );

    return {
      suite: this.suiteName,
      passed: this.passed,
      failed: this.failed,
      total: this.tests.length,
      elapsed
    };
  }
}

// Assertion helpers
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Value mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message || 'Deep equality failed'}:\nExpected: ${expectedStr}\nActual:   ${actualStr}`);
  }
}

export function assertThrows(fn, expectedSubstr = '', message = 'Expected function to throw') {
  let threw = false;
  let thrownErr = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    thrownErr = err;
  }
  if (!threw) {
    throw new Error(`${message}: function did not throw an error`);
  }
  if (expectedSubstr && !thrownErr.message.includes(expectedSubstr)) {
    throw new Error(`Expected error containing "${expectedSubstr}", got "${thrownErr.message}"`);
  }
}
