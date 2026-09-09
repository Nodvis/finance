# Encryption and key management

Application-level field encryption is intentionally not shipped yet. The threat it would mitigate is offline disclosure from a stolen database dump or backup. It would not protect data from an attacker controlling the running host, process memory or the key source.

Before implementation, the design must select fields that do not require unrestricted SQL aggregation/search, use an established AEAD such as AES-256-GCM with random nonces, version/key identifiers and authenticated additional data, and use independent key purpose material plus blind indexes where equality lookup is necessary.

Keys must be supplied outside the database and repository, with restrictive permissions, explicit rotation and recovery copies. Losing the key must be documented as possible permanent data loss. No key is currently generated implicitly or embedded in ciphertext.
