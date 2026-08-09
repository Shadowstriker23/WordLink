"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type PanelTarget =
  | { kind: "word"; word: string; hideMeanings?: boolean }
  | { kind: "tag"; name: string; type?: string }
  | null;

interface TagPanelContextValue {
  target: PanelTarget;
  setTarget: (t: PanelTarget) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}

const Ctx = createContext<TagPanelContextValue>({
  target: null,
  setTarget: () => {},
  open: true,
  setOpen: () => {},
});

export function TagPanelProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PanelTarget>(null);
  const [open, setOpen] = useState(true);
  return (
    <Ctx.Provider value={{ target, setTarget, open, setOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTagPanel() {
  return useContext(Ctx);
}
