/**
 * CHOLO GHURI - Biker Convoy & Highway Radar
 * Mobile-First Biker Telemetry, Crowdsourced Police Radar & PC Dev Suite
 */

// ==========================================
// 0. GLOBAL ONBOARDING MODAL & ACTION HANDLERS
// (Defined at top-level outside listeners so inline HTML onclick never fails)
// ==========================================
window.openJoinModal = function() {
  const modal = document.getElementById("onboardingModal");
  if (modal) {
    modal.classList.remove("hidden", "opacity-0", "pointer-events-none");
    modal.style.removeProperty("display");
    modal.style.removeProperty("opacity");
    modal.style.removeProperty("pointer-events");
    modal.style.display = "flex";
    modal.style.zIndex = "10000";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
  }
};

window.closeJoinModal = function() {
  const modal = document.getElementById("onboardingModal");
  if (modal) {
    modal.classList.add("hidden", "opacity-0", "pointer-events-none");
    if (typeof modal.style.removeProperty === "function") {
      modal.style.removeProperty("display");
      modal.style.removeProperty("opacity");
      modal.style.removeProperty("pointer-events");
    }
    modal.style.display = "none";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    modal.style.visibility = "hidden";
    modal.setAttribute("aria-hidden", "true");
  }
};

window.submitOnboarding = function(event) {
  if (event) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    if (typeof event.stopPropagation === "function") event.stopPropagation();
  }

  if (typeof playSound === "function") playSound("engine");

  const riderNameInput = document.getElementById("riderNameInput");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const isLeaderCheckbox = document.getElementById("isLeaderCheckbox");

  // a) Read #riderNameInput and #roomCodeInput. If empty, fallback to a default name and pre-generated room code
  let name = riderNameInput ? riderNameInput.value.trim() : "";
  if (!name) {
    name = "Rider_" + Math.floor(100 + Math.random() * 900);
    if (riderNameInput) riderNameInput.value = name;
  }

  let code = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : "";
  if (!code || code === "----") {
    code = typeof generateRoomCode === "function" ? generateRoomCode() : "DHAKA" + Math.floor(100 + Math.random() * 900);
    if (roomCodeInput) roomCodeInput.value = code;
  }

  const isLeader = isLeaderCheckbox ? Boolean(isLeaderCheckbox.checked) : false;

  // b) Save session data correctly into sessionStorage
  let riderId = (typeof currentSession !== "undefined" && currentSession && currentSession.riderId) ? currentSession.riderId : null;
  const isDifferent = !riderId ||
    (typeof currentSession !== "undefined" && (
      !currentSession.riderName ||
      !currentSession.roomCode ||
      currentSession.riderName.trim().toLowerCase() !== name.toLowerCase() ||
      currentSession.roomCode.trim().toUpperCase() !== code
    ));

  if (isDifferent) {
    riderId = typeof generateUUID === "function" ? generateUUID() : ("rider_" + Date.now());
  }

  const sessionData = {
    riderId,
    riderName: name,
    roomCode: code,
    isLeader
  };

  if (typeof currentSession !== "undefined") {
    currentSession = sessionData;
  }

  try {
    const key = typeof SESSION_STORAGE_KEY !== "undefined" ? SESSION_STORAGE_KEY : "cholo_ghuri_session";
    sessionStorage.setItem(key, JSON.stringify(sessionData));
  } catch (e) {}

  // Update Top HUD room code and captain indicators
  const roomCodeEl = document.getElementById("activeRoomCode");
  const drawerRoomCode = document.getElementById("drawerRoomCode");
  if (roomCodeEl) roomCodeEl.textContent = code;
  if (drawerRoomCode) drawerRoomCode.textContent = `ROOM: ${code}`;

  const captainBadge = document.getElementById("captainBadge");
  if (captainBadge) {
    if (isLeader) {
      captainBadge.classList.remove("hidden");
    } else {
      captainBadge.classList.add("hidden");
    }
  }

  // c) Forcefully hide and remove the onboarding modal (#onboardingModal)
  const modal = document.getElementById("onboardingModal");
  if (modal) {
    modal.classList.add("hidden", "opacity-0", "pointer-events-none");
    if (typeof modal.style.removeProperty === "function") {
      modal.style.removeProperty("display");
      modal.style.removeProperty("opacity");
      modal.style.removeProperty("pointer-events");
    }
    modal.style.display = "none";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    modal.style.visibility = "hidden";
    modal.setAttribute("aria-hidden", "true");
  }
  if (typeof window.closeJoinModal === "function") {
    window.closeJoinModal();
  }

  // d) Immediately initialize or resume the Leaflet map (map.invalidateSize()) and trigger geolocation lookup without blocking map rendering if GPS takes too long
  if (typeof initMap === "function") {
    initMap();
  }
  if (typeof map !== "undefined" && map) {
    map.invalidateSize();
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    setTimeout(() => { if (map) map.invalidateSize(); }, 600);
  }

  // Trigger quick non-blocking geolocation lookup with Dhaka fallback (23.8103, 90.4125)
  if (typeof isSimulating !== "undefined" && !isSimulating) {
    if (typeof requestQuickGeolocation === "function") {
      requestQuickGeolocation();
    } else if (typeof startGPSTracking === "function") {
      startGPSTracking();
    }
  }

  // e) Start the dual sync loop (runDualSyncLoop()) and show a success toast: "🚀 Joined Convoy Successfully!"
  if (typeof joinSupabaseRoom === "function") {
    joinSupabaseRoom(code);
  }
  if (typeof runDualSyncLoop === "function") {
    runDualSyncLoop();
  }

  if (typeof showRadarToast === "function") {
    showRadarToast("🚀 Joined Convoy Successfully!", `Riding as ${name} in tour room ${code}`);
  }
};

window.recenterCamera = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    isCameraLocked = true;
    if (typeof updateRecenterButtonUI === "function") updateRecenterButtonUI();
    const targetMap = window.map || (typeof map !== "undefined" ? map : null);
    if (targetMap && typeof riderLocation !== "undefined") {
      targetMap.flyTo([riderLocation.lat, riderLocation.lng], 15, { animate: true, duration: 0.8 });
    }
  } catch (err) {
    console.warn("Recenter camera notice:", err);
  }
};

window.openGroupDrawer = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    const drawer = document.getElementById("convoyDrawer") || 
                   document.getElementById("groupDrawer") || 
                   document.getElementById("ridersDrawer");
    if (drawer) {
      drawer.classList.remove("hidden", "-translate-x-full", "pointer-events-none");
      drawer.classList.add("translate-x-0", "open");
      drawer.style.display = "flex";
      drawer.style.transform = "translateX(0%)";
      drawer.style.zIndex = "99999";
      drawer.style.opacity = "1";
      drawer.style.pointerEvents = "auto";
    }

    const backdrop = document.getElementById("drawerBackdrop");
    if (backdrop) {
      backdrop.classList.remove("hidden", "pointer-events-none");
      backdrop.style.display = "block";
      backdrop.style.opacity = "1";
      backdrop.style.pointerEvents = "auto";
    }

    if (typeof evaluateConvoyDistances === "function") {
      evaluateConvoyDistances();
    }
  } catch (err) {
    console.warn("Open group drawer error:", err);
  }
};

window.closeGroupDrawer = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    const drawer = document.getElementById("convoyDrawer") || 
                   document.getElementById("groupDrawer") || 
                   document.getElementById("ridersDrawer");
    if (drawer) {
      drawer.classList.remove("translate-x-0", "open");
      drawer.classList.add("hidden", "-translate-x-full", "pointer-events-none");
      drawer.style.display = "none";
      drawer.style.transform = "translateX(-100%)";
      drawer.style.pointerEvents = "none";
    }

    const backdrop = document.getElementById("drawerBackdrop");
    if (backdrop) {
      backdrop.classList.add("hidden", "pointer-events-none");
      backdrop.style.display = "none";
      backdrop.style.opacity = "0";
      backdrop.style.pointerEvents = "none";
    }
  } catch (err) {
    console.warn("Close group drawer error:", err);
  }
};

let lastGroupDrawerToggleMs = 0;
window.toggleGroupDrawer = function(forceOpen) {
  try {
    const now = Date.now();
    if (forceOpen === undefined && (now - lastGroupDrawerToggleMs) < 250) {
      return;
    }
    lastGroupDrawerToggleMs = now;

    if (typeof playSound === "function") playSound("click");
    const drawer = document.getElementById("convoyDrawer") || 
                   document.getElementById("groupDrawer") || 
                   document.getElementById("ridersDrawer");
    if (!drawer) return;

    if (forceOpen === true) {
      window.openGroupDrawer();
      return;
    }
    if (forceOpen === false) {
      window.closeGroupDrawer();
      return;
    }

    // Toggle drawer logic
    drawer.classList.remove("hidden", "-translate-x-full", "pointer-events-none");
    drawer.style.display = "flex";
    drawer.style.transform = "translateX(0%)";
    drawer.style.zIndex = "99999";
    drawer.style.opacity = "1";
    drawer.style.pointerEvents = "auto";
    const isNowOpen = drawer.classList.toggle("translate-x-0");

    if (isNowOpen) {
      drawer.classList.add("open");
      const backdrop = document.getElementById("drawerBackdrop");
      if (backdrop) {
        backdrop.classList.remove("hidden", "pointer-events-none");
        backdrop.style.display = "block";
        backdrop.style.opacity = "1";
        backdrop.style.pointerEvents = "auto";
      }
      if (typeof evaluateConvoyDistances === "function") {
        evaluateConvoyDistances();
      }
    } else {
      window.closeGroupDrawer();
    }
  } catch (err) {
    console.warn("Toggle group drawer error:", err);
  }
};
window.toggleRidersDrawer = window.toggleGroupDrawer;

// Universal Touch & Click Event Binding for mobile phones and desktop
function setupGroupButtonsTouchAndClick() {
  const groupBtns = document.querySelectorAll('#topRidersCountBtn, #topRightGroupBtn, #openRidersDrawerBtn, .group-trigger-btn');
  groupBtns.forEach(btn => {
    if (!btn || btn.dataset.touchBound === "true") return;
    btn.dataset.touchBound = "true";
    btn.style.pointerEvents = 'auto';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof window.toggleGroupDrawer === 'function') window.toggleGroupDrawer();
    });
    btn.addEventListener('touchend', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (typeof window.toggleGroupDrawer === 'function') window.toggleGroupDrawer();
    }, { passive: false });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupGroupButtonsTouchAndClick();
});
if (document.readyState !== 'loading') {
  setupGroupButtonsTouchAndClick();
}

window.copyInviteLink = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    const roomCode = (
      (typeof currentSession !== "undefined" && currentSession && currentSession.roomCode) ||
      (document.getElementById("roomCodeInput") ? document.getElementById("roomCodeInput").value : "") ||
      "DHAKA101"
    ).trim().toUpperCase();

    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    const inviteUrl = url.toString();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        if (typeof showRadarToast === "function") {
          showRadarToast("INVITE LINK COPIED", `Convoy ${roomCode} link copied! Share with your biker crew.`);
        }
      }).catch(() => {
        prompt("Copy convoy tour invite link:", inviteUrl);
      });
    } else {
      prompt("Copy convoy tour invite link:", inviteUrl);
    }
  } catch (err) {
    console.warn("Copy invite link notice:", err);
  }
};

