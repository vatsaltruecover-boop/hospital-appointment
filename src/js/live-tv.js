// Screen 2: Live TV Waiting Room Display Logic
import { clinicStore } from './store.js';
import { queueAudio } from './chime.js';
import { renderSharedHeader, resolveClinicFromUrl } from './common.js';

let myTokenNumber = null;
let soundEnabled = true;
let clockInterval = null;
let lastServingToken = null;

export function initLiveTVScreen() {
  resolveClinicFromUrl();
  renderSharedHeader('tv');

  // Check URL query params for patient token tracking
  const urlParams = new URLSearchParams(window.location.search);
  const myTokenParam = urlParams.get('myToken');
  if (myTokenParam) {
    myTokenNumber = parseInt(myTokenParam, 10);
  }

  setupTVControls();
  startLiveClock();
  renderTVQueue();

  // Subscribe to real-time events from Doctor console
  clinicStore.subscribe((state, event) => {
    renderTVQueue();

    if (event.type === 'TOKEN_CALLED_NEXT' || event.type === 'TOKEN_RECALLED') {
      const token = event.payload.tokenNumber;
      const clinic = clinicStore.getCurrentClinic();

      // Trigger audio announcement & visual animation
      if (soundEnabled) {
        queueAudio.announceToken(token, clinic.cabin || 'Cabin 1');
      }

      animateTokenChange();
    }
  });
}

function setupTVControls() {
  // Sound Toggle Button
  const soundBtn = document.getElementById('tv-sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      queueAudio.initAudio();
      if (soundEnabled) {
        soundBtn.classList.add('active-sound');
        soundBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
          <span>Sound: ON</span>
        `;
        queueAudio.playChime();
      } else {
        soundBtn.classList.remove('active-sound');
        soundBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
          <span>Sound: OFF</span>
        `;
      }
    });
  }

  // Fullscreen TV Mode Toggle
  const fullscreenBtn = document.getElementById('tv-fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Fullscreen request failed:', err);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }
}

function startLiveClock() {
  const clockEl = document.getElementById('tv-clock-display');
  const update = () => {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  };
  update();
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(update, 1000);
}

function animateTokenChange() {
  const bigNumEl = document.getElementById('tv-big-token');
  if (bigNumEl) {
    bigNumEl.classList.remove('animate-pulse');
    void bigNumEl.offsetWidth; // trigger reflow
    bigNumEl.classList.add('animate-pulse');
  }
}

