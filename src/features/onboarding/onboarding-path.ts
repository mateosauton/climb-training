export type OnboardingScreen = "gate" | "check-email" | "salud" | "listo" | "hoy";

export function pathToHoy(choice: "skip" | "connect"): OnboardingScreen[] {
  if (choice === "skip") return ["gate", "check-email", "salud", "hoy"];
  return ["gate", "check-email", "salud", "listo", "hoy"];
}

export function screensBeforeHoy(choice: "skip" | "connect"): number {
  return pathToHoy(choice).filter((screen) => screen !== "hoy").length;
}
