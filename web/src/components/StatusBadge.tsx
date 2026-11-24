interface StatusBadgeProps {
  status: string;
}

const STYLES: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  active: {
    bg: "var(--success-soft)",
    border: "var(--success-border)",
    text: "var(--success)",
    dot: "var(--success)",
    label: "Active",
  },
  approved: {
    bg: "var(--success-soft)",
    border: "var(--success-border)",
    text: "var(--success)",
    dot: "var(--success)",
    label: "Approved",
  },
  pending: {
    bg: "var(--warning-soft)",
    border: "var(--warning-border)",
    text: "var(--warning)",
    dot: "var(--warning)",
    label: "Pending Review",
  },
  paused: {
    bg: "var(--warning-soft)",
    border: "var(--warning-border)",
    text: "var(--warning)",
    dot: "var(--warning)",
    label: "Paused",
  },
  suspended: {
    bg: "var(--danger-soft)",
    border: "var(--danger-border)",
    text: "var(--danger)",
    dot: "var(--danger)",
    label: "Suspended",
  },
  revoked: {
    bg: "var(--danger-soft)",
    border: "var(--danger-border)",
    text: "var(--danger)",
    dot: "var(--danger)",
    label: "Revoked",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const s = STYLES[status] ?? {
    bg: "var(--bg-subtle)",
    border: "var(--border)",
    text: "var(--text-secondary)",
    dot: "var(--text-tertiary)",
    label: status,
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-0.5 text-[13px] font-medium leading-5"
      style={{
        backgroundColor: s.bg,
        borderColor: s.border,
        color: s.text,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: s.dot }}
        aria-hidden="true"
      />
      {s.label}
    </span>
  );
}
