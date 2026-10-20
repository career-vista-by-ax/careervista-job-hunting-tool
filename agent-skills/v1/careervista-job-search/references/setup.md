# Portable connection and first-time setup

The skill, runtime and agent are independent. Installing this directory installs instructions only. Use host-native tools; no proprietary MCP, global Node, fixed port or executable path is required for the search workflow.

Follow SKILL.md's clickable-question rule from the first setup decision: invoke an available native question tool, not a list of choices in ordinary chat. This applies to Docker/local, existing/download, language and other setup choices. Use only the fallback and permission surfaces permitted by the host.

## Reuse or choose

Use an exact origin or runtime choice already supplied in this conversation. Otherwise read the host's saved connection, if present, from `~/.careervista/agent-connection.json`. It stores only backend, localhost origin, Docker image/container/volume/port or native launcher/root paths, never passwords or tokens. A healthy saved origin can be reused read-only. Avoid scanning other ports or launching duplicate workspaces.

First use without a settled backend: ask **“How would you like to run CareerVista: Docker, or a local copy?”** Recommend Docker when its CLI and daemon are available; otherwise recommend the supported native release. Offer custom/existing setup and undecided input. Check Docker availability read-only, such as `docker version`, rather than treating an installed CLI as proof the engine runs. A packaged native registration's `installation.json` is an optional hint for an existing local copy, not a prerequisite and not an automatic choice of backend.

## Docker

Read `../distribution.json` for the published image reference. When `docker.status` is `published`, use `docker.image` exactly, including its digest; `docker.tag` is a human-readable release label. Resolve this yourself rather than asking the user to supply an image name. The public image requires no Docker Hub account, login, token, Git checkout or local build. Do not request registry credentials for it. A pull failure is not permission to build from source: report the actual connectivity/platform/access problem and offer a retry or another supported setup. Use only a verified image from the declared project publisher or an explicitly supplied trusted image. If the image is null/unpublished, say so; offer a local release, a user-supplied image, or an explicitly authorised source build. Do not invent a registry tag or imply a local test image is publicly pullable.

Before pulling, creating or starting, ask permission explaining the exact image, container name, named data volume and localhost port. A backend selection alone does not replace this confirmation. Reuse permission already given for those exact actions in the current conversation. Keep Docker credentials inside Docker's own credential store.

Use a named volume for persistent data, one container per volume, and publish only to loopback. Resolve IMAGE from `distribution.json`, use `--init` and shared memory for the bundled browser, and run:

```text
docker run -d --init --shm-size=256m --name careervista --label app=careervista --restart unless-stopped --security-opt no-new-privileges:true --cap-drop ALL -p 127.0.0.1:4318:4318 -e CAREERVISTA_PUBLIC_ORIGIN=http://127.0.0.1:4318 -v careervista-data:/var/lib/careervista IMAGE
```

Check an existing named container's labels, image and mounts before reusing it; preserve unrelated resources. Inspect a chosen volume before starting, and avoid mounting it in two live app containers. If port 4318 is occupied, agree another port and set CAREERVISTA_PUBLIC_ORIGIN to that exact loopback origin; the internal container port stays 4318. Use Docker's actual port mapping to derive the browser/API URL. Verify the HTTP guide endpoint and container health before intake.

Keep the agent, its browser sign-in and resume-reading tools on the host. Send saved observations/analyses to the app's published local HTTP API. Docker does not need the host home directory, agent credentials, browser profile or Docker socket mounted inside it.

For updates, obtain permission for the selected version/digest and stop the owned container before replacing it with the same named volume and origin settings. The image uses CareerVista's existing snapshot/probe migration validation and refuses downgrades. Recreating a container is not a data reset. Container/volume removal is separate from normal search startup. Never delete a persistent volume as part of an update.

## Local copy

Ask one question: **“Have you already downloaded CareerVista, or would you like the download link?”** If an existing registration gives a path, offer reusing it. For an existing download, ask for the launcher or extracted folder path; a custom path is valid. For a new download, read the project's actual release metadata from the releases URL in distribution.json, choose the user's supported OS/architecture, and obtain permission for the concrete release/download destination before downloading. Alternatively give the user the release link and wait for their extracted folder path. Use the release's checksum sidecar and ownership-checked launcher; preserve existing data.

Mac releases use `CareerVista.command --no-browser`; Windows releases use `CareerVista.cmd --no-browser`. The launcher installs/reuses the app and returns its exact root and current URL. Invoke paths using the host's argument-safe shell conventions, including paths with spaces. This standalone skill does not need the app's register-skills command.

For an already registered native install, `installation.json` beside this skill contains its root and bundled runtime path. That runtime can run `scripts/launch.mjs` beside this skill: it verifies the installation identity/active package and launches/reuses it. If the recorded runtime path is stale, read the root's active ownership manifest and resolve its verified bundled runtime; never guess another installation.

## Show the local page before intake

After verifying `/api/v1/agent-guide`, send a visible user-facing message with a clickable **Open CareerVista** link to the verified origin's `/` page. Explain: “Click Open CareerVista to open your local jobs page in your browser. Saved jobs will appear here as research progresses; it may be empty at first.” This step is required for Docker, native setup and a healthy reused connection, even if a launcher already opened a browser. Use the actual published host port or launcher URL; never substitute a default port, container-internal address or API path. Finish this handoff before asking intake questions or starting source research. If the origin changes, verify it and send the replacement link promptly.

## Save connection and continue

After a healthy connection is verified, save only nonsecret connection information to the host connection file when file tools permit, or use the host's normal persistent preferences. Its runtime choice is reusable; it does not grant future Docker mutations blanket permission. If no persistent file tools exist, provide the exact origin/path for reuse next session. Resume SKILL.md's guided intake without asking the user to copy a long prompt or open configuration forms.
