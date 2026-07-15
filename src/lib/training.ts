export type TrainingSession = {
  id: string;
  week: number;
  day: number;
  date: string;
  start: string;
  end: string;
  phase: string;
  type: string;
  title: string;
  intensity: string;
  summary: string;
  drills: string[];
};

export type ExerciseReference = {
  label: string;
  source: string;
  url: string;
  image: string;
};

export type Exercise = {
  title: string;
  dose: string;
  rationale: string;
  cues: string[];
  avoid: string;
  refs: ExerciseReference[];
};

export type TrackerState = {
  goals: {
    currentGrade: string;
    targetGrade: string;
    project: string;
    focus: string;
  };
  profile: {
    name: string;
    location: string;
    age: string;
    sex: string;
    height: string;
    weight: string;
    wingspan: string;
    apeIndex: string;
    dominantHand: string;
    handSize: string;
    climbingExperience: string;
    maxBoulder: string;
    maxSport: string;
    styleStrengths: string;
    styleWeaknesses: string;
    fingerStrength: string;
    fingerEndurance: string;
    pullStrength: string;
    shoulderCapacity: string;
    coreTension: string;
    hipAnkleMobility: string;
    weeklyAvailability: string;
    trainingLoad: string;
    sleepBaseline: string;
    stressBaseline: string;
    boardSetup: string;
    equipment: string;
    strengths: string;
    limiters: string;
    injuryHistory: string;
    currentPain: string;
    skinTolerance: string;
    nutritionRisk: string;
    recoveryNotes: string;
    coachNotes: string;
    questionnaireCompleted: boolean;
    questionnaireCompletedAt: string;
    questionnaireVersion: number;
  };
  logs: SessionLog[];
  videos: VideoAnalysis[];
};

export type SessionLog = {
  id: string;
  sessionId: string;
  createdAt: string;
  notes: string;
  rpe: number;
  pump: number;
  pain: number;
  attempts: number;
  moves: number;
  bestLink: number;
  footCuts: number;
  pullWeight: number;
  sleep: number;
  energy: number;
};

export type VideoAdvice = {
  title: string;
  body: string;
};

export type VideoAnalysis = {
  id: string;
  sessionId: string;
  createdAt: string;
  fileName: string;
  duration: number;
  size: number;
  notes: string;
  footCuts: number;
  swing: number;
  hips: number;
  shoulder: number;
  breath: number;
  reading: number;
  advice: VideoAdvice[];
  cloud?: {
    id: string;
    path: string;
    uploadStatus: "pending" | "uploaded" | "analysis_pending";
  };
};

export type LogNumberKey = keyof typeof logNumberLimits;

const youtubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const boardReferenceImage = `${import.meta.env.BASE_URL}assets/board-frame.png`;

const reference = (label: string, source: string, url: string, image = boardReferenceImage): ExerciseReference => ({ label, source, url, image });

