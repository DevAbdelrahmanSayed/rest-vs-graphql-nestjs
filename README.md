# REST vs GraphQL in NestJS

One product catalog served by a REST API and a GraphQL API side by side, so you can compare them with real requests: caching, errors, versioning, N+1 and rate limiting.

## Run

```bash
npm install
cp .env.example .env
docker compose up -d     # Redis + Varnish (a local CDN)
npm run start:dev
```

There are two ports:

| Port | What answers |
|---|---|
| `3000` | The app directly |
| `8080` | The CDN (Varnish), which forwards to the app only when it has no copy |

## Where to see the result

1. Import `postman/rest-vs-graphql.postman_collection.json` into Postman.
2. Send a request.
3. In the **response** (the bottom half), open **Headers** and look at `X-Cache-Info`. The **Test Results** tab shows the same line.

`X-Cache-Info` tells you who answered:

| `X-Cache-Info` | Meaning |
|---|---|
| `app \| Redis MISS \| 1 DB query` | The app read the database |
| `app \| Redis HIT \| 0 DB queries` | The app answered from Redis |
| `CDN MISS \| app \| ...` | The CDN had no copy, so it asked the app |
| `CDN HIT \| app not called \| stored 20s ago \| fresh for 40s more` | The CDN answered alone; the app never saw the request |
| `CDN PASS (POST is not cached) \| app \| ...` | The CDN never caches POST |

To see a `CDN HIT`, the request has to go to port `8080`, be a GET, and be sent twice.

## The comparisons

Each Postman folder is one comparison:

| Folder | What to look at |
|---|---|
| 1. Requests | REST needs 3 requests for the product page. GraphQL needs 1 and returns only the fields asked for. |
| 2. Caching | REST over GET gets a CDN HIT. GraphQL over POST is always PASS. GraphQL over GET and persisted queries get a HIT. |
| 3. Errors | REST returns 404 or 400. GraphQL returns 200 with `null`, or `errors` in the body. |
| 4. Versioning | REST has `/v1` and `/v2`. GraphQL keeps one schema with a `@deprecated` field. |
| 5. N+1 and rate limiting | `X-DB-Queries` drops from 21 to 2 with DataLoader. Expensive GraphQL queries are rejected. |
| 6. Server cache | REST and GraphQL share the same Redis cache. |

## Try the one-minute cache

Public responses send `Cache-Control: public, max-age=0, s-maxage=60`, so the CDN keeps a copy for 60 seconds.

1. `GET http://localhost:8080/v1/products/42`: the CDN stores it.
2. About 20 seconds later, edit it: `PATCH http://localhost:3000/v1/products/42` with `{ "description": "New text" }`.
3. `GET http://localhost:8080/v1/products/42` again. You still get the old description until the copy is 60 seconds old, because the minute counts from when the CDN stored it, not from the edit.
4. After that, the next request goes to the app and gets the new description.

To clear the CDN right away: `docker compose exec cdn varnishadm "ban req.url ~ ^/"`.

## Good to know

- The database is in memory and logs the SQL it would run. Restarting the app resets every edit.
- The edit endpoints have no auth. This is a local demo.
- Varnish stands in for a CDN. A real CDN needs its own settings; Cloudflare, for example, does not cache JSON by default.
- Demo headers: `X-DataLoader: off` turns batching off so N+1 shows up, and `X-Cache: off` skips Redis.

## Test

```bash
npm run test:e2e
```
