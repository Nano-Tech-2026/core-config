# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `loadConfig(schema)` — Zod-based environment configuration with defaults,
  coercion (number/boolean/url), `.env` loading, and a single readable error
  listing all invalid/missing variables.
- `maskSecrets(config, keys)` — redacts secret values for safe logging.
- `ConfigError` — typed error carrying the full list of validation problems.
