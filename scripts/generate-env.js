#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const VALID_ROLES = new Set(["api", "worker"]);
const VALID_STAGES = new Set(["development", "production"]);

function main() {
    try {
        const args = parseArgs(process.argv.slice(2));

        if (args.helpRequested) {
            printHelp();
            return;
        }

        const role = normalizeOption(
            "role",
            args.role,
            VALID_ROLES,
            "api|worker",
        );
        const stage = normalizeOption(
            "stage",
            args.stage,
            VALID_STAGES,
            "development|production",
        );

        const sourcePath = path.resolve(
            process.cwd(),
            args.source ?? ".env.example",
        );
        const outputPath = path.resolve(
            process.cwd(),
            args.output ?? ".env.generated",
        );

        if (!fs.existsSync(sourcePath)) {
            throw new Error(
                `Template file not found: ${path.relative(process.cwd(), sourcePath)}`,
            );
        }

        if (fs.existsSync(outputPath) && !args.force) {
            throw new Error(
                `Output file already exists: ${path.relative(process.cwd(), outputPath)} (use --force to overwrite)`,
            );
        }

        const template = fs.readFileSync(sourcePath, "utf8");
        const overrides = buildOverrides(role, stage);
        const contents = applyOverrides(template, overrides);

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, contents, "utf8");

        console.log(
            `[env:generate] wrote ${path.relative(process.cwd(), outputPath)} (APP_ROLE=${role}, DEPLOY_STAGE=${stage})`,
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[env:generate] ${message}`);
        process.exit(1);
    }
}

function parseArgs(argv) {
    const result = {
        role: undefined,
        stage: undefined,
        source: undefined,
        output: undefined,
        force: false,
        helpRequested: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        switch (arg) {
            case "--role":
            case "-r":
                result.role = requireValue(arg, argv[++i]);
                break;
            case "--stage":
            case "-s":
                result.stage = requireValue(arg, argv[++i]);
                break;
            case "--source":
                result.source = requireValue(arg, argv[++i]);
                break;
            case "--output":
            case "-o":
                result.output = requireValue(arg, argv[++i]);
                break;
            case "--force":
            case "-f":
                result.force = true;
                break;
            case "--help":
            case "-h":
                result.helpRequested = true;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return result;
}

function normalizeOption(name, value, validSet, hint) {
    if (!value) {
        throw new Error(`Missing required --${name} (expected ${hint})`);
    }
    const normalized = value.trim().toLowerCase();
    if (validSet.has(normalized)) {
        return normalized;
    }
    throw new Error(`Invalid ${name}: ${value}. Expected ${hint}.`);
}

function requireValue(flag, value) {
    if (!value || value.startsWith("-")) {
        throw new Error(`Flag ${flag} requires a value`);
    }
    return value;
}

function buildOverrides(role, stage) {
    const overrides = new Map();
    overrides.set("APP_ROLE", role);
    overrides.set("DEPLOY_STAGE", stage);
    overrides.set(
        "NODE_ENV",
        stage === "development" ? "development" : "production",
    );
    return overrides;
}

const BANNER_PREFIX = "# Auto-generated from .env.example";

function applyOverrides(template, overrides) {
    const replacedKeys = new Set();
    const lines = template.split(/\r?\n/);

    const updatedLines = lines.map((line) => {
        const key = extractKey(line);
        if (!key) return line;
        const override = overrides.get(key);
        if (override === undefined) return line;
        replacedKeys.add(key);
        return `${key}=${override}`;
    });

    const missing = [];
    for (const [key, value] of overrides.entries()) {
        if (!replacedKeys.has(key)) {
            missing.push(`${key}=${value}`);
        }
    }

    if (missing.length > 0) {
        const insertionPoint = findInsertionPoint(updatedLines);
        const block = [
            "# --- Auto-generated overrides ---",
            ...missing,
            "# --- End overrides ---",
            "",
        ];
        updatedLines.splice(insertionPoint, 0, ...block);
    }

    const banner = buildBanner();
    const existingFirstLine = updatedLines[0]?.trim() ?? "";
    if (existingFirstLine.startsWith(BANNER_PREFIX)) {
        updatedLines[0] = banner;
    } else if (updatedLines.length === 0 || existingFirstLine.length === 0) {
        updatedLines.unshift(banner, "");
    } else {
        updatedLines.unshift(banner, "");
    }

    return updatedLines.join("\n");
}

function extractKey(line) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith("#")) {
        return undefined;
    }
    if (trimmed.startsWith("export ")) {
        return extractKey(trimmed.slice("export ".length));
    }
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
        return undefined;
    }
    const key = trimmed.slice(0, equalsIndex).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) {
        return undefined;
    }
    return key;
}

function findInsertionPoint(lines) {
    for (let i = 0; i < lines.length; i += 1) {
        const trimmed = lines[i].trim();
        if (trimmed.length === 0) {
            continue;
        }
        if (!trimmed.startsWith("#")) {
            return i;
        }
    }
    return lines.length;
}

function buildBanner() {
    return `${BANNER_PREFIX} on ${new Date().toISOString()}`;
}

function printHelp() {
    console.log(
        `Usage: node scripts/generate-env.js --role <api|worker> --stage <development|production> [options]\n\nOptions:\n  --role, -r        Target APP_ROLE (api|worker)\n  --stage, -s       Target DEPLOY_STAGE (development|production)\n  --source          Template file to read (default: .env.example)\n  --output, -o      File to write (default: .env.generated)\n  --force, -f       Overwrite output file when it already exists\n  --help, -h        Show this message\n`,
    );
}

main();
