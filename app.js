/**
 * CHOLO GHURI - Biker Convoy & Highway Radar
 * Mobile-First Biker Telemetry, Crowdsourced Police Radar & PC Dev Suite
 */

// ==========================================
// 0. GUARANTEED FAILSAFE LEAFLET MAP INITIALIZER & ACTION HANDLERS
// ==========================================
window.ensureLeafletMap = function() {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return null;
  if (window.map && typeof window.map.invalidateSize === 'function') {
    window.map.invalidateSize();
    return window.map;
  }
  // If Leaflet already attached to #map, clear _leaflet_id only if window.map was lost
  if (mapEl._leaflet_id && !window.map) {
    mapEl._leaflet_id = null;
    mapEl.innerHTML = '';
  }
  window.map = L.map('map', { zoomControl: false, attributionControl: true }).setView([23.8103, 90.4125], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(window.map);
  setTimeout(() => window.map.invalidateSize(), 150);
  setTimeout(() => window.map.invalidateSize(), 600);
  return window.map;
};

// Immediately ensure Leaflet map exists on script load
try {
  window.ensureLeafletMap();
} catch (e) {
  console.warn("Immediate map init warning:", e);
}
window.closeSimDevPanel = function(e) {
  if (e && e.stopPropagation) e.stopPropagation();
};

window.toggleSimDevPanel = function(e) {
  if (e && e.stopPropagation) e.stopPropagation();
};
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
  const roomCodeInput = document.getElementById("roomCodeInput");
  if (roomCodeInput && roomCodeInput.value && typeof window.checkRoomLeaderStatus === "function") {
    window.checkRoomLeaderStatus(roomCodeInput.value);
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

window.submitOnboarding = async function(event) {
  if (event) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    if (typeof event.stopPropagation === "function") event.stopPropagation();
  }

  if (typeof playSound === "function") playSound("engine");

  const riderNameInput = document.getElementById("riderNameInput");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const isLeaderCheckbox = document.getElementById("isLeaderCheckbox") || document.getElementById("isLeaderInput");

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

  // Determine Rider ID
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

  // Requirement 1: Strict Check Inside submitOnboarding
  // Before inserting/upserting the joining user into riders, perform an immediate check
  // (GET /rest/v1/riders?room_code=eq.${cleanRoom}&select=id,rider_name,is_leader).
  let wantedLeader = isLeaderCheckbox ? Boolean(isLeaderCheckbox.checked) : false;
  let finalIsLeader = wantedLeader;
  let leaderOverriddenToast = null;

  try {
    const cleanRoom = encodeURIComponent(code);
    const existingRiders = await supabaseRest(
      `riders?room_code=eq.${cleanRoom}&select=id,rider_name,is_leader`,
      "GET"
    );

    if (Array.isArray(existingRiders)) {
      const otherRiders = existingRiders.filter(r => r && r.id !== riderId);
      const existingLeader = otherRiders.find(r => r.is_leader === true);

      if (existingLeader) {
        // If room already has a leader, forcefully override isLeader = false even if checked
        finalIsLeader = false;
        if (wantedLeader) {
          leaderOverriddenToast = `ℹ️ Leader (${existingLeader.rider_name || "Captain"}) already exists in this room. Joined as Rider!`;
        }
        if (isLeaderCheckbox) {
          isLeaderCheckbox.checked = false;
          isLeaderCheckbox.disabled = true;
        }
        const notice = document.getElementById("leaderNotice");
        const noticeText = document.getElementById("leaderNoticeText");
        if (noticeText) noticeText.textContent = `👑 Leader (${existingLeader.rider_name || "Captain"}) is already in this room — joining as Rider`;
        if (notice) notice.classList.remove("hidden");
        const container = document.getElementById("leaderToggleContainer");
        if (container) container.classList.add("opacity-60");
      } else if (otherRiders.length === 0) {
        // Conversely, if the room is completely empty (0 riders in DB), make the room creator the Leader
        finalIsLeader = true;
        if (isLeaderCheckbox) {
          isLeaderCheckbox.checked = true;
          isLeaderCheckbox.disabled = false;
        }
        const notice = document.getElementById("leaderNotice");
        if (notice) notice.classList.add("hidden");
        const container = document.getElementById("leaderToggleContainer");
        if (container) container.classList.remove("opacity-60");
      }
    }
  } catch (err) {
    console.debug("[submitOnboarding leader check error]", err);
  }

  // b) Save session data correctly into sessionStorage
  const sessionData = {
    riderId,
    riderName: name,
    roomCode: code,
    isLeader: finalIsLeader
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
    if (finalIsLeader) {
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

  // e) Start the dual sync loop (runDualSyncLoop()) and show a success toast
  if (typeof joinSupabaseRoom === "function") {
    joinSupabaseRoom(code);
  }
  if (typeof runDualSyncLoop === "function") {
    runDualSyncLoop();
  }

  if (leaderOverriddenToast) {
    if (typeof showRadarToast === "function") {
      showRadarToast("CONVOY ROLE UPDATED", leaderOverriddenToast);
    }
  } else {
    if (typeof showRadarToast === "function") {
      showRadarToast(
        finalIsLeader ? "👑 Joined as Ride Leader!" : "🚀 Joined Convoy Successfully!",
        `Riding as ${name} in tour room ${code}`
      );
    }
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
      backdrop.classList.add("active", "open");
      backdrop.style.setProperty("display", "block", "important");
      backdrop.style.setProperty("opacity", "1", "important");
      backdrop.style.setProperty("pointer-events", "auto", "important");
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
      backdrop.classList.remove("active", "open");
      backdrop.classList.add("hidden", "pointer-events-none");
      backdrop.style.setProperty("display", "none", "important");
      backdrop.style.setProperty("opacity", "0", "important");
      backdrop.style.setProperty("pointer-events", "none", "important");
    }
  } catch (err) {
    console.warn("Close group drawer error:", err);
  }
};

window.toggleGroupDrawer = function(forceOpen) {
  try {
    const now = Date.now();
    const lastToggle = window._lastGroupDrawerToggleMs || 0;
    if (forceOpen === undefined && (now - lastToggle) < 250) {
      return;
    }
    window._lastGroupDrawerToggleMs = now;

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
        backdrop.classList.add("active", "open");
        backdrop.style.setProperty("display", "block", "important");
        backdrop.style.setProperty("opacity", "1", "important");
        backdrop.style.setProperty("pointer-events", "auto", "important");
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
  const groupBtns = document.querySelectorAll('#topRidersCountBtn, .group-trigger-btn');
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
    if (!window.pendingPolicePhotoData) {
      if (typeof clearPendingPolicePhoto === "function") clearPendingPolicePhoto();
    }
  } catch (err) {
    console.warn("Open report police modal notice:", err);
  }
};

// Note: window.toggleSimDevPanel and window.closeSimDevPanel defined at top-level

window.leaveActiveTour = async function() {
  try {
    if (typeof playSound === "function") playSound("click");
    const isLeader = Boolean(typeof currentSession !== "undefined" && currentSession && currentSession.isLeader);
    const confirmMsg = isLeader
      ? "👑 You are the Ride Leader (Captain).\n\nExiting will CLOSE the convoy room and DISCONNECT all teammates!\n\nAre you sure you want to end and close this convoy tour?"
      : "Are you sure you want to leave this convoy tour?";

    if (confirm(confirmMsg)) {
      if (typeof clearSession === "function") await clearSession();
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

// Walkie-Talkie Audio Priority State
window.isWalkieTalkieActive = false;
window.isRecordingPtt = false;
window.isPlayingVoice = false;

// Supabase Channels & Timers
let realtimeChannel = null;
let ridersDbSubscription = null;
let policeDbSubscription = null;
let upsertInterval = null;
let lastBroadcastTime = 0;
let lastUpsertTime = 0;

// Convoy Members Map: riderId -> Rider Object
const allConvoyRiders = new Map();

// Convoy Teammate Kick & Room Closure Tracking
window.kickedRiderIds = window.kickedRiderIds || new Set();
let hasJoinedDB = false;
let isHandlingKick = false;
let isHandlingRoomClose = false;
let isRoomClosedByLeader = false;

// Police Reports Map: reportId -> { id, lat, lng, reported_by, true_votes, false_votes, created_at, marker, circle }
const policeReportsMap = new Map();

// Leaflet Map & Markers (synchronized with window.map)
var map = window.map || (window.ensureLeafletMap ? window.ensureLeafletMap() : null);
let userMarker = null;
const remoteRiderMarkers = new Map(); // riderId -> Leaflet marker

// Alerts & Proximity Tracking
const MAX_CONVOY_DISTANCE_KM = 1.5;
let activeStragglerAlert = null;
let lastConvoyAlarmTime = 0;

const APPROACHING_POLICE_DISTANCE_KM = 1.5;
const VERIFY_POLICE_TRIGGER_DISTANCE_KM = 0.16; // 160 meters (matches the 1/3rd red zone radius)
let closestApproachingPolice = null;
let lastPoliceVoiceAnnounceTime = 0;
let activeVerifyReportId = null;

// Road Transition Popup State & Timer
let roadPopupTimer = null;
let currentRoadTransitionDetails = null;

// Floating Minimized Alert Dock & Permanent Dismiss Tracking
const DISMISSED_ALERTS_STORAGE_KEY = "cholo_ghuri_dismissed_alerts";
function getStoredDismissedAlerts() {
  try {
    const raw = sessionStorage.getItem(DISMISSED_ALERTS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch (e) {}
  return new Set();
}

window.dismissedAlertIds = getStoredDismissedAlerts();

window.isAlertDismissed = function(alertId) {
  if (!alertId) return false;
  return window.dismissedAlertIds && window.dismissedAlertIds.has(String(alertId));
};

function markAlertAsDismissed(alertId) {
  if (!alertId) return;
  window.dismissedAlertIds.add(String(alertId));
  try {
    sessionStorage.setItem(
      DISMISSED_ALERTS_STORAGE_KEY,
      JSON.stringify(Array.from(window.dismissedAlertIds))
    );
  } catch (e) {}
}
window.markAlertAsDismissed = markAlertAsDismissed;

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
  if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (type !== "click") return;
  }
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
  if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    return;
  }
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

function speakText(text) {
  if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    return;
  }
  speakAnnouncement(text);
}
window.speakText = speakText;

function announceRoadChange(newRoadName, newSpeedLimit, newRoadType = "Highway / Expressway") {
  if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    return;
  }
  playSound("roadChange");
  speakAnnouncement(`Entering ${newRoadName}. Speed limit is ${newSpeedLimit} kilometers per hour.`);
}
window.announceRoadChange = announceRoadChange;

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
window.pendingPolicePhotoData = null;

function handlePolicePhotoSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      // HTML5 Canvas auto-compression: max width/height 480px, JPEG quality 0.6
      const maxDim = 480;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.6);
      window.pendingPolicePhotoData = compressedDataUrl;

      const previewImg = document.getElementById("policePhotoPreview");
      const previewContainer = document.getElementById("policePhotoPreviewContainer");
      const triggerBtn = document.getElementById("triggerPolicePhotoBtn");

      if (previewImg) previewImg.src = compressedDataUrl;
      if (previewContainer) previewContainer.classList.remove("hidden");
      if (triggerBtn) {
        triggerBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate text-cyan-400 text-sm"></i><span>Retake / Change Photo</span>';
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearPendingPolicePhoto() {
  window.pendingPolicePhotoData = null;
  const photoInput = document.getElementById("policePhotoInput");
  const previewImg = document.getElementById("policePhotoPreview");
  const previewContainer = document.getElementById("policePhotoPreviewContainer");
  const triggerBtn = document.getElementById("triggerPolicePhotoBtn");

  if (photoInput) photoInput.value = "";
  if (previewImg) previewImg.src = "";
  if (previewContainer) previewContainer.classList.add("hidden");
  if (triggerBtn) {
    triggerBtn.innerHTML = '<i class="fa-solid fa-camera text-cyan-400 text-sm"></i><span>Take / Add Checkpost Photo (Optional)</span>';
  }
}

window.openPolicePhotoViewer = function(src) {
  if (!src) return;
  const modal = document.getElementById("policePhotoViewerModal");
  const img = document.getElementById("policePhotoViewerImg");
  if (img) img.src = src;
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
};

window.closePolicePhotoViewer = function() {
  const modal = document.getElementById("policePhotoViewerModal");
  const img = document.getElementById("policePhotoViewerImg");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
  if (img) img.src = "";
};

function createPolicePopupHtml(report) {
  const reporter = escapeHtml(report.reported_by || "Biker");
  const timeStr = report.created_at
    ? new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Just now";

  const photoHtml = report.photo_data
    ? `
    <div class="mt-2 relative">
      <img 
        src="${report.photo_data}" 
        alt="Police Checkpost" 
        class="police-popup-photo" 
        onclick="window.openPolicePhotoViewer('${report.photo_data}')"
        title="Tap to view full screen"
      />
      <div class="text-[9px] text-cyan-300 flex items-center justify-center gap-1 mt-1 font-mono">
        <i class="fa-solid fa-expand text-[8px]"></i> Tap to view full screen
      </div>
    </div>
  `
    : "";

  return `
    <div class="text-slate-100 text-xs">
      <div class="flex items-center gap-2 border-b border-red-500/30 pb-1.5 mb-2 font-cyber font-bold text-red-400">
        <i class="fa-solid fa-shield-halved text-sm animate-pulse"></i>
        <span>POLICE CHECKPOST</span>
      </div>
      <div class="text-[11px] text-slate-300 space-y-0.5">
        <div>Reported by: <span class="font-bold text-cyan-300">${reporter}</span></div>
        <div class="text-[10px] text-slate-400 flex items-center justify-between">
          <span>Time: ${timeStr}</span>
          <span class="text-emerald-400 font-bold">👍 ${report.true_votes || 1} | 👎 ${report.false_votes || 0}</span>
        </div>
      </div>
      ${photoHtml}
      <button 
        type="button" 
        onclick="window.openVerifyPoliceModal('${report.id}')"
        class="w-full mt-2.5 py-1.5 px-2 rounded-lg bg-red-600/90 hover:bg-red-500 text-white font-cyber font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
      >
        <i class="fa-solid fa-check-to-slot"></i>
        <span>Verify Checkpost</span>
      </button>
    </div>
  `;
}

async function reportPoliceCheckpost() {
  const reporterName = currentSession.riderName || "Rider";
  const photoData = window.pendingPolicePhotoData || null;

  const newReport = {
    id: generateUUID(),
    lat: riderLocation.lat,
    lng: riderLocation.lng,
    reported_by: reporterName,
    photo_data: photoData,
    true_votes: 1,
    false_votes: 0,
    created_at: new Date().toISOString()
  };

  addOrUpdatePoliceMarker(newReport);
  showRadarToast("🚓 POLICE RADAR BROADCAST", "Police Checkpost Reported on Map!" + (photoData ? " (Photo Attached)" : ""));
  playSound("police");

  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: "broadcast",
        event: "police_alert",
        payload: newReport
      });
    } catch (bcErr) {
      console.debug("[Police broadcast note]", bcErr);
    }
  }

  if (sbClient) {
    try {
      // 1. Attempt insert with photo_data
      const payloadWithPhoto = {
        lat: newReport.lat,
        lng: newReport.lng,
        reported_by: newReport.reported_by,
        true_votes: 1,
        false_votes: 0,
        created_at: newReport.created_at,
        photo_data: photoData
      };

      let { data, error } = await sbClient
        .from("police_reports")
        .insert(payloadWithPhoto)
        .select()
        .single();

      // 2. Fallback if column 'photo_data' does not exist in schema (HTTP 400 / PostgREST column missing)
      if (error && (error.code === "PGRST204" || (error.message && error.message.includes("photo_data")) || error.status === 400)) {
        console.warn("[police_reports] photo_data column missing in DB schema, fallback to insert without photo_data:", error.message);
        const payloadWithoutPhoto = {
          lat: newReport.lat,
          lng: newReport.lng,
          reported_by: newReport.reported_by,
          true_votes: 1,
          false_votes: 0,
          created_at: newReport.created_at
        };
        const fallbackRes = await sbClient
          .from("police_reports")
          .insert(payloadWithoutPhoto)
          .select()
          .single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }

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

  // Clear pending photo and preview UI after submit
  clearPendingPolicePhoto();
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
    if (report.photo_data && !existing.photo_data) {
      existing.photo_data = report.photo_data;
      if (existing.marker) {
        existing.marker.bindPopup(createPolicePopupHtml(existing), { className: "police-custom-popup", maxWidth: 260 });
      }
    }
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

  // Requirement 1: Red zone radius reduced to 1/3rd (160m instead of 300-500m)
  const circle = L.circle([report.lat, report.lng], {
    radius: 160,
    color: "#ff1e42",
    fillColor: "#ff1e42",
    fillOpacity: 0.16,
    weight: 2,
    dashArray: "6, 6"
  }).addTo(map);

  // Requirement 3: Bind custom popup with photo and verify button
  marker.bindPopup(createPolicePopupHtml(report), { className: "police-custom-popup", maxWidth: 260 });

  marker.on("click", () => {
    playSound("click");
    marker.openPopup();
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

    hideMiniPoliceAlert(reportId);

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

  const banner = document.getElementById("radarAlertBanner") || document.getElementById("approachingPoliceBanner");
  const bannerText = document.getElementById("approachingPoliceText");

  if (closest && minDistanceKm <= APPROACHING_POLICE_DISTANCE_KM) {
    closestApproachingPolice = closest;
    const distFormatted = minDistanceKm < 1 ? `${Math.round(minDistanceKm * 1000)}m` : `${minDistanceKm.toFixed(1)}km`;

    if (bannerText) {
      bannerText.textContent = `🛡️ Police • ${distFormatted}`;
    }

    const now = Date.now();
    if (now - lastPoliceVoiceAnnounceTime > 25000) {
      lastPoliceVoiceAnnounceTime = now;
      if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
        if ("speechSynthesis" in window) {
          try { window.speechSynthesis.cancel(); } catch (e) {}
        }
      } else {
        speakAnnouncement(`Police checkpost ahead, ${distFormatted} away, reported by ${closest.reported_by || "Biker"}.`);
      }
    }

    // Default: Show Minimized Round Icon in #miniAlertDock (do NOT open big banner automatically!)
    const radarAlertId = `radar_banner_${closest.id}`;
    if (!window.isAlertDismissed(radarAlertId) && !window.isAlertDismissed(closest.id)) {
      showMiniRadarAlert(closest, minDistanceKm);
    }
  } else {
    closestApproachingPolice = null;
    if (banner) banner.classList.add("hidden");
    const roadBanner = document.getElementById("currentRoadBanner");
    if (roadBanner) roadBanner.classList.remove("has-radar-alert");
    hideMiniRadarAlert(closest ? closest.id : null);
    hideMiniPoliceAlert(closest ? closest.id : null);
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

  // Show checkpost photo in verify modal if available
  const photoContainer = document.getElementById("verifyPolicePhotoContainer");
  const photoEl = document.getElementById("verifyPolicePhoto");
  if (report.photo_data) {
    if (photoEl) photoEl.src = report.photo_data;
    if (photoContainer) photoContainer.classList.remove("hidden");
  } else {
    if (photoEl) photoEl.src = "";
    if (photoContainer) photoContainer.classList.add("hidden");
  }

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

window.openVerifyPoliceModal = openVerifyPoliceModal;

function closeVerifyPoliceModal() {
  activeVerifyReportId = null;
  const modal = document.getElementById("verifyPoliceModal");
  const photoContainer = document.getElementById("verifyPolicePhotoContainer");
  const photoEl = document.getElementById("verifyPolicePhoto");
  if (photoEl) photoEl.src = "";
  if (photoContainer) photoContainer.classList.add("hidden");

  if (!modal) return;
  modal.classList.add("opacity-0", "pointer-events-none");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }, 300);
}

function minimizeVerifyPoliceModal() {
  // Closes big modal without dismissing: floating icon remains in #miniAlertDock!
  closeVerifyPoliceModal();
}
window.minimizeVerifyPoliceModal = minimizeVerifyPoliceModal;

function dismissVerifyPoliceModal() {
  if (activeVerifyReportId) {
    markAlertAsDismissed(activeVerifyReportId);
    hideMiniPoliceAlert(activeVerifyReportId);
  }
  closeVerifyPoliceModal();
}
window.dismissVerifyPoliceModal = dismissVerifyPoliceModal;

// ==========================================
// FLOATING MINIMIZED DOCK ICON HANDLERS
// ==========================================
function showMiniPoliceAlert(report, distKm) {
  if (!report || !report.id) return;
  if (window.isAlertDismissed(report.id)) return;

  const dock = document.getElementById("miniAlertDock");
  if (!dock) return;

  const itemId = `miniAlertItem_police_${report.id}`;
  let item = document.getElementById(itemId);

  const distMeters = Math.round((distKm !== undefined && distKm !== null ? distKm : 0.12) * 1000);
  const distLabel = distKm !== undefined && distKm < 1 ? `${distMeters}m` : "POLICE";

  if (!item) {
    item = document.createElement("div");
    item.id = itemId;
    item.className = "mini-alert-item mini-alert-popin";
    item.innerHTML = `
      <button 
        type="button" 
        class="mini-alert-btn police-alert" 
        onclick="window.expandMiniPoliceAlert('${report.id}')"
        title="Police Checkpost Alert (${distLabel} away) - Tap to Open Details"
      >
        <i class="fa-solid fa-shield-halved text-xl text-white"></i>
        <span class="mini-alert-badge badge-police" id="miniPoliceBadge_${report.id}">${distLabel}</span>
      </button>
      <button 
        type="button" 
        class="mini-alert-close" 
        onclick="window.dismissMiniAlert('police', '${report.id}', event)" 
        title="Permanently Dismiss (Cross)"
      >&times;</button>
    `;
    dock.appendChild(item);
  } else {
    const badge = document.getElementById(`miniPoliceBadge_${report.id}`);
    if (badge) badge.textContent = distLabel;
  }
}
window.showMiniPoliceAlert = showMiniPoliceAlert;

function hideMiniPoliceAlert(reportId) {
  if (!reportId) return;
  const itemId = `miniAlertItem_police_${reportId}`;
  const item = document.getElementById(itemId);
  if (item) {
    item.classList.add("mini-alert-popout");
    setTimeout(() => {
      if (item && item.parentNode) item.parentNode.removeChild(item);
    }, 200);
  }
}
window.hideMiniPoliceAlert = hideMiniPoliceAlert;

window.expandMiniPoliceAlert = function(reportId) {
  openVerifyPoliceModal(reportId);
};

function showMiniRoadAlert(roadName, limit, roadType, alertId) {
  if (!alertId) alertId = `road_${encodeURIComponent(roadName)}_${limit}`;
  if (window.isAlertDismissed(alertId)) return;

  currentRoadTransitionDetails = { roadName, limit, roadType, alertId };

  const dock = document.getElementById("miniAlertDock");
  if (!dock) return;

  const itemId = `miniAlertItem_road_${alertId}`;
  let item = document.getElementById(itemId);

  if (!item) {
    item = document.createElement("div");
    item.id = itemId;
    item.className = "mini-alert-item mini-alert-popin";
    item.innerHTML = `
      <button 
        type="button" 
        class="mini-alert-btn speed-alert" 
        onclick="window.expandMiniRoadAlert('${alertId}')"
        title="Speed Limit ${limit} KM/H - ${escapeHtml(roadName)} (Tap for Details)"
      >
        <div class="flex flex-col items-center justify-center -space-y-0.5 select-none pointer-events-none">
          <span class="text-base font-black font-hud text-slate-900 leading-none">${limit}</span>
          <span class="text-[7.5px] font-bold text-red-600 tracking-tighter leading-none">LIMIT</span>
        </div>
        <span class="mini-alert-badge badge-speed">${limit} KM/H</span>
      </button>
      <button 
        type="button" 
        class="mini-alert-close" 
        onclick="window.dismissMiniAlert('road', '${alertId}', event)" 
        title="Permanently Dismiss (Cross)"
      >&times;</button>
    `;
    dock.appendChild(item);
  }
}
window.showMiniRoadAlert = showMiniRoadAlert;

function hideMiniRoadAlert(alertId) {
  if (!alertId && currentRoadTransitionDetails) alertId = currentRoadTransitionDetails.alertId;
  if (!alertId) return;
  const itemId = `miniAlertItem_road_${alertId}`;
  const item = document.getElementById(itemId);
  if (item) {
    item.classList.add("mini-alert-popout");
    setTimeout(() => {
      if (item && item.parentNode) item.parentNode.removeChild(item);
    }, 200);
  }
}
window.hideMiniRoadAlert = hideMiniRoadAlert;

window.expandMiniRoadAlert = function(alertId) {
  openRoadTransitionModal();
};

// ==========================================
// RADAR ALERT (HIGHWAY POLICE RADAR) HANDLERS
// ==========================================
function showMiniRadarAlert(report, distKm) {
  if (!report || !report.id) return;
  const alertId = `radar_banner_${report.id}`;
  if (window.isAlertDismissed(alertId) || window.isAlertDismissed(report.id)) return;

  const dock = document.getElementById("miniAlertDock");
  if (!dock) return;

  const itemId = `miniAlertItem_radar_${report.id}`;
  let item = document.getElementById(itemId);

  const distMeters = Math.round((distKm !== undefined && distKm !== null ? distKm : 0.05) * 1000);
  const distLabel = distKm !== undefined && distKm < 1 ? `${distMeters}m` : `${distKm.toFixed(1)}km`;

  if (!item) {
    item = document.createElement("div");
    item.id = itemId;
    item.className = "mini-alert-item mini-alert-popin";
    item.innerHTML = `
      <button 
        type="button" 
        class="mini-alert-btn radar-alert" 
        onclick="window.expandMiniRadarAlert('${report.id}')"
        title="Highway Police Radar Alert (${distLabel} away) - Tap to View Details"
      >
        <i class="fa-solid fa-shield-halved text-xl text-white"></i>
        <span class="mini-alert-badge badge-radar" id="miniRadarBadge_${report.id}">${distLabel}</span>
      </button>
      <button 
        type="button" 
        class="mini-alert-close" 
        onclick="window.dismissMiniAlert('radar_banner', 'radar_banner_${report.id}', event)" 
        title="Permanently Dismiss (Cross)"
      >&times;</button>
    `;
    dock.appendChild(item);
  } else {
    const badge = document.getElementById(`miniRadarBadge_${report.id}`);
    if (badge) badge.textContent = distLabel;
  }
}
window.showMiniRadarAlert = showMiniRadarAlert;

function hideMiniRadarAlert(reportId) {
  const dock = document.getElementById("miniAlertDock");
  if (!dock) return;
  if (reportId) {
    const item = document.getElementById(`miniAlertItem_radar_${reportId}`);
    if (item) {
      item.classList.add("mini-alert-popout");
      setTimeout(() => { if (item && item.parentNode) item.parentNode.removeChild(item); }, 200);
    }
  } else {
    const radarItems = dock.querySelectorAll("[id^='miniAlertItem_radar_']");
    radarItems.forEach(el => {
      el.classList.add("mini-alert-popout");
      setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 200);
    });
  }
}
window.hideMiniRadarAlert = hideMiniRadarAlert;

// ==========================================
// 3-COLUMN SPLIT HUD BAR ALERT FORMATTERS
// ==========================================
function formatConvoyAlertText(rider) {
  if (!rider) return "⚠️ Rider Alert";
  const name = rider.rider_name || "Rider";
  const gapKm = rider.distanceToLeader !== undefined ? rider.distanceToLeader : 1.5;
  const gapStr = gapKm < 1 ? `${Math.round(gapKm * 1000)}m` : `${gapKm.toFixed(1)}km`;
  return `⚠️ ${name} • ${gapStr}`;
}

function formatRadarAlertText(report, distKm) {
  if (distKm === undefined || distKm === null) {
    if (report && (report.lat || report.lng)) {
      distKm = calculateDistanceKm(riderLocation.lat, riderLocation.lng, report.lat, report.lng);
    } else {
      distKm = 0.5;
    }
  }
  const distStr = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`;
  return `🛡️ Police • ${distStr}`;
}

window.expandMiniRadarAlert = function(reportId) {
  const report = (reportId && policeReportsMap.get(reportId)) || closestApproachingPolice;
  const banner = document.getElementById("radarAlertBanner") || document.getElementById("approachingPoliceBanner");
  const bannerText = document.getElementById("approachingPoliceText");
  if (report) {
    closestApproachingPolice = report;
    const distKm = report.distanceToBiker || calculateDistanceKm(riderLocation.lat, riderLocation.lng, report.lat, report.lng);
    if (bannerText) {
      bannerText.textContent = formatRadarAlertText(report, distKm);
      bannerText.title = `Police Checkpost ahead (${distKm < 1 ? Math.round(distKm * 1000) + "m" : distKm.toFixed(1) + "km"} away)`;
    }
  }
  if (banner) {
    banner.classList.remove("hidden");
    const roadBanner = document.getElementById("currentRoadBanner");
    if (roadBanner) roadBanner.classList.add("has-radar-alert");
  }
};

function minimizeApproachingPoliceAlert() {
  const banner = document.getElementById("radarAlertBanner") || document.getElementById("approachingPoliceBanner");
  if (banner) banner.classList.add("hidden");
  const roadBanner = document.getElementById("currentRoadBanner");
  if (roadBanner) roadBanner.classList.remove("has-radar-alert");
  // Round icon remains docked in #miniAlertDock!
}
window.minimizeApproachingPoliceAlert = minimizeApproachingPoliceAlert;

function dismissApproachingPoliceAlert() {
  if (closestApproachingPolice && closestApproachingPolice.id) {
    const rawId = closestApproachingPolice.id;
    markAlertAsDismissed(`radar_banner_${rawId}`);
    markAlertAsDismissed(rawId);
    hideMiniRadarAlert(rawId);
    hideMiniPoliceAlert(rawId);
  }
  const banner = document.getElementById("radarAlertBanner") || document.getElementById("approachingPoliceBanner");
  if (banner) banner.classList.add("hidden");
  const roadBanner = document.getElementById("currentRoadBanner");
  if (roadBanner) roadBanner.classList.remove("has-radar-alert");
}
window.dismissApproachingPoliceAlert = dismissApproachingPoliceAlert;

// ==========================================
// CONVOY FORMATION GAP ALERT HANDLERS
// ==========================================
function showMiniConvoyGapAlert(rider) {
  if (!rider || !rider.id) return;
  const alertId = `convoy_gap_${rider.id}`;
  if (window.isAlertDismissed(alertId)) return;

  const dock = document.getElementById("miniAlertDock");
  if (!dock) return;

  const itemId = `miniAlertItem_convoy_${rider.id}`;
  let item = document.getElementById(itemId);

  const gapKm = rider.distanceToLeader !== undefined ? rider.distanceToLeader : 1.5;
  const gapLabel = `${gapKm.toFixed(1)}km`;

  if (!item) {
    item = document.createElement("div");
    item.id = itemId;
    item.className = "mini-alert-item mini-alert-popin";
    item.innerHTML = `
      <button 
        type="button" 
        class="mini-alert-btn convoy-gap-alert" 
        onclick="window.expandMiniConvoyGapAlert('${rider.id}')"
        title="Convoy Gap Alert (${escapeHtml(rider.rider_name)} is ${gapLabel} away) - Tap to Open in Bar"
      >
        <i class="fa-solid fa-triangle-exclamation text-xl text-yellow-200"></i>
        <span class="mini-alert-badge badge-gap" id="miniConvoyBadge_${rider.id}">${gapLabel}</span>
      </button>
      <button 
        type="button" 
        class="mini-alert-close" 
        onclick="window.dismissMiniAlert('convoy_gap', 'convoy_gap_${rider.id}', event)" 
        title="Permanently Dismiss (Cross)"
      >&times;</button>
    `;
    dock.appendChild(item);
  } else {
    const badge = document.getElementById(`miniConvoyBadge_${rider.id}`);
    if (badge) badge.textContent = gapLabel;
  }
}
window.showMiniConvoyGapAlert = showMiniConvoyGapAlert;

function hideMiniConvoyGapAlert(riderId) {
  const dock = document.getElementById("miniAlertDock");
  if (!dock) return;
  if (riderId) {
    const item = document.getElementById(`miniAlertItem_convoy_${riderId}`);
    if (item) {
      item.classList.add("mini-alert-popout");
      setTimeout(() => { if (item && item.parentNode) item.parentNode.removeChild(item); }, 200);
    }
  } else {
    const convoyItems = dock.querySelectorAll("[id^='miniAlertItem_convoy_']");
    convoyItems.forEach(el => {
      el.classList.add("mini-alert-popout");
      setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, 200);
    });
  }
}
window.hideMiniConvoyGapAlert = hideMiniConvoyGapAlert;

window.expandMiniConvoyGapAlert = function(riderId) {
  const rider = (riderId && allConvoyRiders.get(riderId)) || activeStragglerAlert;
  const alertBanner = document.getElementById("distanceAlertBanner") || document.getElementById("convoyAlertBanner");
  const alertText = document.getElementById("convoyAlertText");
  if (rider) {
    activeStragglerAlert = rider;
    if (alertText) {
      alertText.textContent = formatConvoyAlertText(rider);
      alertText.title = `Convoy Distance Alert: ${rider.rider_name} is ${rider.distanceToLeader ? rider.distanceToLeader.toFixed(1) : "1.5"}km away`;
    }
  }
  if (alertBanner) {
    alertBanner.classList.remove("hidden");
    const roadBanner = document.getElementById("currentRoadBanner");
    if (roadBanner) roadBanner.classList.add("has-distance-alert");
  }
};

function minimizeConvoyAlert() {
  const alertBanner = document.getElementById("distanceAlertBanner") || document.getElementById("convoyAlertBanner");
  if (alertBanner) alertBanner.classList.add("hidden");
  const roadBanner = document.getElementById("currentRoadBanner");
  if (roadBanner) roadBanner.classList.remove("has-distance-alert");
  // Round icon remains docked in #miniAlertDock!
}
window.minimizeConvoyAlert = minimizeConvoyAlert;

function dismissConvoyAlert() {
  if (activeStragglerAlert && activeStragglerAlert.id) {
    const rawId = activeStragglerAlert.id;
    markAlertAsDismissed(`convoy_gap_${rawId}`);
    markAlertAsDismissed(rawId);
    hideMiniConvoyGapAlert(rawId);
  }
  const alertBanner = document.getElementById("distanceAlertBanner") || document.getElementById("convoyAlertBanner");
  if (alertBanner) alertBanner.classList.add("hidden");
  const roadBanner = document.getElementById("currentRoadBanner");
  if (roadBanner) roadBanner.classList.remove("has-distance-alert");
}
window.dismissConvoyAlert = dismissConvoyAlert;

window.dismissMiniAlert = function(type, alertId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  markAlertAsDismissed(alertId);

  if (type === "police") {
    hideMiniPoliceAlert(alertId);
    if (activeVerifyReportId === alertId) {
      closeVerifyPoliceModal();
    }
  } else if (type === "road") {
    hideMiniRoadAlert(alertId);
    dismissRoadTransitionPopup();
  } else if (type === "radar_banner") {
    const rawId = alertId.replace("radar_banner_", "");
    markAlertAsDismissed(`radar_banner_${rawId}`);
    markAlertAsDismissed(rawId);
    hideMiniRadarAlert(rawId);
    hideMiniPoliceAlert(rawId);
    const banner = document.getElementById("radarAlertBanner") || document.getElementById("approachingPoliceBanner");
    if (banner) banner.classList.add("hidden");
    const roadBanner = document.getElementById("currentRoadBanner");
    if (roadBanner) roadBanner.classList.remove("has-radar-alert");
  } else if (type === "convoy_gap") {
    const rawId = alertId.replace("convoy_gap_", "");
    markAlertAsDismissed(`convoy_gap_${rawId}`);
    markAlertAsDismissed(rawId);
    hideMiniConvoyGapAlert(rawId);
    const banner = document.getElementById("distanceAlertBanner") || document.getElementById("convoyAlertBanner");
    if (banner) banner.classList.add("hidden");
    const roadBanner = document.getElementById("currentRoadBanner");
    if (roadBanner) roadBanner.classList.remove("has-distance-alert");
  }
};

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

  const alertBanner = document.getElementById("distanceAlertBanner") || document.getElementById("convoyAlertBanner");
  const alertText = document.getElementById("convoyAlertText");

  if (maxStraggler) {
    activeStragglerAlert = maxStraggler;
    if (alertText) {
      alertText.textContent = formatConvoyAlertText(maxStraggler);
      alertText.title = `Convoy Distance Alert: ${maxStraggler.rider_name} is ${maxStraggler.distanceToLeader ? maxStraggler.distanceToLeader.toFixed(1) : "1.5"}km away`;
    }

    const now = Date.now();
    if (now - lastConvoyAlarmTime > 8000) {
      lastConvoyAlarmTime = now;
      if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
        if ("speechSynthesis" in window) {
          try { window.speechSynthesis.cancel(); } catch (e) {}
        }
      } else {
        playSound("convoyAlarm");
      }
    }

    // Default: Show Minimized Round Icon in #miniAlertDock (do NOT open big banner automatically!)
    const convoyAlertId = `convoy_gap_${maxStraggler.id}`;
    if (!window.isAlertDismissed(convoyAlertId)) {
      showMiniConvoyGapAlert(maxStraggler);
    }
  } else {
    activeStragglerAlert = null;
    if (alertBanner) alertBanner.classList.add("hidden");
    const roadBanner = document.getElementById("currentRoadBanner");
    if (roadBanner) roadBanner.classList.remove("has-distance-alert");
    hideMiniConvoyGapAlert();
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

      const isCurrentLeader = Boolean(currentSession && currentSession.isLeader);
      const canKick = isCurrentLeader && !isMe;
      const kickBtnHtml = canKick
        ? `<button type="button" class="kick-rider-btn px-2 py-0.5 rounded text-[10px] font-cyber font-bold flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer ml-1.5" onclick="event.stopPropagation(); window.kickRiderFromConvoy('${r.id}', '${escapeHtml(r.rider_name)}')" title="Remove ${escapeHtml(r.rider_name)} from convoy">
             <i class="fa-solid fa-user-xmark text-[9px]"></i>
             <span>Kick</span>
           </button>`
        : "";

      return `
        <div class="${cardClass} cursor-pointer group hover:border-emerald-400 transition-all" onclick="centerOnRider('${r.id}')" title="Tap to locate ${escapeHtml(r.rider_name)} on map">
          <div class="flex items-center justify-between mb-1.5">
            <div class="flex items-center gap-1.5 font-cyber font-bold text-xs text-slate-100 min-w-0">
              ${isLeader ? '<i class="fa-solid fa-crown text-amber-400 text-xs"></i>' : '<i class="fa-solid fa-motorcycle text-neon-green text-xs"></i>'}
              <span class="truncate max-w-[110px]">${escapeHtml(r.rider_name)}</span>
              ${isMe ? '<span class="text-[9px] text-emerald-400 font-semibold px-1 rounded bg-emerald-500/10 border border-emerald-500/30">You</span>' : ''}
            </div>
            <div class="flex items-center">
              ${statusBadge}
              ${kickBtnHtml}
            </div>
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
// 9B. CONVOY TEAMMATE REMOVAL & KICK LOGIC
// ==========================================
window.kickRiderFromConvoy = async function(targetRiderId, targetRiderName) {
  if (!currentSession || !currentSession.isLeader) {
    if (typeof showRadarToast === "function") {
      showRadarToast("ACTION DENIED", "Only the Ride Leader can remove teammates.");
    }
    return;
  }

  if (targetRiderId === currentSession.riderId) {
    if (typeof showRadarToast === "function") {
      showRadarToast("ACTION DENIED", "You cannot kick yourself from the convoy.");
    }
    return;
  }

  const displayName = targetRiderName || "Rider";
  if (!confirm(`Are you sure you want to remove ${displayName} from this convoy?`)) {
    return;
  }

  try {
    if (typeof playSound === "function") playSound("click");

    // 1. Maintain a local Set so polling does not re-add this rider
    window.kickedRiderIds = window.kickedRiderIds || new Set();
    window.kickedRiderIds.add(targetRiderId);

    // 2. Immediately remove rider's marker from map and UI, updating count
    allConvoyRiders.delete(targetRiderId);
    removeRemoteRiderMarker(targetRiderId);
    evaluateConvoyDistances();
    updateRidersCount();

    // 3. Broadcast rider_kicked event on Supabase Realtime channel
    if (realtimeChannel) {
      try {
        realtimeChannel.send({
          type: "broadcast",
          event: "rider_kicked",
          payload: {
            riderId: targetRiderId,
            roomCode: currentSession.roomCode
          }
        });
      } catch (bcErr) {
        console.debug("[Broadcast kick error]", bcErr);
      }
    }

    // 4. Update room_code of that rider row to 'KICKED_' + currentSession.roomCode before deleting
    const kickedRoomCode = "KICKED_" + (currentSession.roomCode || "CONVOY");
    try {
      await supabaseRest(
        `riders?id=eq.${encodeURIComponent(targetRiderId)}`,
        "PATCH",
        { room_code: kickedRoomCode }
      );
    } catch (patchErr) {
      console.debug("[Patch kicked rider error]", patchErr);
    }

    // 5. Delete rider row via direct REST and supabase-js
    try {
      await supabaseRest(
        `riders?id=eq.${encodeURIComponent(targetRiderId)}`,
        "DELETE"
      );
    } catch (delRestErr) {
      console.debug("[Delete kicked rider rest error]", delRestErr);
    }

    if (sbClient) {
      try {
        await sbClient.from("riders").delete().eq("id", targetRiderId);
      } catch (sbDelErr) {
        console.debug("[sbClient delete error]", sbDelErr);
      }
    }

    // 6. Show toast notification to the Leader
    if (typeof showRadarToast === "function") {
      showRadarToast("CONVOY SQUAD", `🚫 Removed ${displayName} from convoy`);
    }
  } catch (err) {
    console.error("Error in kickRiderFromConvoy:", err);
  }
};

// ==========================================
// 9.5 SINGLE LEADER ENFORCEMENT & ROOM CLOSURE HELPERS
// ==========================================
let checkLeaderDebounceTimer = null;

window.checkRoomLeaderStatus = async function(roomCode) {
  const checkbox = document.getElementById("isLeaderCheckbox") || document.getElementById("isLeaderInput");
  const notice = document.getElementById("leaderNotice");
  const noticeText = document.getElementById("leaderNoticeText");
  const container = document.getElementById("leaderToggleContainer");

  const cleanRoom = (roomCode || "").trim().toUpperCase();
  if (!cleanRoom || cleanRoom === "----") {
    if (checkbox) checkbox.disabled = false;
    if (notice) notice.classList.add("hidden");
    if (container) container.classList.remove("opacity-60");
    return null;
  }

  try {
    const res = await supabaseRest(
      `riders?room_code=eq.${encodeURIComponent(cleanRoom)}&is_leader=eq.true&select=id,rider_name`,
      "GET"
    );

    if (Array.isArray(res) && res.length > 0) {
      const activeLeader = res.find((r) => r && (!currentSession || r.id !== currentSession.riderId));
      if (activeLeader) {
        if (checkbox) {
          checkbox.checked = false;
          checkbox.disabled = true;
        }
        if (noticeText) {
          noticeText.textContent = `👑 Leader (${activeLeader.rider_name || "Captain"}) is already in this room — joining as Rider`;
        }
        if (notice) {
          notice.classList.remove("hidden");
        }
        if (container) {
          container.classList.add("opacity-60");
        }
        return activeLeader;
      }
    }

    // No active leader in room
    if (checkbox) {
      checkbox.disabled = false;
    }
    if (notice) {
      notice.classList.add("hidden");
    }
    if (container) {
      container.classList.remove("opacity-60");
    }
    return null;
  } catch (err) {
    console.debug("[checkRoomLeaderStatus error]", err);
    return null;
  }
};

function debouncedCheckRoomLeader(roomCode, delay = 250) {
  if (checkLeaderDebounceTimer) clearTimeout(checkLeaderDebounceTimer);
  checkLeaderDebounceTimer = setTimeout(() => {
    window.checkRoomLeaderStatus(roomCode);
  }, delay);
}

async function enforceSingleLeaderForRoom(cleanRoom) {
  if (!cleanRoom || cleanRoom === "----" || !currentSession || !currentSession.riderId) return;
  try {
    const res = await supabaseRest(
      `riders?room_code=eq.${encodeURIComponent(cleanRoom)}&select=id,rider_name,is_leader`,
      "GET"
    );
    if (Array.isArray(res)) {
      const otherRiders = res.filter((r) => r && r.id !== currentSession.riderId);
      const existingLeader = otherRiders.find((r) => r.is_leader === true);

      if (existingLeader && currentSession.isLeader) {
        currentSession.isLeader = false;
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentSession));
        } catch (e) {}
        const isLeaderCheckbox = document.getElementById("isLeaderCheckbox") || document.getElementById("isLeaderInput");
        if (isLeaderCheckbox) {
          isLeaderCheckbox.checked = false;
          isLeaderCheckbox.disabled = true;
        }
        const captainBadge = document.getElementById("captainBadge");
        if (captainBadge) captainBadge.classList.add("hidden");
        if (typeof showRadarToast === "function") {
          showRadarToast("CONVOY ROLE UPDATED", `ℹ️ Leader (${existingLeader.rider_name || "Captain"}) already exists in this room. Joined as Rider!`);
        }
      } else if (otherRiders.length === 0 && !currentSession.isLeader) {
        currentSession.isLeader = true;
        try {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentSession));
        } catch (e) {}
        const isLeaderCheckbox = document.getElementById("isLeaderCheckbox") || document.getElementById("isLeaderInput");
        if (isLeaderCheckbox) isLeaderCheckbox.checked = true;
        const captainBadge = document.getElementById("captainBadge");
        if (captainBadge) captainBadge.classList.remove("hidden");
      }
    }
  } catch (err) {
    console.debug("[enforceSingleLeaderForRoom error]", err);
  }
}

