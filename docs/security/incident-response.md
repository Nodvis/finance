# Incident response

1. **Contain:** restrict the service to the private network/VPN, preserve logs and timestamps, do not destroy evidence.
2. **Revoke/rotate:** invalidate sessions through Better Auth where possible; rotate the affected auth, database, deployment or encryption secret using a tested recovery procedure. Removing a secret from Git does not remove the need to rotate it.
3. **Assess:** identify affected households, backups, exports and host/container boundaries without copying sensitive data into tickets.
4. **Recover:** restore from a verified backup only after checking its provenance and integrity; validate migration state and financial invariants.
5. **Notify:** document impact and user actions for affected household members.

Scenarios covered: leaked `BETTER_AUTH_SECRET`, leaked DB credential, leaked encryption key, committed secret, stolen dump/backup, suspected session theft, compromised account and compromised host. Host compromise requires treating application data and all process-visible secrets as exposed, rebuilding from trusted artifacts and rotating all dependent credentials.
