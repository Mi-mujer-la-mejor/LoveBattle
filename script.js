// ═══════════════════════════════════════════════════════════
//  LOVE BATTLE — script.js  (v2)
//  Firebase Firestore SDK modular v10
//
//  Nuevas funciones:
//  ✦ Reinicio automático cada 24 h (a medianoche local)
//  ✦ El ganador del día recibe +1 victoria en el récord
//  ✦ Historial de los últimos 10 días
//  ✦ Racha de victorias consecutivas
//  ✦ Mensaje romántico "X amó más a Y hoy"
//  ✦ Contador regresivo hasta el próximo reinicio
//  ✦ Modal de celebración al hacer el reinicio
// ═══════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  onSnapshot, increment, updateDoc,
  collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─────────────────────────────────────────────────────────
//  ⚙️  CONFIGURACIÓN DE FIREBASE
//  Reemplaza con los datos de tu proyecto:
//  Firebase Console → tu proyecto → ⚙️ Configuración
// ─────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_AUTH_DOMAIN",
  projectId:         "TU_PROJECT_ID",
  storageBucket:     "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId:             "TU_APP_ID"
};
// ─────────────────────────────────────────────────────────

// ── Firebase ─────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Referencias Firestore ─────────────────────────────────
// lovebattle/scores  → puntajes del día actual
// lovebattle/meta    → fecha del día activo + racha
// lovebattle/history → subcolección con un doc por día
const scoresRef  = doc(db, "lovebattle", "scores");
const metaRef    = doc(db, "lovebattle", "meta");
const historyCol = collection(db, "lovebattle", "history", "days");

// ═══════════════════════════════════════════════════════════
//  ESTADO LOCAL
// ═══════════════════════════════════════════════════════════
let scores = { samuel: 0, melannie: 0 };

// ═══════════════════════════════════════════════════════════
//  DOM
// ═══════════════════════════════════════════════════════════
const elSamuelScore   = document.getElementById("score-samuel");
const elMelannieScore = document.getElementById("score-melannie");
const elWinsSamuel    = document.getElementById("wins-samuel");
const elWinsMelannie  = document.getElementById("wins-melannie");
const btnSamuel       = document.getElementById("btn-samuel");
const btnMelannie     = document.getElementById("btn-melannie");
const progressFill    = document.getElementById("progress-fill");
const statusBar       = document.getElementById("status-bar");
const statusText      = document.getElementById("status-text");
const winnerMsg       = document.getElementById("winner-msg");
const winnerText      = document.getElementById("winner-text");
const streakWrap      = document.getElementById("streak-wrap");
const streakText      = document.getElementById("streak-text");
const historyList     = document.getElementById("history-list");
const modalOverlay    = document.getElementById("modal-overlay");
const modalTitle      = document.getElementById("modal-title");
const modalSub        = document.getElementById("modal-sub");
const modalClose      = document.getElementById("modal-close");
const cdHours         = document.getElementById("cd-hours");
const cdMinutes       = document.getElementById("cd-minutes");
const cdSeconds       = document.getElementById("cd-seconds");

// ═══════════════════════════════════════════════════════════
//  UTILIDADES DE FECHA
// ═══════════════════════════════════════════════════════════

/** Devuelve la fecha local como string "YYYY-MM-DD" */
function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Formato legible: "26 mayo" */
function formatDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    day: "numeric", month: "long"
  });
}

/** Ms que faltan hasta la próxima medianoche local */
function msUntilMidnight() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next - now;
}

// ═══════════════════════════════════════════════════════════
//  HELPERS UI
// ═══════════════════════════════════════════════════════════

function setStatus(state, text) {
  statusBar.className = state;
  statusText.textContent = text;
}

function updateScoreUI(player, value) {
  const el = player === "samuel" ? elSamuelScore : elMelannieScore;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.textContent = value;
  el.classList.add("bump");
  scores[player] = value;
  updateProgressBar();
  updateWinnerMsg();
}

function updateProgressBar() {
  const total = scores.samuel + scores.melannie;
  progressFill.style.width = total === 0 ? "50%" : `${(scores.samuel / total) * 100}%`;
}

