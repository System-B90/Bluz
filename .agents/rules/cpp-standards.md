---
trigger: model_decision
description: When working in C/C++
---

# C/C++ Language Constraints

- **Environment:** Assume C++17 and Visual Studio 2022/2026. Use Clang for formatting and GoogleTest for testing.
- **Memory Safety:** Strictly enforce memory safety using RAII and smart pointers. Use `std::unique_ptr` exclusively. Never use `std::shared_ptr`, `new`, or `delete`.
- **Compile-Time Evaluation:** Strictly enforce `constexpr` for any variable or function that can be evaluated at compile time.
