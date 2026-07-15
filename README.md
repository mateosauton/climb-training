# Escalada 4W Tracker

App React/Vite con shadcn/ui para seguir el bloque de escalada del 9 de julio al 5 de agosto de 2026.

## Desarrollo

Instalar dependencias:

```bash
npm install
```

Levantar servidor local:

```bash
npm run dev -- --port 8765
```

## Acceso con correo y contraseña

La app usa Supabase Auth para registrar usuarios, confirmar su correo, iniciar sesión y recuperar contraseñas. Los datos de entrenamiento siguen siendo locales y se vinculan al ID estable del usuario autenticado en este navegador.

1. Crea o elige un proyecto en [Supabase](https://supabase.com/dashboard).
2. Copia **Project URL** desde **Project Settings → Data API** y la clave **Publishable** desde **Project Settings → API Keys**. Crea `.env.local` a partir de `.env.example`:

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. En **Supabase → Authentication → Sign In / Providers → Email**, deja habilitado Email y decide si el proyecto exige confirmación de correo. Los proyectos alojados la exigen por defecto.
4. En **Supabase → Authentication → URL Configuration**, configura `https://climb-training-lilac.vercel.app/escalada/` como **Site URL** y agrega estas URLs de retorno permitidas:

   ```text
   http://127.0.0.1:8765/escalada/
   https://climb-training-lilac.vercel.app/escalada/
   ```

5. Configura las dos variables `VITE_` en el entorno de producción/preview y vuelve a desplegar. Nunca uses una clave `service_role` o secreta en esta app cliente.
6. Antes de producción, configura un SMTP propio en **Supabase → Project Settings → Authentication → SMTP Settings**. El servicio de prueba incluido es best-effort y limita el envío a dos correos por hora.

### Prueba manual

1. Registra un correo nuevo y abre el enlace de confirmación.
2. Inicia y cierra sesión con la contraseña creada.
3. Usa **Olvidé mi contraseña**, abre el enlace y guarda una contraseña nueva.
4. Confirma que los registros locales reaparecen para el mismo usuario y permanecen aislados al cambiar de cuenta.

CI usa un adaptador determinista y nunca necesita credenciales reales ni enviar correos.

## Perfil y datos

- El JSON canonico por usuario se guarda en `climb4w.users.v3` dentro de `localStorage`; `climb4w.users.v2` se conserva como fuente de recuperacion tras migrar.
- Los cambios de perfil se anexan como hechos inmutables con origen e historial de reemplazo; logs, analisis y sesiones guiadas quedan separados por usuario.
- Los videos subidos se guardan en IndexedDB y no se incrustan en la exportacion JSON.
- Las claves antiguas `climb4w.state.v1` y de sesiones guiadas se conservan como copia de recuperacion luego de migrar.
- El respaldo JSON contiene datos sensibles de perfil y entrenamiento; guardalo y compartilo con cuidado.
- La vista `Plan` permite tocar cada sesion para priorizarla y ver detalle, racional y referencias de cada ejercicio.
- La vista `Perfil` centraliza objetivos, contexto del escalador, equipamiento y respaldo JSON.

## Archivos

- `src/App.tsx`: app principal, tracking, video, recomendaciones y persistencia local.
- `src/lib/training.ts`: plan, ejercicios, racionales y referencias.
- `src/components/ui`: componentes shadcn/ui copiados al proyecto.
- `public/data/training-plan.md`: plan completo en Markdown.
- `public/assets`: favicon e imagen de referencia.

## Build

```bash
npm run build
```
