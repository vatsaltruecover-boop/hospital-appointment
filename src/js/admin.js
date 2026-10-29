// Super Admin Command Center Controller & Logic
import { clinicStore, slugifyText, generateRandomPassword } from './store.js';
import { authService } from './auth.js';
import { renderSharedHeader, showAppToast } from './common.js';

let activeShareClinic = null;

export function initAdminScreen() {
  checkAdminAuth();
  renderSharedHeader('admin');
  renderMetrics();
  renderClinicsGrid();
  setupOnboardModal();
  setupShareModal();
  setupSearchFilter();

  // Listen to store updates
  clinicStore.subscribe(() => {
    renderMetrics();
    renderClinicsGrid();
  });

  // Listen to auth updates
  authService.subscribe(() => {
    checkAdminAuth();
    renderSharedHeader('admin');
  });
}

function checkAdminAuth() {
  const loginModal = document.getElementById('modal-admin-login');
  const isSuper = authService.isSuperAdmin();

  if (!isSuper && loginModal) {
    loginModal.classList.add('active');
    setupAdminLoginForm();
  } else if (loginModal) {
    loginModal.classList.remove('active');
  }
}

function setupAdminLoginForm() {
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.onsubmit = (e) => {
    e.preventDefault();
    const user = document.getElementById('admin-login-user').value;
    const pass = document.getElementById('admin-login-pass').value;

    try {
      authService.loginSuperAdmin(user, pass);
      showAppToast('Super Admin authenticated successfully', 'success');
      const loginModal = document.getElementById('modal-admin-login');
      if (loginModal) loginModal.classList.remove('active');
      renderSharedHeader('admin');
      renderMetrics();
      renderClinicsGrid();
    } catch (err) {
      alert(err.message);
    }
  };
}

function renderMetrics() {
  const analytics = clinicStore.getSystemAnalytics();

  const totalClinicsEl = document.getElementById('metric-total-clinics');
  const totalDoctorsEl = document.getElementById('metric-total-doctors');
  const activeSessionsEl = document.getElementById('metric-active-sessions');
  const completedTokensEl = document.getElementById('metric-completed-tokens');

  if (totalClinicsEl) totalClinicsEl.textContent = analytics.totalClinics;
  if (totalDoctorsEl) totalDoctorsEl.textContent = analytics.totalDoctors;
  if (activeSessionsEl) activeSessionsEl.textContent = analytics.activeSessions;
  if (completedTokensEl) completedTokensEl.textContent = analytics.completedAppointments;
}

