import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildLlms, buildRobots, buildSitemap } from "./site-metadata.js";

function buildHeaders(partyHost: string): string {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    `connect-src 'self' https://${partyHost} wss://${partyHost}`,
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' blob: data:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");

  return `/*
  Content-Security-Policy: ${csp}
  Permissions-Policy: camera=(), geolocation=(), microphone=(self), payment=(), usb=()
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: no-cache
`;
}

function siteMetadata(origin: string, partyHost: string): Plugin {
  const assets = new Map([
    ["/_headers", buildHeaders(partyHost)],
    ["/robots.txt", buildRobots(origin)],
    ["/sitemap.xml", buildSitemap(origin)],
    ["/llms.txt", buildLlms(origin)],
  ]);

  return {
    name: "liminal-site-metadata",
    transformIndexHtml: (html) => html.replaceAll("__SITE_ORIGIN__", origin),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const content = assets.get(req.url ?? "");
        if (!content) return next();
        res.setHeader("Content-Type", req.url?.endsWith(".xml") ? "application/xml" : "text/plain");
        res.end(content);
      });
    },
    generateBundle() {
      for (const [path, source] of assets) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source });
      }
    },
  };
}

function productionEnvironment(env: Record<string, string>): { origin: string; partyHost: string } {
  const rawOrigin = env.VITE_PUBLIC_ORIGIN?.replace(/\/$/, "");
  const partyHost = env.VITE_PARTY_HOST;

  if (!rawOrigin) throw new Error("VITE_PUBLIC_ORIGIN is required for a production build");
  if (!partyHost) throw new Error("VITE_PARTY_HOST is required for a production build");

  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    throw new Error("VITE_PUBLIC_ORIGIN must be an absolute HTTPS origin");
  }
  if (origin.protocol !== "https:" || origin.origin !== rawOrigin || origin.hostname === "localhost") {
    throw new Error("VITE_PUBLIC_ORIGIN must be an HTTPS origin without a path or trailing slash");
  }
  if (
    partyHost.includes("://") ||
    partyHost.includes("/") ||
    partyHost.includes(":") ||
    partyHost === "localhost" ||
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(partyHost)
  ) {
    throw new Error("VITE_PARTY_HOST must be a production hostname without a scheme, path, or port");
  }
  return { origin: rawOrigin, partyHost };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const production = command === "build" && mode === "production";
  const publicEnvironment = production
    ? productionEnvironment(env)
    : {
        origin: (env.VITE_PUBLIC_ORIGIN || "http://localhost:5173").replace(/\/$/, ""),
        partyHost: env.VITE_PARTY_HOST || "localhost:1999",
      };

  return {
    plugins: [react(), siteMetadata(publicEnvironment.origin, publicEnvironment.partyHost)],
    server: { host: true, port: 5173 },
  };
});
