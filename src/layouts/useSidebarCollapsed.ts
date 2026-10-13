"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "tentvaale.sidebar.collapsed";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode or blocked storage: behave as "expanded" and just don't remember.
    return false;
  }
}

let memory: boolean | null = null;

function snapshot(): boolean {
  if (memory === null) memory = read();
  return memory;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the preference.
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      memory = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether the desktop sidebar is folded to its icon rail. Remembered per browser; expanded when nothing is stored. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  const toggle = useCallback(() => {
    memory = !snapshot();
    try {
      window.localStorage.setItem(KEY, memory ? "1" : "0");
    } catch {
      // Not remembered, still works for this visit.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [collapsed, toggle];
}
