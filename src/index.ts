import dotenv from "dotenv";
import { z } from "zod";

/**
 * Typed errors thrown during configuration validation.
 */
export class ConfigError extends Error {
  public readonly problems: string[];

  constructor(problems: string[]) {
    super(`Configuration validation failed:\n${problems.join("\n")}`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}

/**
 * Options for a schema field definition.
 */
export interface FieldOpts {
  default?: unknown;
  coerce?: boolean;
  optional?: boolean;
  mask?: boolean;
  schema?: z.ZodType;
  url?: boolean;
}

/**
 * Build a Zod schema from a plain-object definition.
 *
 * Each key maps to either:
 *   - a Zod type directly              → required, no coercion
 *   - an object { default, coerce, optional, mask, url, schema } → described behaviour
 *
 * Returns a Zod object schema ready for .parse() / .safeParse().
 */
export function buildSchema(
  definition: Record<string, unknown>,
): z.ZodObject<Record<string, z.ZodType>> {
  const shape: Record<string, z.ZodType> = {};

  for (const [key, value] of Object.entries(definition)) {
    if (value instanceof z.ZodType) {
      shape[key] = value;
      continue;
    }
    if (typeof value !== "object" || value === null) {
      throw new TypeError(
        `Invalid definition for "${key}": expected a Zod type or an options object`,
      );
    }
    const opts = value as FieldOpts;
    let base: z.ZodType;

    if ("schema" in opts && opts.schema instanceof z.ZodType) {
      base = opts.schema;
    } else if ("url" in opts && opts.url) {
      base = z.string().url();
    } else if ("coerce" in opts && opts.coerce) {
      // Infer coerce type from the default value
      if (typeof opts.default === "number") {
        base = z.coerce.number();
      } else if (typeof opts.default === "boolean") {
        base = z.coerce.boolean();
      } else if (typeof opts.default === "string") {
        base = z.coerce.string();
      } else {
        base = z.string();
      }
    } else {
      base = z.string();
    }

    if ("optional" in opts && opts.optional) {
      base = base.optional();
    }

    if ("default" in opts && opts.default !== undefined) {
      base = base.default(opts.default as unknown);
    }

    shape[key] = base;
  }

  return z.object(shape);
}

/**
 * Load and validate environment variables against the provided schema.
 *
 * - Calls `dotenv.config()` first so .env files are loaded.
 * - Parses the env through the Zod schema.
 * - Throws a {@link ConfigError} with every individual problem on failure.
 */
export function loadConfig(schema: z.ZodObject<Record<string, z.ZodType>>): z.infer<typeof schema> {
  try {
    // Load .env if it exists
    dotenv.config();
    return schema.parse(process.env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const problems = err.issues.map((issue) => {
        const path = issue.path.join(".");
        return `  - ${path}: ${issue.message}`;
      });
      throw new ConfigError(problems);
    }
    throw err;
  }
}

/**
 * Return a plain-object copy of *config* with selected secret keys
 * masked as `***MASKED***` for safe logging / printing.
 */
export function maskSecrets<T extends Record<string, unknown>>(config: T, keys: string[]): T {
  const result = { ...config } as unknown as Record<string, unknown>;
  for (const key of keys) {
    if (key in result && typeof result[key] === "string") {
      result[key] = "***MASKED***";
    }
  }
  return result as T;
}