/** Muestra el mensaje romántico según quién va ganando */
function updateWinnerMsg() {
  const { samuel, melannie } = scores;
  if (samuel === 0 && melannie === 0) {
    winnerMsg.hidden = true;
    return;
  }
  winnerMsg.hidden = false;

  if (samuel > melannie) {
    winnerText.textContent = `Samuel amó más a Melannie hoy! (${samuel} vs ${melannie})`;
  } else if (melannie > samuel) {
    winnerText.textContent = `Melannie amó más a Samuel hoy! (${melannie} vs ${samuel})`;
  } else {
    winnerText.textContent = `Están empatados en amor!  (${samuel} cada uno)`;
  }
}

/** Actualiza las victorias totales en pantalla */
function updateWinsUI(winsSamuel, winsMelannie) {
  elWinsSamuel.textContent   = winsSamuel;
  elWinsMelannie.textContent = winsMelannie;
}

/** Muestra la racha actual */
function updateStreakUI(streakPlayer, streakCount) {
  if (!streakPlayer || streakCount < 2) {
    streakText.textContent = "";
    return;
  }
  const name = streakPlayer === "samuel" ? "Samuel" : "Melannie";
  streakText.textContent = `🔥 ${name} lleva ${streakCount} días ganando seguidos`;
}

// ═══════════════════════════════════════════════════════════
//  HISTORIAL
// ═══════════════════════════════════════════════════════════

/** Carga y renderiza los últimos 10 días del historial */
async function loadHistory() {
  try {
    const q    = query(historyCol, orderBy("date", "desc"), limit(10));
    const snap = await getDocs(q);

    if (snap.empty) return;

    historyList.innerHTML = "";
    const today = todayKey();

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const isToday = d.date === today;
      const row = document.createElement("div");
      row.className = "history-row" +
        (d.winner === "draw" ? " draw" : "") +
        (isToday ? " today" : "");

      let resultHTML;
      if (d.winner === "draw") {
        resultHTML = `<span>💞 Empate</span>`;
      } else {
        const name = d.winner === "samuel" ? "Samuel" : "Melannie";
        resultHTML = `<strong>❤️ ${name}</strong> ganó`;
      }

      row.innerHTML = `
        <span class="history-date">${isToday ? "Hoy" : formatDate(d.date)}</span>
        <span class="history-result">${resultHTML}</span>
        <span class="history-scores">${d.samuel} – ${d.melannie}</span>
      `;
      historyList.appendChild(row);
    });
  } catch (err) {
    console.error("Error cargando historial:", err);
  }
}

// ═══════════════════════════════════════════════════════════
//  MODAL DE CELEBRACIÓN
// ═══════════════════════════════════════════════════════════

function showModal(winner, samuelScore, melannieScore) {
  if (winner === "draw") {
    modalTitle.textContent = "¡Empate de amor! 💞";
    modalSub.textContent   = `Los dos amaron igual: ${samuelScore} latidos cada uno. ¡El amor es recíproco! 🥰`;
  } else {
    const name    = winner === "samuel" ? "Samuel" : "Melannie";
    const loser   = winner === "samuel" ? "Melannie" : "Samuel";
    const myScore = winner === "samuel" ? samuelScore : melannieScore;
    const theirScore = winner === "samuel" ? melannieScore : samuelScore;
    modalTitle.textContent = `¡${name} ganó hoy! 👑`;
    modalSub.textContent   = `${name} amó más a ${loser} con ${myScore} latidos vs ${theirScore}. ¡+1 victoria para ${name}! 🎉`;
  }
  modalOverlay.hidden = false;
}

modalClose.addEventListener("click", () => {
  modalOverlay.hidden = true;
});

// ═══════════════════════════════════════════════════════════
//  REINICIO DIARIO
// ═══════════════════════════════════════════════════════════

/**
 * Revisa si el día activo en Firestore coincide con hoy.
 * Si no, ejecuta el reinicio: guarda el día en historial,
 * suma victoria al ganador y resetea los puntajes.
 */
