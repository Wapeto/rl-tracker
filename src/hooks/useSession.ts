"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Stores the current session's start time (epoch ms). Separate key from the
 * match history so starting a session never touches recorded matches. A value
 * of 0 means "no session started yet" — stats then cover all-time until the
 * user starts one.
 */
const SESSION_KEY = "rl-tracker:sessionStart:v1";

function loadSessionStart(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return 0;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

interface UseSessionResult {
  sessionStart: number;
  loaded: boolean;
  startNewSession: () => void;
}

export function useSession(): UseSessionResult {
  const [sessionStart, setSessionStart] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSessionStart(loadSessionStart());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(SESSION_KEY, String(sessionStart));
    } catch {
      // Non-fatal for a local tracker.
    }
  }, [sessionStart, loaded]);

  const startNewSession = useCallback(() => {
    setSessionStart(Date.now());
  }, []);

  return { sessionStart, loaded, startNewSession };
}
