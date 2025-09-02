#!/usr/bin/env node
/*
 * Merge OpenAPI components from NestJS Swagger (swagger.nestjs.yaml)
 * into Nestia Swagger (swagger.yaml). Focuses on:
 *  - components.schemas (P0: DTO定義の欠落を補完)
 *  - tags（不足分の説明補完）
 *
 * 使い方:
 *   1) pnpm openapi:gen   // nestiaで swagger.yaml を生成
 *   2) node scripts/merge-openapi.js
 * 出力:
 *   swagger.yaml を上書き（整形JSON, 2スペース）
 */
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const ROOT = process.cwd();
const NESTIA_PATH = path.join(ROOT, "swagger.json");
const NESTJS_PATH = path.join(ROOT, "swagger.nestjs.yaml");

function readDoc(file) {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    const text = raw.trim();
    if (!text) return null;
    try {
        // nestiaはJSON、nestjsはYAMLが多いが、拡張子に依存せず中身で判定
        if (text.startsWith("{") || text.startsWith("[")) {
            return JSON.parse(text);
        }
        return yaml.load(text);
    } catch (e) {
        console.error(`Failed to parse ${path.basename(file)}:`, e.message);
        return null;
    }
}

function ensure(obj, key, fallback) {
    if (!obj[key]) obj[key] = fallback;
    return obj[key];
}

function mergeSchemas(baseDoc, nestjsDoc) {
    const baseSchemas = ensure(
        ensure(baseDoc, "components", {}),
        "schemas",
        {},
    );
    const srcSchemas = nestjsDoc?.components?.schemas || {};
    let added = 0;
    let replaced = 0;
    for (const [name, schema] of Object.entries(srcSchemas)) {
        if (!(name in baseSchemas)) {
            baseSchemas[name] = schema;
            added++;
        } else {
            const current = baseSchemas[name];
            // 置換条件: 空オブジェクト or プロパティ皆無の簡易形
            const isEmpty =
                current &&
                typeof current === "object" &&
                Object.keys(current).length === 0;
            if (isEmpty) {
                baseSchemas[name] = schema;
                replaced++;
            }
        }
    }
    return { added, replaced };
}

function isEmptySchema(schema) {
    if (!schema || typeof schema !== "object") return true;
    const keys = Object.keys(schema);
    if (keys.length === 0) return true;
    // Also treat { schema: {} } patterns
    if (keys.length === 1 && keys[0] === "$ref") return false;
    return false;
}

function mergeResponses(baseDoc, nestjsDoc) {
    const srcPaths = nestjsDoc?.paths || {};
    const basePaths = baseDoc.paths || {};
    const HTTP_METHODS = [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "head",
        "options",
        "trace",
    ];
    let added = 0;
    let enriched = 0;

    for (const [p, srcOps] of Object.entries(srcPaths)) {
        const baseOps = basePaths[p];
        if (!baseOps) continue; // 既存のnestiaのpathsに限ってマージ
        for (const m of HTTP_METHODS) {
            const srcOp = srcOps[m];
            const baseOp = baseOps[m];
            if (!srcOp || !baseOp) continue;
            const srcRes = srcOp.responses || {};
            baseOp.responses = baseOp.responses || {};
            for (const [code, srcR] of Object.entries(srcRes)) {
                const baseR = baseOp.responses[code];
                if (!baseR) {
                    baseOp.responses[code] = srcR;
                    added++;
                    continue;
                }
                // enrich description
                if (
                    (!baseR.description || baseR.description.length === 0) &&
                    srcR.description
                ) {
                    baseR.description = srcR.description;
                    enriched++;
                }
                // enrich headers
                if (srcR.headers) {
                    baseR.headers = baseR.headers || {};
                    for (const [h, def] of Object.entries(srcR.headers)) {
                        if (!baseR.headers[h]) {
                            baseR.headers[h] = def;
                            enriched++;
                        }
                    }
                }
                // enrich content schema if empty
                const srcJson = srcR.content?.["application/json"]?.schema;
                const baseJsonPath = baseR.content?.["application/json"];
                const baseSchema = baseJsonPath?.schema;
                const baseHasEmptySchema = isEmptySchema(baseSchema);
                if (srcJson && (baseHasEmptySchema || !baseSchema)) {
                    baseR.content = baseR.content || {};
                    baseR.content["application/json"] =
                        baseR.content["application/json"] || {};
                    baseR.content["application/json"].schema = srcJson;
                    enriched++;
                }
            }
        }
    }
    return { added, enriched };
}

function mergeTags(baseDoc, nestjsDoc) {
    const baseTags = ensure(baseDoc, "tags", []);
    const srcTags = Array.isArray(nestjsDoc?.tags) ? nestjsDoc.tags : [];
    const known = new Map(baseTags.map((t) => [t.name, t]));
    let added = 0;
    for (const t of srcTags) {
        if (!known.has(t.name)) {
            baseTags.push({ name: t.name, description: t.description });
            added++;
        } else {
            // 説明が空なら補完
            const cur = known.get(t.name);
            if (
                (!cur.description || cur.description.length === 0) &&
                t.description
            ) {
                cur.description = t.description;
            }
        }
    }
    return { added };
}

function main() {
    const base = readDoc(NESTIA_PATH);
    if (!base) {
        process.exit(1);
    }
    const src = readDoc(NESTJS_PATH);
    if (!src) {
        // beautifyして書き戻すだけ
        fs.writeFileSync(NESTIA_PATH, JSON.stringify(base, null, 2));
        console.log("Rewrote swagger.json (beautified). Done.");
        return;
    }

    const { added, replaced } = mergeSchemas(base, src);
    const tagRes = mergeTags(base, src);
    const respRes = mergeResponses(base, src);

    // 出力（整形JSON）
    fs.writeFileSync(NESTIA_PATH, JSON.stringify(base, null, 2));
    console.log(
        `Merged: schemas added=${added}, replacedEmpty=${replaced}; responses added=${respRes.added}, enriched=${respRes.enriched}; tags added=${tagRes.added}.`,
    );
    console.log("Wrote:", path.relative(ROOT, NESTIA_PATH));
}

main();
