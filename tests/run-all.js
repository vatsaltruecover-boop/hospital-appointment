// Master Test Suite Runner for Hospital Appointment & Queue System
// Runs UI integrity, clinic onboarding, session token configuration, patient booking,
// and real-time queue synchronization test suites.

import { colors } from './helpers/test-env.js';
import { runUiIntegrityTests } from './ui-integrity.test.js';
import { runClinicOnboardingTests } from './clinic-onboarding.test.js';
import { runSessionTokensTests } from './session-tokens.test.js';
import { runPatientBookingTests } from './patient-booking.test.js';
import { runQueueSyncFlowTests } from './queue-sync-flow.test.js';

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   MEDIPULSE APPOINTMENT SYSTEM - MASTER TEST RUNNER  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}`);

  const startAll = Date.now();
  const results = [];

  // Execute all suites sequentially
  results.push(await runUiIntegrityTests());
  results.push(await runClinicOnboardingTests());
  results.push(await runSessionTokensTests());
  results.push(await runPatientBookingTests());
  results.push(await runQueueSyncFlowTests());

  const totalElapsed = Date.now() - startAll;

  // Master Aggregated Summary
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  console.log(`${colors.bold}======================================================${colors.reset}`);
  console.log(`${colors.bold}MASTER TEST REPORT SUMMARY:${colors.reset}`);
  console.log(`  Suites Run:  ${results.length}`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed:      ${colors.green}${colors.bold}${totalPassed}${colors.reset}`);
  console.log(`  Failed:      ${totalFailed > 0 ? colors.red : colors.green}${colors.bold}${totalFailed}${colors.reset}`);
  console.log(`  Duration:    ${totalElapsed}ms`);
  console.log(`${colors.bold}======================================================${colors.reset}`);

  if (totalFailed > 0) {
    console.error(`\n${colors.red}${colors.bold}FAILED: ${totalFailed} test(s) failed.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}SUCCESS: All ${totalPassed} test cases passed perfectly!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