async function checkIfRoomClosedOrKicked() {
  if (!currentSession.riderId || !hasJoinedDB) return { kicked: false, roomClosed: false };

  // If already flagged by realtime broadcast event
  if (isRoomClosedByLeader) {
    return { kicked: false, roomClosed: true };
  }

  // The active leader does not close on themselves
  if (currentSession.isLeader) {
    return { kicked: false, roomClosed: false };
  }

  const cleanRoom = (currentSession.roomCode || "").trim().toUpperCase();
  if (!cleanRoom || cleanRoom === "----") {
    return { kicked: false, roomClosed: false };
  }

  try {
    // 1. Check current rider's row
    const myRowRes = await supabaseRest(
      `riders?id=eq.${encodeURIComponent(currentSession.riderId)}&select=id,room_code`,
      "GET"
    );

    if (Array.isArray(myRowRes)) {
      if (myRowRes.length === 0) {
        // Rider row was removed from DB. Check if whole room was closed or single kick
        const roomRiders = await supabaseRest(
          `riders?room_code=eq.${encodeURIComponent(cleanRoom)}&select=id,is_leader`,
          "GET"
        );
        const hasLeader = Array.isArray(roomRiders) && roomRiders.some((r) => r.is_leader === true);
        if (!hasLeader || roomRiders.length === 0) {
          return { kicked: false, roomClosed: true };
        }
        return { kicked: true, roomClosed: false };
      }

      const myRow = myRowRes[0];
      if (myRow && myRow.room_code) {
        if (myRow.room_code.startsWith("CLOSED_")) {
          return { kicked: false, roomClosed: true };
        }
        if (myRow.room_code.startsWith("KICKED_")) {
          return { kicked: true, roomClosed: false };
        }
      }
    }

    // 2. Check if room still has an active leader
    const roomCheck = await supabaseRest(
      `riders?room_code=eq.${encodeURIComponent(cleanRoom)}&select=id,is_leader`,
      "GET"
    );

    if (Array.isArray(roomCheck)) {
      const hasLeader = roomCheck.some((r) => r.is_leader === true);
      if (roomCheck.length === 0 || !hasLeader) {
        return { kicked: false, roomClosed: true };
      }
    }
  } catch (err) {
    console.debug("[checkIfRoomClosedOrKicked error]", err);
  }

  return { kicked: false, roomClosed: false };
}

