import { describe, expect, it } from "vitest";
import { plan } from "@/lib/training";
import { guidedSessionDefinitions } from "./guided-session-data";

const validPhases = new Set(["prepare", "work", "rest", "cooldown", "review"]);

const expectedDayContent: Record<string, Array<[string, string]>> = {
  w1d1: [["warmup", "15 min: movilidad de hombro, muñeca, cadera y escalada fácil."], ["limit-board", "4 problemas límite, 3-4 intentos por problema, máximo 14-16 intentos duros."], ["active-feet", "Pie activo y cadera cargada antes de cada mano."], ["weighted-pullup", "5x3 a RPE 8."], ["rings", "Remos 3x8 y push-ups 3x8-12."], ["prehab", "Rotación externa 2x20 y extensores de dedos 2x20."]],
  w1d2: [["rdl", "4x6 a RPE 7-8."], ["goblet-squat", "3x8."], ["kb-swing", "4x12."], ["core", "3 rondas: hollow hold, dead bug y side plank."], ["ring-support", "4x15-25 s."], ["prehab", "15 min: rotadores, YTWs y extensores de dedos. Sin board duro."]],
  w1d3: [["warmup", "20 min."], ["four-by-four", "3 rondas de 4x4 con 4 boulders al 60-75%. Descanso 30-60 s entre boulders y 5-6 min entre rondas. No fallar en la ronda 1."], ["cooldown", "10 min de enfriamiento y extensores de dedos 2x25."]],
  w1d4: [["mobility", "Caminata o movilidad 20-30 min."], ["bands", "Rotación externa 2x20 y face pulls 2x20."], ["finger-extensors", "2x25. Nada de agarres duros."]],
  w1d5: [["warmup", "20 min."], ["max-moves", "8-10 movimientos máximos aislados o links de 2-3 movimientos. Descanso 3-5 min."], ["submax", "2 problemas submáximos rápidos al 70%."], ["accessory", "Scap pull-ups 3x8 y lock-off corto en anillas 3x5 s por lado."], ["focus", "Deadpoint compacto y estabilizar 2 s."]],
  w1d6: [["aerobic", "6-8 x 90 s escalando / 90 s descanso a RPE 6-7. Alternativa: 3 x 8 min continuos en presas buenas."], ["focus", "Pie-cadera-mano, cadera girada y respiración estable."], ["prehab", "20 min."]],
  w1d7: [["rest", "Descanso total. Revisar dolor, sueño, energía y piel."]],
  w2d1: [["limit-board", "5 problemas límite, 15-20 intentos duros totales."], ["active-feet", "Cada intento empieza con pies definidos."], ["weighted-pullup", "6x3 a RPE 8-8.5."], ["rings", "Remos 3x8 y soporte 3x20 s."], ["prehab", "Bandas y extensores 10 min."]],
  w2d2: [["four-by-four", "4 rondas de 4x4. Descanso 30-45 s entre boulders y 4-5 min entre rondas. RPE final 9/10."], ["focus", "No colgarse de brazos largos; escápulas bajas y pies activos."]],
  w2d3: [["mobility", "Movilidad 20-30 min."], ["prehab", "Bandas suaves y extensores. Nada de agarres duros."]],
  w2d4: [["power", "10-12 intentos de movimientos explosivos o links de 2-4 movimientos. Descanso 3-5 min."], ["explosive-pullup", "6x2 con peso corporal."], ["ring-support", "4x15-25 s."], ["prehab", "Hombro y codo, 15 min."]],
  w2d5: [["rdl", "3x5 a RPE 7."], ["split-squat", "3x8 por pierna."], ["suitcase", "4x30-40 s por lado."], ["core", "15 min. Sin board."]],
  w2d6: [["route-circuits", "3-4 circuitos de 25-40 movimientos. Descanso 8-12 min. Caer o quedar al límite en el último 20-25%, no antes."], ["pacing", "Practicar respiración y sacudidas."]],
  w2d7: [["rest", "Descanso total. Si hubo dos sesiones malas seguidas, reducir el volumen de la semana 3."]],
  w3d1: [["limit-board", "3-4 problemas muy duros, 12-15 intentos excelentes totales. Descanso 4-6 min."], ["weighted-pullup", "5-6x2 a RPE 8.5-9."], ["prehab", "Anillas suaves y prehab. Cortar si dedos o codos se sienten raros."]],
  w3d2: [["mobility", "15-20 min."], ["prehab", "Bandas y extensores. Nada de agarres duros."]],
  w3d3: [["burns", "2 bloques de 3 burns. Cada burn: 2-3 min o 30-45 movimientos. Descanso 2-3 min entre burns y 10 min entre bloques. Alternativa: 4 rondas de 4x4 muy duras. Terminar si la técnica colapsa."]],
  w3d4: [["recovery", "Movilidad suave o caminata. Nada de board. Si hay dolor mayor a 2/10, convertir W3D5 en descanso."]],
  w3d5: [["short-power", "45-60 min totales. 6-8 intentos de máxima calidad. 2 links cortos submáximos si hay frescura. Sin volumen extra ni fuerza pesada."]],
  w3d6: [["route-test", "2-3 intentos largos en el circuito objetivo. Descanso 15-20 min."], ["pacing", "Practicar ritmo, reposos, respiración y sacudidas."], ["video", "Grabar un video corto."]],
  w3d7: [["rest", "Descanso total. Llegar fresco vale más que seguir sumando volumen."]],
  w4d1: [["limit-board", "8-10 intentos duros, sin fallo repetido. Terminar con sensación de frescura."], ["weighted-pullup", "3x2 a RPE 7-8."], ["prehab", "Bandas y extensores 10 min."]],
  w4d2: [["mobility", "20-30 min."], ["prehab", "Bandas suaves y extensores. Sin board."]],
  w4d3: [["reduced-pe", "2 rondas de 4x4 o 4 x 2 min de circuito a RPE 7.5-8. Mitad del volumen de la semana 3."], ["cooldown", "Enfriamiento y prehab."]],
  w4d4: [["rest", "Descanso total. Preparar el circuito o proyecto objetivo."]],
  w4d5: [["primer", "40-50 min totales. 4-6 movimientos duros con descanso largo. 2 links cortos del estilo objetivo. Terminar fresco."]],
  w4d6: [["warmup", "25-30 min."], ["attempts", "En roca o gimnasio: 2-3 pegues serios al grado objetivo. En casa: circuito de 35-50 movimientos o problema duro más extensión. Descanso 15-25 min."], ["video", "Grabar video con pies y cadera visibles."], ["success", "Evaluar mejor link, cortes de pie, swing, intentos y recuperación entre pegues."]],
  w4d7: [["review", "Comparar W1 con W4: mejor link, intentos, movimientos antes de caer, RPE, bombeo y dolor. Decidir el siguiente bloque."]]
};

