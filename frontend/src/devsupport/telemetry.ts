// src/devsupport/telemetry.ts
import { emitCodexCommand } from "../utils/codexLogger";

export function trackSandboxEvent(eventName: string, payload: any) {
  emitCodexCommand(eventName, payload);
}