function handleRoomClosedByLeader() {
  if (isHandlingRoomClose) return;
  isHandlingRoomClose = true;
  isRoomClosedByLeader = true;

  try {
    // 1. Immediately stop dual sync and upsert intervals
    if (dualSyncInterval) {
      clearInterval(dualSyncInterval);
      dualSyncInterval = null;
    }
    if (upsertInterval) {
      clearInterval(upsertInterval);
      upsertInterval = null;
    }

    hasJoinedDB = false;

    // 2. Unsubscribe all channels
    if (realtimeChannel && sbClient) {
      try { sbClient.removeChannel(realtimeChannel); } catch (e) {}
      realtimeChannel = null;
    }
    if (ridersDbSubscription && sbClient) {
      try { sbClient.removeChannel(ridersDbSubscription); } catch (e) {}
      ridersDbSubscription = null;
    }
    if (policeDbSubscription && sbClient) {
      try { sbClient.removeChannel(policeDbSubscription); } catch (e) {}
      policeDbSubscription = null;
    }

    // 3. Clear session storage
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}

    // 4. Remove all map markers and clear convoy members
    remoteRiderMarkers.forEach((marker) => map && map.removeLayer(marker));
    remoteRiderMarkers.clear();
    allConvoyRiders.clear();
    updateRidersCount();

    // 5. Reset session object
    currentSession = {
      riderId: generateUUID(),
      riderName: "",
      roomCode: "",
      isLeader: false
    };

    updateSyncStatusUI(false, "Room Closed");

    // 6. Close drawer if open, and reopen onboarding modal
    if (typeof window.closeGroupDrawer === "function") {
      window.closeGroupDrawer();
    }
    showOnboardingModal(true);

    // 7. Show prominent toast and alert
    if (typeof showRadarToast === "function") {
      showRadarToast("CONVOY CLOSED", "🏁 The Ride Leader has left and closed the convoy room.");
    }
    if (typeof playSound === "function") {
      playSound("overspeed");
    }

    setTimeout(() => {
      alert("🏁 The Ride Leader has left and closed the convoy room.");
      isHandlingRoomClose = false;
    }, 250);
  } catch (err) {
    console.error("Error in handleRoomClosedByLeader:", err);
    isHandlingRoomClose = false;
  }
}

