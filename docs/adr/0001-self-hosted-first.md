# ADR-0001: Self-hosted first

- Status: Accepted
- Date: 2026-08-31

## Context

Nodvis Finance will process highly sensitive household financial information. The initial product is intended for private use and there is no need to operate a hosted service containing third-party financial data during early development.

Direct public-cloud operation would immediately add operational, regulatory, incident-response and security obligations that are not required to validate the product.

## Decision

The first supported product model is **self-hosted first**.

The application must be deployable without a mandatory Nodvis cloud dependency.

Preferred access patterns include:

- local network,
- VPN/Tailscale,
- reverse proxy with TLS.

The product should not recommend raw public HTTP exposure.

## Consequences

### Positive

- sensitive data can remain under the user's control,
- early security testing can happen in a controlled environment,
- no requirement to host unrelated users' financial data,
- lower initial infrastructure cost,
- fewer external dependencies.

### Negative / trade-offs

- self-hosting setup must be documented well,
- backup/recovery responsibility is partly on the operator,
- secure networking/TLS guidance becomes important,
- future hosted-cloud architecture may require additional work.

## Alternatives considered

### Hosted SaaS first

Rejected for the initial product because it creates unnecessary security and operational scope before the core product is validated.

### Hybrid cloud dependency

Rejected as a default because the core product should remain functional without mandatory external services.

## Follow-up

- define the supported deployment topology,
- define TLS/reverse-proxy expectations,
- define backup/restore workflow,
- revisit this ADR if a public hosted offering is designed later.
