import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ClipboardList,
  Database,
  Download,
  Flame,
  LogOut,
  Moon,
  Save,
  ShieldAlert,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  UserRound
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AvatarFile } from "@/features/cloud/cloud-avatar";
import type { SessionLog, TrackerState } from "@/lib/training";
import { ProfilePhotoPicker } from "./ProfilePhotoPicker";
import {
  calculateCurrentWeekSessions,
  calculateGradeProgress,
  calculateTrainingLoad,
  calculateWeeklyStreak,
  formatAgeLocation
} from "./profile-summary";

type ProfileDraft = Pick<TrackerState["goals"], "currentGrade" | "targetGrade" | "project" | "focus"> &
  Pick<TrackerState["profile"],
    | "name" | "age" | "location" | "sex" | "height" | "weight" | "wingspan" | "dominantHand"
    | "maxBoulder" | "maxSport" | "climbingExperience" | "styleStrengths" | "styleWeaknesses" | "limiters"
    | "weeklyAvailability" | "trainingLoad" | "fingerStrength" | "fingerEndurance" | "pullStrength"
    | "hipAnkleMobility" | "currentPain" | "injuryHistory" | "recoveryNotes" | "coachNotes"
  >;

type UserProfileProps = {
  profile: TrackerState["profile"];
  goals: TrackerState["goals"];
  logs: SessionLog[];
  now?: Date;
  avatarFile: AvatarFile | null;
  avatarUrl: string | null;
  avatarError?: string;
  avatarSaving?: boolean;
  avatarDisabled?: boolean;
  onAvatarFileChange: (file: AvatarFile) => void;
  onSaveAvatar?: () => void | Promise<void>;
  onRemoveAvatar?: () => void | Promise<void>;
  onSave: (values: ProfileDraft) => void | Promise<void>;
  email: string;
  exportJson: string;
  theme?: "light" | "dark" | string;
  onCopyJson: () => void;
  onDownloadJson: () => void;
  onReset: () => void;
  onSignOut: () => void;
  onOpenQuestionnaire: () => void;
  onToggleTheme: () => void;
  signingOut?: boolean;
  authError?: string;
};

function buildDraft(profile: TrackerState["profile"], goals: TrackerState["goals"]): ProfileDraft {
  return {
    currentGrade: goals.currentGrade,
    targetGrade: goals.targetGrade,
    project: goals.project,
    focus: goals.focus,
    name: profile.name,
    age: profile.age,
    location: profile.location,
    sex: profile.sex,
    height: profile.height,
    weight: profile.weight,
    wingspan: profile.wingspan,
    dominantHand: profile.dominantHand,
    maxBoulder: profile.maxBoulder,
    maxSport: profile.maxSport,
    climbingExperience: profile.climbingExperience,
    styleStrengths: profile.styleStrengths,
    styleWeaknesses: profile.styleWeaknesses,
    limiters: profile.limiters,
    weeklyAvailability: profile.weeklyAvailability,
    trainingLoad: profile.trainingLoad,
    fingerStrength: profile.fingerStrength,
    fingerEndurance: profile.fingerEndurance,
    pullStrength: profile.pullStrength,
    hipAnkleMobility: profile.hipAnkleMobility,
    currentPain: profile.currentPain,
    injuryHistory: profile.injuryHistory,
    recoveryNotes: profile.recoveryNotes,
    coachNotes: profile.coachNotes
  };
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CT";
}

function Field({ label, name, value, onChange, type = "text", error }: {
  label: string;
  name: keyof ProfileDraft;
  value: string;
  onChange: (name: keyof ProfileDraft, value: string) => void;
  type?: string;
  error?: string;
}) {
  const id = `user-profile-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => onChange(name, event.target.value)} />
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function TextField({ label, name, value, onChange, rows = 3 }: {
  label: string;
  name: keyof ProfileDraft;
  value: string;
  onChange: (name: keyof ProfileDraft, value: string) => void;
  rows?: number;
}) {
  const id = `user-profile-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} rows={rows} value={value} onChange={(event) => onChange(name, event.target.value)} />
    </div>
  );
}

