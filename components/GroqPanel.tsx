"use client";
// components/GroqPanel.tsx — AI plain-English signal reasoning

import { useTerminal } from "@/store/terminal";
import clsx from "clsx";

export function GroqPanel() {
  const { groqComment, groqLoading, fetchGroqComment, signal } = useTerminal();

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-accent text-xs font-mono uppercase tracking-widest">AI Reasoning</span>
          <span className="text-dim text-[9px] font-mono bg-surface px-1.5 py-0.5 rounded">Groq llama-3.1-8b</span>
        </div>
        <button
          onClick={fetchGroqComment}
          disabled={groqLoading || !signal}
          className="text-[10px] font-mono text-dim hover:text-accent transition-colors disabled:opacity-30"
        >
          {groqLoading ? "Thinking..." : "↻ Refresh"}
        </button>
      </div>

      {groqLoading && (
        <div className="space-y-2">
          <div className="h-3 bg-surface rounded animate-pulse w-full" />
          <div className="h-3 bg-surface rounded animate-pulse w-4/5" />
          <div className="h-3 bg-surface rounded animate-pulse w-3/5" />
        </div>
      )}

      {!groqLoading && groqComment && (
        <div className="space-y-2">
          <p className="text-text text-xs font-body leading-relaxed">{groqComment.reasoning}</p>
          {groqComment.keyFactors.length > 0 && (
            <div className="border-t border-border/50 pt-2 space-y-1">
              {groqComment.keyFactors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] font-mono text-dim">
                  <span className="text-accent mt-0.5">›</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[9px] font-mono text-dim/50 text-right">
            {new Date(groqComment.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      {!groqLoading && !groqComment && (
        <div className="text-dim text-xs font-mono">
          Add <code className="bg-surface px-1 rounded text-accent">GROQ_API_KEY</code> to .env.local for AI reasoning.{" "}
          <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            Free at console.groq.com
          </a>
        </div>
      )}
    </div>
  );
}