export const plan: TrainingSession[] = [
  {
    id: "w1d1",
    week: 1,
    day: 1,
    date: "2026-07-09",
    start: "18:30",
    end: "20:00",
    phase: "Calibracion",
    type: "Limit + fuerza",
    title: "Escalada W1D1 - Limit + fuerza",
    intensity: "alta",
    summary: "Calibrar intensidad en 45 grados y empezar sin destruir dedos.",
    drills: [
      "Board 45: 4 problemas limite, 3-4 intentos por problema.",
      "Dominadas lastradas: 5x3 a RPE 8.",
      "Anillas: remos 3x8 y push-ups 3x8-12.",
      "Regla tecnica: pie activo + cadera cargada antes de cada mano."
    ]
  },
  {
    id: "w1d2",
    week: 1,
    day: 2,
    date: "2026-07-10",
    start: "18:30",
    end: "19:45",
    phase: "Calibracion",
    type: "Fuerza general",
    title: "Escalada W1D2 - Fuerza general + prehab",
    intensity: "media",
    summary: "Soporte sin cargar dedos.",
    drills: [
      "Peso muerto rumano: 4x6 a RPE 7-8.",
      "Goblet squat 3x8 y KB swings 4x12.",
      "Core 3 rondas: hollow, dead bug, side plank.",
      "Bandas, YTWs y extensores de dedos."
    ]
  },
  {
    id: "w1d3",
    week: 1,
    day: 3,
    date: "2026-07-11",
    start: "10:00",
    end: "11:30",
    phase: "Calibracion",
    type: "Power endurance",
    title: "Escalada W1D3 - Power endurance base",
    intensity: "alta",
    summary: "Tolerancia al bombeo con tecnica limpia.",
    drills: [
      "3 rondas de 4x4 al 60-75%.",
      "30-60 s entre boulders, 5-6 min entre rondas.",
      "No fallar en ronda 1.",
      "Pies silenciosos, no cortar pies, exhalar antes de mover."
    ]
  },
  {
    id: "w1d4",
    week: 1,
    day: 4,
    date: "2026-07-12",
    start: "10:00",
    end: "10:30",
    phase: "Calibracion",
    type: "Descanso",
    title: "Escalada W1D4 - Descanso + movilidad",
    intensity: "baja",
    summary: "Recuperar tejido conectivo.",
    drills: [
      "Movilidad 20-30 min.",
      "Rotacion externa 2x20 y face pulls 2x20.",
      "Extensores dedos 2x25.",
      "Nada de agarres duros."
    ]
  },
  {
    id: "w1d5",
    week: 1,
    day: 5,
    date: "2026-07-13",
    start: "18:30",
    end: "19:45",
    phase: "Calibracion",
    type: "Potencia",
    title: "Escalada W1D5 - Potencia + contacto",
    intensity: "alta",
    summary: "Movimientos explosivos limpios sin bombeo acumulado.",
    drills: [
      "8-10 movimientos maximos o links de 2-3 movimientos.",
      "Descanso completo 3-5 min.",
      "Scap pull-ups 3x8 y lock-off corto 3x5 s por lado.",
      "Generar desde pies/cadera y estabilizar 2 s."
    ]
  },
  {
    id: "w1d6",
    week: 1,
    day: 6,
    date: "2026-07-14",
    start: "18:30",
    end: "19:45",
    phase: "Calibracion",
    type: "Aerobica especifica",
    title: "Escalada W1D6 - Capacidad aerobica especifica",
    intensity: "media",
    summary: "Base de continuidad sin fatigar al maximo.",
    drills: [
      "6-8 x 90 s escalando / 90 s descanso a RPE 6-7.",
      "Alternativa: 3 x 8 min continuos.",
      "Pie-cadera-mano, cadera girada, respiracion estable.",
      "Prehab 20 min."
    ]
  },
  {
    id: "w1d7",
    week: 1,
    day: 7,
    date: "2026-07-15",
    start: "18:30",
    end: "19:00",
    phase: "Calibracion",
    type: "Descanso",
    title: "Escalada W1D7 - Descanso total",
    intensity: "baja",
    summary: "Revisar dolor, sueno, energia y piel.",
    drills: ["Descanso total.", "Si hay dolor mayor a 2/10, bajar volumen."]
  },
  {
    id: "w2d1",
    week: 2,
    day: 1,
    date: "2026-07-16",
    start: "18:30",
    end: "20:00",
    phase: "Densidad",
    type: "Limit + fuerza pesada",
    title: "Escalada W2D1 - Limit + fuerza pesada",
    intensity: "alta",
    summary: "Subir densidad de intentos duros sin perder calidad.",
    drills: [
      "5 problemas limite, 15-20 intentos duros total.",
      "Dominadas lastradas: 6x3 a RPE 8-8.5.",
      "Cada intento empieza con pies definidos.",
      "Cortar con dedos/codos raros."
    ]
  },
  {
    id: "w2d2",
    week: 2,
    day: 2,
    date: "2026-07-17",
    start: "18:30",
    end: "20:00",
    phase: "Densidad",
    type: "Power endurance",
    title: "Escalada W2D2 - Power endurance duro",
    intensity: "alta",
    summary: "Bombeo alto manteniendo precision.",
    drills: [
      "4 rondas de 4x4.",
      "30-45 s entre boulders, 4-5 min entre rondas.",
      "RPE final 9/10.",
      "Escapulas bajas, pies activos y cadera girada."
    ]
  },
  {
    id: "w2d3",
    week: 2,
    day: 3,
    date: "2026-07-18",
    start: "10:00",
    end: "10:30",
    phase: "Densidad",
    type: "Descanso",
    title: "Escalada W2D3 - Descanso + movilidad",
    intensity: "baja",
    summary: "Movilidad y recuperacion.",
    drills: ["Bandas suaves.", "Extensores dedos.", "Nada de agarres duros."]
  },
  {
    id: "w2d4",
    week: 2,
    day: 4,
    date: "2026-07-19",
    start: "10:00",
    end: "11:15",
    phase: "Densidad",
    type: "Potencia + tension",
    title: "Escalada W2D4 - Potencia + tension",
    intensity: "alta",
    summary: "Contacto, tension y deadpoints compactos.",
    drills: [
      "10-12 intentos explosivos o links de 2-4 movimientos.",
      "Dominadas explosivas: 6x2.",
      "Ring support hold: 4x15-25 s.",
      "Terminar cuando baja la velocidad."
    ]
  },
  {
    id: "w2d5",
    week: 2,
    day: 5,
    date: "2026-07-20",
    start: "18:30",
    end: "19:30",
    phase: "Densidad",
    type: "Fuerza ligera",
    title: "Escalada W2D5 - Fuerza general ligera",
    intensity: "media",
    summary: "Mantener fuerza sin fatigar dedos.",
    drills: [
      "RDL barra: 3x5 a RPE 7.",
      "Split squat KB: 3x8 por pierna.",
      "Suitcase hold: 4x30-40 s por lado.",
      "Sin board."
    ]
  },
  {
    id: "w2d6",
    week: 2,
    day: 6,
    date: "2026-07-21",
    start: "18:30",
    end: "20:00",
    phase: "Densidad",
    type: "Simulacion de via",
    title: "Escalada W2D6 - Simulacion de via",
    intensity: "alta",
    summary: "Convertir fuerza de boulder en continuidad.",
    drills: [
      "3-4 circuitos de 25-40 movimientos.",
      "Descanso 8-12 min.",
      "Caer o estar al limite en el ultimo 20-25%.",
      "Practicar respiracion y sacudidas."
    ]
  },
  {
    id: "w2d7",
    week: 2,
    day: 7,
    date: "2026-07-22",
    start: "18:30",
    end: "19:00",
    phase: "Densidad",
    type: "Descanso",
    title: "Escalada W2D7 - Descanso total",
    intensity: "baja",
    summary: "Descanso total y control de tendencia.",
    drills: ["Si el rendimiento bajo dos sesiones seguidas, reducir semana 3."]
  },
  {
    id: "w3d1",
    week: 3,
    day: 1,
    date: "2026-07-23",
    start: "18:30",
    end: "20:00",
    phase: "Pico",
    type: "Limit pico",
    title: "Escalada W3D1 - Limit pico",
    intensity: "alta",
    summary: "Maxima calidad con volumen bajo.",
    drills: [
      "3-4 problemas muy duros, 12-15 intentos excelentes.",
      "Descanso 4-6 min.",
      "Dominadas lastradas: 5-6x2 a RPE 8.5-9.",
      "Cortar si dedos/codos se sienten vidriosos."
    ]
  },
  {
    id: "w3d2",
    week: 3,
    day: 2,
    date: "2026-07-24",
    start: "18:30",
    end: "19:00",
    phase: "Pico",
    type: "Descanso + prehab",
    title: "Escalada W3D2 - Descanso + prehab",
    intensity: "baja",
    summary: "Recuperacion activa.",
    drills: ["Movilidad.", "Bandas.", "Extensores.", "Nada de agarres duros."]
  },
  {
    id: "w3d3",
    week: 3,
    day: 3,
    date: "2026-07-25",
    start: "10:00",
    end: "11:45",
    phase: "Pico",
    type: "Power endurance pico",
    title: "Escalada W3D3 - Power endurance pico",
    intensity: "alta",
    summary: "Sesion mas dura de resistencia de potencia.",
    drills: [
      "2 bloques de 3 burns.",
      "Cada burn: 2-3 min o 30-45 movimientos.",
      "2-3 min entre burns, 10 min entre bloques.",
      "Terminar si la tecnica colapsa."
    ]
  },
  {
    id: "w3d4",
    week: 3,
    day: 4,
    date: "2026-07-26",
    start: "10:00",
    end: "10:30",
    phase: "Pico",
    type: "Recuperacion",
    title: "Escalada W3D4 - Recuperacion",
    intensity: "baja",
    summary: "Recuperar antes de la potencia corta.",
    drills: ["Movilidad suave o caminata.", "Nada de board."]
  },
  {
    id: "w3d5",
    week: 3,
    day: 5,
    date: "2026-07-27",
    start: "18:30",
    end: "19:30",
    phase: "Pico",
    type: "Potencia corta",
    title: "Escalada W3D5 - Potencia corta",
    intensity: "media",
    summary: "Mantener chispa sin sumar fatiga.",
    drills: [
      "45-60 min total.",
      "6-8 intentos de maxima calidad.",
      "2 links cortos submaximos si hay frescura.",
      "Sin fuerza pesada."
    ]
  },
  {
    id: "w3d6",
    week: 3,
    day: 6,
    date: "2026-07-28",
    start: "18:30",
    end: "20:00",
    phase: "Pico",
    type: "Test de resistencia",
    title: "Escalada W3D6 - Test de resistencia",
    intensity: "alta",
    summary: "Medir continuidad antes del taper.",
    drills: [
      "2-3 intentos largos en circuito objetivo.",
      "Descanso 15-20 min.",
      "Practicar ritmo, reposos y respiracion.",
      "Grabar video corto."
    ]
  },
  {
    id: "w3d7",
    week: 3,
    day: 7,
    date: "2026-07-29",
    start: "18:30",
    end: "19:00",
    phase: "Pico",
    type: "Descanso",
    title: "Escalada W3D7 - Descanso total",
    intensity: "baja",
    summary: "Llegar fresco al taper.",
    drills: ["Descanso total.", "No sumar volumen."]
  },
  {
    id: "w4d1",
    week: 4,
    day: 1,
    date: "2026-07-30",
    start: "18:30",
    end: "19:45",
    phase: "Taper",
    type: "Limit liviano",
    title: "Escalada W4D1 - Limit liviano",
    intensity: "media",
    summary: "Mantener intensidad y empezar taper.",
    drills: [
      "8-10 intentos duros, no al fallo repetido.",
      "Dominadas lastradas: 3x2 a RPE 7-8.",
      "Salir fresco.",
      "Pies activos y cadera cargada."
    ]
  },
  {
    id: "w4d2",
    week: 4,
    day: 2,
    date: "2026-07-31",
    start: "18:30",
    end: "19:00",
    phase: "Taper",
    type: "Movilidad",
    title: "Escalada W4D2 - Movilidad + descanso",
    intensity: "baja",
    summary: "Recuperar y consolidar.",
    drills: ["Movilidad.", "Bandas suaves.", "Sin board."]
  },
  {
    id: "w4d3",
    week: 4,
    day: 3,
    date: "2026-08-01",
    start: "10:00",
    end: "11:15",
    phase: "Taper",
    type: "Power endurance reducido",
    title: "Escalada W4D3 - Power endurance reducido",
    intensity: "media",
    summary: "Mantener adaptacion con mitad del volumen.",
    drills: [
      "2 rondas de 4x4 o 4 x 2 min de circuito.",
      "RPE 7.5-8.",
      "Eficiencia, ritmo, respiracion y sacudidas.",
      "Prehab 15 min."
    ]
  },
  {
    id: "w4d4",
    week: 4,
    day: 4,
    date: "2026-08-02",
    start: "10:00",
    end: "10:30",
    phase: "Taper",
    type: "Descanso",
    title: "Escalada W4D4 - Descanso total",
    intensity: "baja",
    summary: "Preparar circuito/proyecto objetivo.",
    drills: ["Descanso total.", "Nada de agarres duros."]
  },
  {
    id: "w4d5",
    week: 4,
    day: 5,
    date: "2026-08-03",
    start: "18:30",
    end: "19:20",
    phase: "Taper",
    type: "Primer",
    title: "Escalada W4D5 - Primer",
    intensity: "media",
    summary: "Activar sin fatigar.",
    drills: [
      "40-50 min total.",
      "4-6 movimientos duros con descanso largo.",
      "2 links cortos del estilo objetivo.",
      "Salir fresco."
    ]
  },
  {
    id: "w4d6",
    week: 4,
    day: 6,
    date: "2026-08-04",
    start: "18:30",
    end: "20:15",
    phase: "Taper",
    type: "Dia de prueba",
    title: "Escalada W4D6 - Dia de prueba / pegue fuerte",
    intensity: "alta",
    summary: "Medir salto de grado o equivalente.",
    drills: [
      "2-3 pegues serios al grado objetivo.",
      "En casa: circuito de 35-50 movimientos o problema duro + extension.",
      "Descansos largos 15-25 min.",
      "Grabar video con pies y cadera visibles."
    ]
  },
  {
    id: "w4d7",
    week: 4,
    day: 7,
    date: "2026-08-05",
    start: "18:30",
    end: "19:15",
    phase: "Taper",
    type: "Revision",
    title: "Escalada W4D7 - Descanso + revision de metricas",
    intensity: "baja",
    summary: "Cerrar bloque y decidir siguiente ciclo.",
    drills: [
      "Comparar W1 vs W4.",
      "Revisar mejor link, intentos, RPE, bombeo y dolor.",
      "Decidir siguiente bloque."
    ]
  }
];

