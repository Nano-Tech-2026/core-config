# core-config

> Part of [backoffice-kit](https://github.com/Nano-Tech-2026/backoffice-kit). Typed, validated environment configuration for Node.js services (Zod).

[![CI](https://github.com/Nano-Tech-2026/core-config/actions/workflows/ci.yml/badge.svg)](https://github.com/Nano-Tech-2026/core-config/actions)
[![npm version](https://img.shields.io/npm/v/@nano-tech-2026-org/core-config)](https://www.npmjs.com/package/@nano-tech-2026-org/core-config)

## Why

Every service needs environment configuration. `core-config` provides a single Zod-based API that validates all required env vars, coerces types, applies defaults, and surfaces a single readable error listing **all** invalid or missing variables. It is the foundation (M01) for every backoffice-kit service.

## Install

```bash
pnpm add @nano-tech-2026-org/core-config
```

## Usage

```ts
import { loadConfig, maskSecrets } from "@nano-tech-2026-org/core-config";
import { z } from "zod";

const schema = {
  APP_NAME: z.string(),
  APP_PORT: { coerce: true, default: 3000 },
  APP_DEBUG: { coerce: true, default: false },
  DATABASE_URL: z.string(),
  API_KEY: { mask: true },
  OPTIONAL_SETTING: { optional: true, default: "default" },
};

const config = loadConfig(schema);
console.log(config.APP_PORT); // number

const safe = maskSecrets(config, ["API_KEY"]);
```

## API

### `buildSchema(definition)`

Builds a Zod object schema from a plain-object definition.

| Key type | Behaviour |
|----------|-----------|
| `z.ZodType` | Required, used as-is |
| `{ default }` | Applies `.default()` |
| `{ coerce: true }` | Coerces to string / number / boolean based on the `default` value |
| `{ optional: true }` | Applies `.optional()` |
| `{ schema: z.string().email() }` | Uses a custom schema |
| `{ url: true }` | Uses `z.string().url()` |

### `loadConfig(schema)`

Loads `.env` (via `dotenv`), parses `process.env` through the schema, and returns the typed config object. Throws `ConfigError` on failure with every validation problem listed.

### `maskSecrets(config, keys)`

Returns a shallow copy with selected string values replaced by `"***MASKED***"`. Does not mutate the original.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| Any env var in your schema | see schema | see schema | Defined per service via `buildSchema` |

See `.env.example` for a reference file.

## Development

| Script | Description |
|--------|-------------|
| `pnpm lint` | Biome lint + format check |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest with coverage |
| `pnpm build` | tsup ESM + declarations |

## License

MIT
