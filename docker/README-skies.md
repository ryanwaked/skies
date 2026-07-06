# Running Skies (customized marimo) in Docker / zimaOS

This fork restyles and extends marimo. The customizations live in **this source
tree** — a large custom frontend plus some backend changes. This directory has
everything needed to run the fork in a Linux container.

> **Why not the stock `docker/Dockerfile`?**
> It runs `uv pip install marimo` from **PyPI**, so an image built from it is
> plain upstream marimo with **none** of the Skies changes. Use
> `docker/Dockerfile.skies` (below), which builds the fork from source.

## Prerequisites

1. Build the frontend so `marimo/_static` exists on disk (git-ignored, but baked
   into the image). This is the same step used to package the macOS app:

   ```sh
   NODE_ENV=production ./scripts/buildfrontend.sh
   ```

   Re-run it whenever you change anything under `frontend/`.

2. Docker (with BuildKit, the default on modern Docker).

marimo is **pure Python**, so the wheel is architecture-independent — the same
image definition builds and runs on x86_64 mini-PCs and arm64 boards alike.

## Build & run

From the **repository root**:

```sh
# 1. Build the frontend (produces marimo/_static)
NODE_ENV=production ./scripts/buildfrontend.sh

# 2. Build the image (multi-stage: builds a wheel, installs it into a slim image)
docker build -f docker/Dockerfile.skies -t skies:latest .

# 3. Run it — notebooks persist in the `skies-data` volume, UI on :8080
docker run --rm -p 8080:8080 -v skies-data:/data skies:latest
```

Open `http://<host-ip>:8080`. Notebooks you create/open live in the container's
`/data` (the mounted volume).

### docker-compose / zimaOS

zimaOS installs "custom" apps from a compose file. Use
[`docker-compose.skies.yml`](./docker-compose.skies.yml):

```sh
docker compose -f docker/docker-compose.skies.yml up -d
```

On zimaOS you can point the volume at host storage instead of a named volume,
e.g. `- /DATA/AppData/skies:/data`, so notebooks are visible in the Files app.

## What's in the image

- The Skies fork (custom frontend in `marimo/_static` + backend changes).
- The SQL stack (`duckdb`, `polars`, `sqlglot`) and `altair` / `pandas` /
  `numpy`, so the demo notebooks (charts, SQL cells, dataframes) run as-is.

To add libraries (e.g. `scikit-learn`, `plotly`), append them to the
`uv pip install` line in `Dockerfile.skies`, or install them per-notebook.

## Security notes

- The container runs as a **non-root** user (`appuser`).
- The default command uses **`--no-token`**, which is convenient on a trusted
  home LAN but means **anyone who can reach the port can run code**. If the port
  is reachable from an untrusted network, remove `--no-token` from the `CMD`
  (or the compose `command:`) and/or put it behind a reverse proxy that adds
  authentication.
- `--headless` is set so the server never tries to open a browser in the
  container.

## Notes on Linux/macOS portability

The Mac-specific pieces of this fork do **not** affect the Linux image:

- The macOS menu-bar app under `packaging/` (Swift) is **not** part of the
  Python package and is excluded from the Docker build context.
- `marimo edit` with no path prefers `~/Desktop` **only if it exists**, else
  falls back to the working directory. This image sidesteps that entirely by
  passing an explicit `/data` directory to `marimo edit`.
- The marimo-wide secrets file uses XDG paths
  (`$XDG_CONFIG_HOME/marimo/.env`, default `~/.config/marimo/.env`), which are
  standard on Linux.
