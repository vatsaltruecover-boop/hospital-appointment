import { clinicStore } from './store.js';
import { renderSharedHeader, showAppToast, resolveClinicFromUrl } from './common.js';

let selectedSessionId = null;
let redirectTimer = null;

export function initPatientScreen() {
  resolveClinicFromUrl();
  renderSharedHeader('patient');
  renderClinicInfo();
  renderSessionsList();
  setupBookingEvents();

  // Listen to store updates (token advanced by doctor, new sessions, etc.)
  clinicStore.subscribe((state, event) => {
    renderClinicInfo();
    renderSessionsList();
    if (event.type === 'TOKEN_CALLED_NEXT') {
      showAppToast(`Queue Alert: Now serving Token #${event.payload.tokenNumber}`, 'info');
    }
  });
}

function renderClinicInfo() {
  const clinic = clinicStore.getCurrentClinic();
  const queueData = clinicStore.getLiveQueue(clinic.id);
  const activeSession = queueData.session;

  // Header Hero Card Elements
  const clinicNameEl = document.getElementById('clinic-name-display');
  const doctorNameEl = document.getElementById('doctor-name-display');
  const doctorSpecialtyEl = document.getElementById('doctor-specialty-display');
  const clinicCabinEl = document.getElementById('clinic-cabin-display');
  const clinicPhoneEl = document.getElementById('clinic-phone-display');
  const clinicAddressEl = document.getElementById('clinic-address-display');

  if (clinicNameEl) clinicNameEl.textContent = clinic.name;
  if (doctorNameEl) doctorNameEl.textContent = clinic.doctorName;
  if (doctorSpecialtyEl) doctorSpecialtyEl.textContent = clinic.specialty;
  if (clinicCabinEl) clinicCabinEl.textContent = clinic.cabin;
  if (clinicPhoneEl) clinicPhoneEl.textContent = clinic.phone;
  if (clinicAddressEl) clinicAddressEl.textContent = clinic.address;

  // Live Strip
  const runningSessionNameEl = document.getElementById('running-session-name');
  const runningSessionTimeEl = document.getElementById('running-session-time');
  const runningTokenNumberEl = document.getElementById('running-token-number');
  const estWaitTimeEl = document.getElementById('estimated-wait-time');

  if (activeSession) {
    if (runningSessionNameEl) runningSessionNameEl.textContent = activeSession.name;
    if (runningSessionTimeEl) runningSessionTimeEl.textContent = `${activeSession.startTime} - ${activeSession.endTime}`;
  } else {
    if (runningSessionNameEl) runningSessionNameEl.textContent = 'No Active Session Running';
    if (runningSessionTimeEl) runningSessionTimeEl.textContent = 'Check schedule below';
  }

  const currentToken = queueData.currentTokenNumber || 0;
  if (runningTokenNumberEl) {
    runningTokenNumberEl.textContent = currentToken > 0 ? (currentToken < 10 ? `0${currentToken}` : `${currentToken}`) : '--';
  }

  // Calculate estimated wait for next person booking
  const totalWaiting = queueData.nextApts ? queueData.nextApts.length : 0;
  const estimatedMins = (totalWaiting + 1) * (clinic.avgTimePerPatientMinutes || 8);
  if (estWaitTimeEl) {
    estWaitTimeEl.textContent = activeSession ? `~${estimatedMins} mins` : 'Next session';
  }
}

