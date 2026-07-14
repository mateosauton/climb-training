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

type AuthoredBlock = {
  id: string;
  exerciseId: string;
  dose: string;
  phase?: GuidedBlockPhase;
  title?: string;
  avoid?: string;
  media?: boolean;
};

type GuideBlueprint = { objective: string; blocks: AuthoredBlock[] };

const b = (id: string, exerciseId: string, dose: string, options: Omit<AuthoredBlock, "id" | "exerciseId" | "dose"> = {}): AuthoredBlock => ({ id, exerciseId, dose, ...options });

const guideBlueprints: Record<string, GuideBlueprint> = {
  w1d1: { objective: "Calibrar la intensidad en 45 grados y comenzar el bloque sin destruir los dedos.", blocks: [
    b("warmup", "mobilityPrep", "15 min: movilidad de hombro, muñeca, cadera y escalada fácil.", { phase: "prepare", title: "Calentamiento" }),
    b("limit-board", "limitBoard", "4 problemas límite, 3-4 intentos por problema, máximo 14-16 intentos duros."),
    b("active-feet", "activeFeet", "Pie activo y cadera cargada antes de cada mano."),
    b("weighted-pullup", "weightedPullup", "5x3 a RPE 8."),
    b("rings", "ringRow", "Remos 3x8 y push-ups 3x8-12.", { title: "Anillas: remos y push-ups" }),
    b("prehab", "externalRotation", "Rotación externa 2x20 y extensores de dedos 2x20.", { phase: "cooldown", title: "Bandas y extensores" })
  ] },
  w1d2: { objective: "Construir fuerza general y capacidad de hombro sin agregar carga dura de dedos.", blocks: [
    b("rdl", "rdl", "4x6 a RPE 7-8."), b("goblet-squat", "gobletSquat", "3x8."), b("kb-swing", "kbSwing", "4x12."),
    b("core", "hollowHold", "3 rondas: hollow hold, dead bug y side plank.", { title: "Circuito de core" }),
    b("ring-support", "ringSupport", "4x15-25 s."),
    b("prehab", "externalRotation", "15 min: rotadores, YTWs y extensores de dedos. Sin board duro.", { phase: "cooldown", title: "Prehab" })
  ] },
  w1d3: { objective: "Calibrar el bombeo manteniendo pies silenciosos, respiración y técnica limpia.", blocks: [
    b("warmup", "mobilityPrep", "20 min.", { phase: "prepare", title: "Calentamiento" }),
    b("four-by-four", "fourByFour", "3 rondas de 4x4 con 4 boulders al 60-75%. Descanso 30-60 s entre boulders y 5-6 min entre rondas. No fallar en la ronda 1."),
    b("cooldown", "fingerExtensors", "10 min de enfriamiento y extensores de dedos 2x25.", { phase: "cooldown", title: "Enfriamiento" })
  ] },
  w1d4: { objective: "Recuperar tejido conectivo con movilidad y prehab sin agarres duros.", blocks: [
    b("mobility", "mobilityPrep", "Caminata o movilidad 20-30 min.", { phase: "rest" }),
    b("bands", "externalRotation", "Rotación externa 2x20 y face pulls 2x20.", { phase: "cooldown", title: "Bandas" }),
    b("finger-extensors", "fingerExtensors", "2x25. Nada de agarres duros.", { phase: "cooldown" })
  ] },
  w1d5: { objective: "Practicar contacto explosivo y deadpoints compactos sin acumular bombeo.", blocks: [
    b("warmup", "mobilityPrep", "20 min.", { phase: "prepare", title: "Calentamiento" }),
    b("max-moves", "deadpoint", "8-10 movimientos máximos aislados o links de 2-3 movimientos. Descanso 3-5 min.", { title: "Movimientos máximos" }),
    b("submax", "deadpoint", "2 problemas submáximos rápidos al 70%.", { title: "Problemas submáximos", media: false }),
    b("accessory", "scapPullup", "Scap pull-ups 3x8 y lock-off corto en anillas 3x5 s por lado.", { title: "Scap pull-ups y lock-off" }),
    b("focus", "activeFeet", "Deadpoint compacto y estabilizar 2 s.", { title: "Foco técnico", media: false })
  ] },
  w1d6: { objective: "Crear continuidad aeróbica específica con respiración y movimiento fluido.", blocks: [
    b("aerobic", "aerobicIntervals", "6-8 x 90 s escalando / 90 s descanso a RPE 6-7. Alternativa: 3 x 8 min continuos en presas buenas."),
    b("focus", "activeFeet", "Pie-cadera-mano, cadera girada y respiración estable.", { title: "Foco técnico" }),
    b("prehab", "externalRotation", "20 min.", { phase: "cooldown", title: "Prehab" })
  ] },
  w1d7: { objective: "Descansar por completo y revisar dolor, sueño, energía y piel.", blocks: [b("rest", "recoveryCheck", "Descanso total. Revisar dolor, sueño, energía y piel.", { phase: "review", title: "Descanso y chequeo" })] },
  w2d1: { objective: "Aumentar la densidad de intentos límite conservando calidad y control.", blocks: [
    b("limit-board", "limitBoard", "5 problemas límite, 15-20 intentos duros totales."), b("active-feet", "activeFeet", "Cada intento empieza con pies definidos."),
    b("weighted-pullup", "weightedPullup", "6x3 a RPE 8-8.5."), b("rings", "ringRow", "Remos 3x8 y soporte 3x20 s.", { title: "Anillas" }),
    b("prehab", "fingerExtensors", "Bandas y extensores 10 min.", { phase: "cooldown", title: "Prehab" })
  ] },
  w2d2: { objective: "Sostener precisión y tensión corporal durante un bloque duro de power endurance.", blocks: [
    b("four-by-four", "fourByFour", "4 rondas de 4x4. Descanso 30-45 s entre boulders y 4-5 min entre rondas. RPE final 9/10."),
    b("focus", "activeFeet", "No colgarse de brazos largos; escápulas bajas y pies activos.", { title: "Foco técnico" })
  ] },
  w2d3: { objective: "Facilitar la recuperación entre sesiones intensas sin cargar los dedos.", blocks: [
    b("mobility", "mobilityPrep", "Movilidad 20-30 min.", { phase: "rest" }), b("prehab", "externalRotation", "Bandas suaves y extensores. Nada de agarres duros.", { phase: "cooldown", title: "Prehab" })
  ] },
  w2d4: { objective: "Mejorar contacto, velocidad de tracción y tensión en movimientos cortos.", blocks: [
    b("power", "deadpoint", "10-12 intentos de movimientos explosivos o links de 2-4 movimientos. Descanso 3-5 min.", { title: "Potencia y tensión" }),
    b("explosive-pullup", "explosivePullup", "6x2 con peso corporal."), b("ring-support", "ringSupport", "4x15-25 s."),
    b("prehab", "externalRotation", "Hombro y codo, 15 min.", { phase: "cooldown", title: "Prehab" })
  ] },
  w2d5: { objective: "Mantener fuerza general con una dosis moderada y sin board.", blocks: [
    b("rdl", "rdl", "3x5 a RPE 7."), b("split-squat", "splitSquat", "3x8 por pierna."), b("suitcase", "suitcaseCarry", "4x30-40 s por lado."),
    b("core", "hollowHold", "15 min. Sin board.", { title: "Core" })
  ] },
  w2d6: { objective: "Convertir fuerza de boulder en continuidad de vía y practicar reposos.", blocks: [
    b("route-circuits", "routeCircuit", "3-4 circuitos de 25-40 movimientos. Descanso 8-12 min. Caer o quedar al límite en el último 20-25%, no antes."),
    b("pacing", "breathingPacing", "Practicar respiración y sacudidas.", { title: "Ritmo y reposos" })
  ] },
  w2d7: { objective: "Descansar y decidir si la tendencia permite sostener la carga de la semana 3.", blocks: [b("rest", "recoveryCheck", "Descanso total. Si hubo dos sesiones malas seguidas, reducir el volumen de la semana 3.", { phase: "review", title: "Descanso y tendencia" })] },
  w3d1: { objective: "Producir intentos límite de máxima calidad con volumen bajo.", blocks: [
    b("limit-board", "limitBoard", "3-4 problemas muy duros, 12-15 intentos excelentes totales. Descanso 4-6 min.", { avoid: "Cortar si los dedos o codos se sienten raros; no sumar intentos lentos." }),
    b("weighted-pullup", "weightedPullup", "5-6x2 a RPE 8.5-9."),
    b("prehab", "ringRow", "Anillas suaves y prehab. Cortar si dedos o codos se sienten raros.", { phase: "cooldown", title: "Anillas y prehab" })
  ] },
  w3d2: { objective: "Recuperar hombros, codos y dedos antes del pico de resistencia.", blocks: [
    b("mobility", "mobilityPrep", "15-20 min.", { phase: "rest" }), b("prehab", "externalRotation", "Bandas y extensores. Nada de agarres duros.", { phase: "cooldown", title: "Prehab" })
  ] },
  w3d3: { objective: "Completar el pico de power endurance sin permitir que la técnica colapse.", blocks: [
    b("burns", "powerEnduranceBurns", "2 bloques de 3 burns. Cada burn: 2-3 min o 30-45 movimientos. Descanso 2-3 min entre burns y 10 min entre bloques. Alternativa: 4 rondas de 4x4 muy duras. Terminar si la técnica colapsa.", { avoid: "Terminar si la técnica colapsa; no buscar el fallo desde el primer burn." })
  ] },
  w3d4: { objective: "Recuperar y confirmar que el cuerpo está listo para potencia corta.", blocks: [b("recovery", "recoveryCheck", "Movilidad suave o caminata. Nada de board. Si hay dolor mayor a 2/10, convertir W3D5 en descanso.", { phase: "review", title: "Recuperación" })] },
  w3d5: { objective: "Mantener chispa y contacto con pocos intentos excelentes.", blocks: [b("short-power", "deadpoint", "45-60 min totales. 6-8 intentos de máxima calidad. 2 links cortos submáximos si hay frescura. Sin volumen extra ni fuerza pesada.", { title: "Potencia corta", avoid: "No agregar volumen ni fuerza pesada; terminar si baja la calidad." })] },
  w3d6: { objective: "Medir continuidad en el circuito objetivo con ritmo y beta repetibles.", blocks: [
    b("route-test", "routeCircuit", "2-3 intentos largos en el circuito objetivo. Descanso 15-20 min.", { title: "Test de resistencia" }),
    b("pacing", "breathingPacing", "Practicar ritmo, reposos, respiración y sacudidas."), b("video", "videoReview", "Grabar un video corto.", { phase: "review" })
  ] },
  w3d7: { objective: "Llegar fresco al taper sin sumar volumen innecesario.", blocks: [b("rest", "recoveryCheck", "Descanso total. Llegar fresco vale más que seguir sumando volumen.", { phase: "review", title: "Descanso total" })] },
  w4d1: { objective: "Mantener intensidad con bajo volumen y terminar con sensación de frescura.", blocks: [
    b("limit-board", "limitBoard", "8-10 intentos duros, sin fallo repetido. Terminar con sensación de frescura.", { avoid: "No repetir fallos ni convertir la sesión en volumen; salir fresco." }),
    b("weighted-pullup", "weightedPullup", "3x2 a RPE 7-8."), b("prehab", "fingerExtensors", "Bandas y extensores 10 min.", { phase: "cooldown", title: "Prehab" })
  ] },
  w4d2: { objective: "Recuperar y consolidar adaptaciones sin usar el board.", blocks: [
    b("mobility", "mobilityPrep", "20-30 min.", { phase: "rest" }), b("prehab", "externalRotation", "Bandas suaves y extensores. Sin board.", { phase: "cooldown", title: "Prehab" })
  ] },
  w4d3: { objective: "Recordar el ritmo de power endurance con la mitad del volumen del pico.", blocks: [
    b("reduced-pe", "fourByFour", "2 rondas de 4x4 o 4 x 2 min de circuito a RPE 7.5-8. Mitad del volumen de la semana 3.", { title: "Power endurance reducido" }),
    b("cooldown", "externalRotation", "Enfriamiento y prehab.", { phase: "cooldown" })
  ] },
  w4d4: { objective: "Descansar por completo y preparar mentalmente el proyecto objetivo.", blocks: [b("rest", "recoveryCheck", "Descanso total. Preparar el circuito o proyecto objetivo.", { phase: "review", title: "Descanso total" })] },
  w4d5: { objective: "Activar contacto y coordinación sin dejar fatiga residual.", blocks: [b("primer", "primerSession", "40-50 min totales. 4-6 movimientos duros con descanso largo. 2 links cortos del estilo objetivo. Terminar fresco.", { avoid: "No agregar volumen; terminar fresco y con ganas de más." })] },
  w4d6: { objective: "Realizar pegues serios al objetivo y medir el progreso del bloque.", blocks: [
    b("warmup", "mobilityPrep", "25-30 min.", { phase: "prepare", title: "Calentamiento largo" }),
    b("attempts", "routeCircuit", "En roca o gimnasio: 2-3 pegues serios al grado objetivo. En casa: circuito de 35-50 movimientos o problema duro más extensión. Descanso 15-25 min.", { title: "Pegues al objetivo" }),
    b("video", "videoReview", "Grabar video con pies y cadera visibles.", { phase: "review" }),
    b("success", "reviewMetrics", "Evaluar mejor link, cortes de pie, swing, intentos y recuperación entre pegues.", { phase: "review", title: "Criterios de éxito" })
  ] },
  w4d7: { objective: "Comparar el inicio y el cierre del ciclo para decidir el siguiente foco.", blocks: [b("review", "reviewMetrics", "Comparar W1 con W4: mejor link, intentos, movimientos antes de caer, RPE, bombeo y dolor. Decidir el siguiente bloque.", { phase: "review", title: "Revisión de métricas" })] }
};

