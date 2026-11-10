import test from "node:test";
import assert from "node:assert/strict";
import { win32, posix } from "node:path";
import { resolveDemoAsset } from "../examples/demo-paths.mjs";

for (const [platform, path, root] of [
  ["Windows", win32, "C:\\work\\cromi-intelligence"],
  ["Linux/macOS", posix, "/home/user/cromi-intelligence"],
]) {
  test(platform + ": root and demo page resolve correctly", () => {
    assert.equal(resolveDemoAsset(root, "/", path), path.join(root, "examples", "widget.html"));
    assert.equal(resolveDemoAsset(root, "/examples/widget.html", path), path.join(root, "examples", "widget.html"));
  });

  test(platform + ": allows widget scripts, CSS and compiled engine", () => {
    for (const pathname of ["/widget/cromi-widget.js", "/widget/cromi-widget.css", "/dist/index.js"]) {
      assert.equal(resolveDemoAsset(root, pathname, path), path.join(root, ...pathname.slice(1).split("/")));
    }
  });

  test(platform + ": rejects traversal, sensitive files and unsupported resources", () => {
    for (const pathname of [
      "/widget/../../../secret.js",
      "/dist/../../secret.js",
      "/docs/INTEGRATION.md",
      "/.env",
      "/widget/..\\..\\secret.js",
      "/widget/data.json",
      "/widget/\0secret.js",
    ]) {
      assert.equal(resolveDemoAsset(root, pathname, path), null, pathname);
    }
  });
}
