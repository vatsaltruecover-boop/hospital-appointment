// Session & Hourly Token Configuration Tests
// Tests equal hourly token division, individual hour customizations, default rate reset,
// non-live session token addition, and active live session token lock guard.

import { setupTestEnvironment, resetTestState, TestRunner, assert, assertEqual } from './helpers/test-env.js';

setupTestEnvironment();

import { clinicStore, generateHourlySlots, ensureSessionHourlyTokens } from '../src/js/store.js';

export async function runSessionTokensTests() {
  const runner = new TestRunner('Session & Hourly Tokens Configuration Suite');

  resetTestState(clinicStore);
  const clinic = clinicStore.getCurrentClinic();

  // Test 1: Helper generateHourlySlots accurately splits time into 1-hour slots
  runner.test('generateHourlySlots creates 1-hour slots with default rate tokens', () => {
    const slots = generateHourlySlots('09:00', '12:00', 7);
    assertEqual(slots.length, 3, '3-hour session should have 3 hourly slots');
    assertEqual(slots[0].label, '09:00 - 10:00');
    assertEqual(slots[0].tokens, 7);
    assertEqual(slots[1].label, '10:00 - 11:00');
    assertEqual(slots[1].tokens, 7);
    assertEqual(slots[2].label, '11:00 - 12:00');
    assertEqual(slots[2].tokens, 7);

    const total = slots.reduce((sum, h) => sum + h.tokens, 0);
    assertEqual(total, 21, 'Default total capacity must be 21');
  });

  // Test 2: Create Session with Default Equal Hourly Distribution
  runner.test('createSession defaults to equal hourly token distribution', () => {
    const session = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Morning General OPD Test',
      startTime: '08:00',
      endTime: '12:00',
      durationHours: 4,
      tokensPerHour: 8,
      status: 'scheduled'
    });

    assert(session, 'Session must be created');
    assertEqual(session.durationHours, 4);
    assertEqual(session.tokensPerHour, 8);
    assertEqual(session.hourlyTokens.length, 4, '4 hours duration must produce 4 hourly slots');
    assertEqual(session.totalCapacity, 32, '4 hrs * 8 tokens/hr must equal 32 total capacity');
    assert(session.hourlyTokens.every(h => h.tokens === 8), 'All slots must be equally set to 8 tokens');
  });

  // Test 3: Custom Individual Hourly Token Allocation
  runner.test('Doctor can customize individual hourly slots with non-uniform tokens', () => {
    const customSlots = [
      { hourIndex: 0, label: '14:00 - 15:00', start: '14:00', end: '15:00', tokens: 4 },
      { hourIndex: 1, label: '15:00 - 16:00', start: '15:00', end: '16:00', tokens: 12 },
      { hourIndex: 2, label: '16:00 - 17:00', start: '16:00', end: '17:00', tokens: 7 }
    ];

    const session = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Custom Afternoon Speciality',
      startTime: '14:00',
      endTime: '17:00',
      durationHours: 3,
      tokensPerHour: 7,
      hourlyTokens: customSlots,
      status: 'scheduled'
    });

    assertEqual(session.totalCapacity, 23, 'Total capacity must be 4 + 12 + 7 = 23');
    assertEqual(session.hourlyTokens[0].tokens, 4, 'Hour 1 must be 4');
    assertEqual(session.hourlyTokens[1].tokens, 12, 'Hour 2 must be 12');
    assertEqual(session.hourlyTokens[2].tokens, 7, 'Hour 3 must be 7');
  });

  // Test 4: Reset Custom Hourly Distribution Back to Default Equal Rate
  runner.test('Session can be updated to reset hourly slots back to equal distribution', () => {
    const sessions = clinicStore.getSessionsForClinic(clinic.id);
    const customSess = sessions.find(s => s.name === 'Custom Afternoon Speciality');
    assert(customSess, 'Custom session must exist');

    // Reset back to equal distribution with default rate 7
    const equalSlots = generateHourlySlots(customSess.startTime, customSess.endTime, 7);
    const updated = clinicStore.updateSession(customSess.id, {
      tokensPerHour: 7,
      hourlyTokens: equalSlots
    });

    assertEqual(updated.totalCapacity, 21, 'Resetting 3 hours to 7 tokens must equal 21');
    assert(updated.hourlyTokens.every(h => h.tokens === 7), 'All slots must be reset to 7');
  });

  // Test 5: Activating a Session Sets Live Queue Pointer
  runner.test('Activating a session sets status to active and updates live queue currentSessionId', () => {
    const session = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Night Emergency On-Call',
      startTime: '20:00',
      endTime: '23:00',
      durationHours: 3,
      tokensPerHour: 6,
      status: 'scheduled'
    });

    clinicStore.updateSession(session.id, { status: 'active' });

    const activeSession = clinicStore.getActiveSession(clinic.id);
    assertEqual(activeSession.id, session.id, 'Active session must be the newly activated one');
    assertEqual(activeSession.status, 'active');

    const queue = clinicStore.getLiveQueue(clinic.id);
    assert(queue.session, 'Live queue must have an active session');
    assertEqual(queue.session.id, session.id, 'Live queue must point to active session');
  });

  // Test 6: Adding Tokens to an Existing Non-Live Session
  runner.test('Doctor can add new tokens to existing scheduled (non-live) session', () => {
    const session = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Weekend Checkup Session',
      startTime: '10:00',
      endTime: '13:00',
      durationHours: 3,
      tokensPerHour: 7,
      status: 'scheduled'
    });

    assertEqual(session.totalCapacity, 21, 'Initial capacity must be 21');

    // Add +6 extra tokens
    const updated = clinicStore.addTokensToSession(session.id, { extraTokens: 6 });
    assertEqual(updated.totalCapacity, 27, 'New total capacity must be 21 + 6 = 27');

    // Verify extra tokens distributed across 3 slots (+2 per slot)
    assertEqual(updated.hourlyTokens[0].tokens, 9);
    assertEqual(updated.hourlyTokens[1].tokens, 9);
    assertEqual(updated.hourlyTokens[2].tokens, 9);
  });

  // Test 7: Adding Tokens via Granular Hourly Adjustments on Non-Live Session
  runner.test('Doctor can add tokens by directly increasing specific hourly slots', () => {
    const session = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Granular Hourly Adjustment Session',
      startTime: '09:00',
      endTime: '11:00',
      durationHours: 2,
      tokensPerHour: 5,
      status: 'scheduled'
    });

    assertEqual(session.totalCapacity, 10, 'Initial capacity: 2 hrs * 5 = 10');

    // Add extra tokens only to Hour 2 (increase from 5 to 10)
    const newHourly = [
      { hourIndex: 0, label: '09:00 - 10:00', start: '09:00', end: '10:00', tokens: 5 },
      { hourIndex: 1, label: '10:00 - 11:00', start: '10:00', end: '11:00', tokens: 10 }
    ];

    const updated = clinicStore.addTokensToSession(session.id, { hourlyTokens: newHourly });
    assertEqual(updated.totalCapacity, 15, 'New capacity: 5 + 10 = 15');
    assertEqual(updated.hourlyTokens[1].tokens, 10);
  });

  // Test 8: Security Guard: Cannot Add Tokens to an Active Live Session
  runner.test('Attempting to add tokens to an active live session throws an error', () => {
    const active = clinicStore.getActiveSession(clinic.id);
    assert(active, 'Must have an active session');
    assertEqual(active.status, 'active', 'Session must be active');

    let errorThrown = false;
    let errorMsg = '';
    try {
      clinicStore.addTokensToSession(active.id, { extraTokens: 5 });
    } catch (e) {
      errorThrown = true;
      errorMsg = e.message;
    }

    assert(errorThrown, 'Must throw error when trying to add tokens to live session');
    assert(
      errorMsg.includes('cannot be added to an active') || errorMsg.includes('Only non-live'),
      'Error message must state that tokens cannot be added while session is actively live'
    );
  });

  return await runner.run();
}

if (process.argv[1] && process.argv[1].endsWith('session-tokens.test.js')) {
  runSessionTokensTests();
}
