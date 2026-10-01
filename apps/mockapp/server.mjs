import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const base = fileURLToPath(new URL(".", import.meta.url));
const roots = {
  "/app/": resolve(base, "dist"),
  "/core/": resolve(base, "../../packages/core/dist"),
  "/mock-data/": resolve(base, "../../packages/mock-data/dist"),
};
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let filename;
    if (pathname === "/") filename = resolve(base, "web/index.html");
    else if (pathname === "/style.css") filename = resolve(base, "web/style.css");
    else {
      const prefix = Object.keys(roots).find((key) => pathname.startsWith(key));
      if (prefix) {
        const root = roots[prefix];
        const candidate = resolve(root, pathname.slice(prefix.length));
        if (candidate.startsWith(`${root}/`) && extname(candidate) === ".js") filename = candidate;
      }
    }
    if (!filename) {
      response.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filename)],
      "Cache-Control": "no-store",
    }).end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});
server.listen(3000, "0.0.0.0", () => {
  console.log("Battle mock: http://localhost:3000");
});
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