function renderClinicsGrid(filterQuery = '') {
  const container = document.getElementById('admin-clinics-container');
  if (!container) return;

  let clinics = clinicStore.getAllClinics();
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    clinics = clinics.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.doctorName.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q)
    );
  }

  if (clinics.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; background: white; border-radius: var(--radius-lg); border: 1px dashed var(--color-border);">
        <p style="color:var(--color-text-muted); font-size:1.1rem; margin-bottom:1rem;">No clinics matched your search.</p>
        <button id="btn-empty-onboard" class="btn btn-primary">+ Onboard New Clinic</button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-empty-onboard');
    if (btnEmpty) btnEmpty.onclick = openOnboardModal;
    return;
  }

  container.innerHTML = clinics.map(clinic => {
    const queueData = clinicStore.getLiveQueue(clinic.id);
    const activeSession = queueData.session;
    const currentToken = queueData.currentTokenNumber || 0;
    const waitingCount = queueData.nextApts ? queueData.nextApts.length : 0;
    const creds = clinic.doctorCreds || { username: `dr.${clinic.slug}@medipulse.io`, password: 'Not Set' };

    const urls = clinicStore.getClinicEndpointUrls(clinic);

    return `
      <div class="admin-clinic-card" data-id="${clinic.id}">
        <!-- Header -->
        <div class="clinic-card-header">
          <div class="clinic-card-header-top">
            <h3 class="clinic-card-title">${clinic.name}</h3>
            <span class="endpoint-pill" title="Dedicated Clinic URL Endpoint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>/${clinic.slug}</span>
            </span>
          </div>
          <div style="font-size:0.8rem; color:var(--color-text-muted);">
            📍 ${clinic.cabin} &bull; ${clinic.address || 'Address on file'} &bull; 📞 ${clinic.phone || 'N/A'}
          </div>
        </div>

        <!-- Body -->
        <div class="clinic-card-body">
          <!-- Doctor Profile Row -->
          <div class="doctor-profile-row">
            <div class="doctor-avatar-circle">
              ${clinic.doctorName.replace('Dr. ', '').substring(0, 2).toUpperCase()}
            </div>
            <div class="doctor-details-col">
              <div class="doc-name">${clinic.doctorName}</div>
              <div class="doc-spec">${clinic.specialty} &bull; ~${clinic.avgTimePerPatientMinutes || 8}m/patient</div>
            </div>
          </div>

          <!-- Doctor Credentials Strip -->
          <div class="clinic-creds-strip">
            <div class="creds-strip-label">
              <span>Doctor Portal Credentials</span>
              <button class="creds-pass-toggle toggle-pass-btn" data-id="${clinic.id}">Show PIN</button>
            </div>
            <div class="creds-strip-row">
              <span class="creds-username" title="${creds.username}">👤 ${creds.username}</span>
              <span class="creds-password" id="pass-display-${clinic.id}">••••••••</span>
            </div>
          </div>

          <!-- Live Queue Overview -->
          <div class="clinic-queue-overview">
            <div>
              <span style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:700;">Live Session:</span>
              <div style="font-weight:600; font-size:0.85rem;">${activeSession ? activeSession.name : 'No active session'}</div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted); font-weight:700;">Now In Room:</span>
              <div class="queue-serving-num">${currentToken > 0 ? `#${currentToken < 10 ? '0' + currentToken : currentToken}` : '--'}</div>
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="clinic-card-actions">
          <div class="card-action-row-main">
            <button class="btn btn-sm btn-primary share-creds-btn" data-id="${clinic.id}" style="flex:1;">
              📤 Share Creds
            </button>
            <button class="btn btn-sm btn-secondary reset-pass-btn" data-id="${clinic.id}" title="Regenerate doctor password">
              🔑 Reset PIN
            </button>
            <button class="btn btn-sm btn-secondary open-doctor-btn" data-id="${clinic.id}" title="Launch doctor queue controller">
              🩺 Doctor Console
            </button>
            <button class="btn btn-sm btn-outline delete-clinic-btn" data-id="${clinic.id}" style="border-color:#fca5a5; color:#dc2626;" title="Delete Clinic">
              🗑️
            </button>
          </div>

          <!-- Direct Endpoint Links -->
          <div class="card-action-row-links">
            <a href="${urls.patientUrl}" target="_blank" title="Open Patient Booking for this clinic">
              🎫 Patient Endpoint &UpperRightArrow;
            </a>
            <a href="${urls.tvUrl}" target="_blank" title="Open TV Waiting Room for this clinic">
              📺 TV Screen &UpperRightArrow;
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach card event listeners
  container.querySelectorAll('.share-creds-btn').forEach(btn => {
    btn.onclick = () => {
      const cId = btn.dataset.id;
      const clinic = clinicStore.getClinicBySlugOrId(cId);
      if (clinic) openShareModal(clinic);
    };
  });

  container.querySelectorAll('.toggle-pass-btn').forEach(btn => {
    btn.onclick = () => {
      const cId = btn.dataset.id;
      const clinic = clinicStore.getClinicBySlugOrId(cId);
      const passEl = document.getElementById(`pass-display-${cId}`);
      if (clinic && passEl) {
        if (passEl.textContent === '••••••••') {
          passEl.textContent = clinic.doctorCreds ? clinic.doctorCreds.password : 'Pulse#1234';
          btn.textContent = 'Hide';
        } else {
          passEl.textContent = '••••••••';
          btn.textContent = 'Show PIN';
        }
      }
    };
  });

  container.querySelectorAll('.reset-pass-btn').forEach(btn => {
    btn.onclick = () => {
      const cId = btn.dataset.id;
      const clinic = clinicStore.getClinicBySlugOrId(cId);
      if (!clinic) return;

      if (confirm(`Generate fresh doctor credentials for ${clinic.doctorName} (${clinic.name})?`)) {
        const newCreds = clinicStore.generateDoctorCreds(cId);
        showAppToast(`New credentials generated: ${newCreds.password}`, 'success');
        openShareModal(clinic);
      }
    };
  });

  container.querySelectorAll('.open-doctor-btn').forEach(btn => {
    btn.onclick = () => {
      const cId = btn.dataset.id;
      const clinic = clinicStore.getClinicBySlugOrId(cId);
      if (clinic) {
        clinicStore.setCurrentClinic(clinic.id);
        window.open(`/${clinic.slug}/doctor`, '_blank');
      }
    };
  });

  container.querySelectorAll('.delete-clinic-btn').forEach(btn => {
    btn.onclick = () => {
      const cId = btn.dataset.id;
      const clinic = clinicStore.getClinicBySlugOrId(cId);
      if (!clinic) return;

      if (confirm(`Are you sure you want to delete clinic "${clinic.name}"? This will remove its endpoint and sessions.`)) {
        try {
          clinicStore.deleteClinic(cId);
          showAppToast('Clinic deleted successfully', 'info');
        } catch (err) {
          alert(err.message);
        }
      }
    };
  });
}

function setupOnboardModal() {
  const modal = document.getElementById('modal-onboard-clinic');
  const openBtn = document.getElementById('btn-open-create-clinic-modal');
  const closeBtn = document.getElementById('modal-onboard-close');
  const regenPassBtn = document.getElementById('btn-regen-password');
  const form = document.getElementById('onboard-clinic-form');

  const nameInput = document.getElementById('onboard-input-name');
  const slugInput = document.getElementById('onboard-input-slug');
  const slugPreview = document.getElementById('onboard-slug-preview');
  const usernameInput = document.getElementById('onboard-input-username');
  const passInput = document.getElementById('onboard-input-password');

  if (openBtn) openBtn.onclick = openOnboardModal;
  if (closeBtn && modal) closeBtn.onclick = () => modal.classList.remove('active');

  // Auto generate slug & username as user types clinic name
  if (nameInput) {
    nameInput.oninput = () => {
      const slug = slugifyText(nameInput.value);
      if (!slugInput.dataset.manuallyEdited) {
        slugInput.value = slug;
        if (slugPreview) slugPreview.textContent = `Preview: /${slug}`;
        if (!usernameInput.dataset.manuallyEdited) {
          usernameInput.value = slug ? `dr.${slug}@medipulse.io` : '';
        }
      }
    };
  }

  if (slugInput) {
    slugInput.oninput = () => {
      slugInput.dataset.manuallyEdited = 'true';
      const cleanSlug = slugifyText(slugInput.value);
      if (slugPreview) slugPreview.textContent = `Preview: /${cleanSlug}`;
    };
  }

  if (usernameInput) {
    usernameInput.oninput = () => {
      usernameInput.dataset.manuallyEdited = 'true';
    };
  }

  if (regenPassBtn && passInput) {
    regenPassBtn.onclick = () => {
      passInput.value = generateRandomPassword();
    };
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();

      const name = nameInput.value.trim();
      const slug = slugifyText(slugInput.value);
      const doctorName = document.getElementById('onboard-input-doctor').value.trim();
      const specialty = document.getElementById('onboard-input-specialty').value.trim();
      const cabin = document.getElementById('onboard-input-cabin').value.trim() || 'Cabin 1';
      const phone = document.getElementById('onboard-input-phone').value.trim();
      const address = document.getElementById('onboard-input-address').value.trim();
      const doctorUsername = usernameInput.value.trim().toLowerCase();
      const doctorPassword = passInput.value.trim();
      const avgTime = parseInt(document.getElementById('onboard-input-avgtime').value, 10) || 8;
      const tgToken = document.getElementById('onboard-input-tgtoken').value.trim();

      if (!name || !doctorName || !slug) {
        alert('Please complete clinic name, endpoint slug, and doctor name.');
        return;
      }

      try {
        const { clinic, doctorCreds } = clinicStore.createClinic({
          name,
          slug,
          doctorName,
          specialty,
          cabin,
          phone,
          address,
          doctorUsername,
          doctorPassword,
          avgTimePerPatientMinutes: avgTime,
          telegramBotToken: tgToken
        });

        showAppToast(`Clinic "${clinic.name}" onboarded with clean endpoint /${clinic.slug}!`, 'success');

        if (modal) modal.classList.remove('active');
        renderMetrics();
        renderClinicsGrid();

        // Immediately launch the Doctor Credential Share Card
        openShareModal(clinic);
      } catch (err) {
        alert(err.message);
      }
    };
  }
}

