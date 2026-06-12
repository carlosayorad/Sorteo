/* ==========================================================================
   IASA · Vota y Gana — Lógica del sitio
   ========================================================================== */

/* ------------------------- CONFIGURACIÓN -------------------------
   1. SEND_CODE_URL / VERIFY_URL: endpoints de la API en Vercel.
   2. MATCH_DATE: fecha y hora de inicio del partido (hora de Ecuador,
      UTC-5). La votación se cierra automáticamente en ese momento.
      Debe coincidir con DEFAULT_MATCH_DATE en api/_util.js.
   3. POPUP_DELAY_MS: tiempo tras entrar a la página para mostrar el
      popup de registro (2 segundos).
   4. RESEND_COOLDOWN_S: segundos de espera para reenviar el código
      (debe coincidir con RESEND_COOLDOWN_MS en api/enviar-codigo.js).
------------------------------------------------------------------- */
const CONFIG = {
  SEND_CODE_URL: "/api/enviar-codigo",
  VERIFY_URL: "/api/verificar-codigo",
  MATCH_DATE: "2026-06-25T18:00:00-05:00",
  POPUP_DELAY_MS: 2000,
  RESEND_COOLDOWN_S: 60,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const STORAGE_KEY = "iasa_sorteo_mundial_2026";

/* ========================= Estado ========================= */
const matchDate = new Date(CONFIG.MATCH_DATE);
let votingClosed = false;
let selectedTeam = null;  // escudo elegido
let pendingData = null;   // datos válidos a la espera de elegir escudo
let sentData = null;      // datos con los que se envió el código
let registered = false;   // registro completado con éxito
let rejected = false;     // cerró el popup sin completar sus datos

const previous = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
})();

const alreadyVoted = Boolean(previous && previous.voto);

/* ========================= Cuenta regresiva ========================= */
const countdownEl = $("#countdown");

const pad = (n) => String(n).padStart(2, "0");

function updateCountdown() {
  const diff = matchDate - Date.now();

  if (diff <= 0) {
    votingClosed = true;
    countdownEl.classList.add("closed");
    countdownEl.querySelector(".countdown-title").textContent =
      "La votación ha cerrado. ¡Que gane el mejor!";
    return;
  }

  $("#cd-days").textContent = pad(Math.floor(diff / 86400000));
  $("#cd-hours").textContent = pad(Math.floor(diff / 3600000) % 24);
  $("#cd-mins").textContent = pad(Math.floor(diff / 60000) % 60);
  $("#cd-secs").textContent = pad(Math.floor(diff / 1000) % 60);
}

updateCountdown();
setInterval(updateCountdown, 1000);

/* ========================= Selección de equipo ========================= */
const crestCards = $$(".crest-card");
const pickHint = $("#pick-hint");
const pickDisplay = $("#pick-display");

function updatePickDisplay() {
  if (selectedTeam) {
    pickDisplay.classList.add("has-team");
    pickDisplay.innerHTML = `Mi pronóstico: <strong>${selectedTeam}</strong>`;
  } else {
    pickDisplay.classList.remove("has-team");
    pickDisplay.textContent =
      "Aún no eliges equipo: después de enviar tus datos, toca el escudo de tu pronóstico.";
  }
}

function selectTeam(team) {
  selectedTeam = team;

  crestCards.forEach((card) => {
    const isThis = card.dataset.team === team;
    card.classList.toggle("selected", isThis);
    card.classList.toggle("dimmed", !isThis);
    card.setAttribute("aria-checked", String(isThis));
  });

  pickHint.textContent = `¡Elegiste ${team}!`;
  updatePickDisplay();
}

crestCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (alreadyVoted || votingClosed || registered || rejected) return;
    selectTeam(card.dataset.team);

    if (sentData) {
      // Ya hay un código en camino: volver al paso de verificación
      openFormModal();
    } else if (pendingData) {
      // Datos listos y ya eligió escudo: enviar el código
      openFormModal();
      sendCode({ ...pendingData, voto: selectedTeam });
    }
  });
});

/* ========================= Popup de registro ========================= */
const formModal = $("#form-modal");
const form = $("#vote-form");
const codeForm = $("#code-form");

function showStep(step) {
  form.hidden = step !== "datos";
  codeForm.hidden = step !== "codigo";
  $("#success-card").hidden = step !== "exito";
}