window.openReportPoliceModal = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    const confirmRoomCodeSpan = document.getElementById("confirmRoomCodeSpan");
    if (confirmRoomCodeSpan) {
      confirmRoomCodeSpan.textContent = (typeof currentSession !== "undefined" && currentSession && currentSession.roomCode) ? currentSession.roomCode : "TOUR";
    }
    const policeConfirmModal = document.getElementById("policeConfirmModal");
    if (policeConfirmModal) {
      policeConfirmModal.classList.remove("hidden");
    }
  } catch (err) {
    console.warn("Open report police modal notice:", err);
  }
};

window.toggleSimDevPanel = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    const simPanel = document.getElementById("simPanel");
    if (simPanel) {
      const isHidden = simPanel.classList.contains("opacity-0");
      if (isHidden) {
        simPanel.classList.remove("opacity-0", "pointer-events-none", "translate-y-8");
        simPanel.classList.add("opacity-100", "translate-y-0");
        if (typeof updateSimTargetPoliceInfo === "function") updateSimTargetPoliceInfo();
      } else {
        simPanel.classList.add("opacity-0", "pointer-events-none", "translate-y-8");
        simPanel.classList.remove("opacity-100", "translate-y-0");
      }
    }
  } catch (err) {
    console.warn("Toggle sim dev panel notice:", err);
  }
};

window.leaveActiveTour = function() {
  try {
    if (typeof playSound === "function") playSound("click");
    if (confirm("Are you sure you want to leave this convoy tour?")) {
      if (typeof clearSession === "function") clearSession();
    }
  } catch (err) {
    console.warn("Leave active tour notice:", err);
  }
};

// ==========================================
// 1. SUPABASE INITIALIZATION (sbClient)
// ==========================================
const SUPABASE_URL = "https://iblaigoargdzrpahktxt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iXppRFLUtwNngEd1m80zVw_lWS8HgMV";

// Direct Supabase REST API Helper (fetch with sb_publishable key & PostgREST headers)
async function supabaseRest(endpoint, method = "GET", body = null) {
  const url = `https://iblaigoargdzrpahktxt.supabase.co/rest/v1/${endpoint}`;
  const options = {
    method: method.toUpperCase(),
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Prefer": "return=representation,resolution=merge-duplicates"
    }
  };

  if (body !== null && options.method !== "GET" && options.method !== "HEAD") {
    options.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    let errBody = null;
    try {
      errBody = await res.json();
    } catch (e) {}
    const errMsg = (errBody && (errBody.message || errBody.error || errBody.details)) || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errMsg);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
window.supabaseRest = supabaseRest;

// Note: Avoid variable name collision with window.supabase from CDN
let sbClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === "function") {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.warn("Initial Supabase client setup notice:", err);
}

// ==========================================
// 2. GLOBAL STATE & SESSION CONFIG
// ==========================================
const SESSION_STORAGE_KEY = "cholo_ghuri_session";

let currentSession = {
  riderId: null,
  riderName: "",
  roomCode: "",
  isLeader: false
};

// Live Rider Telemetry (Default: Dhaka Highway Core)
let riderLocation = {
  lat: 23.8103,
  lng: 90.4125,
  speed: 0, // km/h
  heading: 0, // degrees
  accuracy: 10
};

// Map & Navigation State
let speedLimit = 80; // km/h
let currentRoadName = "Dhaka - Mawa Expressway (N8)";
let currentRoadType = "Expressway / Trunk Highway";
let lastGeocodeLat = 0;
let lastGeocodeLng = 0;
let lastGeocodeTime = 0;
let isCameraLocked = true;
let isAudioMuted = false;
let audioCtx = null;
let watchId = null;

// Supabase Channels & Timers
let realtimeChannel = null;
let ridersDbSubscription = null;
let policeDbSubscription = null;
let upsertInterval = null;
let lastBroadcastTime = 0;
let lastUpsertTime = 0;

// Convoy Members Map: riderId -> Rider Object
const allConvoyRiders = new Map();

// Police Reports Map: reportId -> { id, lat, lng, reported_by, true_votes, false_votes, created_at, marker, circle }
const policeReportsMap = new Map();

// Leaflet Map & Markers
let map = null;
let userMarker = null;
const remoteRiderMarkers = new Map(); // riderId -> Leaflet marker

// Alerts & Proximity Tracking
const MAX_CONVOY_DISTANCE_KM = 1.5;
let activeStragglerAlert = null;
let lastConvoyAlarmTime = 0;

const APPROACHING_POLICE_DISTANCE_KM = 1.5;
const VERIFY_POLICE_TRIGGER_DISTANCE_KM = 0.5; // 500 meters
let closestApproachingPolice = null;
let lastPoliceVoiceAnnounceTime = 0;
let activeVerifyReportId = null;

// Road Transition Popup Timer
let roadPopupTimer = null;

// PC Simulator & Dev Tools State
let isSimulating = false;
let simInterval = null;
let simRouteIndex = 0;
let simProgress = 0;
let simSpeed = 75; // km/h
let currentSimRouteKey = "mawa";
let isTeleportClickActive = false; // PC Click map to move

// Simulation Highway Waypoints & Road Profiles
const SIM_ROUTES = {
  mawa: {
    name: "Dhaka - Mawa Expressway (N8)",
    type: "National Highway (N8)",
    speedLimit: 80,
    coords: [
      [23.6708, 90.3922],
      [23.6540, 90.3860],
      [23.6395, 90.3801],
      [23.6180, 90.3720],
      [23.5976, 90.3644],
      [23.5740, 90.3490],
      [23.5512, 90.3341],
      [23.5240, 90.3175],
      [23.4981, 90.3015],
      [23.4735, 90.2789],
      [23.4542, 90.2605]
    ]
  },
  purbachal: {
    name: "Purbachal 300ft Expressway",
    type: "Expressway Highway",
    speedLimit: 70,
    coords: [
      [23.8223, 90.4358],
      [23.8260, 90.4490],
      [23.8291, 90.4612],
      [23.8325, 90.4740],
      [23.8354, 90.4856],
      [23.8385, 90.4980],
      [23.8415, 90.5102],
      [23.8445, 90.5225],
      [23.8472, 90.5348],
      [23.8521, 90.5590]
    ]
  },
  hatirjheel: {
    name: "Hatirjheel Scenic Ring Loop",
    type: "City Arterial Loop",
    speedLimit: 50,
    coords: [
      [23.7745, 90.4085],
      [23.7730, 90.4140],
      [23.7702, 90.4180],
      [23.7675, 90.4165],
      [23.7665, 90.4140],
      [23.7645, 90.4090],
      [23.7630, 90.4030],
      [23.7655, 90.3995],
      [23.7680, 90.3980],
      [23.7715, 90.4020],
      [23.7745, 90.4085]
    ]
  }
};

// ==========================================
// 3. SOUND SYNTHESIZER (Native WebAudio API)
// ==========================================
function getAudioContext() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn("AudioContext setup notice:", err);
  }
  return audioCtx;
}

function playSound(type) {
  if (isAudioMuted) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "engine") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (type === "police") {
      // Dual-tone Police Siren
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.setValueAtTime(950, now + 0.15);
      osc.frequency.setValueAtTime(700, now + 0.3);
      osc.frequency.setValueAtTime(950, now + 0.45);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === "overspeed") {
      // Rapid Warning Beeps
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(1100, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === "convoyAlarm") {
      // Piercing Convoy Distance Alert Alarm
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "square";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(950, now);
      osc1.frequency.setValueAtTime(1600, now + 0.15);
      osc1.frequency.setValueAtTime(950, now + 0.3);
      osc1.frequency.setValueAtTime(1600, now + 0.45);

      osc2.frequency.setValueAtTime(475, now);
      osc2.frequency.setValueAtTime(800, now + 0.15);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.65);
      osc2.stop(now + 0.65);
    } else if (type === "roadChange") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(1040, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "join") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "deleteReport") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    console.warn("Audio playback notice:", err);
  }
}

// ==========================================
// 4. TEXT-TO-SPEECH ANNOUNCER
// ==========================================
function speakAnnouncement(text) {
  if (isAudioMuted || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis notice:", err);
  }
}

// ==========================================
// 5. HAVERSINE FORMULA & GEODESIC MATH
// ==========================================
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==========================================
// 6. CROWDSOURCED POLICE RADAR & REPORTING
// ==========================================
async function reportPoliceCheckpost() {
  const reporterName = currentSession.riderName || "Rider";
  const newReport = {
    id: generateUUID(),
    lat: riderLocation.lat,
    lng: riderLocation.lng,
    reported_by: reporterName,
    true_votes: 1,
    false_votes: 0,
    created_at: new Date().toISOString()
  };

  addOrUpdatePoliceMarker(newReport);
  showRadarToast("🚓 POLICE RADAR BROADCAST", "Police Checkpost Reported on Map!");
  playSound("police");

  if (realtimeChannel) {
    realtimeChannel.send({
      type: "broadcast",
      event: "police_alert",
      payload: newReport
    });
  }

  if (sbClient) {
    try {
      const { data, error } = await sbClient
        .from("police_reports")
        .insert({
          lat: newReport.lat,
          lng: newReport.lng,
          reported_by: newReport.reported_by,
          true_votes: 1,
          false_votes: 0,
          created_at: newReport.created_at
        })
        .select()
        .single();

      if (!error && data && data.id) {
        if (newReport.id !== data.id) {
          const existing = policeReportsMap.get(newReport.id);
          policeReportsMap.delete(newReport.id);
          newReport.id = data.id;
          if (existing) {
            existing.id = data.id;
            policeReportsMap.set(data.id, existing);
          }
        }
      } else if (error) {
        console.debug("[Supabase police_reports insert note]", error.message);
      }
    } catch (err) {
      console.debug("[Supabase police_reports insert error]", err);
    }
  }

  evaluatePoliceProximity();
}

async function fetchPoliceReports() {
  try {
    const reports = await supabaseRest("police_reports?select=*", "GET");
    if (Array.isArray(reports)) {
      reports.forEach((r) => addOrUpdatePoliceMarker(r));
      evaluatePoliceProximity();
    }
    return { success: true };
  } catch (err) {
    console.debug("[supabaseRest police_reports fetch error]", err);
    return { success: false, error: err.message };
  }
}

function subscribePoliceReports() {
  if (!sbClient) return;

  if (policeDbSubscription) {
    sbClient.removeChannel(policeDbSubscription);
  }

  policeDbSubscription = sbClient
    .channel("police_reports_realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "police_reports"
      },
      (payload) => {
        handlePoliceReportDbChange(payload);
      }
    )
    .subscribe();
}

function handlePoliceReportDbChange(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "DELETE") {
    if (oldRecord && oldRecord.id) {
      removePoliceMarker(oldRecord.id);
      showRadarToast("RADAR CLEANUP", "Fake/Expired Police Report automatically removed from map.");
    }
    return;
  }

  if (eventType === "INSERT") {
    if (newRecord) {
      addOrUpdatePoliceMarker(newRecord);
      showRadarToast("🚓 POLICE CHECKPOST DETECTED", `Reported by ${newRecord.reported_by || "Biker"}`);
      playSound("police");
    }
  } else if (eventType === "UPDATE") {
    if (newRecord) {
      addOrUpdatePoliceMarker(newRecord);
      checkAutoRemovalCondition(newRecord);
      if (activeVerifyReportId === newRecord.id) {
        openVerifyPoliceModal(newRecord.id);
      }
    }
  }

  evaluatePoliceProximity();
}

