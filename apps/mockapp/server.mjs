import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve, extname, dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const compress = promisify(gzip);

const base = fileURLToPath(new URL(".", import.meta.url));
const workspace = resolve(base, "../..");
const mockDataRequire = createRequire(
  resolve(workspace, "packages/mock-data/package.json"),
);
const rendererRoot = resolve(workspace, "packages/renderer");
const assetsRoot = resolve(workspace, "packages/assets");
const uiRoot = resolve(workspace, "packages/ui");
const rendererRequire = createRequire(resolve(rendererRoot, "package.json"));
const clients = new Set();
let revision = 0;
let building = false;
let pendingBuild = false;

function reload() {
  revision += 1;
  for (const client of clients) client.write(`data: ${revision}\n\n`);
}

function rebuild() {
  if (building) {
    pendingBuild = true;
    return;
  }
  building = true;
  console.log("Rebuilding mock app…");
  const child = spawn("pnpm", ["run", "build"], {
    cwd: workspace,
    stdio: "inherit",
  });
  const finish = (success) => {
    building = false;
    if (pendingBuild) {
      pendingBuild = false;
      rebuild();
    } else if (success) reload();
  };
  child.once("error", (error) => {
    console.error(error.message);
    finish(false);
  });
  child.once("exit", (code) => finish(code === 0));
}

async function snapshot(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filename = resolve(directory, entry.name);
      if (entry.isDirectory()) return snapshot(filename);
      const info = await stat(filename);
      return `${filename}:${info.mtimeMs}:${info.size}`;
    }),
  );
  return files.sort().join("\n");
}

const sourceDirectories = [
  "packages/assets/src",
  "packages/core/src",
  "packages/mock-data/src",
  "packages/renderer/src",
  "packages/ui/src",
  "packages/app/src",
  "apps/mockapp/src",
];
const sourceSnapshot = () =>
  Promise.all(
    sourceDirectories.map((path) => snapshot(resolve(workspace, path))),
  );
let sources = (await sourceSnapshot()).join("\n");
const webSnapshot = async () =>
  (
    await Promise.all([
      snapshot(resolve(base, "web")),
      snapshot(resolve(assetsRoot, "runtime")),
    ])
  ).join("\n");
let web = await webSnapshot();
let checking = false;
const watcher = setInterval(async () => {
  if (checking) return;
  checking = true;
  try {
    const nextSources = (await sourceSnapshot()).join("\n");
    const nextWeb = await webSnapshot();
    if (nextSources !== sources) {
      sources = nextSources;
      rebuild();
    }
    if (nextWeb !== web) {
      web = nextWeb;
      if (building) pendingBuild = true;
      else reload();
    }
  } catch (error) {
    console.error(error.message);
  } finally {
    checking = false;
  }
}, 500);
const roots = {
  "/assets/": assetsRoot,
  "/ui/": uiRoot,
  "/renderer/": rendererRoot,
  "/app/": resolve(base, "dist"),
  "/game-app/": resolve(workspace, "packages/app/dist"),
  "/core/": resolve(base, "../../packages/core/dist"),
  "/mock-data/": resolve(base, "../../packages/mock-data/dist"),
  "/zod/": dirname(mockDataRequire.resolve("zod")),
  "/pixi/": resolve(dirname(rendererRequire.resolve("pixi.js")), "../dist"),
};
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (pathname === "/__reload") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      response.write(`data: ${revision}\n\n`);
      clients.add(response);
      response.on("close", () => clients.delete(response));
      return;
    }
    let filename;
    if (pathname === "/") filename = resolve(base, "web/index.html");
    else if (pathname === "/style.css")
      filename = resolve(base, "web/style.css");
    else {
      const prefix = Object.keys(roots).find((key) => pathname.startsWith(key));
      if (prefix) {
        const root = roots[prefix];
        const candidate = resolve(root, pathname.slice(prefix.length));
        const extensions =
          prefix === "/assets/"
            ? pathname.startsWith(`${prefix}runtime/`)
              ? [".png", ".json"]
              : pathname.startsWith(`${prefix}dist/`)
                ? [".js", ".mjs"]
                : []
            : [".js", ".mjs"];
        if (
          candidate.startsWith(`${root}/`) &&
          extensions.includes(extname(candidate))
        )
          filename = candidate;
      }
    }
    if (!filename) {
      response.writeHead(404).end("Not found");
      return;
    }
    const info = await stat(filename);
    const etag = `W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    const extension = extname(filename);
    const compressible = [".html", ".css", ".js", ".mjs", ".json"].includes(
      extension,
    );
    const headers = {
      "Content-Type": contentTypes[extension],
      // Store locally, but revalidate so edits and hot reload never use stale files.
      "Cache-Control": "no-cache",
      ETag: etag,
      ...(compressible ? { Vary: "Accept-Encoding" } : {}),
    };
    if (
      request.headers["if-none-match"]
        ?.split(",")
        .some((value) => value.trim() === etag || value.trim() === "*")
    ) {
      response.writeHead(304, headers).end();
      return;
    }
    let body = await readFile(filename);
    const acceptsGzip = (request.headers["accept-encoding"] ?? "")
      .split(",")
      .some((entry) => {
        const [encoding, ...parameters] = entry.trim().split(";");
        const quality = parameters.find((value) =>
          value.trim().startsWith("q="),
        );
        return (
          encoding === "gzip" &&
          (!quality || Number(quality.trim().slice(2)) > 0)
        );
      });
    if (compressible && acceptsGzip && body.length >= 1024) {
      body = await compress(body);
      headers["Content-Encoding"] = "gzip";
    }
    headers["Content-Length"] = body.length;
    response
      .writeHead(200, headers)
      .end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
const port = Number(process.env.PORT ?? 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`Battle mock: http://localhost:${port}`);
});
server.on("error", (error) => {
  clearInterval(watcher);
  console.error(error.message);
  process.exitCode = 1;
});
