/**
 * IASA · Pronostica y Gana — API de registro de votos (Vercel Serverless)
 *
 * Recibe el pronóstico del formulario y lo guarda en Supabase.
 * Las credenciales viven en variables de entorno de Vercel y nunca
 * llegan al navegador (ver README.md, sección "Configurar Vercel").
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL               → URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY  → clave service_role (secreta)
 *   MATCH_DATE (opcional)      → inicio del partido, ISO 8601; anula el valor por defecto
 */

// Fecha y hora de inicio del partido (hora de Ecuador, UTC-5).
// Debe coincidir con MATCH_DATE en js/main.js. Los votos posteriores se rechazan.
const DEFAULT_MATCH_DATE = "2026-06-25T18:00:00-05:00";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EQUIPOS = ["Ecuador", "Alemania"];

function clean(value) {
  return String(value || "").trim().slice(0, 120);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ status: "error", message: "Método no permitido" });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      status: "error",
      message: "Faltan las variables de entorno de Supabase (ver README).",
    });
  }

  const matchDate = new Date(process.env.MATCH_DATE || DEFAULT_MATCH_DATE);
  if (Date.now() >= matchDate.getTime()) {
    return res.status(200).json({ status: "closed" });
  }

  const body = req.body || {};
  const nombre = clean(body.nombre);
  const apellido = clean(body.apellido);
  const correo = clean(body.correo).toLowerCase();
  const voto = clean(body.voto);

  // Validación en el servidor (no confiar solo en el navegador)
  if (nombre.length < 2 || apellido.length < 2 || !EMAIL_RE.test(correo) || !EQUIPOS.includes(voto)) {
    return res.status(400).json({ status: "invalid" });
  }

  try {
    const insert = await fetch(`${SUPABASE_URL}/rest/v1/registros`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ nombre, apellido, correo, voto }),
    });

    if (insert.status === 201) {
      return res.status(200).json({ status: "ok" });
    }

    // 409 = violación de la restricción UNIQUE sobre el correo
    if (insert.status === 409) {
      return res.status(200).json({ status: "duplicate" });
    }

    const detail = await insert.text();
    console.error("Supabase respondió", insert.status, detail);
    return res.status(502).json({ status: "error" });
  } catch (err) {
    console.error("Error al conectar con Supabase:", err);
    return res.status(502).json({ status: "error" });
  }
};