function addOrUpdatePoliceMarker(report) {
  if (!map || !report || !report.lat || !report.lng) return;

  const reportId = report.id || `police_${report.lat.toFixed(4)}_${report.lng.toFixed(4)}`;
  report.id = reportId;

  if (policeReportsMap.has(reportId)) {
    const existing = policeReportsMap.get(reportId);
    existing.true_votes = report.true_votes || existing.true_votes || 1;
    existing.false_votes = report.false_votes || existing.false_votes || 0;
    return;
  }

  const policeIcon = L.divIcon({
    className: "custom-police-icon",
    html: `
      <div class="police-marker-container">
        <div class="police-marker-beacon"></div>
        <div class="police-marker-body">
          <i class="fa-solid fa-shield-halved text-sm"></i>
        </div>
      </div>
    `,
    iconSize: [60, 60],
    iconAnchor: [30, 30]
  });

  const marker = L.marker([report.lat, report.lng], { icon: policeIcon, zIndexOffset: 2000 }).addTo(map);

  const circle = L.circle([report.lat, report.lng], {
    radius: 300,
    color: "#ff1e42",
    fillColor: "#ff1e42",
    fillOpacity: 0.16,
    weight: 2,
    dashArray: "6, 6"
  }).addTo(map);

  marker.on("click", () => {
    playSound("click");
    openVerifyPoliceModal(reportId);
  });

  circle.on("click", () => {
    playSound("click");
    openVerifyPoliceModal(reportId);
  });

  report.marker = marker;
  report.circle = circle;
  policeReportsMap.set(reportId, report);

  updateSimTargetPoliceInfo();
}

function removePoliceMarker(reportId) {
  if (policeReportsMap.has(reportId)) {
    const r = policeReportsMap.get(reportId);
    if (r.marker && map) map.removeLayer(r.marker);
    if (r.circle && map) map.removeLayer(r.circle);
    policeReportsMap.delete(reportId);
    playSound("deleteReport");

    if (activeVerifyReportId === reportId) {
      closeVerifyPoliceModal();
    }

    updateSimTargetPoliceInfo();
    evaluatePoliceProximity();
  }
}

// ==========================================
// 7. APPROACHING POLICE RADAR ALERT
// ==========================================
function evaluatePoliceProximity() {
  let closest = null;
  let minDistanceKm = Infinity;

  policeReportsMap.forEach((report) => {
    const dist = calculateDistanceKm(riderLocation.lat, riderLocation.lng, report.lat, report.lng);
    report.distanceToBiker = dist;

    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      closest = report;
    }
  });

  const banner = document.getElementById("approachingPoliceBanner");
  const bannerText = document.getElementById("approachingPoliceText");

  if (closest && minDistanceKm <= APPROACHING_POLICE_DISTANCE_KM) {
    closestApproachingPolice = closest;
    const distFormatted = minDistanceKm < 1 ? `${Math.round(minDistanceKm * 1000)} meters` : `${minDistanceKm.toFixed(1)} km`;

    if (banner) banner.classList.remove("hidden");
    if (bannerText) {
      bannerText.textContent = `🚓 POLICE CHECKPOST AHEAD (${distFormatted} away) - Reported by ${closest.reported_by || "Biker"}`;
    }

    const now = Date.now();
    if (now - lastPoliceVoiceAnnounceTime > 25000) {
      lastPoliceVoiceAnnounceTime = now;
      speakAnnouncement(`Police checkpost ahead, ${distFormatted} away, reported by ${closest.reported_by || "Biker"}.`);
    }

    if (minDistanceKm <= VERIFY_POLICE_TRIGGER_DISTANCE_KM && activeVerifyReportId !== closest.id) {
      openVerifyPoliceModal(closest.id);
    }
  } else {
    closestApproachingPolice = null;
    if (banner) banner.classList.add("hidden");
  }
}

// ==========================================
// 8. TRUE/FALSE VERIFICATION & AUTO-REMOVAL
// ==========================================
function openVerifyPoliceModal(reportId) {
  const report = policeReportsMap.get(reportId);
  if (!report) return;

  activeVerifyReportId = reportId;

  const modal = document.getElementById("verifyPoliceModal");
  const reporterNameEl = document.getElementById("verifyReporterName");
  const distanceTextEl = document.getElementById("verifyDistanceText");
  const trueVotesEl = document.getElementById("verifyTrueVotes");
  const falseVotesEl = document.getElementById("verifyFalseVotes");
  const trueBarEl = document.getElementById("verifyTrueBar");
  const falseBarEl = document.getElementById("verifyFalseBar");

  const distKm = calculateDistanceKm(riderLocation.lat, riderLocation.lng, report.lat, report.lng);
  const distText = distKm < 1 ? `${Math.round(distKm * 1000)}m away` : `${distKm.toFixed(1)} km away`;

  if (reporterNameEl) reporterNameEl.textContent = report.reported_by || "Convoy Rider";
  if (distanceTextEl) distanceTextEl.textContent = distText;

  const trueVotes = report.true_votes || 1;
  const falseVotes = report.false_votes || 0;
  const totalVotes = trueVotes + falseVotes;

  if (trueVotesEl) trueVotesEl.textContent = trueVotes;
  if (falseVotesEl) falseVotesEl.textContent = falseVotes;

  const truePercent = totalVotes > 0 ? (trueVotes / totalVotes) * 100 : 100;
  const falsePercent = totalVotes > 0 ? (falseVotes / totalVotes) * 100 : 0;

  if (trueBarEl) trueBarEl.style.width = `${truePercent}%`;
  if (falseBarEl) falseBarEl.style.width = `${falsePercent}%`;

  if (modal) {
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
      modal.classList.remove("opacity-0", "pointer-events-none");
    });
  }
}

function closeVerifyPoliceModal() {
  activeVerifyReportId = null;
  const modal = document.getElementById("verifyPoliceModal");
  if (!modal) return;
  modal.classList.add("opacity-0", "pointer-events-none");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }, 300);
}

async function submitPoliceVote(reportId, isTrue) {
  const report = policeReportsMap.get(reportId);
  if (!report) return;

  if (isTrue) {
    report.true_votes = (report.true_votes || 1) + 1;
    showRadarToast("VOTE RECORDED", "👍 Verified as Active Police Checkpost!");
    playSound("join");
  } else {
    report.false_votes = (report.false_votes || 0) + 1;
    showRadarToast("VOTE RECORDED", "👎 Reported as Inactive or Fake Checkpost!");
    playSound("click");
  }

  if (sbClient && report.id) {
    try {
      await sbClient
        .from("police_reports")
        .update({
          true_votes: report.true_votes,
          false_votes: report.false_votes
        })
        .eq("id", report.id);
    } catch (err) {
      console.debug("[Supabase vote update note]", err);
    }
  }

  checkAutoRemovalCondition(report);
  openVerifyPoliceModal(reportId);
  updateSimTargetPoliceInfo();
}

async function checkAutoRemovalCondition(report) {
  if (!report) return;

  const trueVotes = report.true_votes || 0;
  const falseVotes = report.false_votes || 0;
  const totalVotes = trueVotes + falseVotes;

  if (falseVotes >= 10 && totalVotes > 0 && (falseVotes / totalVotes) >= 0.8) {
    console.log(`[Auto-Removal] Triggered for Report ${report.id}: ${falseVotes}/${totalVotes} false votes. Deleting.`);

    if (sbClient && report.id) {
      try {
        await sbClient.from("police_reports").delete().eq("id", report.id);
      } catch (e) {}
    }

    removePoliceMarker(report.id);
    showRadarToast("RADAR CLEANUP", "Fake/Expired Police Report automatically removed from map.");
    speakAnnouncement("Notice: Inactive police report removed from highway radar.");
  }
}

// ==========================================
// 9. CONVOY DISTANCES & LEFT DRAWER
// ==========================================
function evaluateConvoyDistances() {
  allConvoyRiders.set(currentSession.riderId, {
    id: currentSession.riderId,
    rider_name: currentSession.riderName || "You",
    is_leader: currentSession.isLeader,
    lat: riderLocation.lat,
    lng: riderLocation.lng,
    speed: riderLocation.speed,
    heading: riderLocation.heading,
    updated_at: new Date().toISOString()
  });

  let leaderRider = null;
  for (const rider of allConvoyRiders.values()) {
    if (rider.is_leader) {
      leaderRider = rider;
      break;
    }
  }

  if (!leaderRider) {
    leaderRider = allConvoyRiders.get(currentSession.riderId) || allConvoyRiders.values().next().value;
  }

  const drawerLeaderName = document.getElementById("drawerLeaderName");
  if (drawerLeaderName && leaderRider) {
    drawerLeaderName.textContent = `Leader: ${leaderRider.rider_name}${leaderRider.id === currentSession.riderId ? " (You)" : ""}`;
  }

  let maxStraggler = null;
  let maxDistance = 0;

  allConvoyRiders.forEach((rider) => {
    if (leaderRider && rider.id !== leaderRider.id && rider.lat && rider.lng) {
      const dist = calculateDistanceKm(leaderRider.lat, leaderRider.lng, rider.lat, rider.lng);
      rider.distanceToLeader = dist;
      rider.isStraggler = dist > MAX_CONVOY_DISTANCE_KM;

      if (dist > maxDistance) {
        maxDistance = dist;
        if (rider.isStraggler) {
          maxStraggler = rider;
        }
      }
    } else {
      rider.distanceToLeader = 0;
      rider.isStraggler = false;
    }
  });

  const alertBanner = document.getElementById("convoyAlertBanner");
  const alertText = document.getElementById("convoyAlertText");

  if (maxStraggler) {
    activeStragglerAlert = maxStraggler;
    if (alertBanner) alertBanner.classList.remove("hidden");
    if (alertText) {
      alertText.textContent = `⚠️ CONVOY ALERT: ${maxStraggler.rider_name} is ${maxStraggler.distanceToLeader.toFixed(1)} km away from the group!`;
    }

    const now = Date.now();
    if (now - lastConvoyAlarmTime > 8000) {
      lastConvoyAlarmTime = now;
      playSound("convoyAlarm");
    }
  } else {
    activeStragglerAlert = null;
    if (alertBanner) alertBanner.classList.add("hidden");
  }

  renderGroupRidersList(leaderRider);
  updateRidersCount();
}

