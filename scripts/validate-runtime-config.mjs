const secret = process.env.BETTER_AUTH_SECRET;
const production = process.env.NODE_ENV === "production";

if (!production) process.exit(0);

const rejected = [
  "CHANGE_ME",
  "replace-with",
  "build-only",
  "ci-only",
  "test-secret",
  "test123",
];

if (!secret || secret.length < 32) {
  console.error(
    "[nodvis-finance] BETTER_AUTH_SECRET must contain at least 32 characters in production. Generate one with: openssl rand -hex 32",
  );
  process.exit(1);
}

if (rejected.some((marker) => secret.toLowerCase().includes(marker.toLowerCase()))) {
  console.error(
    "[nodvis-finance] BETTER_AUTH_SECRET is a placeholder or test value. Generate a unique secret with: openssl rand -hex 32",
  );
  process.exit(1);
}

if (new Set(secret).size < 8) {
  console.error(
    "[nodvis-finance] BETTER_AUTH_SECRET has insufficient character diversity. Generate a unique secret with: openssl rand -hex 32",
  );
  process.exit(1);
}

console.log("[nodvis-finance] Runtime configuration is valid.");