# TODO: Write README

## Environment Variables

* `WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY` - the auth key for communication with the backend server.
* `MONGO_CONNECTION_STRING` - the connection string of the mongo instance.
* `NEXT_PUBLIC_HIVE_URL` - the URL for the hive instance to work with.
* `NEXT_PUBLIC_GANT_DEFAULT_WEEKDAY_HOURS` - default total work hours for new week days Sunday-Thursday in gantt panel.
* `NEXT_PUBLIC_GANT_DEFAULT_FRIDAY_HOURS` - default total work hours for Friday in new weeks in gantt panel.
* `HIVE_CLIENT_ID` - ??? (What is a client ID?)
* `HIVE_CLIENT_SECRET` - ??? (What is a client secret?)

## Dependencies

* A Hive instance.
* A MongoDB instance.


## Dev Setup

Route "127.0.0.3" to "bluz.bis" in your hosts file.

```pwsh
pip install typer InquirerPy python-dotenv
python setup.py
npm run docker:dev
```

### After Updating Nginx/Proxy Settings
_Updated `nginx.conf`? Run this:_
```pwsh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up proxy -d
```
