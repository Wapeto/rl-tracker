"use client";

import { useEffect, useState } from "react";

/**
 * True on devices with a fine pointer (mouse/trackpad) — i.e. desktops. Used to
 * hide the Rocket League log sync, which is meaningless on a phone. Starts false
 * so server render and the mobile experience match.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