async function checkIfCurrentRiderKicked() {
  const status = await checkIfRoomClosedOrKicked();
  return status.kicked;
}

function handleKickedFromConvoy() {
  if (isHandlingKick) return;
  isHandlingKick = true;

  try {
    // 1. Immediately stop dual sync and upsert loops
    if (dualSyncInterval) {
      clearInterval(dualSyncInterval);
      dualSyncInterval = null;
    }
    if (upsertInterval) {
      clearInterval(upsertInterval);
      upsertInterval = null;
    }

    hasJoinedDB = false;

    // 2. Unsubscribe channels
    if (realtimeChannel && sbClient) {
      try { sbClient.removeChannel(realtimeChannel); } catch (e) {}
      realtimeChannel = null;
    }
    if (ridersDbSubscription && sbClient) {
      try { sbClient.removeChannel(ridersDbSubscription); } catch (e) {}
      ridersDbSubscription = null;
    }
    if (policeDbSubscription && sbClient) {
      try { sbClient.removeChannel(policeDbSubscription); } catch (e) {}
      policeDbSubscription = null;
    }

    // 3. Clear session storage so user doesn't auto-reconnect
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}

    // 4. Remove markers and reset convoy state
    remoteRiderMarkers.forEach((marker) => map && map.removeLayer(marker));
    remoteRiderMarkers.clear();
    allConvoyRiders.clear();
    updateRidersCount();

    // 5. Reset session object without re-upserting
    currentSession = {
      riderId: generateUUID(),
      riderName: "",
      roomCode: "",
      isLeader: false
    };

    updateSyncStatusUI(false, "Disconnected (Kicked)");

    // 6. Close drawer if open and reopen onboarding modal
    if (typeof window.closeGroupDrawer === "function") {
      window.closeGroupDrawer();
    }
    showOnboardingModal(true);

    // 7. Show toast and alert to the kicked rider
    if (typeof showRadarToast === "function") {
      showRadarToast("CONVOY NOTICE", "⚠️ You have been removed from the convoy by the Ride Leader.");
    }
    if (typeof playSound === "function") {
      playSound("overspeed");
    }

    setTimeout(() => {
      alert("⚠️ You have been removed from the convoy by the Ride Leader.");
      isHandlingKick = false;
    }, 200);
  } catch (err) {
    console.error("Error in handleKickedFromConvoy:", err);
    isHandlingKick = false;
  }
}

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

  const roadNameEl = document.getElementById("currentRoadName") || document.getElementById("currentRoadBanner");
  if (roadNameEl) roadNameEl.textContent = newRoadName;

  const speedLimitVal = document.getElementById("speedLimitVal");
  if (speedLimitVal) speedLimitVal.textContent = newSpeedLimit;

  if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
    if ("speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  } else {
    announceRoadChange(newRoadName, newSpeedLimit, newRoadType);
  }

  const roadAlertId = `road_${encodeURIComponent(newRoadName)}_${newSpeedLimit}`;
  currentRoadTransitionDetails = {
    roadName: newRoadName,
    limit: newSpeedLimit,
    roadType: newRoadType,
    alertId: roadAlertId
  };

  // Show Minimized Floating Round Icon instead of opening the giant modal automatically!
  if (!window.isAlertDismissed(roadAlertId)) {
    showMiniRoadAlert(newRoadName, newSpeedLimit, newRoadType, roadAlertId);
  }
}

