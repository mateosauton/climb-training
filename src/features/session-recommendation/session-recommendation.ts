import type { SessionLog, TrainingSession } from "../../lib/training";

export type SessionRecommendation = {
  score: number;
  summary: string;
  recommendations: string[];
};

const targetRpe = (intensity: string) => {
  if (intensity === "alta") return 8.5;
  if (intensity === "media") return 7;
  return 5.5;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function buildSessionRecommendation(log: SessionLog, session: TrainingSession): SessionRecommendation {
  const effortFit = Math.max(0, 1.5 - Math.abs(log.rpe - targetRpe(session.intensity)) * 0.5);
  const output = log.moves > 0 ? clamp(log.bestLink / log.moves, 0, 1) * 2 : log.attempts > 0 ? 0.75 : 0;
  const recovery = ((log.sleep + log.energy) / 20) * 1.5;
  const technique = log.moves > 0 ? (1 - clamp(log.footCuts / Math.max(log.moves, 1), 0, 1)) * 0.75 : 0.35;
  const painAdjustment = log.pain <= 1 ? 0.75 : -Math.min(4.5, (log.pain - 1) * 1.15);
  const score = clamp(Math.round(3 + effortFit + output + recovery + technique + painAdjustment), 1, 10);

  const recommendations: string[] = [];
  if (log.pain >= 3) {
    recommendations.push("Prioriza el dolor: baja la carga y evita movimientos que lo reproduzcan antes de la próxima sesión intensa.");
  }
  if (log.sleep < 6 || log.energy < 6) {
    recommendations.push("Mejora la recuperación: sueño, comida y una sesión liviana deben preceder al próximo estímulo duro.");
  }
  if (log.footCuts > Math.max(2, log.moves * 0.1)) {
    recommendations.push("Trabaja pies activos y tensión de cadera; repite enlaces fáciles sin cortes antes de subir la dificultad.");
  }
  if (log.moves > 0 && log.bestLink / log.moves < 0.6) {
    recommendations.push("Divide el objetivo en enlaces y fija la beta del crux para aumentar el mejor tramo antes de sumar intentos.");
  }
  if (Math.abs(log.rpe - targetRpe(session.intensity)) > 1.5) {
    recommendations.push(log.rpe > targetRpe(session.intensity)
      ? "Recorta volumen para mantener la intensidad planificada sin convertir cada sesión en un esfuerzo máximo."
      : "Sube gradualmente la dificultad o la intención para acercarte al estímulo previsto en esta sesión.");
  }
  if (!recommendations.length) {
    recommendations.push("Mantén esta combinación de carga, recuperación y ejecución; busca progresar con un poco más de enlace y la misma calidad técnica.");
  }

  const summary = score >= 8
    ? "La sesión cumplió muy bien el objetivo esperado con buena relación entre carga, resultado y recuperación."
    : score >= 6
      ? "La sesión cumplió parcialmente el objetivo; hay una palanca clara para mejorar el próximo resultado."
      : "La sesión quedó por debajo del objetivo esperado; conviene ajustar carga, recuperación o ejecución antes de progresar."

  return { score, summary, recommendations: recommendations.slice(0, 3) };
}