function renderSessionsList() {
  const clinic = clinicStore.getCurrentClinic();
  const sessions = clinicStore.getSessionsForClinic(clinic.id);
  const container = document.getElementById('sessions-slot-container');
  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
        No sessions scheduled for today yet.
      </div>
    `;
    return;
  }

  // Auto-select first active or first session if none selected
  if (!selectedSessionId || !sessions.some(s => s.id === selectedSessionId)) {
    const active = sessions.find(s => s.status === 'active') || sessions[0];
    selectedSessionId = active.id;
  }

  container.innerHTML = sessions.map(session => {
    const apts = clinicStore.getAppointmentsForSession(session.id);
    const bookedCount = apts.length;
    const capacity = session.totalCapacity;
    const availableSlots = Math.max(0, capacity - bookedCount);
    const fillPercent = Math.min(100, Math.round((bookedCount / capacity) * 100));
    const isSelected = session.id === selectedSessionId;
    const isRunning = session.status === 'active';

    return `
      <div class="session-slot-item ${isSelected ? 'selected' : ''} ${isRunning ? 'active-running' : ''}" data-session-id="${session.id}">
        <div class="slot-item-top">
          <div class="slot-title">${session.name}</div>
          <span class="pulse-badge ${isRunning ? 'live' : 'scheduled'}">
            <span class="pulse-dot ${isRunning ? 'animated' : ''}"></span>
            ${isRunning ? 'Running Now' : 'Scheduled'}
          </span>
        </div>
        <div class="slot-timing">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>${session.startTime} - ${session.endTime} (${session.durationHours} hrs &bull; ${capacity} tokens)</span>
        </div>
        ${session.hourlyTokens && session.hourlyTokens.length > 0 ? `
          <div style="display:flex; flex-wrap:wrap; gap:0.25rem; margin-bottom:0.65rem;">
            ${session.hourlyTokens.map(h => `
              <span style="font-size:0.7rem; font-family:var(--font-mono); background:var(--color-bg-subtle); padding:0.15rem 0.4rem; border-radius:var(--radius-sm); color:var(--color-text-muted);">
                ${h.start || h.label.split(' - ')[0]}-${h.end || h.label.split(' - ')[1]}: <strong style="color:var(--color-primary);">${h.tokens}</strong>
              </span>
            `).join('')}
          </div>
        ` : ''}
        <div class="slot-capacity-bar-wrap">
          <div class="slot-capacity-bar-fill" style="width: ${fillPercent}%;"></div>
        </div>
        <div class="slot-stats-row">
          <span>Booked: ${bookedCount} / ${capacity}</span>
          <span class="slot-available-count">
            ${availableSlots > 0 ? `${availableSlots} slots remaining` : '<span style="color:var(--color-danger)">Fully Booked</span>'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  // Add click listeners to select session
  container.querySelectorAll('.session-slot-item').forEach(el => {
    el.addEventListener('click', () => {
      selectedSessionId = el.dataset.sessionId;
      renderSessionsList();
      updateSelectedSessionDisplay();
    });
  });

  updateSelectedSessionDisplay();
}

function updateSelectedSessionDisplay() {
  const session = clinicStore.getSessionsForClinic().find(s => s.id === selectedSessionId);
  const displayEl = document.getElementById('selected-session-tag');
  if (displayEl && session) {
    displayEl.textContent = `Selected: ${session.name} (${session.startTime} - ${session.endTime})`;
  }
}

function setupBookingEvents() {
  const patientNameInput = document.getElementById('patient-name-input');
  const patientPhoneInput = document.getElementById('patient-phone-input');
  const bookAppointmentBtn = document.getElementById('book-appointment-btn');

  if (bookAppointmentBtn) {
    bookAppointmentBtn.addEventListener('click', () => {
      const name = patientNameInput ? patientNameInput.value.trim() : '';
      const phone = patientPhoneInput ? patientPhoneInput.value.trim() : '';

      if (!name) {
        showAppToast('Please enter your full name', 'warning');
        if (patientNameInput) patientNameInput.focus();
        return;
      }

      if (!phone || phone.length < 5) {
        showAppToast('Please enter your phone number', 'warning');
        if (patientPhoneInput) patientPhoneInput.focus();
        return;
      }

      const clinic = clinicStore.getCurrentClinic();

      try {
        const appointment = clinicStore.bookAppointment({
          clinicId: clinic.id,
          sessionId: selectedSessionId,
          patientName: name,
          phone
        });

        // Show Voucher Modal & Countdown Redirect to Screen 2
        showVoucherModal(appointment);
      } catch (err) {
        showAppToast(err.message || 'Failed to book appointment', 'warning');
      }
    });
  }
}

// Booking Confirmation Modal
function showVoucherModal(appointment) {
  const modalBackdrop = document.getElementById('voucher-modal-backdrop');
  const tokenDisplay = document.getElementById('voucher-token-number');
  const patientDisplay = document.getElementById('voucher-patient-name');
  const sessionDisplay = document.getElementById('voucher-session-name');
  const estTimeDisplay = document.getElementById('voucher-expected-time');
  const aheadDisplay = document.getElementById('voucher-patients-ahead');
  const cabinDisplay = document.getElementById('voucher-cabin-name');
  const goToTvBtn = document.getElementById('voucher-go-to-tv-btn');
  const stayBtn = document.getElementById('voucher-stay-btn');
  const countdownEl = document.getElementById('redirect-countdown');

  const clinic = clinicStore.getCurrentClinic();
  const session = clinicStore.getSessionsForClinic().find(s => s.id === appointment.sessionId);

  tokenDisplay.textContent = appointment.tokenNumber < 10 ? `0${appointment.tokenNumber}` : `${appointment.tokenNumber}`;
  patientDisplay.textContent = appointment.patientName;
  sessionDisplay.textContent = session ? session.name : 'OPD Session';
  estTimeDisplay.textContent = appointment.estimatedTime;
  aheadDisplay.textContent = `${appointment.patientsAhead} patient(s) ahead (approx ${appointment.waitMinutes} mins wait)`;
  cabinDisplay.textContent = clinic.cabin;

  modalBackdrop.classList.add('active');

  // 5 seconds countdown to TV redirect
  let countdownSecs = 5;
  if (countdownEl) countdownEl.textContent = `Redirecting to Live TV Screen in ${countdownSecs} seconds...`;

  if (redirectTimer) clearInterval(redirectTimer);
  redirectTimer = setInterval(() => {
    countdownSecs -= 1;
    if (countdownEl) countdownEl.textContent = `Redirecting to Live TV Screen in ${countdownSecs} seconds...`;
    if (countdownSecs <= 0) {
      clearInterval(redirectTimer);
      window.location.href = `/live-tv.html?clinic=${clinic.slug}&myToken=${appointment.tokenNumber}`;
    }
  }, 1000);

  goToTvBtn.onclick = () => {
    if (redirectTimer) clearInterval(redirectTimer);
    window.location.href = `/live-tv.html?clinic=${clinic.slug}&myToken=${appointment.tokenNumber}`;
  };

  stayBtn.onclick = () => {
    if (redirectTimer) clearInterval(redirectTimer);
    modalBackdrop.classList.remove('active');
    // Reset booking form
    const nameInp = document.getElementById('patient-name-input');
    const phoneInp = document.getElementById('patient-phone-input');
    if (nameInp) nameInp.value = '';
    if (phoneInp) phoneInp.value = '';
  };
}
