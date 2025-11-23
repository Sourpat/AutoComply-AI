export type CodexLogEntry = {
  id: number;
  timestamp: string;
  command: string;
  payload: unknown;
};

type Listener = (entry: CodexLogEntry) => void;

let listeners: Listener[] = [];
let nextId = 1;

export function emitCodexCommand(command: string, payload: unknown) {
  const entry: CodexLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    command,
    payload,
  };

  // Keep existing console behavior for external log collectors
  // NOTE: command is prefixed exactly as before
  //       so any log-scraper / n8n / DevSupport agent still works.
  console.log(`CODEX_COMMAND: ${command}`, payload);

  // Notify in-app listeners (DevSupport panel)
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch (err) {
      // Don't let one bad listener break others
      console.error("Codex listener error", err);
    }
  }
}

export function subscribeToCodexLogs(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
