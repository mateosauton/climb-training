// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { es } from "date-fns/locale";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  Dumbbell,
  ExternalLink,
  FileText,
  Film,
  Flame,
  Gauge,
  HelpCircle,
  ListChecks,
  LogOut,
  Minus,
  Moon,
  Play,
  Plus,
  RefreshCcw,
  Save,
  ShieldAlert,
  Sun,
  Target,
  Timer,
  Trash2,
  Upload,
  UserRound,
  X,
  Zap
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ProfilePhotoPicker } from "@/features/profile/ProfilePhotoPicker";
import { createAvatarSignedUrl, uploadAvatar } from "@/features/cloud/cloud-avatar";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  QUESTIONNAIRE_SECTIONS,
  QUESTIONNAIRE_VERSION,
  buildProfileFromQuestionnaireForm,
  calculateQuestionnaireCompletion
} from "@/lib/profile-questionnaire";
import { cn } from "@/lib/utils";
import { GuidedSessionFlow } from "@/features/guided-session/GuidedSessionFlow";
import { GuidedResumeBanner } from "@/features/guided-session/GuidedResumeBanner";
import { guidedSessionDefinitions } from "@/features/guided-session/guided-session-data";
import { appendChangedFacts, projectTrackerState } from "@/features/user-data/user-facts";
import { buildUserDataExport, userDataExportFilename } from "@/features/user-data/user-data-export";
import { createUserGuidedStorage } from "@/features/user-data/user-guided-storage";
import { migrateLegacyUserData } from "@/features/user-data/user-data-migration";
import { emptyGuidedSessionState } from "@/features/guided-session/guided-session-storage";
import { activateAuthenticatedUser, resetAuthenticatedUser } from "@/features/auth/authenticated-user";
import { loadUserData, persistRecoveryBeforeCloudEffect, saveUserData } from "@/features/user-data/user-data-storage";
import { createCloudClient } from "@/features/cloud/cloud-client";
import { createCloudVideoService, videoPath } from "@/features/cloud/cloud-video";
import { stageLegacyImportVideos } from "@/features/cloud/legacy-video-import";
import { reconcileUploadedVideoRecovery } from "@/features/cloud/video-recovery";
import type { CloudRepository } from "@/features/cloud/cloud-repository";
import type { CloudImport } from "@/features/cloud/cloud-import";
import { readAuthConfig } from "@/features/auth/auth-config";
import { buildSessionRecommendation } from "@/features/session-recommendation/session-recommendation";
import {
  defaultState,
  exerciseLibrary,
  logNumberFields,
  logNumberLimits,
  plan,
  sessionExerciseMap
} from "@/lib/training";

const THEME_STORAGE_KEY = "climb4w.theme";
const DB_NAME = "climb4w.videos";
const DB_VERSION = 1;
const VIDEO_STORE = "videos";
const cloudVideoClient = createCloudClient(readAuthConfig(import.meta.env));

const defaultLogValues = {
  rpe: "8",
  pump: "7",
  pain: "0",
  attempts: "12",
  moves: "40",
  bestLink: "0",
  footCuts: "0",
  pullWeight: "0",
  sleep: "7",
  energy: "7",
  notes: ""
};

const videoMetricLabels = {
  footCuts: "Cortes de pie",
  swing: "Swing al capturar",
  hips: "Cadera frontal",
  shoulder: "Hombro encogido",
  breath: "Respiracion cortada",
  reading: "Mala lectura de pies"
};

const profileFields = [
  "name",
  "location",
  "age",
  "sex",
  "height",
  "weight",
  "wingspan",
  "apeIndex",
  "dominantHand",
  "handSize",
  "climbingExperience",
  "maxBoulder",
  "maxSport",
  "styleStrengths",
  "styleWeaknesses",
  "fingerStrength",
  "fingerEndurance",
  "pullStrength",
  "shoulderCapacity",
  "coreTension",
  "hipAnkleMobility",
  "weeklyAvailability",
  "trainingLoad",
  "sleepBaseline",
  "stressBaseline",
  "boardSetup",
  "equipment",
  "strengths",
  "limiters",
  "injuryHistory",
  "currentPain",
  "skinTolerance",
  "nutritionRisk",
  "recoveryNotes",
  "coachNotes"
];

const defaultVideoValues = {
  footCuts: 2,
  swing: 2,
  hips: 3,
  shoulder: 2,
  breath: 2,
  reading: 3
};

const videoScoreOptions = [
  { value: 0, label: "0", helper: "OK" },
  { value: 1, label: "1", helper: "leve" },
  { value: 2, label: "2", helper: "medio" },
  { value: 3, label: "3", helper: "alto" },
  { value: 4, label: "4", helper: "critico" },
  { value: 5, label: "5", helper: "frena" }
];

const videoScoreSummary = {
  0: "sin problema",
  1: "leve",
  2: "medio",
  3: "alto",
  4: "critico",
  5: "bloqueante"
};

const integerInputLogFields = new Set(["attempts", "moves", "bestLink", "footCuts"]);
const wholeStepLogFields = new Set(["attempts", "moves", "bestLink", "footCuts", "pullWeight"]);

const logFieldHelp = {
  session: "Elegi el dia exacto del plan que estas registrando. Esto conecta el log con la rutina, intensidad y ejercicios de ese dia.",
  rpe: "Esfuerzo global de la sesion: 1 muy facil, 10 maximo. Cargalo al final, no por un intento aislado.",
  pump: "Bombeo de antebrazos en el peor momento o al terminar. 0 es nada, 10 es limitante.",
  pain: "Dolor en dedos, codo, hombro o piel. Si supera 2/10, conviene bajar carga o cambiar el dia duro.",
  attempts: "Cantidad total de intentos relevantes en bloques, links o series. No hace falta contar calentamiento facil.",
  moves: "Volumen aproximado de movimientos escalados con intencion. Sirve para comparar carga entre dias.",
  bestLink: "Mayor cantidad de movimientos continuos de calidad en el circuito o problema principal.",
  footCuts: "Veces que se cortaron los pies o perdiste tension corporal. Es una metrica tecnica, no de fuerza.",
  pullWeight: "Lastre usado en la serie principal de dominadas. Usa 0 sin lastre y negativos si descargaste con banda.",
  sleep: "Horas o calidad de sueno en escala 0-10. Ayuda a interpretar fatiga y tolerancia al entrenamiento.",
  energy: "Energia percibida antes de entrenar, 0-10. Usala para decidir si mantener o recortar volumen.",
  notes: "Anota beta, piel, caidas, dolor al dia siguiente, sensaciones y ajustes para la proxima vez."
};

const tabs = [
  { value: "dashboard", label: "Dashboard", icon: Activity },
  { value: "plan", label: "Plan", icon: CalendarDays },
  { value: "log", label: "Log", icon: ClipboardList },
  { value: "video", label: "Video", icon: Film },
  { value: "profile", label: "Perfil", icon: UserRound }
];
const primaryTabs = tabs.filter((tab) => tab.value !== "profile");

function cloneData(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeState(savedState) {
  const freshState = cloneData(defaultState);
  if (!savedState || typeof savedState !== "object") return freshState;
  const goals = savedState.goals && typeof savedState.goals === "object" ? savedState.goals : {};
  const profile = savedState.profile && typeof savedState.profile === "object" ? savedState.profile : {};
  return {
    ...freshState,
    ...savedState,
    goals: { ...freshState.goals, ...goals },
    profile: { ...freshState.profile, ...profile },
    logs: Array.isArray(savedState.logs) ? savedState.logs : [],
    videos: Array.isArray(savedState.videos) ? savedState.videos : []
  };
}

function loadTheme() {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  document.documentElement.style.colorScheme = nextTheme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Theme still applies for the current page if storage is unavailable.
  }
}

function makeId() {
  return crypto.randomUUID();
}

function sessionById(id) {
  return plan.find((session) => session.id === id) || plan[0];
}

function dateLabel(isoDate) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(`${isoDate}T12:00:00`));
}

