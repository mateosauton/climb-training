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

## Sign in with Apple

La app usa Supabase Auth para validar Apple OAuth. Los datos de entrenamiento siguen siendo locales y se vinculan al usuario autenticado en este navegador.

1. Crea o elige un proyecto en [Supabase](https://supabase.com/dashboard).
2. Copia **Project URL** y la clave **Publishable** desde **Project Settings → API Keys**. Crea `.env.local` a partir de `.env.example`:

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

3. En una membresia paga de [Apple Developer](https://developer.apple.com/account/resources/identifiers/list), habilita **Sign in with Apple** en un App ID primario existente.
4. En **Certificates, Identifiers & Profiles → Identifiers**, crea un **Services ID**, habilita Sign in with Apple y asocialo al App ID primario.
5. En el Services ID registra el dominio de produccion y este return URL exacto:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

6. En **Certificates, Identifiers & Profiles → Keys**, crea una key con Sign in with Apple. Guarda el `.p8` fuera del repositorio; Apple permite descargarlo una sola vez. Anota tambien el Key ID y el Team ID.
7. En **Supabase → Authentication → Providers → Apple**, carga el Services ID, Team ID, Key ID y el secreto generado con la key `.p8`. Nunca uses la clave `service_role` en esta app.
8. En **Supabase → Authentication → URL Configuration**, agrega las URLs permitidas, incluyendo `http://127.0.0.1:8765/escalada/` y `https://<dominio-produccion>/escalada/`.
9. Configura las dos variables `VITE_` como variables de produccion/preview en Vercel y vuelve a desplegar.

Apple exige rotar el client secret OAuth al menos cada seis meses. Conserva el `.p8` en un gestor de secretos y programa un recordatorio; si se pierde o expone, revoca la key en Apple Developer y crea otra.

La verificacion final del proveedor requiere iniciar sesion con una cuenta Apple en el despliegue configurado, cerrar sesion y volver a entrar. CI usa un adaptador determinista y nunca necesita credenciales reales.

## Perfil y datos

- El JSON canonico por usuario se guarda en `climb4w.users.v2` dentro de `localStorage`.
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
