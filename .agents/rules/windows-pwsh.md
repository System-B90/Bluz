---
trigger: always_on
---

# Windows & PowerShell CLI Standards

- **Environment:** Always assume execution in a Windows environment using PowerShell (v5/v7).
- **Command Chaining:** Do not use `&&` or `||` operators directly in standard PowerShell commands (which will fail with parser errors). Use `;` to chain commands instead.
- **PowerShell 7 (PWSH):** If logical chaining (e.g. `cmd1 && cmd2`) is absolutely necessary, explicitly invoke the command via PWSH 7 using `pwsh -Command "git add . && git commit -m '...'"` style.
