import { Inter } from "next/font/google";
import { GLOBAL_CSS, PLATFORM_NAME } from "@/lib/ui/tokens";
import { NotifyProvider } from "./_components/Notify";

// Inter, self-hosted by next/font at build time. This replaces THREE separate
// render-blocking Google Fonts requests that previously existed:
//   app/dashboard/page.tsx     <link>  Space Grotesk + JetBrains Mono
//   app/login/page.tsx         <link>  Space Grotesk + JetBrains Mono
//   app/portal/portalTheme.ts  @import Inter + JetBrains Mono
//
// The portal's was the most costly: an @import inside a runtime-injected
// <style> cannot be preloaded and serialises behind the stylesheet parse,
// delaying first paint on the surface customers actually use.
//
// One family now serves both frontends, so the product stops presenting two
// different display faces (Space Grotesk on admin/login, Inter on the portal).
// Monospace is a system stack (--font-mono) rather than a fourth download.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
});

// The platform's own identity, never a tenant's. A signed-in customer's
// business name is applied on top of this per page (see PortalShell), and this
// remains the title for everything outside a tenant context — the login page,
// errors, and the first paint before a brand has resolved.
export const metadata = {
  title: PLATFORM_NAME,
  description: "Autonomous SEO operations dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body style={{ margin: 0, fontFamily: "var(--font-sans)", background: "#0b0f14", color: "#e6edf3" }}>
        {/* Mounted once at the root so /dashboard and /portal share one toast
            stack and one confirm dialog, and shared components can raise either
            without knowing which tree they are rendering in. */}
        <NotifyProvider>{children}</NotifyProvider>
      </body>
    </html>
  );
}