async function checkDailyReset() {
  try {
    const metaSnap   = await getDoc(metaRef);
    const scoresSnap = await getDoc(scoresRef);

    const today = todayKey();

    // Si no existe meta, inicializar
    if (!metaSnap.exists()) {
      await setDoc(metaRef, {
        activeDate:     today,
        winsSamuel:     0,
        winsMelannie:   0,
        streakPlayer:   null,
        streakCount:    0
      });
      return;
    }

    const meta   = metaSnap.data();
    const scores = scoresSnap.exists() ? scoresSnap.data() : { samuel: 0, melannie: 0 };

    // Si el día activo ya es hoy → no hacer nada
    if (meta.activeDate === today) {
      updateWinsUI(meta.winsSamuel ?? 0, meta.winsMelannie ?? 0);
      updateStreakUI(meta.streakPlayer, meta.streakCount);
      return;
    }

    // ── NUEVO DÍA: cerrar el día anterior ──────────────────
    const s = scores.samuel   ?? 0;
    const m = scores.melannie ?? 0;

    let winner;
    if (s > m)      winner = "samuel";
    else if (m > s) winner = "melannie";
    else            winner = "draw";

    // 1) Guardar en historial
    await setDoc(doc(historyCol, meta.activeDate), {
      date:     meta.activeDate,
      samuel:   s,
      melannie: m,
      winner
    });

    // 2) Calcular nuevas victorias y racha
    let { winsSamuel = 0, winsMelannie = 0, streakPlayer = null, streakCount = 0 } = meta;

    if (winner === "samuel") {
      winsSamuel++;
      streakCount  = streakPlayer === "samuel" ? streakCount + 1 : 1;
      streakPlayer = "samuel";
    } else if (winner === "melannie") {
      winsMelannie++;
      streakCount  = streakPlayer === "melannie" ? streakCount + 1 : 1;
      streakPlayer = "melannie";
    } else {
      // Empate: rompe la racha
      streakPlayer = null;
      streakCount  = 0;
    }

    // 3) Actualizar meta
    await updateDoc(metaRef, {
      activeDate: today,
      winsSamuel,
      winsMelannie,
      streakPlayer,
      streakCount
    });

    // 4) Resetear puntajes del día
    await setDoc(scoresRef, { samuel: 0, melannie: 0 });

    // 5) Mostrar modal de celebración
    showModal(winner, s, m);

    // 6) Actualizar UI con nuevas victorias y racha
    updateWinsUI(winsSamuel, winsMelannie);
    updateStreakUI(streakPlayer, streakCount);

    // 7) Recargar historial
    await loadHistory();

  } catch (err) {
    console.error("Error en checkDailyReset:", err);
  }
}

// ═══════════════════════════════════════════════════════════
//  CONTADOR REGRESIVO
// ═══════════════════════════════════════════════════════════

function startCountdown() {
  function tick() {
    const ms   = msUntilMidnight();
    const h    = Math.floor(ms / 3_600_000);
    const min  = Math.floor((ms % 3_600_000) / 60_000);
    const sec  = Math.floor((ms % 60_000) / 1_000);

    cdHours.textContent   = String(h).padStart(2, "0");
    cdMinutes.textContent = String(min).padStart(2, "0");
    cdSeconds.textContent = String(sec).padStart(2, "0");

    // Si llega a 0, forzar reinicio
    if (ms <= 1000) {
      setTimeout(async () => {
        await checkDailyReset();
        await loadHistory();
      }, 1200);
    }
  }

  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════
//  FIRESTORE: inicializar scores si no existen
// ═══════════════════════════════════════════════════════════
async function initScores() {
  try {
    const snap = await getDoc(scoresRef);
    if (!snap.exists()) {
      await setDoc(scoresRef, { samuel: 0, melannie: 0 });
    }
  } catch (err) {
    console.error("Error inicializando scores:", err);
    setStatus("error", "Error al conectar");
  }
}

// ═══════════════════════════════════════════════════════════
//  FIRESTORE: listener tiempo real
// ═══════════════════════════════════════════════════════════
function subscribeScores() {
  return onSnapshot(
    scoresRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        updateScoreUI("samuel",   data.samuel   ?? 0);
        updateScoreUI("melannie", data.melannie ?? 0);
        setStatus("connected", "En vivo ✦");
      }
    },
    (err) => {
      console.error("Listener error:", err);
      setStatus("error", "Sin conexión");
    }
  );
}

