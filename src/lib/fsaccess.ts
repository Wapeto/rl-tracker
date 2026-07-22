/**
 * Thin, typed wrappers over the File System Access API (Chromium only).
 *
 * The permission methods (`queryPermission` / `requestPermission`) and
 * `showOpenFilePicker` aren't in the standard DOM lib, so we declare the small
 * surface we use rather than reaching for `any`.
 */

type FsPermissionMode = "read" | "readwrite";

export interface LogFileHandle {
  getFile(): Promise<File>;
  queryPermission?(desc: { mode: FsPermissionMode }): Promise<PermissionState>;
  requestPermission?(desc: { mode: FsPermissionMode }): Promise<PermissionState>;
}

interface OpenFilePickerOptions {
  id?: string;
  startIn?: string;
  multiple?: boolean;
  types?: { description?: string; accept: Record<string, string[]> }[];
}

type ShowOpenFilePicker = (
  options?: OpenFilePickerOptions,
) => Promise<LogFileHandle[]>;

function getPicker(): ShowOpenFilePicker | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker })
    .showOpenFilePicker;
}

/** True when the browser supports live file handles (Chrome/Edge/Brave/Opera). */
export function supportsFileSystemAccess(): boolean {
  return getPicker() !== undefined;
}

/**
 * Opens the picker for the Launch.log file, starting near the Documents folder.
 * Returns null if unsupported or cancelled.
 */
export async function pickLogFile(): Promise<LogFileHandle | null> {
  const picker = getPicker();
  if (!picker) {
    return null;
  }
  try {
    const [handle] = await picker({
      id: "rl-launch-log",
      startIn: "documents",
      multiple: false,
      types: [
        {
          description: "Rocket League log",
          accept: { "text/plain": [".log"] },
        },
      ],
    });
    return handle ?? null;
  } catch {
    // AbortError when the user cancels — treated as "no selection".
    return null;
  }
}

/**
 * Ensures read permission for a stored handle. When `prompt` is false this only
 * checks (safe to call without a user gesture); when true it may request access.
 */
export async function ensureReadPermission(
  handle: LogFileHandle,
  prompt: boolean,
): Promise<boolean> {
  if (!handle.queryPermission) {
    return true;
  }
  const current = await handle.queryPermission({ mode: "read" });
  if (current === "granted") {
    return true;
  }
  if (!prompt || !handle.requestPermission) {
    return false;
  }
  const requested = await handle.requestPermission({ mode: "read" });
  return requested === "granted";
}
