// Host-specific rewrite snippets for subdirectory proxy.

export type SnippetHost = "netlify" | "vercel" | "cloudflare" | "nginx" | "apache" | "unknown";

export const SNIPPET_HOSTS: { id: SnippetHost; label: string }[] = [
  { id: "netlify", label: "Netlify" },
  { id: "vercel", label: "Vercel" },
  { id: "cloudflare", label: "Cloudflare" },
  { id: "nginx", label: "nginx" },
  { id: "apache", label: "Apache" },
  { id: "unknown", label: "I don't know" },
];

export function proxyAppOrigin(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercel = (process.env.VERCEL_URL || "").replace(/\/+$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return "https://YOUR_APP_HOST";
}

export function rewriteSnippets(input: {
  namespace: string;
  token: string;
  appOrigin?: string;
  siteHost?: string;
}): Record<SnippetHost, { title: string; body: string; hint?: string }> {
  const ns = input.namespace;
  const token = input.token;
  const origin = (input.appOrigin || proxyAppOrigin()).replace(/\/+$/, "");
  const dest = `${origin}/s/${token}/${ns}/:splat`;
  const siteHost = input.siteHost || "www.example.com";

  return {
    netlify: {
      title: "_redirects (one line — 200 means proxy, not redirect)",
      body: `/${ns}/*  ${origin}/s/${token}/${ns}/:splat  200`,
      hint: "Put this in a _redirects file at the site root, then deploy.",
    },
    vercel: {
      title: "vercel.json (redeploy after saving)",
      body: JSON.stringify(
        {
          rewrites: [
            {
              source: `/${ns}/:path*`,
              destination: `${origin}/s/${token}/${ns}/:path*`,
            },
          ],
        },
        null,
        2
      ),
      hint: "The namespace must appear in both source and destination.",
    },
    cloudflare: {
      title: "Cloudflare Worker (route: yourdomain.com/" + ns + "/*)",
      body: `export default {
  async fetch(req) {
    const u = new URL(req.url);
    if (!u.pathname.startsWith("/${ns}/") && u.pathname !== "/${ns}") {
      return new Response("Not found", { status: 404 });
    }
    const target = new URL("${origin}/s/${token}/${ns}/" + u.pathname.slice("/${ns}/".length) + u.search);
    const headers = new Headers(req.headers);
    headers.set("X-Forwarded-Host", u.host);
    return fetch(target, { method: req.method, headers, body: req.body, redirect: "manual" });
  }
};`,
      hint: "Attach the Worker to a route covering /" + ns + "/* and set X-Forwarded-Host. Keep /" + ns + "/ in the destination.",
    },
    nginx: {
      title: "nginx location",
      body: `location /${ns}/ {
  proxy_pass ${origin}/s/${token}/${ns}/;
  proxy_set_header Host ${origin.replace(/^https?:\/\//, "")};
  proxy_set_header X-Forwarded-Host $host;
  proxy_ssl_server_name on;
}`,
    },
    apache: {
      title: "Apache ProxyPass",
      body: `ProxyPass "/${ns}/" "${origin}/s/${token}/${ns}/"
ProxyPassReverse "/${ns}/" "${origin}/s/${token}/${ns}/"
RequestHeader set X-Forwarded-Host "%{HTTP_HOST}e"`,
    },
    unknown: {
      title: "Send this to your developer (or use a subdomain)",
      body: `Please add a reverse-proxy / rewrite so:

  https://${siteHost}/${ns}/*

is served from (HTTP 200 proxy, not a 301 redirect):

  ${dest.replace(":splat", "*")}

Requirements:
- Keep "/${ns}/" in both the public URL and the destination path
- Forward the original Host as X-Forwarded-Host
- Do not use a 301/302 redirect

Fallback if rewrites aren't possible: CNAME guides.${siteHost.replace(/^www\./, "")} → ${origin.replace(/^https?:\/\//, "")}
(subdomain SEO is weaker than a subdirectory; prefer the rewrite when you can.)`,
      hint: "Copy this into an email to whoever manages your site hosting.",
    },
  };
}