function openFormModal() {
  if (votingClosed || rejected) return;
  updatePickDisplay();
  formModal.hidden = false;
  document.body.style.overflow = "hidden";
  if (registered) return;
  const focusTarget = sentData ? $("#codigo") : $("#nombre");
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function closeFormModal() {
  formModal.hidden = true;
  document.body.style.overflow = "";
}

/* Cerrar el popup sin haber completado los datos = fuera del sorteo */
function rejectVisitor() {
  rejected = true;
  closeFormModal();
  crestCards.forEach((card) => (card.disabled = true));
  pickHint.textContent = "";
  $("#reject-overlay").hidden = false;
  document.body.style.overflow = "hidden";
}

/* Intento de cierre: solo se permite sin penalización si ya dejó sus datos */
function attemptClose() {
  if (registered || pendingData || sentData) {
    closeFormModal();
    if (registered) return;
    if (sentData) {
      pickHint.textContent =
        "Te enviamos un código a tu correo. Toca tu escudo para terminar la verificación.";
    } else {
      pickHint.textContent =
        "¡Último paso! Toca el escudo de tu pronóstico para completar tu registro.";
    }
  } else {
    rejectVisitor();
  }
}

$$("[data-close-form]").forEach((el) => el.addEventListener("click", attemptClose));

/* ========================= Estados iniciales ========================= */
if (alreadyVoted) {
  registered = true;
  selectTeam(previous.voto);
  crestCards.forEach((card) => (card.disabled = true));
  pickHint.textContent = `Ya registraste tu pronóstico por ${previous.voto}. ¡Mucha suerte en el sorteo! 🍀`;
} else if (new Date() >= matchDate) {
  crestCards.forEach((card) => (card.disabled = true));
  pickHint.textContent = "La votación ha cerrado.";
} else {
  // Popup de registro a los 2 segundos de entrar a la página
  setTimeout(openFormModal, CONFIG.POPUP_DELAY_MS);
}

/* ========================= Validación ========================= */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function showError(field) {
  const el = $(`#error-${field}`);
  if (el) el.hidden = false;
  const input = $(`#${field}`);
  if (input) input.classList.add("invalid");
}

function hideError(field) {
  const el = $(`#error-${field}`);
  if (el) el.hidden = true;
  const input = $(`#${field}`);
  if (input) input.classList.remove("invalid");
}

["nombre", "apellido", "correo"].forEach((id) => {
  $(`#${id}`).addEventListener("input", () => hideError(id));
});
$("#acepta").addEventListener("change", () => hideError("acepta"));

function validate() {
  let ok = true;
  const nombre = $("#nombre").value.trim();
  const apellido = $("#apellido").value.trim();
  const correo = $("#correo").value.trim();
  const acepta = $("#acepta").checked;

  if (nombre.length < 2) { showError("nombre"); ok = false; }
  if (apellido.length < 2) { showError("apellido"); ok = false; }
  if (!EMAIL_RE.test(correo)) { showError("correo"); ok = false; }
  if (!acepta) { showError("acepta"); ok = false; }

  return ok ? { nombre, apellido, correo } : null;
}

/* ========================= Estado de los botones ========================= */
function setLoading(btn, loading, idleLabel) {
  btn.disabled = loading;
  btn.querySelector(".btn-label").textContent = loading ? "Enviando..." : idleLabel;
  btn.querySelector(".btn-spinner").hidden = !loading;
}

function setStatus(el, message, type) {
  if (!message) {
    el.hidden = true;
    return;
  }
  el.textContent = message;
  el.className = `form-status ${type}`;
  el.hidden = false;
}

const formStatus = $("#form-status");
const codeStatus = $("#code-status");

function showSuccess(team) {
  registered = true;
  pendingData = null;
  sentData = null;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ voto: team }));
  $("#success-msg").innerHTML =
    `Tu voto por <strong>${team}</strong> quedó registrado. Si ${team} gana el partido, ` +
    `entrarás automáticamente en el sorteo de la Smart&nbsp;TV&nbsp;55&Prime;&nbsp;4K.`;
  showStep("exito");
  pickHint.textContent = `Ya registraste tu pronóstico por ${team}. ¡Mucha suerte en el sorteo! 🍀`;
  crestCards.forEach((card) => (card.disabled = true));
}

/* ========================= Paso 1: enviar código ========================= */
const submitBtn = $("#submit-btn");