function mediaFor(sessionId: string, blockId: string, exerciseId: string): GuidedMedia[] {
  const exercise = exerciseLibrary[exerciseId];
  return exercise.refs
    .filter(({ url }) => url.startsWith("https://") || url.startsWith("#"))
    .map((reference, index) => {
      const youtubeId = youtubeIds[reference.url];
      return {
        id: `${sessionId}-${blockId}-media-${index + 1}`,
        kind: reference.url.startsWith("#") ? "internal" : youtubeId ? "youtube" : "external",
        label: reference.label,
        url: reference.url,
        thumbnail: reference.image,
        ...(youtubeId ? { youtubeId } : {})
      };
    });
}

function blockFor(sessionId: string, authored: AuthoredBlock): GuidedBlock {
  const exercise = exerciseLibrary[authored.exerciseId];
  const phase = authored.phase ?? "work";
  return {
    id: authored.id,
    phase,
    title: authored.title ?? exercise.title,
    instruction: `Completa la prescripción específica de este día antes de avanzar: ${authored.dose}`,
    steps: exercise.cues.map((cue, index) => `${index + 1}. ${cue}`),
    dose: authored.dose,
    rationale: exercise.rationale,
    cues: exercise.cues,
    avoid: authored.avoid ?? exercise.avoid,
    equipment: equipmentByExercise[authored.exerciseId] ?? [],
    media: authored.media === false ? [] : mediaFor(sessionId, authored.id, authored.exerciseId),
    narrationText: `${authored.title ?? exercise.title}. ${authored.dose} ${exercise.cues.join(". ")}. Detente si aparece dolor.`
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
      blocks: blueprint.blocks.map((block) => blockFor(sessionId, block))
    }
  ])
);
