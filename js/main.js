/* ==========================================================================
   IASA · Vota y Gana — Lógica del sitio
   ========================================================================== */

/* ------------------------- CONFIGURACIÓN -------------------------
   1. API_URL: endpoint que guarda los votos. En Vercel es la función
      serverless api/votar.js, servida en /api/votar.
   2. MATCH_DATE: fecha y hora de inicio del partido (hora de Ecuador,
      UTC-5). La votación se cierra automáticamente en ese momento.
      Debe coincidir con DEFAULT_MATCH_DATE en api/votar.js.
   3. POPUP_DELAY_MS: tiempo tras entrar a la página para mostrar el
      popup de registro (3 segundos).
------------------------------------------------------------------- */
const CONFIG = {
  API_URL: "/api/votar",
  MATCH_DATE: "2026-06-25T18:00:00-05:00",
  POPUP_DELAY_MS: 3000,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const STORAGE_KEY = "iasa_sorteo_mundial_2026";

/* ========================= Estado ========================= */
const matchDate = new Date(CONFIG.MATCH_DATE);
let votingClosed = false;
let selectedTeam = null; // escudo elegido
let pendingData = null;  // datos enviados en el popup antes de elegir escudo
let registered = false;  // registro completado con éxito
let rejected = false;    // cerró el popup sin completar sus datos

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

    // Si ya dejó sus datos en el popup, el toque al escudo completa el registro
    if (pendingData) {
      openFormModal();
      submitRegistration({ ...pendingData, voto: selectedTeam });
    }
  });
});

/* ========================= Popup de registro ========================= */
const formModal = $("#form-modal");

function openFormModal() {
  if (votingClosed || rejected) return;
  updatePickDisplay();
  formModal.hidden = false;
  document.body.style.overflow = "hidden";
  const nombre = $("#nombre");
  if (!registered && nombre && !nombre.disabled) nombre.focus({ preventScroll: true });
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

$$("[data-close-form]").forEach((el) => {
  el.addEventListener("click", () => {
    if (registered || pendingData) {
      // Sus datos ya están completos: puede cerrar sin penalización
      closeFormModal();
      if (!registered && pendingData) {
        pickHint.textContent =
          "¡Último paso! Toca el escudo de tu pronóstico para completar tu registro.";
      }
    } else {
      rejectVisitor();
    }
  });
});

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
  // Popup de registro a los 3 segundos de entrar a la página
  setTimeout(openFormModal, CONFIG.POPUP_DELAY_MS);
}

/* ========================= Validación ========================= */
const form = $("#vote-form");
const submitBtn = $("#submit-btn");
const statusEl = $("#form-status");

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

/* ========================= Estado del formulario ========================= */
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.querySelector(".btn-label").textContent = loading
    ? "Enviando..."
    : "Enviar y participar";
  submitBtn.querySelector(".btn-spinner").hidden = !loading;
}

function setStatus(message, type) {
  if (!message) {
    statusEl.hidden = true;
    return;
  }
  statusEl.textContent = message;
  statusEl.className = `form-status ${type}`;
  statusEl.hidden = false;
}

function showSuccess(team) {
  registered = true;
  pendingData = null;
  form.hidden = true;
  $("#success-msg").innerHTML =
    `Tu voto por <strong>${team}</strong> quedó registrado. Si ${team} gana el partido, ` +
    `entrarás automáticamente en el sorteo de la Smart&nbsp;TV&nbsp;55&Prime;&nbsp;4K.`;
  $("#success-card").hidden = false;
  pickHint.textContent = `Ya registraste tu pronóstico por ${team}. ¡Mucha suerte en el sorteo! 🍀`;
  crestCards.forEach((card) => (card.disabled = true));
}

/* ========================= Envío ========================= */
async function submitRegistration(data) {
  setStatus("");
  setLoading(true);

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (result.status === "ok") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ voto: data.voto }));
      showSuccess(data.voto);
    } else if (result.status === "duplicate") {
      setStatus(
        "Este correo ya tiene un pronóstico registrado. Solo se permite una participación por persona.",
        "info"
      );
    } else if (result.status === "closed") {
      setStatus("La votación ya cerró: el partido está por comenzar.", "info");
    } else {
      setStatus("No pudimos registrar tu voto. Inténtalo nuevamente en unos minutos.", "error");
    }
  } catch {
    setStatus("Error de conexión. Revisa tu internet e inténtalo nuevamente.", "error");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  setStatus("");

  if (votingClosed) {
    setStatus("La votación ya cerró: el partido está por comenzar.", "info");
    return;
  }

  const data = validate();
  if (!data) return;

  if (selectedTeam) {
    submitRegistration({ ...data, voto: selectedTeam });
  } else {
    // Datos completos pero sin escudo elegido: cerrar y pedir que lo toque
    pendingData = data;
    closeFormModal();
    pickHint.textContent =
      "¡Último paso! Toca el escudo de tu pronóstico para completar tu registro.";
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
    // Escape también cuenta como cerrar el popup
    if (registered || pendingData) {
      closeFormModal();
      if (!registered && pendingData) {
        pickHint.textContent =
          "¡Último paso! Toca el escudo de tu pronóstico para completar tu registro.";
      }
    } else {
      rejectVisitor();
    }
  }
});
