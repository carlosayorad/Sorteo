/* ==========================================================================
   IASA · Pronostica y Gana — Lógica del sitio
   ========================================================================== */

/* ------------------------- CONFIGURACIÓN -------------------------
   1. API_URL: endpoint que guarda los votos. En Vercel es la función
      serverless api/votar.js, servida en /api/votar (no cambiar salvo
      que se aloje en otro dominio).
   2. MATCH_DATE: fecha y hora de inicio del partido (hora de Ecuador,
      UTC-5). La votación se cierra automáticamente en ese momento.
      Debe coincidir con DEFAULT_MATCH_DATE en api/votar.js.
------------------------------------------------------------------- */
const CONFIG = {
  API_URL: "/api/votar",
  MATCH_DATE: "2026-06-25T18:00:00-05:00",
};

const $ = (sel) => document.querySelector(sel);

/* ========================= Cuenta regresiva ========================= */
const countdownEl = $("#countdown");
const matchDate = new Date(CONFIG.MATCH_DATE);
let votingClosed = false;

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateCountdown() {
  const diff = matchDate - Date.now();

  if (diff <= 0) {
    votingClosed = true;
    countdownEl.classList.add("closed");
    countdownEl.querySelector(".countdown-title").textContent =
      "La votación ha cerrado. ¡Que gane el mejor!";
    disableForm();
    return;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000) % 24;
  const mins = Math.floor(diff / 60000) % 60;
  const secs = Math.floor(diff / 1000) % 60;

  $("#cd-days").textContent = pad(days);
  $("#cd-hours").textContent = pad(hours);
  $("#cd-mins").textContent = pad(mins);
  $("#cd-secs").textContent = pad(secs);
}

// Fecha legible en la tarjeta del partido
$("#match-date-label").textContent = matchDate.toLocaleDateString("es-EC", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

updateCountdown();
setInterval(updateCountdown, 1000);

/* ========================= Selección de equipo ========================= */
// Respaldo de la clase .selected para navegadores sin soporte de :has()
document.querySelectorAll(".team-option input").forEach((input) => {
  input.addEventListener("change", () => {
    document
      .querySelectorAll(".team-option")
      .forEach((opt) => opt.classList.remove("selected"));
    input.closest(".team-option").classList.add("selected");
    hideError("voto");
  });
});

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
  const voto = form.querySelector('input[name="voto"]:checked');
  const nombre = $("#nombre").value.trim();
  const apellido = $("#apellido").value.trim();
  const correo = $("#correo").value.trim();
  const acepta = $("#acepta").checked;

  if (!voto) { showError("voto"); ok = false; }
  if (nombre.length < 2) { showError("nombre"); ok = false; }
  if (apellido.length < 2) { showError("apellido"); ok = false; }
  if (!EMAIL_RE.test(correo)) { showError("correo"); ok = false; }
  if (!acepta) { showError("acepta"); ok = false; }

  return ok ? { voto: voto.value, nombre, apellido, correo } : null;
}

/* ========================= Estado del formulario ========================= */
function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.querySelector(".btn-label").textContent = loading
    ? "Enviando..."
    : "Enviar mi pronóstico";
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

function disableForm() {
  form.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
}

function showSuccess(team) {
  form.hidden = true;
  statusEl.hidden = true;
  $("#success-msg").innerHTML =
    `Tu voto por <strong>${team}</strong> quedó registrado. Si ${team} gana el partido, ` +
    `entrarás automáticamente en el sorteo de la Smart&nbsp;TV&nbsp;55&Prime;&nbsp;4K.`;
  const card = $("#success-card");
  card.hidden = false;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ========================= Participación previa ========================= */
const STORAGE_KEY = "iasa_sorteo_mundial_2026";

const previous = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
})();

if (previous && previous.voto) {
  showSuccess(previous.voto);
}

/* ========================= Envío ========================= */
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (votingClosed) {
    setStatus("La votación ya cerró: el partido está por comenzar.", "info");
    return;
  }

  const data = validate();
  if (!data) return;

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
    setStatus(
      "Error de conexión. Revisa tu internet e inténtalo nuevamente.",
      "error"
    );
  } finally {
    setLoading(false);
  }
});

/* ========================= Modal de bases ========================= */
const modal = $("#terms-modal");

document.querySelectorAll("[data-open-terms]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  });
});

document.querySelectorAll("[data-close-terms]").forEach((el) => {
  el.addEventListener("click", () => {
    modal.hidden = true;
    document.body.style.overflow = "";
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
});
