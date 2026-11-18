import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildSchema, ConfigError, loadConfig, maskSecrets } from "../src/index.js";

describe("buildSchema", () => {
  it("accepts a Zod type directly", () => {
    const schema = buildSchema({
      NAME: z.string(),
      PORT: z.coerce.number(),
    });
    const result = schema.parse({ NAME: "test", PORT: "3000" });
    expect(result).toEqual({ NAME: "test", PORT: 3000 });
  });

  it("accepts an options object with default", () => {
    const schema = buildSchema({
      DEBUG: { default: false },
    });
    const result = schema.parse({});
    expect(result).toEqual({ DEBUG: false });
  });

  it("coerces numbers when coerce: true and default is number", () => {
    const schema = buildSchema({
      PORT: { coerce: true, default: 3000 },
    });
    const result = schema.parse({ PORT: "4000" });
    expect(result.PORT).toBe(4000);
  });

  it("coerces booleans when coerce: true and default is boolean", () => {
    const schema = buildSchema({
      DEBUG: { coerce: true, default: false },
    });
    const result = schema.parse({ DEBUG: "true" });
    expect(result.DEBUG).toBe(true);
  });

  it("coerces strings when coerce: true and default is string", () => {
    const schema = buildSchema({
      NAME: { coerce: true, default: "app" },
    });
    const result = schema.parse({ NAME: "hello" });
    expect(result.NAME).toBe("hello");
  });

  it("falls back to z.string() when coerce: true but default is undefined", () => {
    const schema = buildSchema({
      KEY: { coerce: true },
    });
    const result = schema.parse({ KEY: "val" });
    expect(result.KEY).toBe("val");
  });

  it("handles optional fields", () => {
    const schema = buildSchema({
      OPTIONAL: { optional: true },
    });
    const result = schema.parse({});
    expect(result).toEqual({ OPTIONAL: undefined });
  });

  it("handles custom schema option", () => {
    const schema = buildSchema({
      EMAIL: { schema: z.string().email() },
    });
    const result = schema.parse({ EMAIL: "test@example.com" });
    expect(result.EMAIL).toBe("test@example.com");
  });

  it("throws for invalid definition type", () => {
    expect(() => buildSchema({ BAD: "just a string" } as Record<string, unknown>)).toThrow(
      'Invalid definition for "BAD": expected a Zod type or an options object',
    );
  });

  it("throws for null definition value", () => {
    expect(() => buildSchema({ NULL: null })).toThrow(
      'Invalid definition for "NULL": expected a Zod type or an options object',
    );
  });

  it("combines coerce, optional, and default", () => {
    const schema = buildSchema({
      MIXED: { coerce: true, optional: true, default: 42 },
    });
    // With value
    const r1 = schema.parse({ MIXED: "100" });
    expect(r1.MIXED).toBe(100);
    // Without value → default
    const r2 = schema.parse({});
    expect(r2.MIXED).toBe(42);
  });
});

describe("loadConfig", () => {
  it("returns parsed config on success", () => {
    const schema = buildSchema({
      TEST_KEY: z.string(),
      TEST_PORT: { coerce: true, default: 3000 },
    });

    const before = process.env.TEST_KEY;
    process.env.TEST_KEY = "hello";

    try {
      const result = loadConfig(schema);
      expect(result.TEST_KEY).toBe("hello");
      expect(result.TEST_PORT).toBe(3000);
    } finally {
      if (before !== undefined) {
        process.env.TEST_KEY = before;
      } else {
        delete process.env.TEST_KEY;
      }
    }
  });

  it("throws ConfigError when required fields are missing", () => {
    const schema = buildSchema({
      REQUIRED: z.string(),
    });

    const before = process.env.REQUIRED;
    delete process.env.REQUIRED;

    try {
      expect(() => loadConfig(schema)).toThrow(ConfigError);
    } finally {
      if (before !== undefined) process.env.REQUIRED = before;
    }
  });

  it("lists all validation problems in ConfigError", () => {
    const schema = buildSchema({
      EMAIL: z.string().email(),
      COUNT: { coerce: true, default: 0 },
    });

    const beforeEmail = process.env.EMAIL;
    const beforeCount = process.env.COUNT;
    process.env.EMAIL = "not-an-email";
    process.env.COUNT = "not-a-number";

    try {
      expect(() => loadConfig(schema)).toThrow(ConfigError);
    } finally {
      if (beforeEmail !== undefined) process.env.EMAIL = beforeEmail;
      else delete process.env.EMAIL;
      if (beforeCount !== undefined) process.env.COUNT = beforeCount;
      else delete process.env.COUNT;
    }
  });

  it("applies default values when fields are absent", () => {
    const schema = buildSchema({
      GREETING: { default: "hello" },
    });

    const before = process.env.GREETING;
    delete process.env.GREETING;

    try {
      const result = loadConfig(schema);
      expect(result.GREETING).toBe("hello");
    } finally {
      if (before !== undefined) process.env.GREETING = before;
    }
  });

  it("applies optional fields as undefined", () => {
    const schema = buildSchema({
      OPT: { optional: true },
    });

    const before = process.env.OPT;
    delete process.env.OPT;

    try {
      const result = loadConfig(schema);
      expect(result.OPT).toBe(undefined);
    } finally {
      if (before !== undefined) process.env.OPT = before;
    }
  });
});