function renderTVQueue() {
  const clinic = clinicStore.getCurrentClinic();
  const queueData = clinicStore.getLiveQueue(clinic.id);
  const activeSession = queueData.session;
  const currentToken = queueData.currentTokenNumber || 0;

  // TV Brand & Header Info
  const tvClinicName = document.getElementById('tv-clinic-name');
  const tvClinicRoom = document.getElementById('tv-clinic-room');
  if (tvClinicName) tvClinicName.textContent = clinic.name;
  if (tvClinicRoom) tvClinicRoom.textContent = `${clinic.doctorName} &bull; ${clinic.cabin}`;

  // User Token Banner (If visiting after booking)
  const userBanner = document.getElementById('user-token-callout');
  const userTokenTag = document.getElementById('callout-user-token');
  const userStatusDesc = document.getElementById('callout-status-desc');

  if (myTokenNumber && userBanner) {
    userBanner.style.display = 'flex';
    if (userTokenTag) userTokenTag.textContent = `TOKEN #${myTokenNumber}`;

    if (currentToken === myTokenNumber) {
      if (userStatusDesc) userStatusDesc.innerHTML = `<strong style="color:#2dd4bf">🔔 It's your turn! Please enter ${clinic.cabin} now.</strong>`;
    } else if (currentToken < myTokenNumber) {
      const ahead = myTokenNumber - currentToken;
      const waitMins = ahead * (clinic.avgTimePerPatientMinutes || 8);
      if (userStatusDesc) userStatusDesc.textContent = `${ahead} patient(s) ahead of you in line (approx ${waitMins} mins wait)`;
    } else {
      if (userStatusDesc) userStatusDesc.textContent = `Your consultation is completed. Thank you!`;
    }
  } else if (userBanner) {
    userBanner.style.display = 'none';
  }

  // Active Session & Now Serving Card
  const tvSessionTitle = document.getElementById('tv-active-session-title');
  const tvSessionTiming = document.getElementById('tv-active-session-timing');
  const tvBigToken = document.getElementById('tv-big-token');
  const tvRoomDestination = document.getElementById('tv-room-destination');
  const tvDoctorDestination = document.getElementById('tv-doctor-destination');

  if (activeSession) {
    if (tvSessionTitle) tvSessionTitle.textContent = activeSession.name;
    if (tvSessionTiming) tvSessionTiming.textContent = `${activeSession.startTime} - ${activeSession.endTime}`;
  } else {
    if (tvSessionTitle) tvSessionTitle.textContent = 'No Active Session';
    if (tvSessionTiming) tvSessionTiming.textContent = '-- : --';
  }

  if (tvBigToken) {
    tvBigToken.textContent = currentToken > 0 ? (currentToken < 10 ? `0${currentToken}` : `${currentToken}`) : '--';
  }
  if (tvRoomDestination) tvRoomDestination.textContent = clinic.cabin || 'Consultation Room 1';
  if (tvDoctorDestination) tvDoctorDestination.textContent = clinic.doctorName;

  // Side Statistics
  const tvCompletedCount = document.getElementById('tv-completed-count');
  const tvRemainingCount = document.getElementById('tv-remaining-count');
  const tvAvgWait = document.getElementById('tv-avg-wait');

  const completed = queueData.completedApts ? queueData.completedApts.length : 0;
  const waiting = queueData.nextApts ? queueData.nextApts.length : 0;

  if (tvCompletedCount) tvCompletedCount.textContent = `${completed} Patients`;
  if (tvRemainingCount) tvRemainingCount.textContent = `${waiting} Waiting`;
  if (tvAvgWait) tvAvgWait.textContent = `~${clinic.avgTimePerPatientMinutes || 8} mins`;

  // Next in Line Queue Board
  const queueCardsGrid = document.getElementById('tv-next-queue-grid');
  if (queueCardsGrid) {
    const nextApts = queueData.nextApts || [];

    if (nextApts.length === 0) {
      queueCardsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--tv-text-secondary); background: var(--tv-bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--tv-border);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.5rem; opacity: 0.6;">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 14 14"/>
          </svg>
          <div style="font-weight: 700; font-size: 1.1rem; color: white;">No Waiting Patients in Queue</div>
          <div style="font-size: 0.85rem; margin-top: 0.35rem;">Bookings from Screen 1 will appear here in real-time.</div>
        </div>
      `;
    } else {
      // Display up to 8 next patients
      queueCardsGrid.innerHTML = nextApts.slice(0, 8).map((apt, index) => {
        const isNext = index === 0;
        const isUserToken = myTokenNumber && apt.tokenNumber === myTokenNumber;
        const formattedToken = apt.tokenNumber < 10 ? `0${apt.tokenNumber}` : `${apt.tokenNumber}`;

        return `
          <div class="tv-queue-item-card ${isNext ? 'is-next' : ''} ${isUserToken ? 'is-user' : ''}">
            <div class="queue-card-top">
              <span class="queue-token-num">#${formattedToken}</span>
              <span class="queue-status-pill ${isNext ? 'waiting' : ''}">
                ${isNext ? 'Next In Line' : 'In Lounge'}
              </span>
            </div>
            <div class="queue-patient-name">
              ${apt.patientName} ${isUserToken ? '(You)' : ''}
            </div>
            <div class="queue-expected-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Expected: ${apt.estimatedTime || 'In queue'}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  lastServingToken = currentToken;
}
