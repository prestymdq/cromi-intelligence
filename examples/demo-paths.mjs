import * as nodePath from "node:path";

/**
 * Restrict files to the demo's static assets. Works with Windows and POSIX paths.
 * The path API is injectable for cross-platform regression tests.
 */
export function resolveDemoAsset(root, pathname, pathApi = nodePath) {
  if (typeof pathname !== "string" || pathname.includes("\0") || pathname.includes("\\")) return null;
  const requestPath = pathname === "/" ? "/examples/widget.html" : pathname;
  if (!(requestPath === "/examples/widget.html" || requestPath.startsWith("/widget/") || requestPath.startsWith("/dist/"))) {
    return null;
  }
  const fullpath = pathApi.resolve(root, "." + requestPath);
  const relativePath = pathApi.relative(root, fullpath);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(".." + pathApi.sep) || pathApi.isAbsolute(relativePath)) {
    return null;
  }
  if (![".html", ".js", ".css"].includes(pathApi.extname(fullpath))) return null;
  return fullpath;
}
