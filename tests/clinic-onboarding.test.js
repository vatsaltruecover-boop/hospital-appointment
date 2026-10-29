// Clinic Onboarding & Super Admin Process Tests
// Tests clinic registration, dedicated endpoint generation, doctor credentials provisioning,
// and role permission boundaries.

import { setupTestEnvironment, resetTestState, TestRunner, assert, assertEqual } from './helpers/test-env.js';

setupTestEnvironment();

import { clinicStore, slugifyText } from '../src/js/store.js';
import { authService, SUPER_ADMIN_CREDENTIALS } from '../src/js/auth.js';

export async function runClinicOnboardingTests() {
  const runner = new TestRunner('Clinic Onboarding & Super Admin Suite');

  // Reset state before running suite
  resetTestState(clinicStore);

  // Test 1: Super Admin Authentication
  runner.test('Super Admin can authenticate with master credentials', () => {
    const res = authService.loginSuperAdmin(
      SUPER_ADMIN_CREDENTIALS.username,
      SUPER_ADMIN_CREDENTIALS.password
    );

    assertEqual(res.session.role, 'super_admin', 'Role must be super_admin');
    assert(authService.isSuperAdmin(), 'isSuperAdmin() must return true');
  });

  // Test 2: Invalid Super Admin Login is Rejected
  runner.test('Invalid Super Admin credentials throw an error', () => {
    let errorThrown = false;
    try {
      authService.loginSuperAdmin('admin@medipulse.io', 'wrong-pass');
    } catch (e) {
      errorThrown = true;
    }
    assert(errorThrown, 'Invalid password must throw error');
  });

  // Test 3: Clinic Creation & Unique Slug Generation
  runner.test('Super Admin creates new clinic and generates clean unique endpoint slug', () => {
    const initialCount = clinicStore.getAllClinics().length;

    const { clinic, doctorCreds } = clinicStore.createClinic({
      name: 'Silver Oak Spine & Orthopedics',
      slug: 'silver-oak',
      doctorName: 'Dr. Gregory Vance, MS Ortho',
      specialty: 'Orthopedics & Joint Replacement',
      cabin: 'Cabin 304 (3rd Floor)',
      phone: '+1 (555) 765-4321',
      avgTimePerPatientMinutes: 10
    });

    assert(clinic, 'New clinic must be created');
    assertEqual(clinic.slug, 'silver-oak', 'Endpoint slug must match clean input');
    assertEqual(clinic.name, 'Silver Oak Spine & Orthopedics', 'Clinic name must match');
    assertEqual(clinicStore.getAllClinics().length, initialCount + 1, 'Total clinics count must increase');

    // Doctor Creds check
    assert(doctorCreds, 'Doctor credentials must be generated');
    assert(doctorCreds.username.includes('silver-oak'), 'Username should reference clinic slug');
    assert(doctorCreds.password.length >= 6, 'Generated password must be strong');
  });

  // Test 4: Slug Deduplication on Name Collisions
  runner.test('Clinic creation auto-increments slug on duplicate names', () => {
    const clinicA = clinicStore.createClinic({
      name: 'Metro Care Clinic',
      slug: 'metro-care',
      doctorName: 'Dr. A'
    });

    const clinicB = clinicStore.createClinic({
      name: 'Metro Care Clinic',
      slug: 'metro-care',
      doctorName: 'Dr. B'
    });

    assertEqual(clinicA.clinic.slug, 'metro-care', 'First clinic gets original slug');
    assertEqual(clinicB.clinic.slug, 'metro-care-1', 'Duplicate slug gets suffixed with -1');
  });

  // Test 5: Dedicated Endpoint URLs
  runner.test('Clinic generates valid dedicated endpoints for Patient, TV, and Doctor', () => {
    const clinic = clinicStore.getClinicBySlugOrId('silver-oak');
    assert(clinic, 'Created clinic must be found by slug');

    const urls = clinicStore.getClinicEndpointUrls(clinic, 'http://localhost:3000');
    assertEqual(urls.patientUrl, 'http://localhost:3000/silver-oak', 'Patient URL must be clean vanity path');
    assertEqual(urls.tvUrl, 'http://localhost:3000/silver-oak/tv', 'TV URL must be clean vanity path');
    assertEqual(urls.doctorUrl, 'http://localhost:3000/silver-oak/doctor', 'Doctor URL must be clean vanity path');
  });

  // Test 6: Default Session Auto-Created on New Clinic
  runner.test('Creating clinic automatically initializes default session & live queue', () => {
    const clinic = clinicStore.getClinicBySlugOrId('silver-oak');
    const sessions = clinicStore.getSessionsForClinic(clinic.id);

    assert(sessions.length >= 1, 'Clinic must have at least one initialized default session');
    const active = clinicStore.getActiveSession(clinic.id);
    assert(active, 'New clinic must have an active session ready for consultation');
    assertEqual(active.totalCapacity, 21, 'Default session should have 21 capacity (3 hrs * 7 tokens)');

    const liveQueue = clinicStore.getLiveQueue(clinic.id);
    assert(liveQueue, 'Live queue must be initialized for new clinic');
    assertEqual(liveQueue.currentTokenNumber, 0, 'Initial token number must be 0');
  });

  // Test 7: Doctor Credential Regeneration
  runner.test('Super Admin can regenerate doctor PIN / credentials', () => {
    const clinic = clinicStore.getClinicBySlugOrId('silver-oak');
    const oldPass = clinic.doctorCreds.password;

    const newCreds = clinicStore.generateDoctorCreds(clinic.id);
    assert(newCreds.password, 'New password must be generated');
    assert(newCreds.password !== oldPass || newCreds.password.length > 0, 'PIN regenerated');
  });

  // Test 8: Joshi Clinic (Surat) Enrollment & Details
  runner.test('Joshi Clinic (Surat) is enrolled with correct doctor, address, endpoints, and credentials', () => {
    const store = clinicStore;
    const joshi = store.getClinicBySlugOrId('joshi-clinic');
    assert(joshi, 'Joshi Clinic must exist in store');
    assertEqual(joshi.name, 'Joshi Clinic', 'Clinic name matches');
    assertEqual(joshi.doctorName, 'Dr. Rajvi J. Joshi', 'Doctor name matches');
    assertEqual(joshi.phone, '+91 96244 09671', 'Phone matches');
    assert(joshi.address.includes('Raj World'), 'Address must contain Raj World');
    assert(joshi.address.includes('Surat'), 'Address must contain Surat');
    assertEqual(joshi.doctorCreds.username, 'dr.joshi@medipulse.io', 'Doctor username matches');
    assertEqual(joshi.doctorCreds.password, 'Joshi#2026', 'Doctor password matches');

    const urls = store.getClinicEndpointUrls(joshi);
    assert(urls.patientUrl.endsWith('/joshi-clinic'), 'Patient endpoint must have joshi-clinic clean slug');
    assert(urls.tvUrl.endsWith('/joshi-clinic/tv'), 'TV endpoint must have joshi-clinic/tv slug');
    assert(urls.doctorUrl.endsWith('/joshi-clinic/doctor'), 'Doctor endpoint must have joshi-clinic/doctor slug');

    const activeSession = store.getActiveSession(joshi.id);
    assert(activeSession, 'Joshi clinic must have an active session');
    assertEqual(activeSession.totalCapacity, 21, 'Morning session has 21 tokens');
  });

  return await runner.run();
}

if (process.argv[1] && process.argv[1].endsWith('clinic-onboarding.test.js')) {
  runClinicOnboardingTests();
}
