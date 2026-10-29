// Screen 3: Doctor's Console Logic (Doctor CANNOT add clinics)
import { clinicStore, generateHourlySlots, ensureSessionHourlyTokens } from './store.js';
import { authService } from './auth.js';
import { renderSharedHeader, showAppToast, resolveClinicFromUrl } from './common.js';
import { queueAudio } from './chime.js';

let activePanel = 'live-tv'; // 'live-tv' | 'sessions' | 'clinic-settings'
let editingSessionId = null;
let currentHourlySlots = [];

export function initDoctorScreen() {
  resolveClinicFromUrl();
  renderSharedHeader('doctor');
  setupSidebarNavigation();
  checkAuthAndRenderBanner();
  renderDoctorProfile();
  renderCurrentPanel();
  setupDoctorLoginModal();

  // Listen for real-time updates
  clinicStore.subscribe((state, event) => {
    renderDoctorProfile();
    renderCurrentPanel();
  });

  // Listen for auth changes
  authService.subscribe(() => {
    checkAuthAndRenderBanner();
    renderDoctorProfile();
    renderCurrentPanel();
  });
}

function checkAuthAndRenderBanner() {
  const isSuper = authService.isSuperAdmin();
  const banner = document.getElementById('super-admin-banner');
  const bannerText = document.getElementById('super-admin-banner-text');
  const currentClinic = clinicStore.getCurrentClinic();

  if (isSuper && banner) {
    banner.style.display = 'flex';
    if (bannerText) {
      bannerText.innerHTML = `Super Admin viewing Doctor Console for <strong>${currentClinic.name}</strong> (<code>/${currentClinic.slug}</code>)`;
    }
  } else if (banner) {
    banner.style.display = 'none';
  }

  // If user is guest (neither doctor nor super admin), show login modal
  const currentAuth = authService.getSession();
  const loginModal = document.getElementById('doctor-login-modal');
  if (loginModal && currentAuth && currentAuth.role === 'guest') {
    loginModal.classList.add('active');
  }
}

function setupSidebarNavigation() {
  const navButtons = document.querySelectorAll('.sidebar-nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPanel = btn.dataset.panel;
      if (targetPanel) {
        switchPanel(targetPanel);
      }
    });
  });
}

function switchPanel(panelName) {
  activePanel = panelName;

  document.querySelectorAll('.sidebar-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.panel === panelName);
  });

  document.querySelectorAll('.panel-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `panel-${panelName}`);
  });

  renderCurrentPanel();
}

function renderDoctorProfile() {
  const clinic = clinicStore.getCurrentClinic();
  const profileName = document.getElementById('doctor-profile-name');
  const profileSpecialty = document.getElementById('doctor-profile-specialty');
  const activeClinicDisplay = document.getElementById('sidebar-active-clinic');
  const endpointTag = document.getElementById('sidebar-endpoint-tag');
  const btnOpenTv = document.getElementById('btn-open-tv-link');

  if (profileName) profileName.textContent = clinic.doctorName;
  if (profileSpecialty) profileSpecialty.textContent = clinic.specialty;
  if (activeClinicDisplay) activeClinicDisplay.textContent = clinic.name;
  if (endpointTag) endpointTag.textContent = `/${clinic.slug}`;
  if (btnOpenTv) btnOpenTv.href = `/live-tv.html?clinic=${clinic.slug}`;
}

function renderCurrentPanel() {
  if (activePanel === 'live-tv') {
    renderLiveTVController();
  } else if (activePanel === 'sessions') {
    renderSessionsManager();
  } else if (activePanel === 'clinic-settings') {
    renderMyClinicSettings();
  }
}

