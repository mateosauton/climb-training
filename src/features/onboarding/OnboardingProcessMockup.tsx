import { ArrowLeft, ArrowRight, Check, ChevronRight, Dumbbell, HeartPulse, MailCheck, Mountain, Sparkles } from "lucide-react";
import { useState } from "react";

type Step = "register" | "verify" | "personal" | "climber" | "focus" | "equipment" | "ready";

const steps: Step[] = ["register", "verify", "personal", "climber", "focus", "equipment", "ready"];

const stepDetails = {
  register: { eyebrow: "01 / Cuenta", title: "Creá tu cuenta", copy: "Guardá tu progreso y recibí tu plan personalizado.", icon: MailCheck },
  verify: { eyebrow: "02 / Seguridad", title: "Confirmá tu correo", copy: "Pegá el código de seis dígitos que enviamos a tu correo.", icon: MailCheck },
  personal: { eyebrow: "Paso 1 de 4", title: "Empecemos por vos", copy: "Solo lo necesario para personalizar la bienvenida.", icon: Sparkles },
  climber: { eyebrow: "Paso 2 de 4", title: "Contanos cómo escalás", copy: "Con esto ajustamos tu primera semana a tu realidad.", icon: Mountain },
  focus: { eyebrow: "Paso 3 de 4", title: "Tu foco, sin tests", copy: "Elegí qué te gustaría mejorar. Después afinamos el plan juntos.", icon: HeartPulse },
  equipment: { eyebrow: "Paso 4 de 4", title: "Tu terreno de juego", copy: "Tu plan solo va a usar material que realmente tengas disponible.", icon: Dumbbell },
  ready: { eyebrow: "Todo listo", title: "Tu primera semana está lista", copy: "Un punto de partida seguro y claro. Podés ajustar todo más adelante.", icon: Check }
} as const;

const optionClass = (selected: boolean) => `group flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition duration-200 ${selected ? "border-[#e5633f] bg-[#fff3ed] text-[#261510] shadow-[0_5px_0_#e5633f]" : "border-[#ddd9d0] bg-white text-[#302e2a] hover:border-[#afa99d] hover:bg-[#fcfbf8]"}`;