function compactDate(isoDate) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(
    new Date(`${isoDate}T12:00:00`)
  );
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds = 0) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function average(values) {
  const numeric = values.map(Number).filter((value) => Number.isFinite(value));
  if (!numeric.length) return 0;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function intensityClass(intensity) {
  if (intensity === "alta") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  if (intensity === "media") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-100";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100";
}

function getSessionExercises(session) {
  return (sessionExerciseMap[session.id] || [])
    .map((id) => ({ id, ...exerciseLibrary[id] }))
    .filter((exercise) => exercise.title);
}

function openVideoDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE)) db.createObjectStore(VIDEO_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putVideo(id, file) {
  const db = await openVideoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE, "readwrite");
    transaction.objectStore(VIDEO_STORE).put(file, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getVideo(id) {
  const db = await openVideoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE, "readonly");
    const request = transaction.objectStore(VIDEO_STORE).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteVideoBlob(id) {
  const db = await openVideoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE, "readwrite");
    transaction.objectStore(VIDEO_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function deleteVideoBlobs(ids) {
  const db = await openVideoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE, "readwrite");
    const store = transaction.objectStore(VIDEO_STORE);
    ids.forEach((id) => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function buildAdvice(values, recentPain) {
  const advice = [];
  if (values.footCuts >= 3 || values.swing >= 3) {
    advice.push({
      title: "Tension antes que traccion",
      body:
        "Repite el crux como bloque de 2-3 movimientos. Antes de mover mano, carga pie, mete cadera y congela 2 segundos al capturar."
    });
  }
  if (values.hips >= 3) {
    advice.push({
      title: "Cadera menos frontal",
      body:
        "Busca drop knee, bicicleta o talon antes del movimiento duro. El objetivo es que la mano llegue tarde, no que arranque el movimiento."
    });
  }
  if (values.shoulder >= 3) {
    advice.push({
      title: "Escapula baja",
      body:
        "Incluye scap pull-ups y lock-offs cortos. En video, revisa si el hombro sube hacia la oreja justo antes del cierre."
    });
  }
  if (values.breath >= 3) {
    advice.push({
      title: "Exhalar antes del crux",
      body:
        "Marca una respiracion audible cada 2-3 movimientos y una exhalacion antes del movimiento de mayor tension."
    });
  }
  if (values.reading >= 3) {
    advice.push({
      title: "Lectura previa",
      body:
        "Antes de salir, nombra mano objetivo, pie que empuja y pie que contrapesa. No arranques sin esa secuencia."
    });
  }
  if (recentPain > 2) {
    advice.push({
      title: "Bajar carga hoy",
      body:
        "Dolor reciente mayor a 2/10. Cambia la proxima sesion dura por movilidad, bandas y escalada tecnica facil."
    });
  }
  if (!advice.length) {
    advice.push({
      title: "Mantener calidad",
      body:
        "No aparece un patron critico alto. Prioriza intentos frescos, descansos completos y compara el mejor link semana a semana."
    });
  }
  return advice;
}

function HelpTip({ label, children, example }) {
  return (
    <details className="group/help relative inline-flex">
      <summary
        aria-label={label}
        className="inline-flex size-6 shrink-0 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [&::-webkit-details-marker]:hidden"
      >
        <HelpCircle className="size-3.5" />
      </summary>
      <div className="absolute left-0 top-7 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-xl">
        <p className="leading-snug">{children}</p>
        {example ? <p className="mt-2 border-t border-border/70 pt-2 text-xs leading-snug text-muted-foreground">{example}</p> : null}
      </div>
    </details>
  );
}

function LabelWithHelp({ label, help, helpExample, htmlFor }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Label htmlFor={htmlFor} className="min-w-0 text-sm leading-snug">{label}</Label>
      {help ? <HelpTip label={`Ayuda: ${label}`} example={helpExample}>{help}</HelpTip> : null}
    </div>
  );
}

function TitleWithHelp({ icon: Icon, title, help }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {Icon ? <Icon className="size-5 shrink-0 text-primary" /> : null}
      <span className="min-w-0 truncate">{title}</span>
      {help ? <HelpTip label={`Ayuda: ${title}`}>{help}</HelpTip> : null}
    </span>
  );
}

function profileValue(value, fallback = "Sin cargar") {
  const text = String(value || "").trim();
  return text || fallback;
}

function MetricAnnotator({ metricKey, label, value, onChange }) {
  return (
    <fieldset className="rounded-lg border border-border/70 bg-background/45 p-2.5">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{label}</p>
        <Badge variant="outline" className="shrink-0">{value}/5 · {videoScoreSummary[value]}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {videoScoreOptions.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={`${metricKey}-${option.value}`}
              className="cursor-pointer"
            >
              <input
                className="peer sr-only"
                type="radio"
                name={`video-${metricKey}`}
                value={option.value}
                checked={selected}
                aria-label={`${label}: ${option.value} de 5, ${option.helper}`}
                onChange={() => onChange(option.value)}
              />
              <span
                className={cn(
                  "grid min-h-11 place-items-center rounded-md border text-center text-sm font-semibold transition peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring/60",
                  selected
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card/70 text-foreground hover:border-primary/60 hover:bg-primary/10"
                )}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({ label, children, className, htmlFor, help, helpExample }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <LabelWithHelp label={label} help={help} helpExample={helpExample} htmlFor={htmlFor} />
      {children}
    </div>
  );
}

function parseNumberValue(value) {
  const match = String(value ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function formatStepperValue(value, step = 1) {
  if (!Number.isFinite(value)) return "";
  const precision = String(step).includes(".") ? String(step).split(".")[1].length : 0;
  return value.toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function clampStepperValue(value, field) {
  if (!Number.isFinite(value)) return value;
  const min = Number.isFinite(field.min) ? field.min : -Infinity;
  const max = Number.isFinite(field.max) ? field.max : Infinity;
  return Math.min(max, Math.max(min, value));
}

function normalizeNumberText(value) {
  if (String(value ?? "").trim() === "") return "";
  const parsed = parseNumberValue(value);
  return Number.isFinite(parsed) ? formatStepperValue(parsed, 0.5) : String(value ?? "");
}

function splitMultiValue(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferChoiceValue(value, options = []) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const direct = options.find((option) => option.value === raw);
  if (direct) return direct.value;
  const lowered = raw.toLowerCase();
  const fuzzy = options.find((option) => {
    const valueText = String(option.value || "").toLowerCase();
    const labelText = String(option.label || "").toLowerCase();
    const searchableWords = `${valueText} ${labelText}`
      .split(/[^a-z0-9áéíóúñ]+/i)
      .filter((word) => word.length >= 5);
    return lowered.includes(valueText) || lowered.includes(labelText) || searchableWords.some((word) => lowered.includes(word));
  });
  return fuzzy?.value || raw;
}

function inferMultiValues(value, options = []) {
  const tokens = splitMultiValue(value);
  const lowered = String(value || "").toLowerCase();
  const selected = new Set();
  tokens.forEach((token) => {
    const match = options.find((option) => option.value === token || option.label === token);
    selected.add(match?.value || token);
  });
  options.forEach((option) => {
    const valueText = String(option.value || "").toLowerCase();
    const labelText = String(option.label || "").toLowerCase();
    const searchableWords = `${valueText} ${labelText}`
      .split(/[^a-z0-9áéíóúñ]+/i)
      .filter((word) => word.length >= 5);
    if (
      (valueText && lowered.includes(valueText)) ||
      (labelText && lowered.includes(labelText)) ||
      searchableWords.some((word) => lowered.includes(word))
    ) {
      selected.add(option.value);
    }
  });
  return Array.from(selected).filter(Boolean);
}

function NumberStepper({ field, id, name, value, onValueChange }) {
  const [internalValue, setInternalValue] = useState(() => normalizeNumberText(value));
  const step = Number.isFinite(field.step) ? field.step : 1;

  useEffect(() => {
    setInternalValue(normalizeNumberText(value));
  }, [value]);

  function commit(nextValue) {
    setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function bump(direction) {
    const parsed = parseNumberValue(internalValue);
    const fallback = Number.isFinite(parsed) ? parsed : Number.isFinite(field.min) ? field.min : 0;
    const next = clampStepperValue(fallback + direction * step, field);
    commit(formatStepperValue(next, step));
  }

  return (
    <div className="grid h-11 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] overflow-hidden rounded-lg border border-input bg-background/50 sm:h-10">
      <Button
        type="button"
        variant="ghost"
        className="h-full rounded-none border-r border-border px-0 sm:h-full"
        aria-label={`Bajar ${field.label}`}
        onClick={() => bump(-1)}
      >
        <Minus className="size-4" />
      </Button>
      <div className="flex min-w-0 items-center justify-center gap-1.5 px-2">
        <input
          id={id}
          name={name}
          value={internalValue}
          inputMode="decimal"
          className="h-full w-[7ch] min-w-0 bg-transparent text-center text-base font-semibold tabular-nums outline-none placeholder:text-muted-foreground focus-visible:ring-0 md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          placeholder={field.placeholder || "0"}
          onChange={(event) => commit(event.target.value)}
        />
        {field.unit ? <span className="shrink-0 text-sm text-muted-foreground">{field.unit}</span> : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-full rounded-none border-l border-border px-0 sm:h-full"
        aria-label={`Subir ${field.label}`}
        onClick={() => bump(1)}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function ChoicePills({ field, name, value, onValueChange }) {
  const [selected, setSelected] = useState(() => inferChoiceValue(value, field.options));

  useEffect(() => {
    setSelected(inferChoiceValue(value, field.options));
  }, [field.options, value]);

  function choose(nextValue) {
    setSelected(nextValue);
    onValueChange?.(nextValue);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selected} />
      <div className="flex flex-wrap gap-2">
        {(field.options || []).map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={`${name}-${option.value || "blank"}`}
              type="button"
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-10 items-center justify-center rounded-full border px-3.5 py-1.5 text-center text-sm font-medium leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background/55 text-foreground hover:border-primary/60 hover:bg-primary/10"
              )}
              onClick={() => choose(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiPills({ field, name, value, onValueChange }) {
  const [selected, setSelected] = useState(() => inferMultiValues(value, field.options));

  useEffect(() => {
    setSelected(inferMultiValues(value, field.options));
  }, [field.options, value]);

  function toggle(optionValue) {
    const next = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue];
    setSelected(next);
    onValueChange?.(next.join(", "));
  }

  return (
    <div className="space-y-2">
      {selected.map((item) => (
        <input key={`${name}-hidden-${item}`} type="hidden" name={name} value={item} />
      ))}
      <div className="flex flex-wrap gap-2">
        {(field.options || []).map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={`${name}-${option.value}`}
              type="button"
              aria-pressed={active}
              className={cn(
                "inline-flex min-h-10 items-center justify-center rounded-full border px-3.5 py-1.5 text-center text-sm font-medium leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-background/55 text-foreground hover:border-primary/60 hover:bg-primary/10"
              )}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionnaireFieldControl({ field, profile, prefix = "questionnaire", value, onValueChange }) {
  const id = `${prefix}-${field.name}`;
  const controlled = typeof onValueChange === "function";
  const currentValue = value ?? profile?.[field.name] ?? field.defaultValue ?? "";
  const update = (nextValue) => onValueChange?.(field.name, nextValue);
  const textProps = controlled
    ? { value: currentValue, onChange: (event) => update(event.target.value) }
    : { defaultValue: currentValue };
  return (
    <Field
      label={field.label}
      htmlFor={id}
      help={field.help}
      helpExample={field.helpExample}
      className={field.span === "full" ? "sm:col-span-2" : undefined}
    >
      {field.kind === "number" ? (
        <NumberStepper field={field} id={id} name={field.name} value={currentValue} onValueChange={update} />
      ) : field.kind === "choice" ? (
        <ChoicePills field={field} name={field.name} value={currentValue} onValueChange={update} />
      ) : field.kind === "multi" ? (
        <MultiPills field={field} name={field.name} value={currentValue} onValueChange={update} />
      ) : field.kind === "textarea" ? (
        <Textarea
          id={id}
          name={field.name}
          placeholder={field.placeholder}
          rows={field.rows || 3}
          {...textProps}
        />
      ) : (
        <Input
          id={id}
          name={field.name}
          placeholder={field.placeholder}
          {...textProps}
        />
      )}
    </Field>
  );
}

function createQuestionnaireFormData(draft) {
  const form = new FormData();
  QUESTIONNAIRE_SECTIONS.forEach((section) => {
    section.fields.forEach((field) => {
      const value = draft[field.name];
      if (field.kind === "multi") {
        splitMultiValue(value).forEach((item) => form.append(field.name, item));
        return;
      }
      form.set(field.name, String(value ?? ""));
    });
  });
  return form;
}

function ProfileQuestionnaire({ profile, completion, onSubmit, onSkip, theme, onThemeToggle, avatarFile, onAvatarFileChange, avatarUrl, avatarError, avatarSaving }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...profile }));
  const currentSection = QUESTIONNAIRE_SECTIONS[stepIndex];
  const isLastStep = stepIndex === QUESTIONNAIRE_SECTIONS.length - 1;
  const stepProgress = Math.round(((stepIndex + 1) / QUESTIONNAIRE_SECTIONS.length) * 100);
  const draftCompletion = calculateQuestionnaireCompletion(draft);

  function updateDraft(name, value) {
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === "height" || name === "wingspan") {
        const height = parseNumberValue(name === "height" ? value : next.height);
        const wingspan = parseNumberValue(name === "wingspan" ? value : next.wingspan);
        if (Number.isFinite(height) && Number.isFinite(wingspan)) {
          next.apeIndex = formatStepperValue(wingspan - height, 1);
        }
      }
      return next;
    });
  }

  function submitStep(event) {
    event.preventDefault();
    if (!isLastStep) {
      setStepIndex((current) => Math.min(QUESTIONNAIRE_SECTIONS.length - 1, current + 1));
      return;
    }
    onSubmit(createQuestionnaireFormData(draft));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-questionnaire-title"
      className="fixed inset-0 z-[60] overflow-y-auto bg-background/98 px-3 py-4 supports-[backdrop-filter]:bg-background/92 supports-[backdrop-filter]:backdrop-blur sm:px-5"
    >
      <div className="mx-auto flex min-h-full w-full max-w-5xl items-center">
        <Card className="my-auto w-full border-border/70 bg-card/95 shadow-2xl">
          <CardHeader className="gap-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <Badge variant="outline" className="w-fit">Una sola vez</Badge>
                <CardTitle id="profile-questionnaire-title" className="text-2xl sm:text-3xl">Cuestionario del escalador</CardTitle>
                <CardDescription className="max-w-2xl">
                  Completa un paso por vez. La mayoria son botones o contadores para que el perfil sea facil de cuantificar.
                </CardDescription>
              </div>
              <div className="flex items-start gap-2">
                <ThemeToggle theme={theme} onToggle={onThemeToggle} compact />
                <div className="rounded-lg border border-border/70 bg-background/55 p-3 text-sm lg:w-56">
                  <p className="font-semibold">Paso {stepIndex + 1}/{QUESTIONNAIRE_SECTIONS.length}</p>
                  <Progress value={stepProgress} className="mt-2" />
                  <p className="mt-2 text-muted-foreground">{draftCompletion.answered}/{draftCompletion.total} campos cargados</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
              {QUESTIONNAIRE_SECTIONS.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    index === stepIndex
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/55 text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setStepIndex(index)}
                >
                  {index + 1}. {section.title}
                </button>
              ))}
            </div>
            <form className="space-y-5" onSubmit={submitStep}>
              {stepIndex === 0 ? (
                <section className="rounded-lg border border-border/70 bg-background/45 p-3 sm:p-4">
                  <h3 className="mb-3 font-semibold">Foto de perfil</h3>
                  <ProfilePhotoPicker file={avatarFile} currentUrl={avatarUrl} onFileChange={onAvatarFileChange} disabled={avatarSaving} />
                </section>
              ) : null}
              {avatarError ? <p role="alert" className="text-sm text-destructive">{avatarError}</p> : null}
              <section className="rounded-lg border border-border/70 bg-background/45 p-3 sm:p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">{currentSection.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{currentSection.description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {currentSection.fields.map((field) => (
                    <QuestionnaireFieldControl
                      key={field.name}
                      field={field}
                      profile={draft}
                      value={draft[field.name]}
                      onValueChange={updateDraft}
                    />
                  ))}
                </div>
              </section>
              <div className="flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={avatarSaving} onClick={onSkip}>
                  Completar mas tarde
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                >
                  <ChevronLeft className="size-4" />
                  Atras
                </Button>
                <Button type="submit" disabled={avatarSaving}>
                  {isLastStep ? <Save className="size-4" /> : <ChevronRight className="size-4" />}
                  {avatarSaving ? "Guardando foto…" : isLastStep ? "Guardar cuestionario" : "Siguiente"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SessionSelect({ value, onChange, id, name = "sessionId", ariaLabel = "Sesion del plan" }) {
  return (
    <Select name={name} value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={ariaLabel} className="h-10 w-full sm:h-8">
        <SelectValue placeholder="Elegir sesion" />
      </SelectTrigger>
      <SelectContent>
        {plan.map((session) => (
          <SelectItem key={session.id} value={session.id}>
            {session.title.replace("Escalada ", "")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ReferenceTile({ reference }) {
  return (
    <a
      className="group grid gap-2 rounded-lg border border-border/70 bg-background/60 p-2 transition hover:border-primary/60 hover:bg-primary/5"
      href={reference.url}
      target={reference.url.startsWith("#") ? undefined : "_blank"}
      rel={reference.url.startsWith("#") ? undefined : "noreferrer"}
    >
      <div className="aspect-video overflow-hidden rounded-md bg-muted">
        <img
          src={reference.image}
          alt={reference.label}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{reference.label}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {reference.source}
          <ExternalLink className="size-3" />
        </p>
      </div>
    </a>
  );
}

function ThemeToggle({ theme, onToggle, compact = false }) {
  const isLight = theme === "light";
  const Icon = isLight ? Sun : Moon;
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "sm"}
      role="switch"
      aria-label="Modo claro"
      aria-checked={isLight}
      title={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      className={cn(
        "shrink-0 border-border/80 bg-background/70 transition hover:bg-muted",
        compact ? "size-10" : "w-full justify-start"
      )}
      onClick={onToggle}
    >
      <Icon className="size-4" />
      {compact ? null : <span>{isLight ? "Modo claro" : "Modo oscuro"}</span>}
    </Button>
  );
}

function TrainingSidebar({
  activeTab,
  setActiveTab,
  selectedDate,
  onDateSelect,
  metrics,
  nextSession,
  weeklyStats,
  activeWeek,
  setActiveWeek,
  risk,
  goals,
  profile,
  avatarUrl,
  theme,
  onThemeToggle,
  accountEmail,
  onSignOut,
  authError,
  signingOut
}) {
  const { setOpenMobile } = useSidebar();
  const athleteName = profile.name || "Escalador";
  const initials = athleteName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "E";

  function goToTab(value) {
    setActiveTab(value);
    setOpenMobile(false);
  }

  function showWeek(week) {
    setActiveWeek(String(week));
    setActiveTab("plan");
    setOpenMobile(false);
  }

  function pickDate(date) {
    onDateSelect(date);
    if (date) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="min-h-16 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <SidebarMenu className="min-w-0 flex-1">
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1">
                <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label={`Abrir perfil de ${athleteName}`} onClick={() => goToTab("profile")}>
                  <Avatar className="size-9">
                    <AvatarImage src={avatarUrl || undefined} alt={`Foto de ${athleteName}`} />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{athleteName}</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">{goals.currentGrade} → {goals.targetGrade}</span>
                </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Menu del bloque de escalada"
                    title="Menu del bloque de escalada"
                    className="ml-auto size-8 shrink-0 data-[state=open]:bg-sidebar-accent"
                  >
                    <Dumbbell className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-60">
                  <DropdownMenuLabel>Bloque actual</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => goToTab("plan")}>{goals.project}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => goToTab("video")}>{goals.focus}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 md:hidden"
            aria-label="Cerrar menu"
            onClick={() => setOpenMobile(false)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="md:hidden">
          <SidebarGroupLabel>Plan rapido</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid gap-2 px-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-start"
                onClick={() => pickDate(new Date(`${nextSession.date}T12:00:00`))}
              >
                <Timer className="size-4" />
                Proxima sesion
              </Button>
              <div className="grid grid-cols-4 gap-2">
                {weeklyStats.map((week) => (
                  <Button
                    key={week.week}
                    type="button"
                    size="sm"
                    className="min-h-11"
                    variant={activeWeek === String(week.week) ? "default" : "outline"}
                    onClick={() => showWeek(week.week)}
                  >
                    S{week.week}
                  </Button>
                ))}
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="md:hidden" />

        <SidebarGroup className="hidden md:block">
          <SidebarGroupLabel>Navegacion</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryTabs.map(({ value, label, icon: Icon }) => (
                <SidebarMenuItem key={value}>
                  <SidebarMenuButton
                    type="button"
                    isActive={activeTab === value}
                    aria-current={activeTab === value ? "page" : undefined}
                    tooltip={label}
                    className="min-h-11 md:min-h-8"
                    onClick={() => goToTab(value)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup className="hidden md:block group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Calendario</SidebarGroupLabel>
          <SidebarGroupContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              startMonth={new Date(`${plan[0].date}T12:00:00`)}
              endMonth={new Date(`${plan[plan.length - 1].date}T12:00:00`)}
              onSelect={pickDate}
              captionLayout="dropdown"
              locale={es}
              className="bg-transparent p-0 [--cell-size:1.95rem]"
            />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        <SidebarGroup className="hidden md:block group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Semanas</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid grid-cols-4 gap-1 px-2">
              {weeklyStats.map((week) => (
                <Button
                  key={week.week}
                  type="button"
                  size="xs"
                  variant={activeWeek === String(week.week) ? "default" : "outline"}
                  onClick={() => showWeek(week.week)}
                >
                  S{week.week}
                </Button>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="mx-2 mb-2 hidden space-y-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-sm md:block group-data-[collapsible=icon]:hidden">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <Separator />
          <div className="flex items-center justify-between gap-2">
            <span className="text-sidebar-foreground/70">Sesiones</span>
            <Badge variant="outline">{metrics.completed}/28</Badge>
          </div>
          <Progress value={(metrics.completed / 28) * 100} />
          <div className="grid grid-cols-2 gap-2 text-xs text-sidebar-foreground/70">
            <span>Link {metrics.bestLink}</span>
            <span>RPE {metrics.avgRpe.toFixed(1)}</span>
          </div>
          <Separator />
          <div>
            <p className="font-medium text-sidebar-foreground">Proxima</p>
            <p className="mt-1 text-xs text-sidebar-foreground/70">{compactDate(nextSession.date)} · {nextSession.title.replace("Escalada ", "")}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "w-full justify-center",
              risk.level === "rojo" && "border-red-500/40 text-red-700 dark:text-red-200",
              risk.level === "ambar" && "border-amber-500/40 text-amber-700 dark:text-amber-100",
              risk.level === "verde" && "border-emerald-500/40 text-emerald-700 dark:text-emerald-100"
            )}
          >
            {risk.title}
          </Badge>
          <Separator />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{accountEmail || "Cuenta Supabase"}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2 w-full justify-start" onClick={onSignOut} disabled={signingOut}>
              <LogOut className="size-4" />
              {signingOut ? "Cerrando…" : "Cerrar sesión"}
            </Button>
            {authError ? <p role="alert" className="mt-2 text-xs text-destructive">{authError}</p> : null}
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export default function App({
  authUser = { id: "test-user", email: null },
  onSignOut = async () => undefined,
  authError = null,
  signingOut = false,
  cloudRepository = null,
  cloudImport = null,
  loadLegacyVideoBlob = getVideo,
  uploadLegacyVideo = null,
  cloudAvatarClient = null,
  cloudVerified = false,
  cloudHydration = null
}) {
  const [initialUserLoad] = useState(() => {
    const loaded = loadUserData(localStorage, {
      now: () => new Date().toISOString(),
      makeId,
      normalizeLegacyTracker: normalizeState,
      guidedDefinitions: guidedSessionDefinitions
    });
    const canonical = cloudVerified
      ? migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: emptyGuidedSessionState(), now: new Date().toISOString(), makeId })
      : loaded.envelope;
    let envelope = activateAuthenticatedUser(canonical, authUser, { now: new Date().toISOString(), makeId });
    let warning = loaded.warning;
    if (loaded.canPersist && !cloudVerified) {
      const saved = saveUserData(localStorage, envelope);
      if (saved.ok === false) warning = `No pudimos guardar los datos locales: ${saved.error}`;
    }
    if (cloudHydration) {
      const active = envelope.users[envelope.activeUserId];
      const facts = (cloudHydration.facts || []).map((fact) => ({
        id: fact.id,
        userId: active.identity.id,
        category: fact.source?.category || "preference",
        key: fact.fact_key || fact.key,
        value: fact.value,
        unit: fact.source?.unit || null,
        recordedAt: fact.created_at || fact.recordedAt,
        source: fact.source || { type: "import", field: fact.fact_key || fact.key, version: 1 },
        supersedes: fact.supersedes_id || fact.supersedes || null
      }));
      const sessionLogs = (cloudHydration.sessionLogs || []).map((log) => ({
        id: log.id,
        sessionId: log.metrics?.sessionId || log.session_id || "w1d1",
        createdAt: log.created_at || log.createdAt,
        notes: log.body || log.metrics?.notes || "",
        ...log.metrics,
        rpe: log.rpe ?? log.metrics?.rpe ?? 0,
        pump: log.pump ?? log.metrics?.pump ?? 0,
        pain: log.pain ?? log.metrics?.pain ?? 0,
        energy: log.energy ?? log.metrics?.energy ?? 0
      }));
      envelope = { ...envelope, users: { ...envelope.users, [envelope.activeUserId]: {
        ...active, facts, sessionLogs,
        guidedSessions: cloudHydration.guided?.schemaVersion === 1 ? cloudHydration.guided : emptyGuidedSessionState()
      } } };
    }
    return { ...loaded, envelope, recoveryEnvelope: loaded.envelope, warning };
  });
  const [userData, setUserData] = useState(initialUserLoad.envelope);
  const [userDataWarning, setUserDataWarning] = useState(initialUserLoad.warning);
  const userDataRef = useRef(userData);
  userDataRef.current = userData;
  const activeUser = userData.users[userData.activeUserId];
  const state = useMemo(() => projectTrackerState(activeUser), [activeUser]);
  const [theme, setTheme] = useState(loadTheme);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeWeek, setActiveWeek] = useState("all");
  const [selectedSessionId, setSelectedSessionId] = useState("w1d1");
  const [guidedSessionOpen, setGuidedSessionOpen] = useState(false);
  const [logForm, setLogForm] = useState(defaultLogValues);
  const [logError, setLogError] = useState("");
  const [savedRecommendation, setSavedRecommendation] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoMeta, setVideoMeta] = useState(null);
  const [pendingVideoId, setPendingVideoId] = useState(null);
  const [videoValues, setVideoValues] = useState(defaultVideoValues);
  const [videoNotes, setVideoNotes] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [questionnaireOpen, setQuestionnaireOpen] = useState(() => !state.profile.questionnaireCompleted);
  const [importStatus, setImportStatus] = useState(() => cloudImport && initialUserLoad.hasRecoveryEnvelope ? "pending" : "idle");
  const [questionnaireCloudStatus, setQuestionnaireCloudStatus] = useState("idle");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSaving, setAvatarSaving] = useState(false);
  const pendingQuestionnaire = useRef(null);
  const pendingFacts = useRef([]);
  const pendingLog = useRef(null);
  const pendingGuided = useRef(null);
  const [videoStatus, setVideoStatus] = useState({
    tone: "muted",
    title: "Listo para analizar",
    body: "Sube un clip MP4, MOV o WebM. Conservamos una copia local hasta verificar la carga privada."
  });
  const detailRef = useRef(null);
  const videoRef = useRef(null);
  const skipInitialUserSave = useRef(true);

  useEffect(() => {
    const pending = activeUser.videoAnalyses.find((video) => video.cloud && video.cloud.uploadStatus !== "uploaded");
    if (!pending || pendingVideoId || videoFile) return;
    const recover = async () => {
      if (cloudVideoClient) {
        const service = createCloudVideoService(cloudVideoClient);
        const recovered = await reconcileUploadedVideoRecovery(pending, {
          reconciledUpload: service.reconciledUpload,
          appendAnalysis: service.appendAnalysis,
          persistUploaded: (videoId, path) => persistActiveUser((current) => ({ ...current, videoAnalyses: current.videoAnalyses.map((video) => video.id === videoId ? { ...video, cloud: { id: video.cloud?.id || videoId, path, uploadStatus: "uploaded" } } : video) })),
          deleteBlob: deleteVideoBlob
        }).catch(() => false);
        if (recovered) return;
      }
      const blob = await getVideo(pending.id);
      if (!blob) return;
      const file = blob instanceof File ? blob : new File([blob], pending.fileName, { type: `video/${pending.fileName.split(".").pop()}` });
      setVideoFile(file);
      setVideoMeta({ name: pending.fileName, size: pending.size, duration: pending.duration });
      setPendingVideoId(pending.id);
      setSelectedSessionId(pending.sessionId);
      setVideoUrl(URL.createObjectURL(file));
      setVideoStatus({ tone: "error", title: "Carga pendiente", body: "Recuperamos tu video local. Puedes reintentar la carga privada." });
    };
    recover().catch(() => undefined);
  }, [activeUser.videoAnalyses, pendingVideoId, videoFile]);

  useEffect(() => {
    if (skipInitialUserSave.current) {
      skipInitialUserSave.current = false;
      return;
    }
    if (!initialUserLoad.canPersist || cloudVerified) return;
    const result = saveUserData(localStorage, userData);
    if (!result.ok) setUserDataWarning(`No pudimos guardar los datos locales: ${result.error}`);
  }, [initialUserLoad.canPersist, userData]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const path = cloudHydration?.profile?.avatarPath;
    if (!cloudAvatarClient || !path) return;
    let current = true;
    void createAvatarSignedUrl(cloudAvatarClient, path).then((url) => {
      if (current) setAvatarUrl(url);
    }).catch(() => undefined);
    return () => { current = false; };
  }, [cloudAvatarClient, cloudHydration?.profile?.avatarPath]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const logsBySession = useMemo(() => {
    const map = new Map();
    state.logs.forEach((log) => {
      const list = map.get(log.sessionId) || [];
      list.push(log);
      map.set(log.sessionId, list);
    });
    return map;
  }, [state.logs]);

  const selectedSession = sessionById(selectedSessionId);
  const selectedExercises = getSessionExercises(selectedSession);
  const completedSessionIds = useMemo(() => new Set(state.logs.map((log) => log.sessionId)), [state.logs]);
  const guidedSnapshot = activeUser.guidedSessions;
  const activeGuidedRun = guidedSnapshot.activeRun;
  const guidedCompletedSessionIds = new Set(
    [...guidedSnapshot.history, ...(activeGuidedRun ? [activeGuidedRun] : [])]
      .filter((run) => run.status === "completed")
      .map((run) => run.sessionId)
  );
  const selectedGuidedDefinition = guidedSessionDefinitions[selectedSessionId];
  const selectedGuidedRun = activeGuidedRun?.sessionId === selectedSessionId && activeGuidedRun.status !== "completed" ? activeGuidedRun : null;
  const guidedActionLabel = selectedGuidedRun
    ? `Continuar sesión · Bloque ${selectedGuidedRun.currentBlockIndex + 1} de ${selectedGuidedDefinition?.blocks.length || 0}`
    : "Iniciar sesión";
  const nextSession = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    return (
      plan.find((session) => !completedSessionIds.has(session.id) && session.date >= todayISO) ||
      plan.find((session) => !completedSessionIds.has(session.id)) ||
      plan[plan.length - 1]
    );
  }, [completedSessionIds]);

  const metrics = useMemo(() => {
    const completed = completedSessionIds.size;
    const bestLink = Math.max(0, ...state.logs.map((log) => Number(log.bestLink || 0)));
    const avgRpe = average(state.logs.map((log) => log.rpe));
    const avgPain = average(state.logs.map((log) => log.pain));
    return { completed, bestLink, avgRpe, avgPain, totalLogs: state.logs.length };
  }, [completedSessionIds, state.logs]);

  const completionPercent = Math.round((metrics.completed / plan.length) * 100);
  const remainingSessions = Math.max(0, plan.length - metrics.completed);
  const latestLoggedSessions = useMemo(() => {
    const seen = new Set();
    return [...state.logs]
      .reverse()
      .filter((log) => {
        if (seen.has(log.sessionId)) return false;
        seen.add(log.sessionId);
        return true;
      })
      .slice(0, 4)
      .map((log) => ({ log, session: sessionById(log.sessionId) }));
  }, [state.logs]);

  const weeklyStats = useMemo(() => {
    return [1, 2, 3, 4].map((week) => {
      const weekIds = plan.filter((session) => session.week === week).map((session) => session.id);
      const logs = state.logs.filter((log) => weekIds.includes(log.sessionId));
      return {
        week,
        sessions: new Set(logs.map((log) => log.sessionId)).size,
        best: Math.max(0, ...logs.map((log) => Number(log.bestLink || 0))),
        rpe: average(logs.map((log) => log.rpe)),
        pain: average(logs.map((log) => log.pain)),
        moves: logs.reduce((sum, log) => sum + Number(log.moves || 0), 0),
        attempts: logs.reduce((sum, log) => sum + Number(log.attempts || 0), 0)
      };
    });
  }, [state.logs]);

  const currentWeekStats = weeklyStats.find((week) => week.week === nextSession.week) || weeklyStats[0];
  const recentStats = useMemo(() => {
    const recent = state.logs.slice(-4);
    return {
      rpe: average(recent.map((log) => log.rpe)),
      pain: average(recent.map((log) => log.pain)),
      sleep: average(recent.map((log) => log.sleep)),
      energy: average(recent.map((log) => log.energy))
    };
  }, [state.logs]);

  const recentPain = useMemo(() => average(state.logs.slice(-4).map((log) => log.pain)), [state.logs]);
  const risk = useMemo(() => {
    const recent = state.logs.slice(-4);
    if (!recent.length) {
      return {
        level: "neutral",
        title: "Sin datos todavia",
        body: "Registra una sesion para calcular tendencia de carga, dolor, RPE y sueno."
      };
    }
    const pain = average(recent.map((log) => log.pain));
    const rpe = average(recent.map((log) => log.rpe));
    const sleep = average(recent.map((log) => log.sleep));
    if (pain > 2 || rpe >= 9 || sleep < 5.5) {
      return {
        level: "rojo",
        title: "Bajar carga",
        body: "Dolor, RPE o sueno indican riesgo. Cambia el proximo dia duro por movilidad, bandas y tecnica facil."
      };
    }
    if (pain > 1 || rpe >= 8.3 || sleep < 6.5) {
      return {
        level: "ambar",
        title: "Vigilar fatiga",
        body: "Mantene intensidad, pero recorta volumen si la velocidad baja o aparece dolor de dedos/codo."
      };
    }
    return {
      level: "verde",
      title: "Carga tolerable",
      body: "La tendencia permite seguir el bloque. Mantene descansos largos en sesiones limite."
    };
  }, [state.logs]);

  const latestVideoAdvice = useMemo(
    () => buildAdvice(videoValues, recentPain),
    [videoValues, recentPain]
  );
  const canShowVideoAdvice = Boolean(videoFile && videoMeta);
  const selectedDate = useMemo(() => new Date(`${selectedSession.date}T12:00:00`), [selectedSession.date]);
  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.value === activeTab) || tabs[0],
    [activeTab]
  );
  const questionnaireProfile = useMemo(
    () => ({ ...state.profile, project: state.goals.project, focus: state.goals.focus }),
    [state.profile, state.goals.project, state.goals.focus]
  );
  const questionnaireCompletion = useMemo(
    () => calculateQuestionnaireCompletion(questionnaireProfile),
    [questionnaireProfile]
  );

  const exportSnapshot = useMemo(() => {
    const exportedAt = new Date().toISOString();
    return {
      json: buildUserDataExport(userData, exportedAt),
      filename: userDataExportFilename(userData, exportedAt)
    };
  }, [userData]);
  const exportJson = exportSnapshot.json;

  const guidedStorage = useMemo(() => createUserGuidedStorage({
    storage: localStorage,
    getGuidedSessions: () => {
      const current = userDataRef.current;
      return current.users[current.activeUserId].guidedSessions;
    },
    replaceGuidedSessions: (guidedSessions) => {
      const persisted = persistActiveUser((user) => ({
        ...user,
        identity: { ...user.identity, updatedAt: new Date().toISOString() },
        guidedSessions
      }));
      if (persisted) void saveGuidedToCloud(guidedSessions);
    }
  }), []);

  function updateActiveUser(update) {
    setUserData((current) => {
      const userId = current.activeUserId;
      const previous = current.users[userId];
      const nextUser = update(previous);
      if (nextUser === previous) return current;
      const next = { ...current, users: { ...current.users, [userId]: nextUser } };
      userDataRef.current = next;
      return next;
    });
  }

  function persistActiveUser(update) {
    const current = userDataRef.current;
    const userId = current.activeUserId;
    const nextUser = update(current.users[userId]);
    const next = nextUser === current.users[userId] ? current : { ...current, users: { ...current.users, [userId]: nextUser } };
    const result = persistRecoveryBeforeCloudEffect(localStorage, next);
    if (!result.ok) {
      setUserDataWarning(`No pudimos guardar los datos locales: ${result.error}`);
      return false;
    }
    userDataRef.current = next;
    setUserData(next);
    return true;
  }

  async function importLocalRecovery() {
    if (!cloudImport || importStatus === "importing") return;
    setImportStatus("importing");
    try {
      let receipt = await cloudImport.import(initialUserLoad.recoveryEnvelope);
      if (receipt.status === "metadata_imported" && receipt.pendingVideoIds.length) {
        const upload = uploadLegacyVideo ?? (cloudVideoClient ? createCloudVideoService(cloudVideoClient).upload : null);
        if (!upload) throw { code: "legacy_video_unavailable" };
        const user = initialUserLoad.recoveryEnvelope.users[initialUserLoad.recoveryEnvelope.activeUserId];
        const completedVideoIds = await stageLegacyImportVideos({
          pendingVideoIds: receipt.pendingVideoIds,
          videos: user.videoAnalyses,
          loadBlob: loadLegacyVideoBlob,
          upload
        });
        receipt = await cloudImport.import(initialUserLoad.recoveryEnvelope, completedVideoIds);
      }
      // Metadata import is deliberately not treated as completion: local video
      // recovery must remain visible until the server receipt is complete.
      setImportStatus(receipt.status === "completed" ? "completed" : "videos_pending");
    } catch {
      setImportStatus("failed");
    }
  }

  async function submitQuestionnaireToCloud(submission) {
    if (!cloudRepository || !submission) return;
    setQuestionnaireCloudStatus("saving");
    try {
      await cloudRepository.submitQuestionnaire(submission);
      pendingQuestionnaire.current = null;
      setQuestionnaireCloudStatus("saved");
    } catch {
      setQuestionnaireCloudStatus("failed");
    }
  }

  async function appendFactsToCloud(facts) {
    if (!cloudRepository || !facts.length) return;
    pendingFacts.current = facts;
    try {
      await cloudRepository.appendFacts(facts);
      pendingFacts.current = [];
    } catch {
      setUserDataWarning("No pudimos sincronizar tu perfil. Tus cambios quedan guardados para reintentar.");
    }
  }

  async function saveAvatar() {
    if (!avatarFile) return true;
    if (!cloudAvatarClient || !cloudRepository) {
      setAvatarError("No pudimos guardar tu foto de perfil. Intentá nuevamente.");
      return false;
    }
    setAvatarSaving(true);
    setAvatarError("");
    try {
      const path = await uploadAvatar(cloudAvatarClient, authUser.id, avatarFile);
      await cloudRepository.saveAvatarPath(path);
      setAvatarUrl(await createAvatarSignedUrl(cloudAvatarClient, path));
      setAvatarFile(null);
      return true;
    } catch {
      setAvatarError("No pudimos guardar tu foto de perfil. Intentá nuevamente.");
      return false;
    } finally {
      setAvatarSaving(false);
    }
  }

  async function saveGuidedToCloud(state) {
    if (!cloudRepository) return;
    const pending = pendingGuided.current || { state, idempotencyKey: makeId() };
    pendingGuided.current = pending;
    try {
      await cloudRepository.saveGuidedState(pending.state, pending.idempotencyKey);
      pendingGuided.current = null;
    } catch {
      setUserDataWarning("No pudimos sincronizar la sesión guiada. Tu progreso queda guardado para reintentar.");
    }
  }

  function handleCalendarDate(date) {
    if (!date) return;
    const isoDate = toIsoDate(date);
    const session = plan.find((item) => item.date === isoDate);
    if (!session) return;
    setActiveWeek(String(session.week));
    selectSession(session.id, true);
    setActiveTab("plan");
  }

  function saveProfile(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name, fallback = "") => {
      const value = form.get(name);
      return value === null ? fallback : String(value);
    };
    const now = new Date().toISOString();
    const values = {
      currentGrade: field("currentGrade", state.goals.currentGrade),
      targetGrade: field("targetGrade", state.goals.targetGrade),
      project: field("project", state.goals.project),
      focus: field("focus", state.goals.focus),
      ...Object.fromEntries(profileFields.map((name) => [name, field(name, state.profile[name])]))
    };
    let appended = [];
    updateActiveUser((current) => {
      const next = appendChangedFacts(current, values, { type: "profile-form", version: 1 }, now, makeId);
      appended = next.facts.slice(current.facts.length);
      return {
        ...next,
        identity: { ...next.identity, displayName: values.name || "Usuario local", updatedAt: now }
      };
    });
    void appendFactsToCloud(appended);
  }

  async function saveQuestionnaire(payload) {
    if (payload?.preventDefault) payload.preventDefault();
    const form = payload instanceof FormData ? payload : new FormData(payload.currentTarget);
    if (!(await saveAvatar())) return;
    const now = new Date().toISOString();
    const nextProfile = buildProfileFromQuestionnaireForm(form, questionnaireProfile);
    const values = {
      ...nextProfile,
      project: String(nextProfile.project || state.goals.project),
      focus: String(nextProfile.focus || state.goals.focus),
      questionnaireCompleted: true,
      questionnaireCompletedAt: now,
      questionnaireVersion: QUESTIONNAIRE_VERSION
    };
    const recoveryPersisted = persistActiveUser((current) => {
      const next = appendChangedFacts(current, values, { type: "questionnaire", version: QUESTIONNAIRE_VERSION }, now, makeId);
      void appendFactsToCloud(next.facts.slice(current.facts.length));
      return { ...next, identity: { ...next.identity, displayName: values.name || "Usuario local", updatedAt: now } };
    });
    if (!recoveryPersisted) return;
    setQuestionnaireOpen(false);
    if (cloudRepository) {
      const submission = {
        version: QUESTIONNAIRE_VERSION,
        answers: values,
        idempotencyKey: makeId()
      };
      pendingQuestionnaire.current = submission;
      void submitQuestionnaireToCloud(submission);
    }
  }

  async function skipQuestionnaire() {
    if (!(await saveAvatar())) return;
    const now = new Date().toISOString();
    const values = {
      questionnaireCompleted: true,
      questionnaireCompletedAt: now,
      questionnaireVersion: QUESTIONNAIRE_VERSION
    };
    const recoveryPersisted = persistActiveUser((current) => {
      const next = appendChangedFacts(current, values, { type: "questionnaire", version: QUESTIONNAIRE_VERSION }, now, makeId);
      void appendFactsToCloud(next.facts.slice(current.facts.length));
      return next;
    });
    if (!recoveryPersisted) return;
    setQuestionnaireOpen(false);
    if (cloudRepository) {
      const submission = { version: QUESTIONNAIRE_VERSION, answers: values, idempotencyKey: makeId() };
      pendingQuestionnaire.current = submission;
      void submitQuestionnaireToCloud(submission);
    }
  }

  function selectSession(sessionId, scroll = false) {
    setSelectedSessionId(sessionId);
    if (scroll && window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    }
  }

  function selectPlanWeek(week) {
    setActiveWeek(week);
    if (week === "all") return;
    const firstSession = plan.find((session) => String(session.week) === week);
    if (firstSession) selectSession(firstSession.id, true);
  }

  function loadLogForSession(sessionId) {
    setSavedRecommendation(null);
    const latest = (logsBySession.get(sessionId) || []).at(-1);
    if (!latest) {
      setLogForm(defaultLogValues);
      return;
    }
    setLogForm({
      ...defaultLogValues,
      ...Object.fromEntries(logNumberFields.map((field) => [field, String(latest[field] ?? defaultLogValues[field])])),
      notes: latest.notes || ""
    });
  }

  function handleLogSessionChange(sessionId) {
    selectSession(sessionId);
    loadLogForSession(sessionId);
  }

  function handleLogChange(field, value) {
    setLogForm((current) => ({ ...current, [field]: value }));
  }

  function submitLog(event) {
    event.preventDefault();
    const values = {};
    for (const field of logNumberFields) {
      const limit = logNumberLimits[field];
      const numeric = Number(logForm[field]);
      if (!Number.isFinite(numeric) || numeric < limit.min || numeric > limit.max) {
        setLogError(`${limit.label}: usa un valor entre ${limit.min} y ${limit.max}.`);
        return;
      }
      values[field] = numeric;
    }
    const log = {
      id: makeId(),
      sessionId: selectedSessionId,
      createdAt: new Date().toISOString(),
      notes: logForm.notes,
      ...values
    };
    if (!persistActiveUser((current) => ({ ...current, sessionLogs: [...current.sessionLogs, log] }))) return;
    if (cloudRepository) {
      const submission = { idempotencyKey: log.id, sessionId: selectedSessionId, metrics: { ...values, notes: log.notes } };
      pendingLog.current = submission;
      void cloudRepository.appendSessionLog(submission).then(() => { pendingLog.current = null; }).catch(() => {
        setUserDataWarning("No pudimos sincronizar el log. Queda guardado para reintentar.");
      });
    }
    updateActiveUser((current) => ({ ...current, sessionLogs: [...current.sessionLogs, log] }));
    setSavedRecommendation({
      log,
      session: selectedSession,
      assessment: buildSessionRecommendation(log, selectedSession)
    });
    setLogForm(defaultLogValues);
    setLogError("");
  }

  function clearLogForm() {
    setLogForm(defaultLogValues);
    setLogError("");
    setSavedRecommendation(null);
  }

  function handleVideoFile(event) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) {
      setVideoFile(null);
      setVideoMeta(null);
      setVideoStatus({
        tone: "error",
        title: "Archivo invalido",
        body: "Selecciona un archivo de video compatible."
      });
      return;
    }
    if (pendingVideoId) {
      deleteVideoBlob(pendingVideoId).catch(() => undefined);
      updateActiveUser((current) => ({ ...current, videoAnalyses: current.videoAnalyses.filter((video) => video.id !== pendingVideoId) }));
      setPendingVideoId(null);
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setVideoMeta({ name: file.name, size: file.size, duration: 0 });
    setVideoStatus({
      tone: "ready",
      title: "Video cargado",
      body: "Marca la severidad de cada punto tecnico y guarda el analisis."
    });
  }

  function handleVideoMetadata() {
    if (!videoFile || !videoRef.current) return;
    setVideoMeta({
      name: videoFile.name,
      size: videoFile.size,
      duration: videoRef.current.duration || 0
    });
  }

  async function saveVideoAnalysis(event) {
    event.preventDefault();
    if (!videoFile || !videoMeta) {
      setVideoStatus({
        tone: "error",
        title: "Falta video",
        body: "Sube un video valido antes de guardar."
      });
      return;
    }
    const id = pendingVideoId || makeId();
    const advice = buildAdvice(videoValues, recentPain);
    try {
      await putVideo(id, videoFile);
    } catch {
      setVideoStatus({
        tone: "error",
        title: "No se pudo guardar",
        body: "El navegador no permitio guardar el archivo localmente. Intenta de nuevo."
      });
      return;
    }
    const recoveryPersisted = persistActiveUser((current) => current.videoAnalyses.some((video) => video.id === id) ? current : ({
      ...current,
      videoAnalyses: [...current.videoAnalyses, {
        id,
        createdAt: new Date().toISOString(),
        sessionId: selectedSessionId,
        fileName: videoMeta.name,
        duration: videoMeta.duration,
        size: videoMeta.size,
        notes: videoNotes,
        ...videoValues,
        advice,
        cloud: { id, path: videoPath(authUser.id, id, videoMeta.name), uploadStatus: "pending" }
      }]
    }));
    if (!recoveryPersisted) {
      setVideoStatus({ tone: "error", title: "No se pudo guardar", body: "No confirmamos la recuperación local, así que no iniciamos ninguna carga privada." });
      return;
    }
    setPendingVideoId(id);
    if (!cloudVideoClient) {
      setVideoStatus({ tone: "error", title: "Carga pendiente", body: "No hay conexión privada configurada. El archivo queda guardado localmente para recuperar o reintentar." });
      return;
    }
    try {
      const service = createCloudVideoService(cloudVideoClient);
      const uploaded = await service.upload(videoFile, { videoId: id, durationSeconds: videoMeta.duration });
      if (!persistActiveUser((current) => ({ ...current, videoAnalyses: current.videoAnalyses.map((video) => video.id === id ? { ...video, cloud: { id, path: uploaded.path, uploadStatus: "analysis_pending" } } : video) }))) {
        setVideoStatus({ tone: "error", title: "Carga pendiente", body: "El video privado se cargó, pero conservamos la recuperación local hasta guardar el estado del análisis." });
        return;
      }
      await service.appendAnalysis(id, {
        status: "completed",
        metrics: { session_id: selectedSessionId, notes: videoNotes, foot_cuts: videoValues.footCuts, swing: videoValues.swing, hips: videoValues.hips, shoulder: videoValues.shoulder, breath: videoValues.breath, reading: videoValues.reading },
        advice: { recommendations: advice }
      });
      if (!persistActiveUser((current) => ({ ...current, videoAnalyses: current.videoAnalyses.map((video) => video.id === id ? { ...video, cloud: { id, path: uploaded.path, uploadStatus: "uploaded" } } : video) }))) {
        setVideoStatus({ tone: "error", title: "Carga pendiente", body: "El análisis terminó, pero conservamos la recuperación local hasta guardar su confirmación." });
        return;
      }
      await deleteVideoBlob(id);
      setPendingVideoId(null);
      setVideoStatus({ tone: "ready", title: "Analisis guardado", body: "El video se guardó en tu archivo privado. La copia local temporal ya se eliminó." });
    } catch (error) {
      const uploadStatus = error?.code === "upload_pending" ? "pending" : "analysis_pending";
      persistActiveUser((current) => ({ ...current, videoAnalyses: current.videoAnalyses.map((video) => video.id === id ? { ...video, cloud: { ...(video.cloud || { id, path: videoPath(authUser.id, id, videoMeta.name) }), uploadStatus } } : video) }));
      setVideoStatus({ tone: "error", title: "Carga pendiente", body: "El análisis y el archivo siguen guardados localmente. Puedes volver a intentar sin perder el video." });
    }
  }

  async function openSavedVideo(id) {
    const blob = await getVideo(id);
    if (blob) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(blob));
      setVideoFile(null);
      setActiveTab("video");
      setVideoStatus({ tone: "ready", title: "Video abierto", body: "Revisa el clip desde el reproductor." });
      return;
    }
    const saved = activeUser.videoAnalyses.find((video) => video.id === id);
    if (!cloudVideoClient || !saved) {
      setVideoStatus({ tone: "error", title: "Video no encontrado", body: "No pudimos recuperar el archivo privado." });
      return;
    }
    try {
      const signedUrl = await createCloudVideoService(cloudVideoClient).playbackUrl(saved.cloud?.id || id);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(signedUrl);
      setVideoFile(null);
      setActiveTab("video");
      setVideoStatus({ tone: "ready", title: "Video abierto", body: "Revisa el clip desde un enlace privado temporal." });
    } catch {
      setVideoStatus({ tone: "error", title: "Video no encontrado", body: "No pudimos recuperar el archivo privado." });
    }
  }

  async function removeVideo(id) {
    await deleteVideoBlob(id);
    updateActiveUser((current) => ({ ...current, videoAnalyses: current.videoAnalyses.filter((video) => video.id !== id) }));
  }

  function downloadJson() {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportSnapshot.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function resetData() {
    try {
      await deleteVideoBlobs(activeUser.videoAnalyses.map((video) => video.id));
    } catch {
      setUserDataWarning("No pudimos borrar los videos locales. Tus datos no se modificaron.");
      return;
    }
    const now = new Date().toISOString();
    const next = resetAuthenticatedUser(userData, authUser, { now, makeId });
    userDataRef.current = next;
    setUserData(next);
    setQuestionnaireOpen(true);
    setLogForm(defaultLogValues);
    setSavedRecommendation(null);
    setVideoFile(null);
    setVideoUrl("");
    setVideoMeta(null);
    setPendingVideoId(null);
    setVideoValues(defaultVideoValues);
    setVideoNotes("");
    setVideoStatus({
      tone: "muted",
      title: "Listo para analizar",
      body: "Sube un clip MP4, MOV o WebM. Conservamos una copia local hasta verificar la carga privada."
    });
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary),transparent_72%),transparent_32rem)] opacity-70" />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-svh w-full gap-0">
          <SidebarProvider>
            <TrainingSidebar
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              selectedDate={selectedDate}
              onDateSelect={handleCalendarDate}
              metrics={metrics}
              nextSession={nextSession}
              weeklyStats={weeklyStats}
              activeWeek={activeWeek}
              setActiveWeek={setActiveWeek}
              risk={risk}
              goals={state.goals}
              profile={state.profile}
              avatarUrl={avatarUrl}
              theme={theme}
              onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              accountEmail={authUser.email}
              onSignOut={onSignOut}
              authError={authError}
              signingOut={signingOut}
            />
            <SidebarInset className="min-w-0 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-0">
              {importStatus !== "idle" && importStatus !== "completed" ? (
                <div role={importStatus === "failed" ? "alert" : "status"} className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm md:mx-4">
                  <div>
                    <p className="font-medium">{importStatus === "failed" ? "No pudimos importar tus datos" : importStatus === "importing" ? "Importando datos locales…" : importStatus === "videos_pending" ? "Importación de videos pendiente" : "Importación pendiente"}</p>
                    <p className="text-muted-foreground">Tu copia local se conserva hasta que el recibo de la nube confirme la importación completa.</p>
                  </div>
                  {importStatus !== "importing" ? <Button type="button" variant="outline" onClick={importLocalRecovery}>{importStatus === "failed" ? "Reintentar importación" : importStatus === "videos_pending" ? "Reintentar videos" : "Importar datos locales"}</Button> : null}
                </div>
              ) : null}
              {questionnaireCloudStatus === "saving" || questionnaireCloudStatus === "failed" ? (
                <div role={questionnaireCloudStatus === "failed" ? "alert" : "status"} className="mx-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm md:mx-4">
                  <p>{questionnaireCloudStatus === "saving" ? "Guardando cuestionario en la nube…" : "No pudimos guardar el cuestionario en la nube. Tus respuestas siguen disponibles para reintentar."}</p>
                  {questionnaireCloudStatus === "failed" ? <Button type="button" variant="outline" onClick={() => void submitQuestionnaireToCloud(pendingQuestionnaire.current)}>Reintentar cuestionario</Button> : null}
                </div>
              ) : null}
              <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:h-16 md:px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-1 data-vertical:h-4 data-vertical:self-auto" />
                <Breadcrumb className="min-w-0 flex-1">
                  <BreadcrumbList className="flex-nowrap">
                    <BreadcrumbItem className="min-w-0">
                      <BreadcrumbPage className="truncate">{activeTabMeta.label}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <div className="hidden items-center gap-2 md:flex">
                  <Badge variant="outline">{metrics.completed}/28 sesiones</Badge>
                  <Badge className={intensityClass(nextSession.intensity)} variant="outline">
                    {compactDate(nextSession.date)} · {nextSession.intensity}
                  </Badge>
                </div>
                <ThemeToggle
                  theme={theme}
                  onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                  compact
                />
              </header>

              <div className="mx-auto w-full max-w-7xl px-3 py-3 sm:px-6 sm:py-4 lg:px-8 2xl:max-w-[96rem]">
        {userDataWarning ? (
          <Alert role="alert" className="mb-4 border-amber-500/40 bg-amber-500/10">
            <ShieldAlert className="size-4" />
            <AlertTitle>Revisar datos locales</AlertTitle>
            <AlertDescription>{userDataWarning}</AlertDescription>
          </Alert>
        ) : null}

        <TabsContent value="dashboard" className="mt-0">
          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <Card className="border-border/70 bg-card/90">
              <CardHeader className="gap-3 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl">Progreso del bloque</CardTitle>
                    <CardDescription>Sesiones completadas, numeros clave y avance semanal.</CardDescription>
                  </div>
                  <Badge variant="outline">{remainingSessions} sesiones restantes</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <p className="text-sm font-medium text-primary">Sesiones completadas</p>
                    <div className="mt-2 flex items-end gap-2">
                      <span className="text-6xl font-semibold leading-none tracking-normal">{metrics.completed}</span>
                      <span className="pb-1 text-2xl font-semibold text-muted-foreground">/ {plan.length}</span>
                    </div>
                    <Progress value={completionPercent} className="mt-4" />
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{completionPercent}% del bloque</span>
                      <span className="font-medium">{metrics.totalLogs} logs cargados</span>
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => {
                        selectSession(nextSession.id);
                        loadLogForSession(nextSession.id);
                        setActiveTab("log");
                      }}
                    >
                      <Save className="size-4" />
                      Registrar proxima
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border/70 bg-background/45 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Zap className="size-4 text-primary" />
                        Mejor link
                      </div>
                      <p className="mt-3 text-4xl font-semibold">{metrics.bestLink}</p>
                      <p className="mt-1 text-xs text-muted-foreground">movimientos continuos</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Activity className="size-4 text-primary" />
                        Mov. semana
                      </div>
                      <p className="mt-3 text-4xl font-semibold">{currentWeekStats.moves}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{currentWeekStats.attempts} intentos registrados</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ShieldAlert className="size-4 text-primary" />
                        Fatiga reciente
                      </div>
                      <p className="mt-3 text-4xl font-semibold">{recentStats.rpe.toFixed(1)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">dolor {recentStats.pain.toFixed(1)} · sueno {recentStats.sleep.toFixed(1)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">Avance por semana</h3>
                      <Badge variant="outline">{metrics.completed}/{plan.length}</Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      {weeklyStats.map((week) => (
                        <div key={week.week} className="rounded-lg border border-border/70 bg-background/45 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">S{week.week}</p>
                            <p className="text-sm font-semibold">{week.sessions}/7</p>
                          </div>
                          <Progress value={(week.sessions / 7) * 100} className="mt-2" />
                          <p className="mt-2 text-xs text-muted-foreground">Link {week.best} · RPE {week.rpe.toFixed(1)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
                      {plan.map((session) => {
                        const done = completedSessionIds.has(session.id);
                        return (
                          <button
                            key={session.id}
                            type="button"
                            title={`${session.title.replace("Escalada ", "")} · ${done ? "completa" : "pendiente"}`}
                            aria-label={`${session.title.replace("Escalada ", "")}: ${done ? "completa" : "pendiente"}`}
                            onClick={() => {
                              selectSession(session.id, true);
                              setActiveTab("plan");
                            }}
                            className={cn(
                              "grid aspect-square min-h-8 place-items-center rounded-md border text-[0.68rem] font-semibold transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                              done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 text-muted-foreground"
                            )}
                          >
                            {session.week}.{session.day}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">Ultimas cargadas</h3>
                      <Badge variant="outline">{latestLoggedSessions.length}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {latestLoggedSessions.length ? (
                        latestLoggedSessions.map(({ log, session }) => (
                          <button
                            key={log.id}
                            type="button"
                            onClick={() => {
                              selectSession(session.id);
                              loadLogForSession(session.id);
                              setActiveTab("log");
                            }}
                            className="w-full rounded-md border border-border/70 bg-card/60 p-2 text-left transition hover:border-primary/70"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">{session.title.replace("Escalada ", "")}</p>
                              <Badge variant="outline">RPE {log.rpe}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Link {log.bestLink} · Mov {log.moves} · Dolor {log.pain} · {compactDate(session.date)}</p>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Todavia no hay sesiones cargadas. Registra la primera para empezar a ver tendencia real.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card className="border-border/70 bg-card/90">
                <CardHeader className="gap-2 p-4 sm:p-5">
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="size-5 text-primary" />
                    Proxima sesion
                  </CardTitle>
                  <CardDescription>{dateLabel(nextSession.date)} · {nextSession.start}-{nextSession.end}</CardDescription>
                  <CardAction>
                    <Badge className={intensityClass(nextSession.intensity)} variant="outline">{nextSession.intensity}</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold">{nextSession.title.replace("Escalada ", "")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{nextSession.summary}</p>
                  </div>
                  <div className="space-y-2">
                    {nextSession.drills.slice(0, 3).map((drill) => (
                      <div key={drill} className="flex gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                        <span>{drill}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Button
                      onClick={() => {
                        selectSession(nextSession.id);
                        loadLogForSession(nextSession.id);
                        setActiveTab("log");
                      }}
                    >
                      <Save className="size-4" />
                      Cargar sesion
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        selectSession(nextSession.id, true);
                        setActiveTab("plan");
                      }}
                    >
                      <ListChecks className="size-4" />
                      Ver detalle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Alert role="status" className={cn("border-border/70 bg-card/90", risk.level === "rojo" && "border-red-500/40 bg-red-500/10", risk.level === "ambar" && "border-amber-500/40 bg-amber-500/10", risk.level === "verde" && "border-emerald-500/40 bg-emerald-500/10")}>
                <ShieldAlert className="size-4" />
                <AlertTitle>{risk.title}</AlertTitle>
                <AlertDescription>{risk.body}</AlertDescription>
              </Alert>

              <Card className="border-border/70 bg-card/90">
                <CardHeader className="gap-3 p-4 sm:p-5">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">V9 max boulder</Badge>
                    <Badge variant="outline">15 dominadas</Badge>
                    <Badge variant="outline">30 flexiones</Badge>
                  </div>
                  <div>
                    <CardTitle className="text-lg">Continuidad, pies y decisiones</CardTitle>
                    <CardDescription className="mt-1">
                      Convertir fuerza en links de 35-50 movimientos sin perder calidad tecnica.
                    </CardDescription>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Button variant="outline" onClick={() => setActiveTab("video")}>
                      <Film className="size-4" />
                      Analizar video
                    </Button>
                    <Button variant="ghost" asChild>
                      <a href={`${import.meta.env.BASE_URL}data/training-plan.md`} target="_blank" rel="noreferrer">
                        <FileText className="size-4" />
                        Plan markdown
                      </a>
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </section>

          <section className="mt-4 grid gap-4">
            <Card className="border-border/70 bg-card/85">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" />
                  Tendencia semanal
                </CardTitle>
                <CardDescription>Progreso por semana, con control de carga.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert role="status" className={cn("border-border/70", risk.level === "rojo" && "border-red-500/40 bg-red-500/10", risk.level === "ambar" && "border-amber-500/40 bg-amber-500/10", risk.level === "verde" && "border-emerald-500/40 bg-emerald-500/10")}>
                  <ShieldAlert className="size-4" />
                  <AlertTitle>{risk.title}</AlertTitle>
                  <AlertDescription>{risk.body}</AlertDescription>
                </Alert>
                <div className="grid gap-3 sm:grid-cols-2">
                  {weeklyStats.map((week) => (
                    <div key={week.week} className="rounded-lg border border-border/70 bg-background/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">Semana {week.week}</p>
                        <Badge variant="outline">{week.sessions}/7</Badge>
                      </div>
                      <Progress value={(week.sessions / 7) * 100} className="mt-3" />
                      <p className="mt-2 text-xs text-muted-foreground">Mejor link {week.best} · RPE {week.rpe.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="plan" className="mt-0">
          <section className="grid gap-4 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]">
            {activeGuidedRun?.status === "paused" && guidedSessionDefinitions[activeGuidedRun.sessionId] ? (
              <div className="lg:col-span-2">
                <GuidedResumeBanner
                  session={sessionById(activeGuidedRun.sessionId)}
                  definition={guidedSessionDefinitions[activeGuidedRun.sessionId]}
                  run={activeGuidedRun}
                  onResume={() => {
                    selectSession(activeGuidedRun.sessionId);
                    setGuidedSessionOpen(true);
                  }}
                />
              </div>
            ) : null}
            <Card className="border-border/70 bg-card/90 lg:sticky lg:top-4 lg:self-start">
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="text-lg">Plan por dia</CardTitle>
                  <CardDescription>{plan.length} sesiones. Los chips abren el primer dia de cada semana.</CardDescription>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {["all", "1", "2", "3", "4"].map((week) => (
                    <Button
                      key={week}
                      type="button"
                      size="sm"
                      variant={activeWeek === week ? "default" : "outline"}
                      aria-pressed={activeWeek === week}
                      onClick={() => selectPlanWeek(week)}
                      className="px-2"
                    >
                      {week === "all" ? "Todas" : `S${week}`}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[28rem] lg:h-[calc(100vh-13rem)] lg:max-h-none">
                  <div className="space-y-2 pr-3">
                    {plan.map((session, index) => {
                      const completed = (logsBySession.get(session.id) || []).length > 0 || guidedCompletedSessionIds.has(session.id);
                      const selected = session.id === selectedSessionId;
                      const weekActive = activeWeek !== "all" && String(session.week) === activeWeek;
                      const showWeekHeader = index === 0 || plan[index - 1].week !== session.week;
                      return (
                        <div key={session.id} className="space-y-2">
                          {showWeekHeader ? (
                            <div className="sticky top-0 z-10 flex items-center gap-2 bg-card/95 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                              <span className="h-px flex-1 bg-border/70" />
                              Semana {session.week}
                              <span className="h-px flex-1 bg-border/70" />
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => selectSession(session.id, true)}
                            aria-pressed={selected}
                            aria-current={selected ? "true" : undefined}
                            className={cn(
                              "w-full rounded-lg border bg-background/45 p-3 text-left transition hover:border-primary/70 hover:bg-primary/5 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              selected && "border-primary/70 bg-primary/10 ring-2 ring-primary/30",
                              !selected && weekActive && "border-primary/30 bg-primary/5",
                              !selected && !weekActive && "border-border/70"
                            )}
                          >
                            <div className="flex gap-3">
                              <div
                                className={cn(
                                  "grid size-10 shrink-0 place-items-center rounded-md border text-xs font-semibold",
                                  selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                                )}
                              >
                                D{session.day}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-xs text-muted-foreground">{compactDate(session.date)} · {session.start}</p>
                                  {completed ? <CheckCircle2 className="size-4 shrink-0 text-primary" /> : null}
                                </div>
                                <h3 className="mt-1 text-sm font-semibold leading-snug">{session.title.replace("Escalada ", "")}</h3>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge className={intensityClass(session.intensity)} variant="outline">{session.intensity}</Badge>
                                  <Badge variant="outline">{session.type}</Badge>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card ref={detailRef} className="border-border/70 bg-card/95">
              <CardHeader className="border-b border-border/70">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Semana {selectedSession.week}</Badge>
                      <Badge className={intensityClass(selectedSession.intensity)} variant="outline">{selectedSession.intensity}</Badge>
                      <Badge variant="outline">{selectedSession.type}</Badge>
                    </div>
                    <div>
                      <CardTitle className="text-2xl leading-tight lg:text-3xl">{selectedSession.title.replace("Escalada ", "")}</CardTitle>
                      <CardDescription className="mt-2">
                        {dateLabel(selectedSession.date)} · {selectedSession.start}-{selectedSession.end} · {selectedSession.phase}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      className="h-11 w-full sm:w-fit"
                      disabled={!selectedGuidedDefinition?.blocks.length}
                      onClick={() => setGuidedSessionOpen(true)}
                    >
                      <Play className="size-4" />
                      {guidedActionLabel}
                    </Button>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-3 xl:min-w-80">
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Dia</p>
                      <p className="mt-1 font-semibold">D{selectedSession.day}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Duracion</p>
                      <p className="mt-1 font-semibold">{selectedSession.start}-{selectedSession.end}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Foco</p>
                      <p className="mt-1 font-semibold">{selectedSession.type}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-4 sm:p-6">
                {!selectedGuidedDefinition?.blocks.length ? <p className="text-sm text-muted-foreground">Esta sesión todavía no tiene guía.</p> : null}
                <Alert role="note" className="border-border/70 bg-background/45">
                  <Target className="size-4" />
                  <AlertTitle>Objetivo de la sesion</AlertTitle>
                  <AlertDescription>{selectedSession.summary}</AlertDescription>
                </Alert>
                <div className="grid gap-5 xl:grid-cols-[0.9fr_1.35fr]">
                  <section className="space-y-3 rounded-lg border border-border/70 bg-background/45 p-4 xl:self-start">
                    <div>
                      <h3 className="font-semibold">Bloque de sesion</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Orden principal para ejecutar este dia.</p>
                    </div>
                    <div className="space-y-2">
                      {selectedSession.drills.map((drill) => (
                        <div key={drill} className="flex gap-2 rounded-lg border border-border/60 bg-background/40 p-2 text-sm">
                          <ListChecks className="mt-0.5 size-4 text-primary" />
                          <span>{drill}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Ejercicios, racional y referencias</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Detalle tecnico para hacer cada bloque con intencion.</p>
                    </div>
                    {selectedExercises.map((exercise) => (
                      <article key={exercise.id} className="space-y-4 rounded-lg border border-border/70 bg-background/50 p-4">
                        <div>
                          <h4 className="font-semibold">{exercise.title}</h4>
                          <p className="mt-1 text-sm text-muted-foreground">{exercise.dose}</p>
                        </div>
                        <p className="text-sm leading-6">{exercise.rationale}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Cues</p>
                            <ul className="mt-1 space-y-1 text-sm">
                              {exercise.cues.map((cue) => <li key={cue}>- {cue}</li>)}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Evitar</p>
                            <p className="mt-1 text-sm">{exercise.avoid}</p>
                          </div>
                        </div>
                        <Separator />
                        <div className="grid gap-2 sm:grid-cols-2">
                          {exercise.refs.map((reference) => (
                            <ReferenceTile key={`${exercise.id}-${reference.label}`} reference={reference} />
                          ))}
                        </div>
                      </article>
                    ))}
                  </section>
                </div>
                <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-20 -mx-4 border-t bg-card/95 p-3 backdrop-blur sm:hidden">
                  <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full"
                    disabled={!selectedGuidedDefinition?.blocks.length}
                    onClick={() => setGuidedSessionOpen(true)}
                  >
                    <Play className="size-4" />
                    {guidedActionLabel}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="log" className="mt-0">
          <section className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>
                  <TitleWithHelp
                    icon={ClipboardList}
                    title="Registro de sesion"
                    help="Carga lo que paso en la sesion seleccionada. Estos datos alimentan el dashboard, el riesgo de fatiga y el historial."
                  />
                </CardTitle>
                <CardDescription>Guarda carga, dolor, link y notas tecnicas.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedRecommendation ? (
                  <div className="space-y-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-primary" />
                      <div>
                        <h3 className="font-semibold">Log guardado</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Tus datos se guardaron y el formulario quedó listo para una nueva sesión.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium">¿Qué quieres hacer ahora?</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={clearLogForm}>Registrar otra sesión</Button>
                      <Button type="button" variant="outline" onClick={() => setActiveTab("dashboard")}>Continuar</Button>
                    </div>
                  </div>
                ) : (
                <form className="space-y-4" onSubmit={submitLog}>
                  <Field label="Dia del plan" htmlFor="log-session" help={logFieldHelp.session}>
                    <SessionSelect
                      id="log-session"
                      name="logSessionId"
                      ariaLabel="Dia del plan para registrar"
                      value={selectedSessionId}
                      onChange={handleLogSessionChange}
                    />
                  </Field>
                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">Semana {selectedSession.week}</Badge>
                      <Badge className={intensityClass(selectedSession.intensity)} variant="outline">{selectedSession.intensity}</Badge>
                      <Badge variant="outline">{selectedSession.type}</Badge>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium">{selectedSession.title.replace("Escalada ", "")}</h3>
                        <HelpTip label="Ayuda: resumen de sesion">
                          Este resumen te recuerda que estabas intentando entrenar antes de cargar numeros. Si el log no coincide con este dia, cambia el selector.
                        </HelpTip>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedSession.summary}</p>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div className="flex gap-2">
                        <Timer className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{dateLabel(selectedSession.date)} · {selectedSession.start}-{selectedSession.end}</span>
                      </div>
                      <div className="flex gap-2">
                        <ListChecks className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{selectedSession.drills[0]}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                    {logNumberFields.map((field) => {
                      const inputId = `log-${field}`;
                      return (
                        <Field key={field} label={logNumberLimits[field].label} htmlFor={inputId} help={logFieldHelp[field]}>
                          <Input
                            id={inputId}
                            name={field}
                            type="number"
                            inputMode={integerInputLogFields.has(field) ? "numeric" : "decimal"}
                            min={logNumberLimits[field].min}
                            max={logNumberLimits[field].max}
                            step={wholeStepLogFields.has(field) ? "1" : "0.5"}
                            value={logForm[field]}
                            onChange={(event) => handleLogChange(field, event.target.value)}
                          />
                        </Field>
                      );
                    })}
                  </div>
                  {logError ? (
                    <Alert className="border-red-500/40 bg-red-500/10">
                      <ShieldAlert className="size-4" />
                      <AlertTitle>Revisar valor</AlertTitle>
                      <AlertDescription>{logError}</AlertDescription>
                    </Alert>
                  ) : null}
                  <Field label="Notas" htmlFor="log-notes" help={logFieldHelp.notes}>
                    <Textarea
                      id="log-notes"
                      name="notes"
                      rows={4}
                      value={logForm.notes}
                      onChange={(event) => handleLogChange("notes", event.target.value)}
                      placeholder="Piel, beta, caidas, dolor al dia siguiente, sensaciones"
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit">
                      <Save className="size-4" />
                      Guardar log
                    </Button>
                  </div>
                </form>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle>Evaluación de tu sesión</CardTitle>
                <CardDescription>Recomendación IA según el objetivo planificado y tu registro.</CardDescription>
              </CardHeader>
              <CardContent>
                {savedRecommendation ? (
                  <div className="space-y-5" aria-live="polite">
                    <div className="flex items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                        {savedRecommendation.assessment.score}/10
                      </div>
                      <div>
                        <p className="font-semibold">{savedRecommendation.session.title.replace("Escalada ", "")}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{savedRecommendation.assessment.summary}</p>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-semibold">En qué enfocarte</h3>
                      <div className="mt-3 space-y-3">
                        {savedRecommendation.assessment.recommendations.map((recommendation, index) => (
                          <div key={recommendation} className="flex gap-3 rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                            <Badge className="mt-0.5 size-6 shrink-0 justify-center rounded-full p-0" variant="outline">{index + 1}</Badge>
                            <p>{recommendation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center">
                    <Gauge className="mx-auto size-8 text-primary" />
                    <p className="mt-3 font-medium">Guarda una sesión para recibir tu evaluación</p>
                    <p className="mt-1 text-sm text-muted-foreground">Compararemos carga, resultado, técnica, dolor y recuperación con el objetivo del día.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="video" className="mt-0">
          <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="size-5 text-primary" />
                    Video
                  </CardTitle>
                  <CardDescription>Archivo local para revisar pies, cadera, ritmo y hombros.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Label
                    htmlFor="video-input"
                    className="grid cursor-pointer place-items-center gap-2 rounded-lg border border-dashed border-border bg-background/40 p-6 text-center hover:border-primary/60"
                  >
                    <Upload className="size-7 text-primary" />
                    <span className="font-medium">Seleccionar video</span>
                    <span className="text-xs text-muted-foreground">MP4, MOV o WebM</span>
                    <Input id="video-input" type="file" accept="video/*" className="sr-only" onChange={handleVideoFile} />
                  </Label>
                  <Alert role={videoStatus.tone === "error" ? "alert" : "status"} className={cn(videoStatus.tone === "error" && "border-red-500/40 bg-red-500/10", videoStatus.tone === "ready" && "border-emerald-500/40 bg-emerald-500/10")}>
                    <Film className="size-4" />
                    <AlertTitle>{videoStatus.title}</AlertTitle>
                    <AlertDescription>{videoStatus.body}</AlertDescription>
                  </Alert>
                  {videoUrl ? (
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      playsInline
                      onLoadedMetadata={handleVideoMetadata}
                      className="aspect-video w-full rounded-lg border border-border bg-black"
                    />
                  ) : (
                    <div className="grid aspect-video place-items-center rounded-lg border border-border bg-background/50 text-sm text-muted-foreground">
                      Sin video cargado
                    </div>
                  )}
                  {videoMeta ? (
                    <div className="grid gap-2 rounded-lg border border-border/70 bg-background/50 p-3 text-sm sm:grid-cols-3">
                      <span className="truncate">{videoMeta.name}</span>
                      <span>{formatDuration(videoMeta.duration)}</span>
                      <span>{(videoMeta.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="size-5 text-primary" />
                    Checklist tecnico
                  </CardTitle>
                  <CardDescription>Toca un nivel de severidad para generar recomendaciones concretas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={saveVideoAnalysis}>
                    <Field label="Sesion asociada" htmlFor="video-session">
                      <SessionSelect
                        id="video-session"
                        name="videoSessionId"
                        ariaLabel="Sesion asociada al video"
                        value={selectedSessionId}
                        onChange={selectSession}
                      />
                    </Field>
                    <p className="text-xs leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground">Escala:</span> 0 OK · 1 leve · 2 medio · 3 alto · 4 critico · 5 frena.
                    </p>
                    <div className="grid gap-2 2xl:grid-cols-2">
                      {Object.keys(videoMetricLabels).map((key) => (
                        <MetricAnnotator
                          key={key}
                          metricKey={key}
                          label={videoMetricLabels[key]}
                          value={videoValues[key]}
                          onChange={(value) => setVideoValues((current) => ({ ...current, [key]: value }))}
                        />
                      ))}
                    </div>
                    <Field label="Observaciones" htmlFor="video-notes">
                      <Textarea
                        id="video-notes"
                        name="videoNotes"
                        rows={4}
                        value={videoNotes}
                        onChange={(event) => setVideoNotes(event.target.value)}
                        placeholder="Ej: caigo cuando corta pie derecho; hombro alto en captura."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" disabled={!videoFile || !videoMeta}>
                        <Save className="size-4" />
                        {pendingVideoId ? "Reintentar carga" : "Guardar analisis"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setVideoValues(defaultVideoValues)}>
                        <RefreshCcw className="size-4" />
                        Reset anotador
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border/70 bg-card/90 xl:sticky xl:top-20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="size-5 text-primary" />
                    Recomendaciones
                  </CardTitle>
                  <CardDescription>Calculadas desde tu checklist y fatiga reciente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canShowVideoAdvice ? (
                    latestVideoAdvice.map((item) => (
                      <Alert key={item.title} role="note" className="border-border/70 bg-background/40">
                        <Zap className="size-4" />
                        <AlertTitle>{item.title}</AlertTitle>
                        <AlertDescription>{item.body}</AlertDescription>
                      </Alert>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Sube un video para calcular recomendaciones desde el checklist.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle>Archivo local</CardTitle>
                  <CardDescription>Videos guardados en este navegador.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {!state.videos.length ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        Sin videos guardados.
                      </div>
                    ) : (
                      [...state.videos].reverse().map((video) => {
                        const session = sessionById(video.sessionId);
                        const firstAdvice = video.advice?.[0];
                        return (
                          <article key={video.id} className="rounded-lg border border-border/70 bg-background/50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate font-medium">{video.fileName || video.meta?.name || "Video guardado"}</h3>
                                <p className="text-xs text-muted-foreground">{session.title.replace("Escalada ", "")}</p>
                              </div>
                              <Badge variant="outline">{formatDuration(video.duration || video.meta?.duration)}</Badge>
                            </div>
                            {firstAdvice ? (
                              <p className="mt-2 text-sm text-muted-foreground">{firstAdvice.title}: {firstAdvice.body}</p>
                            ) : null}
                            <div className="mt-3 flex gap-2">
                              <Button size="sm" variant="outline" type="button" onClick={() => openSavedVideo(video.id)}>
                                <Play className="size-4" />
                                Abrir
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    type="button"
                                    aria-label={`Borrar video ${video.fileName || video.meta?.name || "guardado"}`}
                                  >
                                    <Trash2 className="size-4" />
                                    <span className="sr-only">Borrar video</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent size="sm">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Borrar video guardado</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta accion elimina el archivo local y su analisis de este navegador.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => removeVideo(video.id)}>
                                      Borrar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="profile" className="mt-0">
          <section id="profile" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <Card className="border-border/70 bg-card/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-5 text-primary" />
                  Perfil del escalador
                </CardTitle>
                <CardDescription>Objetivos, contexto y restricciones para ajustar el plan con mas precision.</CardDescription>
                <CardAction>
                  <Button type="button" variant="outline" onClick={() => setQuestionnaireOpen(true)}>
                    <ClipboardList className="size-4" />
                    Cuestionario
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="mb-5 rounded-lg border border-border/70 bg-background/45 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">Datos para personalizar coaching</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {questionnaireCompletion.answered}/{questionnaireCompletion.total} campos cargados · {questionnaireCompletion.percent}% completo
                      </p>
                    </div>
                    <div className="min-w-40">
                      <Progress value={questionnaireCompletion.percent} />
                    </div>
                  </div>
                </div>

                <form key={state.profile.questionnaireCompletedAt || "profile-form"} className="space-y-5" onSubmit={saveProfile}>
                  <section className="space-y-3">
                    <h3 className="font-semibold">Foto de perfil</h3>
                    <ProfilePhotoPicker file={avatarFile} currentUrl={avatarUrl} onFileChange={setAvatarFile} disabled={avatarSaving} />
                    {avatarError ? <p role="alert" className="text-sm text-destructive">{avatarError}</p> : null}
                    {avatarFile ? <Button type="button" variant="outline" disabled={avatarSaving} onClick={() => void saveAvatar()}>{avatarSaving ? "Guardando foto…" : "Guardar foto"}</Button> : null}
                  </section>
                  <section className="space-y-3">
                    <div>
                      <h3 className="font-semibold">Objetivos del bloque</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Lo que queres lograr y el foco tecnico que debe guiar las sesiones.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Grado actual" htmlFor="profile-current-grade">
                        <Input id="profile-current-grade" name="currentGrade" defaultValue={state.goals.currentGrade} />
                      </Field>
                      <Field label="Grado objetivo" htmlFor="profile-target-grade">
                        <Input id="profile-target-grade" name="targetGrade" defaultValue={state.goals.targetGrade} />
                      </Field>
                    </div>
                    <Field label="Proyecto o circuito" htmlFor="profile-project">
                      <Input id="profile-project" name="project" defaultValue={state.goals.project} />
                    </Field>
                    <Field label="Foco tecnico" htmlFor="profile-focus">
                      <Input id="profile-focus" name="focus" defaultValue={state.goals.focus} />
                    </Field>
                  </section>

                  <section className="space-y-3">
                    <Separator />
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-semibold">Cuestionario por pasos</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Edita medidas, estilos, capacidad, carga y riesgo sin navegar una lista larga.
                          </p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => setQuestionnaireOpen(true)}>
                          <ClipboardList className="size-4" />
                          Abrir cuestionario
                        </Button>
                      </div>
                    </div>
                  </section>

                  <Button className="w-fit" type="submit">
                    <Save className="size-4" />
                    Guardar objetivos
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-5 text-primary" />
                    Resumen
                  </CardTitle>
                  <CardDescription>Lo esencial para personalizar recomendaciones.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <p className="text-xs text-muted-foreground">Escalador</p>
                    <p className="mt-1 font-semibold">{profileValue(state.profile.name)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{profileValue(state.profile.location)}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Altura</p>
                      <p className="mt-1 font-semibold">{profileValue(state.profile.height, "-")}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Peso</p>
                      <p className="mt-1 font-semibold">{profileValue(state.profile.weight, "-")}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Ape</p>
                      <p className="mt-1 font-semibold">{profileValue(state.profile.apeIndex, "-")}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Boulder</p>
                      <p className="mt-1 font-semibold">{profileValue(state.profile.maxBoulder)}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                      <p className="text-xs text-muted-foreground">Via</p>
                      <p className="mt-1 font-semibold">{profileValue(state.profile.maxSport)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <p className="text-xs text-muted-foreground">Dedos</p>
                    <p className="mt-1 text-sm">{profileValue(state.profile.fingerStrength)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <p className="text-xs text-muted-foreground">Carga y recuperacion</p>
                    <p className="mt-1 text-sm">{profileValue(state.profile.trainingLoad || state.profile.weeklyAvailability)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{profileValue(state.profile.recoveryNotes)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <p className="text-xs text-muted-foreground">Mayor limitante</p>
                    <p className="mt-1 text-sm">{profileValue(state.profile.limiters)}</p>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/45 p-3">
                    <p className="text-xs text-muted-foreground">Riesgo actual</p>
                    <p className="mt-1 text-sm">{profileValue(state.profile.currentPain || state.profile.injuryHistory)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/90">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="size-5 text-primary" />
                    Respaldo local
                  </CardTitle>
                  <CardDescription>Copia o descarga todos los datos del usuario activo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/45 p-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Cuenta Supabase</p>
                      <p className="truncate text-sm font-medium">{authUser.email || "Cuenta Supabase"}</p>
                    </div>
                    <Button type="button" variant="outline" onClick={onSignOut} disabled={signingOut}>
                      <LogOut className="size-4" />
                      {signingOut ? "Cerrando…" : "Cerrar sesión"}
                    </Button>
                    {authError ? <p role="alert" className="w-full text-xs text-destructive">{authError}</p> : null}
                  </div>
                  <Alert role="note" className="border-amber-500/30 bg-amber-500/5">
                    <ShieldAlert className="size-4" />
                    <AlertTitle>Archivo sensible</AlertTitle>
                    <AlertDescription>
                      Usuario activo: <span className="font-mono">{userData.activeUserId}</span>. El JSON incluye historial de perfil, sesiones y analisis.
                    </AlertDescription>
                  </Alert>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => navigator.clipboard?.writeText(exportJson)}>
                      <FileText className="size-4" />
                      Copiar JSON
                    </Button>
                    <Button type="button" variant="outline" onClick={downloadJson}>
                      <Download className="size-4" />
                      Descargar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      aria-expanded={showJson}
                      aria-controls="export-json"
                      onClick={() => setShowJson((current) => !current)}
                    >
                      <Database className="size-4" />
                      {showJson ? "Ocultar JSON" : "Ver JSON"}
                    </Button>
                  </div>
                  {showJson ? (
                    <Textarea
                      id="export-json"
                      rows={12}
                      readOnly
                      wrap="off"
                      spellCheck={false}
                      value={exportJson}
                      className="font-mono text-xs"
                      aria-label="JSON exportado del tracker"
                    />
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="size-5 text-red-700 dark:text-red-300" />
                    Reset local
                  </CardTitle>
                  <CardDescription>Borra perfil, objetivos, logs y analisis guardados en este navegador.</CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="size-4" />
                        Borrar datos locales
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Borrar datos locales</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta accion borra perfil, logs, objetivos y auditorias de este navegador. No se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={resetData}>
                          Borrar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </section>
        </TabsContent>
              </div>

              <TabsList className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 grid w-auto grid-cols-4 rounded-xl border border-border bg-card/95 p-1 shadow-2xl group-data-horizontal/tabs:h-16 supports-[backdrop-filter]:backdrop-blur md:hidden">
                {primaryTabs.map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    aria-label={label}
                    className="h-full flex-col gap-0.5 px-1 text-[0.7rem]"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span>{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </SidebarInset>
          </SidebarProvider>
        </Tabs>
        {questionnaireOpen ? (
          <ProfileQuestionnaire
            profile={questionnaireProfile}
            completion={questionnaireCompletion}
            onSubmit={saveQuestionnaire}
            onSkip={skipQuestionnaire}
            avatarFile={avatarFile}
            onAvatarFileChange={setAvatarFile}
            avatarUrl={avatarUrl}
            avatarError={avatarError}
            avatarSaving={avatarSaving}
            theme={theme}
            onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
        ) : null}
        {guidedSessionOpen ? (
          <GuidedSessionFlow
            session={selectedSession}
            definition={selectedGuidedDefinition}
            definitions={guidedSessionDefinitions}
            storage={guidedStorage}
            onCloseToPlan={() => {
              setActiveTab("plan");
              setGuidedSessionOpen(false);
            }}
            onOpenLog={(sessionId) => {
              selectSession(sessionId);
              loadLogForSession(sessionId);
              setActiveTab("log");
              setGuidedSessionOpen(false);
            }}
            onSelectSession={(sessionId) => selectSession(sessionId)}
            onOpenInternal={(target) => {
              setActiveTab(target);
              setGuidedSessionOpen(false);
            }}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}
