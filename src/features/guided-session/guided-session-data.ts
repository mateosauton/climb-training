import { exerciseLibrary } from "@/lib/training";
import type { GuidedBlock, GuidedBlockPhase, GuidedMedia, GuidedSessionDefinition } from "./guided-session-types";

const SAFETY_NOTE = "Detene los agarres duros ante dolor punzante o dolor mayor a 2/10. Si aparece dolor de dedos, codo u hombro, prioriza recuperacion.";

const youtubeIds: Record<string, string> = {
  "https://www.youtube.com/watch?v=0eW8av1WC4g": "0eW8av1WC4g",
  "https://www.youtube.com/watch?v=5bQmbYjA_40": "5bQmbYjA_40",
  "https://www.youtube.com/watch?v=6P9r0UAdwXM": "6P9r0UAdwXM",
  "https://www.youtube.com/watch?v=7FRwuB1_l7U": "7FRwuB1_l7U",
  "https://www.youtube.com/watch?v=7TLG1mHQHgw": "7TLG1mHQHgw",
  "https://www.youtube.com/watch?v=8ZAdKNgdYm8": "8ZAdKNgdYm8",
  "https://www.youtube.com/watch?v=HJc8Rh7ou6E": "HJc8Rh7ou6E",
  "https://www.youtube.com/watch?v=KyvLK70-U-0": "KyvLK70-U-0",
  "https://www.youtube.com/watch?v=YLLqzHnhBNQ": "YLLqzHnhBNQ",
  "https://www.youtube.com/watch?v=beC-XvBpImY": "beC-XvBpImY",
  "https://www.youtube.com/watch?v=eIq5CB9JfKE": "eIq5CB9JfKE",
  "https://www.youtube.com/watch?v=i0PhgeIEiaA": "i0PhgeIEiaA",
  "https://www.youtube.com/watch?v=xhlReCpAE9k": "xhlReCpAE9k",
  "https://www.youtube.com/watch?v=yHxcTn1UeAc": "yHxcTn1UeAc"
};

const equipmentByExercise: Record<string, string[]> = {
  limitBoard: ["Palestra a 45°", "Pies de gato"],
  weightedPullup: ["Barra", "Discos"],
  ringRow: ["Anillas"],
  ringPushup: ["Anillas"],
  externalRotation: ["Banda elastica"],
  fingerExtensors: ["Banda para dedos"],
  activeFeet: ["Palestra a 45°", "Pies de gato"],
  rdl: ["Barra", "Discos"],
  gobletSquat: ["Kettlebell"],
  kbSwing: ["Kettlebell"],
  hollowHold: ["Colchoneta"],
  deadBug: ["Colchoneta"],
  sidePlank: ["Colchoneta"],
  fourByFour: ["Cuatro boulders", "Pies de gato"],
  breathingPacing: ["Palestra", "Pies de gato"],
  mobilityPrep: ["Colchoneta"],
  facePull: ["Banda elastica"],
  deadpoint: ["Palestra a 45°", "Pies de gato"],
  scapPullup: ["Barra o anillas"],
  lockoff: ["Anillas"],
  aerobicIntervals: ["Palestra", "Cronometro"],
  routeCircuit: ["Circuito marcado", "Cronometro"],
  explosivePullup: ["Barra"],
  ringSupport: ["Anillas"],
  splitSquat: ["Kettlebell"],
  suitcaseCarry: ["Kettlebell"],
  powerEnduranceBurns: ["Circuito marcado", "Cronometro"],
  videoReview: ["Telefono o camara"],
  primerSession: ["Palestra", "Pies de gato"],
  recoveryCheck: [],
  reviewMetrics: ["Registros del tracker"]
};

const phaseByExercise: Partial<Record<string, GuidedBlockPhase>> = {
  mobilityPrep: "prepare",
  externalRotation: "cooldown",
  facePull: "cooldown",
  fingerExtensors: "cooldown",
  recoveryCheck: "review",
  reviewMetrics: "review",
  videoReview: "review"
};

