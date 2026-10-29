// Shared UI Components, Navigation Bar, URL Endpoint Resolver & Toast Helpers
import { clinicStore } from './store.js';
import { authService } from './auth.js';

// Resolve current clinic context from clean URL path or query parameter
export function resolveClinicFromUrl() {
  if (typeof window === 'undefined') return clinicStore.getCurrentClinic();

  // 1. Check clean path routing first (e.g. /joshi-clinic, /joshi-clinic/tv, /joshi-clinic/doctor)
  const pathname = window.location.pathname || '';
  const segments = pathname.split('/').filter(p => Boolean(p) && !p.endsWith('.html'));
  if (segments.length > 0) {
    for (const segment of segments) {
      const lower = segment.toLowerCase();
      if (!['tv', 'live-tv', 'doctor', 'admin'].includes(lower)) {
        const matched = clinicStore.getClinicBySlugOrId(lower);
        if (matched) {
          if (clinicStore.state.currentClinicId !== matched.id) {
            clinicStore.setCurrentClinic(matched.id);
          }
          return matched;
        }
      }
    }
  }

  // 2. Fallback to query parameter (?clinic=joshi-clinic)
  const urlParams = new URLSearchParams(window.location.search);
  const clinicParam = urlParams.get('clinic') || urlParams.get('c') || urlParams.get('clinicId');

  if (clinicParam) {
    const matched = clinicStore.getClinicBySlugOrId(clinicParam);
    if (matched) {
      if (clinicStore.state.currentClinicId !== matched.id) {
        clinicStore.setCurrentClinic(matched.id);
      }
      return matched;
    }
  }

  // 3. If logged in as Doctor, lock to doctor's assigned clinic
  if (authService.isDoctor()) {
    const doctorClinicId = authService.getDoctorClinicId();
    if (doctorClinicId) {
      const docClinic = clinicStore.getClinicBySlugOrId(doctorClinicId);
      if (docClinic && clinicStore.state.currentClinicId !== docClinic.id) {
        clinicStore.setCurrentClinic(docClinic.id);
      }
      return docClinic || clinicStore.getCurrentClinic();
    }
  }

  return clinicStore.getCurrentClinic();
}

// Automatically strip .html and legacy query params to maintain modern clean URLs in address bar
export function normalizeAddressBar(activePage = 'patient', clinic = null) {
  if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return;
  const currentPath = window.location.pathname || '';
  const currentSearch = window.location.search || '';

  const hasHtml = currentPath.endsWith('.html');
  const hasClinicQuery = currentSearch.includes('clinic=') || currentSearch.includes('clinicId=');

  if (!hasHtml && !hasClinicQuery) return;

  const targetClinic = clinic || resolveClinicFromUrl();
  const slug = targetClinic ? (targetClinic.slug || targetClinic.id) : 'joshi-clinic';

  let cleanPath = `/${slug}`;
  if (activePage === 'doctor' || currentPath.includes('doctor')) {
    cleanPath = `/${slug}/doctor`;
  } else if (activePage === 'tv' || currentPath.includes('live-tv') || currentPath.includes('tv')) {
    cleanPath = `/${slug}/tv`;
  } else if (activePage === 'admin' || currentPath.includes('admin')) {
    cleanPath = '/admin';
  }

  // Preserve non-clinic search params (e.g. ?myToken=12)
  const params = new URLSearchParams(currentSearch);
  params.delete('clinic');
  params.delete('c');
  params.delete('clinicId');
  const remainingQuery = params.toString() ? `?${params.toString()}` : '';

  try {
    window.history.replaceState({}, '', `${cleanPath}${remainingQuery}`);
  } catch (err) {
    // Non-browser / mock sandbox fallback
  }
}

