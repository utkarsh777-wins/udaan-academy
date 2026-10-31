"use client";

import { useEffect, useState } from "react";

let open = false;
const listeners = new Set<(value: boolean) => void>();

export function setChatOpen(value: boolean) {
  open = value;
  listeners.forEach((listener) => listener(value));
}

export function useChatOpen() {
  const [value, setValue] = useState(open);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
