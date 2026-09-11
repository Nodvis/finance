const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

const url = new URL("postgresql://placeholder");
url.hostname = process.env.DB_HOST;
url.port = process.env.DB_PORT;
url.pathname = `/${encodeURIComponent(process.env.DB_NAME)}`;
url.username = process.env.DB_USER;
url.password = process.env.DB_PASSWORD;
process.stdout.write(url.toString());
