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
