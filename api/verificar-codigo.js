/**
 * IASA · Pronostica y Gana — Verificación del código y registro final
 *
 * Comprueba el código de 6 dígitos enviado al correo. Si es correcto,
 * inserta el registro definitivo en la tabla `registros` con los datos
 * guardados al enviar el código.
 *
 * Protecciones: expiración de 10 minutos, máximo 5 intentos por código
 * y unicidad de correo garantizada por la base de datos.
 */

const { clean, matchStarted, sha256, sb, hasSupabaseEnv } = require("./_util");

const MAX_ATTEMPTS = 5;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ status: "error", message: "Método no permitido" });
  }

  if (!hasSupabaseEnv()) {
    return res.status(500).json({
      status: "error",
      message: "Faltan las variables de entorno de Supabase; ver README.",
    });
  }

  if (matchStarted()) {
    return res.status(200).json({ status: "closed" });
  }

  const body = req.body || {};
  const correo = clean(body.correo).toLowerCase();
  const codigo = clean(body.codigo).replace(/\D/g, "");

  if (!correo || !/^\d{6}$/.test(codigo)) {
    return res.status(400).json({ status: "invalid_code" });
  }

  try {
    const enc = encodeURIComponent(correo);

    const verRes = await sb(`verificaciones?correo=eq.${enc}`);
    if (!verRes.ok) throw new Error(`verificaciones ${verRes.status}`);
    const rows = await verRes.json();

    if (rows.length === 0) {
      return res.status(200).json({ status: "not_found" });
    }

    const ver = rows[0];

    if (new Date(ver.expira_en).getTime() < Date.now()) {
      return res.status(200).json({ status: "expired" });
    }

    if (ver.intentos >= MAX_ATTEMPTS) {
      return res.status(200).json({ status: "too_many" });
    }

    if (sha256(correo + codigo) !== ver.codigo_hash) {
      await sb(`verificaciones?correo=eq.${enc}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: { intentos: ver.intentos + 1 },
      });
      return res.status(200).json({
        status: "invalid_code",
        remaining: MAX_ATTEMPTS - ver.intentos - 1,
      });
    }

    // Código correcto: registro definitivo
    const insert = await sb("registros", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        nombre: ver.datos.nombre,
        apellido: ver.datos.apellido,
        correo,
        voto: ver.datos.voto,
      },
    });

    if (insert.status === 409) {
      await sb(`verificaciones?correo=eq.${enc}`, { method: "DELETE", prefer: "return=minimal" });
      return res.status(200).json({ status: "duplicate" });
    }

    if (insert.status !== 201) {
      console.error("Insert registros respondió", insert.status, await insert.text());
      return res.status(502).json({ status: "error" });
    }

    await sb(`verificaciones?correo=eq.${enc}`, { method: "DELETE", prefer: "return=minimal" });

    return res.status(200).json({ status: "ok", voto: ver.datos.voto });
  } catch (err) {
    console.error("Error en verificar-codigo:", err);
    return res.status(502).json({ status: "error" });
  }
};
