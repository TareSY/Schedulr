/* ==========================================================================
   Schedulr (GrinDM Edition) — Straight Answers Only D&D Session Scheduler
   100% Static Client-Side App (GitHub Pages Ready)
   ========================================================================== */

(() => {
  'use strict';

  const STORAGE_KEY = 'grindm_state_v1';

  // --------------------------------------------------------------------------
  // Security & Input Sanitization Layer
  // --------------------------------------------------------------------------
  const MAX_TOKEN_LENGTH = 8192;
  const MAX_DATES = 24;
  const MAX_PLAYERS = 30;
  const VALID_VOTES = new Set(['dtf', 'maybe', 'pass']);
  const VALID_HOSTING = new Set(['🏠 Can Host', '🚗 Can Travel', '💻 Remote/VTT', '🍕 Brings Snacks']);
  const VALID_VIEWS = new Set(['checkin', 'grid', 'dm']);
  const VALID_FILTERS = new Set(['all', 'dtf', 'host', 'holiday', 'needs-tap']);

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
      note: cleanString(raw && raw.note, 80, 'Session Check-In'),
      holiday: Boolean(raw && raw.holiday),
      distance: cleanString(raw && raw.distance, 24, `${((idx + 1) * 0.3).toFixed(1)} mi away`)
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
      bio: cleanString(raw.bio, 120, 'Checked in via Schedulr.'),
      distance: cleanString(raw.distance, 24, '0.5 mi away'),
      online: raw.online !== false,
      initiative: cleanString(raw.initiative, 8, '+3'),
      flakeRate: cleanString(raw.flakeRate, 16, '0%'),
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
      dmName: cleanString(raw.dmName, 28, fallbackCamp.dmName),
      quorum: Number.isFinite(quorumNum) ? Math.max(2, Math.min(12, Math.floor(quorumNum))) : fallbackCamp.quorum,
      duration: cleanString(raw.duration, 48, fallbackCamp.duration),
      dates: rawDates.map((dt, idx) => sanitizeDateEntry(dt, idx)),
      players: rawPlayers.map((p) => sanitizePlayer(p)).filter(Boolean)
    };
  }

  // --------------------------------------------------------------------------
  // 1. Comedy Copy, Anti-Essay Roasts & Class Metadata
  // --------------------------------------------------------------------------
  const ANTI_ESSAY_ROASTS = [
    "Nice 4-paragraph monologue, Bard, but nobody asked about your cousin's dog's dentist appointment. Tap 🔥 DTF, 🎲 Disadvantage, or 💀 Hard Pass.",
    "We are NOT doing 'it depends on traffic and Mercury retrograde' tonight. Give Dungeon Daddy Serge a straight answer.",
    "20 texts over 6 hours ends TODAY. Your essay has been incinerated by a Level 9 Fireball. Pick one of the 3 buttons.",
    "Save the lore dump for the campaign recap. Right now all we need is a Yes, Maybe, or Hard Pass.",
    "You just rolled a Natural 1 on Following Simple Directions. Tap a glowing button instead of writing a novel.",
    "Sir/Ma'am, this is Schedulr, not AO3. Three buttons. Two seconds. Do not make us send a Tap.",
    "Every time someone types 'I might be free around 7:45ish maybe', a baby Beholder cries. Click a button!",
    "TL;DR detected! Convert your emotional availability into 🔥 DTF, 🎲 Disadvantage, or 💀 Hard Pass immediately.",
    "Your Patron says stop stalling in the group chat. Commit to a square on The Grid.",
    "This text box is a Mimic! It just ate your excuses. Use the big glowing buttons above."
  ];

  const CLASS_META = {
    'Paladin (Host)': { emoji: '🛡️', grad: ['#2b1d05', '#ffb800', '#ff6b00'], role: 'Tank / Snack Police' },
    'Rogue (Always Late)': { emoji: '🗡️', grad: ['#161124', '#8e2de2', '#ff3366'], role: 'Sneak Attack / 22m Late' },
    'Bard (Brings Drinks)': { emoji: '🪕', grad: ['#240e24', '#ff5500', '#ffb800'], role: 'Moral Support / Charisma' },
    'Warlock (Ask My Patron)': { emoji: '👁️', grad: ['#120b24', '#6c38ff', '#00e676'], role: 'Eldritch Blaster' },
    'Wizard (VTT Only)': { emoji: '🧙', grad: ['#091c2e', '#00b4d8', '#b388ff'], role: 'Rules Lawyer / Fireball' },
    'Barbarian (Down to Roll)': { emoji: '🪓', grad: ['#29090d', '#ff3366', '#ff8800'], role: 'Frontline Gremlin' }
  };

  // --------------------------------------------------------------------------
  // 2. Demo Campaign ("Serge's Holiday D&D Gauntlet") & Custom Default
  // --------------------------------------------------------------------------
  function createDemoCampaign() {
    return {
      id: 'serge-holiday-2026',
      title: "Serge's Holiday D&D Gauntlet",
      dmName: 'Dungeon Daddy Serge',
      quorum: 4,
      duration: '4 Hours (Standard Tavern Crawl)',
      dates: [
        { id: 'd1', date: '2026-11-28', label: 'Nov 28', weekday: 'SATURDAY', time: '7:00 PM', note: 'Post-Thanksgiving Leftovers Crawl', holiday: true, distance: '0.2 mi away' },
        { id: 'd2', date: '2026-12-05', label: 'Dec 5', weekday: 'SATURDAY', time: '7:00 PM', note: 'Winter Solstice Tavern Ambush', holiday: true, distance: '0.4 mi away' },
        { id: 'd3', date: '2026-12-12', label: 'Dec 12', weekday: 'SATURDAY', time: '2:00 PM', note: 'Matinee Dungeon Delve (Bring Eggnog)', holiday: true, distance: '0.8 mi away' },
        { id: 'd4', date: '2026-12-19', label: 'Dec 19', weekday: 'SATURDAY', time: '7:00 PM', note: 'Holiday Boss Gauntlet (4hr+)', holiday: true, distance: 'In the Tavern' },
        { id: 'd5', date: '2026-12-27', label: 'Dec 27', weekday: 'SUNDAY', time: '5:00 PM', note: 'Post-Christmas Chaos One-Shot', holiday: true, distance: '1.1 mi away' },
        { id: 'd6', date: '2027-01-02', label: 'Jan 2', weekday: 'SATURDAY', time: '7:00 PM', note: 'New Year Hangover Recovery Session', holiday: true, distance: '0.3 mi away' }
      ],
      players: [
        {
          id: 'p-serge',
          name: 'Dungeon Daddy Serge',
          classVibe: 'Paladin (Host)',
          hosting: '🏠 Can Host',
          bio: 'Prepped 14 maps and 3 voices. If you write a paragraph instead of tapping, rocks fall.',
          distance: 'In the Tavern',
          online: true,
          initiative: '+5',
          flakeRate: '0% (DM)',
          taps: 4,
          votes: { d1: 'dtf', d2: 'dtf', d3: 'dtf', d4: 'dtf', d5: 'dtf', d6: 'dtf' }
        },
        {
          id: 'p-grog',
          name: 'Grog (Can Host)',
          classVibe: 'Barbarian (Down to Roll)',
          hosting: '🏠 Can Host',
          bio: 'Has giant dining table, 400 unpainted minis, and zero impulse control. Ready whenever.',
          distance: '20 ft away',
          online: true,
          initiative: '+3',
          flakeRate: '4%',
          taps: 7,
          votes: { d1: 'dtf', d2: 'maybe', d3: 'dtf', d4: 'dtf', d5: 'dtf', d6: 'maybe' }
        },
        {
          id: 'p-shadow',
          name: 'Shadowheart_Stan',
          classVibe: 'Bard (Brings Drinks)',
          hosting: '🍕 Brings Snacks',
          bio: 'Bringing spiced cider & questionable decisions. Will seduce the quest giver by 7:15pm.',
          distance: '0.4 mi away',
          online: true,
          initiative: '+4',
          flakeRate: '11%',
          taps: 5,
          votes: { d1: 'maybe', d2: 'dtf', d3: 'pass', d4: 'dtf', d5: 'dtf', d6: 'dtf' }
        },
        {
          id: 'p-astarion',
          name: "Astarion's Lawyer",
          classVibe: 'Wizard (VTT Only)',
          hosting: '💻 Remote/VTT',
          bio: 'Rules lawyer with cozy blankets. Down for Discord or couch if someone picks me up.',
          distance: '1.8 mi away',
          online: true,
          initiative: '+2',
          flakeRate: '18%',
          taps: 2,
          votes: { d1: 'dtf', d2: 'dtf', d3: 'maybe', d4: 'dtf', d5: 'pass', d6: 'dtf' }
        },
        {
          id: 'p-baelor',
          name: 'Baelor the Flake',
          classVibe: 'Rogue (Always Late)',
          hosting: '🚗 Can Travel',
          bio: 'Still typing a 6-paragraph text about traffic from 2024. Tap me until I click a button.',
          distance: '3.2 mi away',
          online: false,
          initiative: '-2',
          flakeRate: '74%',
          taps: 19,
          votes: { d1: 'pass', d2: 'maybe' }
        }
      ]
    };
  }

  function createBlankCustomCampaign() {
    const weekendDates = generatePresetDates('weekends');
    return {
      id: 'custom-' + Math.random().toString(36).slice(2, 8),
      title: 'My Holiday D&D Campaign',
      dmName: 'Dungeon Master',
      quorum: 4,
      duration: '4 Hours (Standard Tavern Crawl)',
      dates: weekendDates,
      players: []
    };
  }

  // --------------------------------------------------------------------------
  // 3. State Management
  // --------------------------------------------------------------------------
  const defaultState = {
    mode: 'demo', // 'demo' | 'custom'
    activeView: 'checkin', // 'checkin' | 'grid' | 'dm'
    activeFilter: 'all', // 'all' | 'dtf' | 'host' | 'holiday' | 'needs-tap'
    soundEnabled: true,
    excusesBlocked: 0,
    demoCampaign: createDemoCampaign(),
    customCampaign: createBlankCustomCampaign(),
    currentPlayer: {
      id: 'p-you-' + Math.random().toString(36).slice(2, 7),
      name: '',
      classVibe: 'Paladin (Host)',
      hosting: '🏠 Can Host',
      bio: '',
      votes: {}
    },
    deckIndex: 0,
    listMode: false,
    checkinCompleted: false
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || raw.length > 262144) return structuredCloneCompat(defaultState);
      const parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed !== 'object') return structuredCloneCompat(defaultState);

      const baseDemo = createDemoCampaign();
      const baseCustom = createBlankCustomCampaign();
      const cp = parsed.currentPlayer && typeof parsed.currentPlayer === 'object' ? parsed.currentPlayer : {};
      const cpClass = cleanString(cp.classVibe, 40, 'Paladin (Host)');
      const cpHosting = cleanString(cp.hosting, 30, '🏠 Can Host');

      return {
        mode: parsed.mode === 'custom' ? 'custom' : 'demo',
        activeView: VALID_VIEWS.has(parsed.activeView) ? parsed.activeView : 'checkin',
        activeFilter: VALID_FILTERS.has(parsed.activeFilter) ? parsed.activeFilter : 'all',
        soundEnabled: parsed.soundEnabled !== false,
        excusesBlocked: Math.max(0, Math.min(99999, Math.floor(Number(parsed.excusesBlocked) || 0))),
        demoCampaign: sanitizeCampaign(parsed.demoCampaign, baseDemo),
        customCampaign: sanitizeCampaign(parsed.customCampaign, baseCustom),
        currentPlayer: {
          id: cleanId(cp.id, defaultState.currentPlayer.id),
          name: cleanString(cp.name, 28, ''),
          classVibe: Object.prototype.hasOwnProperty.call(CLASS_META, cpClass) ? cpClass : 'Paladin (Host)',
          hosting: VALID_HOSTING.has(cpHosting) ? cpHosting : '🏠 Can Host',
          bio: cleanString(cp.bio, 80, ''),
          votes: cleanVoteMap(cp.votes)
        },
        deckIndex: Math.max(0, Math.floor(Number(parsed.deckIndex) || 0)),
        listMode: Boolean(parsed.listMode),
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
    return state.mode === 'demo' ? state.demoCampaign : state.customCampaign;
  }

  // --------------------------------------------------------------------------
  // 4. UTF-8 Safe Base64URL Codec (?c= and ?r= & SCHEDULR: / GRINDM:)
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
      dm: campaign.dmName,
      q: campaign.quorum,
      dur: campaign.duration,
      d: campaign.dates.map((dt) => [dt.id, dt.date, dt.label, dt.weekday, dt.time, dt.note || '', dt.holiday ? 1 : 0])
    };
    const base = window.location.origin + window.location.pathname;
    return `${base}?c=${encodePayload(payload)}`;
  }

  function buildPlayerResponseData() {
    const camp = getActiveCampaign();
    const p = state.currentPlayer;
    const payload = {
      v: 1,
      cid: camp.id,
      ct: camp.title,
      p: {
        id: p.id,
        n: (p.name || 'Mystery Adventurer').trim(),
        c: p.classVibe,
        h: p.hosting,
        b: (p.bio || 'Gave straight answers on Schedulr.').trim(),
        v: p.votes
      }
    };
    const encoded = encodePayload(payload);
    const base = window.location.origin + window.location.pathname;
    return {
      url: `${base}?r=${encoded}`,
      code: `SCHEDULR:${encoded}`,
      payload
    };
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
          const fallbackCamp = createBlankCustomCampaign();
          const rawCampaign = {
            id: decoded.id,
            title: decoded.t || 'Shared D&D Campaign',
            dmName: decoded.dm || 'Dungeon Master',
            quorum: decoded.q,
            duration: decoded.dur || '4 Hours',
            dates: decoded.d.slice(0, MAX_DATES).map((arr, idx) => {
              const safeArr = Array.isArray(arr) ? arr : [];
              return {
                id: safeArr[0],
                date: safeArr[1],
                label: safeArr[2],
                weekday: safeArr[3],
                time: safeArr[4],
                note: safeArr[5],
                holiday: Boolean(safeArr[6])
              };
            }),
            players: state.customCampaign.id === cleanId(decoded.id, '') ? state.customCampaign.players : []
          };
          state.mode = 'custom';
          state.customCampaign = sanitizeCampaign(rawCampaign, fallbackCamp);
          state.deckIndex = 0;
          state.checkinCompleted = false;
          state.activeView = 'checkin';
          saveState();
          showToast(`⚔️ Loaded "${state.customCampaign.title}"! Tap 3 buttons per date.`, 'success');
        }
      } catch {
        showToast('Could not parse campaign invite link.', 'danger');
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
      // Clean URL bar after importing so refreshes stay tidy
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  function importResponseToken(rawInput, fromUrl = false) {
    let token = typeof rawInput === 'string' ? rawInput.trim() : '';
    if (!token || token.length > MAX_TOKEN_LENGTH + 512) return false;

    try {
      if (token.includes('?r=') || token.includes('&r=')) {
        if (/^https?:\/\//i.test(token)) {
          const urlObj = new URL(token);
          token = urlObj.searchParams.get('r') || '';
        } else {
          const match = token.match(/[?&]r=([A-Za-z0-9\-_=]+)/);
          token = match ? match[1] : '';
        }
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

      // Match campaign if demo vs custom
      if (incomingCampaignId && incomingCampaignId === state.demoCampaign.id) {
        state.mode = 'demo';
      } else {
        state.mode = 'custom';
        if (incomingCampaignTitle && incomingCampaignId && state.customCampaign.id !== incomingCampaignId) {
          state.customCampaign.id = incomingCampaignId;
          state.customCampaign.title = incomingCampaignTitle;
        }
      }

      const camp = getActiveCampaign();
      const incomingPlayer = sanitizePlayer({
        id: data.p.id,
        name: data.p.n,
        classVibe: data.p.c,
        hosting: data.p.h,
        bio: data.p.b,
        distance: '0.5 mi away',
        online: true,
        initiative: '+4',
        flakeRate: '0%',
        taps: 1,
        votes: cleanVoteMap(data.p.v)
      });

      if (!incomingPlayer) {
        throw new Error('Invalid player data');
      }

      upsertPlayerInCampaign(camp, incomingPlayer);
      saveState();
      playCritFanfare();
      showToast(`🔥 Player Response Merged: ${incomingPlayer.name}!`, 'success');
      if (!fromUrl) {
        renderAll();
      }
      return true;
    } catch {
      showToast('❌ Invalid response code or link. Make sure it starts with SCHEDULR: or has ?r=...', 'danger');
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
  // 5. Web Audio API Synth FX (Zero external files)
  // --------------------------------------------------------------------------
  let audioCtx = null;

  function getAudioCtx() {
    if (!state.soundEnabled) return null;
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playTone(freq, duration = 0.09, type = 'triangle', gainVal = 0.08, delay = 0) {
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
    playTone(587.33, 0.08, 'sine', 0.09, 0);
    playTone(880, 0.14, 'triangle', 0.09, 0.06);
  }

  function playCritFanfare() {
    playTone(523.25, 0.1, 'triangle', 0.09, 0);
    playTone(659.25, 0.1, 'triangle', 0.09, 0.08);
    playTone(783.99, 0.12, 'triangle', 0.1, 0.16);
    playTone(1046.5, 0.25, 'sine', 0.11, 0.24);
  }

  function playBuzzerSound() {
    playTone(170, 0.16, 'sawtooth', 0.07, 0);
    playTone(130, 0.22, 'sawtooth', 0.07, 0.12);
  }

  // --------------------------------------------------------------------------
  // 6. Custom SVG Character Portrait Generator
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
        { id: 'tg1', date: '2026-11-25', label: 'Nov 25', weekday: 'WEDNESDAY', time: '7:30 PM', note: 'Pre-Turkey Eve Tavern Brawl', holiday: true, distance: '0.2 mi away' },
        { id: 'tg2', date: '2026-11-27', label: 'Nov 27', weekday: 'FRIDAY', time: '7:00 PM', note: 'Black Friday Boss Loot Run', holiday: true, distance: '0.4 mi away' },
        { id: 'tg3', date: '2026-11-28', label: 'Nov 28', weekday: 'SATURDAY', time: '2:00 PM', note: 'Saturday Afternoon Marathon', holiday: true, distance: '0.5 mi away' },
        { id: 'tg4', date: '2026-11-29', label: 'Nov 29', weekday: 'SUNDAY', time: '5:00 PM', note: 'Sunday Night Wrap-Up', holiday: true, distance: '0.9 mi away' }
      ],
      december: [
        { id: 'dc1', date: '2026-12-05', label: 'Dec 5', weekday: 'SATURDAY', time: '7:00 PM', note: 'Early Dec Campaign Push', holiday: true, distance: '0.3 mi away' },
        { id: 'dc2', date: '2026-12-11', label: 'Dec 11', weekday: 'FRIDAY', time: '7:30 PM', note: 'Friday Night Dice & Mulled Wine', holiday: true, distance: '0.6 mi away' },
        { id: 'dc3', date: '2026-12-12', label: 'Dec 12', weekday: 'SATURDAY', time: '6:00 PM', note: 'Holiday Feast + Mini Boss', holiday: true, distance: 'In the Tavern' },
        { id: 'dc4', date: '2026-12-19', label: 'Dec 19', weekday: 'SATURDAY', time: '7:00 PM', note: 'Last Weekend Before Chaos', holiday: true, distance: '0.4 mi away' },
        { id: 'dc5', date: '2026-12-20', label: 'Dec 20', weekday: 'SUNDAY', time: '4:00 PM', note: 'Cozy Sunday Dungeon Delve', holiday: true, distance: '1.2 mi away' }
      ],
      nye: [
        { id: 'ny1', date: '2026-12-27', label: 'Dec 27', weekday: 'SUNDAY', time: '5:00 PM', note: 'Post-Gift-Chaos Session', holiday: true, distance: '0.5 mi away' },
        { id: 'ny2', date: '2026-12-30', label: 'Dec 30', weekday: 'WEDNESDAY', time: '7:00 PM', note: 'NYE Eve One-Shot', holiday: true, distance: '0.3 mi away' },
        { id: 'ny3', date: '2026-12-31', label: 'Dec 31', weekday: 'THURSDAY', time: '8:00 PM', note: 'Ball-Drop BBEG Showdown', holiday: true, distance: 'In the Tavern' },
        { id: 'ny4', date: '2027-01-02', label: 'Jan 2', weekday: 'SATURDAY', time: '6:00 PM', note: 'New Year New Character Energy', holiday: true, distance: '0.4 mi away' }
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
      const day = cursor.getDay(); // 5 = Fri, 6 = Sat, 0 = Sun
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
          note: `${weekday.slice(0, 3)} Night Session`,
          holiday: cursor.getMonth() === 10 || cursor.getMonth() === 11,
          distance: `${(0.2 + result.length * 0.3).toFixed(1)} mi away`
        });
      }
    }
    return result;
  }

  // --------------------------------------------------------------------------
  // 8. DOM References
  // --------------------------------------------------------------------------
  const els = {
    modeToggleBtn: document.getElementById('mode-toggle-btn'),
    modeToggleLabel: document.getElementById('mode-toggle-label'),
    soundToggleBtn: document.getElementById('sound-toggle-btn'),
    soundIcon: document.getElementById('sound-icon'),
    headerInviteBtn: document.getElementById('header-invite-btn'),
    activeCampaignBadge: document.getElementById('active-campaign-badge'),
    gridCountBadge: document.getElementById('grid-count-badge'),

    filterPills: document.querySelectorAll('#filter-pills .filter-pill'),
    navTabs: document.querySelectorAll('.nav-tab'),
    bottomTabs: document.querySelectorAll('.bottom-tab'),
    views: {
      checkin: document.getElementById('view-checkin'),
      grid: document.getElementById('view-grid'),
      dm: document.getElementById('view-dm')
    },

    // Check-In elements
    playerNameInput: document.getElementById('player-name-input'),
    playerClassSelect: document.getElementById('player-class-select'),
    playerHostingSelect: document.getElementById('player-hosting-select'),
    playerBioInput: document.getElementById('player-bio-input'),
    toggleListModeBtn: document.getElementById('toggle-list-mode-btn'),

    checkinDeckArea: document.getElementById('checkin-deck-area'),
    deckProgressLabel: document.getElementById('deck-progress-label'),
    deckProgressFill: document.getElementById('deck-progress-fill'),
    activeDateCard: document.getElementById('active-date-card'),
    cardHolidayChip: document.getElementById('card-holiday-chip'),
    cardDistanceChip: document.getElementById('card-distance-chip'),
    cardWeekday: document.getElementById('card-weekday'),
    cardDateMain: document.getElementById('card-date-main'),
    cardSessionNote: document.getElementById('card-session-note'),
    cardPartyPulse: document.getElementById('card-party-pulse'),
    verdictButtons: document.querySelectorAll('.btn-verdict'),
    prevCardBtn: document.getElementById('prev-card-btn'),
    nextCardBtn: document.getElementById('next-card-btn'),
    currentVoteIndicator: document.getElementById('current-vote-indicator'),

    checkinListArea: document.getElementById('checkin-list-area'),
    allDatesList: document.getElementById('all-dates-list'),
    finishListBtn: document.getElementById('finish-list-btn'),

    checkinCompleteCard: document.getElementById('checkin-complete-card'),
    playerSummaryChips: document.getElementById('player-summary-chips'),
    copyResponseLinkBtn: document.getElementById('copy-response-link-btn'),
    copyResponseCodeBtn: document.getElementById('copy-response-code-btn'),
    gotoGridBtn: document.getElementById('goto-grid-after-checkin-btn'),
    editAnswersBtn: document.getElementById('edit-answers-btn'),

    antiEssayForm: document.getElementById('anti-essay-form'),
    antiEssayInput: document.getElementById('anti-essay-input'),
    excusesBlockedCounter: document.getElementById('excuses-blocked-counter'),

    // Grid elements
    bestMatchBanner: document.getElementById('best-match-banner'),
    datesShownPill: document.getElementById('dates-shown-pill'),
    dateCascadeGrid: document.getElementById('date-cascade-grid'),
    playersShownPill: document.getElementById('players-shown-pill'),
    partyCascadeGrid: document.getElementById('party-cascade-grid'),

    // DM Control elements
    dmCampaignTitle: document.getElementById('dm-campaign-title'),
    dmNameInput: document.getElementById('dm-name-input'),
    dmQuorumInput: document.getElementById('dm-quorum-input'),
    dmDurationSelect: document.getElementById('dm-duration-select'),
    saveCampaignBtn: document.getElementById('save-campaign-btn'),
    resetDemoBtn: document.getElementById('reset-demo-btn'),
    presetBtns: document.querySelectorAll('.btn-preset'),
    customDateInput: document.getElementById('custom-date-input'),
    customTimeInput: document.getElementById('custom-time-input'),
    timePills: document.querySelectorAll('.time-pill'),
    customHolidayCheck: document.getElementById('custom-holiday-check'),
    addCustomDateBtn: document.getElementById('add-custom-date-btn'),
    dmDateList: document.getElementById('dm-date-list'),
    dmInviteUrlPreview: document.getElementById('dm-invite-url-preview'),
    copyCampaignLinkBtn: document.getElementById('copy-campaign-link-btn'),
    copySavageInviteBtn: document.getElementById('copy-savage-invite-btn'),
    importResponseInput: document.getElementById('import-response-input'),
    importResponseBtn: document.getElementById('import-response-btn'),
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
  // 9. Rendering Functions
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
    els.activeCampaignBadge.textContent = `${state.mode === 'demo' ? '🎭 DEMO' : '⚔️ CUSTOM'}: ${camp.title}`;
    els.modeToggleLabel.textContent = state.mode === 'demo' ? '🎭 Demo Party' : '⚔️ My Campaign';
    els.modeToggleBtn.classList.toggle('is-custom', state.mode === 'custom');
    els.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    els.gridCountBadge.textContent = `${camp.players.length} Players`;

    els.filterPills.forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.filter === state.activeFilter);
    });
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

    // Populate player fields without overwriting active focus
    if (document.activeElement !== els.playerNameInput) {
      els.playerNameInput.value = state.currentPlayer.name || '';
    }
    els.playerClassSelect.value = state.currentPlayer.classVibe || 'Paladin (Host)';
    els.playerHostingSelect.value = state.currentPlayer.hosting || '🏠 Can Host';
    if (document.activeElement !== els.playerBioInput) {
      els.playerBioInput.value = state.currentPlayer.bio || '';
    }

    els.excusesBlockedCounter.textContent = `${state.excusesBlocked} rambling text${state.excusesBlocked === 1 ? '' : 's'} blocked`;
    els.toggleListModeBtn.textContent = state.listMode ? '🃏 Card-by-Card Mode' : '📋 See All Dates';

    if (dates.length === 0) {
      els.checkinDeckArea.classList.add('hidden');
      els.checkinListArea.classList.add('hidden');
      els.checkinCompleteCard.classList.remove('hidden');
      els.playerSummaryChips.innerHTML = '<span class="summary-chip maybe">No dates added yet — go to DM Control to add session dates!</span>';
      return;
    }

    if (state.deckIndex >= dates.length) state.deckIndex = dates.length - 1;
    if (state.deckIndex < 0) state.deckIndex = 0;

    if (state.checkinCompleted) {
      els.checkinDeckArea.classList.add('hidden');
      els.checkinListArea.classList.add('hidden');
      els.checkinCompleteCard.classList.remove('hidden');
      renderCompletionSummary();
      return;
    }

    els.checkinCompleteCard.classList.add('hidden');

    if (state.listMode) {
      els.checkinDeckArea.classList.add('hidden');
      els.checkinListArea.classList.remove('hidden');
      renderAllDatesList();
    } else {
      els.checkinDeckArea.classList.remove('hidden');
      els.checkinListArea.classList.add('hidden');
      renderSingleDateCard();
    }
  }

  function renderSingleDateCard() {
    const camp = getActiveCampaign();
    const dates = camp.dates;
    const dt = dates[state.deckIndex];
    const votes = state.currentPlayer.votes || {};
    const answeredCount = dates.filter((d) => Boolean(votes[d.id])).length;

    els.deckProgressLabel.textContent = `Date ${state.deckIndex + 1} of ${dates.length} (${answeredCount} answered)`;
    els.deckProgressFill.style.width = `${Math.round((answeredCount / dates.length) * 100)}%`;

    els.cardHolidayChip.textContent = dt.holiday ? '🎄 Holiday Window' : '📅 Standard Night';
    els.cardDistanceChip.textContent = dt.distance || '0.4 mi away';
    els.cardWeekday.textContent = dt.weekday || 'SESSION';
    els.cardDateMain.textContent = `${dt.label} • ${dt.time}`;
    els.cardSessionNote.textContent = dt.note || camp.duration;

    // Party pulse for this date
    const stats = getDateStats(camp, dt.id);
    els.cardPartyPulse.innerHTML = `
      <span>🔥 <strong>${stats.dtf}</strong> DTF</span>
      <span>•</span>
      <span>🎲 <strong>${stats.maybe}</strong> Maybe</span>
      <span>•</span>
      <span>💀 <strong>${stats.pass}</strong> Pass</span>
    `;

    const myVote = votes[dt.id];
    els.verdictButtons.forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.vote === myVote);
    });

    if (myVote === 'dtf') els.currentVoteIndicator.textContent = 'Current pick: 🔥 DTF';
    else if (myVote === 'maybe') els.currentVoteIndicator.textContent = 'Current pick: 🎲 Disadvantage';
    else if (myVote === 'pass') els.currentVoteIndicator.textContent = 'Current pick: 💀 Hard Pass';
    else els.currentVoteIndicator.textContent = 'Tap 1 of the 3 buttons';

    els.prevCardBtn.disabled = state.deckIndex === 0;
    els.nextCardBtn.textContent = state.deckIndex === dates.length - 1 ? 'Finish ➡️' : 'Skip / Next ➡️';
  }

  function renderAllDatesList() {
    const camp = getActiveCampaign();
    const votes = state.currentPlayer.votes || {};

    els.allDatesList.innerHTML = camp.dates
      .map((dt) => {
        const v = votes[dt.id];
        return `
          <div class="list-date-row">
            <div class="list-date-info">
              <strong>${escapeHtml(dt.weekday)} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</strong>
              <span>${dt.holiday ? '🎄 ' : ''}${escapeHtml(dt.note || camp.duration)}</span>
            </div>
            <div class="list-vote-pills">
              <button type="button" class="mini-vote-btn ${v === 'dtf' ? 'active-dtf' : ''}" data-date-id="${escapeHtml(dt.id)}" data-vote="dtf">🔥 DTF</button>
              <button type="button" class="mini-vote-btn ${v === 'maybe' ? 'active-maybe' : ''}" data-date-id="${escapeHtml(dt.id)}" data-vote="maybe">🎲 Maybe</button>
              <button type="button" class="mini-vote-btn ${v === 'pass' ? 'active-pass' : ''}" data-date-id="${escapeHtml(dt.id)}" data-vote="pass">💀 Pass</button>
            </div>
          </div>
        `;
      })
      .join('');

    els.allDatesList.querySelectorAll('.mini-vote-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        castVoteForDate(btn.dataset.dateId, btn.dataset.vote, false);
      });
    });
  }

  function renderCompletionSummary() {
    const camp = getActiveCampaign();
    const votes = state.currentPlayer.votes || {};
    els.playerSummaryChips.innerHTML = camp.dates
      .map((dt) => {
        const rawVote = votes[dt.id];
        const v = VALID_VOTES.has(rawVote) ? rawVote : 'pass';
        const icon = v === 'dtf' ? '🔥' : v === 'maybe' ? '🎲' : '💀';
        const label = v === 'dtf' ? 'DTF' : v === 'maybe' ? 'Maybe' : 'Pass';
        return `<span class="summary-chip ${v}">${icon} ${escapeHtml(dt.label)} (${label})</span>`;
      })
      .join('');
  }

  // --------------------------------------------------------------------------
  // 10. Grid Rendering (Best Match + Date Cascade + Party Cascade)
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
    const filter = state.activeFilter;

    // 1) Compute Best Match Date
    const scoredDates = camp.dates.map((dt) => ({
      dt,
      stats: getDateStats(camp, dt.id)
    }));
    scoredDates.sort((a, b) => b.stats.dtf - a.stats.dtf || b.stats.maybe - a.stats.maybe);
    const best = scoredDates[0];

    if (best && camp.players.length > 0) {
      const { dt, stats } = best;
      const hostReady = stats.dtfPlayers.some((p) => (p.hosting || '').includes('Host'));
      els.bestMatchBanner.innerHTML = `
        <div class="best-match-info">
          <div class="best-match-kicker">${stats.isMatch ? '🔥 QUORUM ACHIEVED — TOP MATCH' : '⚡ LEADING CONTENDER'}</div>
          <h2>${escapeHtml(dt.weekday)} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</h2>
          <p class="best-match-sub">
            <strong>${stats.dtf}/${camp.players.length}</strong> 🔥 DTF (${stats.pct}%) •
            <strong>${stats.maybe}</strong> 🎲 Maybe •
            ${hostReady ? '🏠 Host Locked In!' : '⚠️ Still need a Host'}
          </p>
        </div>
        <button type="button" class="btn-amber" id="lock-in-verdict-btn">
          🎉 Lock In &amp; Copy Group Verdict
        </button>
      `;

      const lockBtn = document.getElementById('lock-in-verdict-btn');
      if (lockBtn) {
        lockBtn.addEventListener('click', () => {
          triggerConfetti();
          playCritFanfare();
          const dtfNames = stats.dtfPlayers.map((p) => p.name).join(', ') || 'None yet';
          const text = `⚔️ OFFICIAL SCHEDULR SESSION VERDICT ⚔️\nCampaign: ${camp.title}\n📅 LOCKED DATE: ${dt.weekday}, ${dt.label} at ${dt.time}\n🔥 Confirmed DTF (${stats.dtf}): ${dtfNames}\nNo further essays accepted. Roll initiative.`;
          copyText(text, '🎉 Session locked & verdict copied to clipboard!');
        });
      }
    } else {
      els.bestMatchBanner.innerHTML = `
        <div class="best-match-info">
          <div class="best-match-kicker">🟨 THE GRID IS WAITING</div>
          <h2>No Player Responses Yet</h2>
          <p class="best-match-sub">Complete Check-In or share your <code>?c=...</code> invite link to light up The Grid.</p>
        </div>
      `;
    }

    // 2) Filter & Render Date Tiles
    const visibleDates = camp.dates.filter((dt) => {
      const st = getDateStats(camp, dt.id);
      if (filter === 'dtf') return st.dtf > 0;
      if (filter === 'holiday') return Boolean(dt.holiday);
      if (filter === 'host') return st.dtfPlayers.some((p) => (p.hosting || '').includes('Host'));
      if (filter === 'needs-tap') return st.pending > 0;
      return true;
    });

    els.datesShownPill.textContent = `${visibleDates.length} Date${visibleDates.length === 1 ? '' : 's'}`;

    if (visibleDates.length === 0) {
      els.dateCascadeGrid.innerHTML = `<div class="empty-grid-state">No dates match the current filter. Try switching to <strong>All</strong>!</div>`;
    } else {
      els.dateCascadeGrid.innerHTML = visibleDates
        .map((dt) => {
          const st = getDateStats(camp, dt.id);
          const bgTone = st.isMatch
            ? 'radial-gradient(circle at 50% 35%, rgba(255,184,0,0.3), rgba(20,20,28,0.95))'
            : 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.06), rgba(16,16,22,0.98))';
          return `
            <article class="grid-tile ${st.isMatch ? 'is-match' : ''}" data-date-detail="${escapeHtml(dt.id)}" tabindex="0" role="button">
              <div class="date-tile-bg" style="background: ${bgTone};">
                <div class="date-tile-day">${escapeHtml(dt.weekday.slice(0, 3))}</div>
                <div class="date-tile-label">${escapeHtml(dt.label)}</div>
                <div class="date-tile-time">${escapeHtml(dt.time)}</div>
              </div>
              <div class="tile-top-badges">
                ${st.isMatch ? '<span class="match-badge">MATCH!</span>' : `<span class="pct-badge">${dt.holiday ? '🎄' : '📅'}</span>`}
                <span class="pct-badge">${st.pct}% DTF</span>
              </div>
              <div class="tile-scrim">
                <div class="tile-title-row">
                  <span class="${st.dtf > 0 ? 'online-dot-sm' : 'offline-dot-sm'}"></span>
                  <span>🔥 ${st.dtf} DTF • 🎲 ${st.maybe}</span>
                </div>
                <div class="tile-sub">${escapeHtml(dt.distance || 'Holiday Block')}</div>
              </div>
            </article>
          `;
        })
        .join('');

      els.dateCascadeGrid.querySelectorAll('[data-date-detail]').forEach((tile) => {
        tile.addEventListener('click', () => openDateDetailModal(tile.dataset.dateDetail));
      });
    }

    // 3) Filter & Render Party Profile Tiles
    const totalDates = camp.dates.length;
    const visiblePlayers = camp.players.filter((p) => {
      const votes = p.votes || {};
      const answeredCount = camp.dates.filter((d) => Boolean(votes[d.id])).length;
      const dtfCount = camp.dates.filter((d) => votes[d.id] === 'dtf').length;
      if (filter === 'dtf') return dtfCount > 0;
      if (filter === 'host') return (p.hosting || '').includes('Host');
      if (filter === 'needs-tap') return answeredCount < totalDates;
      return true;
    });

    els.playersShownPill.textContent = `${visiblePlayers.length} Player${visiblePlayers.length === 1 ? '' : 's'}`;

    if (visiblePlayers.length === 0) {
      els.partyCascadeGrid.innerHTML = `<div class="empty-grid-state">No adventurers match this filter yet. Check in or switch to <strong>All</strong>!</div>`;
    } else {
      els.partyCascadeGrid.innerHTML = visiblePlayers
        .map((p) => {
          const votes = p.votes || {};
          const dtfCount = camp.dates.filter((d) => votes[d.id] === 'dtf').length;
          const answeredCount = camp.dates.filter((d) => Boolean(votes[d.id])).length;
          const incomplete = answeredCount < totalDates;

          return `
            <article class="grid-tile ${dtfCount >= 3 ? 'is-match' : ''}" data-player-detail="${escapeHtml(p.id)}">
              <div class="player-avatar-wrap">
                ${getClassPortraitSvg(p.classVibe, p.name)}
              </div>
              <div class="tile-top-badges">
                <span class="pct-badge">${escapeHtml((p.hosting || '🎲').split(' ')[0])}</span>
                <span class="pct-badge">${incomplete ? '⏳ ' + answeredCount + '/' + totalDates : '🔥 ' + dtfCount + ' DTF'}</span>
              </div>
              <div class="tile-scrim">
                <div class="tile-title-row">
                  <span class="${p.online ? 'online-dot-sm' : 'offline-dot-sm'}"></span>
                  <span>${escapeHtml(p.name)}</span>
                </div>
                <div class="tile-sub">${escapeHtml(p.distance || '1.0 mi away')} • ${escapeHtml((p.classVibe || '').split(' ')[0])}</div>
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
  // 11. DM Control Rendering
  // --------------------------------------------------------------------------
  function renderDMControl() {
    const camp = getActiveCampaign();
    if (document.activeElement !== els.dmCampaignTitle) els.dmCampaignTitle.value = camp.title;
    if (document.activeElement !== els.dmNameInput) els.dmNameInput.value = camp.dmName;
    if (document.activeElement !== els.dmQuorumInput) els.dmQuorumInput.value = camp.quorum;
    els.dmDurationSelect.value = camp.duration;

    els.dmInviteUrlPreview.value = buildCampaignShareUrl(camp);

    els.dmDateList.innerHTML = camp.dates.length
      ? camp.dates
          .map(
            (dt) => `
          <div class="dm-date-item">
            <div>
              <strong>${dt.holiday ? '🎄 ' : '📅 '}${escapeHtml(dt.weekday)} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</strong>
              <div style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(dt.note || camp.duration)}</div>
            </div>
            <div class="dm-date-actions">
              <button type="button" class="btn-ghost-xs" data-toggle-holiday="${escapeHtml(dt.id)}" title="Toggle Holiday tag">🎄</button>
              <button type="button" class="btn-danger-sm" data-remove-date="${escapeHtml(dt.id)}" style="padding:4px 9px;">✕</button>
            </div>
          </div>
        `
          )
          .join('')
      : '<div style="color:var(--text-muted);font-size:0.84rem;">No dates proposed yet. Click a holiday preset above!</div>';

    els.dmDateList.querySelectorAll('[data-remove-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        camp.dates = camp.dates.filter((d) => d.id !== btn.dataset.removeDate);
        saveState();
        renderAll();
        showToast('Removed date from campaign.');
      });
    });

    els.dmDateList.querySelectorAll('[data-toggle-holiday]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = camp.dates.find((d) => d.id === btn.dataset.toggleHoliday);
        if (found) {
          found.holiday = !found.holiday;
          saveState();
          renderAll();
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 12. Modals (Player Profile, Date Breakdown, Roast, Invite)
  // --------------------------------------------------------------------------
  function openPlayerDetailModal(playerId) {
    const camp = getActiveCampaign();
    const p = camp.players.find((x) => x.id === playerId);
    if (!p) return;

    const meta = CLASS_META[p.classVibe] || CLASS_META['Barbarian (Down to Roll)'];
    const breakdown = camp.dates
      .map((dt) => {
        const v = p.votes ? p.votes[dt.id] : undefined;
        const badge =
          v === 'dtf'
            ? '<span class="vote-pill dtf">🔥 DTF</span>'
            : v === 'maybe'
            ? '<span class="vote-pill maybe">🎲 Disadvantage</span>'
            : v === 'pass'
            ? '<span class="vote-pill pass">💀 Hard Pass</span>'
            : '<span class="vote-pill none">⏳ No Answer</span>';
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
          <div class="online-status" style="margin-bottom:3px;">
            <span class="${p.online ? 'online-dot-sm' : 'offline-dot-sm'}"></span>
            <span style="font-size:0.76rem;">${p.online ? 'Online Now' : 'Ghosting the Group Chat'} • ${escapeHtml(p.distance || 'Nearby')}</span>
          </div>
          <h2 id="detail-modal-title" class="section-title">${escapeHtml(p.name)}</h2>
          <div style="font-size:0.84rem;color:var(--amber);font-weight:700;">${escapeHtml(p.classVibe)}</div>
        </div>
      </div>

      <p style="margin:0 0 12px;color:var(--text-secondary);font-size:0.9rem;">"${escapeHtml(p.bio || 'No rambling bio.')}"</p>

      <div class="detail-stats-grid">
        <div class="stat-box">
          <div class="stat-label">Hosting Status</div>
          <div class="stat-value">${escapeHtml(p.hosting)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Preferred Role</div>
          <div class="stat-value">${escapeHtml(meta.role)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Initiative Bonus</div>
          <div class="stat-value">${escapeHtml(p.initiative || '+3')}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Historical Flake Rate</div>
          <div class="stat-value">${escapeHtml(p.flakeRate || '10%')}</div>
        </div>
      </div>

      <h3 class="section-title-sm" style="margin-top:14px;">Date-by-Date Answers</h3>
      <div class="breakdown-list">${breakdown}</div>

      <div class="btn-row">
        <button type="button" class="btn-amber" id="modal-send-tap-btn">🔥 Send Tap (${p.taps || 0})</button>
        <button type="button" class="btn-secondary" id="modal-copy-nudge-btn">📋 Copy Nudge Text</button>
      </div>
    `;

    document.getElementById('modal-send-tap-btn').addEventListener('click', () => {
      sendTapToPlayer(p.id);
      openPlayerDetailModal(p.id);
    });

    document.getElementById('modal-copy-nudge-btn').addEventListener('click', () => {
      const url = buildCampaignShareUrl(camp);
      const msg = `Hey ${p.name} 👀 You just got TAPPED on Schedulr for "${camp.title}". No 5-paragraph texts please — tap DTF / Maybe / Hard Pass in 10 seconds here: ${url}`;
      copyText(msg, `📋 Passive-aggressive nudge copied for ${p.name}!`);
    });

    els.detailModal.classList.remove('hidden');
  }

  function openDateDetailModal(dateId) {
    const camp = getActiveCampaign();
    const dt = camp.dates.find((d) => d.id === dateId);
    if (!dt) return;

    const st = getDateStats(camp, dt.id);
    const listPlayers = (arr, pillClass, label) =>
      arr.length
        ? arr
            .map(
              (p) => `
          <div class="breakdown-row">
            <span><strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.hosting)})</span>
            <span class="vote-pill ${pillClass}">${label}</span>
          </div>`
            )
            .join('')
        : '';

    els.detailModalBody.innerHTML = `
      <span class="holiday-chip">${dt.holiday ? '🎄 Holiday Block' : '📅 Session Slot'}</span>
      <h2 id="detail-modal-title" class="section-title" style="margin-top:8px;">${escapeHtml(dt.weekday)} • ${escapeHtml(dt.label)} @ ${escapeHtml(dt.time)}</h2>
      <p class="section-subtitle">${escapeHtml(dt.note || camp.duration)}</p>

      <div class="detail-stats-grid">
        <div class="stat-box">
          <div class="stat-label">🔥 DTF Count</div>
          <div class="stat-value" style="color:var(--amber);">${st.dtf} / ${camp.players.length} (${st.pct}%)</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Quorum Target</div>
          <div class="stat-value">${st.isMatch ? '✅ MATCHED!' : `Need ${camp.quorum} DTF`}</div>
        </div>
      </div>

      <div class="breakdown-list">
        ${listPlayers(st.dtfPlayers, 'dtf', '🔥 DTF')}
        ${listPlayers(st.maybePlayers, 'maybe', '🎲 Disadvantage')}
        ${listPlayers(st.passPlayers, 'pass', '💀 Hard Pass')}
        ${listPlayers(st.pendingPlayers, 'none', '⏳ Needs Tap')}
      </div>

      <div class="btn-row">
        <button type="button" class="btn-amber" id="date-modal-lock-btn">🎉 Copy Date Verdict</button>
      </div>
    `;

    document.getElementById('date-modal-lock-btn').addEventListener('click', () => {
      const names = st.dtfPlayers.map((p) => p.name).join(', ') || 'Nobody yet';
      copyText(
        `📅 ${camp.title} — ${dt.weekday} ${dt.label} @ ${dt.time}\n🔥 Confirmed DTF (${st.dtf}): ${names}`,
        '📋 Date breakdown copied!'
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

    showToast(`🔥 You tapped ${p.name}! ("Roll initiative, bestie.")`, 'success');
  }

  function triggerRoastModal() {
    state.excusesBlocked += 1;
    saveState();
    els.excusesBlockedCounter.textContent = `${state.excusesBlocked} rambling text${state.excusesBlocked === 1 ? '' : 's'} blocked`;

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
    const savageMsg = `Stop writing 20 texts over 6 hours 🛑⚔️\nMark your availability for "${camp.title}" on Schedulr in 15 seconds (🔥 DTF, 🎲 Disadvantage, or 💀 Hard Pass — essays are blocked):\n${url}`;

    els.inviteModalUrl.value = url;
    els.inviteModalText.value = savageMsg;
    els.inviteModal.classList.remove('hidden');
  }

  // --------------------------------------------------------------------------
  // 13. Check-In Voting & Auto-Save to Active Grid
  // --------------------------------------------------------------------------
  function syncCurrentPlayerMeta() {
    state.currentPlayer.name = els.playerNameInput.value;
    state.currentPlayer.classVibe = els.playerClassSelect.value;
    state.currentPlayer.hosting = els.playerHostingSelect.value;
    state.currentPlayer.bio = els.playerBioInput.value;
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
    else playTone(380, 0.06, 'sine', 0.06);

    const camp = getActiveCampaign();
    // Auto-sync current player onto active grid if they have given at least 1 vote
    const playerEntry = {
      id: state.currentPlayer.id,
      name: (state.currentPlayer.name || '').trim() || 'You (Tavern Guest)',
      classVibe: state.currentPlayer.classVibe,
      hosting: state.currentPlayer.hosting,
      bio: (state.currentPlayer.bio || '').trim() || 'Checked in straight from Schedulr.',
      distance: '0.1 mi away',
      online: true,
      initiative: '+4',
      flakeRate: '0%',
      taps: 1,
      votes: { ...state.currentPlayer.votes }
    };
    upsertPlayerInCampaign(camp, playerEntry);

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
    showToast('🎉 Straight answers locked & added to The Grid!', 'success');
  }

  // --------------------------------------------------------------------------
  // 14. Utilities: Clipboard, Toasts, Confetti, Escaping
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
      showToast('Copy failed — please select and copy manually.', 'danger');
    }
    document.body.removeChild(ta);
  }

  function showToast(msg, variant = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast ${variant === 'success' ? 'toast-success' : variant === 'danger' ? 'toast-danger' : ''}`;
    toast.textContent = msg;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  function triggerConfetti() {
    const colors = ['#ffb800', '#ff5500', '#00e676', '#b388ff', '#ffffff'];
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = 1.4 + Math.random() * 1.1 + 's';
      piece.style.animationDelay = Math.random() * 0.25 + 's';
      els.confettiLayer.appendChild(piece);
      setTimeout(() => piece.remove(), 2600);
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
    // View Switching
    const switchView = (view) => {
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

    // Mode Toggle (Demo vs Custom)
    els.modeToggleBtn.addEventListener('click', () => {
      state.mode = state.mode === 'demo' ? 'custom' : 'demo';
      state.deckIndex = 0;
      state.checkinCompleted = false;
      saveState();
      renderAll();
      showToast(
        state.mode === 'demo' ? "🎭 Switched to Serge's Demo Party!" : '⚔️ Switched to Your Custom Campaign!',
        'success'
      );
    });

    // Sound Toggle
    els.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      saveState();
      renderHeader();
      if (state.soundEnabled) playTapFlameSound();
    });

    // Filter Pills
    els.filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        state.activeFilter = pill.dataset.filter;
        saveState();
        renderHeader();
        renderGrid();
        if (state.activeView !== 'grid') switchView('grid');
      });
    });

    // Header Invite
    els.headerInviteBtn.addEventListener('click', openInviteModal);

    // Check-In Identity Inputs
    [els.playerNameInput, els.playerClassSelect, els.playerHostingSelect, els.playerBioInput].forEach((input) => {
      input.addEventListener('input', syncCurrentPlayerMeta);
      input.addEventListener('change', syncCurrentPlayerMeta);
    });

    // Toggle List Mode
    els.toggleListModeBtn.addEventListener('click', () => {
      state.listMode = !state.listMode;
      saveState();
      renderCheckIn();
    });

    els.finishListBtn.addEventListener('click', completeCheckIn);

    // Verdict Buttons
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

    // Completion Actions
    els.copyResponseLinkBtn.addEventListener('click', () => {
      const { url } = buildPlayerResponseData();
      copyText(url, '🔗 Response link (?r=...) copied! Text this back to your DM.');
    });

    els.copyResponseCodeBtn.addEventListener('click', () => {
      const { code } = buildPlayerResponseData();
      const camp = getActiveCampaign();
      const votes = state.currentPlayer.votes || {};
      const dtfLabels = camp.dates
        .filter((d) => votes[d.id] === 'dtf')
        .map((d) => `${d.label} (${d.time})`)
        .join(', ') || 'None';
      const msg = `🔥 Schedulr Check-In from ${state.currentPlayer.name || 'Party Member'} (${state.currentPlayer.hosting}):\nDTF Dates: ${dtfLabels}\n\nDM Import Code:\n${code}`;
      copyText(msg, '📋 Response code & SMS summary copied!');
    });

    els.gotoGridBtn.addEventListener('click', () => switchView('grid'));
    els.editAnswersBtn.addEventListener('click', () => {
      state.checkinCompleted = false;
      state.deckIndex = 0;
      saveState();
      renderCheckIn();
    });

    // Anti-Essay Firewall Trap
    els.antiEssayInput.addEventListener('input', () => {
      if (els.antiEssayInput.value.length >= 18) {
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

    // Keyboard shortcuts for Check-In
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        els.detailModal.classList.add('hidden');
        els.roastModal.classList.add('hidden');
        els.inviteModal.classList.add('hidden');
        return;
      }
      if (state.activeView !== 'checkin' || state.checkinCompleted || state.listMode) return;
      const camp = getActiveCampaign();
      const dt = camp.dates[state.deckIndex];
      if (!dt) return;
      if (e.key === '1') castVoteForDate(dt.id, 'dtf', true);
      else if (e.key === '2') castVoteForDate(dt.id, 'maybe', true);
      else if (e.key === '3') castVoteForDate(dt.id, 'pass', true);
      else if (e.key === 'ArrowLeft') els.prevCardBtn.click();
      else if (e.key === 'ArrowRight') els.nextCardBtn.click();
    });

    // DM Control Actions
    els.saveCampaignBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      camp.title = cleanString(els.dmCampaignTitle.value, 48, 'Untitled D&D Campaign');
      camp.dmName = cleanString(els.dmNameInput.value, 28, 'Dungeon Master');
      camp.quorum = Math.max(2, Math.min(12, Math.floor(Number(els.dmQuorumInput.value) || 4)));
      camp.duration = cleanString(els.dmDurationSelect.value, 48, '4 Hours (Standard Tavern Crawl)');
      saveState();
      renderAll();
      showToast('👑 Campaign settings saved!', 'success');
    });

    els.resetDemoBtn.addEventListener('click', () => {
      state.demoCampaign = createDemoCampaign();
      state.mode = 'demo';
      state.deckIndex = 0;
      state.checkinCompleted = false;
      saveState();
      renderAll();
      showToast("🎭 Reloaded Serge's Holiday Demo Party!", 'success');
    });

    els.presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const camp = getActiveCampaign();
        camp.dates = generatePresetDates(btn.dataset.preset);
        state.deckIndex = 0;
        state.checkinCompleted = false;
        saveState();
        renderAll();
        showToast(`🎄 Loaded "${btn.textContent.trim()}" dates!`, 'success');
      });
    });

    els.timePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        els.customTimeInput.value = pill.dataset.time;
      });
    });

    els.addCustomDateBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      if (camp.dates.length >= MAX_DATES) {
        showToast(`Maximum of ${MAX_DATES} dates reached per campaign.`, 'danger');
        return;
      }
      const rawDate = els.customDateInput.value;
      const rawTime = cleanString(els.customTimeInput.value, 20, '7:00 PM');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        showToast('Pick a valid calendar date first!', 'danger');
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
        note: camp.duration,
        holiday: els.customHolidayCheck.checked,
        distance: '0.5 mi away'
      });
      saveState();
      renderAll();
      showToast(`➕ Added ${weekday} ${label} @ ${rawTime}`, 'success');
    });

    els.copyCampaignLinkBtn.addEventListener('click', () => {
      copyText(buildCampaignShareUrl(getActiveCampaign()), '🔗 Campaign invite URL copied!');
    });

    els.copySavageInviteBtn.addEventListener('click', () => {
      const camp = getActiveCampaign();
      const url = buildCampaignShareUrl(camp);
      const msg = `⚔️ ${camp.title} — NO MORE 20-TEXT SCHEDULING CHAOS.\nClick this link, tap 🔥 DTF / 🎲 Disadvantage / 💀 Hard Pass for each date, and send me your code back. Essays will be blocked:\n${url}`;
      copyText(msg, '🔥 Savage group invite copied!');
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
      if (state.mode === 'demo') {
        state.demoCampaign = createDemoCampaign();
      } else {
        camp.players = [];
      }
      saveState();
      renderAll();
      showToast('🗑️ Party list reset.');
    });

    // Modals close
    els.detailModalClose.addEventListener('click', () => els.detailModal.classList.add('hidden'));
    els.detailModal.addEventListener('click', (e) => {
      if (e.target === els.detailModal) els.detailModal.classList.add('hidden');
    });

    els.inviteModalClose.addEventListener('click', () => els.inviteModal.classList.add('hidden'));
    els.inviteModal.addEventListener('click', (e) => {
      if (e.target === els.inviteModal) els.inviteModal.classList.add('hidden');
    });
    els.inviteCopyUrlBtn.addEventListener('click', () => {
      copyText(els.inviteModalUrl.value, '🔗 Invite link copied!');
    });
    els.inviteCopyMsgBtn.addEventListener('click', () => {
      copyText(els.inviteModalText.value, '💬 Group text copied!');
    });
  }

  // --------------------------------------------------------------------------
  // 16. Boot Application
  // --------------------------------------------------------------------------
  function init() {
    // Default date picker value to upcoming Friday/Saturday
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