export const exerciseLibrary: Record<string, Exercise> = {
  limitBoard: {
    title: "Board 45: problemas limite",
    dose: "3-5 problemas, 3-4 intentos de calidad por problema, 3-6 min de descanso.",
    rationale: "Es el estimulo principal para subir grado: contacto, tension corporal y decision en movimientos cerca del limite sin acumular bombeo inutil.",
    cues: ["Define pies antes de salir", "Descansa hasta recuperar velocidad", "Corta cuando el intento se vuelve lento o desordenado"],
    avoid: "No conviertas el limit en volumen. Si repites caidas por fatiga, termina el bloque.",
    refs: [
      reference("Tecnica de pies y precision en tabla", "Neil Gresham / YouTube", "https://www.youtube.com/watch?v=8ZAdKNgdYm8", youtubeThumb("8ZAdKNgdYm8")),
      reference("Drills simples para footwork", "Climbing.com", "https://www.climbing.com/skills/training-7-simple-drills-to-improve-footwork-and-technique/")
    ]
  },
  weightedPullup: {
    title: "Dominadas lastradas",
    dose: "3-6 series de 2-3 reps a RPE 7-9 segun semana.",
    rationale: "Suben fuerza de traccion util para bloque duro sin requerir mas tiempo en agarres pequenos.",
    cues: ["Escapulas deprimidas antes de tirar", "Barbilla arriba sin patear", "Baja controlado y deja 1-2 reps en reserva"],
    avoid: "Evita kipping, rango parcial y series al fallo.",
    refs: [reference("Pull-up para escaladores", "Lattice Training", "https://www.youtube.com/watch?v=7TLG1mHQHgw", youtubeThumb("7TLG1mHQHgw"))]
  },
  ringRow: {
    title: "Remos en anillas",
    dose: "3 series de 8-12 reps, pausa de 1 s con anillas al pecho.",
    rationale: "Compensa volumen de empuje/tiron, mejora control escapular y protege hombros para tabla desplomada.",
    cues: ["Cuerpo en bloque", "Codos cerca del torso", "Tira con escapulas antes de doblar codos"],
    avoid: "No colapses cadera ni lleves hombros a las orejas.",
    refs: [reference("Ring row tecnico", "CrossFit / YouTube", "https://www.youtube.com/watch?v=xhlReCpAE9k", youtubeThumb("xhlReCpAE9k"))]
  },
  ringPushup: {
    title: "Push-ups en anillas",
    dose: "3 series de 8-12 reps con anillas estables.",
    rationale: "Da fuerza antagonista y estabilidad anterior de hombro sin cargar dedos.",
    cues: ["Anillas cerca del cuerpo", "Costillas abajo", "Empuja el suelo y separa escapulas arriba"],
    avoid: "No dejes que las anillas se abran si pierdes control.",
    refs: [reference("Ring push-up", "Carl Paoli / YouTube", "https://www.youtube.com/watch?v=7FRwuB1_l7U", youtubeThumb("7FRwuB1_l7U"))]
  },
  externalRotation: {
    title: "Rotacion externa con banda",
    dose: "2-3 series de 15-25 reps por lado.",
    rationale: "Mantiene manguito rotador tolerante al volumen de traccion y posiciones comprimidas.",
    cues: ["Codo fijo al costado", "Movimiento lento", "Termina con hombro bajo"],
    avoid: "No compenses girando el torso.",
    refs: [
      reference("Rotator cuff para escaladores", "Training for Climbing", "https://trainingforclimbing.com/rotator-cuff-training-for-climbers/"),
      reference("Banded external rotation", "Hooper's Beta / YouTube", "https://www.youtube.com/watch?v=beC-XvBpImY", youtubeThumb("beC-XvBpImY"))
    ]
  },
  fingerExtensors: {
    title: "Extensores de dedos",
    dose: "2-3 series de 20-30 aperturas con banda/elastico.",
    rationale: "Equilibra la carga de flexores, mejora tolerancia de codo y ayuda a controlar molestias por agarres.",
    cues: ["Abre todos los dedos", "Mantiene muneca neutra", "Busca bombeo suave, no dolor"],
    avoid: "No lo hagas maximo; es tejido y control, no record.",
    refs: [
      reference("Finger extensors", "Hooper's Beta / YouTube", "https://www.youtube.com/watch?v=HJc8Rh7ou6E", youtubeThumb("HJc8Rh7ou6E")),
      reference("Por que entrenarlos", "Rock Rehab", "https://rockrehab.co/blog/how-to-build-grip-strength-and-stop-ignoring-your-finger-extensors")
    ]
  },
  activeFeet: {
    title: "Pies activos y cadera cargada",
    dose: "Aplicar en cada intento: pie definido, cadera entra, mano se mueve al final.",
    rationale: "En 45 grados, el salto de grado suele venir de tension y eficiencia, no de tirar mas fuerte.",
    cues: ["Pisa con intencion", "Congela 2 s tras capturar", "Exhala antes del movimiento duro"],
    avoid: "No tires con la mano antes de cargar el pie.",
    refs: [
      reference("Footwork para escalada", "Neil Gresham / YouTube", "https://www.youtube.com/watch?v=8ZAdKNgdYm8", youtubeThumb("8ZAdKNgdYm8")),
      reference("7 drills de tecnica", "Climbing.com", "https://www.climbing.com/skills/training-7-simple-drills-to-improve-footwork-and-technique/")
    ]
  },
  rdl: {
    title: "Peso muerto rumano con barra",
    dose: "3-4 series de 5-6 reps a RPE 7-8.",
    rationale: "Fortalece cadena posterior para tension corporal y taloneos sin gastar piel ni dedos.",
    cues: ["Bisagra de cadera", "Barra pegada al cuerpo", "Espalda larga y rodillas apenas flexionadas"],
    avoid: "No conviertas el movimiento en sentadilla ni redondees lumbar.",
    refs: [reference("Romanian deadlift", "NASM", "https://www.nasm.org/resource-center/exercise-library/romanian-deadlift-barbell")]
  },
  gobletSquat: {
    title: "Goblet squat con kettlebell",
    dose: "3 series de 8 reps, tempo controlado.",
    rationale: "Da fuerza de piernas y movilidad de cadera para entrar y sostener posiciones en desplome.",
    cues: ["Codos entre rodillas", "Torso firme", "Empuja el piso completo al subir"],
    avoid: "No pierdas arco del pie ni colapses rodillas hacia adentro.",
    refs: [reference("Kettlebell goblet squat", "StrongFirst / YouTube", "https://www.youtube.com/watch?v=0eW8av1WC4g", youtubeThumb("0eW8av1WC4g"))]
  },
  kbSwing: {
    title: "Kettlebell swing",
    dose: "4 series de 12 reps con 16 kg, descanso 60-90 s.",
    rationale: "Potencia bisagra, rigidez de tronco y capacidad de generar tension rapida desde cadera.",
    cues: ["Hinge, no squat", "Brazos como cables", "Termina alto y firme sin hiperextender"],
    avoid: "No levantes la pesa con hombros.",
    refs: [
      reference("Kettlebell swing", "StrongFirst / YouTube", "https://www.youtube.com/watch?v=yHxcTn1UeAc", youtubeThumb("yHxcTn1UeAc")),
      reference("La mecanica del swing", "StrongFirst", "https://www.strongfirst.com/is-there-a-perfect-swing-or-the-quest/")
    ]
  },
  hollowHold: {
    title: "Hollow hold",
    dose: "3 series de 20-40 s o acumulado de 90 s.",
    rationale: "Entrena posicion de cuerpo cerrado para mantener pies en tabla y evitar cortes.",
    cues: ["Zona lumbar pesada contra el piso", "Costillas abajo", "Escala palancas antes de perder forma"],
    avoid: "No arquees lumbar para sumar segundos.",
    refs: [reference("Hollow body hold", "Hinge Health", "https://www.hingehealth.com/resources/articles/hollow-body-hold/")]
  },
  deadBug: {
    title: "Dead bug",
    dose: "3 series de 8-10 reps por lado, lento.",
    rationale: "Control anti-extension transferible a movimientos donde un pie se suelta o cambia la tension.",
    cues: ["Exhala al extender", "Lumbar estable", "Mueve brazo y pierna sin perder caja toracica"],
    avoid: "No aceleres ni dejes que la espalda se levante.",
    refs: [reference("Dead bug", "Muscle & Strength", "https://www.muscleandstrength.com/exercises/dead-bug")]
  },
  sidePlank: {
    title: "Side plank",
    dose: "3 series de 25-45 s por lado.",
    rationale: "Mejora control lateral para drop knees, bicicletas y movimientos cruzados en desplome.",
    cues: ["Linea hombro-cadera-tobillo", "Empuja el piso con antebrazo", "Respira sin perder posicion"],
    avoid: "No dejes caer cadera ni rote el pecho al piso.",
    refs: [reference("Side plank", "Muscle & Strength", "https://www.muscleandstrength.com/exercises/side-hover.html")]
  },
  fourByFour: {
    title: "4x4 de boulder",
    dose: "2-4 rondas de 4 boulders, 30-60 s entre boulders, 4-6 min entre rondas.",
    rationale: "Convierte fuerza de boulder en resistencia de potencia, el cuello de botella para 6c/7a -> 7a+/7b.",
    cues: ["Elige boulders que no fallen en ronda 1", "Misma beta cada vuelta", "Registra bombeo y caidas tecnicas"],
    avoid: "No empieces demasiado duro; la calidad debe sobrevivir hasta la ultima ronda.",
    refs: [
      reference("4x4s para escaladores", "TrainingBeta", "https://www.trainingbeta.com/4x4s/"),
      reference("Protocolos de power endurance", "Training for Climbing", "https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/")
    ]
  },
  breathingPacing: {
    title: "Ritmo, respiracion y sacudidas",
    dose: "Practicar en cada circuito: exhala antes del crux, sacude en posiciones de menor tension.",
    rationale: "Reduce picos de bombeo y permite sostener decision tecnica en links largos.",
    cues: ["Marca reposos antes de salir", "Respira cada 2-3 movimientos", "Sacude una mano aunque sea 2 s"],
    avoid: "No escales todo el circuito al mismo ritmo.",
    refs: [reference("Power endurance y pacing", "Training for Climbing", "https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/")]
  },
  mobilityPrep: {
    title: "Movilidad y descarga",
    dose: "20-30 min: cadera, columna toracica, hombro, munecas y respiracion nasal.",
    rationale: "Acelera recuperacion del bloque intenso y preserva rango para posiciones de tabla.",
    cues: ["Dolor maximo 2/10", "Movimientos lentos", "Termina con sensacion de mas rango, no fatiga"],
    avoid: "No conviertas descanso en entrenamiento escondido.",
    refs: [reference("Mobility para escaladores", "Lattice Training / YouTube", "https://www.youtube.com/watch?v=YLLqzHnhBNQ", youtubeThumb("YLLqzHnhBNQ"))]
  },
  facePull: {
    title: "Face pulls con banda",
    dose: "2-3 series de 15-25 reps.",
    rationale: "Refuerza rotadores externos y retraccion escapular para compensar traccion de tabla.",
    cues: ["Tira hacia ojos", "Codos altos", "Pausa atras sin arquear espalda"],
    avoid: "No uses una banda tan dura que pierdas rango.",
    refs: [reference("Face pull con banda", "ATHLEAN-X / YouTube", "https://www.youtube.com/watch?v=eIq5CB9JfKE", youtubeThumb("eIq5CB9JfKE"))]
  },
  deadpoint: {
    title: "Deadpoints compactos",
    dose: "6-12 intentos explosivos o links de 2-4 movimientos, descanso completo.",
    rationale: "Entrena coordinacion de pies-cadera-mano para capturar presas sin cortar pies en 45 grados.",
    cues: ["Genera desde piernas", "Mira la presa hasta cerrar", "Congela 2 s despues de capturar"],
    avoid: "No repitas cuando pierdes velocidad o precision.",
    refs: [reference("Deadpoint tecnico", "Lattice Training / YouTube", "https://www.youtube.com/watch?v=5bQmbYjA_40", youtubeThumb("5bQmbYjA_40"))]
  },
  scapPullup: {
    title: "Scap pull-ups",
    dose: "3 series de 6-10 reps, pausa baja de 1 s.",
    rationale: "Mejora control de escapula para iniciar tracciones fuertes sin irritar hombros/codos.",
    cues: ["Codos estirados", "Baja hombros lejos de orejas", "Rango pequeno y limpio"],
    avoid: "No dobles codos para hacer trampa.",
    refs: [
      reference("Scapular pull-up", "Training for Climbing / YouTube", "https://www.youtube.com/watch?v=6P9r0UAdwXM", youtubeThumb("6P9r0UAdwXM")),
      reference("El ejercicio que falta", "Training for Climbing", "https://trainingforclimbing.com/video-the-best-climbing-exercise-youre-not-doing/")
    ]
  },
  lockoff: {
    title: "Lock-off corto",
    dose: "3 series de 5 s por lado en angulo tolerable.",
    rationale: "Sostiene posiciones de bloqueo para clips, reajustes y capturas controladas.",
    cues: ["Escapula activa", "No llegar al fallo", "Elige angulo fuerte y repetible"],
    avoid: "No bloquees con dolor de codo o hombro.",
    refs: [reference("Pull strength para escalada", "Lattice Training", "https://www.youtube.com/watch?v=7TLG1mHQHgw", youtubeThumb("7TLG1mHQHgw"))]
  },
  aerobicIntervals: {
    title: "Intervalos aerobicos especificos",
    dose: "6-8 x 90 s escalando / 90 s descanso o 3 x 8 min continuos.",
    rationale: "Construye recuperacion local y eficiencia para sostener circuitos sin depender solo de fuerza maxima.",
    cues: ["RPE 6-7", "Movimiento fluido", "Bombeo controlado, nunca colapso"],
    avoid: "No subas dificultad hasta fallar.",
    refs: [reference("Circuitos y continuidad", "TrainingBeta", "https://www.trainingbeta.com/circuits/")]
  },
  routeCircuit: {
    title: "Circuitos de 25-50 movimientos",
    dose: "2-4 circuitos, descanso 8-20 min segun objetivo.",
    rationale: "Simula vias/proyectos y mide si la fuerza de boulder se sostiene bajo fatiga real.",
    cues: ["Mapea reposos", "Cuenta movimientos utiles", "Graba pies y cadera en los pegues clave"],
    avoid: "No cambies beta cada intento si quieres medir progreso.",
    refs: [
      reference("Circuit training", "TrainingBeta", "https://www.trainingbeta.com/circuits/"),
      reference("Power endurance protocols", "Training for Climbing", "https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/")
    ]
  },
  explosivePullup: {
    title: "Dominadas explosivas",
    dose: "5-6 series de 2 reps, descanso largo.",
    rationale: "Refuerza velocidad de traccion para movimientos dinamicos sin agregar mucho volumen.",
    cues: ["Intencion maxima", "Parar si baja velocidad", "Aterriza con control abajo"],
    avoid: "No convertir en series largas.",
    refs: [reference("Pull-up para potencia", "Lattice Training", "https://www.youtube.com/watch?v=7TLG1mHQHgw", youtubeThumb("7TLG1mHQHgw"))]
  },
  ringSupport: {
    title: "Ring support hold",
    dose: "3-4 series de 15-30 s.",
    rationale: "Estabilidad de hombro y tronco para tolerar anillas y movimientos de compresion.",
    cues: ["Codos bloqueados", "Anillas pegadas", "Hombros bajos y cuello largo"],
    avoid: "No dejes que las anillas roten hacia afuera sin control.",
    refs: [reference("Ring support hold", "GMB Fitness / YouTube", "https://www.youtube.com/watch?v=KyvLK70-U-0", youtubeThumb("KyvLK70-U-0"))]
  },
  splitSquat: {
    title: "Split squat con kettlebell",
    dose: "3 series de 8 reps por pierna.",
    rationale: "Fortalece piernas unilateralmente para pasos altos, talones y empujes asimetricos.",
    cues: ["Tronco alto", "Rodilla sigue linea del pie", "Controla bajada 2 s"],
    avoid: "No rebotes ni pierdas equilibrio.",
    refs: [reference("Kettlebell split squat", "Criticalbench / YouTube", "https://www.youtube.com/watch?v=i0PhgeIEiaA", youtubeThumb("i0PhgeIEiaA"))]
  },
  suitcaseCarry: {
    title: "Suitcase hold/carry",
    dose: "4 series de 30-40 s por lado con 16 kg.",
    rationale: "Antilateroflexion para sostener cadera cuando una mano o un pie se aleja del centro.",
    cues: ["Costillas abajo", "No inclinarse", "Camina lento o sostene estatico"],
    avoid: "No uses velocidad para ocultar perdida de postura.",
    refs: [reference("Suitcase carry", "Muscle & Strength", "https://www.muscleandstrength.com/exercises/dumbbell-suitcase-carry")]
  },
  powerEnduranceBurns: {
    title: "Burns de power endurance",
    dose: "2 bloques de 3 burns de 2-3 min, 2-3 min entre burns, 10 min entre bloques.",
    rationale: "Pico de tolerancia al bombeo antes del taper, con transferencia directa a links largos.",
    cues: ["Mantener beta fija", "RPE 9 solo al final", "Cortar si la tecnica colapsa"],
    avoid: "No buscar fallo desde el primer burn.",
    refs: [reference("Power endurance protocols", "Training for Climbing", "https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/")]
  },
  videoReview: {
    title: "Revision de video",
    dose: "Subir 1-3 clips por sesion clave y marcar cortes de pie, ritmo y pausas.",
    rationale: "El video convierte sensaciones en datos: si ves cadera, pies y manos, puedes corregir la beta rapido.",
    cues: ["Camara lateral o 3/4", "Incluye pies completos", "Anota el segundo exacto del error"],
    avoid: "No grabes solo manos; necesitas ver cadera y pies.",
    refs: [reference("Video propio de la app", "Tracker local", "#video")]
  },
  primerSession: {
    title: "Primer de activacion",
    dose: "40-50 min total, 4-6 movimientos duros y 2 links cortos, descanso largo.",
    rationale: "Despierta contacto y coordinacion sin gastar energia antes del dia de prueba.",
    cues: ["Salir con ganas de mas", "Pocas reps excelentes", "Nada de bombeo residual"],
    avoid: "No agregues volumen porque te sentis bien.",
    refs: [reference("Principios de taper y PE", "Training for Climbing", "https://trainingforclimbing.com/power-endurance-training-protocols-for-climbers/")]
  },
  recoveryCheck: {
    title: "Chequeo de recuperacion",
    dose: "5 min: dolor 0-10, energia 0-10, piel, sueno y ganas de entrenar.",
    rationale: "El bloque es intenso; ajustar por dolor o baja tendencia evita perder adaptacion por lesion.",
    cues: ["Dolor >2/10 baja carga", "Dos sesiones malas seguidas reducen volumen", "Piel mala cambia a movilidad"],
    avoid: "No ignores dolor de dedos/codos por cumplir el calendario.",
    refs: [reference("Gestion de carga en escalada", "Training for Climbing", "https://trainingforclimbing.com/rotator-cuff-training-for-climbers/")]
  },
  reviewMetrics: {
    title: "Revision de metricas W1 vs W4",
    dose: "Comparar mejor link, RPE, bombeo, intentos, dolor y errores de video.",
    rationale: "Decide si el siguiente bloque debe priorizar fuerza, resistencia de potencia o tecnica.",
    cues: ["Mira tendencia, no un solo dia", "Separar rendimiento de fatiga", "Elegir un foco para el proximo bloque"],
    avoid: "No subir volumen si el dolor termino alto.",
    refs: [reference("Perfil y respaldo del tracker", "Tracker local", "#profile")]
  }
};

