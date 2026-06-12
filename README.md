# Pronostica y Gana · IASA — Mundial 2026

Sitio web del sorteo de IASA por el partido **Ecuador vs. Alemania** del Mundial 2026.
Los visitantes votan por el equipo que creen que ganará; quienes acierten participan
en el sorteo de una **Smart TV 55″ 4K**. Los registros (nombre, apellido, correo y voto)
se guardan en una hoja de **Google Sheets**.

## Estructura

```
├── index.html                  # Página principal
├── css/styles.css              # Estilos (identidad IASA: negro + amarillo)
├── js/main.js                  # Lógica: votación, validación, envío, cuenta regresiva
└── google-apps-script/Code.gs  # Script que recibe los registros en Google Sheets
```

## Puesta en marcha (3 pasos)

### 1. Conectar Google Sheets

1. Entra a [sheets.new](https://sheets.new) con la cuenta de Google de la empresa y crea
   una hoja de cálculo nueva (por ejemplo, llamada **"Sorteo Mundial IASA"**).
2. En el menú: **Extensiones → Apps Script**.
3. Borra el contenido del editor y pega todo el contenido de
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Guarda (icono de disquete).
4. Pulsa **Implementar → Nueva implementación**:
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario** ← importante
5. Autoriza los permisos cuando lo pida y **copia la URL** que termina en `/exec`.

### 2. Configurar el sitio

Abre `js/main.js` y edita el bloque `CONFIG` al inicio del archivo:

```js
const CONFIG = {
  SHEETS_URL: "https://script.google.com/macros/s/XXXX/exec", // la URL del paso 1
  MATCH_DATE: "2026-06-25T18:00:00-05:00", // fecha y hora real del partido (hora Ecuador)
};
```

> ⚠️ **MATCH_DATE**: ajusta la fecha y hora reales del partido. La cuenta regresiva y el
> cierre automático de la votación dependen de este valor. Actualiza también la variable
> `MATCH_DATE` al inicio de `Code.gs` para que el servidor rechace votos tardíos.

### 3. Publicar

Es un sitio 100 % estático: funciona en cualquier hosting.

- **GitHub Pages**: Settings → Pages → desplegar desde la rama principal.
- **Netlify / Vercel**: arrastra la carpeta del proyecto o conecta el repositorio.

## Después del partido: sortear el ganador

En el editor de Apps Script, abre la función `sortearGanador`, cambia la variable
`EQUIPO_GANADOR` por `"Ecuador"` o `"Alemania"` según el resultado oficial, y ejecútala.
El ganador (elegido al azar entre los acertantes) aparecerá en una hoja nueva llamada
**"Ganador"**, junto con el total de acertantes.

## Características

- ✅ Diseño profesional responsive (móvil, tablet y escritorio) con la identidad de IASA.
- ✅ Cuenta regresiva con cierre automático de la votación al inicio del partido.
- ✅ Validación de datos en el navegador **y** en el servidor.
- ✅ Un solo voto por correo electrónico (verificado en el servidor) y bloqueo de re-voto
  en el mismo navegador.
- ✅ Bases del sorteo incluidas (modal), con casilla de aceptación obligatoria.
- ✅ Función de sorteo aleatorio entre los acertantes, lista para ejecutar.
- ✅ Sin dependencias ni frameworks: HTML, CSS y JavaScript puros.
