// UI Integrity & Layout Structure Tests
// Checks that all HTML screens, critical interactive element IDs, modal scroll containers,
// and style standard tokens are intact to prevent UI breakage.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TestRunner, assert, assertEqual } from './helpers/test-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export async function runUiIntegrityTests() {
  const runner = new TestRunner('UI Structure & Integrity Tests');

  const pages = [
    { file: 'index.html', title: 'Patient Booking Portal' },
    { file: 'doctor.html', title: "Doctor's Console" },
    { file: 'live-tv.html', title: 'Live TV Waiting Room' },
    { file: 'admin.html', title: 'Super Admin Command Center' }
  ];

  // Test 1: Page Existence & SEO/HTML5 Standards
  runner.test('All HTML pages exist with valid HTML5 doctype, viewport, and title', () => {
    pages.forEach(p => {
      const fullPath = path.join(rootDir, p.file);
      assert(fs.existsSync(fullPath), `Page ${p.file} must exist`);
      const content = fs.readFileSync(fullPath, 'utf8');

      assert(content.includes('<!DOCTYPE html>'), `${p.file} must include <!DOCTYPE html>`);
      assert(content.includes('<meta name="viewport"'), `${p.file} must include responsive viewport meta tag`);
      assert(content.includes('<title>'), `${p.file} must include a <title> tag`);
    });
  });

  // Test 2: Admin Screen Critical Elements & Scrollable Form
  runner.test('admin.html has all required IDs and scrollable onboard form with pinned footer', () => {
    const content = fs.readFileSync(path.join(rootDir, 'admin.html'), 'utf8');

    const requiredIds = [
      'modal-onboard-clinic',
      'onboard-clinic-form',
      'onboard-input-name',
      'onboard-input-slug',
      'onboard-input-doctor',
      'onboard-input-username',
      'onboard-input-password',
      'btn-submit-onboard',
      'modal-onboard-close',
      'admin-clinics-container',
      'modal-share-creds',
      'modal-admin-login'
    ];

    requiredIds.forEach(id => {
      assert(content.includes(`id="${id}"`), `admin.html is missing required interactive element id: #${id}`);
    });

    // Check that onboard form uses scrollable form structure
    assert(
      content.includes('class="modal-form-scrollable"'),
      'admin.html must use modal-form-scrollable to prevent form cutoff'
    );
    // Submit button must be inside modal-footer
    assert(
      content.includes('modal-footer') && content.includes('id="btn-submit-onboard"'),
      'admin.html must have submit button inside modal-footer'
    );
  });

  // Test 3: Doctor Screen Critical Elements & Hourly Token Controls
  runner.test('doctor.html contains hourly token configuration and edit modal elements', () => {
    const content = fs.readFileSync(path.join(rootDir, 'doctor.html'), 'utf8');

    const requiredIds = [
      'session-modal-backdrop',
      'session-modal-title',
      'sess-input-name',
      'sess-input-start',
      'sess-input-end',
      'sess-input-duration',
      'sess-input-rate',
      'sess-hourly-slots-container',
      'sess-btn-reset-equal',
      'sess-distribution-badge',
      'session-modal-save',
      'doc-sessions-grid',
      'btn-open-create-session',
      'doc-now-serving-num',
      'btn-call-next',
      'btn-complete',
      'btn-recall',
      'btn-skip'
    ];

    requiredIds.forEach(id => {
      assert(content.includes(`id="${id}"`), `doctor.html is missing required interactive element id: #${id}`);
    });

    // Check that standalone modal-add-tokens has been removed as add/subtract is in edit modal
    assert(!content.includes('id="modal-add-tokens"'), 'doctor.html must not contain separate modal-add-tokens');
  });

  // Test 4: Patient Screen Elements (No OTP blocking)
  runner.test('index.html contains patient booking elements without OTP requirement', () => {
    const content = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

    const requiredIds = [
      'sessions-slot-container',
      'booking-form',
      'patient-name-input',
      'patient-phone-input',
      'book-appointment-btn',
      'running-token-number',
      'running-session-name',
      'clinic-name-display'
    ];

    requiredIds.forEach(id => {
      assert(content.includes(`id="${id}"`), `index.html is missing required interactive element id: #${id}`);
    });

    // Verify OTP input is not mandatory for patient
    assert(
      !content.includes('required id="otp-input"'),
      'index.html must not mandate OTP for patient booking'
    );
  });

  // Test 5: Live TV Screen Critical Elements
  runner.test('live-tv.html contains waiting room TV board and big token display', () => {
    const content = fs.readFileSync(path.join(rootDir, 'live-tv.html'), 'utf8');

    const requiredIds = [
      'tv-clinic-name',
      'tv-big-token',
      'tv-room-destination',
      'tv-next-queue-grid',
      'tv-clock-display'
    ];

    requiredIds.forEach(id => {
      assert(content.includes(`id="${id}"`), `live-tv.html is missing required TV screen element id: #${id}`);
    });
  });

  // Test 6: CSS Modal & Table Scroll Standards
  runner.test('base.css specifies flex modal layout, max-height, and table scroll containers', () => {
    const baseCss = fs.readFileSync(path.join(rootDir, 'src/styles/base.css'), 'utf8');

    assert(baseCss.includes('.modal-box'), 'base.css must define .modal-box');
    assert(baseCss.includes('max-height'), 'base.css .modal-box must define max-height to avoid off-screen overflow');
    assert(baseCss.includes('overflow-y: auto'), 'base.css must define scrollable overflow-y for .modal-body');
    assert(baseCss.includes('.table-scroll-container') || baseCss.includes('.table-responsive'), 'base.css must provide table scroll container rule');
  });

  // Test 7: JavaScript Script Reference Integrity
  runner.test('All HTML script tags reference valid JavaScript source files', () => {
    pages.forEach(p => {
      const content = fs.readFileSync(path.join(rootDir, p.file), 'utf8');
      const scriptMatches = content.match(/src="([^"]+\.js)"/g) || [];
      const moduleMatches = content.match(/from '([^']+\.js)'/g) || [];

      [...scriptMatches, ...moduleMatches].forEach(match => {
        let relPath = match.replace(/^src="/, '').replace(/"$/, '').replace(/^from '/, '').replace(/'$/, '');
        if (relPath.startsWith('/')) relPath = relPath.slice(1);
        const resolved = path.join(rootDir, relPath);
        assert(fs.existsSync(resolved), `${p.file} references missing script file: ${relPath}`);
      });
    });
  });

  return await runner.run();
}

if (process.argv[1] && process.argv[1].endsWith('ui-integrity.test.js')) {
  runUiIntegrityTests();
}
