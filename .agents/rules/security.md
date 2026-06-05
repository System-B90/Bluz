---
trigger: always_on
---

# Security & Database Standards

- **Cryptography:** Prefer SHA256 for hashing, AES-GCM for encryption, and ECDSA for manual digital signing. Never implement custom cryptography.
- **Authentication & Secrets:** Prefer JWT for authentication. Manage secrets using simple `.env` files (generate interactively via `InquirerPy` in a `setup.py` script).
- **Database:** Default to MongoDB 8. If SQL is a better fit, provide a performance-based explanation for PostgreSQL and await approval.
- **Deployment:** Always prefer containerization. Docker images must use explicit version tags (never `latest`), and base image requirements must be listed in the README. Default to GitHub Actions for CI/CD.