// ==========================================
// PANEL 1: LIVE-TV / QUEUE CONTROLLER
// ==========================================
function renderLiveTVController() {
  const clinic = clinicStore.getCurrentClinic();
  const queueData = clinicStore.getLiveQueue(clinic.id);
  const activeSession = queueData.session;
  const currentToken = queueData.currentTokenNumber || 0;

  const nowServingNumEl = document.getElementById('doc-now-serving-num');
  const nowServingPatientEl = document.getElementById('doc-now-patient-name');
  const nowServingPhoneEl = document.getElementById('doc-now-patient-phone');
  const activeSessionTitleEl = document.getElementById('doc-active-session-label');

  if (activeSessionTitleEl) {
    activeSessionTitleEl.textContent = activeSession
      ? `Active: ${activeSession.name} (${activeSession.startTime} - ${activeSession.endTime})`
      : 'No Active Session Running';
  }

  if (nowServingNumEl) {
    nowServingNumEl.textContent = currentToken > 0 ? (currentToken < 10 ? `0${currentToken}` : `${currentToken}`) : '--';
  }

  const currentApt = queueData.currentApt;
  if (nowServingPatientEl) {
    nowServingPatientEl.textContent = currentApt ? currentApt.patientName : (currentToken > 0 ? 'Direct Walk-in Patient' : 'Queue Idle');
  }
  if (nowServingPhoneEl) {
    nowServingPhoneEl.textContent = currentApt ? currentApt.phone : 'Waiting to call next';
  }

  // Bind Action Buttons
  const btnNext = document.getElementById('btn-call-next');
  const btnRecall = document.getElementById('btn-recall');
  const btnComplete = document.getElementById('btn-complete');
  const btnSkip = document.getElementById('btn-skip');
  const btnPrev = document.getElementById('btn-prev');
  const btnAddWalkin = document.getElementById('btn-add-walkin');

  if (btnNext) {
    btnNext.onclick = () => {
      try {
        const nextNum = clinicStore.callNextToken(clinic.id);
        queueAudio.playChime();
        showAppToast(`Called Token #${nextNum}`, 'success');
      } catch (err) {
        showAppToast(err.message, 'warning');
      }
    };
  }

  if (btnRecall) {
    btnRecall.onclick = () => {
      clinicStore.recallToken(clinic.id);
      queueAudio.announceToken(currentToken, clinic.cabin);
      showAppToast(`Re-announced Token #${currentToken} on Live TV`, 'info');
    };
  }

  if (btnComplete) {
    btnComplete.onclick = () => {
      clinicStore.markTokenCompleted(clinic.id);
      showAppToast(`Token #${currentToken} marked as Completed`, 'success');
    };
  }

  if (btnSkip) {
    btnSkip.onclick = () => {
      clinicStore.skipToken(clinic.id);
      showAppToast(`Token #${currentToken} marked as No-Show. Calling next.`, 'warning');
    };
  }

  if (btnPrev) {
    btnPrev.onclick = () => {
      clinicStore.callPrevToken(clinic.id);
      showAppToast('Switched to previous token', 'info');
    };
  }

  if (btnAddWalkin) {
    btnAddWalkin.onclick = () => {
      showWalkinModal();
    };
  }

  // Render Queue Table
  const tableBody = document.getElementById('doc-queue-table-body');
  const countBadge = document.getElementById('queue-count-badge');
  if (tableBody) {
    const apts = queueData.allApts || [];

    if (countBadge) {
      countBadge.innerHTML = apts.length > 7
        ? `<span>${apts.length} Patients Total</span> &bull; <span>Showing 5-7 (Scroll &#8597;)</span>`
        : `<span>${apts.length} Patient${apts.length === 1 ? '' : 's'} in Queue</span>`;
    }

    if (apts.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2rem; color: var(--color-text-muted);">
            No appointments booked yet for this session. Use Screen 1 to book or add a walk-in patient.
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = apts.map(apt => {
        const isCurrent = apt.tokenNumber === currentToken;
        const formattedToken = apt.tokenNumber < 10 ? `0${apt.tokenNumber}` : `${apt.tokenNumber}`;

        let statusBadge = '';
        if (apt.status === 'serving') {
          statusBadge = `<span class="pulse-badge live"><span class="pulse-dot animated"></span> In Room</span>`;
        } else if (apt.status === 'completed') {
          statusBadge = `<span class="pulse-badge" style="background:#e2e8f0; color:#475569;">Completed</span>`;
        } else if (apt.status === 'skipped') {
          statusBadge = `<span class="pulse-badge" style="background:#fee2e2; color:#b91c1c;">No Show</span>`;
        } else {
          statusBadge = `<span class="pulse-badge scheduled">Waiting</span>`;
        }

        return `
          <tr style="${isCurrent ? 'background: #f0fdfa; font-weight: 600;' : ''}">
            <td>
              <span class="table-token-badge ${isCurrent ? 'serving' : ''}">#${formattedToken}</span>
            </td>
            <td>${apt.patientName}</td>
            <td>${apt.phone}</td>
            <td>${apt.bookedAt}</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline call-specific-btn" data-token="${apt.tokenNumber}">
                Call #${formattedToken}
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.querySelectorAll('.call-specific-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const tNum = parseInt(btn.dataset.token, 10);
          const queue = clinicStore.state.liveQueues[clinic.id];
          if (queue) {
            queue.currentTokenNumber = tNum;
            queue.startedAt = Date.now();
            clinicStore.commit('TOKEN_CALLED_NEXT', { clinicId: clinic.id, tokenNumber: tNum });
            queueAudio.announceToken(tNum, clinic.cabin);
            showAppToast(`Now serving Token #${tNum}`, 'info');
          }
        });
      });
    }
  }
}