export function OnboardingProcessMockup() {
  const [step, setStep] = useState<Step>("register");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [experience, setExperience] = useState("1–3 años");
  const [discipline, setDiscipline] = useState("Boulder");
  const [focus, setFocus] = useState<string[]>(["Técnica"]);
  const [pain, setPain] = useState("No");
  const [place, setPlace] = useState("Gimnasio");
  const [equipment, setEquipment] = useState<string[]>(["Muro de boulder"]);

  const index = steps.indexOf(step);
  const detail = stepDetails[step];
  const Icon = detail.icon;
  const onboardingProgress = step === "personal" ? 1 : step === "climber" ? 2 : step === "focus" ? 3 : step === "equipment" ? 4 : 0;

  const next = () => setStep(steps[Math.min(index + 1, steps.length - 1)]);
  const previous = () => setStep(steps[Math.max(index - 1, 0)]);
  const toggle = (value: string, values: string[], change: (nextValues: string[]) => void, maximum = 99) => {
    if (values.includes(value)) change(values.filter((item) => item !== value));
    else if (values.length < maximum) change([...values, value]);
  };

  return (
    <main className="min-h-svh bg-[#e9e5db] px-4 py-6 text-[#211f1a] sm:px-8 sm:py-10">
      <div className="mx-auto grid min-h-[calc(100svh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#d0c9bb] bg-[#f7f5ef] shadow-[0_28px_70px_rgba(45,38,28,0.18)] lg:grid-cols-[0.94fr_1.06fr]">
        <aside className="relative overflow-hidden bg-[#24231f] px-7 py-8 text-[#f8f5ed] sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12">
          <div className="absolute -right-24 -top-28 size-72 rounded-full border-[24px] border-[#e5633f] opacity-90" />
          <div className="absolute -bottom-40 -left-32 size-80 rounded-full border border-[#6f6b60]" />
          <div className="relative">
            <div className="flex items-center gap-3 text-sm font-bold tracking-[0.18em]">
              <span className="grid size-9 place-items-center rounded-full bg-[#e5633f] text-[#24231f]">4W</span>
              CLIMB TRAINING
            </div>
            <div className="mt-16 max-w-sm lg:mt-24">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#e5633f]">Tu entrenamiento, a tu medida</p>
              <h1 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-5xl">Un plan que empieza donde estás.</h1>
              <p className="mt-6 max-w-xs text-base leading-7 text-[#c8c4ba]">Menos preguntas. Más pared. Respondé lo esencial y te proponemos una primera semana posible.</p>
            </div>
          </div>
          <div className="relative mt-14 flex items-end gap-3 lg:mt-0">
            {[
              ["01", "Cuenta"],
              ["02", "Confirmación"],
              ["03", "Tu plan"]
            ].map(([number, label], itemIndex) => (
              <div key={number} className={`border-l pl-3 ${index >= itemIndex ? "border-[#e5633f] text-white" : "border-[#68645b] text-[#8d897f]"}`}>
                <p className="text-xs font-bold tracking-widest">{number}</p>
                <p className="mt-1 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[42rem] flex-col bg-[#fdfcf9] px-5 py-6 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#79746a]">Mockup · Registro y onboarding</p>
            {onboardingProgress > 0 ? <span className="rounded-full bg-[#ebe8df] px-3 py-1 text-xs font-bold text-[#4b4740]">~ 2 min</span> : null}
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
            {onboardingProgress > 0 ? (
              <div className="mb-9">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#625e56]">
                  <span>Configurando tu plan</span><span>{onboardingProgress}/4</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#e7e3da]" aria-label={`Paso ${onboardingProgress} de 4`}>
                  <div className="h-full rounded-full bg-[#e5633f] transition-all duration-300" style={{ width: `${onboardingProgress * 25}%` }} />
                </div>
              </div>
            ) : null}

            <div className="mb-7 flex size-14 items-center justify-center rounded-[1.15rem] bg-[#24231f] text-[#fffaf0] shadow-[0_6px_0_#e5633f]">
              <Icon className="size-7" strokeWidth={2.25} aria-hidden="true" />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d95735]">{detail.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">{detail.title}</h2>
            <p className="mt-3 max-w-sm text-base leading-6 text-[#6d685f]">{detail.copy}</p>

            <div className="mt-8 space-y-4">
              {step === "register" ? <RegisterScreen /> : null}
              {step === "verify" ? <VerifyScreen code={code} setCode={setCode} /> : null}
              {step === "personal" ? <PersonalScreen name={name} setName={setName} /> : null}
              {step === "climber" ? <ClimberScreen experience={experience} discipline={discipline} setExperience={setExperience} setDiscipline={setDiscipline} /> : null}
              {step === "focus" ? <FocusScreen focus={focus} pain={pain} setPain={setPain} toggleFocus={(value) => toggle(value, focus, setFocus, 2)} /> : null}
              {step === "equipment" ? <EquipmentScreen place={place} equipment={equipment} setPlace={setPlace} toggleEquipment={(value) => toggle(value, equipment, setEquipment)} /> : null}
              {step === "ready" ? <ReadyScreen name={name || "Mateo"} /> : null}
            </div>
          </div>

          <footer className="mx-auto flex w-full max-w-md items-center gap-3 pt-3">
            {index > 0 && step !== "ready" ? <button type="button" onClick={previous} className="grid size-12 shrink-0 place-items-center rounded-xl border border-[#d8d3c9] text-[#4e4940] transition hover:bg-[#f3f0e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5633f]" aria-label="Volver"><ArrowLeft className="size-5" /></button> : null}
            {step !== "ready" ? <button type="button" onClick={next} disabled={step === "verify" && code.length !== 6} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#24231f] px-5 text-sm font-bold text-[#fffaf0] transition hover:bg-[#3b3933] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e5633f]">{step === "equipment" ? "Crear mi plan" : step === "register" ? "Continuar" : step === "verify" ? "Confirmar código" : "Continuar"}<ArrowRight className="size-4" /></button> : <button type="button" onClick={() => setStep("register")} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#24231f] px-5 text-sm font-bold text-[#fffaf0] transition hover:bg-[#3b3933]">Ver de nuevo el flujo <ChevronRight className="size-4" /></button>}
          </footer>
        </section>
      </div>
    </main>
  );
}

function RegisterScreen() {
  return <><Field label="Correo electrónico" value="mateo@ejemplo.com" /><Field label="Contraseña" value="••••••••••" type="password" /><Field label="Confirmar contraseña" value="••••••••••" type="password" /><p className="pt-1 text-center text-xs text-[#777169]">Tus datos de entrenamiento permanecen en este dispositivo.</p></>;
}

function VerifyScreen({ code, setCode }: { code: string; setCode: (value: string) => void }) {
  return <><div className="rounded-2xl border border-[#dfdbd2] bg-[#f7f5ef] p-4"><p className="text-sm font-bold">Código enviado a</p><p className="mt-1 text-sm text-[#6c675f]">mateo@ejemplo.com</p></div><label className="block"><span className="text-sm font-bold">Código de verificación</span><input aria-label="Código de verificación" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="mt-2 h-14 w-full rounded-xl border border-[#d8d3c9] bg-white px-4 text-center font-mono text-2xl font-bold tracking-[0.38em] outline-none transition placeholder:text-[#bbb5aa] focus:border-[#e5633f] focus:ring-4 focus:ring-[#f8d8ce]" /></label><p className="text-sm text-[#706a60]">¿No llegó? Podés pedir un código nuevo en 30 segundos.</p></>;
}

function PersonalScreen({ name, setName }: { name: string; setName: (value: string) => void }) {
  return <><label className="block"><span className="text-sm font-bold">¿Cómo te llamamos?</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" className="mt-2 h-12 w-full rounded-xl border border-[#d8d3c9] bg-white px-4 text-base outline-none transition placeholder:text-[#aaa49b] focus:border-[#e5633f] focus:ring-4 focus:ring-[#f8d8ce]" /></label><div><p className="text-sm font-bold">Rango de edad <span className="font-normal text-[#79746a]">(opcional)</span></p><div className="mt-2 grid grid-cols-3 gap-2">{["–18", "18–34", "35+"].map((item) => <button type="button" key={item} className={optionClass(item === "18–34")}>{item}</button>)}</div></div></>;
}

function ClimberScreen({ experience, discipline, setExperience, setDiscipline }: { experience: string; discipline: string; setExperience: (value: string) => void; setDiscipline: (value: string) => void }) {
  return <><ChoiceSet label="Experiencia" values={["Nuevo/a", "< 1 año", "1–3 años", "3+ años"]} selected={experience} onChange={setExperience} /><ChoiceSet label="¿Qué escalás más?" values={["Boulder", "Deportiva", "Ambas"]} selected={discipline} onChange={setDiscipline} /><ChoiceSet label="Sesiones por semana" values={["1", "2", "3", "4+"]} selected="3" onChange={() => undefined} compact /></>;
}

function FocusScreen({ focus, pain, setPain, toggleFocus }: { focus: string[]; pain: string; setPain: (value: string) => void; toggleFocus: (value: string) => void }) {
  return <><div><p className="text-sm font-bold">Me gustaría mejorar <span className="font-normal text-[#79746a]">(hasta 2)</span></p><div className="mt-2 grid grid-cols-2 gap-2">{["Fuerza", "Técnica", "Resistencia", "Movilidad", "Lectura"].map((item) => <button type="button" key={item} onClick={() => toggleFocus(item)} className={optionClass(focus.includes(item))}>{item}{focus.includes(item) ? <Check className="size-4" /> : null}</button>)}</div></div><ChoiceSet label="¿Tenés dolor que afecta tu escalada hoy?" values={["No", "Un poco", "Sí"]} selected={pain} onChange={setPain} /></>;
}

function EquipmentScreen({ place, equipment, setPlace, toggleEquipment }: { place: string; equipment: string[]; setPlace: (value: string) => void; toggleEquipment: (value: string) => void }) {
  return <><ChoiceSet label="¿Dónde entrenás más?" values={["Gimnasio", "Board", "Roca", "Casa"]} selected={place} onChange={setPlace} /><div><p className="text-sm font-bold">Material disponible</p><div className="mt-2 grid grid-cols-2 gap-2">{["Muro de boulder", "Hangboard", "Pesas", "Bandas", "Solo cuerpo", "No estoy seguro/a"].map((item) => <button type="button" key={item} onClick={() => toggleEquipment(item)} className={optionClass(equipment.includes(item))}>{item}{equipment.includes(item) ? <Check className="size-4" /> : null}</button>)}</div></div></>;
}

function ReadyScreen({ name }: { name: string }) {
  return <div className="rounded-3xl border border-[#f1b5a2] bg-[#fff1eb] p-6"><div className="grid size-11 place-items-center rounded-full bg-[#e5633f] text-white"><Check className="size-6" /></div><p className="mt-5 text-lg font-black">Bienvenido/a, {name}.</p><p className="mt-2 text-sm leading-6 text-[#6d4a3e]">Empezamos con tres sesiones adaptables y una recomendación de intensidad para esta semana.</p><div className="mt-5 rounded-2xl bg-white p-4 text-sm shadow-sm"><p className="font-bold">Semana 1 · Construir la base</p><p className="mt-1 text-[#746f65]">Boulder técnico · Fuerza general · Movilidad</p></div></div>;
}

function ChoiceSet({ label, values, selected, onChange, compact = false }: { label: string; values: string[]; selected: string; onChange: (value: string) => void; compact?: boolean }) {
  return <div><p className="text-sm font-bold">{label}</p><div className={`mt-2 grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2"}`}>{values.map((item) => <button type="button" key={item} onClick={() => onChange(item)} className={optionClass(selected === item)}>{item}{selected === item ? <Check className="size-4" /> : null}</button>)}</div></div>;
}

function Field({ label, value, type = "text" }: { label: string; value: string; type?: string }) {
  return <label className="block"><span className="text-sm font-bold">{label}</span><input type={type} value={value} readOnly className="mt-2 h-12 w-full rounded-xl border border-[#d8d3c9] bg-white px-4 text-base outline-none" /></label>;
}