type GuideBlueprint = { objective: string; exerciseIds: string[] };

const guideBlueprints: Record<string, GuideBlueprint> = {
  w1d1: { objective: "Calibrar la intensidad en 45 grados y comenzar el bloque sin destruir los dedos.", exerciseIds: ["mobilityPrep", "limitBoard", "activeFeet", "weightedPullup", "ringRow", "ringPushup", "externalRotation", "fingerExtensors"] },
  w1d2: { objective: "Construir fuerza general y capacidad de hombro sin agregar carga dura de dedos.", exerciseIds: ["rdl", "gobletSquat", "kbSwing", "hollowHold", "deadBug", "sidePlank", "ringSupport", "externalRotation", "fingerExtensors"] },
  w1d3: { objective: "Calibrar el bombeo manteniendo pies silenciosos, respiracion y tecnica limpia.", exerciseIds: ["mobilityPrep", "fourByFour", "activeFeet", "breathingPacing", "fingerExtensors"] },
  w1d4: { objective: "Recuperar tejido conectivo con movilidad y prehab sin agarres duros.", exerciseIds: ["mobilityPrep", "externalRotation", "facePull", "fingerExtensors"] },
  w1d5: { objective: "Practicar contacto explosivo y deadpoints compactos sin acumular bombeo.", exerciseIds: ["mobilityPrep", "deadpoint", "activeFeet", "scapPullup", "lockoff"] },
  w1d6: { objective: "Crear continuidad aerobica especifica con respiracion y movimiento fluido.", exerciseIds: ["aerobicIntervals", "activeFeet", "breathingPacing", "externalRotation"] },
  w1d7: { objective: "Descansar por completo y revisar dolor, sueño, energia y piel.", exerciseIds: ["recoveryCheck"] },
  w2d1: { objective: "Aumentar la densidad de intentos limite conservando calidad y control.", exerciseIds: ["mobilityPrep", "limitBoard", "weightedPullup", "ringRow", "ringSupport", "fingerExtensors"] },
  w2d2: { objective: "Sostener precision y tension corporal durante un bloque duro de power endurance.", exerciseIds: ["mobilityPrep", "fourByFour", "activeFeet", "breathingPacing", "scapPullup"] },
  w2d3: { objective: "Facilitar la recuperacion entre sesiones intensas sin cargar los dedos.", exerciseIds: ["mobilityPrep", "externalRotation", "fingerExtensors"] },
  w2d4: { objective: "Mejorar contacto, velocidad de traccion y tension en movimientos cortos.", exerciseIds: ["mobilityPrep", "deadpoint", "explosivePullup", "ringSupport", "externalRotation"] },
  w2d5: { objective: "Mantener fuerza general con una dosis moderada y sin board.", exerciseIds: ["rdl", "splitSquat", "suitcaseCarry", "hollowHold", "sidePlank"] },
  w2d6: { objective: "Convertir fuerza de boulder en continuidad de via y practicar reposos.", exerciseIds: ["mobilityPrep", "routeCircuit", "breathingPacing", "activeFeet", "videoReview"] },
  w2d7: { objective: "Descansar y decidir si la tendencia permite sostener la carga de la semana 3.", exerciseIds: ["recoveryCheck"] },
  w3d1: { objective: "Producir intentos limite de maxima calidad con volumen bajo.", exerciseIds: ["mobilityPrep", "limitBoard", "weightedPullup", "ringRow", "fingerExtensors"] },
  w3d2: { objective: "Recuperar hombros, codos y dedos antes del pico de resistencia.", exerciseIds: ["mobilityPrep", "externalRotation", "fingerExtensors"] },
  w3d3: { objective: "Completar el pico de power endurance sin permitir que la tecnica colapse.", exerciseIds: ["mobilityPrep", "powerEnduranceBurns", "breathingPacing", "routeCircuit"] },
  w3d4: { objective: "Recuperar y confirmar que el cuerpo esta listo para potencia corta.", exerciseIds: ["recoveryCheck", "mobilityPrep"] },
  w3d5: { objective: "Mantener chispa y contacto con pocos intentos excelentes.", exerciseIds: ["mobilityPrep", "deadpoint", "limitBoard", "scapPullup"] },
  w3d6: { objective: "Medir continuidad en el circuito objetivo con ritmo y beta repetibles.", exerciseIds: ["mobilityPrep", "routeCircuit", "breathingPacing", "videoReview"] },
  w3d7: { objective: "Llegar fresco al taper sin sumar volumen innecesario.", exerciseIds: ["recoveryCheck"] },
  w4d1: { objective: "Mantener intensidad con bajo volumen y terminar con sensacion de frescura.", exerciseIds: ["mobilityPrep", "limitBoard", "activeFeet", "weightedPullup", "fingerExtensors"] },
  w4d2: { objective: "Recuperar y consolidar adaptaciones sin usar el board.", exerciseIds: ["mobilityPrep", "externalRotation", "fingerExtensors"] },
  w4d3: { objective: "Recordar el ritmo de power endurance con la mitad del volumen del pico.", exerciseIds: ["mobilityPrep", "fourByFour", "aerobicIntervals", "breathingPacing", "externalRotation"] },
  w4d4: { objective: "Descansar por completo y preparar mentalmente el proyecto objetivo.", exerciseIds: ["recoveryCheck"] },
  w4d5: { objective: "Activar contacto y coordinacion sin dejar fatiga residual.", exerciseIds: ["mobilityPrep", "primerSession", "deadpoint", "routeCircuit"] },
  w4d6: { objective: "Realizar pegues serios al objetivo y medir el progreso del bloque.", exerciseIds: ["mobilityPrep", "routeCircuit", "breathingPacing", "activeFeet", "videoReview"] },
  w4d7: { objective: "Comparar el inicio y el cierre del ciclo para decidir el siguiente foco.", exerciseIds: ["reviewMetrics", "videoReview", "recoveryCheck"] }
};

