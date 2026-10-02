# Errors

Catch `BluzError` to handle anything the package raises.

```python
from bluz import BluzApiError, BluzError, NotAuthenticatedError

try:
    curriculum.cut()
except NotAuthenticatedError:
    ...                                  # token missing/expired: bz = Bluz.login(url)
except BluzApiError as exc:
    print(exc.error_name, exc.error_message, exc.http_status)
```

::: bluz.errors