function showWalkinModal() {
  const patientName = prompt('Enter Walk-in Patient Name:');
  if (!patientName || !patientName.trim()) return;

  const phone = prompt('Enter Patient Phone Number (optional):') || 'Walk-in';
  const clinic = clinicStore.getCurrentClinic();
  const activeSess = clinicStore.getActiveSession(clinic.id);

  if (!activeSess) {
    alert('Please activate or create a session first.');
    return;
  }

  try {
    const apt = clinicStore.bookAppointment({
      clinicId: clinic.id,
      sessionId: activeSess.id,
      patientName,
      phone
    });
    showAppToast(`Allotted Token #${apt.tokenNumber} to ${patientName}`, 'success');
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================
// PANEL 2: SESSIONS MANAGER (Tokens/Hour Quota & Hourly Breakdown)
// ==========================================
function renderSessionsManager() {
  const clinic = clinicStore.getCurrentClinic();
  const sessions = clinicStore.getSessionsForClinic(clinic.id);
  const grid = document.getElementById('doc-sessions-grid');

  if (grid) {
    if (sessions.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
          <p style="color:var(--color-text-muted); margin-bottom: 1rem;">No sessions created yet for this clinic.</p>
          <button id="btn-create-first-session" class="btn btn-primary">+ Create First Session</button>
        </div>
      `;
      const btnFirst = document.getElementById('btn-create-first-session');
      if (btnFirst) btnFirst.onclick = openCreateSessionModal;
    } else {
      grid.innerHTML = sessions.map(session => {
        const apts = clinicStore.getAppointmentsForSession(session.id);
        const booked = apts.length;
        const isActive = session.status === 'active';
        ensureSessionHourlyTokens(session);

        return `
          <div class="session-admin-card ${isActive ? 'is-active' : ''}">
            <div>
              <div class="session-admin-top">
                <div>
                  <h3 class="session-admin-title">${session.name}</h3>
                  <div style="font-size:0.85rem; color:var(--color-text-muted); display:flex; align-items:center; gap:0.4rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span>${session.startTime} - ${session.endTime} (${session.durationHours} hrs)</span>
                  </div>
                </div>
                <span class="pulse-badge ${isActive ? 'live' : 'scheduled'}">
                  <span class="pulse-dot ${isActive ? 'animated' : ''}"></span>
                  ${isActive ? 'Active / Live' : 'Scheduled'}
                </span>
              </div>

              <!-- Token Allotment Formula Banner -->
              <div class="session-rule-banner" style="margin: 1rem 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.35rem;">
                  <span>Default Rate: <strong>${session.tokensPerHour} tokens/hr</strong></span>
                  <span class="rule-highlight" style="font-size:0.9rem;">${session.totalCapacity} Tokens Allotted</span>
                </div>
                <div style="margin-top:0.35rem; font-size:0.8rem; color:var(--color-text-muted);">
                  Currently Booked: <strong>${booked} / ${session.totalCapacity}</strong>
                  ${session.totalCapacity - booked > 0 ? `(${session.totalCapacity - booked} available)` : '<span style="color:var(--color-danger); font-weight:700;">(Full)</span>'}
                </div>

                <!-- Hourly Token Chips Breakdown -->
                <div class="session-hourly-chips-wrap">
                  ${(session.hourlyTokens || []).map(h => `
                    <span class="hourly-token-pill" title="${h.label}: ${h.tokens} tokens">
                      ${h.start || h.label.split(' - ')[0]}-${h.end || h.label.split(' - ')[1]}: <strong>${h.tokens}</strong>
                    </span>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="session-actions-footer">
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-success'} toggle-active-session-btn" data-id="${session.id}">
                  ${isActive ? 'Active (Live)' : 'Set as Live'}
                </button>
              </div>
              <div style="display:flex; gap:0.4rem;">
                <button class="btn btn-sm btn-secondary edit-session-btn" data-id="${session.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-session-btn" data-id="${session.id}">Delete</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      grid.querySelectorAll('.toggle-active-session-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sId = btn.dataset.id;
          clinicStore.updateSession(sId, { status: 'active' });
          showAppToast('Session activated and live on queue!', 'success');
        });
      });

      grid.querySelectorAll('.delete-session-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sId = btn.dataset.id;
          if (confirm('Are you sure you want to delete this session?')) {
            clinicStore.deleteSession(sId);
            showAppToast('Session deleted', 'info');
          }
        });
      });

      grid.querySelectorAll('.edit-session-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openEditSessionModal(btn.dataset.id);
        });
      });
    }
  }

  const btnCreateSession = document.getElementById('btn-open-create-session');
  if (btnCreateSession) {
    btnCreateSession.onclick = openCreateSessionModal;
  }

  setupSessionModalEvents();
}

function renderHourlySlotsContainer(containerEl, slots, onSlotChange) {
  if (!containerEl) return;
  containerEl.innerHTML = slots.map((s, idx) => `
    <div class="hourly-slot-row" data-index="${idx}">
      <div class="slot-label-group">
        <span class="slot-hour-badge">Hr ${idx + 1}</span>
        <span style="font-weight:600; font-size:0.85rem; color:var(--color-text-main);">${s.label}</span>
      </div>
      <div class="slot-controls-group">
        <button type="button" class="slot-step-btn btn-slot-dec" data-index="${idx}" title="Decrease tokens for this hour">&minus;</button>
        <input type="number" class="slot-tokens-input input-slot-val" data-index="${idx}" min="0" max="60" value="${s.tokens}">
        <button type="button" class="slot-step-btn btn-slot-inc" data-index="${idx}" title="Increase tokens for this hour">&plus;</button>
        <span style="font-size:0.75rem; color:var(--color-text-muted); margin-left:0.2rem;">tokens</span>
      </div>
    </div>
  `).join('');

  containerEl.querySelectorAll('.btn-slot-dec').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.index, 10);
      if (slots[i].tokens > 0) {
        slots[i].tokens -= 1;
        const input = containerEl.querySelector(`.input-slot-val[data-index="${i}"]`);
        if (input) input.value = slots[i].tokens;
        if (onSlotChange) onSlotChange(slots);
      }
    };
  });

  containerEl.querySelectorAll('.btn-slot-inc').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.index, 10);
      slots[i].tokens += 1;
      const input = containerEl.querySelector(`.input-slot-val[data-index="${i}"]`);
      if (input) input.value = slots[i].tokens;
      if (onSlotChange) onSlotChange(slots);
    };
  });

  containerEl.querySelectorAll('.input-slot-val').forEach(input => {
    input.oninput = () => {
      const i = parseInt(input.dataset.index, 10);
      const val = Math.max(0, parseInt(input.value, 10) || 0);
      slots[i].tokens = val;
      if (onSlotChange) onSlotChange(slots);
    };
  });
}

function recalculateSessionCapacity() {
  const defaultRate = parseInt(document.getElementById('sess-input-rate')?.value, 10) || 7;
  const total = currentHourlySlots.reduce((sum, s) => sum + (parseInt(s.tokens, 10) || 0), 0);

  const totalNumEl = document.getElementById('sess-total-capacity-val');
  if (totalNumEl) totalNumEl.textContent = total;

  const badge = document.getElementById('sess-distribution-badge');
  if (badge) {
    const isAllDefault = currentHourlySlots.length > 0 && currentHourlySlots.every(s => s.tokens === defaultRate);
    if (isAllDefault) {
      badge.textContent = `Equal Distribution (${defaultRate} / hr)`;
      badge.style.background = '#ccfbf1';
      badge.style.color = '#0f766e';
    } else {
      badge.textContent = 'Custom Hourly Breakdown';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
    }
  }
}

function openCreateSessionModal() {
  editingSessionId = null;
  const modal = document.getElementById('session-modal-backdrop');
  const title = document.getElementById('session-modal-title');
  if (title) title.textContent = 'Create New Session';

  document.getElementById('sess-input-name').value = '';
  document.getElementById('sess-input-start').value = '09:00';
  document.getElementById('sess-input-end').value = '12:00';
  document.getElementById('sess-input-duration').value = '3';
  document.getElementById('sess-input-rate').value = '7';

  currentHourlySlots = generateHourlySlots('09:00', '12:00', 7);
  const container = document.getElementById('sess-hourly-slots-container');
  renderHourlySlotsContainer(container, currentHourlySlots, () => recalculateSessionCapacity());
  recalculateSessionCapacity();

  modal.classList.add('active');
}

function openEditSessionModal(sessionId) {
  editingSessionId = sessionId;
  const clinic = clinicStore.getCurrentClinic();
  const session = clinicStore.getSessionsForClinic(clinic.id).find(s => s.id === sessionId);
  if (!session) return;

  const modal = document.getElementById('session-modal-backdrop');
  const title = document.getElementById('session-modal-title');
  if (title) title.textContent = 'Edit Session';

  document.getElementById('sess-input-name').value = session.name;
  document.getElementById('sess-input-start').value = session.startTime;
  document.getElementById('sess-input-end').value = session.endTime;
  document.getElementById('sess-input-duration').value = session.durationHours;
  document.getElementById('sess-input-rate').value = session.tokensPerHour;

  ensureSessionHourlyTokens(session);
  currentHourlySlots = JSON.parse(JSON.stringify(session.hourlyTokens || []));
  const container = document.getElementById('sess-hourly-slots-container');
  renderHourlySlotsContainer(container, currentHourlySlots, () => recalculateSessionCapacity());
  recalculateSessionCapacity();

  modal.classList.add('active');
}

function setupSessionModalEvents() {
  const modal = document.getElementById('session-modal-backdrop');
  const closeBtn = document.getElementById('session-modal-close');
  const cancelBtn = document.getElementById('session-modal-cancel');
  const saveBtn = document.getElementById('session-modal-save');
  const durationInput = document.getElementById('sess-input-duration');
  const rateInput = document.getElementById('sess-input-rate');
  const startInput = document.getElementById('sess-input-start');
  const endInput = document.getElementById('sess-input-end');
  const btnResetEqual = document.getElementById('sess-btn-reset-equal');

  const updateDurationAndSlots = () => {
    const s = startInput.value;
    const e = endInput.value;
    const defaultRate = parseInt(rateInput.value, 10) || 7;
    if (s && e) {
      const [sh, sm] = s.split(':').map(Number);
      const [eh, em] = e.split(':').map(Number);
      let diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) {
        durationInput.value = (diff / 60).toFixed(1);
      }
      currentHourlySlots = generateHourlySlots(s, e, defaultRate);
      const container = document.getElementById('sess-hourly-slots-container');
      renderHourlySlotsContainer(container, currentHourlySlots, () => recalculateSessionCapacity());
      recalculateSessionCapacity();
    }
  };

  if (startInput) startInput.onchange = updateDurationAndSlots;
  if (endInput) endInput.onchange = updateDurationAndSlots;

  if (rateInput) {
    rateInput.oninput = () => {
      const defaultRate = parseInt(rateInput.value, 10) || 7;
      currentHourlySlots.forEach(s => s.tokens = defaultRate);
      const container = document.getElementById('sess-hourly-slots-container');
      renderHourlySlotsContainer(container, currentHourlySlots, () => recalculateSessionCapacity());
      recalculateSessionCapacity();
    };
  }

  if (btnResetEqual) {
    btnResetEqual.onclick = () => {
      const defaultRate = parseInt(rateInput.value, 10) || 7;
      currentHourlySlots.forEach(s => s.tokens = defaultRate);
      const container = document.getElementById('sess-hourly-slots-container');
      renderHourlySlotsContainer(container, currentHourlySlots, () => recalculateSessionCapacity());
      recalculateSessionCapacity();
      showAppToast(`Reset hourly tokens to default rate (${defaultRate} tokens/hour)`, 'info');
    };
  }

  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.remove('active');

  if (saveBtn) {
    saveBtn.onclick = () => {
      const clinic = clinicStore.getCurrentClinic();
      const name = document.getElementById('sess-input-name').value.trim();
      const startTime = document.getElementById('sess-input-start').value;
      const endTime = document.getElementById('sess-input-end').value;
      const durationHours = parseFloat(document.getElementById('sess-input-duration').value) || 3;
      const tokensPerHour = parseInt(document.getElementById('sess-input-rate').value, 10) || 7;

      if (!name) {
        alert('Please enter session name');
        return;
      }

      const totalCapacity = currentHourlySlots.reduce((sum, s) => sum + (parseInt(s.tokens, 10) || 0), 0)
        || Math.round(durationHours * tokensPerHour);

      if (editingSessionId) {
        clinicStore.updateSession(editingSessionId, {
          name,
          startTime,
          endTime,
          durationHours,
          tokensPerHour,
          hourlyTokens: currentHourlySlots,
          totalCapacity
        });
        showAppToast('Session updated successfully with hourly tokens!', 'success');
      } else {
        clinicStore.createSession({
          clinicId: clinic.id,
          name,
          startTime,
          endTime,
          durationHours,
          tokensPerHour,
          hourlyTokens: currentHourlySlots,
          totalCapacity
        });
        showAppToast('New session created successfully!', 'success');
      }

      modal.classList.remove('active');
      renderSessionsManager();
    };
  }
}



// ========================================================
// PANEL 3: MY CLINIC SETTINGS (Doctor CANNOT add clinics)
// ========================================================
function renderMyClinicSettings() {
  const clinic = clinicStore.getCurrentClinic();
  const urls = clinicStore.getClinicEndpointUrls(clinic);

  const endpointSlugEl = document.getElementById('doc-settings-endpoint-slug');
  const patientUrlInput = document.getElementById('doc-patient-url-input');
  const tvUrlInput = document.getElementById('doc-tv-url-input');

  if (endpointSlugEl) endpointSlugEl.textContent = clinic.slug;
  if (patientUrlInput && urls) patientUrlInput.value = urls.patientUrl;
  if (tvUrlInput && urls) tvUrlInput.value = urls.tvUrl;

  // Copy buttons
  const btnCopyPatient = document.getElementById('btn-copy-patient-url');
  if (btnCopyPatient && urls) {
    btnCopyPatient.onclick = () => {
      navigator.clipboard.writeText(urls.patientUrl);
      showAppToast('Copied Patient Booking Link to clipboard!', 'success');
    };
  }

  const btnCopyTv = document.getElementById('btn-copy-tv-url');
  if (btnCopyTv && urls) {
    btnCopyTv.onclick = () => {
      navigator.clipboard.writeText(urls.tvUrl);
      showAppToast('Copied Live TV Link to clipboard!', 'success');
    };
  }

  // Populate form fields
  const nameInput = document.getElementById('myclinic-name');
  const doctorInput = document.getElementById('myclinic-doctor');
  const specialtyInput = document.getElementById('myclinic-specialty');
  const cabinInput = document.getElementById('myclinic-cabin');
  const phoneInput = document.getElementById('myclinic-phone');
  const avgTimeInput = document.getElementById('myclinic-avg-time');
  const addressInput = document.getElementById('myclinic-address');
  const tgTokenInput = document.getElementById('myclinic-tgtoken');
  const tgChatInput = document.getElementById('myclinic-tgchat');

  if (nameInput) nameInput.value = clinic.name;
  if (doctorInput) doctorInput.value = clinic.doctorName;
  if (specialtyInput) specialtyInput.value = clinic.specialty;
  if (cabinInput) cabinInput.value = clinic.cabin;
  if (phoneInput) phoneInput.value = clinic.phone;
  if (avgTimeInput) avgTimeInput.value = clinic.avgTimePerPatientMinutes || 8;
  if (addressInput) addressInput.value = clinic.address;
  if (tgTokenInput) tgTokenInput.value = clinic.telegramBotToken || '';
  if (tgChatInput) tgChatInput.value = clinic.telegramChatId || '';

  // Save Clinic Settings Button
  const btnSave = document.getElementById('btn-save-myclinic');
  if (btnSave) {
    btnSave.onclick = () => {
      const updates = {
        doctorName: doctorInput.value.trim(),
        specialty: specialtyInput.value.trim(),
        cabin: cabinInput.value.trim(),
        phone: phoneInput.value.trim(),
        avgTimePerPatientMinutes: parseInt(avgTimeInput.value, 10) || 8,
        address: addressInput.value.trim(),
        telegramBotToken: tgTokenInput.value.trim(),
        telegramChatId: tgChatInput.value.trim()
      };

      clinicStore.updateClinic(clinic.id, updates);
      showAppToast('Clinic settings updated successfully!', 'success');
      renderDoctorProfile();
      renderSharedHeader('doctor');
    };
  }
}

// ==========================================
// DOCTOR LOGIN MODAL & DEMO CREDENTIAL LOGINS
// ==========================================
function setupDoctorLoginModal() {
  const modal = document.getElementById('doctor-login-modal');
  const closeBtn = document.getElementById('doc-login-close');
  const loginForm = document.getElementById('doc-login-form');

  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }

  if (loginForm) {
    loginForm.onsubmit = (e) => {
      e.preventDefault();
      const user = document.getElementById('doc-login-user').value;
      const pass = document.getElementById('doc-login-pass').value;

      try {
        const res = authService.loginDoctor(user, pass);
        showAppToast(`Welcome, ${res.doctorName}! Logged into ${res.clinic.name}`, 'success');
        modal.classList.remove('active');
        renderDoctorProfile();
        renderCurrentPanel();
        renderSharedHeader('doctor');
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // 1-Click Demo Logins
  document.querySelectorAll('.demo-doc-login-btn').forEach(btn => {
    btn.onclick = () => {
      const clinicId = btn.dataset.clinic;
      authService.loginAsDoctorClinic(clinicId);
      const clinic = clinicStore.getCurrentClinic();
      showAppToast(`Signed in as ${clinic.doctorName}`, 'success');
      if (modal) modal.classList.remove('active');
      renderDoctorProfile();
      renderCurrentPanel();
      renderSharedHeader('doctor');
    };
  });
}
