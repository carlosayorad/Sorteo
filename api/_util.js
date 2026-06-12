/**
 * Utilidades compartidas por las funciones de la API.
 * (Los archivos que empiezan con "_" no se exponen como rutas en Vercel.)
 */

const crypto = require("crypto");

// Fecha y hora de inicio del partido (hora de Ecuador, UTC-5).
// Debe coincidir con MATCH_DATE en js/main.js. Puede anularse con la
// variable de entorno MATCH_DATE en Vercel.
const DEFAULT_MATCH_DATE = "2026-06-25T18:00:00-05:00";

const EQUIPOS = ["Ecuador", "Alemania"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (value) => String(value || "").trim().slice(0, 120);

const isValidEmail = (email) => EMAIL_RE.test(email);

const matchStarted = () =>
  Date.now() >= new Date(process.env.MATCH_DATE || DEFAULT_MATCH_DATE).getTime();

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

/** Llamada a la API REST de Supabase con la clave service_role. */
function sb(path, { method = "GET", body, prefer } = {}) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const hasSupabaseEnv = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = {
  EQUIPOS,
  clean,
  isValidEmail,
  matchStarted,
  sha256,
  sb,
  hasSupabaseEnv,
};
