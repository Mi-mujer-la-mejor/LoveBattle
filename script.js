// ═══════════════════════════════════════════════════════
//  LOVE BATTLE — script.js
//  Firebase Firestore (SDK modular v10)
//  Tiempo real · Samuel vs Melannie
// ═══════════════════════════════════════════════════════
 
import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore,
         doc,
         getDoc,
         setDoc,
         onSnapshot,
         increment,
         updateDoc }              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
 
// ─────────────────────────────────────────────────────
//  ⚙️  CONFIGURACIÓN DE FIREBASE
//  Reemplaza los valores con los de tu proyecto en
//  Firebase Console → Configuración del proyecto
// ─────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCF7dCol5qhqZGcQzrmGH4bGdv2bC15fTk",
  authDomain: "lovebattle-a0698.firebaseapp.com",
  projectId: "lovebattle-a0698",
  storageBucket: "lovebattle-a0698.firebasestorage.app",
  messagingSenderId: "713820448564",
  appId: "1:713820448564:web:7f5b56203f7efe5ec8e761"
};
// ─────────────────────────────────────────────────────
 
// ── Inicializar Firebase ──────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
 
// ── Referencia al documento de puntajes ──────────────
// Estructura en Firestore:
//   colección: "lovebattle"
//   documento: "scores"
//   campos:    { samuel: number, melannie: number }
const scoresRef = doc(db, "lovebattle", "scores");
 
// ═══════════════════════════════════════════════════════
//  ESTADO LOCAL (para la barra de progreso)
// ═══════════════════════════════════════════════════════
let scores = { samuel: 0, melannie: 0 };
 
// ═══════════════════════════════════════════════════════
//  REFERENCIAS AL DOM
// ═══════════════════════════════════════════════════════
const elSamuelScore   = document.getElementById("score-samuel");
const elMelannieScore = document.getElementById("score-melannie");
const btnSamuel       = document.getElementById("btn-samuel");
const btnMelannie     = document.getElementById("btn-melannie");
const progressFill    = document.getElementById("progress-fill");
const statusBar       = document.getElementById("status-bar");
const statusDot       = document.getElementById("status-dot");
const statusText      = document.getElementById("status-text");
 
// ═══════════════════════════════════════════════════════
//  HELPERS: UI
// ═══════════════════════════════════════════════════════
 
/** Actualiza el color y texto de la barra de estado */
function setStatus(state, text) {
  statusBar.className  = state;   // "connected" | "error" | ""
  statusText.textContent = text;
}
 
/**
 * Muestra el número animado y actualiza la barra de progreso.
 * @param {string} player  "samuel" | "melannie"
 * @param {number} value   Nuevo valor
 */
function updateScoreUI(player, value) {
  const el = player === "samuel" ? elSamuelScore : elMelannieScore;
 
  // Bump animation en el número
  el.classList.remove("bump");
  void el.offsetWidth;           // fuerza reflow para reiniciar la animación
  el.textContent = value;
  el.classList.add("bump");
 
  // Guardar en estado local y actualizar barra
  scores[player] = value;
  updateProgressBar();
}
 
/** Actualiza la barra de progreso según los puntajes */
function updateProgressBar() {
  const total = scores.samuel + scores.melannie;
  if (total === 0) {
    progressFill.style.width = "50%";
    return;
  }
  // La barra va de izq (Samuel) a der (Melannie)
  const pct = (scores.samuel / total) * 100;
  progressFill.style.width = `${pct}%`;
}
 
// ═══════════════════════════════════════════════════════
//  EFECTO: POP + corazoncito flotante al hacer clic
// ═══════════════════════════════════════════════════════
 
/**
 * Aplica efecto pop al botón.
 * @param {HTMLButtonElement} btn
 */
function popHeart(btn) {
  btn.classList.remove("pop");
  void btn.offsetWidth;
  btn.classList.add("pop");
 
  // Quitar clase cuando termina la animación
  btn.addEventListener("animationend", () => btn.classList.remove("pop"), { once: true });
}
 
/**
 * Lanza mini-corazones flotantes desde la posición del clic.
 * @param {MouseEvent|TouchEvent} event
 */
function spawnFloatyHearts(event) {
  const count = 4;
  const emojis = ["❤️","💕","💗","💓","💞"];
 
  // Coordenadas del toque/clic
  const touch = event.changedTouches ? event.changedTouches[0] : event;
  const x = touch.clientX;
  const y = touch.clientY;
 
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "floaty-heart";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
 
    // Posición aleatoria alrededor del toque
    const offsetX = (Math.random() - 0.5) * 60;
    el.style.left = `${x + offsetX}px`;
    el.style.top  = `${y}px`;
    el.style.fontSize = `${0.8 + Math.random() * 0.8}rem`;
    el.style.animationDelay = `${i * 0.07}s`;
 
    document.body.appendChild(el);
    // Eliminar del DOM después de que termine la animación
    el.addEventListener("animationend", () => el.remove());
  }
}
 
