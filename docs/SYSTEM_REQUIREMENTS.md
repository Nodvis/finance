# Nodvis Finance system requirements

These are conservative operational recommendations for the supported `finance + postgres` Docker Compose stack. Re-measure on your own host if you keep a large history or frequent backups.

## Published guidance

### Minimum

- 2 vCPU
- 1 GB RAM
- 4 GB free storage
- amd64 or arm64

### Recommended

- 2 vCPU
- 2 GB RAM
- 10 GB+ free storage
- amd64 or arm64

The PostgreSQL volume grows with transaction history and backups. The application is stateless outside PostgreSQL. Internet-facing deployments also need HTTPS through a reverse proxy or VPN.

## Measurement method

Release verification uses a disposable PostgreSQL volume and synthetic household data. Measurements are sampled after warm-up and during login/Overview, transaction browsing, forecast, obligation browsing and transaction creation. Migration startup is measured separately. Values are guidance, not a capacity guarantee; keep headroom for the operating system, Docker and backup files.