function renderGroupRidersList(leader) {
  const container = document.getElementById("ridersListContainer");
  if (!container) return;

  const riders = Array.from(allConvoyRiders.values());
  if (riders.length === 0) {
    container.innerHTML = `<div class="text-center text-xs text-slate-500 py-6">No active riders connected.</div>`;
    return;
  }

  container.innerHTML = riders
    .map((r) => {
      const isMe = r.id === currentSession.riderId;
      const isLeader = r.is_leader;
      const isStraggler = r.isStraggler;
      const speed = Math.round(r.speed || 0);
      const distText = isLeader ? "Convoy Anchor" : `${r.distanceToLeader ? r.distanceToLeader.toFixed(1) : "0.0"} km from Leader`;

      let cardClass = "rider-card";
      let statusBadge = "";

      if (isLeader) {
        cardClass += " is-leader";
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">LEADER</span>`;
      } else if (isStraggler) {
        cardClass += " straggler";
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600/30 text-rose-300 border border-red-500 animate-pulse">STRAGGLER</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">IN PACK</span>`;
      }

      return `
        <div class="${cardClass} cursor-pointer group hover:border-emerald-400 transition-all" onclick="centerOnRider('${r.id}')" title="Tap to locate ${escapeHtml(r.rider_name)} on map">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5 font-cyber font-bold text-xs text-slate-100">
              ${isLeader ? '<i class="fa-solid fa-crown text-amber-400 text-xs"></i>' : '<i class="fa-solid fa-motorcycle text-neon-green text-xs"></i>'}
              <span class="truncate max-w-[130px]">${escapeHtml(r.rider_name)}</span>
              ${isMe ? '<span class="text-[9px] text-emerald-400 font-semibold px-1 rounded bg-emerald-500/10 border border-emerald-500/30">You</span>' : ''}
            </div>
            ${statusBadge}
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-1.5">
            <span class="flex items-center gap-1">
              <i class="fa-solid fa-gauge text-slate-500 text-[10px]"></i>
              <strong class="text-neon-green font-hud">${speed}</strong> km/h
            </span>
            <span class="text-right ${isStraggler ? 'text-rose-400 font-bold' : 'text-slate-400'}">
              ${distText}
            </span>
          </div>
          <div class="pt-1.5 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-neon-green font-medium">
            <span class="flex items-center gap-1 group-hover:underline">
              <i class="fa-solid fa-location-crosshairs text-[9px]"></i> Tap to locate on map
            </span>
            <i class="fa-solid fa-chevron-right text-[8px] text-slate-500 group-hover:text-neon-green group-hover:translate-x-0.5 transition-transform"></i>
          </div>
        </div>
      `;
    })
    .join("");
}

window.centerOnRider = function(riderId) {
  const rider = allConvoyRiders.get(riderId);
  if (rider && rider.lat && rider.lng && map) {
    isCameraLocked = false;
    updateRecenterButtonUI();
    map.flyTo([rider.lat, rider.lng], 16, { animate: true, duration: 0.8 });
    showRadarToast("LOCATING RIDER", `Focused on ${rider.rider_name}`);
    playSound("click");
    // On mobile devices, auto-close the drawer so the rider is clearly visible on map
    if (window.innerWidth < 768) {
      if (typeof window.closeGroupDrawer === "function") {
        window.closeGroupDrawer();
      } else if (typeof window.toggleGroupDrawer === "function") {
        window.toggleGroupDrawer(false);
      }
    }
  }
};

// ==========================================
// 10. ROAD TRANSITIONS & SPEED LIMITS
// ==========================================
async function detectRoadTransition(lat, lng, force = false) {
  const now = Date.now();
  const movedKm = calculateDistanceKm(lastGeocodeLat, lastGeocodeLng, lat, lng);

  if (!force && (now - lastGeocodeTime < 12000) && movedKm < 0.1) {
    return;
  }

  lastGeocodeTime = now;
  lastGeocodeLat = lat;
  lastGeocodeLng = lng;

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, { headers: { "Accept-Language": "en" } });

    if (!response.ok) return;
    const data = await response.json();

    if (data && data.address) {
      const addr = data.address;
      const detectedRoad = addr.road || addr.highway || addr.suburb || addr.quarter || data.display_name.split(",")[0];
      const highwayTag = (addr.highway || "").toLowerCase();

      let detectedLimit = 80;
      let detectedType = "Highway / Expressway";

      if (
        highwayTag === "motorway" ||
        highwayTag === "motorway_link" ||
        highwayTag === "trunk" ||
        highwayTag === "trunk_link" ||
        highwayTag === "expressway" ||
        /expressway|highway/i.test(detectedRoad)
      ) {
        detectedLimit = 80;
        detectedType = "Expressway / Trunk Highway (80 km/h)";
      } else if (
        highwayTag === "primary" ||
        highwayTag === "primary_link" ||
        highwayTag === "secondary" ||
        highwayTag === "secondary_link" ||
        highwayTag === "tertiary" ||
        highwayTag === "tertiary_link" ||
        /arterial|avenue|bypass/i.test(detectedRoad)
      ) {
        detectedLimit = 60;
        detectedType = "Primary / Secondary Road (60 km/h)";
      } else {
        detectedLimit = 40;
        detectedType = "Residential / City Street (40 km/h)";
      }

      if (detectedRoad && detectedRoad !== currentRoadName) {
        triggerRoadTransitionPopup(detectedRoad, detectedLimit, detectedType);
      }
    }
  } catch (err) {
    console.debug("Road query notice:", err);
  }
}

function triggerRoadTransitionPopup(newRoadName, newSpeedLimit, newRoadType = "Highway / Expressway") {
  currentRoadName = newRoadName;
  speedLimit = newSpeedLimit;
  currentRoadType = newRoadType;

  const currentRoadBanner = document.getElementById("currentRoadBanner");
  if (currentRoadBanner) currentRoadBanner.textContent = newRoadName;

  const speedLimitVal = document.getElementById("speedLimitVal");
  if (speedLimitVal) speedLimitVal.textContent = newSpeedLimit;

  const modal = document.getElementById("roadTransitionModal");
  const roadNameEl = document.getElementById("popupRoadName");
  const roadTypeEl = document.getElementById("popupRoadType");
  const speedLimitEl = document.getElementById("popupSpeedLimit");
  const voiceMsgEl = document.getElementById("popupVoiceMsg");

  if (roadNameEl) roadNameEl.textContent = newRoadName;
  if (roadTypeEl) roadTypeEl.textContent = newRoadType;
  if (speedLimitEl) speedLimitEl.textContent = newSpeedLimit;
  if (voiceMsgEl) voiceMsgEl.textContent = `Announced: Speed limit updated to ${newSpeedLimit} KM/H!`;

  if (modal) {
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    requestAnimationFrame(() => {
      modal.classList.remove("opacity-0", "pointer-events-none");
    });
  }

  const progressBar = document.getElementById("roadProgressBar");
  if (progressBar) {
    progressBar.style.animation = "none";
    progressBar.offsetHeight;
    progressBar.style.animation = "roadTimer 5s linear forwards";
  }

  playSound("roadChange");
  speakAnnouncement(`Entering ${newRoadName}. Speed limit is ${newSpeedLimit} kilometers per hour.`);

  if (roadPopupTimer) clearTimeout(roadPopupTimer);
  roadPopupTimer = setTimeout(() => {
    dismissRoadTransitionPopup();
  }, 5000);
}

function dismissRoadTransitionPopup() {
  const modal = document.getElementById("roadTransitionModal");
  if (!modal) return;
  modal.classList.add("opacity-0", "pointer-events-none");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }, 350);
}

function evaluateOverspeed(currentSpeed) {
  const overspeedAlertEl = document.getElementById("overspeedBorderAlert");
  const liveSpeedEl = document.getElementById("liveSpeedDisplay");
  const speedStatusEl = document.getElementById("speedStatusLabel");
  const speedLimitSign = document.getElementById("speedLimitSign");

  const roundedSpeed = Math.max(0, Math.round(currentSpeed));

  if (roundedSpeed > speedLimit) {
    if (overspeedAlertEl) overspeedAlertEl.className = "overspeed-active";
    if (liveSpeedEl) liveSpeedEl.classList.add("speedo-warning");
    if (speedLimitSign) speedLimitSign.classList.add("scale-110", "border-red-400");
    if (speedStatusEl) {
      speedStatusEl.textContent = "⚠️ OVERSPEED!";
      speedStatusEl.className = "text-[9px] font-black text-rose-500 uppercase tracking-wider animate-pulse";
    }
    playSound("overspeed");
  } else {
    if (overspeedAlertEl) overspeedAlertEl.className = "opacity-0";
    if (liveSpeedEl) liveSpeedEl.classList.remove("speedo-warning");
    if (speedLimitSign) speedLimitSign.classList.remove("scale-110", "border-red-400");
    if (speedStatusEl) {
      if (roundedSpeed < 5) {
        speedStatusEl.textContent = "IDLING";
        speedStatusEl.className = "text-[9px] font-semibold text-slate-400 uppercase tracking-wider";
      } else if (roundedSpeed < 50) {
        speedStatusEl.textContent = "CRUISING";
        speedStatusEl.className = "text-[9px] font-semibold text-emerald-400 uppercase tracking-wider";
      } else {
        speedStatusEl.textContent = "HIGHWAY PACE";
        speedStatusEl.className = "text-[9px] font-semibold text-cyan-400 uppercase tracking-wider";
      }
    }
  }
}

// ==========================================
// 11. SUPABASE DATABASE & REALTIME SYNC
// ==========================================
// DB Sync Status indicator state
let lastSyncErrorMessage = null;
let hasShownSyncErrorToast = false;
let dualSyncInterval = null;

function updateSyncStatusUI(isSuccess, errorMsg = "") {
  const syncDot = document.getElementById("dbSyncDot");
  const syncWrapper = document.getElementById("dbSyncStatusWrapper");

  if (!syncDot) return;

  if (isSuccess) {
    syncDot.className = "w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(0,255,136,0.85)] transition-all duration-300";
    if (syncWrapper) {
      syncWrapper.title = `Supabase DB Synced (Room: ${currentSession.roomCode || "Active"})`;
    }
    hasShownSyncErrorToast = false;
    lastSyncErrorMessage = null;
  } else {
    syncDot.className = "w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(255,30,66,0.85)] animate-pulse transition-all duration-300";
    const msg = errorMsg || "Connection failed";
    if (syncWrapper) {
      syncWrapper.title = `Supabase Sync Error: ${msg}`;
    }
    if (msg !== lastSyncErrorMessage) {
      console.warn("[CholoGhuri DB Sync Error]:", msg);
      lastSyncErrorMessage = msg;
      if (!hasShownSyncErrorToast && currentSession.roomCode && currentSession.roomCode !== "----") {
        hasShownSyncErrorToast = true;
        if (typeof showRadarToast === "function") {
          showRadarToast("DB SYNC NOTICE", `Cloud sync notice: ${msg.slice(0, 45)}... Using fallback sync.`);
        }
      }
    }
  }
}

async function upsertLiveRiderData(force = false) {
  if (!currentSession.roomCode || currentSession.roomCode === "----" || !currentSession.riderId) return { success: true };

  const now = Date.now();
  if (!force && now - lastUpsertTime < 1200) {
    return { success: true };
  }
  lastUpsertTime = now;

  const cleanRoom = currentSession.roomCode.trim().toUpperCase();
  try {
    const payload = {
      id: currentSession.riderId,
      room_code: cleanRoom,
      rider_name: currentSession.riderName || "Rider",
      is_leader: Boolean(currentSession.isLeader),
      lat: riderLocation.lat,
      lng: riderLocation.lng,
      speed: Math.round((riderLocation.speed || 0) * 10) / 10,
      updated_at: new Date().toISOString()
    };

    await supabaseRest("riders?on_conflict=id", "POST", payload);
    return { success: true };
  } catch (err) {
    console.debug("[supabaseRest riders upsert error]", err);
    return { success: false, error: err.message };
  }
}

async function fetchExistingRiders() {
  if (!currentSession.roomCode || currentSession.roomCode === "----") return { success: true };

  const cleanRoom = encodeURIComponent(currentSession.roomCode.trim().toUpperCase());
  try {
    const riders = await supabaseRest(
      `riders?room_code=eq.${cleanRoom}&select=*&order=updated_at.desc&limit=30`,
      "GET"
    );

    if (Array.isArray(riders)) {
      const activeDbIds = new Set();

      riders.forEach((r) => {
        if (!r || !r.id) return;
        if (r.id === currentSession.riderId) return;

        // Render ALL rows returned directly without client clock-skew filtering
        if (r.lat !== undefined && r.lat !== null && r.lng !== undefined && r.lng !== null) {
          activeDbIds.add(r.id);
          allConvoyRiders.set(r.id, r);
          updateRemoteRiderMarker(r);
        }
      });

      // Cleanup any riders in allConvoyRiders not returned in DB query (unless simulated ghost rider)
      allConvoyRiders.forEach((val, key) => {
        if (key !== currentSession.riderId && !key.startsWith("biker_") && !activeDbIds.has(key)) {
          allConvoyRiders.delete(key);
          removeRemoteRiderMarker(key);
        }
      });

      evaluateConvoyDistances();
    }
    return { success: true };
  } catch (err) {
    console.debug("[supabaseRest fetch riders error]", err);
    return { success: false, error: err.message };
  }
}

async function runDualSyncLoop() {
  if (!currentSession.roomCode || currentSession.roomCode === "----" || !currentSession.riderId) return;

  let hasError = false;
  let firstErrorMessage = "";

  // 1. Direct REST: Upsert current rider's live telemetry (POST /rest/v1/riders?on_conflict=id)
  const upsertRes = await upsertLiveRiderData(true);
  if (upsertRes && !upsertRes.success) {
    hasError = true;
    firstErrorMessage = upsertRes.error || "Upsert error";
  }

  // 2. Direct REST: Poll and sync all active riders for this room_code (order=updated_at.desc&limit=30)
  const ridersRes = await fetchExistingRiders();
  if (ridersRes && !ridersRes.success) {
    hasError = true;
    if (!firstErrorMessage) firstErrorMessage = ridersRes.error || "Fetch riders error";
  }

  // 3. Direct REST: Poll and sync all active police reports (GET /rest/v1/police_reports?select=*)
  const policeRes = await fetchPoliceReports();
  if (policeRes && !policeRes.success) {
    hasError = true;
    if (!firstErrorMessage) firstErrorMessage = policeRes.error || "Fetch police reports error";
  }

  // Update Top HUD DB Sync indicator dot
  if (hasError) {
    updateSyncStatusUI(false, firstErrorMessage);
  } else {
    updateSyncStatusUI(true);
  }
}

function subscribeRidersTable() {
  if (!sbClient || !currentSession.roomCode) return;

  if (ridersDbSubscription) {
    sbClient.removeChannel(ridersDbSubscription);
    ridersDbSubscription = null;
  }

  const cleanRoom = currentSession.roomCode.trim().toUpperCase();
  const channelName = `riders_db_${cleanRoom}`;
  try {
    ridersDbSubscription = sbClient
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "riders",
          filter: `room_code=eq.${cleanRoom}`
        },
        (payload) => {
          handleRiderDbEvent(payload);
        }
      )
      .subscribe();
  } catch (err) {
    console.debug("[subscribeRidersTable error]", err);
  }
}

function handleRiderDbEvent(payload) {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  if (eventType === "DELETE") {
    if (oldRecord && oldRecord.id) {
      allConvoyRiders.delete(oldRecord.id);
      removeRemoteRiderMarker(oldRecord.id);
      evaluateConvoyDistances();
    }
    return;
  }

  if (newRecord && newRecord.id !== currentSession.riderId) {
    allConvoyRiders.set(newRecord.id, newRecord);
    if (newRecord.lat && newRecord.lng) {
      updateRemoteRiderMarker(newRecord);
    }
    evaluateConvoyDistances();
  }
}

function joinSupabaseRoom(roomCode) {
  const cleanRoom = (roomCode || currentSession.roomCode || "").trim().toUpperCase();
  currentSession.roomCode = cleanRoom;

  // Initial immediate queries via direct REST
  fetchExistingRiders();
  fetchPoliceReports();

  if (sbClient) {
    subscribeRidersTable();
    subscribePoliceReports();

    // Setup Realtime Broadcast channel: room_${cleanRoom}
    if (realtimeChannel) {
      sbClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    const broadcastChannelName = `room_${cleanRoom}`;
    try {
      realtimeChannel = sbClient.channel(broadcastChannelName, {
        config: { presence: { key: currentSession.riderId } }
      });

      realtimeChannel
        .on("presence", { event: "sync" }, () => {
          const state = realtimeChannel.presenceState();
          Object.keys(state).forEach((key) => {
            const presences = state[key];
            if (presences && presences[0]) {
              const rider = presences[0];
              if (rider.id !== currentSession.riderId && rider.lat && rider.lng) {
                allConvoyRiders.set(rider.id, rider);
                updateRemoteRiderMarker(rider);
              }
            }
          });
          evaluateConvoyDistances();
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          if (newPresences && newPresences[0]) {
            const rider = newPresences[0];
            if (rider.id !== currentSession.riderId) {
              allConvoyRiders.set(rider.id, rider);
              showRadarToast("CONVOY SQUAD", `🏍️ ${rider.rider_name || "Biker"} joined convoy!`);
              playSound("join");
              if (rider.lat && rider.lng) {
                updateRemoteRiderMarker(rider);
              }
              evaluateConvoyDistances();
            }
          }
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          if (leftPresences && leftPresences[0]) {
            const rider = leftPresences[0];
            allConvoyRiders.delete(rider.id);
            removeRemoteRiderMarker(rider.id);
            evaluateConvoyDistances();
          }
        })
        .on("broadcast", { event: "location_update" }, ({ payload }) => {
          if (payload && payload.id !== currentSession.riderId) {
            allConvoyRiders.set(payload.id, payload);
            updateRemoteRiderMarker(payload);
            evaluateConvoyDistances();
          }
        })
        .on("broadcast", { event: "police_alert" }, ({ payload }) => {
          if (payload) {
            addOrUpdatePoliceMarker(payload);
            evaluatePoliceProximity();
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await broadcastCurrentLocation(true);
          }
        });
    } catch (chanErr) {
      console.debug("[Realtime channel subscription note]", chanErr);
    }
  }

  // Fast 2.5-second Dual Sync polling loop
  if (dualSyncInterval) clearInterval(dualSyncInterval);
  if (upsertInterval) clearInterval(upsertInterval);

  setTimeout(runDualSyncLoop, 200);
  dualSyncInterval = setInterval(runDualSyncLoop, 2500);
  upsertInterval = dualSyncInterval;
}

async function broadcastCurrentLocation(updatePresence = false) {
  if (!realtimeChannel) return;

  const now = Date.now();
  if (!updatePresence && now - lastBroadcastTime < 1000) return;
  lastBroadcastTime = now;

  const payload = {
    id: currentSession.riderId,
    rider_name: currentSession.riderName,
    is_leader: currentSession.isLeader,
    lat: riderLocation.lat,
    lng: riderLocation.lng,
    speed: Math.round(riderLocation.speed * 10) / 10,
    heading: riderLocation.heading,
    updated_at: new Date().toISOString()
  };

  realtimeChannel.send({
    type: "broadcast",
    event: "location_update",
    payload
  });

  if (updatePresence) {
    await realtimeChannel.track(payload);
  }
}

// ==========================================
// 12. LEAFLET MAP & BIKER MARKERS
// ==========================================
function initMap() {
  if (map) {
    map.invalidateSize();
    return;
  }

  // Fallback default coordinates: Dhaka, Bangladesh [23.8103, 90.4125], zoom 13
  const defaultCoords = [23.8103, 90.4125];

  map = L.map("map", {
    center: defaultCoords,
    zoom: 13,
    zoomControl: false,
    attributionControl: true
  });
  window.map = map;

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  map.on("dragstart", () => {
    isCameraLocked = false;
    updateRecenterButtonUI();
  });

  // PC Teleport / Click-to-move listener
  map.on("click", (e) => {
    if (isTeleportClickActive) {
      teleportBikerTo(e.latlng.lat, e.latlng.lng);
    }
  });

  updateUserMarker(riderLocation.lat || 23.8103, riderLocation.lng || 90.4125, riderLocation.heading || 0);

  // Invalidate size immediately and after short delay to ensure full rendering
  map.invalidateSize();
  setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  setTimeout(() => { if (map) map.invalidateSize(); }, 300);
  setTimeout(() => { if (map) map.invalidateSize(); }, 600);
}

function createBikerMarkerIcon(riderName, isLeader, speed, heading = 0) {
  const leaderClass = isLeader ? "biker-marker-leader" : "";
  const iconHtml = isLeader ? '<i class="fa-solid fa-crown text-xs"></i>' : '<i class="fa-solid fa-motorcycle text-xs"></i>';
  const roundedSpeed = Math.round(speed || 0);

  return L.divIcon({
    className: "custom-biker-icon",
    html: `
      <div class="biker-marker-container ${leaderClass}">
        <div class="biker-marker-pulse"></div>
        <div class="biker-marker-body" style="transform: rotate(${heading}deg);">
          <div class="biker-heading-arrow"></div>
          ${iconHtml}
        </div>
        <div class="biker-tag">
          ${isLeader ? "👑 " : ""}${escapeHtml(riderName)} • ${roundedSpeed} km/h
        </div>
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26]
  });
}

