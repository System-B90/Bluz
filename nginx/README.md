# Nginx Proxy (`nginx`)

## Purpose
This directory houses the **Nginx reverse proxy configurations**. Nginx serves as the unified routing layer in production, receiving external client traffic and proxying HTTP requests dynamically to the frontend Next.js server, standard REST routes, or WebSocket channels (such as session-server WebSocket ports).

---

## Directory Structure

*   **`nginx.conf`**: The main routing rules, proxy headers, upstream channels, and WebSocket gateway configurations.
*   **`Dockerfile.proxy`**: Docker configuration to containerize the Nginx reverse proxy service.

---

## Inclusion Guidelines: Should a file be here?

### ✅ YES, put it here if:
*   It configures **Nginx routing rules, request headers, load balancing, proxy configurations**, or SSL/TLS proxy setups.
*   It configures the containerization or build step of the Nginx service.

### ❌ NO, do NOT put it here if:
*   It configures application-wide docker composition or multi-container orchestrations. Place these in the **project root** (`docker-compose.yml`).
