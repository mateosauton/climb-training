export type HealthPlatform = "ios" | "android";

/** One native provider. Android gets Health Connect; every other OS gets Apple Salud. */
export function nativeHealthPlatform(userAgent: string): HealthPlatform {
  return /android/i.test(userAgent) ? "android" : "ios";
}

export function healthSettingsHref(platform: HealthPlatform): string {
  if (platform === "android") return "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";
  return "x-apple-health://";
}

export type HealthConnectResult = "connected" | "denied";

export interface HealthConnector {
  connect(platform: HealthPlatform): Promise<HealthConnectResult>;
}

export function createStubHealthConnector(outcome: HealthConnectResult = "connected", delayMs = 700): HealthConnector {
  return {
    async connect() {
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return outcome;
    }
  };
}
