import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import vm from "node:vm";

const measurementId = "G-TESTONLY123";
const marker = /<script\b[^>]*data-google-analytics[^>]*>([\s\S]*?)<\/script>/g;
const removedPaths = ["/private/traffic", "/api/analytics/visit", "/api/analytics/click"];

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : path.endsWith(".html") ? [path] : [];
  }));
  return files.flat();
}

function runLoader(script, url) {
  const appended = [];
  const window = { location: new URL(url) };
  vm.runInNewContext(script, {
    window,
    document: {
      createElement: (tag) => { assert.equal(tag, "script"); return {}; },
      head: { appendChild: (element) => appended.push(element) },
    },
  });
  return { appended, window };
}

for (const [name, vercelEnvironment, id, expected] of [
  ["local build", "", measurementId, false],
  ["Vercel preview", "preview", measurementId, false],
  ["production without an ID", "production", "", false],
  ["production", "production", measurementId, true],
]) {
  const build = spawnSync("npm", ["run", "build"], {
    env: { ...process.env, VERCEL_ENV: vercelEnvironment, PUBLIC_GA_MEASUREMENT_ID: id },
    encoding: "utf8",
  });
  assert.equal(build.status, 0, `${name} build failed:\n${build.stdout}\n${build.stderr}`);
  const files = await htmlFiles(".vercel/output/static");
  assert.ok(files.some((path) => path.endsWith("/index.html")), "Homepage was built");
  for (const file of files) {
    const html = await readFile(file, "utf8");
    assert.ok(!html.includes("/api/analytics/"), `${file} retains the old tracker`);
    const scripts = [...html.matchAll(marker)];
    assert.equal(scripts.length, expected ? 1 : 0, `${name}: ${file}`);
    if (!expected) {
      assert.ok(!html.includes("googletagmanager.com"), `${name} loads Google`);
      assert.ok(!html.includes(measurementId), `${name} contains the tracking ID`);
      continue;
    }
    for (const host of ["jaredsystems.com", "www.jaredsystems.com"]) {
      const { appended, window } = runLoader(scripts[0][1], `https://${host}/`);
      assert.equal(appended.length, 1);
      assert.equal(appended[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
      assert.equal(appended[0].async, true);
      const commands = Array.from(window.dataLayer, (args) => Array.from(args));
      assert.equal(commands.length, 2, "Initialize once; config sends one automatic page view");
      assert.equal(commands[0][0], "js");
      assert.deepEqual(commands[1], ["config", measurementId]);
    }
    for (const url of [
      "http://localhost:4321/", "https://localhost/", "http://127.0.0.1/",
      "https://blog-preview.vercel.app/", "https://jaredsystems.com.example.com/",
      "http://jaredsystems.com/", "https://www.jaredsystems.com:4321/",
    ]) {
      const { appended, window } = runLoader(scripts[0][1], url);
      assert.equal(appended.length, 0, `${url} must not contact Google`);
      assert.equal(window.dataLayer, undefined, `${url} must not initialize tracking`);
      assert.equal(window.gtag, undefined);
    }
  }
  for (const path of removedPaths) {
    assert.ok(!files.some((file) => file.endsWith(`${path}.html`)), `${path} is still built`);
  }
  console.log(`PASS: ${name}, ${files.length} pages`);
}

// Even accidentally copying production environment variables into development
// must not enable tracking. Use a real dev server to check Astro's DEV gate.
const port = 14327;
const server = spawn(process.execPath, ["node_modules/astro/astro.js", "dev", "--host", "127.0.0.1", "--port", String(port)], {
  env: { ...process.env, VERCEL_ENV: "production", PUBLIC_GA_MEASUREMENT_ID: measurementId },
  stdio: "ignore",
});
try {
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    assert.equal(server.exitCode, null, "Development server exited early");
    try {
      const response = await fetch(origin);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.ok(!html.includes("data-google-analytics"));
      assert.ok(!html.includes("googletagmanager.com"));
      assert.ok(!html.includes(measurementId));
      ready = true;
      break;
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      await delay(250);
    }
  }
  assert.ok(ready, "Development server did not start");
  for (const path of removedPaths) {
    const response = await fetch(`${origin}${path}`, {
      method: path.startsWith("/api/") ? "POST" : "GET",
    });
    assert.equal(response.status, 404, `${path} should be removed`);
  }
  console.log("PASS: development with production variables sends no analytics; retired routes return 404");
} finally {
  server.kill("SIGTERM");
}