function openOnboardModal() {
  const modal = document.getElementById('modal-onboard-clinic');
  if (!modal) return;

  document.getElementById('onboard-input-name').value = '';
  const slugInput = document.getElementById('onboard-input-slug');
  slugInput.value = '';
  delete slugInput.dataset.manuallyEdited;

  const usernameInput = document.getElementById('onboard-input-username');
  usernameInput.value = '';
  delete usernameInput.dataset.manuallyEdited;

  document.getElementById('onboard-slug-preview').textContent = 'Preview: ?clinic=your-clinic-slug';
  document.getElementById('onboard-input-cabin').value = 'Cabin 101';
  document.getElementById('onboard-input-phone').value = '';
  document.getElementById('onboard-input-address').value = '';
  document.getElementById('onboard-input-doctor').value = '';
  document.getElementById('onboard-input-specialty').value = 'General Medicine & OPD';
  document.getElementById('onboard-input-password').value = generateRandomPassword();
  document.getElementById('onboard-input-avgtime').value = '8';
  document.getElementById('onboard-input-tgtoken').value = '';

  modal.classList.add('active');
}

function setupShareModal() {
  const modal = document.getElementById('modal-share-creds');
  const closeBtn = document.getElementById('modal-share-close');
  const copyPackageBtn = document.getElementById('btn-copy-share-package');

  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.remove('active');
  }

  if (copyPackageBtn) {
    copyPackageBtn.onclick = () => {
      if (!activeShareClinic) return;
      const text = generateDossierText(activeShareClinic);
      navigator.clipboard.writeText(text);
      showAppToast('Copied Doctor Credentials & URLs to clipboard!', 'success');
    };
  }
}