export const sessionExerciseMap: Record<string, string[]> = {
  w1d1: ["limitBoard", "weightedPullup", "ringRow", "ringPushup", "externalRotation", "fingerExtensors", "activeFeet"],
  w1d2: ["rdl", "gobletSquat", "kbSwing", "hollowHold", "deadBug", "sidePlank", "ringSupport", "externalRotation", "fingerExtensors"],
  w1d3: ["fourByFour", "activeFeet", "breathingPacing", "fingerExtensors"],
  w1d4: ["mobilityPrep", "externalRotation", "facePull", "fingerExtensors"],
  w1d5: ["deadpoint", "scapPullup", "lockoff", "activeFeet"],
  w1d6: ["aerobicIntervals", "activeFeet", "breathingPacing", "externalRotation"],
  w1d7: ["recoveryCheck"],
  w2d1: ["limitBoard", "weightedPullup", "ringRow", "ringSupport", "fingerExtensors"],
  w2d2: ["fourByFour", "activeFeet", "breathingPacing", "scapPullup"],
  w2d3: ["mobilityPrep", "externalRotation", "fingerExtensors"],
  w2d4: ["deadpoint", "explosivePullup", "ringSupport", "externalRotation"],
  w2d5: ["rdl", "splitSquat", "suitcaseCarry", "hollowHold", "sidePlank"],
  w2d6: ["routeCircuit", "breathingPacing", "activeFeet", "videoReview"],
  w2d7: ["recoveryCheck"],
  w3d1: ["limitBoard", "weightedPullup", "ringRow", "fingerExtensors"],
  w3d2: ["mobilityPrep", "externalRotation", "fingerExtensors"],
  w3d3: ["powerEnduranceBurns", "fourByFour", "routeCircuit", "breathingPacing"],
  w3d4: ["recoveryCheck", "mobilityPrep"],
  w3d5: ["deadpoint", "limitBoard", "scapPullup"],
  w3d6: ["routeCircuit", "breathingPacing", "videoReview"],
  w3d7: ["recoveryCheck"],
  w4d1: ["limitBoard", "weightedPullup", "activeFeet"],
  w4d2: ["mobilityPrep", "externalRotation", "fingerExtensors"],
  w4d3: ["fourByFour", "aerobicIntervals", "breathingPacing", "externalRotation"],
  w4d4: ["recoveryCheck"],
  w4d5: ["primerSession", "deadpoint", "routeCircuit"],
  w4d6: ["routeCircuit", "videoReview", "breathingPacing", "activeFeet"],
  w4d7: ["reviewMetrics", "videoReview", "recoveryCheck"]
};