describe("maskSecrets", () => {
  it("masks specified keys in the config object", () => {
    const config = {
      name: "app",
      password: "secret123",
      apiKey: "abc-def",
    };

    const masked = maskSecrets(config, ["password", "apiKey"]);

    expect(masked).toEqual({
      name: "app",
      password: "***MASKED***",
      apiKey: "***MASKED***",
    });
  });

  it("leaves non-secret keys unchanged", () => {
    const config = {
      name: "app",
      version: "1.0.0",
      secret: "hidden",
    };

    const masked = maskSecrets(config, ["secret"]);

    expect(masked.name).toBe("app");
    expect(masked.version).toBe("1.0.0");
    expect(masked.secret).toBe("***MASKED***");
  });

  it("leaves non-string values unchanged", () => {
    const config = {
      numberVal: 42,
      secret: "hidden",
      boolVal: true,
    };

    const masked = maskSecrets(config, ["secret"]);

    expect(masked.numberVal).toBe(42);
    expect(masked.secret).toBe("***MASKED***");
    expect(masked.boolVal).toBe(true);
  });

  it("does not mutate the original object", () => {
    const config = { password: "secret" };
    const masked = maskSecrets(config, ["password"]);

    expect(config.password).toBe("secret");
    expect(masked.password).toBe("***MASKED***");
  });

  it("handles empty keys array", () => {
    const config = { name: "app", secret: "hidden" };
    const masked = maskSecrets(config, []);

    expect(masked).toEqual(config);
  });

  it("handles keys not in config object", () => {
    const config = { name: "app" };
    const masked = maskSecrets(config, ["missingKey"]);

    expect(masked).toEqual(config);
  });

  it("handles config with no matching keys", () => {
    const config = { name: "app" };
    const masked = maskSecrets(config, ["password", "token"]);

    expect(masked).toEqual(config);
  });
});

describe("ConfigError", () => {
  it("is an instance of Error", () => {
    const error = new ConfigError(["Problem 1"]);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ConfigError");
  });

  it("contains the problems array", () => {
    const problems = ["Problem 1", "Problem 2"];
    const error = new ConfigError(problems);
    expect(error.problems).toEqual(problems);
  });

  it("includes problems in the message", () => {
    const problems = ["  - EMAIL: Invalid email", "  - PORT: Expected number"];
    const error = new ConfigError(problems);
    for (const p of problems) {
      expect(error.message).toContain(p);
    }
  });
});

describe("Integration — buildSchema + loadConfig", () => {
  it("works end-to-end with a realistic schema", () => {
    const schema = buildSchema({
      APP_NAME: z.string(),
      APP_PORT: { coerce: true, default: 3000 },
      APP_DEBUG: { coerce: true, default: false },
      DATABASE_URL: z.string(),
      API_KEY: { mask: true },
      OPTIONAL_SETTING: { optional: true, default: "default" },
    });

    const env = {
      APP_NAME: "my-service",
      APP_PORT: "8080",
      DATABASE_URL: "postgres://localhost/app",
      API_KEY: "super-secret-key",
    };

    // Save originals
    const saved: Record<string, string | undefined> = {};
    for (const key of Object.keys(env)) {
      saved[key] = process.env[key];
    }

    try {
      Object.entries(env).forEach(([k, v]) => {
        process.env[k] = v;
      });
      delete process.env.OPTIONAL_SETTING;

      const result = loadConfig(schema);
      expect(result.APP_NAME).toBe("my-service");
      expect(result.APP_PORT).toBe(8080);
      expect(result.APP_DEBUG).toBe(false);
      expect(result.DATABASE_URL).toBe("postgres://localhost/app");
      expect(result.API_KEY).toBe("super-secret-key");
      expect(result.OPTIONAL_SETTING).toBe("default");

      // maskSecrets should work on result
      const masked = maskSecrets(result, ["API_KEY"]);
      expect(masked.API_KEY).toBe("***MASKED***");
      expect(result.API_KEY).toBe("super-secret-key"); // original unchanged
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v !== undefined) process.env[k] = v;
        else delete process.env[k];
      }
    }
  });
});

describe("Zod URL validation", () => {
  it("validates URL strings correctly", () => {
    const schema = buildSchema({
      WEBHOOK_URL: { url: true },
    });

    // Valid URL
    const result = schema.parse({ WEBHOOK_URL: "https://example.com/hook" });
    expect(result.WEBHOOK_URL).toBe("https://example.com/hook");
  });
});
