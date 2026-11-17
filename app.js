/* ==========================================================================
   Schedulr — Streamlined & Hardened D&D Session Scheduler
   100% Static Client-Side App (GitHub Pages Ready)
   ========================================================================== */

(() => {
  'use strict';

  const STORAGE_KEY = 'schedulr_state_v3';

  // --------------------------------------------------------------------------
  // Security & Input Sanitization Layer
  // --------------------------------------------------------------------------
  const MAX_TOKEN_LENGTH = 8192;
  const MAX_DATES = 24;
  const MAX_PLAYERS = 30;
  const VALID_VOTES = new Set(['dtf', 'maybe', 'pass']);
  const VALID_HOSTING = new Set(['🏠 Can Host', '🚗 Can Travel', '💻 Remote/VTT', '🍕 Brings Snacks']);
  const VALID_VIEWS = new Set(['checkin', 'grid', 'dm']);

  function safeJsonParse(jsonStr) {
    if (typeof jsonStr !== 'string') return null;
    return JSON.parse(jsonStr, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
  }

  function cleanString(val, maxLen = 80, fallback = '') {
    if (typeof val !== 'string' && typeof val !== 'number') return fallback;
    const cleaned = String(val)
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim()
      .slice(0, maxLen);
    return cleaned || fallback;
  }

  function cleanId(val, fallback = 'id') {
    const str = typeof val === 'string' ? val.trim() : '';
    return /^[a-zA-Z0-9_-]{1,36}$/.test(str) ? str : fallback;
  }

  function cleanVoteMap(rawVotes) {
    const clean = {};
    if (!rawVotes || typeof rawVotes !== 'object' || Array.isArray(rawVotes)) return clean;
    const entries = Object.entries(rawVotes).slice(0, MAX_DATES * 2);
    for (const [k, v] of entries) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      const safeKey = cleanId(k, '');
      if (safeKey && VALID_VOTES.has(v)) {
        clean[safeKey] = v;
      }
    }
    return clean;
  }

  function sanitizeDateEntry(raw, idx) {
    const fallbackId = `d${idx + 1}`;
    const rawDate = cleanString(raw && raw.date, 16, '');
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '';
    return {
      id: cleanId(raw && raw.id, fallbackId),
      date: safeDate,
      label: cleanString(raw && raw.label, 24, `Date ${idx + 1}`),
      weekday: cleanString(raw && raw.weekday, 16, 'SESSION'),
      time: cleanString(raw && raw.time, 20, '7:00 PM'),
      holiday: Boolean(raw && raw.holiday)
    };
  }

  function sanitizePlayer(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const rawClass = cleanString(raw.classVibe, 40, 'Barbarian (Down to Roll)');
    const safeClass = Object.prototype.hasOwnProperty.call(CLASS_META, rawClass)
      ? rawClass
      : 'Barbarian (Down to Roll)';
    const rawHosting = cleanString(raw.hosting, 30, '🚗 Can Travel');
    const safeHosting = VALID_HOSTING.has(rawHosting) ? rawHosting : '🚗 Can Travel';
    const rawTaps = Number(raw.taps);

    return {
      id: cleanId(raw.id, 'p-' + Math.random().toString(36).slice(2, 8)),
      name: cleanString(raw.name, 28, 'Mystery Adventurer'),
      classVibe: safeClass,
      hosting: safeHosting,
      online: raw.online !== false,
      taps: Number.isFinite(rawTaps) ? Math.max(0, Math.min(9999, Math.floor(rawTaps))) : 0,
      votes: cleanVoteMap(raw.votes)
    };
  }

  function sanitizeCampaign(raw, fallbackCamp) {
    if (!raw || typeof raw !== 'object') return fallbackCamp;
    const quorumNum = Number(raw.quorum);
    const rawDates = Array.isArray(raw.dates) ? raw.dates.slice(0, MAX_DATES) : fallbackCamp.dates;
    const rawPlayers = Array.isArray(raw.players) ? raw.players.slice(0, MAX_PLAYERS) : fallbackCamp.players;

    return {
      id: cleanId(raw.id, fallbackCamp.id),
      title: cleanString(raw.title, 48, fallbackCamp.title),
      quorum: Number.isFinite(quorumNum) ? Math.max(2, Math.min(12, Math.floor(quorumNum))) : fallbackCamp.quorum,
      dates: rawDates.map((dt, idx) => sanitizeDateEntry(dt, idx)),
      players: rawPlayers.map((p) => sanitizePlayer(p)).filter(Boolean)
    };
  }

  // --------------------------------------------------------------------------
  // 1. Comedy Copy & Class Metadata
  // --------------------------------------------------------------------------
  const ANTI_ESSAY_ROASTS = [
    "Nice 4-paragraph monologue, Bard, but nobody asked about traffic. Tap 🔥 DTF, 🎲 Maybe, or 💀 Pass.",
    "We are NOT doing 'it depends on Mercury retrograde' tonight. Give a straight answer.",
    "20 texts over 6 hours ends TODAY. Your essay has been incinerated by a Level 9 Fireball.",
    "Save the lore dump for session recap. All we need is DTF, Maybe, or Pass.",
    "You rolled a Natural 1 on Following Simple Directions. Tap one of the 3 buttons.",
    "Sir/Ma'am, this is Schedulr, not AO3. Three buttons. Two seconds.",
    "Every time someone types 'maybe free around 7:45ish', a baby Beholder cries. Click a button!",
    "This text box is a Mimic! It just ate your excuses. Use the glowing buttons above."
  ];

  const CLASS_META = {
    'Paladin (Host)': { grad: ['#2b1d05', '#ffb800', '#ff6b00'] },
    'Rogue (Always Late)': { grad: ['#161124', '#8e2de2', '#ff3366'] },
    'Bard (Brings Drinks)': { grad: ['#240e24', '#ff5500', '#ffb800'] },
    'Warlock (Ask My Patron)': { grad: ['#120b24', '#6c38ff', '#00e676'] },
    'Wizard (VTT Only)': { grad: ['#091c2e', '#00b4d8', '#b388ff'] },
    'Barbarian (Down to Roll)': { grad: ['#29090d', '#ff3366', '#ff8800'] }
  };

  function deriveClassVibe(name, hosting) {
    if (hosting === '🏠 Can Host') return 'Paladin (Host)';
    if (hosting === '💻 Remote/VTT') return 'Wizard (VTT Only)';
    if (hosting === '🍕 Brings Snacks') return 'Bard (Brings Drinks)';
    const travelPool = ['Barbarian (Down to Roll)', 'Rogue (Always Late)', 'Warlock (Ask My Patron)'];
    return travelPool[Math.abs(hashStr(name || 'travel')) % travelPool.length];
  }

  // --------------------------------------------------------------------------
  // 2. Sample Party Campaign
  // --------------------------------------------------------------------------
  function createSampleCampaign() {
    return {
      id: 'holiday-gauntlet-2026',
      title: 'Holiday D&D Gauntlet',
      quorum: 4,
      dates: [
        { id: 'd1', date: '2026-11-28', label: 'Nov 28', weekday: 'SATURDAY', time: '7:00 PM', holiday: true },
        { id: 'd2', date: '2026-12-05', label: 'Dec 5', weekday: 'SATURDAY', time: '7:00 PM', holiday: true },
        { id: 'd3', date: '2026-12-12', label: 'Dec 12', weekday: 'SATURDAY', time: '2:00 PM', holiday: true },
        { id: 'd4', date: '2026-12-19', label: 'Dec 19', weekday: 'SATURDAY', time: '7:00 PM', holiday: true },
        { id: 'd5', date: '2026-12-27', label: 'Dec 27', weekday: 'SUNDAY', time: '5:00 PM', holiday: true },
        { id: 'd6', date: '2027-01-02', label: 'Jan 2', weekday: 'SATURDAY', time: '7:00 PM', holiday: true }
      ],
      players: [
        {
          id: 'p-dm',
          name: 'The Forever DM',
          classVibe: 'Paladin (Host)',
          hosting: '🏠 Can Host',
          online: true,
          taps: 4,
          votes: { d1: 'dtf', d2: 'dtf', d3: 'dtf', d4: 'dtf', d5: 'dtf', d6: 'dtf' }
        },
        {
          id: 'p-grog',
          name: 'Grog',
          classVibe: 'Barbarian (Down to Roll)',
          hosting: '🏠 Can Host',
          online: true,
          taps: 7,
          votes: { d1: 'dtf', d2: 'maybe', d3: 'dtf', d4: 'dtf', d5: 'dtf', d6: 'maybe' }
        },
        {
          id: 'p-shadow',
          name: 'Shadowheart_Stan',
          classVibe: 'Bard (Brings Drinks)',
          hosting: '🍕 Brings Snacks',
          online: true,
          taps: 5,
          votes: { d1: 'maybe', d2: 'dtf', d3: 'pass', d4: 'dtf', d5: 'dtf', d6: 'dtf' }
        },
        {
          id: 'p-astarion',
          name: "Astarion's Lawyer",
          classVibe: 'Wizard (VTT Only)',
          hosting: '💻 Remote/VTT',
          online: true,
          taps: 2,
          votes: { d1: 'dtf', d2: 'dtf', d3: 'maybe', d4: 'dtf', d5: 'pass', d6: 'dtf' }
        },
        {
          id: 'p-baelor',
          name: 'Baelor the Flake',
          classVibe: 'Rogue (Always Late)',
          hosting: '🚗 Can Travel',
          online: false,
          taps: 19,
          votes: { d1: 'pass', d2: 'maybe' }
        }
      ]
    };
  }

  // --------------------------------------------------------------------------
  // 3. State Management
  // --------------------------------------------------------------------------
  const defaultState = {
    activeView: 'checkin',
    hideHowItWorks: false,
    campaign: createSampleCampaign(),
    currentPlayer: {
      id: 'p-you-' + Math.random().toString(36).slice(2, 7),
      name: '',
      classVibe: 'Paladin (Host)',
      hosting: '🏠 Can Host',
      votes: {}
    },
    deckIndex: 0,
    checkinCompleted: false
  };

  let state = loadState();

  function loadState() {
    try {
      localStorage.removeItem('grindm_state_v1');
      localStorage.removeItem('schedulr_state_v2');
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || raw.length > 262144) return structuredCloneCompat(defaultState);
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== 'object') return structuredCloneCompat(defaultState);

      const baseCamp = createSampleCampaign();
      const cp = parsed.currentPlayer && typeof parsed.currentPlayer === 'object' ? parsed.currentPlayer : {};
      const cpHosting = cleanString(cp.hosting, 30, '🏠 Can Host');
      const safeHosting = VALID_HOSTING.has(cpHosting) ? cpHosting : '🏠 Can Host';
      const cpName = cleanString(cp.name, 28, '');

      return {
        activeView: VALID_VIEWS.has(parsed.activeView) ? parsed.activeView : 'checkin',
        hideHowItWorks: Boolean(parsed.hideHowItWorks),
        campaign: sanitizeCampaign(parsed.campaign, baseCamp),
        currentPlayer: {
          id: cleanId(cp.id, defaultState.currentPlayer.id),
          name: cpName,
          classVibe: deriveClassVibe(cpName, safeHosting),
          hosting: safeHosting,
          votes: cleanVoteMap(cp.votes)
        },
        deckIndex: Math.max(0, Math.floor(Number(parsed.deckIndex) || 0)),
        checkinCompleted: Boolean(parsed.checkinCompleted)
      };
    } catch {
      return structuredCloneCompat(defaultState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }

  function structuredCloneCompat(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getActiveCampaign() {
    return state.campaign;
  }

  // --------------------------------------------------------------------------
  // 4. UTF-8 Safe Base64URL Link Codec (?c= Invite Links, ?r= Reply Links)
  // --------------------------------------------------------------------------
  function encodePayload(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodePayload(b64url) {
    if (typeof b64url !== 'string' || b64url.length === 0 || b64url.length > MAX_TOKEN_LENGTH) {
      throw new Error('Payload length invalid');
    }
    if (!/^[A-Za-z0-9\-_=]+$/.test(b64url)) {
      throw new Error('Invalid token characters');
    }
    const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = safeJsonParse(json);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid payload object');
    }
    return parsed;
  }

  function buildCampaignShareUrl(campaign) {
    const payload = {
      v: 1,
      id: campaign.id,
      t: campaign.title,
      q: campaign.quorum,
      d: campaign.dates.map((dt) => [dt.id, dt.date, dt.label, dt.weekday, dt.time, dt.holiday ? 1 : 0])
    };
    const base = window.location.origin + window.location.pathname;
    return `${base}?c=${encodePayload(payload)}`;
  }

  function buildPlayerResponseUrl() {
    const camp = getActiveCampaign();
    const p = state.currentPlayer;
    const name = cleanString(p.name, 28, 'Mystery Adventurer');
    const payload = {
      v: 1,
      cid: camp.id,
      ct: camp.title,
      p: {
        id: p.id,
        n: name,
        c: deriveClassVibe(name, p.hosting),
        h: p.hosting,
        v: p.votes
      }
    };
    const encoded = encodePayload(payload);
    const base = window.location.origin + window.location.pathname;
    return `${base}?r=${encoded}`;
  }

  function applyIncomingUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const cToken = params.get('c');
    const rToken = params.get('r');

    if (cToken) {
      try {
        if (cToken.length > MAX_TOKEN_LENGTH) throw new Error('Campaign token too large');
        const decoded = decodePayload(cToken);
        if (decoded && Array.isArray(decoded.d)) {
          const fallbackCamp = createSampleCampaign();
          const incomingId = cleanId(decoded.id, 'camp-' + Date.now().toString(36));
          const rawCampaign = {
            id: incomingId,
            title: decoded.t || 'D&D Session Check-In',
            quorum: decoded.q || 4,
            dates: decoded.d.slice(0, MAX_DATES).map((arr) => {
              const safeArr = Array.isArray(arr) ? arr : [];
              return {
                id: safeArr[0],
                date: safeArr[1],
                label: safeArr[2],
                weekday: safeArr[3],
                time: safeArr[4],
                holiday: Boolean(safeArr[5])
              };
            }),
            players: state.campaign.id === incomingId ? state.campaign.players : []
          };
          state.campaign = sanitizeCampaign(rawCampaign, fallbackCamp);
          state.deckIndex = 0;
          state.checkinCompleted = false;
          state.activeView = 'checkin';
          saveState();
          showToast(`⚔️ Loaded "${state.campaign.title}"!`, 'success');
        }
      } catch {
        showToast('Could not open campaign link.', 'danger');
      }
    }

    if (rToken) {
      const ok = importResponseToken(rToken, true);
      if (ok) {
        state.activeView = 'grid';
        saveState();
      }
    }

    if (cToken || rToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function importResponseToken(rawInput, fromUrl = false) {
    let token = typeof rawInput === 'string' ? rawInput.trim() : '';
    if (!token || token.length > MAX_TOKEN_LENGTH + 1024) return false;

    try {
      const urlMatch = token.match(/https?:\/\/[^\s"'<>]+/i);
      if (urlMatch) {
        const cleanedUrl = urlMatch[0].replace(/[.,!?;:)]+$/, '');
        const urlObj = new URL(cleanedUrl);
        token = urlObj.searchParams.get('r') || '';
      } else if (token.includes('?r=') || token.includes('&r=')) {
        const match = token.match(/[?&]r=([A-Za-z0-9\-_=]+)/);
        token = match ? match[1] : '';
      } else if (token.startsWith('r=')) {
        token = token.slice(2);
      } else if (token.toUpperCase().includes('SCHEDULR:') || token.toUpperCase().includes('GRINDM:')) {
        const match = token.match(/(?:SCHEDULR|GRINDM):([A-Za-z0-9\-_=]+)/i);
        if (match) token = match[1];
      }

      const data = decodePayload(token);
      if (!data || !data.p || typeof data.p !== 'object' || !data.p.n) {
        throw new Error('Invalid response');
      }

      const incomingCampaignId = cleanId(data.cid, '');
      const incomingCampaignTitle = cleanString(data.ct, 48, '');
      const camp = getActiveCampaign();

      if (incomingCampaignId && camp.players.length === 0 && camp.id !== incomingCampaignId) {
        camp.id = incomingCampaignId;
        if (incomingCampaignTitle) camp.title = incomingCampaignTitle;
      }

      const incomingPlayer = sanitizePlayer({
        id: data.p.id,
        name: data.p.n,
        classVibe: data.p.c || deriveClassVibe(data.p.n, data.p.h),
        hosting: data.p.h,
        online: true,
        taps: 1,
        votes: cleanVoteMap(data.p.v)
      });

      if (!incomingPlayer) {
        throw new Error('Invalid player data');
      }

      upsertPlayerInCampaign(camp, incomingPlayer);
      saveState();
      playCritFanfare();
      showToast(`🔥 Added ${incomingPlayer.name} to The Grid!`, 'success');
      if (!fromUrl) {
        renderAll();
      }
      return true;
    } catch {
      showToast('❌ Could not find a valid Reply Link in what you pasted.', 'danger');
      return false;
    }
  }

  function upsertPlayerInCampaign(campaign, playerObj) {
    const safePlayer = sanitizePlayer(playerObj);
    if (!safePlayer) return;
    const idx = campaign.players.findIndex(
      (p) => p.id === safePlayer.id || p.name.toLowerCase() === safePlayer.name.toLowerCase()
    );
    if (idx >= 0) {
      campaign.players[idx] = {
        ...campaign.players[idx],
        ...safePlayer,
        taps: campaign.players[idx].taps || safePlayer.taps || 0
      };
    } else {
      campaign.players.unshift(safePlayer);
      if (campaign.players.length > MAX_PLAYERS) {
        campaign.players.length = MAX_PLAYERS;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Web Audio Synth FX
  // --------------------------------------------------------------------------
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, duration = 0.08, type = 'triangle', gainVal = 0.07, delay = 0) {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function playTapFlameSound() {
    playTone(587.33, 0.08, 'sine', 0.07, 0);
    playTone(880, 0.12, 'triangle', 0.07, 0.05);
  }

  function playCritFanfare() {
    playTone(523.25, 0.09, 'triangle', 0.07, 0);
    playTone(659.25, 0.09, 'triangle', 0.07, 0.07);
    playTone(783.99, 0.11, 'triangle', 0.08, 0.14);
    playTone(1046.5, 0.22, 'sine', 0.09, 0.21);
  }

  function playBuzzerSound() {
    playTone(170, 0.14, 'sawtooth', 0.06, 0);
    playTone(130, 0.18, 'sawtooth', 0.06, 0.11);
  }

  // --------------------------------------------------------------------------
  // 6. Custom SVG Class Portraits
  // --------------------------------------------------------------------------
  function getClassPortraitSvg(classVibe, name = '') {
    const meta = CLASS_META[classVibe] || CLASS_META['Barbarian (Down to Roll)'];
    const [bg, c1, c2] = meta.grad;
    const uid = 'g' + Math.abs(hashStr(classVibe + name)).toString(36);

    let emblem = '';
    if (classVibe.startsWith('Paladin')) {
      emblem = `
        <path d="M50 22 L72 30 V50 C72 65 50 78 50 78 C50 78 28 65 28 50 V30 Z" fill="#111218" stroke="${c1}" stroke-width="3"/>
        <path d="M50 31 V67 M37 47 H63" stroke="${c1}" stroke-width="4.5" stroke-linecap="round"/>
      `;
    } else if (classVibe.startsWith('Rogue')) {
      emblem = `
        <path d="M24 68 C26 40 36 22 50 20 C64 22 74 40 76 68 Z" fill="#0d0b14" stroke="${c2}" stroke-width="2.5"/>
        <ellipse cx="42" cy="48" rx="4.5" ry="2.6" fill="#FFB800"/>
        <ellipse cx="58" cy="48" rx="4.5" ry="2.6" fill="#FFB800"/>
        <path d="M32 74 L68 38" stroke="#e0e0f0" stroke-width="3" stroke-linecap="round"/>
      `;
    } else if (classVibe.startsWith('Bard')) {
      emblem = `
        <ellipse cx="46" cy="58" rx="16" ry="18" fill="#180d14" stroke="${c2}" stroke-width="3"/>
        <line x1="56" y1="44" x2="73" y2="23" stroke="${c1}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="46" cy="58" r="5" fill="${c1}"/>
        <path d="M25 32 Q32 24 38 30" stroke="#fff" stroke-width="2.5" fill="none"/>
      `;
    } else if (classVibe.startsWith('Warlock')) {
      emblem = `
        <path d="M22 50 Q50 22 78 50 Q50 78 22 50 Z" fill="#10091f" stroke="${c1}" stroke-width="3"/>
        <circle cx="50" cy="50" r="10" fill="${c2}"/>
        <ellipse cx="50" cy="50" rx="3.2" ry="8" fill="#0b0b0e"/>
      `;
    } else if (classVibe.startsWith('Wizard')) {
      emblem = `
        <polygon points="50,18 70,58 30,58" fill="#11192e" stroke="${c2}" stroke-width="2.5"/>
        <ellipse cx="50" cy="58" rx="28" ry="6" fill="#15223e" stroke="${c1}" stroke-width="2.5"/>
        <circle cx="50" cy="43" r="4" fill="#FFB800"/>
      `;
    } else {
      emblem = `
        <line x1="30" y1="74" x2="70" y2="26" stroke="#d8dde6" stroke-width="4" stroke-linecap="round"/>
        <path d="M54 24 C68 20 78 30 74 44 L58 38 Z" fill="${c1}" stroke="#fff" stroke-width="1.5"/>
        <path d="M46 34 C32 30 22 40 26 54 L42 48 Z" fill="${c2}" stroke="#fff" stroke-width="1.5"/>
      `;
    }

    return `
      <svg class="player-avatar-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${bg}" />
            <stop offset="55%" stop-color="${c1}" stop-opacity="0.38" />
            <stop offset="100%" stop-color="${c2}" stop-opacity="0.55" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="#0e0e14" />
        <rect width="100" height="100" fill="url(#${uid})" />
        <circle cx="50" cy="48" r="34" fill="rgba(255,255,255,0.04)" />
        ${emblem}
      </svg>
    `;
  }

  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  // --------------------------------------------------------------------------
  // 7. Preset Dates Helper
  // --------------------------------------------------------------------------
  function generatePresetDates(presetKey) {
    const map = {
      thanksgiving: [
        { id: 'tg1', date: '2026-11-25', label: 'Nov 25', weekday: 'WEDNESDAY', time: '7:30 PM', holiday: true },
        { id: 'tg2', date: '2026-11-27', label: 'Nov 27', weekday: 'FRIDAY', time: '7:00 PM', holiday: true },
        { id: 'tg3', date: '2026-11-28', label: 'Nov 28', weekday: 'SATURDAY', time: '2:00 PM', holiday: true },
        { id: 'tg4', date: '2026-11-29', label: 'Nov 29', weekday: 'SUNDAY', time: '5:00 PM', holiday: true }
      ],
      december: [
        { id: 'dc1', date: '2026-12-05', label: 'Dec 5', weekday: 'SATURDAY', time: '7:00 PM', holiday: true },
        { id: 'dc2', date: '2026-12-11', label: 'Dec 11', weekday: 'FRIDAY', time: '7:30 PM', holiday: true },
        { id: 'dc3', date: '2026-12-12', label: 'Dec 12', weekday: 'SATURDAY', time: '6:00 PM', holiday: true },
        { id: 'dc4', date: '2026-12-19', label: 'Dec 19', weekday: 'SATURDAY', time: '7:00 PM', holiday: true },
        { id: 'dc5', date: '2026-12-20', label: 'Dec 20', weekday: 'SUNDAY', time: '4:00 PM', holiday: true }
      ],
      nye: [
        { id: 'ny1', date: '2026-12-27', label: 'Dec 27', weekday: 'SUNDAY', time: '5:00 PM', holiday: true },
        { id: 'ny2', date: '2026-12-30', label: 'Dec 30', weekday: 'WEDNESDAY', time: '7:00 PM', holiday: true },
        { id: 'ny3', date: '2026-12-31', label: 'Dec 31', weekday: 'THURSDAY', time: '8:00 PM', holiday: true },
        { id: 'ny4', date: '2027-01-02', label: 'Jan 2', weekday: 'SATURDAY', time: '6:00 PM', holiday: true }
      ],
      weekends: getUpcomingWeekends()
    };
    return map[presetKey] || getUpcomingWeekends();
  }

  function getUpcomingWeekends() {
    const result = [];
    const cursor = new Date();
    cursor.setHours(12, 0, 0, 0);
    let count = 0;
    while (result.length < 6 && count < 45) {
      cursor.setDate(cursor.getDate() + 1);
      count++;
      const day = cursor.getDay();
      if (day === 5 || day === 6 || day === 0) {
        const iso = cursor.toISOString().slice(0, 10);
        const label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekday = cursor.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const time = day === 0 ? '5:00 PM' : '7:00 PM';
        result.push({
          id: 'wk-' + iso,
          date: iso,
          label,
          weekday,
          time,
          holiday: cursor.getMonth() === 10 || cursor.getMonth() === 11
        });
      }
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // 8. DOM References
  // --------------------------------------------------------------------------
  const els = {
    howItWorksBtn: document.getElementById('how-it-works-btn'),
    howItWorksCard: document.getElementById('how-it-works-card'),
    closeHowBtn: document.getElementById('close-how-btn'),
    headerInviteBtn: document.getElementById('header-invite-btn'),
    gridCountBadge: document.getElementById('grid-count-badge'),

    navTabs: document.querySelectorAll('.nav-tab'),
    bottomTabs: document.querySelectorAll('.bottom-tab'),
    views: {
      checkin: document.getElementById('view-checkin'),
      grid: document.getElementById('view-grid'),
      dm: document.getElementById('view-dm')
    },

    // Check-In
    checkinCampaignTitle: document.getElementById('checkin-campaign-title'),
    playerNameInput: document.getElementById('player-name-input'),
    playerHostingSelect: document.getElementById('player-hosting-select'),

    checkinDeckArea: document.getElementById('checkin-deck-area'),
    deckProgressLabel: document.getElementById('deck-progress-label'),
    deckProgressFill: document.getElementById('deck-progress-fill'),
    activeDateCard: document.getElementById('active-date-card'),
    cardWeekday: document.getElementById('card-weekday'),
    cardDateMain: document.getElementById('card-date-main'),
    cardPartyPulse: document.getElementById('card-party-pulse'),
    verdictButtons: document.querySelectorAll('.btn-verdict'),
    prevCardBtn: document.getElementById('prev-card-btn'),
    nextCardBtn: document.getElementById('next-card-btn'),
    currentVoteIndicator: document.getElementById('current-vote-indicator'),

    checkinCompleteCard: document.getElementById('checkin-complete-card'),
    playerSummaryChips: document.getElementById('player-summary-chips'),
    copyResponseLinkBtn: document.getElementById('copy-response-link-btn'),
    copyResponseCodeBtn: document.getElementById('copy-response-code-btn'),
    gotoGridBtn: document.getElementById('goto-grid-after-checkin-btn'),
    editAnswersBtn: document.getElementById('edit-answers-btn'),

    antiEssayForm: document.getElementById('anti-essay-form'),
    antiEssayInput: document.getElementById('anti-essay-input'),

    // Grid
    bestMatchBanner: document.getElementById('best-match-banner'),
    datesShownPill: document.getElementById('dates-shown-pill'),
    dateCascadeGrid: document.getElementById('date-cascade-grid'),
    playersShownPill: document.getElementById('players-shown-pill'),
    partyCascadeGrid: document.getElementById('party-cascade-grid'),

    // DM Setup
    dmCampaignTitle: document.getElementById('dm-campaign-title'),
    presetBtns: document.querySelectorAll('.btn-preset'),
    customDateInput: document.getElementById('custom-date-input'),
    customTimeInput: document.getElementById('custom-time-input'),
    addCustomDateBtn: document.getElementById('add-custom-date-btn'),
    dmDateList: document.getElementById('dm-date-list'),
    copyCampaignLinkBtn: document.getElementById('copy-campaign-link-btn'),
    copySavageInviteBtn: document.getElementById('copy-savage-invite-btn'),
    importResponseInput: document.getElementById('import-response-input'),
    importResponseBtn: document.getElementById('import-response-btn'),
    resetDemoBtn: document.getElementById('reset-demo-btn'),
    clearPlayersBtn: document.getElementById('clear-players-btn'),

    // Modals
    detailModal: document.getElementById('detail-modal'),
    detailModalClose: document.getElementById('detail-modal-close'),
    detailModalBody: document.getElementById('detail-modal-body'),
    roastModal: document.getElementById('roast-modal'),
    roastModalMessage: document.getElementById('roast-modal-message'),
    roastModalDismiss: document.getElementById('roast-modal-dismiss'),
    inviteModal: document.getElementById('invite-modal'),
    inviteModalClose: document.getElementById('invite-modal-close'),
    inviteModalUrl: document.getElementById('invite-modal-url'),
    inviteModalText: document.getElementById('invite-modal-text'),
    inviteCopyUrlBtn: document.getElementById('invite-copy-url-btn'),
    inviteCopyMsgBtn: document.getElementById('invite-copy-msg-btn'),

    toastContainer: document.getElementById('toast-container'),
    confettiLayer: document.getElementById('confetti-layer')
  };

  // --------------------------------------------------------------------------
  // 9. Rendering
  // --------------------------------------------------------------------------
  function renderAll() {
    renderHeader();
    renderNav();
    renderCheckIn();
    renderGrid();
    renderDMControl();
  }

  function renderHeader() {
    const camp = getActiveCampaign();
    els.gridCountBadge.textContent = String(camp.players.length);
    els.howItWorksCard.classList.toggle('hidden', state.hideHowItWorks);
    els.howItWorksBtn.classList.toggle('is-active', !state.hideHowItWorks);
  }

  function renderNav() {
    Object.entries(els.views).forEach(([key, panel]) => {
      panel.classList.toggle('active', key === state.activeView);
    });
    els.navTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.view === state.activeView);
    });
    els.bottomTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.view === state.activeView);
    });
  }

  function renderCheckIn() {
    const camp = getActiveCampaign();
    const dates = camp.dates;

    els.checkinCampaignTitle.textContent = camp.title;

    if (document.activeElement !== els.playerNameInput) {
      els.playerNameInput.value = state.currentPlayer.name || '';
    }
    els.playerHostingSelect.value = state.currentPlayer.hosting || '🏠 Can Host';

    if (dates.length === 0) {
      els.checkinDeckArea.classList.add('hidden');
      els.checkinCompleteCard.classList.remove('hidden');
      els.playerSummaryChips.innerHTML = '<span class="summary-chip maybe">No dates yet — add dates in DM Setup.</span>';
      return;
    }

    if (state.deckIndex >= dates.length) state.deckIndex = dates.length - 1;
    if (state.deckIndex < 0) state.deckIndex = 0;

    if (state.checkinCompleted) {
      els.checkinDeckArea.classList.add('hidden');
      els.checkinCompleteCard.classList.remove('hidden');
      renderCompletionSummary();
      return;
    }

    els.checkinCompleteCard.classList.add('hidden');
    els.checkinDeckArea.classList.remove('hidden');
    renderSingleDateCard();
  }

  function renderSingleDateCard() {
    const camp = getActiveCampaign();
    const dates = camp.dates;
    const dt = dates[state.deckIndex];
    const votes = state.currentPlayer.votes || {};
    const answeredCount = dates.filter((d) => Boolean(votes[d.id])).length;

    els.deckProgressLabel.textContent = `Date ${state.deckIndex + 1} of ${dates.length}`;
    els.deckProgressFill.style.width = `${Math.round((answeredCount / dates.length) * 100)}%`;

    els.cardWeekday.textContent = dt.weekday || 'SESSION';
    els.cardDateMain.textContent = `${dt.label} • ${dt.time}`;

    const stats = getDateStats(camp, dt.id);
    els.cardPartyPulse.innerHTML = `<span>🔥 <strong>${stats.dtf}</strong> DTF</span><span>•</span><span>🎲 <strong>${stats.maybe}</strong> Maybe</span>`;

    const myVote = votes[dt.id];
    els.verdictButtons.forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.vote === myVote);
    });

    if (myVote === 'dtf') els.currentVoteIndicator.textContent = 'Picked: 🔥 DTF';
    else if (myVote === 'maybe') els.currentVoteIndicator.textContent = 'Picked: 🎲 Maybe';
    else if (myVote === 'pass') els.currentVoteIndicator.textContent = 'Picked: 💀 Pass';
    else els.currentVoteIndicator.textContent = 'Tap 1 of 3';

    els.prevCardBtn.disabled = state.deckIndex === 0;
    els.nextCardBtn.textContent = state.deckIndex === dates.length - 1 ? 'Finish ➡️' : 'Skip ➡️';
  }

  function renderCompletionSummary() {
    const camp = getActiveCampaign();
    const votes = state.currentPlayer.votes || {};
    els.playerSummaryChips.innerHTML = camp.dates
      .map((dt) => {
        const rawVote = votes[dt.id];
        const v = VALID_VOTES.has(rawVote) ? rawVote : 'pass';
        const icon = v === 'dtf' ? '🔥' : v === 'maybe' ? '🎲' : '💀';
        return `<span class="summary-chip ${v}">${icon} ${escapeHtml(dt.label)}</span>`;
      })
      .join('');
  }

  // --------------------------------------------------------------------------
  // 10. Grid Rendering
  // --------------------------------------------------------------------------
  function getDateStats(camp, dateId) {
    let dtf = 0;
    let maybe = 0;
    let pass = 0;
    let pending = 0;
    const dtfPlayers = [];
    const maybePlayers = [];
    const passPlayers = [];
    const pendingPlayers = [];

    camp.players.forEach((p) => {
      const v = p.votes ? p.votes[dateId] : undefined;
      if (v === 'dtf') {
        dtf++;
        dtfPlayers.push(p);
      } else if (v === 'maybe') {
        maybe++;
        maybePlayers.push(p);
      } else if (v === 'pass') {
        pass++;
        passPlayers.push(p);
      } else {
        pending++;
        pendingPlayers.push(p);
      }
    });

    const total = Math.max(camp.players.length, 1);
    const pct = Math.round((dtf / total) * 100);
    const isMatch = dtf >= Math.min(camp.quorum || 4, total);

    return { dtf, maybe, pass, pending, pct, isMatch, dtfPlayers, maybePlayers, passPlayers, pendingPlayers };
  }

  function renderGrid() {
    const camp = getActiveCampaign();
    const scoredDates = camp.dates.map((dt) => ({ dt, stats: getDateStats(camp, dt.id) }));
    scoredDates.sort((a, b) => b.stats.dtf - a.stats.dtf || b.stats.maybe - a.stats.maybe);
    const best = scoredDates[0];

    if (best && camp.players.length > 0) {
      const { dt, stats } = best;
      els.bestMatchBanner.innerHTML = `
        <div class="best-match-info">
          <div class="best-match-kicker">${stats.isMatch ? '🔥 TOP MATCH' : '⚡ LEADING DATE'}</div>
          <h2>${escapeHtml(dt.weekday)} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</h2>
          <p class="best-match-sub"><strong>${stats.dtf}/${camp.players.length}</strong> 🔥 DTF • <strong>${stats.maybe}</strong> 🎲 Maybe</p>
        </div>
        <button type="button" class="btn-amber-sm" id="lock-in-verdict-btn">🎉 Copy Verdict</button>
      `;

      const lockBtn = document.getElementById('lock-in-verdict-btn');
      if (lockBtn) {
        lockBtn.addEventListener('click', () => {
          triggerConfetti();
          playCritFanfare();
          const dtfNames = stats.dtfPlayers.map((p) => p.name).join(', ') || 'None yet';
          const text = `⚔️ ${camp.title} — WINNING NIGHT: ${dt.weekday}, ${dt.label} at ${dt.time}\n🔥 Confirmed (${stats.dtf}): ${dtfNames}`;
          copyText(text, '🎉 Winning night copied!');
        });
      }
    } else {
      els.bestMatchBanner.innerHTML = `
        <div class="best-match-info">
          <div class="best-match-kicker">🟨 THE GRID</div>
          <h2>Waiting for Player Replies</h2>
          <p class="best-match-sub">Tap through Check-In or share your Invite Link from <b>👑 DM Setup</b>.</p>
        </div>
      `;
    }

    // Dates Grid
    els.datesShownPill.textContent = `${camp.dates.length}`;
    if (camp.dates.length === 0) {
      els.dateCascadeGrid.innerHTML = `<div class="empty-grid-state">No dates yet. Add dates in <strong>DM Setup</strong>.</div>`;
    } else {
      els.dateCascadeGrid.innerHTML = camp.dates
        .map((dt) => {
          const st = getDateStats(camp, dt.id);
          const bgTone = st.isMatch
            ? 'radial-gradient(circle at 50% 35%, rgba(255,184,0,0.28), rgba(20,20,28,0.96))'
            : 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.05), rgba(16,16,22,0.98))';
          return `
            <article class="grid-tile ${st.isMatch ? 'is-match' : ''}" data-date-detail="${escapeHtml(dt.id)}" tabindex="0" role="button">
              <div class="date-tile-bg" style="background: ${bgTone};">
                <div class="date-tile-day">${escapeHtml(dt.weekday.slice(0, 3))}</div>
                <div class="date-tile-label">${escapeHtml(dt.label)}</div>
                <div class="date-tile-time">${escapeHtml(dt.time)}</div>
              </div>
              ${st.isMatch ? '<div class="tile-top-badge"><span class="match-badge">MATCH</span></div>' : ''}
              <div class="tile-scrim">
                <div class="tile-title-row">
                  <span class="${st.dtf > 0 ? 'online-dot-sm' : 'offline-dot-sm'}"></span>
                  <span>🔥 ${st.dtf}/${camp.players.length} DTF</span>
                </div>
              </div>
            </article>
          `;
        })
        .join('');

      els.dateCascadeGrid.querySelectorAll('[data-date-detail]').forEach((tile) => {
        tile.addEventListener('click', () => openDateDetailModal(tile.dataset.dateDetail));
      });
    }

    // Party Grid
    els.playersShownPill.textContent = `${camp.players.length}`;
    if (camp.players.length === 0) {
      els.partyCascadeGrid.innerHTML = `<div class="empty-grid-state">No players added yet. Share your Invite Link or check in!</div>`;
    } else {
      els.partyCascadeGrid.innerHTML = camp.players
        .map((p) => {
          const votes = p.votes || {};
          const dtfCount = camp.dates.filter((d) => votes[d.id] === 'dtf').length;
          return `
            <article class="grid-tile" data-player-detail="${escapeHtml(p.id)}">
              <div class="player-avatar-wrap">
                ${getClassPortraitSvg(p.classVibe, p.name)}
              </div>
              <div class="tile-scrim">
                <div class="tile-title-row">
                  <span class="${p.online ? 'online-dot-sm' : 'offline-dot-sm'}"></span>
                  <span>${escapeHtml(p.name)}</span>
                </div>
                <div class="tile-sub">${escapeHtml(p.hosting)} • ${dtfCount} DTF</div>
                <button type="button" class="tap-tile-btn" data-tap-player="${escapeHtml(p.id)}">
                  🔥 Tap (${p.taps || 0})
                </button>
              </div>
            </article>
          `;
        })
        .join('');

      els.partyCascadeGrid.querySelectorAll('[data-player-detail]').forEach((tile) => {
        tile.addEventListener('click', (e) => {
          if (e.target.closest('[data-tap-player]')) return;
          openPlayerDetailModal(tile.dataset.playerDetail);
        });
      });

      els.partyCascadeGrid.querySelectorAll('[data-tap-player]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          sendTapToPlayer(btn.dataset.tapPlayer, btn);
        });
      });
    }
  }

  // --------------------------------------------------------------------------
  // 11. DM Setup Rendering
  // --------------------------------------------------------------------------
  function renderDMControl() {
    const camp = getActiveCampaign();
    if (document.activeElement !== els.dmCampaignTitle) {
      els.dmCampaignTitle.value = camp.title;
    }

    els.dmDateList.innerHTML = camp.dates.length
      ? camp.dates
          .map(
            (dt) => `
          <div class="dm-date-item">
            <strong>${escapeHtml(dt.weekday.slice(0, 3))} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</strong>
            <button type="button" class="btn-danger-sm" data-remove-date="${escapeHtml(dt.id)}" aria-label="Remove date">✕</button>
          </div>
        `
          )
          .join('')
      : '<div style="color:var(--text-muted);font-size:0.84rem;">No dates yet — pick a preset above!</div>';

    els.dmDateList.querySelectorAll('[data-remove-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        camp.dates = camp.dates.filter((d) => d.id !== btn.dataset.removeDate);
        saveState();
        renderAll();
      });
    });
  }

  // --------------------------------------------------------------------------
  // 12. Modals
  // --------------------------------------------------------------------------
  function openPlayerDetailModal(playerId) {
    const camp = getActiveCampaign();
    const p = camp.players.find((x) => x.id === playerId);
    if (!p) return;

    const breakdown = camp.dates
      .map((dt) => {
        const v = p.votes ? p.votes[dt.id] : undefined;
        const badge =
          v === 'dtf'
            ? '<span class="vote-pill dtf">🔥 DTF</span>'
            : v === 'maybe'
            ? '<span class="vote-pill maybe">🎲 Maybe</span>'
            : v === 'pass'
            ? '<span class="vote-pill pass">💀 Pass</span>'
            : '<span class="vote-pill none">⏳ Pending</span>';
        return `
          <div class="breakdown-row">
            <span><strong>${escapeHtml(dt.label)}</strong> (${escapeHtml(dt.weekday.slice(0, 3))} ${escapeHtml(dt.time)})</span>
            ${badge}
          </div>
        `;
      })
      .join('');

    els.detailModalBody.innerHTML = `
      <div class="detail-hero">
        <div class="detail-avatar-box">${getClassPortraitSvg(p.classVibe, p.name)}</div>
        <div>
          <h2 id="detail-modal-title" class="section-title">${escapeHtml(p.name)}</h2>
          <div style="font-size:0.85rem;color:var(--amber);font-weight:700;">${escapeHtml(p.hosting)}</div>
        </div>
      </div>

      <div class="breakdown-list">${breakdown}</div>

      <div class="btn-row">
        <button type="button" class="btn-amber" id="modal-send-tap-btn">🔥 Tap (${p.taps || 0})</button>
        <button type="button" class="btn-secondary" id="modal-copy-nudge-btn">📋 Copy Nudge</button>
      </div>
    `;

    document.getElementById('modal-send-tap-btn').addEventListener('click', () => {
      sendTapToPlayer(p.id);
      openPlayerDetailModal(p.id);
    });

    document.getElementById('modal-copy-nudge-btn').addEventListener('click', () => {
      const url = buildCampaignShareUrl(camp);
      const msg = `Hey ${p.name} 👀 You got tapped on Schedulr for "${camp.title}". Tap DTF / Maybe / Pass here: ${url}`;
      copyText(msg, `📋 Nudge copied for ${p.name}!`);
    });

    els.detailModal.classList.remove('hidden');
  }

  function openDateDetailModal(dateId) {
    const camp = getActiveCampaign();
    const dt = camp.dates.find((d) => d.id === dateId);
    if (!dt) return;

    const st = getDateStats(camp, dt.id);
    const listPlayers = (arr, pillClass, label) =>
      arr
        .map(
          (p) => `
        <div class="breakdown-row">
          <span><strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.hosting)})</span>
          <span class="vote-pill ${pillClass}">${label}</span>
        </div>`
        )
        .join('');

    els.detailModalBody.innerHTML = `
      <h2 id="detail-modal-title" class="section-title">${escapeHtml(dt.weekday)} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</h2>
      <p class="section-subtitle">${st.dtf}/${camp.players.length} DTF • ${st.maybe} Maybe</p>

      <div class="breakdown-list">
        ${listPlayers(st.dtfPlayers, 'dtf', '🔥 DTF')}
        ${listPlayers(st.maybePlayers, 'maybe', '🎲 Maybe')}
        ${listPlayers(st.passPlayers, 'pass', '💀 Pass')}
        ${listPlayers(st.pendingPlayers, 'none', '⏳ Pending')}
      </div>

      <div class="btn-row">
        <button type="button" class="btn-amber" id="date-modal-lock-btn">🎉 Copy Date Verdict</button>
      </div>
    `;

    document.getElementById('date-modal-lock-btn').addEventListener('click', () => {
      const names = st.dtfPlayers.map((p) => p.name).join(', ') || 'Nobody yet';
      copyText(
        `📅 ${camp.title} — ${dt.weekday} ${dt.label} @ ${dt.time}\n🔥 Confirmed (${st.dtf}): ${names}`,
        '📋 Date verdict copied!'
      );
    });

    els.detailModal.classList.remove('hidden');
  }

  function sendTapToPlayer(playerId, btnEl) {
    const camp = getActiveCampaign();
    const p = camp.players.find((x) => x.id === playerId);
    if (!p) return;
    p.taps = (p.taps || 0) + 1;
    saveState();
    playTapFlameSound();

    if (btnEl) {
      btnEl.textContent = `🔥 Tap (${p.taps})`;
      btnEl.classList.remove('tapped-flash');
      void btnEl.offsetWidth;
      btnEl.classList.add('tapped-flash');
    }

    showToast(`🔥 Tapped ${p.name}!`, 'success');
  }

  function triggerRoastModal() {
    const roast = ANTI_ESSAY_ROASTS[Math.floor(Math.random() * ANTI_ESSAY_ROASTS.length)];
    els.roastModalMessage.textContent = roast;
    els.roastModal.classList.remove('hidden');

    els.antiEssayForm.classList.remove('shake');
    void els.antiEssayForm.offsetWidth;
    els.antiEssayForm.classList.add('shake');

    els.antiEssayInput.value = '';
    els.antiEssayInput.blur();
    playBuzzerSound();
  }

  function openInviteModal() {
    const camp = getActiveCampaign();
    const url = buildCampaignShareUrl(camp);
    const savageMsg = `No more 20-text scheduling chaos ⚔️\nOpen this link, tap 🔥 DTF / 🎲 Maybe / 💀 Pass for "${camp.title}", and send back your Reply Link:\n${url}`;

    els.inviteModalUrl.value = url;
    els.inviteModalText.value = savageMsg;
    els.inviteModal.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // 13. Check-In Voting
  // --------------------------------------------------------------------------
  function syncCurrentPlayerMeta() {
    const name = cleanString(els.playerNameInput.value, 28, '');
    const hosting = VALID_HOSTING.has(els.playerHostingSelect.value) ? els.playerHostingSelect.value : '🏠 Can Host';
    state.currentPlayer.name = els.playerNameInput.value;
    state.currentPlayer.hosting = hosting;
    state.currentPlayer.classVibe = deriveClassVibe(name, hosting);
    saveState();
  }

  function castVoteForDate(dateId, vote, advanceDeck = true) {
    if (!VALID_VOTES.has(vote)) return;
    const safeDateId = cleanId(dateId, '');
    if (!safeDateId) return;

    syncCurrentPlayerMeta();
    if (!state.currentPlayer.votes) state.currentPlayer.votes = {};
    state.currentPlayer.votes[safeDateId] = vote;

    if (vote === 'dtf') playTapFlameSound();
    else playTone(380, 0.06, 'sine', 0.05);

    const camp = getActiveCampaign();
    const displayName = cleanString(state.currentPlayer.name, 28, 'You (Guest)');
    upsertPlayerInCampaign(camp, {
      id: state.currentPlayer.id,
      name: displayName,
      classVibe: deriveClassVibe(displayName, state.currentPlayer.hosting),
      hosting: state.currentPlayer.hosting,
      online: true,
      taps: 1,
      votes: { ...state.currentPlayer.votes }
    });

    if (advanceDeck) {
      if (state.deckIndex < camp.dates.length - 1) {
        state.deckIndex += 1;
        els.activeDateCard.classList.remove('card-pop');
        void els.activeDateCard.offsetWidth;
        els.activeDateCard.classList.add('card-pop');
      } else {
        completeCheckIn();
        return;
      }
    }

    saveState();
    renderAll();
  }

  function completeCheckIn() {
    syncCurrentPlayerMeta();
    state.checkinCompleted = true;
    saveState();
    renderAll();
    triggerConfetti();
    playCritFanfare();
    showToast('🎉 Answers locked! Send your Reply Link to the DM.', 'success');
  }

  function buildPlainSummaryMessage() {
    const camp = getActiveCampaign();
    const votes = state.currentPlayer.votes || {};
    const name = cleanString(state.currentPlayer.name, 28, 'Party Member');
    const replyUrl = buildPlayerResponseUrl();
    const dtfList = camp.dates.filter((d) => votes[d.id] === 'dtf').map((d) => `${d.label} (${d.time})`).join(', ') || 'None';
    const maybeList = camp.dates.filter((d) => votes[d.id] === 'maybe').map((d) => `${d.label} (${d.time})`).join(', ') || 'None';

    return `🎲 ${name} (${state.currentPlayer.hosting}) — "${camp.title}"\n🔥 DTF: ${dtfList}\n🎲 Maybe: ${maybeList}\n\nOpen this Reply Link to add me to The Grid:\n${replyUrl}`;
  }

  // --------------------------------------------------------------------------
  // 14. Utilities
  // --------------------------------------------------------------------------
  function copyText(text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast(successMsg, 'success'))
        .catch(() => fallbackCopy(text, successMsg));
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(successMsg, 'success');
    } catch {
      showToast('Copy failed — please copy manually.', 'danger');
    }
    document.body.removeChild(ta);
  }

  function showToast(msg, variant = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast ${variant === 'success' ? 'toast-success' : variant === 'danger' ? 'toast-danger' : ''}`;
    toast.textContent = msg;
    els.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function triggerConfetti() {
    const colors = ['#ffb800', '#ff5500', '#00e676', '#b388ff', '#ffffff'];
    for (let i = 0; i < 36; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 1.3 + Math.random() * 1 + 's';
      piece.style.animationDelay = Math.random() * 0.2 + 's';
      els.confettiLayer.appendChild(piece);
      setTimeout(() => piece.remove(), 2400);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --------------------------------------------------------------------------
  // 15. Event Wiring
  // --------------------------------------------------------------------------
  function wireEvents() {
    const switchView = (view) => {
      if (!VALID_VIEWS.has(view)) return;
      state.activeView = view;
      saveState();
      renderNav();
      if (view === 'grid') renderGrid();
      if (view === 'dm') renderDMControl();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    els.navTabs.forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
    els.bottomTabs.forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
    document.getElementById('brand-home-btn').addEventListener('click', () => switchView('grid'));

    els.howItWorksBtn.addEventListener('click', () => {
      state.hideHowItWorks = !state.hideHowItWorks;
      saveState();
      renderHeader();
    });

    els.closeHowBtn.addEventListener('click', () => {
      state.hideHowItWorks = true;
      saveState();
      renderHeader();
    });

    els.headerInviteBtn.addEventListener('click', openInviteModal);

    [els.playerNameInput, els.playerHostingSelect].forEach((input) => {
      input.addEventListener('input', syncCurrentPlayerMeta);
      input.addEventListener('change', syncCurrentPlayerMeta);
    });

    els.verdictButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const camp = getActiveCampaign();
        const dt = camp.dates[state.deckIndex];
        if (dt) castVoteForDate(dt.id, btn.dataset.vote, true);
      });
    });

    els.prevCardBtn.addEventListener('click', () => {
      if (state.deckIndex > 0) {
        state.deckIndex -= 1;
        saveState();
        renderCheckIn();
      }
    });

    els.nextCardBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      if (state.deckIndex < camp.dates.length - 1) {
        state.deckIndex += 1;
        saveState();
        renderCheckIn();
      } else {
        completeCheckIn();
      }
    });

    els.copyResponseLinkBtn.addEventListener('click', () => {
      copyText(buildPlayerResponseUrl(), '🔗 Reply Link copied! Send it to your DM.');
    });

    els.copyResponseCodeBtn.addEventListener('click', () => {
      copyText(buildPlainSummaryMessage(), '💬 Summary + Reply Link copied!');
    });

    els.gotoGridBtn.addEventListener('click', () => switchView('grid'));
    els.editAnswersBtn.addEventListener('click', () => {
      state.checkinCompleted = false;
      state.deckIndex = 0;
      saveState();
      renderCheckIn();
    });

    els.antiEssayInput.addEventListener('input', () => {
      if (els.antiEssayInput.value.length >= 16) {
        triggerRoastModal();
      }
    });

    els.antiEssayForm.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerRoastModal();
    });

    els.roastModalDismiss.addEventListener('click', () => {
      els.roastModal.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        els.detailModal.classList.add('hidden');
        els.roastModal.classList.add('hidden');
        els.inviteModal.classList.add('hidden');
        return;
      }
      if (state.activeView !== 'checkin' || state.checkinCompleted) return;
      const camp = getActiveCampaign();
      const dt = camp.dates[state.deckIndex];
      if (!dt) return;
      if (e.key === '1') castVoteForDate(dt.id, 'dtf', true);
      else if (e.key === '2') castVoteForDate(dt.id, 'maybe', true);
      else if (e.key === '3') castVoteForDate(dt.id, 'pass', true);
      else if (e.key === 'ArrowLeft') els.prevCardBtn.click();
      else if (e.key === 'ArrowRight') els.nextCardBtn.click();
    });

    els.dmCampaignTitle.addEventListener('input', () => {
      const camp = getActiveCampaign();
      camp.title = cleanString(els.dmCampaignTitle.value, 48, 'My D&D Campaign');
      saveState();
      renderCheckIn();
    });

    els.presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const camp = getActiveCampaign();
        camp.dates = generatePresetDates(btn.dataset.preset);
        state.deckIndex = 0;
        state.checkinCompleted = false;
        saveState();
        renderAll();
        showToast(`🎄 Loaded ${btn.textContent.trim()} dates!`, 'success');
      });
    });

    els.addCustomDateBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      if (camp.dates.length >= MAX_DATES) {
        showToast(`Maximum of ${MAX_DATES} dates reached.`, 'danger');
        return;
      }
      const rawDate = els.customDateInput.value;
      const rawTime = cleanString(els.customTimeInput.value, 20, '7:00 PM');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        showToast('Pick a valid date first!', 'danger');
        return;
      }
      const parsed = new Date(rawDate + 'T12:00:00');
      const label = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekday = parsed.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
      camp.dates.push({
        id: 'd-' + Date.now().toString(36),
        date: rawDate,
        label,
        weekday,
        time: rawTime,
        holiday: false
      });
      saveState();
      renderAll();
      showToast(`➕ Added ${label} @ ${rawTime}`, 'success');
    });

    els.copyCampaignLinkBtn.addEventListener('click', () => {
      copyText(buildCampaignShareUrl(getActiveCampaign()), '🔗 Invite Link copied!');
    });

    els.copySavageInviteBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      const url = buildCampaignShareUrl(camp);
      const msg = `No more 20-text scheduling chaos ⚔️\nOpen this link, tap 🔥 DTF / 🎲 Maybe / 💀 Pass for "${camp.title}", and send back your Reply Link:\n${url}`;
      copyText(msg, '💬 Group text copied!');
    });

    els.importResponseBtn.addEventListener('click', () => {
      const val = els.importResponseInput.value;
      if (importResponseToken(val, false)) {
        els.importResponseInput.value = '';
        switchView('grid');
      }
    });

    els.clearPlayersBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      camp.players = [];
      camp.id = 'camp-' + Math.random().toString(36).slice(2, 8);
      if (camp.title === 'Holiday D&D Gauntlet') {
        camp.title = 'My D&D Campaign';
      }
      state.currentPlayer.votes = {};
      state.deckIndex = 0;
      state.checkinCompleted = false;
      saveState();
      renderAll();
      showToast('🧹 Sample party cleared! Set your dates & send your Invite Link.', 'success');
    });

    els.resetDemoBtn.addEventListener('click', () => {
      state.campaign = createSampleCampaign();
      state.deckIndex = 0;
      state.checkinCompleted = false;
      saveState();
      renderAll();
      showToast('🎭 Sample party loaded!', 'success');
    });

    els.detailModalClose.addEventListener('click', () => els.detailModal.classList.add('hidden'));
    els.detailModal.addEventListener('click', (e) => {
      if (e.target === els.detailModal) els.detailModal.classList.add('hidden');
    });

    els.inviteModalClose.addEventListener('click', () => els.inviteModal.classList.add('hidden'));
    els.inviteModal.addEventListener('click', (e) => {
      if (e.target === els.inviteModal) els.inviteModal.classList.add('hidden');
    });
    els.inviteCopyUrlBtn.addEventListener('click', () => {
      copyText(els.inviteModalUrl.value, '🔗 Invite Link copied!');
    });
    els.inviteCopyMsgBtn.addEventListener('click', () => {
      copyText(els.inviteModalText.value, '💬 Group text copied!');
    });
  }

  // --------------------------------------------------------------------------
  // 16. Boot
  // --------------------------------------------------------------------------
  function init() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    if (els.customDateInput) {
      els.customDateInput.value = tomorrow.toISOString().slice(0, 10);
    }

    applyIncomingUrlParams();
    wireEvents();
    renderAll();
  }

  init();
})();
