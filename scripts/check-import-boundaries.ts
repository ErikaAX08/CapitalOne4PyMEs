#!/usr/bin/env -S node --import tsx
// Enforces the dependency direction from PLAN_MIGRACION_ARQUITECTURA.md:
//   app -> features -> entities -> shared
// and forbids deep imports into another slice's internals -- consumers
// outside a slice must import its public `index.ts` (the bare alias),
// never a path underneath it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dirname, "..", "src");
const LAYER_RANK: Record<string, number> = {
  app: 3,
  features: 2,
  entities: 1,
  shared: 0,
};

interface Slice {
  layer: string;
  name: string; // "app", "shared", or "features/x" / "entities/x"
}

function sliceOf(relPath: string): Slice | null {
  const parts = relPath.split("/");
  const layer = parts[0];
  if (layer === "app" || layer === "shared") return { layer, name: layer };
  if (layer === "features" || layer === "entities") {
    if (!parts[1]) return null;
    return { layer, name: `${layer}/${parts[1]}` };
  }
  return null;
}

function sliceOfSpecifier(specifier: string): Slice | null {
  const match = specifier.match(
    /^@(app|features|entities|shared)(?:\/([^/]+))?/,
  );
  if (!match) return null;
  const [, layer, name] = match;
  if (layer === "app" || layer === "shared") return { layer, name: layer };
  if (!name) return null;
  return { layer, name: `${layer}/${name}` };
}

function isDeepImport(specifier: string, slice: Slice): boolean {
  if (slice.layer === "app" || slice.layer === "shared") {
    // @shared/lib/x is fine -- shared has no internal sub-slices to hide.
    return false;
  }
  // @features/x or @entities/x is the public surface; @features/x/anything is deep.
  return specifier !== `@${slice.name}`;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts"))
      out.push(full);
  }
  return out;
}

const importRe = /^\s*import\s+(?:type\s+)?[^;]*?\bfrom\s+["']([^"']+)["']/gm;
const sideEffectImportRe = /^\s*import\s+["']([^"']+)["']/gm;

const violations: string[] = [];

for (const file of listFiles(SRC)) {
  const relPath = relative(SRC, file);
  const fileSlice = sliceOf(relPath);
  if (!fileSlice) continue;
  const source = readFileSync(file, "utf8");
  const specifiers = new Set<string>();
  for (const re of [importRe, sideEffectImportRe]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) specifiers.add(m[1]);
  }
  for (const specifier of specifiers) {
    const importedSlice = sliceOfSpecifier(specifier);
    if (!importedSlice) continue; // relative import or external package
    if (importedSlice.name === fileSlice.name) continue; // same-slice, fine

    if (LAYER_RANK[importedSlice.layer] > LAYER_RANK[fileSlice.layer]) {
      violations.push(
        `${relPath}: "${specifier}" -- ${fileSlice.name} may not import ${importedSlice.name} (reverse of app -> features -> entities -> shared)`,
      );
      continue;
    }
    if (isDeepImport(specifier, importedSlice)) {
      violations.push(
        `${relPath}: "${specifier}" -- deep import into ${importedSlice.name}'s internals; import from "@${importedSlice.name}" instead`,
      );
    }
  }
}

if (violations.length) {
  console.error(`Found ${violations.length} import boundary violation(s):\n`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
} else {
  console.log("No import boundary violations found.");
}
