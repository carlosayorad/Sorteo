/**
 * IASA · Pronostica y Gana — Receptor de registros (Google Apps Script)
 *
 * Este script recibe los pronósticos del sitio web y los guarda en la
 * hoja de cálculo de Google Sheets a la que está vinculado.
 *
 * Instrucciones completas de instalación en el README.md del proyecto.
 */

// Fecha y hora de inicio del partido (hora de Ecuador, UTC-5).
// Debe coincidir con MATCH_DATE en js/main.js. Los votos posteriores se rechazan.
var MATCH_DATE = new Date("2026-06-25T18:00:00-05:00");

var SHEET_NAME = "Registros";
var HEADERS = ["Fecha de registro", "Nombre", "Apellido", "Correo", "Voto"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // evita registros duplicados por envíos simultáneos

  try {
    if (new Date() >= MATCH_DATE) {
      return respond({ status: "closed" });
    }

    var data = JSON.parse(e.postData.contents);

    var nombre = clean(data.nombre);
    var apellido = clean(data.apellido);
    var correo = clean(data.correo).toLowerCase();
    var voto = clean(data.voto);

    // Validación en el servidor (no confiar solo en el navegador)
    if (!nombre || !apellido || !isValidEmail(correo)) {
      return respond({ status: "invalid" });
    }
    if (voto !== "Ecuador" && voto !== "Alemania") {
      return respond({ status: "invalid" });
    }

    var sheet = getSheet();

    // Un solo voto por correo electrónico
    if (emailExists(sheet, correo)) {
      return respond({ status: "duplicate" });
    }

    sheet.appendRow([new Date(), nombre, apellido, correo, voto]);
    return respond({ status: "ok" });
  } catch (err) {
    return respond({ status: "error", message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Obtiene (o crea) la hoja "Registros" con sus encabezados. */
function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#FFCD11");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function emailExists(sheet, correo) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var emails = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if (String(emails[i][0]).toLowerCase().trim() === correo) {
      return true;
    }
  }
  return false;
}

function clean(value) {
  return String(value || "").trim().substring(0, 120);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * BONUS — Sorteo del ganador.
 *
 * Después del partido, ejecuta esta función desde el editor de Apps Script:
 *   1. Cambia EQUIPO_GANADOR por "Ecuador" o "Alemania" según el resultado.
 *   2. Selecciona "sortearGanador" en el menú de funciones y pulsa Ejecutar.
 * El ganador (elegido al azar entre los acertantes) se escribe en una
 * hoja nueva llamada "Ganador".
 */
function sortearGanador() {
  var EQUIPO_GANADOR = "Ecuador"; // <-- cambiar según el resultado oficial

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  var rows = sheet.getDataRange().getValues().slice(1);

  var acertantes = rows.filter(function (row) {
    return row[4] === EQUIPO_GANADOR;
  });

  if (acertantes.length === 0) {
    throw new Error("No hay participantes que hayan votado por " + EQUIPO_GANADOR);
  }

  var ganador = acertantes[Math.floor(Math.random() * acertantes.length)];

  var resultSheet = ss.getSheetByName("Ganador") || ss.insertSheet("Ganador");
  resultSheet.clear();
  resultSheet.appendRow(["Sorteado el", "Nombre", "Apellido", "Correo", "Votó por", "Total acertantes"]);
  resultSheet.appendRow([new Date(), ganador[1], ganador[2], ganador[3], ganador[4], acertantes.length]);
  resultSheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#FFCD11");
}
