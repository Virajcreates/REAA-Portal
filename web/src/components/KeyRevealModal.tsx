import { Check, Copy, Key, Warning } from "@phosphor-icons/react";
import { useState } from "react";

interface KeyRevealModalProps {
  keyName: string;
  rawKey: string;
  onClose: () => void;
}

export function KeyRevealModal({ keyName, rawKey, onClose }: KeyRevealModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "oklch(17.5% 0.012 75 / 0.52)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-reveal-title"
    >
      <div
        className="w-full max-w-lg rounded-[12px] border p-6 shadow-xl"
        style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-strong)" }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border"
            style={{
              backgroundColor: "var(--accent-soft)",
              borderColor: "var(--accent-border)",
              color: "var(--accent)",
            }}
          >
            <Key size={20} weight="bold" />
          </div>
          <div>
            <h2 id="key-reveal-title" className="text-[18px] font-semibold">
              Save your API key — {keyName}
            </h2>
            <p className="mt-1 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              This secret key is shown once and stored only as a cryptographic hash. If lost, revoke
              it and mint a replacement.
            </p>
          </div>
        </div>

        <div
          className="mt-5 flex items-center justify-between gap-2 rounded-[8px] border px-3.5 py-3"
          style={{ backgroundColor: "var(--bg-ink)", borderColor: "var(--border-ink)" }}
        >
          <code
            className="font-mono-num break-all text-[13px] select-all"
            style={{ color: "var(--text-on-ink)" }}
          >
            {rawKey}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-medium"
            style={{
              backgroundColor: copied ? "var(--success)" : "var(--accent)",
              color: "var(--text-on-accent)",
            }}
          >
            {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div
          className="mt-4 flex items-start gap-2.5 rounded-[8px] border px-3.5 py-2.5 text-[13px]"
          style={{
            backgroundColor: "var(--warning-soft)",
            borderColor: "var(--warning-border)",
            color: "var(--warning)",
          }}
        >
          <Warning size={18} weight="bold" className="mt-0.5 shrink-0" />
          <span>Store this key in your server environment variables. Never commit it to client code.</span>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-[8px] px-5 text-[15px] font-semibold"
            style={{ backgroundColor: "var(--bg-ink)", color: "var(--text-on-ink)" }}
          >
            I have saved this key
          </button>
        </div>
      </div>
    </div>
  );
}
