# Container baseline

This file currently starts only PostgreSQL for local schema work:

```console
cp .env.example .env
docker compose --env-file .env -f setup/compose.yaml up -d
```

It is **not yet the final one-command application deployment**. Before that
claim is made, the frontend, NestJS backend, Caddy HTTPS proxy, health checks,
and a production-safe environment configuration must all be reviewed together.

Use `docker compose --env-file .env -f setup/compose.yaml down -v` only when
you deliberately want to delete local database data.
