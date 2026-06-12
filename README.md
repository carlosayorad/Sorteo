# Pronostica y Gana · IASA — Mundial 2026

Sitio web del sorteo de IASA por el partido **Ecuador vs. Alemania** del Mundial 2026.
Los visitantes votan por el equipo que creen que ganará; quienes acierten participan
en el sorteo de una **Smart TV 55″ 4K**.

**Stack:** frontend estático (HTML/CSS/JS puros) + función serverless en **Vercel** +
base de datos PostgreSQL en **Supabase**. Las credenciales nunca se exponen en el
navegador y los correos duplicados los rechaza la propia base de datos
(restricción `UNIQUE`).

## Estructura

```
├── index.html            # Página principal
├── css/styles.css        # Estilos (identidad IASA: negro + amarillo)
├── js/main.js            # Lógica: votación, validación, envío, cuenta regresiva
├── api/votar.js          # Función serverless (Vercel) que guarda los votos en Supabase
└── supabase/schema.sql   # Esquema de la tabla de registros
```

## Puesta en marcha

### 1. Crear la base de datos en Supabase (~5 min)

1. Entra a [supabase.com](https://supabase.com) con la cuenta de la empresa y crea un
   proyecto nuevo (por ejemplo **"sorteo-mundial-iasa"**, región `South America (São Paulo)`).
2. En el menú lateral: **SQL Editor → New query**, pega el contenido completo de
   [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea la tabla
   `registros` con la restricción de un voto por correo.
3. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **service_role key** (en "Project API keys" — es secreta, no la compartas ni la
     pongas en el código)

### 2. Publicar en Vercel (~5 min)

1. Entra a [vercel.com](https://vercel.com), **Add New → Project** e importa este
   repositorio de GitHub. No hace falta configurar build (es un sitio estático;
   Vercel detecta la carpeta `api/` automáticamente).
2. Antes de desplegar, en **Environment Variables** agrega:

   | Nombre | Valor |
   |---|---|
   | `SUPABASE_URL` | la Project URL del paso 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | la service_role key del paso 1 |

3. Pulsa **Deploy**. En un minuto el sitio queda en línea en `https://<proyecto>.vercel.app`.
4. *(Opcional, recomendado)* En **Settings → Domains** conecta el dominio corporativo,
   por ejemplo `sorteo.iasa.com.ec`. Vercel emite el certificado SSL automáticamente.

### 3. Fecha del partido ⚠️

La fecha está como marcador en **dos lugares** y debe actualizarse con la fecha y hora
oficiales del partido (de ella dependen la cuenta regresiva y el cierre automático de
la votación):

- `js/main.js` → `CONFIG.MATCH_DATE` (controla la cuenta regresiva en pantalla)
- `api/votar.js` → `DEFAULT_MATCH_DATE` (rechaza votos tardíos en el servidor; también
  puede fijarse con la variable de entorno `MATCH_DATE` en Vercel, sin tocar código)

Formato: `2026-06-25T18:00:00-05:00` (hora de Ecuador).

## Después del partido: sortear el ganador

En Supabase, abre **SQL Editor** y ejecuta (cambiando `'Ecuador'` por el equipo que
haya ganado oficialmente):

```sql
-- Cuántos acertaron
select count(*) from registros where voto = 'Ecuador';

-- Elegir UN ganador al azar entre los acertantes
select nombre, apellido, correo
from registros
where voto = 'Ecuador'
order by random()
limit 1;
```

Para entregar la base completa a marketing: **Table Editor → registros → Export → CSV**
(se abre directo en Excel).

## Probar en local (opcional)

Con [la CLI de Vercel](https://vercel.com/docs/cli) instalada (`npm i -g vercel`):

```bash
vercel env pull   # descarga las variables de entorno del proyecto
vercel dev        # sirve el sitio + la API en http://localhost:3000
```

> Abrir `index.html` directamente como archivo muestra el diseño, pero el envío del
> formulario necesita la API, así que para probar el flujo completo usa `vercel dev`
> o el sitio ya desplegado.

## Características

- ✅ Pantalla única de votación: escudos interactivos de Ecuador y Alemania (toca y elige).
- ✅ Popup de registro automático a los 3 segundos de entrar a la página, con el
  pronóstico sincronizado con el escudo elegido.
- ✅ Diseño profesional responsive (móvil, tablet y escritorio) con la identidad de IASA.
- ✅ Cuenta regresiva con cierre automático de la votación al inicio del partido
  (verificado también en el servidor).
- ✅ Validación de datos en el navegador **y** en el servidor.
- ✅ Un solo voto por correo, garantizado por la base de datos (`UNIQUE`), y bloqueo de
  re-voto en el mismo navegador.
- ✅ Credenciales solo en variables de entorno del servidor; la tabla tiene RLS activado,
  de modo que es inaccesible desde el navegador.
- ✅ Bases del sorteo incluidas (modal), con casilla de aceptación obligatoria.
- ✅ Consulta lista para sortear al ganador al azar entre los acertantes.
- ✅ Sin frameworks ni dependencias: HTML, CSS y JavaScript puros.
