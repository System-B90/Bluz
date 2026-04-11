# TODO: Write README

## Environment Variables

* `NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_PORT` - the port used for the client to communicate with the backend schedule server.
* `WEBSOCKET_SESSION_SERVER_SENDER_AUTH_KEY` - the auth key for communication with the backend server.
* `MONGO_CONNECTION_STRING` - the connection string of the mongo instance.
* `NEXT_PUBLIC_HIVE_URL` - the URL for the hive instance to work with.
* `HIVE_CLIENT_ID` - ??? (What is a client ID?)
* `HIVE_CLIENT_SECRET` - ??? (What is a client secret?)

## Dependencies

* A Hive instance.
* A MongoDB instance.


## Dev Setup
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
