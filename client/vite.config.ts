import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { buildLlms, buildRobots, buildSitemap } from "./site-metadata.js";

function siteMetadata(origin: string): Plugin {
  const assets = new Map([
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const origin = (env.VITE_PUBLIC_ORIGIN || "http://localhost:5173").replace(/\/$/, "");

  return {
    plugins: [react(), siteMetadata(origin)],
    server: { host: true, port: 5173 },
  };
});
