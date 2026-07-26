export const metadata = {
  title: "Junk Free — SEO Agent",
  description: "Autonomous SEO operations dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#0b0f14", color: "#e6edf3" }}>
        {children}
      </body>
    </html>
  );
}
