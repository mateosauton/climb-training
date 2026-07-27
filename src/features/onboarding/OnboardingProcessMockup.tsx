import { ArrowLeft, Dumbbell, HeartPulse, LoaderCircle, Mail, Mountain, Sparkles } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChoiceCard } from "@/components/climb/ChoiceCard";
import { HoldMark, RouteTraceMark } from "@/components/climb/ClimbMarks";

type Screen = "register" | "verify" | "personal" | "climber" | "focus" | "equipment" | "creating";

const screens: Screen[] = ["register", "verify", "personal", "climber", "focus", "equipment", "creating"];
const details = {
  register: { title: "Crea tu cuenta", description: "Regístrate para guardar el acceso a tus datos locales.", icon: Mail },
  verify: { title: "Confirma tu correo", description: "Ingresa el código de seis dígitos que enviamos a tu correo.", icon: Mail },
  personal: { title: "Empecemos por vos", description: "Dos datos rápidos para personalizar tu bienvenida.", icon: Sparkles },
  climber: { title: "Contanos cómo escalás", description: "Así ajustamos tu primera semana a tu experiencia y disponibilidad.", icon: Mountain },
  focus: { title: "¿Qué querés mejorar?", description: "Elegí hasta dos áreas. No necesitás hacer ningún test.", icon: HeartPulse },
  equipment: { title: "¿Con qué contás?", description: "Tu plan solo va a usar material que tengas disponible.", icon: Dumbbell },
  creating: { title: "Estamos creando tu plan", description: "Preparamos una primera semana segura y adaptada a vos.", icon: LoaderCircle }
} as const;