function updateUserMarker(lat, lng, heading) {
  if (!map) return;

  const icon = createBikerMarkerIcon(
    currentSession.riderName || "You",
    currentSession.isLeader,
    riderLocation.speed,
    heading
  );

  if (!userMarker) {
    userMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
    userMarker.setIcon(icon);
  }

  if (isCameraLocked) {
    map.panTo([lat, lng], { animate: true, duration: 0.4 });
  }
}

function updateRemoteRiderMarker(rider) {
  if (!map || rider.id === currentSession.riderId) return;

  const icon = createBikerMarkerIcon(
    rider.rider_name || "Rider",
    rider.is_leader || false,
    rider.speed || 0,
    rider.heading || 0
  );

  if (remoteRiderMarkers.has(rider.id)) {
    const marker = remoteRiderMarkers.get(rider.id);
    marker.setLatLng([rider.lat, rider.lng]);
    marker.setIcon(icon);
  } else {
    const marker = L.marker([rider.lat, rider.lng], { icon, zIndexOffset: 500 }).addTo(map);
    remoteRiderMarkers.set(rider.id, marker);
  }
}

function removeRemoteRiderMarker(riderId) {
  if (remoteRiderMarkers.has(riderId)) {
    const marker = remoteRiderMarkers.get(riderId);
    map.removeLayer(marker);
    remoteRiderMarkers.delete(riderId);
  }
}

