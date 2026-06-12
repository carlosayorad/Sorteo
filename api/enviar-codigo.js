/**
 * IASA · Pronostica y Gana — Envío del código de verificación
 *
 * Recibe los datos del formulario, guarda una verificación pendiente en
 * Supabase y envía un código de 6 dígitos al correo del participante
 * mediante Resend. El registro solo se completa cuando el código se
 * confirma en /api/verificar-codigo.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  → base de datos
 *   RESEND_API_KEY                           → envío de correos
 *   MAIL_FROM (opcional)  → remitente, p. ej. "IASA Sorteo <sorteo@iasa.com.ec>"
 *   MATCH_DATE (opcional) → inicio del partido, ISO 8601
 */

const crypto = require("crypto");
const { EQUIPOS, clean, isValidEmail, matchStarted, sha256, sb, hasSupabaseEnv } = require("./_util");

const RESEND_COOLDOWN_MS = 60 * 1000; // mínimo entre envíos al mismo correo
const CODE_TTL_MIN = 10;              // vigencia del código

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ status: "error", message: "Método no permitido" });
  }

  if (!hasSupabaseEnv() || !process.env.RESEND_API_KEY) {
    return res.status(500).json({
      status: "error",
      message: "Faltan variables de entorno (Supabase o Resend); ver README.",
    });
  }

  if (matchStarted()) {
    return res.status(200).json({ status: "closed" });
  }

  const body = req.body || {};
  const nombre = clean(body.nombre);
  const apellido = clean(body.apellido);
  const correo = clean(body.correo).toLowerCase();
  const voto = clean(body.voto);

  if (nombre.length < 2 || apellido.length < 2 || !isValidEmail(correo) || !EQUIPOS.includes(voto)) {
    return res.status(400).json({ status: "invalid" });
  }

  try {
    const enc = encodeURIComponent(correo);

    // ¿Ya está registrado en el sorteo?
    const regRes = await sb(`registros?correo=eq.${enc}&select=correo`);
    if (!regRes.ok) throw new Error(`registros ${regRes.status}`);
    if ((await regRes.json()).length > 0) {
      return res.status(200).json({ status: "duplicate" });
    }

    // Antirráfaga: no reenviar si el último código tiene menos de 1 minuto
    const verRes = await sb(`verificaciones?correo=eq.${enc}&select=enviado_en`);
    if (!verRes.ok) throw new Error(`verificaciones ${verRes.status}`);
    const previas = await verRes.json();
    if (
      previas.length > 0 &&
      Date.now() - new Date(previas[0].enviado_en).getTime() < RESEND_COOLDOWN_MS
    ) {
      return res.status(200).json({ status: "wait" });
    }

    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

    const upsert = await sb("verificaciones", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        correo,
        codigo_hash: sha256(correo + codigo),
        datos: { nombre, apellido, voto },
        intentos: 0,
        expira_en: new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString(),
        enviado_en: new Date().toISOString(),
      },
    });
    if (!upsert.ok) throw new Error(`upsert verificaciones ${upsert.status}`);

    const mail = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "IASA Sorteo <onboarding@resend.dev>",
        to: [correo],
        subject: `${codigo} es tu código para el sorteo de IASA`,
        html: buildEmail(codigo, nombre),
      }),
    });

    if (!mail.ok) {
      console.error("Resend respondió", mail.status, await mail.text());
      return res.status(200).json({ status: "mail_error" });
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Error en enviar-codigo:", err);
    return res.status(502).json({ status: "error" });
  }
};

function buildEmail(codigo, nombre) {
  return `
  <div style="background:#111111;padding:36px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#1c1c1c;border-radius:14px;border-top:4px solid #FFCD11;padding:30px 26px;text-align:center;">
      <p style="color:#ffffff;font-size:26px;font-weight:900;font-style:italic;margin:0;">IASA</p>
      <p style="color:#c9c9c9;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:4px 0 22px;">El equipo del progreso</p>
      <p style="color:#ffffff;font-size:16px;margin:0 0 8px;">¡Hola, ${escapeHtml(nombre)}!</p>
      <p style="color:#c9c9c9;font-size:14px;line-height:1.5;margin:0 0 22px;">
        Usa este código para confirmar tu participación en el sorteo de la
        <strong style="color:#FFCD11;">Smart TV 55&Prime; 4K</strong> por el Ecuador vs. Alemania del Mundial 2026:
      </p>
      <p style="background:#111111;border:1px solid #3d3d3d;border-radius:10px;color:#FFCD11;font-size:34px;font-weight:800;letter-spacing:10px;padding:16px 0;margin:0 0 22px;">${codigo}</p>
      <p style="color:#6f6f6f;font-size:12px;line-height:1.5;margin:0;">
        El código vence en ${CODE_TTL_MIN} minutos.<br />
        Si no solicitaste este correo, puedes ignorarlo.
      </p>
    </div>
    <p style="text-align:center;color:#6f6f6f;font-size:11px;margin:18px 0 0;">© 2026 IASA · Promoción válida en Ecuador</p>
  </div>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
