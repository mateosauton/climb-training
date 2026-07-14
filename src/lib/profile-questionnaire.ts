export type QuestionnaireInputKind = "text" | "textarea" | "number" | "choice" | "multi";

export type QuestionnaireOption = {
  value: string;
  label: string;
  helper?: string;
};

export type QuestionnaireField = {
  name: string;
  label: string;
  help: string;
  placeholder?: string;
  kind?: QuestionnaireInputKind;
  span?: "full";
  rows?: number;
  options?: QuestionnaireOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue?: string;
  helpExample?: string;
};

export type QuestionnaireSection = {
  id: string;
  title: string;
  description: string;
  fields: QuestionnaireField[];
};

const gradeBoulderOptions = Array.from({ length: 13 }, (_, index) => ({
  value: `V${index}`,
  label: `V${index}`
}));

const sportGradeOptions = [
  "5",
  "5+",
  "6a",
  "6a+",
  "6b",
  "6b+",
  "6c",
  "6c/7a",
  "7a",
  "7a+",
  "7b",
  "7b+",
  "7c",
  "7c+",
  "8a",
  "8a+",
  "8b",
  "8b+"
].map((grade) => ({ value: grade, label: grade }));

const styleOptions: QuestionnaireOption[] = [
  { value: "Regletas", label: "Regletas" },
  { value: "Romos / slopers", label: "Romos / slopers" },
  { value: "Pinzas", label: "Pinzas" },
  { value: "Compresion", label: "Compresion" },
  { value: "Desplome", label: "Desplome" },
  { value: "Techo", label: "Techo" },
  { value: "Placa", label: "Placa" },
  { value: "Vertical tecnico", label: "Vertical tecnico" },
  { value: "Deadpoints", label: "Deadpoints" },
  { value: "Coordinacion", label: "Coordinacion" },
  { value: "Estatico / bloqueo", label: "Estatico" },
  { value: "Talones", label: "Talones" },
  { value: "Punteras / toe hooks", label: "Punteras" },
  { value: "Pies altos", label: "Pies altos" },
  { value: "Resistencia", label: "Resistencia" },
  { value: "Lectura de beta", label: "Lectura" }
];

const techniqueOptions: QuestionnaireOption[] = [
  { value: "Pies activos", label: "Pies activos" },
  { value: "Cadera cerca", label: "Cadera cerca" },
  { value: "Deadpoints compactos", label: "Deadpoints" },
  { value: "Respiracion", label: "Respiracion" },
  { value: "Lectura antes de salir", label: "Lectura" },
  { value: "Talones y punteras", label: "Talones/punteras" },
  { value: "Bloqueos limpios", label: "Bloqueos" },
  { value: "Ritmo sin bombeo", label: "Ritmo" },
  { value: "No cortar pies", label: "No cortar pies" }
];

const loadOptions: QuestionnaireOption[] = [
  { value: "Board 1-2/sem", label: "Board 1-2/sem" },
  { value: "Board 3+/sem", label: "Board 3+/sem" },
  { value: "Fuerza 1/sem", label: "Fuerza 1/sem" },
  { value: "Fuerza 2+/sem", label: "Fuerza 2+/sem" },
  { value: "Hangboard", label: "Hangboard" },
  { value: "Campus", label: "Campus" },
  { value: "Movilidad", label: "Movilidad" },
  { value: "Descanso suficiente", label: "Descanso ok" }
];

export const QUESTIONNAIRE_VERSION = 2;

