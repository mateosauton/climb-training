export const LINK_EXPIRY_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 60;

export const ONBOARDING_COPY = {
  gateSubtitle: "Entra o crea tu cuenta con tu correo. Sin contraseña.",
  gateCta: "Enviar link",
  gateHelper: "Te mandamos un link. Ábrelo y entras.",
  gateAlreadyPrompt: "¿Ya pediste el link?",
  gateAlreadyAction: "Revisa tu bandeja",
  gateFooter: "Si es tu primera vez, el mismo link crea tu cuenta.",
  gateErrorEmail: "Ese correo no parece válido. Revisa que tenga @ y dominio.",
  checkTitle: "Revisa tu correo",
  checkBodyLead: "Enviamos un link de acceso a",
  checkInfo: "Ábrelo desde este teléfono y entras directo. El link vence en 15 minutos.",
  checkCta: "Abrir app de correo",
  checkResend: "Reenviar link",
  checkChange: "Cambiar correo",
  checkResent: "✓ Link reenviado. Puede tardar un minuto.",
  checkFooter: "¿No llega? Revisa spam o promociones.",
  sendFailed: "No pudimos enviar el link. Intenta de nuevo.",
  saludOverline: "UN PASO · OPCIONAL",
  saludTitle: "Entrena según cómo dormiste",
  saludBody: "Conecta Salud y Maillon ajusta el descanso y la carga de tu plan con tus datos del día.",
  saludSkip: "Ahora no",
  saludTrust: "Solo lectura. No es consejo médico: Maillon usa esto únicamente para ajustar descanso y carga. Puedes desconectar en Perfil.",
  ctaIos: "Conectar Apple Salud",
  ctaAndroid: "Usar Health Connect (Android)",
  loadingIos: "Conectando con Apple Salud…",
  loadingAndroid: "Conectando con Health Connect…",
  loadingBody: "Leyendo tus últimos 14 días. Puedes seguir.",
  loadingContinue: "Seguir a Hoy",
  deniedTitle: "No pudimos leer tus datos",
  deniedBody: "El permiso quedó desactivado. Actívalo en Ajustes › Salud › Maillon y vuelve a intentar.",
  deniedRetry: "Reintentar",
  deniedSettings: "Abrir Ajustes",
  deniedSkip: "Saltar por ahora",
  listoOverline: "SALUD CONECTADA",
  listoTitle: "Listo, ya leemos tu día",
  listoBody: "Así se ve en Hoy. Con estos datos ajustamos la sesión antes de que empieces.",
  listoReadingLabel: "Lectura de hoy",
  listoReading: "Dormiste bien y la FC está estable: mantenemos la carga planificada.",
  listoExample: "Ejemplo ilustrativo. Tus valores aparecen después de la primera sincronización.",
  listoCta: "Ir a Hoy",
  questionnairePromptTitle: "Cuestionario en tu primera sesión",
  questionnairePromptBody: "Objetivo, nivel, equipo y disponibilidad ya no frenan el arranque. Completalos aquí o en Perfil cuando registres una sesión.",
  questionnairePromptCta: "Completar cuestionario",
  profileHealthTitle: "Salud",
  profileHealthConnected: "Conectada · solo lectura",
  profileHealthDisconnected: "No conectada. Puedes conectarla cuando quieras.",
  profileHealthConnect: "Conectar Salud",
  profileHealthDisconnect: "Desconectar Salud"
} as const;

export const HEALTH_METRICS = [
  { id: "sleep", label: "Sueño", detail: "horas y regularidad", priority: "p0" },
  { id: "rhr", label: "FC en reposo", detail: "tendencia diaria", priority: "p0" },
  { id: "hrv", label: "HRV", detail: "si tu reloj la mide", priority: "optional" }
] as const;

export const LISTO_CHIPS = [
  { label: "Sueño", value: "7 h 10", detail: "anoche" },
  { label: "FC reposo", value: "54", detail: "lpm · estable" },
  { label: "HRV", value: "62 ms", detail: "normal" }
] as const;
