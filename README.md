# set up .env
```
ETHEREUM_RPC_URL=
MANTLE_RPC_URL=
PRIVATE_KEY=
SENDER_ADDRESS=
ENV=
PORT=
```

# Start app
dev: `docker compose up -d`
prod: `docker compose -f docker-compose.prod.yml up -d`

## Bridge ETH from ethereum to mantle
**Request**
```bash
curl --location 'localhost:3000/bridge' \
--header 'Content-Type: application/json' \
--data '{
    "direction": 1,
    "token": "ETH",
    "amount": "0.01",
    "to": <optional>
}'
```
**Response**
```json
{
    "hash": "0x67a8bba898e6765bc15cf36eb90f13757dabab35689d16bee491aeb04572dbea",
    "confirmations": 0
    // other TransactionResponse fields
}
```
## Bridge MNT from ethereum to mantle
**Request**
```bash
curl --location 'localhost:3000/bridge' \
--header 'Content-Type: application/json' \
--data '{
    "direction": 1,
    "token": "MNT",
    "amount": "1",
    "to": <optional>
}'
```

## Check transaction detail
**Request**
```bash
curl --location 'localhost:3000/tx/0x67a8bba898e6765bc15cf36eb90f13757dabab35689d16bee491aeb04572dbea'
```
**Response**
```json
{
    "code": 0,
    "data": {
        "status": 2,
        // other TransactionReceipt fields
    }
}
```
status
* null = not mined
* 0 = failed
* 1 = succeeded
* 2 = finalised