export function OnboardingProcessMockup() {
  const [screen, setScreen] = useState<Screen>("register");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ageRange, setAgeRange] = useState([18, 34]);
  const [experienceYears, setExperienceYears] = useState([2]);
  const [disciplines, setDisciplines] = useState(["Boulder"]);
  const [weeklySessions, setWeeklySessions] = useState("3");
  const [focus, setFocus] = useState(["Técnica"]);
  const [pain, setPain] = useState("No");
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [painIntensity, setPainIntensity] = useState<Record<string, number>>({});
  const [places, setPlaces] = useState(["Gimnasio"]);
  const [equipment, setEquipment] = useState(["Muro de boulder"]);
  const current = screens.indexOf(screen);
  const detail = details[screen];
  const Icon = detail.icon;
  const onboardingStep = screen === "personal" ? 1 : screen === "climber" ? 2 : screen === "focus" ? 3 : screen === "equipment" ? 4 : 0;
  const next = () => setScreen(screens[Math.min(current + 1, screens.length - 1)]);
  const back = () => setScreen(screens[Math.max(0, current - 1)]);
  const toggle = (value: string, selected: string[], setSelected: (values: string[]) => void, maximum = Infinity) => {
    if (selected.includes(value)) setSelected(selected.filter((item) => item !== value));
    else if (selected.length < maximum) setSelected([...selected, value]);
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary),transparent_78%),transparent_34rem)]" />
      <Card className="relative w-full max-w-md border-border/80 shadow-xl">
        <CardHeader className="relative text-center">
          {current > 0 && screen !== "creating" ? <Button type="button" variant="outline" size="icon" onClick={back} aria-label="Volver" className="absolute left-(--card-spacing) top-0"><ArrowLeft /></Button> : null}
          <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Icon className={`size-6 ${screen === "creating" ? "animate-spin" : ""}`} aria-hidden="true" />
          </div>
          {onboardingStep > 0 ? <div className="mb-2 space-y-2"><div className="flex justify-between text-xs text-muted-foreground"><span>Paso {onboardingStep} de 4</span><span>~ 2 minutos</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${onboardingStep * 25}%` }} /></div></div> : null}
          <CardTitle><h1>{detail.title}</h1></CardTitle>
          <CardDescription>{detail.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {screen === "register" ? <RegisterFields /> : null}
          {screen === "verify" ? <VerificationFields code={code} setCode={setCode} /> : null}
          {screen === "personal" ? <PersonalFields name={name} setName={setName} ageRange={ageRange} setAgeRange={setAgeRange} /> : null}
          {screen === "climber" ? <ClimberFields experienceYears={experienceYears} disciplines={disciplines} weeklySessions={weeklySessions} setExperienceYears={setExperienceYears} setWeeklySessions={setWeeklySessions} toggleDiscipline={(value) => toggle(value, disciplines, setDisciplines)} /> : null}
          {screen === "focus" ? <FocusFields focus={focus} pain={pain} painAreas={painAreas} painIntensity={painIntensity} setPain={setPain} toggleFocus={(value) => toggle(value, focus, setFocus, 2)} togglePainArea={(area) => toggle(area, painAreas, setPainAreas)} setPainIntensity={(area, intensity) => setPainIntensity((current) => ({ ...current, [area]: intensity }))} /> : null}
          {screen === "equipment" ? <EquipmentFields places={places} equipment={equipment} togglePlace={(value) => toggle(value, places, setPlaces)} toggleEquipment={(value) => toggle(value, equipment, setEquipment)} /> : null}

          {screen !== "creating" ? <div className="pt-2">
            <Button type="button" className="h-11 w-full" onClick={next} disabled={screen === "verify" && code.length !== 6}>{screen === "equipment" ? "Crear mi plan" : screen === "verify" ? "Confirmar código" : screen === "register" ? "Registrarme" : "Continuar"}</Button>
          </div> : <Button type="button" className="h-11 w-full" onClick={() => setScreen("register")}>Ver el flujo de nuevo</Button>}
          <p className="text-center text-xs text-muted-foreground">Mockup del flujo de registro y onboarding</p>
        </CardContent>
      </Card>
    </main>
  );
}

function RegisterFields() {
  return <div className="space-y-4"><Field label="Correo electrónico" value="mateo@ejemplo.com" /><Field label="Contraseña" value="password1" type="password" /><Field label="Confirmar contraseña" value="password1" type="password" /><p className="text-center text-xs text-muted-foreground">Tus datos de entrenamiento permanecen en este dispositivo.</p></div>;
}

function VerificationFields({ code, setCode }: { code: string; setCode: (value: string) => void }) {
  return <div className="space-y-4"><Alert><Mail className="size-4" /><AlertTitle>Revisa tu correo</AlertTitle><AlertDescription>Enviamos un código a mateo@ejemplo.com.</AlertDescription></Alert><div className="space-y-2"><Label htmlFor="mockup-code">Código de verificación</Label><Input id="mockup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 text-center font-mono text-lg tracking-[0.35em]" /><p className="text-xs text-muted-foreground">Ingresá los seis dígitos para continuar con tu perfil.</p></div></div>;
}

function PersonalFields({ name, setName, ageRange, setAgeRange }: { name: string; setName: (value: string) => void; ageRange: number[]; setAgeRange: (value: number[]) => void }) {
  return <div className="space-y-4"><div className="space-y-2"><Label htmlFor="mockup-name">¿Cómo te llamamos?</Label><Input id="mockup-name" placeholder="Tu nombre" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-3"><div className="flex items-center justify-between gap-3"><Label htmlFor="mockup-age-range">Rango de edad <span className="font-normal text-muted-foreground">(opcional)</span></Label><output htmlFor="mockup-age-range" className="rounded-md bg-muted px-2 py-1 text-sm font-medium tabular-nums">{ageRange[0]}–{ageRange[1]} años</output></div><Slider id="mockup-age-range" aria-label="Rango de edad" min={12} max={70} step={1} minStepsBetweenThumbs={1} value={ageRange} onValueChange={setAgeRange} /><div className="flex justify-between text-xs text-muted-foreground"><span>12</span><span>70+</span></div></div></div>;
}

function ClimberFields({ experienceYears, disciplines, weeklySessions, setExperienceYears, setWeeklySessions, toggleDiscipline }: { experienceYears: number[]; disciplines: string[]; weeklySessions: string; setExperienceYears: (value: number[]) => void; setWeeklySessions: (value: string) => void; toggleDiscipline: (value: string) => void }) {
  const years = experienceYears[0];
  const experienceLabel = years === 0 ? "Nuevo/a" : years >= 15 ? "15+ años" : `${years} ${years === 1 ? "año" : "años"}`;
  return <div className="space-y-4"><div className="space-y-3"><div className="flex items-center justify-between gap-3"><Label htmlFor="mockup-experience-range">Experiencia escalando</Label><output htmlFor="mockup-experience-range" className="rounded-md bg-muted px-2 py-1 text-sm font-medium tabular-nums">{experienceLabel}</output></div><Slider id="mockup-experience-range" aria-label="Experiencia escalando" min={0} max={15} step={1} value={experienceYears} onValueChange={setExperienceYears} /><div className="flex justify-between text-xs text-muted-foreground"><span>Nuevo/a</span><span>15+ años</span></div></div><MultiChoiceGroup label="¿Qué escalás más?" choices={["Boulder", "Deportiva"]} selected={disciplines} onToggle={toggleDiscipline} /><ChoiceGroup label="Sesiones por semana" choices={["1", "2", "3", "4+"]} selected={weeklySessions} onSelect={setWeeklySessions} /></div>;
}

function FocusFields({ focus, pain, painAreas, painIntensity, setPain, toggleFocus, togglePainArea, setPainIntensity }: { focus: string[]; pain: string; painAreas: string[]; painIntensity: Record<string, number>; setPain: (value: string) => void; toggleFocus: (value: string) => void; togglePainArea: (area: string) => void; setPainIntensity: (area: string, intensity: number) => void }) {
  return <div className="space-y-4"><MultiChoiceGroup label="Áreas a mejorar (hasta 2)" choices={["Fuerza", "Técnica", "Resistencia", "Movilidad", "Lectura"]} selected={focus} onToggle={toggleFocus} /><ChoiceGroup label="¿Tenés dolor que afecta tu escalada hoy?" choices={["No", "Un poco", "Sí"]} selected={pain} onSelect={setPain} />{pain === "Sí" ? <div className="space-y-4 border-t pt-4"><MultiChoiceGroup label="¿Dónde sentís dolor?" choices={["Dedos", "Muñeca", "Codo", "Hombro", "Espalda", "Rodilla", "Tobillo"]} selected={painAreas} onToggle={togglePainArea} />{painAreas.map((area) => <PainIntensityField key={area} area={area} intensity={painIntensity[area] ?? 5} onIntensityChange={setPainIntensity} />)}</div> : null}</div>;
}

function PainIntensityField({ area, intensity, onIntensityChange }: { area: string; intensity: number; onIntensityChange: (area: string, intensity: number) => void }) {
  return <div className="space-y-3 rounded-lg border bg-muted/30 p-3"><div className="flex items-center justify-between gap-3"><Label htmlFor={`mockup-pain-${area}`}>{area}</Label><output htmlFor={`mockup-pain-${area}`} className="rounded-md bg-background px-2 py-1 text-sm font-medium tabular-nums">{intensity}/10</output></div><Slider id={`mockup-pain-${area}`} aria-label={`Intensidad de dolor en ${area}`} min={1} max={10} step={1} value={[intensity]} onValueChange={([value]) => onIntensityChange(area, value)} /><div className="flex justify-between text-xs text-muted-foreground"><span>1 · Baja</span><span>10 · Alta</span></div></div>;
}

function EquipmentFields({ places, equipment, togglePlace, toggleEquipment }: { places: string[]; equipment: string[]; togglePlace: (value: string) => void; toggleEquipment: (value: string) => void }) {
  return <div className="space-y-4"><MultiChoiceGroup label="¿Dónde entrenás más?" choices={["Gimnasio", "Board", "Roca", "Casa"]} selected={places} onToggle={togglePlace} /><MultiChoiceGroup label="Material disponible" choices={["Muro de boulder", "Hangboard", "Pesas", "Bandas", "Solo cuerpo", "No estoy seguro/a"]} selected={equipment} onToggle={toggleEquipment} /></div>;
}

function ChoiceGroup({ label, choices, selected, onSelect }: { label: string; choices: string[]; selected: string; onSelect: (value: string) => void }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-medium">{label}</legend><div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => <ChoiceCard key={choice} label={choice} selected={selected === choice} onClick={() => onSelect(choice)} mark={choice === "Boulder" ? <HoldMark className="size-6" /> : <RouteTraceMark className="size-6" />} />)}</div></fieldset>;
}

function MultiChoiceGroup({ label, choices, selected, onToggle }: { label: string; choices: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <fieldset className="space-y-2"><legend className="text-sm font-medium">{label}</legend><div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => <ChoiceCard key={choice} label={choice} selected={selected.includes(choice)} onClick={() => onToggle(choice)} mark={choice === "Boulder" || choice.includes("boulder") ? <HoldMark className="size-6" /> : <RouteTraceMark className="size-6" />} />)}</div></fieldset>;
}

function Field({ label, value, type = "text" }: { label: string; value: string; type?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} defaultValue={value} /></div>;
}