function openRoadTransitionModal() {
  if (!currentRoadTransitionDetails) return;
  const { roadName, limit, roadType } = currentRoadTransitionDetails;

  const modal = document.getElementById("roadTransitionModal");
  const roadNameEl = document.getElementById("popupRoadName");
  const roadTypeEl = document.getElementById("popupRoadType");
  const speedLimitEl = document.getElementById("popupSpeedLimit");
  const voiceMsgEl = document.getElementById("popupVoiceMsg");

  if (roadNameEl) roadNameEl.textContent = roadName;
  if (roadTypeEl) roadTypeEl.textContent = roadType || "Highway / Expressway";
  if (speedLimitEl) speedLimitEl.textContent = limit;
  if (voiceMsgEl) voiceMsgEl.textContent = `Announced: Speed limit updated to ${limit} KM/H!`;

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

  if (roadPopupTimer) clearTimeout(roadPopupTimer);
  roadPopupTimer = setTimeout(() => {
    minimizeRoadTransitionPopup();
  }, 5000);
}
window.openRoadTransitionModal = openRoadTransitionModal;

function minimizeRoadTransitionPopup() {
  if (roadPopupTimer) clearTimeout(roadPopupTimer);
  const modal = document.getElementById("roadTransitionModal");
  if (!modal) return;
  modal.classList.add("opacity-0", "pointer-events-none");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }, 300);
}
window.minimizeRoadTransitionPopup = minimizeRoadTransitionPopup;