// ==========================================
// 13. GPS TELEMETRY & HARDWARE TRACKING
// ==========================================
function requestQuickGeolocation() {
  const DHAKA_LAT = 23.8103;
  const DHAKA_LNG = 90.4125;
  let hasResolved = false;

  // Immediate dark map centering on Dhaka if no location set yet
  if (typeof map !== "undefined" && map) {
    if (!riderLocation.lat || !riderLocation.lng) {
      riderLocation.lat = DHAKA_LAT;
      riderLocation.lng = DHAKA_LNG;
    }
    updateUserMarker(riderLocation.lat, riderLocation.lng, riderLocation.heading || 0);
    map.invalidateSize();
  }

  // Fallback timeout: If GPS takes too long (> 2.5s) or permission slow/denied, ensure map is centered on Dhaka without freezing
  const fallbackTimer = setTimeout(() => {
    if (!hasResolved) {
      hasResolved = true;
      console.log("[Geolocation] Quick GPS lookup timed out (2.5s) - defaulted to Dhaka coords.");
      if (typeof map !== "undefined" && map) {
        map.setView([DHAKA_LAT, DHAKA_LNG], 13);
        map.invalidateSize();
      }
      if (!isSimulating && typeof startGPSTracking === "function") {
        startGPSTracking();
      }
    }
  }, 2500);

  try {
    if ("geolocation" in navigator && typeof navigator.geolocation.getCurrentPosition === "function") {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (hasResolved) return;
          hasResolved = true;
          clearTimeout(fallbackTimer);

          try {
            const { latitude, longitude, speed, heading, accuracy } = pos.coords;
            const speedKmH = speed !== null && speed >= 0 ? speed * 3.6 : 0;
            const validHeading = heading !== null && !isNaN(heading) ? heading : (riderLocation.heading || 0);

            riderLocation.lat = latitude;
            riderLocation.lng = longitude;
            riderLocation.speed = speedKmH;
            riderLocation.heading = validHeading;
            riderLocation.accuracy = accuracy || 10;

            updateUserMarker(latitude, longitude, validHeading);
            updateSpeedometerDisplay(speedKmH);
            evaluateOverspeed(speedKmH);
            updateCompassHeading(validHeading);

            if (typeof map !== "undefined" && map) {
              map.setView([latitude, longitude], 15);
              map.invalidateSize();
            }

            detectRoadTransition(latitude, longitude, true);
            broadcastCurrentLocation();
            upsertLiveRiderData();
            evaluateConvoyDistances();
            evaluatePoliceProximity();
          } catch (posErr) {
            console.warn("GPS position update error handled:", posErr);
          }

          if (!isSimulating && typeof startGPSTracking === "function") {
            startGPSTracking();
          }
        },
        (err) => {
          if (hasResolved) return;
          hasResolved = true;
          clearTimeout(fallbackTimer);
          console.warn("GPS permission slow, denied, or error:", err.message);

          if (typeof map !== "undefined" && map) {
            map.setView([DHAKA_LAT, DHAKA_LNG], 13);
            map.invalidateSize();
          }

          if (!isSimulating && typeof startGPSTracking === "function") {
            startGPSTracking();
          }
        },
        { enableHighAccuracy: true, timeout: 2500, maximumAge: 5000 }
      );
    } else {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(fallbackTimer);
      if (!isSimulating && typeof startGPSTracking === "function") {
        startGPSTracking();
      }
    }
  } catch (geoCatch) {
    if (!hasResolved) {
      hasResolved = true;
      clearTimeout(fallbackTimer);
      console.warn("Geolocation try/catch captured exception:", geoCatch);
      if (typeof map !== "undefined" && map) {
        map.setView([DHAKA_LAT, DHAKA_LNG], 13);
        map.invalidateSize();
      }
      if (!isSimulating && typeof startGPSTracking === "function") {
        startGPSTracking();
      }
    }
  }
}

function startGPSTracking() {
  if (isSimulating) return;

  if (!("geolocation" in navigator)) {
    console.warn("Geolocation API not supported. Falling back to simulation.");
    startHighwaySimulation();
    return;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 1000
  };

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (isSimulating) return;

      const { latitude, longitude, speed, heading, accuracy } = pos.coords;
      const speedKmH = speed !== null && speed >= 0 ? speed * 3.6 : 0;
      const validHeading = heading !== null && !isNaN(heading) ? heading : riderLocation.heading;

      riderLocation.lat = latitude;
      riderLocation.lng = longitude;
      riderLocation.speed = speedKmH;
      riderLocation.heading = validHeading;
      riderLocation.accuracy = accuracy;

      updateUserMarker(latitude, longitude, validHeading);
      updateSpeedometerDisplay(speedKmH);
      evaluateOverspeed(speedKmH);
      updateCompassHeading(validHeading);

      detectRoadTransition(latitude, longitude);
      broadcastCurrentLocation();
      upsertLiveRiderData();
      evaluateConvoyDistances();
      evaluatePoliceProximity();
    },
    (err) => {
      console.warn("GPS tracking notice:", err.message);
      if (!isSimulating && userMarker === null) {
        startHighwaySimulation();
      }
    },
    options
  );
}

function stopGPSTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

// ==========================================
// 14. PC TESTING SIMULATOR (DEV TOOLS)
// ==========================================
function teleportBikerTo(lat, lng) {
  riderLocation.lat = lat;
  riderLocation.lng = lng;

  updateUserMarker(lat, lng, riderLocation.heading);
  detectRoadTransition(lat, lng, true);

  broadcastCurrentLocation();
  upsertLiveRiderData();
  evaluateConvoyDistances();
  evaluatePoliceProximity();

  showRadarToast("BIKER TELEPORTED", `Moved to [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
  playSound("click");
}

function toggleTeleportMode() {
  isTeleportClickActive = !isTeleportClickActive;
  const body = document.body;
  const statusText = document.getElementById("teleportStatusText");
  const dot = document.getElementById("teleportIndicatorDot");
  const btn = document.getElementById("simTeleportToggleBtn");

  if (isTeleportClickActive) {
    body.classList.add("teleport-active");
    if (statusText) statusText.textContent = "Click Map";
    if (dot) dot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-ping";
    if (btn) btn.className = "px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500 text-[11px] font-cyber font-bold text-emerald-300 transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20";
    showRadarToast("TELEPORT ACTIVE", "Click anywhere on map to move your biker!");
  } else {
    body.classList.remove("teleport-active");
    if (statusText) statusText.textContent = "Disabled";
    if (dot) dot.className = "w-2 h-2 rounded-full bg-slate-500";
    if (btn) btn.className = "px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-cyber font-bold text-slate-300 transition-all flex items-center gap-1.5";
  }
  playSound("click");
}

function startHighwaySimulation() {
  stopGPSTracking();
  isSimulating = true;

  const routeData = SIM_ROUTES[currentSimRouteKey] || SIM_ROUTES.mawa;
  currentRoadName = routeData.name;
  speedLimit = routeData.speedLimit;
  currentRoadType = routeData.type;

  const currentRoadBanner = document.getElementById("currentRoadBanner");
  if (currentRoadBanner) currentRoadBanner.textContent = currentRoadName;
  const speedLimitVal = document.getElementById("speedLimitVal");
  if (speedLimitVal) speedLimitVal.textContent = speedLimit;

  const simBtn = document.getElementById("simToggleRideBtn");
  if (simBtn) {
    simBtn.innerHTML = '<i class="fa-solid fa-pause"></i><span>Pause Sim</span>';
    simBtn.className = "px-3 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5";
  }

  if (simInterval) clearInterval(simInterval);

  simInterval = setInterval(() => {
    const coords = routeData.coords;
    if (simRouteIndex >= coords.length - 1) {
      simRouteIndex = 0;
      simProgress = 0;
    }

    simProgress += 0.05 * (simSpeed / 60);
    if (simProgress >= 1) {
      simProgress = 0;
      simRouteIndex++;
    }

    const currP1 = coords[simRouteIndex] || coords[0];
    const currP2 = coords[simRouteIndex + 1] || coords[coords.length - 1];

    const currentLat = currP1[0] + (currP2[0] - currP1[0]) * simProgress;
    const currentLng = currP1[1] + (currP2[1] - currP1[1]) * simProgress;
    const calcHeading = calculateBearing(currP1[0], currP1[1], currP2[0], currP2[1]);

    riderLocation.lat = currentLat;
    riderLocation.lng = currentLng;
    riderLocation.speed = simSpeed;
    riderLocation.heading = calcHeading;

    updateUserMarker(currentLat, currentLng, calcHeading);
    updateSpeedometerDisplay(simSpeed);
    evaluateOverspeed(simSpeed);
    updateCompassHeading(calcHeading);

    broadcastCurrentLocation();
    upsertLiveRiderData();
    evaluateConvoyDistances();
    evaluatePoliceProximity();
  }, 350);
}

function stopHighwaySimulation() {
  isSimulating = false;
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }

  const simBtn = document.getElementById("simToggleRideBtn");
  if (simBtn) {
    simBtn.innerHTML = '<i class="fa-solid fa-play"></i><span>Start Sim</span>';
    simBtn.className = "px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5";
  }

  startGPSTracking();
}

function spawnDummyFriendFarAway() {
  const ghostId = `dummy_far_${Date.now()}`;
  const ghostLat = riderLocation.lat - 0.020;
  const ghostLng = riderLocation.lng - 0.005;

  const dummyFriend = {
    id: ghostId,
    rider_name: "Farhan_GSX_Straggler",
    is_leader: false,
    lat: ghostLat,
    lng: ghostLng,
    heading: riderLocation.heading,
    speed: 45,
    updated_at: new Date().toISOString()
  };

  allConvoyRiders.set(ghostId, dummyFriend);
  updateRemoteRiderMarker(dummyFriend);
  evaluateConvoyDistances();

  showRadarToast("CONVOY DISTANCE SIMULATOR", "🏍️ Farhan_GSX placed 2.2 km away. Convoy alert triggered!");
  playSound("join");
}

function updateSimTargetPoliceInfo() {
  const targetInfoEl = document.getElementById("simTargetPoliceInfo");
  const counterEl = document.getElementById("simFalseVoteCounter");

  if (!targetInfoEl) return;

  const reports = Array.from(policeReportsMap.values());
  if (reports.length === 0) {
    targetInfoEl.textContent = "No Report Target";
    if (counterEl) counterEl.textContent = "0/10";
    return;
  }

  const target = reports[reports.length - 1];
  targetInfoEl.textContent = `${target.reported_by || "Report"} (${target.false_votes || 0}/10)`;
  if (counterEl) counterEl.textContent = `${target.false_votes || 0}/10`;
}

async function simulateFalseVoteOnReport() {
  const reports = Array.from(policeReportsMap.values());
  if (reports.length === 0) {
    dropTestPoliceCheckpostAhead();
    return;
  }

  const target = reports[reports.length - 1];
  await submitPoliceVote(target.id, false);
}

function dropTestPoliceCheckpostAhead() {
  const testReport = {
    id: generateUUID(),
    lat: riderLocation.lat + 0.002,
    lng: riderLocation.lng + 0.001,
    reported_by: "TestRider_Highway",
    true_votes: 1,
    false_votes: 0,
    created_at: new Date().toISOString()
  };

  addOrUpdatePoliceMarker(testReport);
  showRadarToast("POLICE CHECKPOST CREATED", "Dropped 220m ahead for testing!");
  playSound("police");
  evaluatePoliceProximity();
  updateSimTargetPoliceInfo();
}

// ==========================================
// 15. HUD & SESSION HELPERS
// ==========================================
function updateSpeedometerDisplay(speedKmH) {
  const liveSpeedEl = document.getElementById("liveSpeedDisplay");
  if (!liveSpeedEl) return;
  const rounded = Math.max(0, Math.round(speedKmH));
  liveSpeedEl.textContent = rounded < 10 ? `0${rounded}` : `${rounded}`;
}

function updateCompassHeading(heading) {
  const compassIcon = document.getElementById("compassIcon");
  if (compassIcon) {
    compassIcon.style.transform = `rotate(${heading - 45}deg)`;
  }
}

function updateRecenterButtonUI() {
  const lockTargetIcon = document.getElementById("lockTargetIcon");
  const recenterBtn = document.getElementById("recenterBtn");
  if (lockTargetIcon && recenterBtn) {
    if (isCameraLocked) {
      lockTargetIcon.className = "fa-solid fa-lock text-neon-green";
      recenterBtn.classList.add("border-emerald-500/60");
    } else {
      lockTargetIcon.className = "fa-solid fa-crosshairs text-slate-400";
      recenterBtn.classList.remove("border-emerald-500/60");
    }
  }
}

function updateRidersCount() {
  const total = Math.max(1, allConvoyRiders.size);
  const topCountEl = document.getElementById("activeRidersCount");
  const badgeCountEl = document.getElementById("drawerRidersCountBadge");
  const topRightEl = document.getElementById("topRightRidersCount");

  if (topCountEl) topCountEl.textContent = `${total}`;
  if (badgeCountEl) badgeCountEl.textContent = `${total}`;
  if (topRightEl) topRightEl.textContent = `${total}`;
}

function generateRoomCode() {
  const prefixes = ["DHAKA", "CHOLO", "RADAR", "CONVOY", "PADMA", "VIPER", "TURBO"];
  const randNum = Math.floor(Math.random() * 900) + 100;
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}${randNum}`;
}

function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function saveSession(riderName, roomCode, isLeader) {
  const cleanName = (riderName || "").trim();
  const cleanCode = (roomCode || "").trim().toUpperCase();

  // Fix Rider ID Collision: Generate a brand new UUID whenever clicking "START RIDING" with a different Rider Name or Room Code
  let riderId = currentSession.riderId;
  const isDifferent = !riderId ||
    !currentSession.riderName ||
    !currentSession.roomCode ||
    currentSession.riderName.trim().toLowerCase() !== cleanName.toLowerCase() ||
    currentSession.roomCode.trim().toUpperCase() !== cleanCode;

  if (isDifferent) {
    riderId = generateUUID();
  }

  currentSession = {
    riderId,
    riderName: cleanName,
    roomCode: cleanCode,
    isLeader: Boolean(isLeader)
  };

  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentSession));
  } catch (e) {}

  applySessionUI();
}

function loadSavedSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.riderName && parsed.roomCode && parsed.roomCode !== "----") {
        parsed.roomCode = parsed.roomCode.trim().toUpperCase();
        if (!parsed.riderId) {
          parsed.riderId = generateUUID();
        }
        currentSession = parsed;
        return true;
      }
    }
  } catch (e) {}
  return false;
}

function clearSession() {
  if (currentSession.riderId) {
    try {
      supabaseRest(`riders?id=eq.${encodeURIComponent(currentSession.riderId)}`, "DELETE").catch(() => {});
    } catch (e) {}
    if (sbClient) {
      sbClient
        .from("riders")
        .delete()
        .eq("id", currentSession.riderId)
        .then(() => {})
        .catch(() => {});
    }
  }

  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {}

  if (dualSyncInterval) {
    clearInterval(dualSyncInterval);
    dualSyncInterval = null;
  }
  if (upsertInterval) {
    clearInterval(upsertInterval);
    upsertInterval = null;
  }

  updateSyncStatusUI(false, "Disconnected");

  if (realtimeChannel && sbClient) {
    sbClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (ridersDbSubscription && sbClient) {
    sbClient.removeChannel(ridersDbSubscription);
    ridersDbSubscription = null;
  }
  if (policeDbSubscription && sbClient) {
    sbClient.removeChannel(policeDbSubscription);
    policeDbSubscription = null;
  }

  remoteRiderMarkers.forEach((marker) => map && map.removeLayer(marker));
  remoteRiderMarkers.clear();
  allConvoyRiders.clear();

  currentSession = {
    riderId: generateUUID(),
    riderName: "",
    roomCode: "",
    isLeader: false
  };

  showOnboardingModal(true);
}

function applySessionUI() {
  const roomCodeEl = document.getElementById("activeRoomCode");
  const drawerRoomCode = document.getElementById("drawerRoomCode");
  if (roomCodeEl) roomCodeEl.textContent = currentSession.roomCode || "DHAKA101";
  if (drawerRoomCode) drawerRoomCode.textContent = `ROOM: ${currentSession.roomCode || "DHAKA101"}`;

  const captainBadge = document.getElementById("captainBadge");
  if (captainBadge) {
    if (currentSession.isLeader) {
      captainBadge.classList.remove("hidden");
    } else {
      captainBadge.classList.add("hidden");
    }
  }

  showOnboardingModal(false);
  initMap();
  setTimeout(() => { if (map) map.invalidateSize(); }, 200);

  joinSupabaseRoom(currentSession.roomCode);

  if (!isSimulating) {
    if (typeof requestQuickGeolocation === "function") {
      requestQuickGeolocation();
    } else {
      startGPSTracking();
    }
  }
}

function showOnboardingModal(show) {
  if (show) {
    window.openJoinModal();
    if (map) {
      map.invalidateSize();
      setTimeout(() => { if (map) map.invalidateSize(); }, 100);
    }
  } else {
    window.closeJoinModal();
    if (map) {
      map.invalidateSize();
      setTimeout(() => { if (map) map.invalidateSize(); }, 150);
    }
  }
}

let toastTimeout = null;
function showRadarToast(title, body) {
  const toast = document.getElementById("radarToast");
  const toastTitle = document.getElementById("toastTitle");
  const toastBody = document.getElementById("toastBody");

  if (!toast || !toastTitle || !toastBody) return;

  toastTitle.textContent = title;
  toastBody.textContent = body;

  toast.classList.remove("-translate-y-12", "opacity-0", "pointer-events-none");
  toast.classList.add("translate-y-0", "opacity-100");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("-translate-y-12", "opacity-0", "pointer-events-none");
    toast.classList.remove("translate-y-0", "opacity-100");
  }, 4500);
}

