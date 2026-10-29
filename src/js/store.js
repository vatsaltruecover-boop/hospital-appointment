// Real-time Master Store with Cross-Window Broadcast Synchronization & Multi-Clinic Endpoints

const STORAGE_KEY = 'clinic_master_state_v3';
const CHANNEL_NAME = 'clinic_realtime_sync';

// Default Seed Data - Joshi Clinic (Surat) as Primary & Only Seed Clinic
const DEFAULT_STATE = {
  currentClinicId: 'clinic_joshi',
  clinics: [
    {
      id: 'clinic_joshi',
      slug: 'joshi-clinic',
      name: 'Joshi Clinic',
      doctorName: 'Dr. Rajvi J. Joshi',
      specialty: 'Family Medicine & General Practice',
      cabin: 'Cabin 1 (Ground Floor)',
      phone: '+91 96244 09671',
      address: 'Shop No. G-31, Ground Floor, Raj World Shopping Complex, Near L.P. Savani School, Opposite Neelkanth Residency, Palanpur Canal Road, Palanpur, Surat, Gujarat - 395009',
      avgTimePerPatientMinutes: 8,
      telegramBotToken: '',
      telegramChatId: '',
      isSimulatedTelegram: true,
      doctorCreds: {
        username: 'dr.joshi@medipulse.io',
        password: 'Joshi#2026',
        doctorId: 'doc_joshi',
        generatedAt: '2026-10-28T08:00:00Z',
        status: 'active'
      }
    }
  ],
  sessions: [
    {
      id: 'sess_joshi_01',
      clinicId: 'clinic_joshi',
      name: 'Morning General OPD',
      startTime: '10:00',
      endTime: '13:00',
      durationHours: 3,
      tokensPerHour: 7,
      totalCapacity: 21,
      hourlyTokens: [
        { hourIndex: 0, label: '10:00 - 11:00', start: '10:00', end: '11:00', tokens: 7 },
        { hourIndex: 1, label: '11:00 - 12:00', start: '11:00', end: '12:00', tokens: 7 },
        { hourIndex: 2, label: '12:00 - 13:00', start: '12:00', end: '13:00', tokens: 7 }
      ],
      status: 'active'
    },
    {
      id: 'sess_joshi_02',
      clinicId: 'clinic_joshi',
      name: 'Evening Consultation',
      startTime: '17:30',
      endTime: '20:30',
      durationHours: 3,
      tokensPerHour: 7,
      totalCapacity: 21,
      hourlyTokens: [
        { hourIndex: 0, label: '17:30 - 18:30', start: '17:30', end: '18:30', tokens: 7 },
        { hourIndex: 1, label: '18:30 - 19:30', start: '18:30', end: '19:30', tokens: 7 },
        { hourIndex: 2, label: '19:30 - 20:30', start: '19:30', end: '20:30', tokens: 7 }
      ],
      status: 'scheduled'
    }
  ],
  appointments: [
    { id: 'apt_j1', clinicId: 'clinic_joshi', sessionId: 'sess_joshi_01', tokenNumber: 1, patientName: 'Bhavik Patel', phone: '+91 98251 11223', status: 'completed', bookedAt: '10:05 AM', completedAt: '10:18 AM' },
    { id: 'apt_j2', clinicId: 'clinic_joshi', sessionId: 'sess_joshi_01', tokenNumber: 2, patientName: 'Ananya Shah', phone: '+91 98982 33445', status: 'serving', bookedAt: '10:10 AM' },
    { id: 'apt_j3', clinicId: 'clinic_joshi', sessionId: 'sess_joshi_01', tokenNumber: 3, patientName: 'Dharmesh Desai', phone: '+91 94268 55667', status: 'waiting', bookedAt: '10:15 AM' },
    { id: 'apt_j4', clinicId: 'clinic_joshi', sessionId: 'sess_joshi_01', tokenNumber: 4, patientName: 'Meera Mehta', phone: '+91 97234 77889', status: 'waiting', bookedAt: '10:25 AM' },
    { id: 'apt_j5', clinicId: 'clinic_joshi', sessionId: 'sess_joshi_01', tokenNumber: 5, patientName: 'Kavita Trivedi', phone: '+91 99045 88990', status: 'waiting', bookedAt: '10:35 AM' }
  ],
  liveQueues: {
    clinic_joshi: {
      currentSessionId: 'sess_joshi_01',
      currentTokenNumber: 2,
      startedAt: Date.now() - 15 * 60 * 1000
    }
  }
};

