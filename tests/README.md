# Automated Test Suite

A comprehensive, zero-dependency, headless testing framework built for the **Hospital Appointment & Live Queue System**.

---

## 🚀 Quick Start

Run the entire test suite:
```bash
npm test
```
Or directly with Node:
```bash
node tests/run-all.js
```

### Running Individual Test Suites
```bash
node tests/ui-integrity.test.js      # UI layout, IDs, modals, scrollable tables
node tests/clinic-onboarding.test.js # Super Admin clinic & doctor onboarding
node tests/session-tokens.test.js    # Doctor hourly token breakdown & session rules
node tests/patient-booking.test.js   # Instant booking, sequential tokens & capacity
node tests/queue-sync-flow.test.js   # Queue sync: Patient -> Doctor -> Live TV
```

---

## 📁 Test Architecture

```
tests/
├── helpers/
│   └── test-env.js              # Mock DOM, localStorage, BroadcastChannel, assertions & test runner
├── ui-integrity.test.js         # UI structure & regression tests
├── clinic-onboarding.test.js    # Clinic onboarding & Super Admin tests
├── session-tokens.test.js       # Hourly token distribution & session editing tests
├── patient-booking.test.js      # Patient booking & capacity tests
├── queue-sync-flow.test.js      # End-to-end queue sync & Live TV reflection tests
├── run-all.js                   # Master test runner with summary report
└── README.md                    # This documentation
```

---

## 🧪 Test Suites Overview

### 1. `ui-integrity.test.js` (UI Breaking & Regression Checks)
Ensures frontend templates do not break during code changes:
- Validates all HTML entry points: `index.html` (Patient), `doctor.html` (Doctor Console), `live-tv.html` (Waiting Room TV), `admin.html` (Super Admin).
- Checks all critical interactive DOM IDs (inputs, action buttons, counters, status tags).
- Verifies modal forms have scrollable wrappers (`.modal-scrollable`) so submit buttons remain visible on smaller viewports.
- Verifies data tables are wrapped with `.table-scrollable-7` (showing 5–7 records with vertical scrolling).
- Validates all local `<script src="...">` paths exist on the filesystem.

### 2. `clinic-onboarding.test.js` (Super Admin & Clinic Provisioning)
- Super Admin login credentials verification (`ADMIN_CREDENTIALS`).
- Clinic creation with auto-generated clean slugs and duplicate slug handling (`slug-2`).
- Dedicated clinic endpoint URL generation (`?clinic=<slug>`).
- Doctor credentials generation (username, PIN, full name, specialty).
- Doctor PIN regeneration with unique randomized PINs.
- Multi-clinic isolation and retrieval.

### 3. `session-tokens.test.js` (Session & Token Distribution)
- Hourly slot breakdown calculation from start and end times (e.g. 09:00 - 13:00 = 4 slots).
- Default equal distribution of total tokens across hours (e.g. 20 tokens / 4 hours = 5/hr).
- Custom individual hour token adjustments (e.g. slot 1: 8 tokens, slot 2: 4 tokens).
- Session activation and live queue initialization.
- Ability to add tokens to existing non-live (upcoming/draft) sessions.
- Strict guard: blocking token addition to active live sessions.

### 4. `patient-booking.test.js` (Patient Booking Flow)
- Direct instant appointment booking without OTP requirement.
- Sequential token numbering (#1, #2, #3, ...) per clinic session.
- Estimated wait time calculation based on average consultation duration.
- Capacity limit enforcement (rejecting bookings when session capacity is reached).
- Session capacity expansion allowing further bookings after token addition.

### 5. `queue-sync-flow.test.js` (Real-Time Queue & TV Sync)
- Patient bookings automatically appear in the doctor's queue.
- Doctor calling next patient updates appointment status to `serving` and broadcasts event.
- Doctor calling next patient reflects instantly on the Live TV display (`#tv-big-token`, `#tv-room-destination`).
- Doctor completing consultation moves appointment to `completed` and updates queue.
- Skip and recall token workflows.
- Clinic queue isolation: events and queues in Clinic A do not affect Clinic B.

---

## ➕ How to Keep Adding Test Cases for New Features

When developing a new feature or extending an existing one, follow these steps to add tests:

### Option A: Extend an Existing Test File
Open the relevant test file (e.g., `tests/patient-booking.test.js`) and add a new `test(...)` block:

```javascript
test('Your descriptive test name here', () => {
    // 1. Setup mock environment / store state
    resetMockStore();

    // 2. Perform actions
    const result = bookAppointment(...);

    // 3. Assert outcomes
    assert(result.success, 'Booking should succeed');
    assertEqual(result.appointment.status, 'booked', 'Status must be booked');
});
```

### Option B: Create a Brand New Test Suite
1. Create a new file in `tests/`, e.g., `tests/sms-notifications.test.js`.
2. Use the template below:

```javascript
import { setupTestEnv, createTestRunner, assert, assertEqual } from './helpers/test-env.js';

// Initialize mock browser environment
setupTestEnv();

const runner = createTestRunner('SMS Notifications');

runner.test('SMS is triggered when token is 2 positions away', () => {
    // Test logic here
    assertEqual(1 + 1, 2, 'Math works');
});

// Run if called directly
if (process.argv[1].endsWith('sms-notifications.test.js')) {
    runner.run().then(res => {
        if (res.failed > 0) process.exit(1);
    });
}

export default runner;
```

3. Register your new suite in `tests/run-all.js`:
```javascript
import smsSuite from './sms-notifications.test.js';
// Add to suites array:
const suites = [
    uiIntegritySuite,
    clinicOnboardingSuite,
    sessionTokensSuite,
    patientBookingSuite,
    queueSyncSuite,
    smsSuite, // <-- your new suite here
];
```

4. Run `npm test` to verify all tests execute.