function openShareModal(clinic) {
  activeShareClinic = clinic;
  const modal = document.getElementById('modal-share-creds');
  if (!modal) return;

  const urls = clinicStore.getClinicEndpointUrls(clinic);
  const creds = clinic.doctorCreds || { username: `dr.${clinic.slug}@medipulse.io`, password: 'Password#2026' };

  document.getElementById('share-clinic-tag').textContent = clinic.name;
  document.getElementById('share-doctor-name').textContent = clinic.doctorName;
  document.getElementById('share-doctor-spec').textContent = `${clinic.specialty} • ${clinic.cabin}`;
  document.getElementById('share-endpoint-slug').textContent = `/${clinic.slug}`;

  document.getElementById('share-val-username').textContent = creds.username;
  document.getElementById('share-val-password').textContent = creds.password;

  document.getElementById('share-link-doctor').textContent = urls.doctorUrl;
  document.getElementById('share-link-patient').textContent = urls.patientUrl;
  document.getElementById('share-link-tv').textContent = urls.tvUrl;

  // WhatsApp share link
  const waBtn = document.getElementById('btn-share-whatsapp');
  if (waBtn) {
    const waText = encodeURIComponent(generateDossierText(clinic));
    waBtn.href = `https://wa.me/?text=${waText}`;
  }

  // Email share link
  const emailBtn = document.getElementById('btn-share-email');
  if (emailBtn) {
    const subject = encodeURIComponent(`MediPulse Healthcare Portal Access - ${clinic.name}`);
    const body = encodeURIComponent(generateDossierText(clinic));
    emailBtn.href = `mailto:?subject=${subject}&body=${body}`;
  }

  // Launch console button
  const launchBtn = document.getElementById('btn-launch-doctor-console');
  if (launchBtn) {
    launchBtn.href = `/${clinic.slug}/doctor`;
    launchBtn.onclick = () => {
      // Auto switch clinic context
      clinicStore.setCurrentClinic(clinic.id);
    };
  }

  modal.classList.add('active');
}

function generateDossierText(clinic) {
  const urls = clinicStore.getClinicEndpointUrls(clinic);
  const creds = clinic.doctorCreds || {};

  return `🏥 Welcome to MediPulse Appointment System!
Facility: ${clinic.name}
Assigned Doctor: ${clinic.doctorName} (${clinic.specialty})
Cabin: ${clinic.cabin}
Dedicated Endpoint: /${clinic.slug}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 YOUR DOCTOR CONSOLE CREDENTIALS:
Doctor Username: ${creds.username || `dr.${clinic.slug}@medipulse.io`}
Password / PIN: ${creds.password || 'Vance#2026'}

Doctor Portal URL:
${urls.doctorUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 PATIENT & DISPLAY ENDPOINTS:
🎫 Patient Booking Portal:
${urls.patientUrl}

📺 Waiting Room Live TV Display:
${urls.tvUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please log into your Doctor Portal to activate consultation sessions and advance patient queues in real-time.`;
}

function setupSearchFilter() {
  const searchInput = document.getElementById('admin-search-clinics');
  if (searchInput) {
    searchInput.oninput = (e) => {
      renderClinicsGrid(e.target.value);
    };
  }
}