export function slugifyText(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'clinic';
}

export function generateRandomPassword(prefix = 'Pulse') {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}#${rand}`;
}

export function generateHourlySlots(startTime = '09:00', endTime = '12:00', defaultRate = 7) {
  const parseMins = (t) => {
    if (!t) return 0;
    const parts = t.toString().split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const formatMins = (m) => {
    const normalized = Math.max(0, m) % (24 * 60);
    const hrs = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${hrs < 10 ? '0' + hrs : hrs}:${mins < 10 ? '0' + mins : mins}`;
  };

  let startMins = parseMins(startTime);
  let endMins = parseMins(endTime);

  if (endMins <= startMins) {
    endMins = startMins + 180;
  }

  const rate = parseInt(defaultRate, 10) || 7;
  const slots = [];
  let current = startMins;
  let hourIndex = 0;

  while (current < endMins) {
    const next = Math.min(current + 60, endMins);
    const sLabel = formatMins(current);
    const eLabel = formatMins(next);
    slots.push({
      hourIndex,
      label: `${sLabel} - ${eLabel}`,
      start: sLabel,
      end: eLabel,
      tokens: rate
    });
    current = next;
    hourIndex++;
  }

  return slots;
}

export function ensureSessionHourlyTokens(session) {
  if (!session) return [];
  if (Array.isArray(session.hourlyTokens) && session.hourlyTokens.length > 0) {
    return session.hourlyTokens;
  }
  const defaultRate = session.tokensPerHour || 7;
  const slots = generateHourlySlots(session.startTime, session.endTime, defaultRate);
  session.hourlyTokens = slots;
  return slots;
}

class ClinicStore {
  constructor() {
    this.state = this.loadState();
    this.listeners = new Set();
    this.broadcastChannel = null;

    if (typeof window !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'STATE_UPDATED') {
            this.state = this.loadState();
            this.notifyListeners(event.data);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported, falling back to storage listener', e);
      }

      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
          this.state = this.loadState();
          this.notifyListeners({ type: 'STORAGE_EVENT' });
        }
      });
    }
  }

  loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        // Check v2 storage first
        let saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
          // Fallback: check v1 storage and migrate
          const v1Saved = localStorage.getItem('clinic_master_state_v1');
          if (v1Saved) {
            saved = v1Saved;
          }
        }

        if (saved) {
          const parsed = JSON.parse(saved);
          // Ensure every clinic has slug and doctorCreds
          let modified = false;
          if (Array.isArray(parsed.clinics)) {
            parsed.clinics.forEach((c, idx) => {
              if (!c.slug) {
                c.slug = c.id === 'clinic_01' ? 'medipulse' : (c.id === 'clinic_02' ? 'aura-pediatrics' : slugifyText(c.name));
                modified = true;
              }
              if (!c.doctorCreds) {
                const defaultUser = c.id === 'clinic_01' ? 'dr.vance@medipulse.io' : (c.id === 'clinic_02' ? 'dr.jenkins@auracare.io' : `dr.${c.slug}@medipulse.io`);
                const defaultPass = c.id === 'clinic_01' ? 'Vance#2026' : (c.id === 'clinic_02' ? 'Jenkins#2026' : generateRandomPassword());
                c.doctorCreds = {
                  username: defaultUser,
                  password: defaultPass,
                  doctorId: 'doc_' + (c.id || idx),
                  generatedAt: new Date().toISOString(),
                  status: 'active'
                };
                modified = true;
              }
            });
          }

          if (Array.isArray(parsed.sessions)) {
            parsed.sessions.forEach(s => {
              if (!s.hourlyTokens || !s.hourlyTokens.length) {
                s.hourlyTokens = generateHourlySlots(s.startTime, s.endTime, s.tokensPerHour || 7);
                s.totalCapacity = s.hourlyTokens.reduce((sum, h) => sum + (parseInt(h.tokens, 10) || 0), 0);
                modified = true;
              }
            });
          }

          // Filter out legacy template clinics (e.g., clinic_01, clinic_02)
          if (Array.isArray(parsed.clinics)) {
            parsed.clinics = parsed.clinics.filter(c => c.slug === 'joshi-clinic' || c.id === 'clinic_joshi' || (!['clinic_01', 'clinic_02', 'medipulse', 'aura-pediatrics'].includes(c.slug) && !['clinic_01', 'clinic_02'].includes(c.id)));
          }

          // Ensure Joshi Clinic is enrolled
          if (!parsed.clinics || parsed.clinics.length === 0 || !parsed.clinics.some(c => c.slug === 'joshi-clinic' || c.id === 'clinic_joshi')) {
            const joshiDef = DEFAULT_STATE.clinics[0];
            parsed.clinics = [JSON.parse(JSON.stringify(joshiDef))];
            parsed.currentClinicId = 'clinic_joshi';
            parsed.sessions = JSON.parse(JSON.stringify(DEFAULT_STATE.sessions));
            parsed.appointments = JSON.parse(JSON.stringify(DEFAULT_STATE.appointments));
            parsed.liveQueues = JSON.parse(JSON.stringify(DEFAULT_STATE.liveQueues));
            modified = true;
          }

          if (modified) {
            this.saveState(parsed);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading state from localStorage:', e);
    }

    // Save initial state if not found
    this.saveState(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  saveState(state) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      console.error('Error saving state:', e);
    }
  }

  commit(eventType = 'STATE_UPDATED', payload = {}) {
    this.saveState(this.state);
    const message = { type: eventType, payload, timestamp: Date.now() };
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }
    this.notifyListeners(message);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(meta) {
    this.listeners.forEach((callback) => {
      try {
        callback(this.state, meta);
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
  }

  // --- Clinic Getters & Setters ---
  getCurrentClinic() {
    return this.state.clinics.find(c => c.id === this.state.currentClinicId) || this.state.clinics[0];
  }

  getAllClinics() {
    return this.state.clinics;
  }

  getClinicBySlugOrId(identifier) {
    if (!identifier) return null;
    const clean = identifier.toString().trim().toLowerCase();
    return this.state.clinics.find(c =>
      (c.id && c.id.toLowerCase() === clean) ||
      (c.slug && c.slug.toLowerCase() === clean)
    ) || null;
  }

  setCurrentClinic(clinicId) {
    const target = this.getClinicBySlugOrId(clinicId);
    if (target) {
      this.state.currentClinicId = target.id;
      this.commit('CLINIC_SWITCHED', { clinicId: target.id, slug: target.slug });
    }
  }

  // Super Admin: Create a new clinic with custom endpoint & generate doctor credentials
  createClinic(clinicData) {
    const rawName = clinicData.name || 'New Health Clinic';
    let baseSlug = clinicData.slug ? slugifyText(clinicData.slug) : slugifyText(rawName);

    // Ensure unique slug
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (this.state.clinics.some(c => c.slug === uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const clinicId = 'clinic_' + Date.now();
    const docName = clinicData.doctorName || 'Dr. Consultant';
    const docUser = clinicData.doctorUsername || `dr.${uniqueSlug}@medipulse.io`;
    const docPass = clinicData.doctorPassword || generateRandomPassword();

    const doctorCreds = {
      username: docUser.trim().toLowerCase(),
      password: docPass.trim(),
      doctorId: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      generatedAt: new Date().toISOString(),
      status: 'active'
    };

    const newClinic = {
      id: clinicId,
      slug: uniqueSlug,
      name: rawName.trim(),
      doctorName: docName.trim(),
      specialty: clinicData.specialty ? clinicData.specialty.trim() : 'General Medicine',
      cabin: clinicData.cabin ? clinicData.cabin.trim() : 'Cabin 1',
      phone: clinicData.phone ? clinicData.phone.trim() : '',
      address: clinicData.address ? clinicData.address.trim() : '',
      avgTimePerPatientMinutes: parseInt(clinicData.avgTimePerPatientMinutes, 10) || 8,
      telegramBotToken: clinicData.telegramBotToken ? clinicData.telegramBotToken.trim() : '',
      telegramChatId: clinicData.telegramChatId ? clinicData.telegramChatId.trim() : '',
      isSimulatedTelegram: true,
      doctorCreds
    };

    this.state.clinics.push(newClinic);

    // Initialize default queue
    this.state.liveQueues[newClinic.id] = {
      currentSessionId: null,
      currentTokenNumber: 0,
      startedAt: null
    };

    // Auto create default morning session for the new clinic
    const defaultSession = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      clinicId: newClinic.id,
      name: 'Morning General OPD',
      startTime: '09:00',
      endTime: '12:00',
      durationHours: 3,
      tokensPerHour: 7,
      totalCapacity: 21,
      hourlyTokens: [
        { hourIndex: 0, label: '09:00 - 10:00', start: '09:00', end: '10:00', tokens: 7 },
        { hourIndex: 1, label: '10:00 - 11:00', start: '10:00', end: '11:00', tokens: 7 },
        { hourIndex: 2, label: '11:00 - 12:00', start: '11:00', end: '12:00', tokens: 7 }
      ],
      status: 'active'
    };
    this.state.sessions.push(defaultSession);
    this.state.liveQueues[newClinic.id].currentSessionId = defaultSession.id;

    this.commit('CLINIC_CREATED', { clinic: newClinic, doctorCreds });
    return { clinic: newClinic, doctorCreds };
  }

  // Super Admin: Regenerate doctor credentials for any clinic
  generateDoctorCreds(clinicId, customUsername = '', customPassword = '') {
    const clinic = this.getClinicBySlugOrId(clinicId);
    if (!clinic) throw new Error('Clinic not found.');

    const newUsername = (customUsername && customUsername.trim())
      ? customUsername.trim().toLowerCase()
      : (clinic.doctorCreds?.username || `dr.${clinic.slug}@medipulse.io`);

    const newPassword = (customPassword && customPassword.trim())
      ? customPassword.trim()
      : generateRandomPassword();

    clinic.doctorCreds = {
      username: newUsername,
      password: newPassword,
      doctorId: clinic.doctorCreds?.doctorId || ('doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
      generatedAt: new Date().toISOString(),
      status: 'active'
    };

    this.commit('DOCTOR_CREDS_REGENERATED', { clinicId: clinic.id, doctorCreds: clinic.doctorCreds });
    return clinic.doctorCreds;
  }

  updateClinic(clinicId, updates) {
    const idx = this.state.clinics.findIndex(c => c.id === clinicId);
    if (idx !== -1) {
      if (updates.slug) {
        updates.slug = slugifyText(updates.slug);
      }
      this.state.clinics[idx] = { ...this.state.clinics[idx], ...updates };
      this.commit('CLINIC_UPDATED', { clinicId, updates });
    }
  }

  deleteClinic(clinicId) {
    if (this.state.clinics.length <= 1) {
      throw new Error('At least one clinic must be present in the system.');
    }
    this.state.clinics = this.state.clinics.filter(c => c.id !== clinicId);
    this.state.sessions = this.state.sessions.filter(s => s.clinicId !== clinicId);
    this.state.appointments = this.state.appointments.filter(a => a.clinicId !== clinicId);
    delete this.state.liveQueues[clinicId];

    if (this.state.currentClinicId === clinicId) {
      this.state.currentClinicId = this.state.clinics[0].id;
    }
    this.commit('CLINIC_DELETED', { clinicId });
  }

  // Clinic Endpoint URL helper (Supports clean /joshi-clinic vanity paths & fallback queries)
  getClinicEndpointUrls(clinicInput, origin = '') {
    const clinic = typeof clinicInput === 'string'
      ? this.getClinicBySlugOrId(clinicInput)
      : clinicInput;

    if (!clinic) return null;
    const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
    const slug = clinic.slug || clinic.id;

    return {
      slug,
      clinicName: clinic.name,
      patientUrl: `${base}/${slug}`,
      tvUrl: `${base}/${slug}/tv`,
      doctorUrl: `${base}/${slug}/doctor`,
      adminUrl: `${base}/admin`,
      patientQueryUrl: `${base}/${slug}`,
      tvQueryUrl: `${base}/${slug}/tv`,
      doctorQueryUrl: `${base}/${slug}/doctor`
    };
  }

  // --- Session Management ---
  getSessionsForClinic(clinicId = this.state.currentClinicId) {
    return this.state.sessions
      .filter(s => s.clinicId === clinicId)
      .map(s => {
        ensureSessionHourlyTokens(s);
        return s;
      });
  }

  getActiveSession(clinicId = this.state.currentClinicId) {
    const queue = this.state.liveQueues[clinicId];
    if (queue && queue.currentSessionId) {
      return this.state.sessions.find(s => s.id === queue.currentSessionId);
    }
    return this.state.sessions.find(s => s.clinicId === clinicId && s.status === 'active');
  }

  createSession({
    clinicId,
    name,
    startTime = '09:00',
    endTime = '12:00',
    durationHours,
    tokensPerHour = 7,
    status = 'scheduled',
    hourlyTokens = null
  }) {
    const dHours = parseFloat(durationHours) || 3;
    const tPerHour = parseInt(tokensPerHour, 10) || 7;

    let computedHourlyTokens = hourlyTokens;
    if (!computedHourlyTokens || !computedHourlyTokens.length) {
      computedHourlyTokens = generateHourlySlots(startTime, endTime, tPerHour);
    }

    const totalCapacity = computedHourlyTokens.reduce((sum, h) => sum + (parseInt(h.tokens, 10) || 0), 0)
      || Math.round(dHours * tPerHour);

    const newSession = {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      clinicId: clinicId || this.state.currentClinicId,
      name,
      startTime,
      endTime,
      durationHours: dHours,
      tokensPerHour: tPerHour,
      totalCapacity,
      hourlyTokens: computedHourlyTokens,
      status
    };

    if (status === 'active') {
      this.state.sessions.forEach(s => {
        if (s.clinicId === newSession.clinicId && s.status === 'active') {
          s.status = 'scheduled';
        }
      });
      if (!this.state.liveQueues[newSession.clinicId]) {
        this.state.liveQueues[newSession.clinicId] = {};
      }
      this.state.liveQueues[newSession.clinicId].currentSessionId = newSession.id;
      this.state.liveQueues[newSession.clinicId].currentTokenNumber = 0;
    }

    this.state.sessions.push(newSession);
    this.commit('SESSION_CREATED', { session: newSession });
    return newSession;
  }

  updateSession(sessionId, updates) {
    const idx = this.state.sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      const current = this.state.sessions[idx];
      const dHours = updates.durationHours !== undefined ? parseFloat(updates.durationHours) : current.durationHours;
      const tPerHour = updates.tokensPerHour !== undefined ? parseInt(updates.tokensPerHour, 10) : current.tokensPerHour;
      const startTime = updates.startTime || current.startTime;
      const endTime = updates.endTime || current.endTime;

      let hourlyTokens = updates.hourlyTokens !== undefined ? updates.hourlyTokens : current.hourlyTokens;
      if (!hourlyTokens || !hourlyTokens.length) {
        hourlyTokens = generateHourlySlots(startTime, endTime, tPerHour);
      }

      let totalCapacity = updates.totalCapacity;
      if (totalCapacity === undefined) {
        if (hourlyTokens && hourlyTokens.length > 0) {
          totalCapacity = hourlyTokens.reduce((sum, h) => sum + (parseInt(h.tokens, 10) || 0), 0);
        } else {
          totalCapacity = Math.round(dHours * tPerHour);
        }
      }

      if (updates.status === 'active') {
        this.state.sessions.forEach(s => {
          if (s.clinicId === current.clinicId && s.id !== sessionId && s.status === 'active') {
            s.status = 'scheduled';
          }
        });
        if (!this.state.liveQueues[current.clinicId]) {
          this.state.liveQueues[current.clinicId] = {};
        }
        if (this.state.liveQueues[current.clinicId].currentSessionId !== sessionId) {
          this.state.liveQueues[current.clinicId].currentSessionId = sessionId;
          this.state.liveQueues[current.clinicId].currentTokenNumber = 0;
        }
      }

      this.state.sessions[idx] = {
        ...current,
        ...updates,
        durationHours: dHours,
        tokensPerHour: tPerHour,
        totalCapacity,
        hourlyTokens
      };
      this.commit('SESSION_UPDATED', { sessionId, session: this.state.sessions[idx] });
      return this.state.sessions[idx];
    }
  }

  // Add tokens to an existing session (Allowed only when session is NOT live)
  addTokensToSession(sessionId, { extraTokens = 0, hourlyTokens = null }) {
    const session = this.state.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Session not found.');

    // Security check: Must NOT be an active/live session
    if (session.status === 'active') {
      throw new Error('Tokens cannot be added to an active live session. Only non-live / scheduled sessions can have tokens added.');
    }

    ensureSessionHourlyTokens(session);

    if (hourlyTokens && Array.isArray(hourlyTokens) && hourlyTokens.length > 0) {
      session.hourlyTokens = hourlyTokens.map((h, i) => ({
        ...h,
        hourIndex: i,
        tokens: Math.max(0, parseInt(h.tokens, 10) || 0)
      }));
      session.totalCapacity = session.hourlyTokens.reduce((sum, h) => sum + h.tokens, 0);
    } else if (extraTokens > 0) {
      const added = parseInt(extraTokens, 10) || 0;
      session.totalCapacity = (session.totalCapacity || 0) + added;

      // Distribute added tokens across hourly slots
      const numHours = session.hourlyTokens.length || 1;
      const perHour = Math.floor(added / numHours);
      let remainder = added % numHours;
      session.hourlyTokens.forEach((h, idx) => {
        h.tokens = (parseInt(h.tokens, 10) || 0) + perHour + (idx < remainder ? 1 : 0);
      });
    }

    this.commit('SESSION_UPDATED', { sessionId, session, tokensAdded: extraTokens });
    return session;
  }

  deleteSession(sessionId) {
    const session = this.state.sessions.find(s => s.id === sessionId);
    if (!session) return;
    this.state.sessions = this.state.sessions.filter(s => s.id !== sessionId);
    this.state.appointments = this.state.appointments.filter(a => a.sessionId !== sessionId);

    const queue = this.state.liveQueues[session.clinicId];
    if (queue && queue.currentSessionId === sessionId) {
      queue.currentSessionId = null;
      queue.currentTokenNumber = 0;
    }
    this.commit('SESSION_DELETED', { sessionId });
  }

  // --- Appointments & Queue ---
  getAppointmentsForSession(sessionId) {
    return this.state.appointments
      .filter(a => a.sessionId === sessionId)
      .sort((a, b) => a.tokenNumber - b.tokenNumber);
  }

  getLiveQueue(clinicId = this.state.currentClinicId) {
    const queue = this.state.liveQueues[clinicId] || {
      currentSessionId: null,
      currentTokenNumber: 0,
      startedAt: null
    };

    const session = queue.currentSessionId
      ? this.state.sessions.find(s => s.id === queue.currentSessionId)
      : this.getActiveSession(clinicId);

    const allApts = session ? this.getAppointmentsForSession(session.id) : [];
    const currentApt = allApts.find(a => a.tokenNumber === queue.currentTokenNumber) || null;
    const nextApts = allApts.filter(a => a.status === 'waiting' && a.tokenNumber > queue.currentTokenNumber);
    const completedApts = allApts.filter(a => a.status === 'completed');

    return {
      session,
      currentTokenNumber: queue.currentTokenNumber,
      currentApt,
      nextApts,
      completedApts,
      allApts,
      startedAt: queue.startedAt
    };
  }

  // Book a new appointment & allot sequential token
  bookAppointment({ clinicId = this.state.currentClinicId, sessionId, patientName, phone }) {
    const session = this.state.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Selected session does not exist.');

    const sessionApts = this.getAppointmentsForSession(sessionId);
    if (sessionApts.length >= session.totalCapacity) {
      throw new Error(`Session is fully booked! All ${session.totalCapacity} tokens have been allotted.`);
    }

    const highestToken = sessionApts.reduce((max, a) => Math.max(max, a.tokenNumber), 0);
    const nextTokenNumber = highestToken + 1;

    const clinic = this.state.clinics.find(c => c.id === clinicId) || this.getCurrentClinic();
    const queue = this.state.liveQueues[clinicId] || {};
    const currentToken = queue.currentTokenNumber || 0;
    const patientsAhead = Math.max(0, nextTokenNumber - currentToken - 1);
    const waitMinutes = patientsAhead * (clinic.avgTimePerPatientMinutes || 8);

    const estDate = new Date(Date.now() + waitMinutes * 60 * 1000);
    const estTimeStr = estDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newAppointment = {
      id: 'apt_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      clinicId,
      sessionId,
      tokenNumber: nextTokenNumber,
      patientName: patientName.trim(),
      phone: phone.trim(),
      status: 'waiting',
      bookedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      estimatedTime: estTimeStr,
      patientsAhead,
      waitMinutes
    };

    this.state.appointments.push(newAppointment);
    this.commit('APPOINTMENT_BOOKED', { appointment: newAppointment });

    return newAppointment;
  }

  callNextToken(clinicId = this.state.currentClinicId) {
    const queue = this.state.liveQueues[clinicId];
    if (!queue || !queue.currentSessionId) {
      const activeSess = this.getActiveSession(clinicId);
      if (!activeSess) throw new Error('No active session is running for this clinic.');
      this.state.liveQueues[clinicId] = {
        currentSessionId: activeSess.id,
        currentTokenNumber: 0,
        startedAt: Date.now()
      };
    }

    const currentQ = this.state.liveQueues[clinicId];
    const sessionApts = this.getAppointmentsForSession(currentQ.currentSessionId);

    const currentApt = sessionApts.find(a => a.tokenNumber === currentQ.currentTokenNumber);
    if (currentApt) {
      currentApt.status = 'completed';
      currentApt.completedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const nextApt = sessionApts.find(a => a.status === 'waiting' && a.tokenNumber > currentQ.currentTokenNumber);

    if (nextApt) {
      currentQ.currentTokenNumber = nextApt.tokenNumber;
      nextApt.status = 'serving';
      currentQ.startedAt = Date.now();
    } else {
      currentQ.currentTokenNumber += 1;
      currentQ.startedAt = Date.now();
    }

    this.commit('TOKEN_CALLED_NEXT', {
      clinicId,
      tokenNumber: currentQ.currentTokenNumber,
      apt: nextApt || null
    });

    return currentQ.currentTokenNumber;
  }

  callPrevToken(clinicId = this.state.currentClinicId) {
    const currentQ = this.state.liveQueues[clinicId];
    if (!currentQ || currentQ.currentTokenNumber <= 1) return;

    currentQ.currentTokenNumber -= 1;
    currentQ.startedAt = Date.now();

    const sessionApts = this.getAppointmentsForSession(currentQ.currentSessionId);
    const apt = sessionApts.find(a => a.tokenNumber === currentQ.currentTokenNumber);
    if (apt) {
      apt.status = 'serving';
    }

    this.commit('TOKEN_CALLED_PREV', {
      clinicId,
      tokenNumber: currentQ.currentTokenNumber
    });
  }

  markTokenCompleted(clinicId = this.state.currentClinicId) {
    const currentQ = this.state.liveQueues[clinicId];
    if (!currentQ) return;

    const sessionApts = this.getAppointmentsForSession(currentQ.currentSessionId);
    const apt = sessionApts.find(a => a.tokenNumber === currentQ.currentTokenNumber);
    if (apt) {
      apt.status = 'completed';
      apt.completedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.commit('TOKEN_COMPLETED', { clinicId, tokenNumber: currentQ.currentTokenNumber });
    }
  }

  skipToken(clinicId = this.state.currentClinicId) {
    const currentQ = this.state.liveQueues[clinicId];
    if (!currentQ) return;

    const sessionApts = this.getAppointmentsForSession(currentQ.currentSessionId);
    const apt = sessionApts.find(a => a.tokenNumber === currentQ.currentTokenNumber);
    if (apt) {
      apt.status = 'skipped';
    }
    this.callNextToken(clinicId);
  }

  recallToken(clinicId = this.state.currentClinicId) {
    const currentQ = this.state.liveQueues[clinicId];
    if (!currentQ) return;

    this.commit('TOKEN_RECALLED', {
      clinicId,
      tokenNumber: currentQ.currentTokenNumber
    });
  }

  // System Analytics for Super Admin
  getSystemAnalytics() {
    const totalClinics = this.state.clinics.length;
    const totalSessions = this.state.sessions.length;
    const activeSessions = this.state.sessions.filter(s => s.status === 'active').length;
    const totalAppointments = this.state.appointments.length;
    const completedAppointments = this.state.appointments.filter(a => a.status === 'completed').length;
    const waitingAppointments = this.state.appointments.filter(a => a.status === 'waiting').length;

    return {
      totalClinics,
      totalDoctors: totalClinics,
      totalSessions,
      activeSessions,
      totalAppointments,
      completedAppointments,
      waitingAppointments
    };
  }

  resetToDefault() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.commit('RESET_TO_DEFAULT');
  }
}

export const clinicStore = new ClinicStore();