function MetricCard({ label, value, helper, icon: Icon, progress }: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Activity;
  progress?: number | null;
}) {
  return (
    <Card className="border-border/70 bg-card/90">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{label}</span>
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {typeof progress === "number" ? <Progress value={progress} aria-label={`${label}: ${progress}%`} /> : null}
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function UserProfile({
  profile,
  goals,
  logs,
  now = new Date(),
  avatarFile,
  avatarUrl,
  avatarError = "",
  avatarSaving = false,
  avatarDisabled = false,
  onAvatarFileChange,
  onSaveAvatar,
  onRemoveAvatar,
  onSave,
  email,
  exportJson,
  theme = "light",
  onCopyJson,
  onDownloadJson,
  onReset,
  onSignOut,
  onOpenQuestionnaire,
  onToggleTheme,
  signingOut = false,
  authError = ""
}: UserProfileProps) {
  const [draft, setDraft] = useState(() => buildDraft(profile, goals));
  const [ageError, setAgeError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(buildDraft(profile, goals)), [profile, goals]);

  const metrics = useMemo(() => ({
    streak: calculateWeeklyStreak(logs, now),
    sessions: calculateCurrentWeekSessions(logs, now),
    load: calculateTrainingLoad(logs, now),
    progress: calculateGradeProgress(goals.currentGrade, goals.targetGrade)
  }), [goals.currentGrade, goals.targetGrade, logs, now]);

  const identityMeta = formatAgeLocation(profile.age, profile.location);
  const updateDraft = (name: keyof ProfileDraft, value: string) => {
    setDraft((current) => ({ ...current, [name]: value }));
    if (name === "age") setAgeError("");
    setSaveStatus("idle");
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const age = draft.age.trim();
    if (age && (!/^\d+$/.test(age) || Number(age) <= 0)) {
      setAgeError("La edad debe ser un número entero positivo.");
      document.getElementById("user-profile-age")?.focus();
      return;
    }
    setSaveStatus("saving");
    try {
      await onSave(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) as ProfileDraft);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  const progressValue = metrics.progress;
  const progressLabel = progressValue === null ? "Sin datos" : `${progressValue}%`;

  return (
    <section id="profile" className="space-y-4" aria-labelledby="user-profile-title">
      <Card className="border-border/70 bg-card/90">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-20 border sm:size-24">
              <AvatarImage src={avatarUrl || undefined} alt={`Foto de perfil de ${profile.name || "escalador"}`} />
              <AvatarFallback className="text-xl">{initials(profile.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Perfil del escalador</p>
              <h1 id="user-profile-title" className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{profile.name || "Escalador"}</h1>
              {identityMeta ? <p className="mt-1 text-sm text-muted-foreground">{identityMeta}</p> : null}
              <p className="mt-2 max-w-xl text-sm">{goals.focus || "Definí un foco técnico para orientar tus sesiones."}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Badge variant="secondary">{goals.currentGrade || "—"} actual</Badge>
              <Badge>{goals.targetGrade || "—"} objetivo</Badge>
              <Badge variant="outline">Plan activo</Badge>
            </div>
            <Button type="button" variant="outline" onClick={() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <UserRound className="size-4" />
              Editar perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard label="Racha" value={`${metrics.streak} ${metrics.streak === 1 ? "semana" : "semanas"}`} helper="Semanas consecutivas activas" icon={Flame} />
        <MetricCard label="Esta semana" value={`${metrics.sessions} ${metrics.sessions === 1 ? "sesión" : "sesiones"}`} helper="Sesiones registradas" icon={Activity} />
        <MetricCard label="Carga" value={metrics.load} helper="Según volumen y esfuerzo" icon={TrendingUp} />
        <MetricCard label="Progreso" value={progressLabel} helper={progressValue === null ? "Completá grados comparables" : `${goals.currentGrade} → ${goals.targetGrade}`} icon={Target} progress={progressValue} />
      </div>

      <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card ref={editorRef} className="scroll-mt-4 border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle>Editar perfil</CardTitle>
            <CardDescription>Los cambios se conservan al navegar entre pestañas y se guardan juntos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general">
              <div className="overflow-x-auto pb-1">
                <TabsList className="w-max min-w-full justify-start">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="climbing">Escalada</TabsTrigger>
                  <TabsTrigger value="training">Entrenamiento</TabsTrigger>
                  <TabsTrigger value="account">Cuenta</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="general" className="mt-5 space-y-5">
                <section className="space-y-3">
                  <h2 className="font-semibold">Foto de perfil</h2>
                  <ProfilePhotoPicker file={avatarFile} currentUrl={avatarUrl} onFileChange={onAvatarFileChange} onRemove={onRemoveAvatar} disabled={avatarSaving || avatarDisabled} />
                  {avatarError ? <p role="alert" className="text-sm text-destructive">{avatarError}</p> : null}
                  {avatarFile && onSaveAvatar ? <Button type="button" variant="outline" disabled={avatarSaving} onClick={() => void onSaveAvatar()}>{avatarSaving ? "Guardando foto…" : "Guardar foto"}</Button> : null}
                </section>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre" name="name" value={draft.name} onChange={updateDraft} />
                  <Field label="Edad" name="age" type="number" value={draft.age} onChange={updateDraft} error={ageError} />
                  <Field label="Ubicación" name="location" value={draft.location} onChange={updateDraft} />
                  <Field label="Sexo" name="sex" value={draft.sex} onChange={updateDraft} />
                  <Field label="Altura" name="height" value={draft.height} onChange={updateDraft} />
                  <Field label="Peso" name="weight" value={draft.weight} onChange={updateDraft} />
                  <Field label="Envergadura" name="wingspan" value={draft.wingspan} onChange={updateDraft} />
                  <Field label="Mano dominante" name="dominantHand" value={draft.dominantHand} onChange={updateDraft} />
                </div>
              </TabsContent>

              <TabsContent value="climbing" className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Grado actual" name="currentGrade" value={draft.currentGrade} onChange={updateDraft} />
                  <Field label="Grado objetivo" name="targetGrade" value={draft.targetGrade} onChange={updateDraft} />
                  <Field label="Máximo en búlder" name="maxBoulder" value={draft.maxBoulder} onChange={updateDraft} />
                  <Field label="Máximo en deportiva" name="maxSport" value={draft.maxSport} onChange={updateDraft} />
                </div>
                <TextField label="Experiencia" name="climbingExperience" value={draft.climbingExperience} onChange={updateDraft} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Estilos fuertes" name="styleStrengths" value={draft.styleStrengths} onChange={updateDraft} />
                  <TextField label="Estilos débiles" name="styleWeaknesses" value={draft.styleWeaknesses} onChange={updateDraft} />
                </div>
                <Field label="Proyecto actual" name="project" value={draft.project} onChange={updateDraft} />
                <Field label="Foco técnico" name="focus" value={draft.focus} onChange={updateDraft} />
                <TextField label="Limitadores" name="limiters" value={draft.limiters} onChange={updateDraft} />
              </TabsContent>

              <TabsContent value="training" className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Disponibilidad" name="weeklyAvailability" value={draft.weeklyAvailability} onChange={updateDraft} />
                  <Field label="Carga semanal" name="trainingLoad" value={draft.trainingLoad} onChange={updateDraft} />
                  <Field label="Fuerza de dedos" name="fingerStrength" value={draft.fingerStrength} onChange={updateDraft} />
                  <Field label="Resistencia de dedos" name="fingerEndurance" value={draft.fingerEndurance} onChange={updateDraft} />
                  <Field label="Fuerza de tracción" name="pullStrength" value={draft.pullStrength} onChange={updateDraft} />
                  <Field label="Movilidad" name="hipAnkleMobility" value={draft.hipAnkleMobility} onChange={updateDraft} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Dolor actual" name="currentPain" value={draft.currentPain} onChange={updateDraft} />
                  <TextField label="Historial de lesiones" name="injuryHistory" value={draft.injuryHistory} onChange={updateDraft} />
                </div>
                <TextField label="Recuperación" name="recoveryNotes" value={draft.recoveryNotes} onChange={updateDraft} />
                <TextField label="Notas del entrenador" name="coachNotes" value={draft.coachNotes} onChange={updateDraft} />
              </TabsContent>

              <TabsContent value="account" className="mt-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Cuenta Supabase</p>
                    <p className="truncate text-sm font-medium">{email || "Cuenta Supabase"}</p>
                  </div>
                  <Button type="button" variant="outline" disabled={signingOut} onClick={onSignOut}>
                    <LogOut className="size-4" />{signingOut ? "Cerrando…" : "Cerrar sesión"}
                  </Button>
                  {authError ? <p role="alert" className="w-full text-xs text-destructive">{authError}</p> : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Tema visual</p>
                    <p className="text-sm text-muted-foreground">Actualmente en modo {theme === "dark" ? "oscuro" : "claro"}.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={onToggleTheme}>
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />} Cambiar tema
                  </Button>
                </div>
                <Alert role="note">
                  <Database className="size-4" />
                  <AlertTitle>Respaldo de datos</AlertTitle>
                  <AlertDescription>El archivo incluye perfil, sesiones y análisis del usuario activo.</AlertDescription>
                </Alert>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={onCopyJson}><Database className="size-4" />Copiar JSON</Button>
                  <Button type="button" variant="outline" onClick={onDownloadJson}><Download className="size-4" />Descargar</Button>
                </div>
                <Textarea readOnly wrap="off" spellCheck={false} value={exportJson} className="max-h-52 font-mono text-xs" aria-label="JSON exportado del tracker" />
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="size-4" />Zona de peligro</CardTitle>
                    <CardDescription>Borra perfil, objetivos, logs y análisis guardados en este navegador.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button type="button" variant="destructive"><Trash2 className="size-4" />Borrar datos locales</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Borrar datos locales</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onReset}>Borrar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Separator className="my-5" />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saveStatus === "saving"}>
                <Save className="size-4" />{saveStatus === "saving" ? "Guardando…" : "Guardar cambios"}
              </Button>
              <Button type="button" variant="outline" onClick={onOpenQuestionnaire}><ClipboardList className="size-4" />Abrir cuestionario</Button>
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {saveStatus === "saved" ? "Cambios guardados." : saveStatus === "error" ? "No pudimos guardar los cambios." : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4" aria-label="Resumen del atleta">
          <Card className="border-border/70 bg-card/90">
            <CardHeader><CardTitle className="flex items-center gap-2"><Target className="size-5" />Resumen del atleta</CardTitle><CardDescription>Lo esencial para orientar tus sesiones.</CardDescription></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Fortalezas</p><p className="mt-1">{profile.strengths || profile.styleStrengths || "Todavía sin registrar"}</p></div>
              <Separator />
              <div><p className="text-xs text-muted-foreground">Limitadores</p><p className="mt-1">{profile.limiters || "Todavía sin registrar"}</p></div>
              <Separator />
              <div><p className="text-xs text-muted-foreground">Estado físico</p><p className="mt-1">{profile.currentPain || profile.injuryHistory || "Sin dolor declarado"}</p></div>
            </CardContent>
          </Card>
        </aside>
      </form>
    </section>
  );
}

export type { ProfileDraft, UserProfileProps };