function mediaFor(sessionId: string, blockId: string): GuidedMedia[] {
  const exercise = exerciseLibrary[blockId];
  return exercise.refs
    .filter(({ url }) => url.startsWith("https://"))
    .map((reference, index) => {
      const youtubeId = youtubeIds[reference.url];
      return {
        id: `${sessionId}-${blockId}-media-${index + 1}`,
        kind: youtubeId ? "youtube" : "external",
        label: reference.label,
        url: reference.url,
        thumbnail: reference.image,
        ...(youtubeId ? { youtubeId } : {})
      };
    });
}

function blockFor(sessionId: string, exerciseId: string): GuidedBlock {
  const exercise = exerciseLibrary[exerciseId];
  const phase = phaseByExercise[exerciseId] ?? "work";
  return {
    id: exerciseId,
    phase,
    title: exercise.title,
    instruction: `Realiza ${exercise.title.toLocaleLowerCase("es")} con control y completa la dosis indicada antes de avanzar.`,
    steps: exercise.cues.map((cue, index) => `${index + 1}. ${cue}`),
    dose: exercise.dose,
    rationale: exercise.rationale,
    cues: exercise.cues,
    avoid: exercise.avoid,
    equipment: equipmentByExercise[exerciseId] ?? [],
    media: mediaFor(sessionId, exerciseId),
    narrationText: `${exercise.title}. ${exercise.dose} ${exercise.cues.join(". ")}. Detente si aparece dolor.`
  };
}

export const guidedSessionDefinitions: Record<string, GuidedSessionDefinition> = Object.fromEntries(
  Object.entries(guideBlueprints).map(([sessionId, blueprint]) => [
    sessionId,
    {
      sessionId,
      version: 1,
      objective: blueprint.objective,
      safetyNote: SAFETY_NOTE,
      blocks: blueprint.exerciseIds.map((exerciseId) => blockFor(sessionId, exerciseId))
    }
  ])
);
