# Session

<!-- prettier-ignore-start -->
::: bluz.sdk.Bluz
    options:
      members_order: source

::: bluz.sdk.connect
<!-- prettier-ignore-end -->

## Helpers

<!-- prettier-ignore-start -->
::: bluz.models._base.today

::: bluz.models._base.APP_TIMEZONE

::: bluz.help.describe
<!-- prettier-ignore-end -->

## Low-level client

`bz.http` is a `BluzClient`: raw `/api/*` calls that still unwrap the
response envelope and translate errors.

<!-- prettier-ignore-start -->
::: bluz.client.BluzClient
    options:
      members: [get, post, put, patch, delete, get_raw, stream_sse, request]

::: bluz.config.Config
<!-- prettier-ignore-end -->
