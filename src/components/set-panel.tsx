"use client";

import { useEffect } from "react";
import { useTagPanel, type PanelTarget } from "@/lib/tag-panel-context";

export function SetPanel({ target }: { target: PanelTarget }) {
  const { setTarget } = useTagPanel();
  useEffect(() => {
    setTarget(target);
  }, [target, setTarget]);
  return null;
}
