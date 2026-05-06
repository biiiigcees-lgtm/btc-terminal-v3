"use client";
// lib/useAlphaStream.ts — Triggers execution pipeline on each incoming signal

import { useEffect, useRef } from "react";
import { useTerminal } from "@/store/terminal";
import { processSignal } from "./signalPipeline";

export function useAlphaStream() {
  const autoMode = useTerminal((s) => s.autoMode);
  const signal = useTerminal((s) => s.signal);
  // Track the last timestamp processed so we never fire twice on the same signal
  const lastProcessedRef = useRef<number>(0);

  useEffect(() => {
    if (!autoMode || !signal || signal.direction === "WAIT") return;
    if (signal.timestamp === lastProcessedRef.current) return;
    lastProcessedRef.current = signal.timestamp;
    processSignal(signal);
  }, [autoMode, signal?.timestamp]);
}
