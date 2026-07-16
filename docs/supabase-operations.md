# Operación de Supabase

Esta guía usa marcadores; nunca guardes claves, contraseñas, tokens, URLs de
proyectos ni respuestas que los contengan en el repositorio.

## Configuración de Auth y correo

- En **Authentication → URL Configuration**, configura la URL canónica de la
  aplicación como `Site URL` y agrega, de forma exacta, cada URL local, preview
  y producción que pueda recibir confirmación o recuperación de contraseña.
  Mantén la ruta base `/escalada/` si el despliegue la usa.
- En **Authentication → Sign In / Providers**, habilita Email y decide si se
  exige confirmación de correo. Prueba alta, confirmación y recuperación con
  una cuenta no productiva después de cualquier cambio de URL.
- Antes de producción, configura SMTP propio en **Project Settings →
  Authentication → SMTP Settings**. El proveedor de prueba no es un servicio
  de entrega de producción y está limitado. Guarda host, usuario y contraseña
  únicamente en la configuración protegida del proveedor.
- El cliente sólo recibe `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_PUBLISHABLE_KEY`. No expongas una clave `service_role`, una
  contraseña de base de datos ni una clave de proveedor mediante `VITE_`.

## Desarrollo, migraciones y comprobación

Requiere Docker Desktop en ejecución para los comandos locales. Desde la raíz:

```bash
npx supabase@latest start
npx supabase@latest db reset --local
npx supabase@latest test db
npm test -- --run
npm run typecheck
npm run build
npm run test:e2e
```

Revisa primero la ayuda de la versión instalada:

```bash
npx supabase@latest link --help
npx supabase@latest db push --help
npx supabase@latest migration list --help
npx supabase@latest db advisors --help
```

Sólo después de que la validación local pase, confirma el project ref con el
operador responsable y enlázalo explícitamente. Comprueba el destino antes de
una mutación y usa una vista previa:

```bash
npx supabase@latest projects list
npx supabase@latest link --project-ref <confirmed-project-ref>
npx supabase@latest migration list --linked
npx supabase@latest db push --linked --dry-run
npx supabase@latest db push --linked
npx supabase@latest migration list --linked
```

Conserva en el registro de despliegue sólo los nombres/IDs de migración y el
resultado, no cadenas de conexión ni salidas con secretos. No uses
`--include-all` salvo una reconciliación explícita y revisada de historial.

## Edge Functions y proveedor

Despliega `generate-plan` e `import-local-data` después de las migraciones. Las
dos funciones requieren los secretos administrados por Supabase
`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`; no se
definen en `.env.local` ni se entregan al navegador.

`generate-plan` además requiere `PLAN_GENERATOR_PROVIDER`,
`PLAN_GENERATOR_ENDPOINT` y `PLAN_GENERATOR_API_KEY`. Si falta alguno, la
función deja el trabajo en `provider_not_configured`, en lugar de intentar un
proveedor por defecto. Configura el endpoint y la clave sólo en secretos de la
función, rota la clave mediante el proveedor y vuelve a probar con datos no
productivos.

## Vídeos privados e importación

El bucket `climbing-videos` es privado. Los objetos deben usar la ruta
`<auth.uid>/<video-id>/original.<mp4|mov|webm>`. Las políticas de
`storage.objects` permiten leer, crear, actualizar y borrar únicamente el
prefijo del usuario autenticado. No vuelvas público el bucket para resolver
problemas de reproducción; entrega objetos mediante una sesión autorizada o
una URL firmada de duración limitada si se añade ese flujo.

La importación local es en dos fases: `import-local-data` guarda primero los
metadatos y devuelve los IDs de vídeo pendientes; tras subir y verificar cada
objeto, se reintenta con `completedVideoIds`. El recibo de importación hace que
reintentar el mismo hash sea seguro. Si se interrumpe, conserva el respaldo
local, reanuda con el mismo usuario y hash, y no crees manualmente filas de
vídeo ni modifiques recibos desde el cliente.

## Revisión remota y smoke test

Tras enlazar el proyecto confirmado y aplicar migraciones, ejecuta:

```bash
npx supabase@latest db advisors --linked --type all --level info
```

Revisa y corrige antes de aprobar cualquier aviso relevante de seguridad o
rendimiento. En el panel o SQL Editor, confirma también: RLS y grants de las
tablas `public`; que los objetos/vistas expuestos no revelen datos de otro
atleta; funciones públicas con privilegios y `search_path` revisados; y las
cuatro políticas de propiedad de `storage.objects` del bucket.

Con dos cuentas de prueba no productivas, verifica aislamiento de perfil,
planes y vídeos; rechazo de creación directa de planes; reintento idempotente
de importación; inmutabilidad de planes publicados; y persistencia de
actividad. Registra sólo el resultado de cada caso y elimina las cuentas/datos
de prueba al terminar.