export const defaultState: TrackerState = {
  goals: {
    currentGrade: "6c/7a",
    targetGrade: "7a+/7b",
    project: "Circuito 35-50 movimientos en 45 grados",
    focus: "pies activos, cadera, deadpoints compactos"
  },
  profile: {
    name: "Mateo",
    location: "Argentina",
    age: "",
    sex: "",
    height: "",
    weight: "",
    wingspan: "",
    apeIndex: "",
    dominantHand: "",
    handSize: "",
    climbingExperience: "Boulder maximo V9; ruta actual 6c/7a.",
    maxBoulder: "V9",
    maxSport: "6c/7a",
    styleStrengths: "",
    styleWeaknesses: "",
    fingerStrength: "",
    fingerEndurance: "",
    pullStrength: "15 dominadas seguidas.",
    shoulderCapacity: "",
    coreTension: "",
    hipAnkleMobility: "",
    weeklyAvailability: "4-5 sesiones de escalada/fuerza + movilidad segun recuperacion.",
    trainingLoad: "",
    sleepBaseline: "",
    stressBaseline: "",
    boardSetup: "Palestra a 45 grados en casa.",
    equipment: "Barra de 20 kg + 40 kg en discos, anillas, bandas elasticas, soga y 2 kettlebells de 16 kg.",
    strengths: "15 dominadas seguidas, 30 flexiones seguidas, buena fuerza base para bloque.",
    limiters: "Continuidad, pies activos, cadera cargada y decisiones bajo fatiga.",
    injuryHistory: "Sin lesiones cargadas. Vigilar dedos, codos, hombros y piel durante el bloque.",
    currentPain: "",
    skinTolerance: "",
    nutritionRisk: "",
    recoveryNotes: "Usar dolor, sueno, energia y bombeo para ajustar intensidad.",
    coachNotes: "Objetivo agresivo de 4 semanas: subir 1-2 grados sin sacrificar tejido conectivo.",
    questionnaireCompleted: false,
    questionnaireCompletedAt: "",
    questionnaireVersion: 0
  },
  logs: [],
  videos: []
};

export const logNumberLimits = {
  rpe: { label: "RPE", min: 1, max: 10 },
  pump: { label: "Bombeo", min: 0, max: 10 },
  pain: { label: "Dolor", min: 0, max: 10 },
  attempts: { label: "Intentos", min: 0, max: 200 },
  moves: { label: "Movimientos", min: 0, max: 500 },
  bestLink: { label: "Mejor link", min: 0, max: 500 },
  footCuts: { label: "Cortes de pie", min: 0, max: 200 },
  pullWeight: { label: "Lastre dominada kg", min: -100, max: 200 },
  sleep: { label: "Sueno", min: 0, max: 10 },
  energy: { label: "Energia", min: 0, max: 10 }
} as const;

export const logNumberFields = Object.keys(logNumberLimits) as LogNumberKey[];