export const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    id: "base",
    title: "Perfil base",
    description: "Datos rapidos para interpretar alcance, fuerza relativa y recuperacion.",
    fields: [
      { name: "name", label: "Nombre", help: "Solo identifica tu perfil dentro del tracker.", placeholder: "Mateo" },
      {
        name: "location",
        label: "Zona",
        help: "Pais o ciudad. Sirve para horarios, clima y calendario.",
        placeholder: "Argentina"
      },
      { name: "age", label: "Edad", help: "Contexto para recuperacion y tolerancia a volumen.", kind: "number", min: 12, max: 80, step: 1, unit: "años" },
      {
        name: "sex",
        label: "Contexto biológico",
        help: "Opcional. Ayuda a evitar recomendaciones ciegas de carga, energia y recuperacion.",
        kind: "choice",
        options: [
          { value: "", label: "Prefiero no decir" },
          { value: "Masculino", label: "Masculino" },
          { value: "Femenino", label: "Femenino" },
          { value: "Otro / mixto", label: "Otro / mixto" }
        ]
      },
      { name: "height", label: "Altura", help: "Medi descalzo contra una pared. Afecta centro de masa y alcance.", kind: "number", min: 120, max: 220, step: 1, unit: "cm" },
      { name: "weight", label: "Peso", help: "Sirve para normalizar fuerza. No se usa para recomendar bajar peso por defecto.", kind: "number", min: 35, max: 120, step: 0.5, unit: "kg" },
      { name: "wingspan", label: "Envergadura", help: "Medi de punta a punta de los dedos con brazos abiertos en cruz.", kind: "number", min: 120, max: 240, step: 1, unit: "cm" },
      {
        name: "apeIndex",
        label: "Ape index",
        help: "Es envergadura menos altura. Si medis 178 cm y tu envergadura es 183 cm, tu ape index es +5 cm.",
        helpExample: "Para medirlo: espalda contra pared, brazos en cruz, mide de dedo medio a dedo medio. Luego resta altura.",
        kind: "number",
        min: -20,
        max: 30,
        step: 1,
        unit: "cm"
      },
      {
        name: "dominantHand",
        label: "Mano dominante",
        help: "Ayuda a leer asimetrias de fuerza, lesiones y preferencias de beta.",
        kind: "choice",
        options: [
          { value: "Derecha", label: "Derecha" },
          { value: "Izquierda", label: "Izquierda" },
          { value: "Ambidiestro", label: "Ambidiestro" }
        ]
      },
      {
        name: "handSize",
        label: "Mano / dedos",
        help: "Selecciona rasgos que cambian agarres y beta.",
        kind: "multi",
        options: [
          { value: "Mano chica", label: "Mano chica" },
          { value: "Mano media", label: "Mano media" },
          { value: "Mano grande", label: "Mano grande" },
          { value: "Dedos cortos", label: "Dedos cortos" },
          { value: "Dedos largos", label: "Dedos largos" },
          { value: "No se", label: "No se" }
        ]
      }
    ]
  },
  {
    id: "climbing",
    title: "Escalada y objetivo",
    description: "Grado, proyecto y estilos que definen la direccion del bloque.",
    fields: [
      { name: "climbingExperience", label: "Años escalando", help: "Diferencia adaptacion de tejido y tolerancia a carga.", kind: "number", min: 0, max: 40, step: 0.5, unit: "años" },
      { name: "maxBoulder", label: "Max boulder", help: "Mejor bloque reciente o historico util para calibrar intensidad.", kind: "choice", options: gradeBoulderOptions },
      { name: "maxSport", label: "Max via / deportiva", help: "Mejor grado en via o circuito largo.", kind: "choice", options: sportGradeOptions },
      { name: "styleStrengths", label: "Estilos fuertes", help: "Toca todos los estilos donde sentis ventaja real.", kind: "multi", options: styleOptions, span: "full" },
      { name: "styleWeaknesses", label: "Estilos debiles", help: "Toca todos los estilos que te limitan aunque estes fuerte.", kind: "multi", options: styleOptions, span: "full" },
      {
        name: "project",
        label: "Proyecto principal",
        help: "Elegir un formato hace que el plan priorice energia y tecnica correcta.",
        kind: "choice",
        span: "full",
        options: [
          { value: "Circuito 35-50 movimientos en 45 grados", label: "Circuito 35-50 mov en 45" },
          { value: "Boulder limite en board", label: "Boulder limite" },
          { value: "Power endurance en board", label: "Power endurance" },
          { value: "Deportiva / via larga", label: "Deportiva" },
          { value: "Tecnica y eficiencia", label: "Tecnica" }
        ]
      },
      {
        name: "focus",
        label: "Foco tecnico",
        help: "Selecciona las reglas tecnicas que queres que aparezcan en cada sesion.",
        kind: "multi",
        span: "full",
        options: techniqueOptions
      }
    ]
  },
  {
    id: "capacity",
    title: "Capacidad especifica",
    description: "Marcadores cuantificables de fuerza, resistencia y movilidad.",
    fields: [
      {
        name: "fingerStrength",
        label: "Fuerza dedos",
        help: "Usa referencia de 20 mm o el agarre mas parecido que puedas repetir.",
        kind: "choice",
        options: [
          { value: "No medido", label: "No medido" },
          { value: "BW 20 mm 7s", label: "BW 20mm 7s" },
          { value: "+10 kg 20 mm 7s", label: "+10 kg" },
          { value: "+20 kg 20 mm 7s", label: "+20 kg" },
          { value: "+30 kg 20 mm 7s", label: "+30 kg" },
          { value: "+40 kg o mas 20 mm 7s", label: "+40 kg+" }
        ]
      },
      {
        name: "fingerEndurance",
        label: "Resistencia dedos",
        help: "Elige el mejor marcador continuo que puedas repetir.",
        kind: "choice",
        options: [
          { value: "No medido", label: "No medido" },
          { value: "Menos de 20 movimientos", label: "<20 mov" },
          { value: "20-35 movimientos", label: "20-35 mov" },
          { value: "35-50 movimientos", label: "35-50 mov" },
          { value: "50+ movimientos", label: "50+ mov" },
          { value: "Repeaters completos", label: "Repeaters ok" }
        ]
      },
      { name: "pullStrength", label: "Dominadas max", help: "Cantidad maxima estricta seguida. Si tenes lastre, cargalo en notas del log.", kind: "number", min: 0, max: 40, step: 1, unit: "reps" },
      {
        name: "shoulderCapacity",
        label: "Hombro / escapula",
        help: "Marca el estado mas parecido al hacer bloqueos o tracciones.",
        kind: "choice",
        options: [
          { value: "Sin dolor y control ok", label: "Sin dolor" },
          { value: "Control irregular", label: "Control irregular" },
          { value: "Molestia leve", label: "Molestia leve" },
          { value: "Dolor al bloquear", label: "Dolor bloqueo" },
          { value: "No se", label: "No se" }
        ]
      },
      {
        name: "coreTension",
        label: "Tension corporal",
        help: "Evalua cuanto se cortan los pies en desplome o movimientos largos.",
        kind: "choice",
        options: [
          { value: "Pies cortan seguido", label: "Cortan seguido" },
          { value: "Pies cortan a veces", label: "A veces" },
          { value: "Estable en la mayoria", label: "Estable" },
          { value: "Muy fuerte", label: "Muy fuerte" }
        ]
      },
      {
        name: "hipAnkleMobility",
        label: "Cadera / tobillo",
        help: "Selecciona posiciones que salen bien o limitan tu beta.",
        kind: "multi",
        options: [
          { value: "High steps buenos", label: "High steps ok" },
          { value: "Drop knees buenos", label: "Drop knees ok" },
          { value: "Talones buenos", label: "Talones ok" },
          { value: "Tobillo limitado", label: "Tobillo limitado" },
          { value: "Cadera limitada", label: "Cadera limitada" },
          { value: "No se", label: "No se" }
        ]
      }
    ]
  },
  {
    id: "load",
    title: "Carga y recuperacion",
    description: "Datos para decidir cuando apretar, sostener o recortar volumen.",
    fields: [
      { name: "weeklyAvailability", label: "Sesiones por semana", help: "Cantidad realista de dias para entrenar sin contar movilidad breve.", kind: "number", min: 1, max: 7, step: 1, unit: "dias" },
      { name: "trainingLoad", label: "Carga actual", help: "Selecciona lo que ya hiciste en las ultimas 2 semanas.", kind: "multi", options: loadOptions, span: "full" },
      { name: "sleepBaseline", label: "Sueno base", help: "Horas promedio. Si varia mucho, usa el promedio de la ultima semana.", kind: "number", min: 4, max: 10, step: 0.5, unit: "h" },
      { name: "stressBaseline", label: "Estres / energia", help: "1 es muy bajo estres, 10 es estres alto que afecta recuperacion.", kind: "number", min: 1, max: 10, step: 1, unit: "/10" },
      {
        name: "recoveryNotes",
        label: "Senales de ajuste",
        help: "Marca senales que indican bajar carga o cambiar estimulo.",
        kind: "multi",
        span: "full",
        options: [
          { value: "Dedos sensibles", label: "Dedos sensibles" },
          { value: "Codo cargado", label: "Codo cargado" },
          { value: "Hombro cargado", label: "Hombro cargado" },
          { value: "Piel limitada", label: "Piel limitada" },
          { value: "Sueno bajo", label: "Sueno bajo" },
          { value: "Energia baja", label: "Energia baja" },
          { value: "Sin senales", label: "Sin senales" }
        ]
      }
    ]
  },
  {
    id: "risk",
    title: "Lesiones y salud",
    description: "Historial para proteger dedos, codos, hombros y energia disponible.",
    fields: [
      {
        name: "injuryHistory",
        label: "Lesiones previas",
        help: "Marca zonas con lesion previa o molestias recurrentes.",
        kind: "multi",
        span: "full",
        options: [
          { value: "Ninguna relevante", label: "Ninguna" },
          { value: "Polea / A2 / dedos", label: "Dedos / polea" },
          { value: "Codo", label: "Codo" },
          { value: "Hombro", label: "Hombro" },
          { value: "Muneca", label: "Muneca" },
          { value: "Espalda", label: "Espalda" },
          { value: "Rodilla / tobillo", label: "Rodilla/tobillo" }
        ]
      },
      { name: "currentPain", label: "Dolor actual", help: "0 sin dolor, 10 dolor maximo. Mas de 2 cambia la carga del plan.", kind: "number", min: 0, max: 10, step: 1, unit: "/10" },
      {
        name: "skinTolerance",
        label: "Piel",
        help: "Sirve para dosificar volumen en board y regletas.",
        kind: "choice",
        options: [
          { value: "Alta", label: "Alta" },
          { value: "Media", label: "Media" },
          { value: "Baja", label: "Baja" },
          { value: "Se abre facil", label: "Se abre facil" }
        ]
      },
      {
        name: "nutritionRisk",
        label: "Energia / peso",
        help: "Marca el estado actual de combustible. El plan no debe empujar intensidad si falta energia.",
        kind: "choice",
        options: [
          { value: "Peso estable y energia ok", label: "Estable" },
          { value: "Deficit leve", label: "Deficit leve" },
          { value: "Baja energia frecuente", label: "Baja energia" },
          { value: "Cambio rapido de peso", label: "Cambio rapido" },
          { value: "Prefiero no decir", label: "Prefiero no decir" }
        ]
      }
    ]
  },
  {
    id: "environment",
    title: "Entorno y notas",
    description: "Recursos reales y una nota final para casos que no entran en botones.",
    fields: [
      {
        name: "boardSetup",
        label: "Muro principal",
        help: "El angulo y tipo de muro cambian el estimulo tecnico y fisico.",
        kind: "choice",
        span: "full",
        options: [
          { value: "Palestra 45 grados en casa", label: "Board 45 en casa" },
          { value: "Board 30-40 grados", label: "Board 30-40" },
          { value: "Moon/Kilter/Tension board", label: "Board comercial" },
          { value: "Gimnasio con boulder variado", label: "Gym variado" },
          { value: "Roca / deportiva", label: "Roca/deportiva" }
        ]
      },
      {
        name: "equipment",
        label: "Equipo disponible",
        help: "Selecciona todo lo que podes usar para adaptar fuerza, movilidad y prehab.",
        kind: "multi",
        span: "full",
        options: [
          { value: "Barra", label: "Barra" },
          { value: "Discos / lastre", label: "Discos/lastre" },
          { value: "Anillas", label: "Anillas" },
          { value: "Bandas elasticas", label: "Bandas" },
          { value: "Soga", label: "Soga" },
          { value: "Kettlebells", label: "Kettlebells" },
          { value: "Fingerboard", label: "Fingerboard" },
          { value: "Foam roller / movilidad", label: "Movilidad" }
        ]
      },
      {
        name: "strengths",
        label: "Fortalezas",
        help: "Capacidades que ya se pueden aprovechar.",
        kind: "multi",
        options: [
          { value: "Fuerza de tiron", label: "Tiron" },
          { value: "Bloque limite", label: "Bloque limite" },
          { value: "Board climbing", label: "Board" },
          { value: "Contact strength", label: "Contacto" },
          { value: "Tecnica de pies", label: "Pies" },
          { value: "Resistencia", label: "Resistencia" }
        ]
      },
      {
        name: "limiters",
        label: "Limitantes",
        help: "Cuellos de botella que mas se repiten.",
        kind: "multi",
        options: [
          { value: "Continuidad", label: "Continuidad" },
          { value: "Pies activos", label: "Pies" },
          { value: "Cadera bajo fatiga", label: "Cadera" },
          { value: "Lectura de beta", label: "Lectura" },
          { value: "Piel", label: "Piel" },
          { value: "Dedos", label: "Dedos" },
          { value: "Miedo / decision", label: "Decision" }
        ]
      },
      {
        name: "coachNotes",
        label: "Nota final opcional",
        help: "Usa texto solo para algo importante que no entre en las opciones.",
        placeholder: "Ej: viaje en semana 3, dolor raro, objetivo puntual.",
        kind: "textarea",
        rows: 3,
        span: "full"
      }
    ]
  }
];

export const profileQuestionnaireFields = QUESTIONNAIRE_SECTIONS.flatMap((section) =>
  section.fields.map((field) => field.name)
);

export function calculateQuestionnaireCompletion(profile: Record<string, unknown>) {
  const answered = profileQuestionnaireFields.filter((field) => String(profile?.[field] ?? "").trim().length > 0).length;
  const total = profileQuestionnaireFields.length;
  return {
    answered,
    total,
    percent: total ? Math.round((answered / total) * 100) : 0
  };
}

export function buildProfileFromQuestionnaireForm(form: FormData, currentProfile: Record<string, unknown>) {
  const nextProfile = { ...currentProfile };
  QUESTIONNAIRE_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.kind === "multi") {
        nextProfile[field.name] = form.getAll(field.name).map(String).filter(Boolean).join(", ");
        return;
      }
      const value = form.get(field.name);
      nextProfile[field.name] = value === null ? String(currentProfile?.[field.name] ?? "") : String(value);
    });
  });
  nextProfile.questionnaireCompleted = true;
  nextProfile.questionnaireCompletedAt = new Date().toISOString();
  nextProfile.questionnaireVersion = QUESTIONNAIRE_VERSION;
  return nextProfile;
}
