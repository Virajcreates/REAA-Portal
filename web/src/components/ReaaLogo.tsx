interface ReaaLogoProps {
  size?: number;
  variant?: "dark" | "light";
}

export function ReaaLogo({ size = 34, variant = "light" }: ReaaLogoProps) {
  const frameBg = variant === "dark" ? "#C2512B" : "#1F1D1A";
  const strokePrimary = "#FAF8F3";
  const accentMark = variant === "dark" ? "#1F1D1A" : "#C2512B";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="40" height="40" rx="9" fill={frameBg} />
      <rect x="8.5" y="15.5" width="9" height="16" rx="1.5" stroke={strokePrimary} strokeWidth="2.2" />
      <path
        d="M17.5 11.5C17.5 10.67 18.17 10 19 10H29.5C30.33 10 31 10.67 31 11.5V31.5H17.5V11.5Z"
        stroke={strokePrimary}
        strokeWidth="2.2"
      />
      <rect x="21.5" y="14.5" width="5.5" height="3.2" rx="0.8" fill={strokePrimary} />
      <rect x="21.5" y="20.5" width="5.5" height="3.2" rx="0.8" fill={strokePrimary} />
      <rect x="11.5" y="20.5" width="3" height="3" rx="0.6" fill={strokePrimary} />
      <circle cx="24.25" cy="27.5" r="2" fill={accentMark} />
    </svg>
  );
}
