// Patient Booking Process Tests
// Tests instant booking, sequential token generation, capacity limits,
// overbooking guard, and capacity expansion.

import { setupTestEnvironment, resetTestState, TestRunner, assert, assertEqual } from './helpers/test-env.js';

setupTestEnvironment();

import { clinicStore } from '../src/js/store.js';

export async function runPatientBookingTests() {
  const runner = new TestRunner('Patient Booking & Token Allotment Suite');

  resetTestState(clinicStore);
  const clinic = clinicStore.getCurrentClinic();

  // Test 1: Patient Instant Booking without OTP
  runner.test('Patient can book appointment with name and phone and receive sequential token', () => {
    // Create dedicated clean test session
    const session = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Cardiology Morning Consult',
      startTime: '09:00',
      endTime: '12:00',
      durationHours: 3,
      tokensPerHour: 7,
      status: 'scheduled'
    });

    const apt = clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: session.id,
      patientName: 'Arthur Dent',
      phone: '+1 (555) 012-3456'
    });

    assert(apt, 'Appointment must be created');
    assertEqual(apt.patientName, 'Arthur Dent');
    assertEqual(apt.phone, '+1 (555) 012-3456');
    assertEqual(apt.tokenNumber, 1, 'First booking must receive Token #1');
    assertEqual(apt.status, 'waiting', 'Initial status must be waiting');
    assert(apt.id.startsWith('apt_'), 'Appointment must have valid unique ID');
  });

  // Test 2: Sequential Token Allocation
  runner.test('Subsequent bookings receive incremented sequential tokens #2, #3', () => {
    const sessions = clinicStore.getSessionsForClinic(clinic.id);
    const session = sessions.find(s => s.name === 'Cardiology Morning Consult');

    const apt2 = clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: session.id,
      patientName: 'Ford Prefect',
      phone: '+1 (555) 012-3457'
    });

    const apt3 = clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: session.id,
      patientName: 'Trillian Astra',
      phone: '+1 (555) 012-3458'
    });

    assertEqual(apt2.tokenNumber, 2, 'Second patient must get Token #2');
    assertEqual(apt3.tokenNumber, 3, 'Third patient must get Token #3');
  });

  // Test 3: Estimated Wait Time Calculation
  runner.test('Estimated wait time calculates dynamically based on patients ahead and avg time', () => {
    const sessions = clinicStore.getSessionsForClinic(clinic.id);
    const session = sessions.find(s => s.name === 'Cardiology Morning Consult');

    // 4th patient
    const apt4 = clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: session.id,
      patientName: 'Zaphod Beeblebrox',
      phone: '+1 (555) 012-3459'
    });

    assertEqual(apt4.tokenNumber, 4);
    assert(apt4.waitMinutes >= 0, 'Wait minutes must be non-negative');
    assert(apt4.estimatedTime, 'Estimated consultation time must be computed');
  });

  // Test 4: Overbooking Protection Guard
  runner.test('System strictly prevents bookings when total session capacity is reached', () => {
    // Create session with total capacity of 2 tokens
    const cappedSession = clinicStore.createSession({
      clinicId: clinic.id,
      name: 'Ultra-Exclusive Specialist Clinic',
      startTime: '15:00',
      endTime: '17:00',
      durationHours: 2,
      tokensPerHour: 1, // 2 hrs * 1 = 2 tokens
      status: 'scheduled'
    });

    assertEqual(cappedSession.totalCapacity, 2);

    // Book 1st
    clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: cappedSession.id,
      patientName: 'VIP Patient 1',
      phone: '+1 555-1111'
    });

    // Book 2nd (Reaches maximum capacity)
    clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: cappedSession.id,
      patientName: 'VIP Patient 2',
      phone: '+1 555-2222'
    });

    // Attempt to book 3rd (Must be rejected)
    let errorThrown = false;
    let errorMsg = '';
    try {
      clinicStore.bookAppointment({
        clinicId: clinic.id,
        sessionId: cappedSession.id,
        patientName: 'Overbooked Patient 3',
        phone: '+1 555-3333'
      });
    } catch (err) {
      errorThrown = true;
      errorMsg = err.message;
    }

    assert(errorThrown, 'System must throw error when booking exceeds total capacity');
    assert(errorMsg.includes('fully booked'), 'Error message must specify session is fully booked');
  });

  // Test 5: Adding Tokens to Non-Live Session Opens Up Slots for Booking
  runner.test('Adding tokens to a full non-live session immediately allows new bookings', () => {
    const sessions = clinicStore.getSessionsForClinic(clinic.id);
    const cappedSession = sessions.find(s => s.name === 'Ultra-Exclusive Specialist Clinic');

    // Add +2 tokens to the full session
    clinicStore.addTokensToSession(cappedSession.id, { extraTokens: 2 });
    assertEqual(cappedSession.totalCapacity, 4, 'Capacity increased from 2 to 4');

    // Now booking 3rd patient must succeed
    const apt3 = clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: cappedSession.id,
      patientName: 'Newly Admitted Patient 3',
      phone: '+1 555-4444'
    });

    assert(apt3, 'Patient 3 should now be able to book');
    assertEqual(apt3.tokenNumber, 3, 'Must receive Token #3');
  });

  return await runner.run();
}

if (process.argv[1] && process.argv[1].endsWith('patient-booking.test.js')) {
  runPatientBookingTests();
}
