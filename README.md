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

- Perfil, objetivos, logs y auditorias se guardan en `localStorage`.
- Los videos subidos se guardan en IndexedDB del navegador.
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