async function sendCode(data, { viaResend = false } = {}) {
  const btn = viaResend ? null : submitBtn;
  const statusTarget = viaResend ? codeStatus : formStatus;
  setStatus(statusTarget, "");
  if (btn) setLoading(btn, true, "Enviar código a mi correo");

  try {
    const res = await fetch(CONFIG.SEND_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();

    if (result.status === "ok" || result.status === "wait") {
      sentData = data;
      pendingData = null;
      $("#code-email").textContent = data.correo;
      showStep("codigo");
      $("#codigo").focus({ preventScroll: true });
      startResendCooldown();
      if (result.status === "wait") {
        setStatus(
          codeStatus,
          "Ya te enviamos un código hace menos de un minuto. Revisa tu correo y tu carpeta de spam.",
          "info"
        );
      } else if (viaResend) {
        setStatus(codeStatus, "Te enviamos un código nuevo. Revisa tu correo.", "info");
      }
    } else if (result.status === "duplicate") {
      setStatus(
        statusTarget,
        "Este correo ya tiene un pronóstico registrado. Solo se permite una participación por persona.",
        "info"
      );
    } else if (result.status === "closed") {
      setStatus(statusTarget, "La votación ya cerró: el partido está por comenzar.", "info");
    } else if (result.status === "mail_error") {
      setStatus(
        statusTarget,
        "No pudimos enviar el código a ese correo. Verifica que esté bien escrito.",
        "error"
      );
    } else {
      setStatus(statusTarget, "No pudimos enviar el código. Inténtalo nuevamente en unos minutos.", "error");
    }
  } catch {
    setStatus(statusTarget, "Error de conexión. Revisa tu internet e inténtalo nuevamente.", "error");
  } finally {
    if (btn) setLoading(btn, false, "Enviar código a mi correo");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus(formStatus, "");

  if (votingClosed) {
    setStatus(formStatus, "La votación ya cerró: el partido está por comenzar.", "info");
    return;
  }

  const data = validate();
  if (!data) return;

  if (selectedTeam) {
    sendCode({ ...data, voto: selectedTeam });
  } else {
    // Datos completos pero sin escudo elegido: cerrar y pedir que lo toque
    pendingData = data;
    closeFormModal();
    pickHint.textContent =
      "¡Último paso! Toca el escudo de tu pronóstico para completar tu registro.";
  }
});

/* ========================= Paso 2: verificar código ========================= */
const verifyBtn = $("#verify-btn");
const codigoInput = $("#codigo");
const resendBtn = $("#resend-btn");
let resendTimer = null;

// Solo dígitos en el campo del código
codigoInput.addEventListener("input", () => {
  codigoInput.value = codigoInput.value.replace(/\D/g, "").slice(0, 6);
  hideError("codigo");
});

function startResendCooldown() {
  let remaining = CONFIG.RESEND_COOLDOWN_S;
  resendBtn.disabled = true;
  clearInterval(resendTimer);

  const tick = () => {
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
      resendBtn.textContent = "Reenviar código";
      return;
    }
    resendBtn.textContent = `Reenviar código (${remaining--} s)`;
  };

  tick();
  resendTimer = setInterval(tick, 1000);
}

resendBtn.addEventListener("click", () => {
  if (sentData) sendCode(sentData, { viaResend: true });
});

$("#back-btn").addEventListener("click", () => {
  // Volver al paso de datos (p. ej. para corregir el correo)
  pendingData = null;
  showStep("datos");
  setStatus(codeStatus, "");
  $("#correo").focus({ preventScroll: true });
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(codeStatus, "");

  const codigo = codigoInput.value.trim();
  if (!/^\d{6}$/.test(codigo)) {
    showError("codigo");
    return;
  }

  setLoading(verifyBtn, true, "Confirmar y participar");

  try {
    const res = await fetch(CONFIG.VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: sentData.correo, codigo }),
    });
    const result = await res.json();

    if (result.status === "ok") {
      showSuccess(result.voto || sentData.voto);
    } else if (result.status === "invalid_code") {
      const extra =
        typeof result.remaining === "number" && result.remaining <= 2
          ? ` Te quedan ${result.remaining} intento${result.remaining === 1 ? "" : "s"}.`
          : "";
      setStatus(codeStatus, `Código incorrecto. Revisa tu correo e inténtalo de nuevo.${extra}`, "error");
    } else if (result.status === "expired") {
      setStatus(codeStatus, "El código expiró. Pulsa «Reenviar código» para recibir uno nuevo.", "info");
      resendBtn.disabled = false;
      resendBtn.textContent = "Reenviar código";
    } else if (result.status === "too_many") {
      setStatus(codeStatus, "Demasiados intentos. Pulsa «Reenviar código» para recibir uno nuevo.", "info");
      resendBtn.disabled = false;
      resendBtn.textContent = "Reenviar código";
    } else if (result.status === "not_found") {
      setStatus(codeStatus, "No encontramos tu verificación. Vuelve a enviar tus datos.", "error");
    } else if (result.status === "duplicate") {
      setStatus(
        codeStatus,
        "Este correo ya tiene un pronóstico registrado. Solo se permite una participación por persona.",
        "info"
      );
    } else if (result.status === "closed") {
      setStatus(codeStatus, "La votación ya cerró: el partido está por comenzar.", "info");
    } else {
      setStatus(codeStatus, "No pudimos verificar el código. Inténtalo nuevamente en unos minutos.", "error");
    }
  } catch {
    setStatus(codeStatus, "Error de conexión. Revisa tu internet e inténtalo nuevamente.", "error");
  } finally {
    setLoading(verifyBtn, false, "Confirmar y participar");
  }
});

/* ========================= Modal de bases ========================= */
const termsModal = $("#terms-modal");

$$("[data-open-terms]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    termsModal.hidden = false;
    document.body.style.overflow = "hidden";
  });
});

$$("[data-close-terms]").forEach((el) => {
  el.addEventListener("click", () => {
    termsModal.hidden = true;
    // Si el popup de registro sigue abierto debajo, mantener el scroll bloqueado
    document.body.style.overflow = formModal.hidden ? "" : "hidden";
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!termsModal.hidden) {
    termsModal.hidden = true;
    document.body.style.overflow = formModal.hidden ? "" : "hidden";
  } else if (!formModal.hidden) {
    attemptClose();
  }
});
