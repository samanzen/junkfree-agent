// Minimal hand-rolled icon set for the Portal nav + section headers.
// Zero new dependencies — plain inline SVG, stroke-based, 20x20 viewBox,
// consistent with the rest of the app's no-icon-library convention.
type IconProps = { size?: number; className?: string };
const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export function IconDashboard({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>;
}
export function IconIntelligence({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 2a5 5 0 0 0-5 5c0 1.6.7 2.5 1.5 3.4.6.7 1 1.3 1 2.1V14h5v-1.5c0-.8.4-1.4 1-2.1.8-.9 1.5-1.8 1.5-3.4a5 5 0 0 0-5-5Z" /><path d="M9.5 17h5M10 20h4" /></svg>;
}
export function IconLocalSeo({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" /></svg>;
}
export function IconWebsite({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" /></svg>;
}
export function IconContent({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></svg>;
}
export function IconReviews({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z" /></svg>;
}
export function IconReports({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2 20h20" /></svg>;
}
export function IconBilling({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></svg>;
}
export function IconSettings({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1Z" /></svg>;
}
export function IconAssistant({ size = 18, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 3v3M5.6 6.6l2 2M18.4 6.6l-2 2" /><rect x="4" y="10" width="16" height="10" rx="4" /><path d="M9 15v.01M15 15v.01" /></svg>;
}
export function IconChevron({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="m9 6 6 6-6 6" /></svg>;
}
export function IconSun({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>;
}
export function IconMoon({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
}
export function IconMenu({ size = 20, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M3 6h18M3 12h18M3 18h18" /></svg>;
}
export function IconClose({ size = 20, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
export function IconExternal({ size = 14, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M7 17 17 7M9 7h8v8" /></svg>;
}
export function IconCheck({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M20 6 9 17l-5-5" /></svg>;
}
export function IconAlert({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 9v4M12 17v.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
}
export function IconArrowUp({ size = 12, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
}
export function IconArrowDown({ size = 12, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>;
}
export function IconSparkle({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>;
}
export function IconSend({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="m3 11 18-8-8 18-2-8-8-2Z" /></svg>;
}
export function IconLock({ size = 14, className }: IconProps) {
  return <svg {...base(size)} className={className}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

// ── Metric icons (KPI chips) ────────────────────────────────────────────────
export function IconTraffic({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M3 16.5 9 10l4 4 7.5-7.5" /><path d="M15 6.5h5.5V12" /></svg>;
}
export function IconKey({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3.5M15.5 12v2.5" /></svg>;
}
export function IconTarget({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>;
}
export function IconLink({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.9 6.4" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.4-1.4" /></svg>;
}
export function IconLeads({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7.5" r="3.5" /><path d="M17.5 4.5v6M20.5 7.5h-6" /></svg>;
}
export function IconPhone({ size = 16, className }: IconProps) {
  return <svg {...base(size)} className={className}><path d="M21 16.9v2.6a1.7 1.7 0 0 1-1.9 1.7 17 17 0 0 1-7.4-2.6 16.7 16.7 0 0 1-5.1-5.1A17 17 0 0 1 4 6.1 1.7 1.7 0 0 1 5.7 4.2h2.6a1.7 1.7 0 0 1 1.7 1.5c.1.9.3 1.7.6 2.5a1.7 1.7 0 0 1-.4 1.8l-1.1 1.1a13.7 13.7 0 0 0 5.1 5.1l1.1-1.1a1.7 1.7 0 0 1 1.8-.4c.8.3 1.6.5 2.5.6A1.7 1.7 0 0 1 21 16.9Z" /></svg>;
}