function calculateBearing(startLat, startLng, destLat, destLng) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const y = Math.sin(toRad(destLng - startLng)) * Math.cos(toRad(destLat));
  const x =
    Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
    Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLng - startLng));

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// 16. DOM EVENT BINDINGS & APP INITIALIZATION
// ==========================================
let hasAppInitialized = false;
function initApp() {
  if (hasAppInitialized) return;
  hasAppInitialized = true;
  // Form & Inputs
  const onboardingForm = document.getElementById("onboardingForm");
  const riderNameInput = document.getElementById("riderNameInput");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const isLeaderCheckbox = document.getElementById("isLeaderCheckbox");
  const generateCodeBtn = document.getElementById("generateCodeBtn");

  // Controls & Drawer
  const recenterBtn = document.getElementById("recenterBtn");
  const reportPoliceBtn = document.getElementById("reportPoliceBtn");
  const leaveTourBtn = document.getElementById("leaveTourBtn");
  const simModeToggleBtn = document.getElementById("simModeToggleBtn");
  const openRidersDrawerBtn = document.getElementById("openRidersDrawerBtn");
  const closeRidersDrawerBtn = document.getElementById("closeRidersDrawerBtn");
  const topRidersCountBtn = document.getElementById("topRidersCountBtn");
  const ridersDrawer = document.getElementById("convoyDrawer") || 
                       document.getElementById("groupDrawer") || 
                       document.getElementById("ridersDrawer");
  const drawerBackdrop = document.getElementById("drawerBackdrop");

  // PC Dev Simulator Controls
  const simPanel = document.getElementById("simPanel");
  const closeSimPanelBtn = document.getElementById("closeSimPanelBtn");
  const simTeleportToggleBtn = document.getElementById("simTeleportToggleBtn");
  const simRouteSelect = document.getElementById("simRouteSelect");
  const simSpeedSlider = document.getElementById("simSpeedSlider");
  const simSpeedLabel = document.getElementById("simSpeedLabel");
  const simToggleRideBtn = document.getElementById("simToggleRideBtn");
  const simAddGhostRiderBtn = document.getElementById("simAddGhostRiderBtn");
  const simSpawnFriend2kmBtn = document.getElementById("simSpawnFriend2kmBtn");
  const simTriggerRoadChangeBtn = document.getElementById("simTriggerRoadChangeBtn");
  const simDropTestPoliceBtn = document.getElementById("simDropTestPoliceBtn");
  const simVoteFalsePoliceBtn = document.getElementById("simVoteFalsePoliceBtn");

  // Audio & Alerts
  const toggleAudioBtn = document.getElementById("toggleAudioBtn");
  const audioIcon = document.getElementById("audioIcon");
  const audioStatusText = document.getElementById("audioStatusText");
  const roomCodeBadgeBtn = document.getElementById("roomCodeBadgeBtn");
  const dismissToastBtn = document.getElementById("dismissToastBtn");
  const dismissConvoyAlertBtn = document.getElementById("dismissConvoyAlertBtn");
  const viewStragglerBtn = document.getElementById("viewStragglerBtn");
  const dismissRoadPopupBtn = document.getElementById("dismissRoadPopupBtn");

  // Approaching Police Alert
  const verifyApproachingBtn = document.getElementById("verifyApproachingBtn");
  const dismissApproachingBtn = document.getElementById("dismissApproachingBtn");

  // Verification Modal
  const voteTrueBtn = document.getElementById("voteTrueBtn");
  const voteFalseBtn = document.getElementById("voteFalseBtn");
  const closeVerifyModalBtn = document.getElementById("closeVerifyModalBtn");

  // Police Report Confirmation Modal
  const policeConfirmModal = document.getElementById("policeConfirmModal");
  const cancelPoliceReportBtn = document.getElementById("cancelPoliceReportBtn");
  const confirmPoliceReportBtn = document.getElementById("confirmPoliceReportBtn");
  const confirmRoomCodeSpan = document.getElementById("confirmRoomCodeSpan");

  // Pre-fill generated code
  if (roomCodeInput && !roomCodeInput.value) {
    roomCodeInput.value = generateRoomCode();
  }

  if (generateCodeBtn) {
    generateCodeBtn.addEventListener("click", () => {
      playSound("click");
      if (roomCodeInput) roomCodeInput.value = generateRoomCode();
    });
  }

  const topJoinRoomBtn = document.getElementById("topJoinRoomBtn");
  if (topJoinRoomBtn) {
    topJoinRoomBtn.addEventListener("click", () => {
      window.openJoinModal();
    });
  }

  const closeOnboardingModalBtn = document.getElementById("closeOnboardingModalBtn");
  if (closeOnboardingModalBtn) {
    closeOnboardingModalBtn.addEventListener("click", () => {
      window.closeJoinModal();
    });
  }

  const topShareRoomBtn = document.getElementById("topShareRoomBtn");
  if (topShareRoomBtn) {
    topShareRoomBtn.addEventListener("click", () => {
      window.copyInviteLink();
    });
  }

  if (roomCodeBadgeBtn) {
    roomCodeBadgeBtn.addEventListener("click", () => {
      if (currentSession.roomCode && currentSession.roomCode !== "----") {
        window.copyInviteLink();
      } else {
        window.openJoinModal();
      }
    });
  }

  const startRidingBtn = document.getElementById("startRidingBtn");
  if (startRidingBtn) {
    startRidingBtn.addEventListener("click", (e) => {
      window.submitOnboarding(e);
    });
    startRidingBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      window.submitOnboarding(e);
    }, { passive: false });
  }

  if (onboardingForm) {
    onboardingForm.addEventListener("submit", (e) => {
      window.submitOnboarding(e);
    });
  }

  if (recenterBtn) {
    recenterBtn.addEventListener("click", () => {
      window.recenterCamera();
    });
  }

  // Left Drawer Toggles - ensure universal touch & click binding
  setupGroupButtonsTouchAndClick();
  if (closeRidersDrawerBtn) {
    closeRidersDrawerBtn.addEventListener("click", (e) => {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof window.closeGroupDrawer === "function") {
        window.closeGroupDrawer();
      } else if (typeof window.toggleGroupDrawer === "function") {
        window.toggleGroupDrawer(false);
      }
    });
  }
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener("click", (e) => {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      if (typeof window.closeGroupDrawer === "function") {
        window.closeGroupDrawer();
      } else if (typeof window.toggleGroupDrawer === "function") {
        window.toggleGroupDrawer(false);
      }
    });
  }

  if (viewStragglerBtn) {
    viewStragglerBtn.addEventListener("click", () => {
      if (activeStragglerAlert) window.centerOnRider(activeStragglerAlert.id);
    });
  }

  if (dismissConvoyAlertBtn) {
    dismissConvoyAlertBtn.addEventListener("click", () => {
      const banner = document.getElementById("convoyAlertBanner");
      if (banner) banner.classList.add("hidden");
    });
  }

  // Approaching Police Alert Buttons
  if (verifyApproachingBtn) {
    verifyApproachingBtn.addEventListener("click", () => {
      if (closestApproachingPolice) {
        openVerifyPoliceModal(closestApproachingPolice.id);
      }
    });
  }

  if (dismissApproachingBtn) {
    dismissApproachingBtn.addEventListener("click", () => {
      const banner = document.getElementById("approachingPoliceBanner");
      if (banner) banner.classList.add("hidden");
    });
  }

  // Verification Modal Voting Actions
  if (voteTrueBtn) {
    voteTrueBtn.addEventListener("click", () => {
      if (activeVerifyReportId) {
        submitPoliceVote(activeVerifyReportId, true);
      }
    });
  }

  if (voteFalseBtn) {
    voteFalseBtn.addEventListener("click", () => {
      if (activeVerifyReportId) {
        submitPoliceVote(activeVerifyReportId, false);
      }
    });
  }

  if (closeVerifyModalBtn) {
    closeVerifyModalBtn.addEventListener("click", () => {
      playSound("click");
      closeVerifyPoliceModal();
    });
  }

  if (dismissRoadPopupBtn) {
    dismissRoadPopupBtn.addEventListener("click", () => {
      playSound("click");
      dismissRoadTransitionPopup();
    });
  }

  // Police Report Button
  if (reportPoliceBtn) {
    reportPoliceBtn.addEventListener("click", () => {
      window.openReportPoliceModal();
    });
  }

  if (cancelPoliceReportBtn) {
    cancelPoliceReportBtn.addEventListener("click", () => {
      playSound("click");
      if (policeConfirmModal) policeConfirmModal.classList.add("hidden");
    });
  }

  if (confirmPoliceReportBtn) {
    confirmPoliceReportBtn.addEventListener("click", () => {
      if (policeConfirmModal) policeConfirmModal.classList.add("hidden");
      reportPoliceCheckpost();
    });
  }

  if (leaveTourBtn) {
    leaveTourBtn.addEventListener("click", () => {
      window.leaveActiveTour();
    });
  }

  // Sim Mode Dev Tools Panel
  if (simModeToggleBtn) {
    simModeToggleBtn.addEventListener("click", () => {
      window.toggleSimDevPanel();
    });
  }

  if (closeSimPanelBtn) {
    closeSimPanelBtn.addEventListener("click", () => {
      playSound("click");
      if (simPanel) {
        simPanel.classList.add("opacity-0", "pointer-events-none", "translate-y-8");
        simPanel.classList.remove("opacity-100", "translate-y-0");
      }
    });
  }

  // PC Teleport Toggle
  if (simTeleportToggleBtn) {
    simTeleportToggleBtn.addEventListener("click", toggleTeleportMode);
  }

  if (simRouteSelect) {
    simRouteSelect.addEventListener("change", (e) => {
      currentSimRouteKey = e.target.value;
      simRouteIndex = 0;
      simProgress = 0;
      if (isSimulating) {
        startHighwaySimulation();
      }
    });
  }

  if (simSpeedSlider) {
    simSpeedSlider.addEventListener("input", (e) => {
      simSpeed = parseInt(e.target.value, 10);
      if (simSpeedLabel) simSpeedLabel.textContent = `${simSpeed} km/h`;
      riderLocation.speed = simSpeed;
      updateSpeedometerDisplay(simSpeed);
      evaluateOverspeed(simSpeed);
      upsertLiveRiderData();
      broadcastCurrentLocation();
    });
  }

  if (simToggleRideBtn) {
    simToggleRideBtn.addEventListener("click", () => {
      playSound("click");
      if (isSimulating) {
        stopHighwaySimulation();
      } else {
        startHighwaySimulation();
      }
    });
  }

  if (simAddGhostRiderBtn) {
    simAddGhostRiderBtn.addEventListener("click", () => {
      playSound("click");
      const ghostId = `biker_${Date.now()}`;
      const ghostRider = {
        id: ghostId,
        rider_name: "RiderX_" + Math.floor(Math.random() * 90 + 10),
        is_leader: false,
        lat: riderLocation.lat + (Math.random() - 0.5) * 0.003,
        lng: riderLocation.lng + (Math.random() - 0.5) * 0.003,
        heading: riderLocation.heading,
        speed: 70,
        updated_at: new Date().toISOString()
      };
      allConvoyRiders.set(ghostId, ghostRider);
      updateRemoteRiderMarker(ghostRider);
      evaluateConvoyDistances();
      showRadarToast("CONVOY COMPANION", `🏍️ ${ghostRider.rider_name} joined your convoy!`);
      playSound("join");
    });
  }

  // PC Dev Button: Spawn Dummy Friend > 2km Away
  if (simSpawnFriend2kmBtn) {
    simSpawnFriend2kmBtn.addEventListener("click", () => {
      playSound("click");
      spawnDummyFriendFarAway();
    });
  }

  // PC Dev Button: Drop Police Checkpost
  if (simDropTestPoliceBtn) {
    simDropTestPoliceBtn.addEventListener("click", () => {
      playSound("click");
      dropTestPoliceCheckpostAhead();
    });
  }

  // PC Dev Button: Simulate +1 False Vote on Police Report
  if (simVoteFalsePoliceBtn) {
    simVoteFalsePoliceBtn.addEventListener("click", () => {
      playSound("click");
      simulateFalseVoteOnReport();
    });
  }

  let demoRoadIndex = 0;
  const demoRoads = [
    { name: "Purbachal 300ft Expressway (N8)", limit: 80, type: "Expressway Highway (80 km/h)" },
    { name: "Mirpur - Airport Road Bypass", limit: 60, type: "Primary Arterial Highway (60 km/h)" },
    { name: "Gulshan North Avenue", limit: 40, type: "City Urban Street (40 km/h)" }
  ];

  if (simTriggerRoadChangeBtn) {
    simTriggerRoadChangeBtn.addEventListener("click", () => {
      demoRoadIndex = (demoRoadIndex + 1) % demoRoads.length;
      const road = demoRoads[demoRoadIndex];
      triggerRoadTransitionPopup(road.name, road.limit, road.type);
    });
  }

  if (toggleAudioBtn) {
    toggleAudioBtn.addEventListener("click", () => {
      isAudioMuted = !isAudioMuted;
      if (audioIcon && audioStatusText) {
        if (isAudioMuted) {
          audioIcon.className = "fa-solid fa-volume-xmark text-slate-500";
          audioStatusText.textContent = "Muted";
          audioStatusText.className = "text-slate-500";
        } else {
          audioIcon.className = "fa-solid fa-volume-high text-neon-green";
          audioStatusText.textContent = "Active";
          audioStatusText.className = "text-neon-green";
          playSound("click");
        }
      }
    });
  }

  if (dismissToastBtn) {
    dismissToastBtn.addEventListener("click", () => {
      const toast = document.getElementById("radarToast");
      if (toast) {
        toast.classList.add("-translate-y-12", "opacity-0", "pointer-events-none");
        toast.classList.remove("translate-y-0", "opacity-100");
      }
    });
  }

  // 1. Wake Lock
  try {
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").catch(() => {});
    }
  } catch (e) {}

  // 2. Verify Supabase client initialized
  try {
    if (!sbClient && window.supabase && typeof window.supabase.createClient === "function") {
      sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (err) {
    console.warn("Supabase init error handled:", err);
  }

  // 3. Initialize Map immediately with Dhaka coordinates so tiles render right away
  try {
    initMap();
  } catch (err) {
    console.warn("Leaflet Map init error handled:", err);
  }

  // 4. Check URL Invite (?room=...) & Existing Session & Initialize
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get("room") || urlParams.get("room_code");
    const hasExistingSession = loadSavedSession();

    if (roomParam) {
      const cleanParam = roomParam.trim().toUpperCase();
      console.log("Tour room invite parameter detected from URL:", cleanParam);
      if (roomCodeInput) roomCodeInput.value = cleanParam;
      if (hasExistingSession && currentSession.riderName) {
        if (riderNameInput) riderNameInput.value = currentSession.riderName;
      }
      window.openJoinModal();
      showRadarToast("CONVOY INVITE DETECTED", `Room ${cleanParam} pre-filled! Enter your name & hit Start Riding.`);
    } else if (hasExistingSession && currentSession.roomCode && currentSession.roomCode !== "----" && currentSession.riderName) {
      console.log("Restoring active biker session:", currentSession);
      if (riderNameInput) riderNameInput.value = currentSession.riderName;
      if (roomCodeInput) roomCodeInput.value = currentSession.roomCode;
      if (isLeaderCheckbox) isLeaderCheckbox.checked = currentSession.isLeader;
      applySessionUI();
    } else {
      currentSession.riderId = generateUUID();
      currentSession.roomCode = "";
      currentSession.riderName = "";
      const activeRoomCodeEl = document.getElementById("activeRoomCode");
      if (activeRoomCodeEl) activeRoomCodeEl.textContent = "----";
      window.openJoinModal();
    }
  } catch (err) {
    console.warn("Session loading error handled:", err);
    window.openJoinModal();
  }

  // 5. Handle window resizing to keep map full-screen
  try {
    window.addEventListener("resize", () => {
      if (map) map.invalidateSize();
    });
  } catch (e) {}
}

// Ensure initApp executes reliably even if DOMContentLoaded already fired
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