function dismissRoadTransitionPopup() {
  if (roadPopupTimer) clearTimeout(roadPopupTimer);
  if (currentRoadTransitionDetails && currentRoadTransitionDetails.alertId) {
    markAlertAsDismissed(currentRoadTransitionDetails.alertId);
    hideMiniRoadAlert(currentRoadTransitionDetails.alertId);
  }
  const modal = document.getElementById("roadTransitionModal");
  if (!modal) return;
  modal.classList.add("opacity-0", "pointer-events-none");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }, 300);
}
window.dismissRoadTransitionPopup = dismissRoadTransitionPopup;

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
    if (window.isWalkieTalkieActive || window.isRecordingPtt || window.isPlayingVoice) {
      if ("speechSynthesis" in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
    } else {
      playSound("overspeed");
    }
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
  if (isHandlingKick) return { success: false, error: "Kicked from convoy" };

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
    hasJoinedDB = true;
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
      // Requirement 2: If regular rider is in room and room returns 0 riders or has NO leader, trigger room closure
      if (hasJoinedDB && !currentSession.isLeader) {
        const hasLeader = riders.some((r) => r && r.is_leader === true);
        if (riders.length === 0 || !hasLeader) {
          handleRoomClosedByLeader();
          return { success: false, error: "Leader closed room" };
        }
      }

      const activeDbIds = new Set();

      riders.forEach((r) => {
        if (!r || !r.id) return;
        if (r.id === currentSession.riderId) return;
        if ((r.room_code || "").startsWith("KICKED_") || (r.room_code || "").startsWith("CLOSED_")) return;
        if (window.kickedRiderIds && window.kickedRiderIds.has(r.id)) return;

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
  if (isHandlingKick || isHandlingRoomClose) return;

  // Requirement: FIRST check if room closed or current rider kicked BEFORE upserting!
  // If hasJoinedDB === true and currentSession.isLeader === false:
  // Check if:
  // 1. A room_closed broadcast event was received (isRoomClosedByLeader), OR
  // 2. The current rider's row in riders now has room_code starting with 'CLOSED_' or no longer exists, OR
  // 3. The room query returns 0 riders or has NO rider with is_leader === true!
  // If any of these is true, immediately stop sync loop (do NOT re-upsert!), clear sessionStorage, remove all map markers, reopen #onboardingModal, and show prominent toast/alert!
  if (hasJoinedDB && currentSession.riderId && !currentSession.isLeader) {
    const status = await checkIfRoomClosedOrKicked();
    if (status.roomClosed) {
      handleRoomClosedByLeader();
      return; // DO NOT upsert!
    }
    if (status.kicked) {
      handleKickedFromConvoy();
      return; // DO NOT upsert!
    }
  }

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

  // 4. Direct REST: Poll recent voice messages from the last 12 seconds (Dual-Engine Walkie-Talkie fallback)
  if (typeof fetchRecentVoiceMessages === "function") {
    await fetchRecentVoiceMessages();
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
    if (oldRecord && oldRecord.id === currentSession.riderId && hasJoinedDB) {
      handleKickedFromConvoy();
      return;
    }
    // If the Leader is deleted, close room for regular riders
    if (oldRecord && oldRecord.is_leader === true && !currentSession.isLeader && hasJoinedDB) {
      handleRoomClosedByLeader();
      return;
    }
    if (oldRecord && oldRecord.id) {
      allConvoyRiders.delete(oldRecord.id);
      removeRemoteRiderMarker(oldRecord.id);
      evaluateConvoyDistances();
      updateRidersCount();
    }
    return;
  }

  if (newRecord) {
    if ((newRecord.room_code || "").startsWith("CLOSED_") && !currentSession.isLeader && hasJoinedDB) {
      handleRoomClosedByLeader();
      return;
    }
    if (newRecord.id === currentSession.riderId && (newRecord.room_code || "").startsWith("KICKED_")) {
      handleKickedFromConvoy();
      return;
    }
    if (newRecord.id !== currentSession.riderId) {
      if ((newRecord.room_code || "").startsWith("KICKED_") || (newRecord.room_code || "").startsWith("CLOSED_") || (window.kickedRiderIds && window.kickedRiderIds.has(newRecord.id))) {
        allConvoyRiders.delete(newRecord.id);
        removeRemoteRiderMarker(newRecord.id);
        evaluateConvoyDistances();
        updateRidersCount();
        return;
      }
      allConvoyRiders.set(newRecord.id, newRecord);
      if (newRecord.lat && newRecord.lng) {
        updateRemoteRiderMarker(newRecord);
      }
      evaluateConvoyDistances();
      updateRidersCount();
    }
  }
}

function joinSupabaseRoom(roomCode) {
  const cleanRoom = (roomCode || currentSession.roomCode || "").trim().toUpperCase();
  currentSession.roomCode = cleanRoom;
  hasJoinedDB = false;
  isHandlingKick = false;
  isHandlingRoomClose = false;
  isRoomClosedByLeader = false;
  joinedRoomTimestamp = Date.now();
  if (typeof playedVoiceIds !== "undefined" && playedVoiceIds.clear) {
    playedVoiceIds.clear();
  }

  // Single-Leader enforcement on joining / restoring room
  enforceSingleLeaderForRoom(cleanRoom);

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
        .on("broadcast", { event: "rider_kicked" }, ({ payload }) => {
          if (payload && payload.riderId === currentSession.riderId) {
            handleKickedFromConvoy();
          } else if (payload && payload.riderId) {
            allConvoyRiders.delete(payload.riderId);
            removeRemoteRiderMarker(payload.riderId);
            evaluateConvoyDistances();
            updateRidersCount();
          }
        })
        .on("broadcast", { event: "room_closed" }, ({ payload }) => {
          if (currentSession && !currentSession.isLeader) {
            isRoomClosedByLeader = true;
            handleRoomClosedByLeader();
          }
        })
        .on("broadcast", { event: "police_alert" }, ({ payload }) => {
          if (payload) {
            addOrUpdatePoliceMarker(payload);
            evaluatePoliceProximity();
          }
        })
        .on("broadcast", { event: "voice_ptt" }, ({ payload }) => {
          if (payload && typeof handleIncomingVoiceMessage === "function") {
            handleIncomingVoiceMessage(payload);
          }
        })
        .on("broadcast", { event: "voice_status" }, ({ payload }) => {
          if (payload && payload.sender_id !== currentSession.riderId) {
            if (payload.status === "talking") {
              if (typeof setWalkieTalkieActive === "function") {
                setWalkieTalkieActive(true);
              } else {
                window.isWalkieTalkieActive = true;
                if ("speechSynthesis" in window) {
                  try { window.speechSynthesis.cancel(); } catch (e) {}
                }
              }
            } else if (payload.status === "idle") {
              if (typeof setWalkieTalkieActive === "function") {
                setWalkieTalkieActive(false);
              }
            }
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
  map = window.ensureLeafletMap();
  if (map) {
    if (!map._choloListenersAttached) {
      map._choloListenersAttached = true;
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
    }

    updateUserMarker(riderLocation.lat || 23.8103, riderLocation.lng || 90.4125, riderLocation.heading || 0);

    map.invalidateSize();
    setTimeout(() => { if (map) map.invalidateSize(); }, 150);
    setTimeout(() => { if (map) map.invalidateSize(); }, 500);
  }
  return map;
}

// Ensure map and user marker are initialized immediately
try {
  initMap();
} catch (e) {
  console.warn("Immediate initMap execution notice:", e);
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

  const roadNameEl = document.getElementById("currentRoadName") || document.getElementById("currentRoadBanner");
  if (roadNameEl) roadNameEl.textContent = currentRoadName;
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

async function clearSession() {
  const isLeader = Boolean(currentSession && currentSession.isLeader);
  const cleanRoom = (currentSession && currentSession.roomCode ? currentSession.roomCode : "").trim().toUpperCase();
  const myRiderId = currentSession ? currentSession.riderId : null;
  const myRiderName = currentSession ? currentSession.riderName : "Captain";

  if (isLeader && cleanRoom && cleanRoom !== "----") {
    // 1. Broadcast room_closed event to all riders on Realtime channel
    if (realtimeChannel) {
      try {
        realtimeChannel.send({
          type: "broadcast",
          event: "room_closed",
          payload: {
            roomCode: cleanRoom,
            leaderName: myRiderName
          }
        });
      } catch (broadcastErr) {
        console.debug("[room_closed broadcast error]", broadcastErr);
      }
    }

    // 2. PATCH all riders in that room with room_code = 'CLOSED_' + cleanRoom
    const closedRoomCode = "CLOSED_" + cleanRoom;
    try {
      await supabaseRest(
        `riders?room_code=eq.${encodeURIComponent(cleanRoom)}`,
        "PATCH",
        { room_code: closedRoomCode }
      );
    } catch (patchErr) {
      console.debug("[Patch room_code to CLOSED_ error]", patchErr);
    }

    // 3. DELETE all rows in that room via both supabaseRest and sbClient
    try {
      await supabaseRest(
        `riders?room_code=eq.${encodeURIComponent(cleanRoom)}`,
        "DELETE"
      );
    } catch (delErr1) {
      console.debug("[Delete cleanRoom error]", delErr1);
    }

    try {
      await supabaseRest(
        `riders?room_code=eq.${encodeURIComponent(closedRoomCode)}`,
        "DELETE"
      );
    } catch (delErr2) {
      console.debug("[Delete closedRoomCode error]", delErr2);
    }

    if (sbClient) {
      try {
        await sbClient.from("riders").delete().eq("room_code", cleanRoom);
      } catch (sbDelErr1) {
        console.debug("[sbClient delete cleanRoom error]", sbDelErr1);
      }
      try {
        await sbClient.from("riders").delete().eq("room_code", closedRoomCode);
      } catch (sbDelErr2) {
        console.debug("[sbClient delete closedRoomCode error]", sbDelErr2);
      }
    }

    // 4. Show toast for room closure
    if (typeof showRadarToast === "function") {
      showRadarToast("CONVOY CLOSED", "🏁 Convoy Room Closed. All riders have been disconnected.");
    }
  } else if (myRiderId) {
    // Regular Rider (isLeader === false): only delete their own row
    try {
      supabaseRest(`riders?id=eq.${encodeURIComponent(myRiderId)}`, "DELETE").catch(() => {});
    } catch (e) {}
    if (sbClient) {
      sbClient
        .from("riders")
        .delete()
        .eq("id", myRiderId)
        .then(() => {})
        .catch(() => {});
    }
    if (typeof showRadarToast === "function") {
      showRadarToast("CONVOY EXITED", "👋 You have left the convoy tour.");
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
    try { sbClient.removeChannel(realtimeChannel); } catch (e) {}
    realtimeChannel = null;
  }
  if (ridersDbSubscription && sbClient) {
    try { sbClient.removeChannel(ridersDbSubscription); } catch (e) {}
    ridersDbSubscription = null;
  }
  if (policeDbSubscription && sbClient) {
    try { sbClient.removeChannel(policeDbSubscription); } catch (e) {}
    policeDbSubscription = null;
  }

  remoteRiderMarkers.forEach((marker) => map && map.removeLayer(marker));
  remoteRiderMarkers.clear();
  allConvoyRiders.clear();
  updateRidersCount();

  hasJoinedDB = false;
  isHandlingKick = false;
  isHandlingRoomClose = false;
  isRoomClosedByLeader = false;
  joinedRoomTimestamp = Date.now();
  if (typeof playedVoiceIds !== "undefined" && playedVoiceIds.clear) {
    playedVoiceIds.clear();
  }
  if (typeof voicePlaybackQueue !== "undefined") {
    voicePlaybackQueue = [];
  }
  if (typeof isPlayingVoiceQueue !== "undefined" && isPlayingVoiceQueue) {
    try {
      if (sharedAudioPlayer) {
        sharedAudioPlayer.pause();
        sharedAudioPlayer.currentTime = 0;
      }
    } catch (e) {}
    isPlayingVoiceQueue = false;
  }
  if (typeof hidePttRadioBanner === "function") {
    hidePttRadioBanner();
  }
  window.isRecordingPtt = false;
  window.isPlayingVoice = false;
  window.isWalkieTalkieActive = false;
  if (typeof pttActiveCooldownTimer !== "undefined" && pttActiveCooldownTimer) {
    clearTimeout(pttActiveCooldownTimer);
    pttActiveCooldownTimer = null;
  }

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
// 15.5. PUSH-TO-TALK (PTT) WALKIE-TALKIE SYSTEM
// ==========================================
let isPttRecording = false;
let pttPressStartTime = 0;
let pttCountdownTimer = null;
let pttCountdownVal = 10;
let pttMediaRecorder = null;
let pttMediaStream = null;
let pttRecordedChunks = [];
let isPttSpeakerMuted = false;
let voicePlaybackQueue = [];
let isPlayingVoiceQueue = false;
let sharedAudioPlayer = new Audio();
let isSharedAudioUnlocked = false;
let playedVoiceIds = new Set();
let joinedRoomTimestamp = Date.now();
let pttLastTouchTime = 0;
let pttActiveCooldownTimer = null;

function setWalkieTalkieActive(active) {
  if (active) {
    if (pttActiveCooldownTimer) {
      clearTimeout(pttActiveCooldownTimer);
      pttActiveCooldownTimer = null;
    }
    window.isWalkieTalkieActive = true;
    // As soon as window.isWalkieTalkieActive becomes true, immediately cut off any ongoing TTS voice!
    if ("speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  } else {
    // Clean Resume After Conversation Ends: wait 1500ms (1.5 seconds)
    if (pttActiveCooldownTimer) {
      clearTimeout(pttActiveCooldownTimer);
    }
    pttActiveCooldownTimer = setTimeout(() => {
      if (!window.isRecordingPtt && !window.isPlayingVoice && (!voicePlaybackQueue || voicePlaybackQueue.length === 0)) {
        window.isWalkieTalkieActive = false;
      }
      pttActiveCooldownTimer = null;
    }, 1500);
  }
}
window.setWalkieTalkieActive = setWalkieTalkieActive;

// Walkie-Talkie Sound Synthesizer (Native WebAudio API)
function playPttChirp(type = "start") {
  if (isAudioMuted) return;
  if (isPttSpeakerMuted && type !== "start" && type !== "roger") return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === "start") {
      // Crisp walkie-talkie mic key chirp: dual beep (1200Hz -> 1800Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1200, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.04);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1800, now + 0.045);
      gain2.gain.setValueAtTime(0.25, now + 0.045);
      gain2.gain.linearRampToValueAtTime(0, now + 0.09);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.045);
      osc2.stop(now + 0.09);
    } else if (type === "end" || type === "roger") {
      // Classic Motorola/Kenwood roger beep: 2400Hz -> 1760Hz
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(2400, now);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.05);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.05);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1760, now + 0.055);
      gain2.gain.setValueAtTime(0.2, now + 0.055);
      gain2.gain.linearRampToValueAtTime(0, now + 0.11);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.055);
      osc2.stop(now + 0.11);
    } else if (type === "incoming") {
      // Incoming transmission alert chirp: double high-pitched beep (1600Hz -> 2100Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1600, now);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.04);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(2100, now + 0.045);
      gain2.gain.setValueAtTime(0.25, now + 0.045);
      gain2.gain.linearRampToValueAtTime(0, now + 0.09);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.045);
      osc2.stop(now + 0.09);
    }
  } catch (e) {
    console.debug("[playPttChirp notice]", e);
  }
}

// Mobile Autoplay Unlocker for WebAudio and Audio elements
function unlockAudioAutoplay() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  } catch (e) {}

  if (isSharedAudioUnlocked) return;
  try {
    if (!sharedAudioPlayer) {
      sharedAudioPlayer = new Audio();
    }
    // Silent 1-sample WAV to prime audio hardware on mobile Safari & Android Chrome
    sharedAudioPlayer.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
    const playPromise = sharedAudioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        sharedAudioPlayer.pause();
        isSharedAudioUnlocked = true;
      }).catch(() => {});
    }
  } catch (e) {}
}