// ═══════════════════════════════════════════════════════
//  FIRESTORE: inicializar documento si no existe
// ═══════════════════════════════════════════════════════
async function initScores() {
  try {
    const snap = await getDoc(scoresRef);
    if (!snap.exists()) {
      // Primera vez: crear documento con valores en 0
      await setDoc(scoresRef, { samuel: 0, melannie: 0 });
      console.log("📄 Documento de puntajes creado en Firestore.");
    }
  } catch (err) {
    console.error("Error inicializando puntajes:", err);
    setStatus("error", "Error al conectar con Firebase");
  }
}
 
// ═══════════════════════════════════════════════════════
//  FIRESTORE: listener en tiempo real
// ═══════════════════════════════════════════════════════
function subscribeScores() {
  // onSnapshot dispara cada vez que el documento cambia en Firestore
  const unsubscribe = onSnapshot(
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
      console.error("Error en listener:", err);
      setStatus("error", "Sin conexión");
    }
  );
 
  // Retornar la función de cancelación (por si necesitas limpiar)
  return unsubscribe;
}
 
// ═══════════════════════════════════════════════════════
//  FIRESTORE: sumar +1 al jugador
// ═══════════════════════════════════════════════════════
 
/**
 * Incrementa en 1 el puntaje del jugador en Firestore.
 * Usa `increment()` para evitar condiciones de carrera (race conditions)
 * cuando varios dispositivos hacen clic al mismo tiempo.
 * @param {"samuel"|"melannie"} player
 */
async function addPoint(player) {
  try {
    await updateDoc(scoresRef, {
      [player]: increment(1)
    });
  } catch (err) {
    console.error(`Error al sumar punto a ${player}:`, err);
  }
}
 
// ═══════════════════════════════════════════════════════
//  EVENTOS DE BOTONES
// ═══════════════════════════════════════════════════════
 
/** Manejador genérico para el toque/clic de un jugador */
function handleClick(player, btn, event) {
  event.preventDefault();           // evita doble disparo en móvil
  popHeart(btn);                    // efecto pop visual
  spawnFloatyHearts(event);         // corazoncitos flotantes
  addPoint(player);                 // guardar en Firebase
}
 
// Samuel
btnSamuel.addEventListener("click",      (e) => handleClick("samuel",   btnSamuel,   e));
btnSamuel.addEventListener("touchstart", (e) => handleClick("samuel",   btnSamuel,   e), { passive: false });
 
// Melannie
btnMelannie.addEventListener("click",      (e) => handleClick("melannie", btnMelannie, e));
btnMelannie.addEventListener("touchstart", (e) => handleClick("melannie", btnMelannie, e), { passive: false });
 
// ═══════════════════════════════════════════════════════
//  CANVAS: CORAZONES FLOTANTES DE FONDO
//  Partículas suaves animadas continuamente en el canvas
// ═══════════════════════════════════════════════════════
(function initParticles() {
  const canvas = document.getElementById("particles");
  const ctx    = canvas.getContext("2d");
  const hearts = [];
  const COUNT  = 22;
 
  // Ajustar tamaño del canvas al viewport
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();
 
  /**
   * Dibuja un corazón pequeño en (x, y) con tamaño `s`.
   * @param {number} x  Centro X
   * @param {number} y  Centro Y
   * @param {number} s  Escala (radio aproximado)
   */
  function drawHeart(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -0.3);
    ctx.bezierCurveTo( 0.5, -1,  1.2, -0.3,  0,  0.8);
    ctx.bezierCurveTo(-1.2, -0.3, -0.5, -1,  0, -0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
 
  // Crear partículas con propiedades aleatorias
  for (let i = 0; i < COUNT; i++) {
    hearts.push({
      x:      Math.random() * window.innerWidth,
      y:      Math.random() * window.innerHeight,
      size:   4 + Math.random() * 10,
      speedY: 0.15 + Math.random() * 0.35,
      speedX: (Math.random() - 0.5) * 0.2,
      alpha:  0.04 + Math.random() * 0.12,
      wobble: Math.random() * Math.PI * 2,   // fase inicial del wobble
    });
  }
 
  // Loop de animación
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
 
    hearts.forEach((h) => {
      // Wobble horizontal suave
      h.wobble += 0.015;
      h.x += Math.sin(h.wobble) * 0.4 + h.speedX;
      h.y -= h.speedY;
 
      // Reiniciar cuando sale por arriba
      if (h.y < -20) {
        h.y = canvas.height + 20;
        h.x = Math.random() * canvas.width;
      }
 
      // Dibujar
      ctx.globalAlpha = h.alpha;
      ctx.fillStyle   = `hsl(${340 + Math.random() * 20}, 80%, 65%)`;
      drawHeart(h.x, h.y, h.size);
    });
 
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
 
  animate();
})();
 
// ═══════════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════════
(async function main() {
  setStatus("", "Conectando…");
  await initScores();
  subscribeScores();
})();
 