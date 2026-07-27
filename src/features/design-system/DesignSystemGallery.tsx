import { useState } from "react";
import { ArrowLeft, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceCard } from "@/components/climb/ChoiceCard";
import { GradeBadge, climbingGrades, type ClimbingGrade } from "@/components/climb/GradeBadge";
import { HoldMark, RopeKnotMark, RouteTraceMark } from "@/components/climb/ClimbMarks";
import { LoadScale } from "@/components/climb/LoadScale";
import { RecoverySignal } from "@/components/climb/RecoverySignal";
import { SessionCard } from "@/components/climb/SessionCard";

export function DesignSystemGallery() {
  const [style, setStyle] = useState("Boulder");
  const [load, setLoad] = useState(7);
  return <main className="min-h-svh bg-paper px-4 py-8 text-foreground sm:px-6 lg:px-10"><div className="mx-auto max-w-6xl"><header className="mb-10 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 flex size-11 items-center justify-center rounded-full bg-sandstone text-river"><Mountain className="size-6" /></div><p className="text-sm font-semibold tracking-[0.16em] text-river uppercase">Climb 4W</p><h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-5xl">Sistema de diseño</h1><p className="mt-3 max-w-2xl text-muted-foreground">Una biblioteca editorial para entrenar, registrar y progresar en escalada.</p></div><Button variant="outline" asChild><a href="./"><ArrowLeft />Volver a la app</a></Button></header><div className="grid gap-5 lg:grid-cols-3"><Specimen title="Botón de ruta" description="Acción primaria clara y táctil."><Button className="h-12 w-full text-base"><RopeKnotMark className="size-5" />Empezar sesión</Button></Specimen><Specimen title="Selector de estilo" description="Elecciones expresivas, no botones genéricos."><div className="grid gap-2"><ChoiceCard label="Boulder" description="Problemas cortos y potentes" selected={style === "Boulder"} onClick={() => setStyle("Boulder")} mark={<HoldMark className="size-7" />} /><ChoiceCard label="Deportiva" description="Continuidad y resistencia" selected={style === "Deportiva"} onClick={() => setStyle("Deportiva")} mark={<RouteTraceMark className="size-7" />} /></div></Specimen><Specimen title="Escala de carga" description="Una lectura rápida del esfuerzo."><LoadScale value={load} onChange={setLoad} /></Specimen><Specimen title="Tarjeta de sesión" description="Plan, duración e intensidad en una pieza."><SessionCard /></Specimen><Specimen title="Pulso de recuperación" description="Tres señales y una recomendación clara."><RecoverySignal /></Specimen><Specimen title="Dificultad de vía" description="Color y texto: nunca color solamente."><div className="flex flex-wrap gap-2">{climbingGrades.map((grade) => <GradeBadge key={grade} grade={grade as ClimbingGrade} />)}</div><p className="mt-4 text-sm text-muted-foreground">Verde → Azul → Amarillo → Naranja → Rojo → Violeta → Negro</p></Specimen></div></div></main>;
}

function Specimen({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>;
}