window.addEventListener("click", unlockAudioAutoplay, { passive: true });
window.addEventListener("touchstart", unlockAudioAutoplay, { passive: true });

function getSupportedAudioMimeType() {
  const candidateTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    ""
  ];
  for (const t of candidateTypes) {
    if (!t) return "";
    if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
  }
  return "";
}

function showPttTransmittingBanner() {
  const banner = document.getElementById("pttRadioBanner");
  const text = document.getElementById("pttRadioBannerText");
  if (banner && text) {
    const name = (currentSession && currentSession.riderName) ? currentSession.riderName : "You";
    text.textContent = `📻 ${name} transmitting...`;
    banner.className = "ptt-radio-banner transmitting";
  }
}

function showPttReceivingBanner(senderName) {
  const banner = document.getElementById("pttRadioBanner");
  const text = document.getElementById("pttRadioBannerText");
  if (banner && text) {
    text.textContent = `🔊 ${senderName || "Rider"} speaking...`;
    banner.className = "ptt-radio-banner receiving";
  }
}

function hidePttRadioBanner() {
  if (isPttRecording) return;
  const banner = document.getElementById("pttRadioBanner");
  if (banner) {
    banner.className = "ptt-radio-banner hidden";
  }
}

function setPttRecordingUI(isRec) {
  const talkBtn = document.getElementById("pttTalkBtn");
  const talkLabel = document.getElementById("pttTalkLabel");
  const badge = document.getElementById("pttCountdownBadge");

  if (isRec) {
    if (talkBtn) talkBtn.classList.add("transmitting");
    if (talkLabel) talkLabel.textContent = "REC";
    if (badge) {
      badge.classList.remove("hidden");
      badge.textContent = "10s";
    }
    showPttTransmittingBanner();
  } else {
    if (talkBtn) talkBtn.classList.remove("transmitting");
    if (talkLabel) talkLabel.textContent = "PTT";
    if (badge) {
      badge.classList.add("hidden");
      badge.textContent = "10s";
    }
    hidePttRadioBanner();
  }
}

function startPttCountdown() {
  if (pttCountdownTimer) clearInterval(pttCountdownTimer);
  pttCountdownVal = 10;
  updatePttCountdownBadge(pttCountdownVal);

  pttCountdownTimer = setInterval(() => {
    pttCountdownVal--;
    if (pttCountdownVal <= 0) {
      clearInterval(pttCountdownTimer);
      pttCountdownTimer = null;
      stopAndSendPttRecording();
    } else {
      updatePttCountdownBadge(pttCountdownVal);
    }
  }, 1000);
}

function updatePttCountdownBadge(sec) {
  const badge = document.getElementById("pttCountdownBadge");
  if (badge) {
    badge.textContent = `${sec}s`;
    badge.classList.remove("hidden");
  }
}

async function startPttRecording() {
  if (isPttRecording) return;
  unlockAudioAutoplay();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showRadarToast("RADIO ERROR", "Audio recording not supported on this browser.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 16000
      }
    });
    pttMediaStream = stream;

    const mimeType = getSupportedAudioMimeType();
    const options = { audioBitsPerSecond: 16000 };
    if (mimeType) options.mimeType = mimeType;

    pttMediaRecorder = new MediaRecorder(stream, options);
    pttRecordedChunks = [];

    pttMediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        pttRecordedChunks.push(event.data);
      }
    };

    pttMediaRecorder.onstop = () => {
      const mime = (pttMediaRecorder && pttMediaRecorder.mimeType) || mimeType || "audio/webm";
      const audioBlob = new Blob(pttRecordedChunks, { type: mime });

      if (pttMediaStream) {
        try {
          pttMediaStream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
        pttMediaStream = null;
      }

      // Ensure clip is valid before transmitting (> 200 bytes)
      if (audioBlob.size > 200) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result;
          sendPttVoiceMessage(base64Data);
        };
        reader.readAsDataURL(audioBlob);
      } else {
        console.debug("[PTT] Audio clip empty or discarded.");
      }
    };

    pttMediaRecorder.start(250);
    isPttRecording = true;
    window.isRecordingPtt = true;
    setWalkieTalkieActive(true);

    if (realtimeChannel) {
      try {
        realtimeChannel.send({
          type: "broadcast",
          event: "voice_status",
          payload: {
            status: "talking",
            sender_id: currentSession.riderId,
            sender_name: currentSession.riderName || "Rider"
          }
        });
      } catch (e) {}
    }

    playPttChirp("start");
    setPttRecordingUI(true);
    startPttCountdown();

  } catch (err) {
    console.warn("[PTT recording start error]", err);
    setPttRecordingUI(false);
    isPttRecording = false;
    window.isRecordingPtt = false;
    setWalkieTalkieActive(false);
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      showRadarToast("MIC PERMISSION", "Please allow microphone access to talk on walkie-talkie.");
    } else {
      showRadarToast("MIC ERROR", "Could not start microphone: " + (err.message || "Unknown error"));
    }
  }
}

function stopAndSendPttRecording() {
  if (!isPttRecording) return;
  isPttRecording = false;
  window.isRecordingPtt = false;

  if (pttCountdownTimer) {
    clearInterval(pttCountdownTimer);
    pttCountdownTimer = null;
  }

  setPttRecordingUI(false);
  playPttChirp("roger");

  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: "broadcast",
        event: "voice_status",
        payload: {
          status: "idle",
          sender_id: currentSession.riderId,
          sender_name: currentSession.riderName || "Rider"
        }
      });
    } catch (e) {}
  }

  if (!window.isPlayingVoice && (!voicePlaybackQueue || voicePlaybackQueue.length === 0)) {
    setWalkieTalkieActive(false);
  }

  if (pttMediaRecorder && pttMediaRecorder.state !== "inactive") {
    try {
      pttMediaRecorder.stop();
    } catch (e) {
      console.debug("[PTT stop error]", e);
    }
  }
}

function handlePttPressStart(e) {
  if (e && e.cancelable && e.type === "touchstart") {
    e.preventDefault();
  }
  unlockAudioAutoplay();

  if (isPttRecording) {
    // Tap-to-Send: Tapping again immediately stops and sends!
    stopAndSendPttRecording();
    return;
  }

  pttPressStartTime = Date.now();
  startPttRecording();
}

function handlePttPressEnd(e) {
  if (e && e.cancelable && e.type === "touchend") {
    e.preventDefault();
  }
  if (!isPttRecording) return;

  const duration = Date.now() - pttPressStartTime;
  if (duration >= 400) {
    // Hold-to-Talk: Pressed and held (> 400ms), release stops and sends!
    stopAndSendPttRecording();
  } else {
    // Tap-to-Talk: Tapped once (< 400ms). Keep recording!
    // Next tap or 10-second countdown will stop and send.
  }
}

async function sendPttVoiceMessage(audioData) {
  if (!audioData) return;
  const cleanRoom = (currentSession.roomCode || "").trim().toUpperCase();
  if (!cleanRoom || cleanRoom === "----") {
    showRadarToast("CONVOY REQUIRED", "Join or create a tour room first to use Walkie-Talkie.");
    return;
  }

  const msgId = "v_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  playedVoiceIds.add(msgId);

  const voicePayload = {
    msgId: msgId,
    room_code: cleanRoom,
    sender_id: currentSession.riderId,
    sender_name: currentSession.riderName || "Rider",
    audio_data: audioData,
    created_at: new Date().toISOString()
  };

  showRadarToast("RADIO TRANSMITTED", "📻 Walkie-talkie clip broadcast to convoy!");

  // Engine A: Supabase Realtime Broadcast (event: 'voice_ptt')
  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: "broadcast",
        event: "voice_ptt",
        payload: voicePayload
      });
    } catch (bcErr) {
      console.debug("[PTT Realtime broadcast note]", bcErr);
    }
  }

  // Engine B: Supabase REST POST /rest/v1/voice_messages (Fallback, silently ignore if table not exists)
  try {
    await supabaseRest("voice_messages", "POST", {
      room_code: cleanRoom,
      sender_id: currentSession.riderId,
      sender_name: currentSession.riderName || "Rider",
      audio_data: audioData
    });
  } catch (restErr) {
    // Silently ignore if table doesn't exist yet
    console.debug("[PTT REST POST voice_messages note]", restErr);
  }
}

async function fetchRecentVoiceMessages() {
  if (!currentSession.roomCode || currentSession.roomCode === "----") return;
  const cleanRoom = encodeURIComponent(currentSession.roomCode.trim().toUpperCase());
  try {
    const list = await supabaseRest(
      `voice_messages?room_code=eq.${cleanRoom}&order=created_at.desc&limit=5`,
      "GET"
    );
    if (Array.isArray(list) && list.length > 0) {
      handleIncomingVoiceList(list);
    }
  } catch (err) {
    // Silently ignore if table doesn't exist yet
    console.debug("[PTT fetchRecentVoiceMessages note]", err);
  }
}

function handleIncomingVoiceList(list) {
  if (!Array.isArray(list)) return;
  const now = Date.now();
  const ordered = [...list].reverse();
  for (const item of ordered) {
    if (!item || !item.audio_data) continue;
    if (item.created_at) {
      const msgTime = new Date(item.created_at).getTime();
      if (now - msgTime > 12000) continue; // older than 12s
      if (msgTime < joinedRoomTimestamp - 3000) continue; // before rider joined room
    }
    handleIncomingVoiceMessage({
      msgId: item.msgId || (item.id ? ("db_" + item.id) : null),
      id: item.id,
      room_code: item.room_code,
      sender_id: item.sender_id,
      sender_name: item.sender_name,
      audio_data: item.audio_data,
      created_at: item.created_at
    });
  }
}

function handleIncomingVoiceMessage(msg) {
  if (!msg || !msg.audio_data) return;
  if (msg.sender_id && msg.sender_id === currentSession.riderId) return;

  const msgKey = msg.msgId || (msg.id ? ("db_" + msg.id) : null) || ("voice_" + (msg.sender_id || "") + "_" + (msg.created_at || ""));
  if (playedVoiceIds.has(msgKey)) return;

  if (msg.created_at) {
    const msgTime = new Date(msg.created_at).getTime();
    if (msgTime < joinedRoomTimestamp - 3000) return;
  }

  playedVoiceIds.add(msgKey);
  if (msg.id) playedVoiceIds.add("db_" + msg.id);
  if (msg.msgId) playedVoiceIds.add(msg.msgId);

  enqueueVoicePlayback(msg);
}