export function renderSharedHeader(activePage = 'patient') {
  const currentClinic = resolveClinicFromUrl();
  normalizeAddressBar(activePage, currentClinic);

  const headerContainer = document.getElementById('app-shared-header');
  if (!headerContainer) return;
  const allClinics = clinicStore.getAllClinics();
  const activeSession = clinicStore.getActiveSession(currentClinic.id);
  const isClinicLive = !!activeSession;

  const currentAuth = authService.getSession();
  const isSuperAdmin = authService.isSuperAdmin();
  const isDoctor = authService.isDoctor();

  // Clean vanity URL slug
  const clinicSlug = currentClinic.slug || currentClinic.id;

  const clinicOptionsHtml = allClinics.map(c => `
    <option value="${c.id}" ${c.id === currentClinic.id ? 'selected' : ''}>
      ${c.name}
    </option>
  `).join('');

  headerContainer.innerHTML = `
    <header class="app-header">
      <div class="header-container">
        <!-- Brand & Clinic Context (Horizontally Oriented) -->
        <div class="brand-section">
          <a href="/${clinicSlug}" class="brand-link" title="${currentClinic.name}">
            <div class="brand-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                <path d="M12 5v14"/>
                <path d="M5 12h14"/>
              </svg>
            </div>
            <div class="brand-info">
              <div class="brand-name">
                <span class="brand-logo-text">MediPulse</span>
                <span class="brand-clinic-tag" title="${currentClinic.name}">${currentClinic.name}</span>
                <span class="pulse-badge ${isClinicLive ? 'live' : 'scheduled'}">
                  <span class="pulse-dot ${isClinicLive ? 'animated' : ''}"></span>
                  ${isClinicLive ? 'Live OPD' : 'Scheduled'}
                </span>
              </div>
              <div class="brand-sub">
                <span>${currentClinic.doctorName}</span>
                <span class="sub-sep">&bull;</span>
                <span>${currentClinic.cabin}</span>
                <span class="sub-sep">&bull;</span>
                <span class="endpoint-code">/${clinicSlug}</span>
              </div>
            </div>
          </a>
        </div>

        <!-- 4-Screen Navigation (Clean Vanity URLs) -->
        <nav class="screen-switcher-nav" aria-label="Screen Switcher">
          <a href="/${clinicSlug}" class="nav-pill-btn ${activePage === 'patient' ? 'active' : ''}" title="Public Patient Booking Screen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Patient</span>
          </a>
          <a href="/${clinicSlug}/tv" class="nav-pill-btn ${activePage === 'tv' ? 'active' : ''}" title="Waiting Room Live TV Monitor">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="15" x="2" y="3" rx="2"/>
              <polyline points="17 2 12 7 7 2"/>
            </svg>
            <span>Live TV</span>
          </a>
          <a href="/${clinicSlug}/doctor" class="nav-pill-btn ${activePage === 'doctor' ? 'active' : ''}" title="Doctor Queue Advancement Console">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
            <span>Doctor Console</span>
          </a>
          <a href="/admin" class="nav-pill-btn nav-pill-admin ${activePage === 'admin' ? 'active' : ''}" title="Super Admin Multi-Clinic Management">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span>Super Admin</span>
          </a>
        </nav>

        <!-- Header Actions: Clinic Switcher & Auth Pill -->
        <div class="header-actions">
          ${isSuperAdmin ? `
            <div class="clinic-select-wrapper" title="Super Admin: Switch Active Clinic">
              <select id="global-clinic-selector" class="clinic-dropdown" aria-label="Select Clinic">
                ${clinicOptionsHtml}
              </select>
              <svg class="clinic-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
            <div class="auth-user-pill" title="Super Admin Mode Active">
              <span class="user-role-badge super">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>Super Admin</span>
              </span>
              <button id="btn-header-logout" class="btn-text-logout" type="button" title="Sign out of Super Admin">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          ` : isDoctor ? `
            <div class="auth-user-pill" title="Doctor Console Logged In">
              <span class="user-role-badge doctor">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Dr. ${currentClinic.doctorName.split(',')[0].replace('Dr. ', '')}</span>
              </span>
              <button id="btn-header-logout" class="btn-text-logout" type="button" title="Sign Out">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          ` : `
            <div class="clinic-select-wrapper" title="Switch Clinic Endpoint">
              <select id="global-clinic-selector" class="clinic-dropdown" aria-label="Select Clinic">
                ${clinicOptionsHtml}
              </select>
              <svg class="clinic-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </div>
            <a href="/admin" class="btn btn-sm btn-secondary" style="font-size:0.775rem;">Admin Login</a>
          `}
        </div>
      </div>
    </header>
  `;

  // Attach clinic switch event
  const clinicSelector = document.getElementById('global-clinic-selector');
  if (clinicSelector) {
    clinicSelector.addEventListener('change', (e) => {
      const newClinicId = e.target.value;
      const target = clinicStore.getClinicBySlugOrId(newClinicId);
      if (target) {
        clinicStore.setCurrentClinic(target.id);
        // Clean vanity path switch
        window.location.href = `/${target.slug}`;
      }
    });
  }

  // Attach logout handler
  const logoutBtn = document.getElementById('btn-header-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      authService.logout();
      showAppToast('Signed out successfully', 'info');
      if (activePage === 'admin' || (typeof window !== 'undefined' && window.location.pathname.includes('admin'))) {
        renderSharedHeader('admin');
        const modal = document.getElementById('modal-admin-login');
        if (modal) modal.classList.add('active');
        return;
      }
      if (activePage === 'doctor' || (typeof window !== 'undefined' && window.location.pathname.includes('doctor'))) {
        renderSharedHeader('doctor');
        const docModal = document.getElementById('doctor-login-modal');
        if (docModal) docModal.classList.add('active');
        return;
      }
      renderSharedHeader(activePage);
    });
  }
}

// Global Toast Messenger
export function showAppToast(message, type = 'info') {
  let container = document.getElementById('app-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-toast-container';
    container.className = 'app-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `app-toast toast-${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
