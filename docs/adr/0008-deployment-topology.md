# ADR-0008: Initial deployment topology

- Status: Accepted
- Date: 2026-08-31

## Context

The first release is self-hosted only. The deployment should be easy to understand, back up and restore on a homelab/VPS without creating an unnecessary distributed system.

The application needs a web process and PostgreSQL. Future imports/documents may create background work, but those requirements do not justify Redis, a queue cluster or object storage on day one.

## Decision

Use a **modular monolith** deployed as containers.

Initial logical topology:

```text
Browser
   |
   | HTTPS
   v
Reverse proxy / TLS
   |
   v
Nodvis Finance web
   |
   v
PostgreSQL 18
```

### Container deployment

Docker Compose is the initial reference deployment format.

The production stack is expected to contain at least:

- `web`
- `postgres`

The repository may initially provide a development PostgreSQL compose file before the production application image is ready.

### Reverse proxy and TLS

The application container should not be documented as a raw public `http://server:3000` service.

Supported/recommended exposure patterns:

- LAN only,
- VPN/Tailscale,
- reverse proxy with TLS.

The reverse proxy may be Caddy, Traefik, Nginx or another correctly configured TLS proxy. Finance does not require one specific proxy implementation in the application stack.

### No mandatory Redis/queue initially

Do not add Redis, RabbitMQ, Kafka or a separate worker service until a real workload requires it.

Import processing should initially be implemented in the simplest safe way that preserves request responsiveness and recoverability. If durable asynchronous jobs become necessary, select a job model in a dedicated ADR.

### No object storage initially

Sensitive document storage is intentionally deferred. Do not introduce S3/MinIO merely as generic infrastructure before the document-storage threat model and encryption/key-management decisions are complete.

### Persistent state

At the start, PostgreSQL is the only approved persistent application state.

When document storage is introduced, the backup/restore definition must expand to include it.

### Health and startup

The eventual production image should expose a minimal health/readiness mechanism that can distinguish:

- application process available,
- database connectivity/migrations ready.

Application startup must not silently auto-apply destructive schema changes.

### Outbound network behavior

The base self-hosted application should not require outbound network calls during ordinary use except explicit user-configured functionality and package/image retrieval during deployment/upgrade.

Telemetry, analytics, external crash reporting and external AI remain off by default.

## Consequences

### Positive

- Simple mental and operational model.
- Easy to run on a homelab or small VPS.
- Small attack surface compared with unnecessary distributed infrastructure.
- Backup scope is initially straightforward.
- Additional components can be introduced through evidence-driven ADRs later.

### Negative / trade-offs

- Long-running imports may eventually require a durable job mechanism.
- Scaling a single application process is less flexible than independent services, but that is not an MVP requirement.
- The operator remains responsible for TLS/reverse proxy and host/database backup hygiene.

## Alternatives considered

### Microservices from the start

Rejected as unjustified complexity for a single-household-first application.

### Managed cloud database/auth/storage as required services

Rejected because they conflict with self-host-first operation and create mandatory external dependencies.

### Kubernetes

Not a reference deployment target. It may work in the future, but the project will not require Kubernetes concepts for normal self-hosting.

## Follow-up

- Add a development PostgreSQL Compose configuration.
- Add production Dockerfile/Compose only when the web scaffold can build and run end-to-end.
- Design backup/restore verification before declaring the application production-ready.
- Record a separate ADR if durable background jobs or sensitive document storage are introduced.