// Listener en meta para victorias y racha en tiempo real
function subscribeMeta() {
  return onSnapshot(metaRef, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      updateWinsUI(d.winsSamuel ?? 0, d.winsMelannie ?? 0);
      updateStreakUI(d.streakPlayer, d.streakCount);
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  FIRESTORE: sumar punto
// ═══════════════════════════════════════════════════════════
async function addPoint(player) {
  try {
    await updateDoc(scoresRef, { [player]: increment(1) });
  } catch (err) {
    console.error(`Error sumando punto a ${player}:`, err);
  }
}

// ═══════════════════════════════════════════════════════════
//  EFECTOS VISUALES
// ═══════════════════════════════════════════════════════════

function popHeart(btn) {
  btn.classList.remove("pop");
  void btn.offsetWidth;
  btn.classList.add("pop");
  btn.addEventListener("animationend", () => btn.classList.remove("pop"), { once: true });
}

function spawnFloatyHearts(event) {
  const emojis = ["❤️","💕","💗","💓","💞","🌹"];
  const touch  = event.changedTouches ? event.changedTouches[0] : event;
  for (let i = 0; i < 4; i++) {
    const el = document.createElement("span");
    el.className   = "floaty-heart";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left  = `${touch.clientX + (Math.random() - .5) * 60}px`;
    el.style.top   = `${touch.clientY}px`;
    el.style.fontSize     = `${.8 + Math.random() * .8}rem`;
    el.style.animationDelay = `${i * .07}s`;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

// ═══════════════════════════════════════════════════════════
//  EVENTOS BOTONES
// ═══════════════════════════════════════════════════════════

function handleClick(player, btn, event) {
  event.preventDefault();
  popHeart(btn);
  spawnFloatyHearts(event);
  addPoint(player);
}

btnSamuel.addEventListener("click",      (e) => handleClick("samuel",   btnSamuel,   e));
btnSamuel.addEventListener("touchstart", (e) => handleClick("samuel",   btnSamuel,   e), { passive: false });
btnMelannie.addEventListener("click",    (e) => handleClick("melannie", btnMelannie, e));
btnMelannie.addEventListener("touchstart",(e)=> handleClick("melannie", btnMelannie, e), { passive: false });

// ═══════════════════════════════════════════════════════════
//  CANVAS: CORAZONES FLOTANTES DE FONDO
// ═══════════════════════════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById("particles");
  const ctx    = canvas.getContext("2d");
  const COUNT  = 22;
  const hearts = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function drawHeart(x, y, s) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -.3);
    ctx.bezierCurveTo( .5,-1,  1.2,-.3, 0,  .8);
    ctx.bezierCurveTo(-1.2,-.3,-.5,-1,  0, -.3);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  for (let i = 0; i < COUNT; i++) {
    hearts.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size:   4 + Math.random() * 10,
      speedY: .15 + Math.random() * .35,
      speedX: (Math.random() - .5) * .2,
      alpha:  .04 + Math.random() * .12,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  (function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hearts.forEach((h) => {
      h.wobble += .015;
      h.x += Math.sin(h.wobble) * .4 + h.speedX;
      h.y -= h.speedY;
      if (h.y < -20) { h.y = canvas.height + 20; h.x = Math.random() * canvas.width; }
      ctx.globalAlpha = h.alpha;
      ctx.fillStyle   = `hsl(${340 + Math.random() * 20},80%,65%)`;
      drawHeart(h.x, h.y, h.size);
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  })();
})();

// ═══════════════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════════════
(async function main() {
  setStatus("", "Conectando…");
  await initScores();
  await checkDailyReset();   // ← verifica si hay que reiniciar
  subscribeScores();          // ← escucha cambios en tiempo real
  subscribeMeta();            // ← escucha victorias/racha en tiempo real
  await loadHistory();        // ← carga el historial
  startCountdown();           // ← arranca el contador regresivo
})();
 