function enqueueVoicePlayback(msg) {
  if (isPttSpeakerMuted) {
    console.debug("[PTT] Speaker is muted, skipping voice from:", msg.sender_name);
    return;
  }
  voicePlaybackQueue.push(msg);
  window.isPlayingVoice = true;
  setWalkieTalkieActive(true);
  if (!isPlayingVoiceQueue) {
    processVoicePlaybackQueue();
  }
}

function processVoicePlaybackQueue() {
  if (voicePlaybackQueue.length === 0) {
    isPlayingVoiceQueue = false;
    window.isPlayingVoice = false;
    hidePttRadioBanner();
    if (!window.isRecordingPtt) {
      setWalkieTalkieActive(false);
    }
    return;
  }

  if (isPttSpeakerMuted) {
    voicePlaybackQueue = [];
    isPlayingVoiceQueue = false;
    window.isPlayingVoice = false;
    hidePttRadioBanner();
    if (!window.isRecordingPtt) {
      setWalkieTalkieActive(false);
    }
    return;
  }

  isPlayingVoiceQueue = true;
  window.isPlayingVoice = true;
  setWalkieTalkieActive(true);
  const currentMsg = voicePlaybackQueue.shift();

  showPttReceivingBanner(currentMsg.sender_name);
  playPttChirp("incoming");

  setTimeout(() => {
    if (isPttSpeakerMuted) {
      processVoicePlaybackQueue();
      return;
    }

    try {
      sharedAudioPlayer.src = currentMsg.audio_data;
      sharedAudioPlayer.onended = () => {
        playPttChirp("roger");
        setTimeout(() => {
          processVoicePlaybackQueue();
        }, 350);
      };
      sharedAudioPlayer.onerror = (e) => {
        console.warn("[PTT audio error]", e);
        setTimeout(() => {
          processVoicePlaybackQueue();
        }, 200);
      };
      sharedAudioPlayer.play().catch((err) => {
        console.warn("[PTT autoplay prevented]", err);
        setTimeout(() => {
          processVoicePlaybackQueue();
        }, 200);
      });
    } catch (e) {
      console.warn("[PTT playback setup error]", e);
      setTimeout(() => {
        processVoicePlaybackQueue();
      }, 200);
    }
  }, 120);
}

function togglePttSpeakerMute() {
  isPttSpeakerMuted = !isPttSpeakerMuted;
  const btn = document.getElementById("pttMuteSpeakerBtn");
  const icon = document.getElementById("pttSpeakerIcon");

  if (isPttSpeakerMuted) {
    if (icon) icon.textContent = "🔇";
    if (btn) {
      btn.classList.add("muted");
      btn.title = "Unmute Incoming Radio Audio (Currently Muted)";
    }
    if (isPlayingVoiceQueue) {
      try {
        sharedAudioPlayer.pause();
        sharedAudioPlayer.currentTime = 0;
      } catch (e) {}
      voicePlaybackQueue = [];
      isPlayingVoiceQueue = false;
      window.isPlayingVoice = false;
      hidePttRadioBanner();
      if (!window.isRecordingPtt) {
        setWalkieTalkieActive(false);
      }
    }
    showRadarToast("WALKIE-TALKIE MUTED", "Incoming radio audio muted.");
  } else {
    if (icon) icon.textContent = "🔊";
    if (btn) {
      btn.classList.remove("muted");
      btn.title = "Mute Incoming Radio Audio (Currently Active)";
    }
    unlockAudioAutoplay();
    showRadarToast("WALKIE-TALKIE ACTIVE", "Incoming radio audio unmuted.");
  }
}

function initPttCommunicator() {
  const pttTalkBtn = document.getElementById("pttTalkBtn");
  const pttMuteSpeakerBtn = document.getElementById("pttMuteSpeakerBtn");

  if (pttMuteSpeakerBtn && !pttMuteSpeakerBtn._hasPttListener) {
    pttMuteSpeakerBtn._hasPttListener = true;
    pttMuteSpeakerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePttSpeakerMute();
    });
    pttMuteSpeakerBtn.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      togglePttSpeakerMute();
    }, { passive: false });
  }

  if (pttTalkBtn && !pttTalkBtn._hasPttListener) {
    pttTalkBtn._hasPttListener = true;

    pttTalkBtn.addEventListener("touchstart", (e) => {
      pttLastTouchTime = Date.now();
      handlePttPressStart(e);
    }, { passive: false });

    pttTalkBtn.addEventListener("touchend", (e) => {
      pttLastTouchTime = Date.now();
      handlePttPressEnd(e);
    }, { passive: false });

    pttTalkBtn.addEventListener("touchcancel", (e) => {
      pttLastTouchTime = Date.now();
      if (isPttRecording) {
        stopAndSendPttRecording();
      }
    });

    pttTalkBtn.addEventListener("mousedown", (e) => {
      if (Date.now() - pttLastTouchTime < 600) return;
      if (e.button !== 0) return;
      handlePttPressStart(e);
    });

    pttTalkBtn.addEventListener("mouseup", (e) => {
      if (Date.now() - pttLastTouchTime < 600) return;
      if (e.button !== 0) return;
      handlePttPressEnd(e);
    });

    pttTalkBtn.addEventListener("mouseleave", (e) => {
      if (isPttRecording && pttPressStartTime && (Date.now() - pttPressStartTime >= 400)) {
        stopAndSendPttRecording();
      }
    });

    pttTalkBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    pttTalkBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }
}

// Auto-bind PTT listener on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPttCommunicator);
} else {
  initPttCommunicator();
}

// ==========================================
// 16. DOM EVENT BINDINGS & APP INITIALIZATION
// ==========================================
let hasAppInitialized = false;
function initApp() {
  if (hasAppInitialized) return;
  hasAppInitialized = true;

  // Initialize Map and DB Sync status immediately so tiles, marker, and green dot render right away
  try {
    initMap();
    updateSyncStatusUI(true);
  } catch (err) {
    console.warn("initApp immediate map/sync setup notice:", err);
  }
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

  // Requirement 1: Live Room Leader Check on Input / Paste / Change
  if (roomCodeInput) {
    const handleRoomCodeChange = () => {
      debouncedCheckRoomLeader(roomCodeInput.value);
    };
    roomCodeInput.addEventListener("input", handleRoomCodeChange);
    roomCodeInput.addEventListener("change", handleRoomCodeChange);
    roomCodeInput.addEventListener("paste", () => setTimeout(handleRoomCodeChange, 50));

    if (roomCodeInput.value) {
      debouncedCheckRoomLeader(roomCodeInput.value, 100);
    }
  }

  if (generateCodeBtn) {
    generateCodeBtn.addEventListener("click", () => {
      playSound("click");
      if (roomCodeInput) {
        roomCodeInput.value = generateRoomCode();
        if (typeof window.checkRoomLeaderStatus === "function") {
          window.checkRoomLeaderStatus(roomCodeInput.value);
        }
      }
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

  // Convoy Straggler Banner Buttons
  if (viewStragglerBtn) {
    viewStragglerBtn.addEventListener("click", () => {
      if (activeStragglerAlert) {
        window.centerOnRider(activeStragglerAlert.id);
        if (map && activeStragglerAlert.lat && activeStragglerAlert.lng) {
          map.setView([activeStragglerAlert.lat, activeStragglerAlert.lng], 16, { animate: true });
        }
      }
      minimizeConvoyAlert();
    });
  }

  const minimizeConvoyAlertBtn = document.getElementById("minimizeConvoyAlertBtn");
  if (minimizeConvoyAlertBtn) {
    minimizeConvoyAlertBtn.addEventListener("click", () => {
      playSound("click");
      minimizeConvoyAlert();
    });
  }

  if (dismissConvoyAlertBtn) {
    dismissConvoyAlertBtn.addEventListener("click", () => {
      playSound("click");
      dismissConvoyAlert();
    });
  }

  // Approaching Police Alert Buttons
  if (verifyApproachingBtn) {
    verifyApproachingBtn.addEventListener("click", () => {
      if (closestApproachingPolice) {
        openVerifyPoliceModal(closestApproachingPolice.id);
      }
      minimizeApproachingPoliceAlert();
    });
  }

  const minimizeApproachingBtn = document.getElementById("minimizeApproachingBtn");
  if (minimizeApproachingBtn) {
    minimizeApproachingBtn.addEventListener("click", () => {
      playSound("click");
      minimizeApproachingPoliceAlert();
    });
  }

  if (dismissApproachingBtn) {
    dismissApproachingBtn.addEventListener("click", () => {
      playSound("click");
      dismissApproachingPoliceAlert();
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

  const minimizeVerifyModalBtn = document.getElementById("minimizeVerifyModalBtn");
  if (minimizeVerifyModalBtn) {
    minimizeVerifyModalBtn.addEventListener("click", () => {
      playSound("click");
      minimizeVerifyPoliceModal();
    });
  }

  if (closeVerifyModalBtn) {
    closeVerifyModalBtn.addEventListener("click", () => {
      playSound("click");
      dismissVerifyPoliceModal();
    });
  }

  const minimizeRoadPopupBtn = document.getElementById("minimizeRoadPopupBtn");
  if (minimizeRoadPopupBtn) {
    minimizeRoadPopupBtn.addEventListener("click", () => {
      playSound("click");
      minimizeRoadTransitionPopup();
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

  // Camera / Photo Upload in Police Confirm Modal
  const policePhotoInput = document.getElementById("policePhotoInput");
  if (policePhotoInput) {
    policePhotoInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        handlePolicePhotoSelected(file);
      }
    });
  }

  const removePolicePhotoBtn = document.getElementById("removePolicePhotoBtn");
  if (removePolicePhotoBtn) {
    removePolicePhotoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playSound("click");
      clearPendingPolicePhoto();
    });
  }

  // Police Photo Viewer Lightbox backdrop click to close
  const policePhotoViewerModal = document.getElementById("policePhotoViewerModal");
  if (policePhotoViewerModal) {
    policePhotoViewerModal.addEventListener("click", (e) => {
      if (e.target === policePhotoViewerModal) {
        window.closePolicePhotoViewer();
      }
    });
  }

  if (cancelPoliceReportBtn) {
    cancelPoliceReportBtn.addEventListener("click", () => {
      playSound("click");
      if (policeConfirmModal) policeConfirmModal.classList.add("hidden");
      clearPendingPolicePhoto();
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
    simModeToggleBtn.addEventListener("click", (e) => {
      window.toggleSimDevPanel(e);
    });
  }

  if (closeSimPanelBtn) {
    closeSimPanelBtn.addEventListener("click", (e) => {
      window.closeSimDevPanel(e);
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
    if (map) {
      setTimeout(() => map.invalidateSize(), 200);
    }
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
      if (typeof window.checkRoomLeaderStatus === "function") {
        window.checkRoomLeaderStatus(cleanParam);
      }
      showRadarToast("CONVOY INVITE DETECTED", `Room ${cleanParam} pre-filled! Enter your name & hit Start Riding.`);
    } else if (hasExistingSession && currentSession.roomCode && currentSession.roomCode !== "----" && currentSession.riderName) {
      console.log("Restoring active biker session:", currentSession);
      if (riderNameInput) riderNameInput.value = currentSession.riderName;
      if (roomCodeInput) roomCodeInput.value = currentSession.roomCode;
      if (isLeaderCheckbox) isLeaderCheckbox.checked = currentSession.isLeader;
      if (typeof window.checkRoomLeaderStatus === "function") {
        window.checkRoomLeaderStatus(currentSession.roomCode);
      }
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

  // 6. Initialize PTT Walkie-Talkie Communicator
  try {
    if (typeof initPttCommunicator === "function") {
      initPttCommunicator();
    }
  } catch (pttErr) {
    console.warn("PTT Communicator init notice:", pttErr);
  }
}

// Ensure initApp executes reliably even if DOMContentLoaded already fired
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
