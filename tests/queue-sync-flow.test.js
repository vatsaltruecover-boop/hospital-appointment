// End-to-End Queue Advancement & Cross-Screen Reflection Tests
// Tests the full flow: Patient booking -> appears in Doctor queue -> appears on Live TV board ->
// Doctor calls next -> status transitions to 'serving' -> marks completed -> multi-clinic isolation.

import { setupTestEnvironment, resetTestState, TestRunner, assert, assertEqual } from './helpers/test-env.js';

setupTestEnvironment();

import { clinicStore } from '../src/js/store.js';

export async function runQueueSyncFlowTests() {
  const runner = new TestRunner('End-to-End Queue & Cross-Screen Sync Suite');

  resetTestState(clinicStore);
  const clinic1 = clinicStore.getClinicBySlugOrId('joshi-clinic');
  const { clinic: clinic2 } = clinicStore.createClinic({
    name: 'Surat Wellness Care',
    doctorName: 'Dr. Ketan Patel',
    specialty: 'Pediatrics'
  });

  // Test 1: Full Lifecycle: Booking -> Queue Appearance -> Call Next -> Serve -> Complete
  runner.test('Full Queue Lifecycle: Patient booking reflects in queue and advances through consultation states', () => {
    // 1. Create clean active session for clinic1
    const session = clinicStore.createSession({
      clinicId: clinic1.id,
      name: 'Realtime Sync Demo Session',
      startTime: '09:00',
      endTime: '12:00',
      durationHours: 3,
      tokensPerHour: 7,
      status: 'active'
    });

    // 2. Three patients book appointments
    const apt1 = clinicStore.bookAppointment({
      clinicId: clinic1.id,
      sessionId: session.id,
      patientName: 'Alice Hamilton',
      phone: '+1 555-0101'
    });

    const apt2 = clinicStore.bookAppointment({
      clinicId: clinic1.id,
      sessionId: session.id,
      patientName: 'Bob Vance',
      phone: '+1 555-0102'
    });

    const apt3 = clinicStore.bookAppointment({
      clinicId: clinic1.id,
      sessionId: session.id,
      patientName: 'Charlie Brown',
      phone: '+1 555-0103'
    });

    assertEqual(apt1.tokenNumber, 1);
    assertEqual(apt2.tokenNumber, 2);
    assertEqual(apt3.tokenNumber, 3);

    // 3. Verify Queue state before consultation starts
    let queueData = clinicStore.getLiveQueue(clinic1.id);
    assertEqual(queueData.currentTokenNumber, 0, 'No token in room yet');
    assertEqual(queueData.nextApts.length, 3, 'All 3 patients should be waiting');
    assertEqual(queueData.nextApts[0].patientName, 'Alice Hamilton', 'Alice should be first in waiting line');

    // 4. Doctor calls next token (Alice #1)
    const calledToken = clinicStore.callNextToken(clinic1.id);
    assertEqual(calledToken, 1, 'Called token must be Token #1');

    queueData = clinicStore.getLiveQueue(clinic1.id);
    assertEqual(queueData.currentTokenNumber, 1, 'Current token number is now 1');
    assert(queueData.currentApt, 'Current appointment must exist');
    assertEqual(queueData.currentApt.patientName, 'Alice Hamilton', 'Now serving Alice');
    assertEqual(queueData.currentApt.status, 'serving', 'Alice status must be serving');
    assertEqual(queueData.nextApts.length, 2, 'Two patients remaining in waiting line (Bob, Charlie)');
    assertEqual(queueData.nextApts[0].patientName, 'Bob Vance', 'Bob is now next in line on TV');

    // 5. Doctor marks Token #1 as completed
    clinicStore.markTokenCompleted(clinic1.id);

    const sessionApts = clinicStore.getAppointmentsForSession(session.id);
    const aliceRecord = sessionApts.find(a => a.id === apt1.id);
    assertEqual(aliceRecord.status, 'completed', 'Alice appointment status must be completed');
    assert(aliceRecord.completedAt, 'Completion timestamp must be set');

    // 6. Doctor calls next token (Bob #2)
    const calledToken2 = clinicStore.callNextToken(clinic1.id);
    assertEqual(calledToken2, 2, 'Called token must be Token #2');

    queueData = clinicStore.getLiveQueue(clinic1.id);
    assertEqual(queueData.currentTokenNumber, 2);
    assertEqual(queueData.currentApt.patientName, 'Bob Vance');
    assertEqual(queueData.completedApts.length, 1, '1 patient completed');
    assertEqual(queueData.nextApts.length, 1, 'Charlie is the only remaining waiting patient');
  });

  // Test 2: Token Skip & Recall Behavior
  runner.test('Doctor can recall and skip absent patients with proper queue advancement', () => {
    // Recall current token (Bob #2)
    let recallTriggered = false;
    const unsub = clinicStore.subscribe((state, event) => {
      if (event.type === 'TOKEN_RECALLED') recallTriggered = true;
    });

    clinicStore.recallToken(clinic1.id);
    assert(recallTriggered, 'TOKEN_RECALLED event must be emitted');
    unsub();

    // Skip current token (Bob #2) -> marks Bob skipped and advances to Charlie #3
    clinicStore.skipToken(clinic1.id);

    const queueData = clinicStore.getLiveQueue(clinic1.id);
    assertEqual(queueData.currentTokenNumber, 3, 'After skipping Bob, queue advances to Token #3');
    assertEqual(queueData.currentApt.patientName, 'Charlie Brown', 'Now serving Charlie');
  });

  // Test 3: Multi-Clinic Isolation (Clinics do not cross-contaminate queues)
  runner.test('Bookings and queue advancement in Clinic 1 do not leak into Clinic 2', () => {
    // Active session for Clinic 2
    const clinic2Session = clinicStore.getActiveSession(clinic2.id);
    assert(clinic2Session, 'Clinic 2 must have an active session');

    const initialClinic2Queue = clinicStore.getLiveQueue(clinic2.id);
    const clinic2InitialToken = initialClinic2Queue.currentTokenNumber;

    // Book appointment in Clinic 1
    const active1 = clinicStore.getActiveSession(clinic1.id);
    clinicStore.bookAppointment({
      clinicId: clinic1.id,
      sessionId: active1.id,
      patientName: 'Isolated Clinic 1 Patient',
      phone: '+1 555-9999'
    });

    // Check Clinic 2 queue
    const updatedClinic2Queue = clinicStore.getLiveQueue(clinic2.id);
    assertEqual(
      updatedClinic2Queue.currentTokenNumber,
      clinic2InitialToken,
      'Clinic 2 current token must remain unaffected by Clinic 1 booking'
    );

    const hasClinic1PatientInClinic2 = updatedClinic2Queue.allApts.some(
      a => a.patientName === 'Isolated Clinic 1 Patient'
    );
    assert(!hasClinic1PatientInClinic2, 'Clinic 1 patient must not appear in Clinic 2 appointments');
  });

  // Test 4: Real-time Broadcast Event Emission
  runner.test('Store broadcasts mutation events to sync cross-window TV and doctor consoles', () => {
    let broadcastEvents = [];
    const unsub = clinicStore.subscribe((state, event) => {
      broadcastEvents.push(event.type);
    });

    const activeSession = clinicStore.getActiveSession(clinic1.id);
    clinicStore.bookAppointment({
      clinicId: clinic1.id,
      sessionId: activeSession.id,
      patientName: 'Sync Test Patient',
      phone: '+1 555-8888'
    });

    assert(broadcastEvents.includes('APPOINTMENT_BOOKED'), 'Must emit APPOINTMENT_BOOKED event');
    unsub();
  });

  return await runner.run();
}

if (process.argv[1] && process.argv[1].endsWith('queue-sync-flow.test.js')) {
  runQueueSyncFlowTests();
}
