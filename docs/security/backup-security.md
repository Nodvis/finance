# Backup security

A PostgreSQL dump contains authentication and financial data and is therefore high sensitivity. Existing unencrypted dumps must be inventory-controlled and access-restricted; they are not safe merely because they are stored locally.

The supported safe workflow is: consistent `pg_dump`, restrictive file permissions, checksum, `pg_restore --list`, isolated disposable restore, and verification of migration journal and critical records. Encrypted archival backup using a mature format such as age is an open implementation item. The encryption recipient/key must be stored separately from the payload, with a tested recovery copy and documented loss consequences.