describe("guided session content", () => {
  it("authors exactly one non-empty guide for every plan session", () => {
    expect(Object.keys(guidedSessionDefinitions).sort()).toEqual(plan.map(({ id }) => id).sort());

    for (const session of plan) {
      const definition = guidedSessionDefinitions[session.id];
      expect(definition.sessionId).toBe(session.id);
      expect(definition.version).toBe(1);
      expect(definition.objective.trim()).not.toBe("");
      expect(definition.safetyNote.trim()).not.toBe("");
      expect(definition.blocks.length).toBeGreaterThan(0);
    }
  });

  it("uses unique stable block and media ids with complete instructions", () => {
    const allMediaIds = new Set<string>();

    for (const definition of Object.values(guidedSessionDefinitions)) {
      const blockIds = definition.blocks.map(({ id }) => id);
      expect(new Set(blockIds).size).toBe(blockIds.length);

      for (const block of definition.blocks) {
        expect(validPhases.has(block.phase)).toBe(true);
        expect(block.instruction.trim()).not.toBe("");
        expect(block.steps.length).toBeGreaterThan(0);
        expect(block.cues.length).toBeGreaterThan(0);
        expect(block.narrationText.trim()).not.toBe("");
        expect(Array.isArray(block.equipment)).toBe(true);

        if (block.phase === "work") {
          expect(block.dose?.trim()).not.toBe("");
          expect(block.avoid?.trim()).not.toBe("");
        }

        for (const media of block.media) {
          expect(allMediaIds.has(media.id)).toBe(false);
          allMediaIds.add(media.id);
          expect(media.kind === "internal" ? media.url.startsWith("#") : media.url.startsWith("https://")).toBe(true);
          if (media.kind === "youtube") {
            expect(media.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
          }
        }
      }
    }
  });

  it("preserves the exact day-specific prescription without inserting extra blocks", () => {
    expect(Object.keys(expectedDayContent).sort()).toEqual(plan.map(({ id }) => id).sort());
    for (const [sessionId, expectedBlocks] of Object.entries(expectedDayContent)) {
      expect(guidedSessionDefinitions[sessionId].blocks.map(({ id, dose }) => [id, dose])).toEqual(expectedBlocks);
    }
  });

  it("retains internal tracker references as actionable media", () => {
    expect(guidedSessionDefinitions.w4d7.blocks[0].media).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "internal", url: "#profile" })]));
    expect(guidedSessionDefinitions.w4d6.blocks.find(({ id }) => id === "video")?.media).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "internal", url: "#video" })]));
  });
});
