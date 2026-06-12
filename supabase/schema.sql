-- IASA · Pronostica y Gana — Esquema de la base de datos
-- Pega y ejecuta este archivo completo en Supabase: SQL Editor → New query → Run.

create table if not exists public.registros (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),
  nombre      text not null,
  apellido    text not null,
  correo      text not null unique,            -- un solo voto por correo
  voto        text not null check (voto in ('Ecuador', 'Alemania'))
);

-- Seguridad: con RLS activado y sin políticas, la tabla queda inaccesible
-- desde el navegador (clave anon). Solo la API de Vercel, que usa la clave
-- service_role, puede leer y escribir.
alter table public.registros enable row level security;

-- Índice para consultar resultados por equipo
create index if not exists registros_voto_idx on public.registros (voto);

-- Verificaciones pendientes: códigos enviados por correo que aún no se
-- confirman. Una fila por correo; se elimina al completar el registro.
create table if not exists public.verificaciones (
  correo       text primary key,
  codigo_hash  text not null,                  -- hash SHA-256 del código (nunca se guarda en claro)
  datos        jsonb not null,                 -- nombre, apellido y voto pendientes
  intentos     int not null default 0,         -- intentos fallidos de verificación
  expira_en    timestamptz not null,
  enviado_en   timestamptz not null default now()
);

alter table public.verificaciones enable row level security;
