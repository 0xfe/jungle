# Cache-safe static builds and uploads

`npm run build` bakes/validates source assets, typechecks, bundles the site and verifies the complete `dist/` inventory. The application remains a static site, with no runtime CDN or build service dependency.

## Output and caching

The build emits content-hashed filenames in `dist/assets/` for JavaScript, CSS, images, the sprite manifest, recordings, source maps and retained attribution. HTML references the hashed entry points. Runtime file imports resolve relative to the JavaScript module URL, so the same build works at `/`, `/jungle-dev/` and `/jungle/`. Source files in `public/` retain stable names for the offline baker and headless tests. Normal builds require no live image generation or asset downloads.

| Uploaded object | Cache-Control |
| --- | --- |
| `index.html` | `public,max-age=300,must-revalidate` (5 minutes) |
| Content-hashed assets | `public,max-age=86400,immutable` (1 day) |

Changing an image, JSON atlas or recording changes its asset URL and the JS bundle that references it. Changing JS or CSS changes its entry URL in HTML. Unchanged bytes retain their existing URLs. Source-map-only changes are covered by the immutable-URL regression test. esbuild's [content-hashed output names](https://esbuild.github.io/api/#asset-names) supply bundle/asset names; unimported public files use truncated SHA-256 names.

`dist/.build-manifest.json` is a **local-only integrity receipt**, excluded from uploads and blocked by the preview server. It records a SHA-256 for each release file, including HTML. `npm run build:verify` rejects missing, modified, unversioned or unexpected files. It is an accidental-corruption/stale-build check, not a cryptographic signature or publisher-authentication scheme.

Cloud Storage serves cache policy from [object Cache-Control metadata](https://docs.cloud.google.com/storage/docs/metadata#cache-control). The uploader sets this metadata separately for assets and HTML. A reverse proxy or CDN must honor it; the script does not change DNS, CDN overrides, bucket website routing or permissions beyond the existing publicRead upload ACL.

## Commands

Requires Node.js 22+, npm dependencies (`npm ci`), and an installed/authenticated Google Cloud CLI with write access to the bucket.

```sh
./upload.sh dev             # build and upload to muthanna.com/jungle-dev/
./upload.sh prod            # build and upload to muthanna.com/jungle/
./upload.sh dev --clean     # publish, wait for cached HTML, then prune dev only
./upload.sh --help

npm run upload -- dev      # same command through npm
npm run upload:dev
npm run upload:prod -- --clean
npm run build:verify       # inspect an existing local build without uploading
```

The script requires exactly one of `dev` or `prod`. No environment, an unknown argument, or duplicate options prints usage and exits before a build or cloud command. `--help` exits successfully. The destination bucket is `gs://muthanna.com`; prefixes are fixed and cannot be supplied as arbitrary shell arguments.

Every upload creates a fresh build and copies it to an isolated temporary release directory. Later local rebuilds cannot mix files into that upload. It verifies that copy, uploads assets first, then publishes `index.html` last with the five-minute policy. Failed asset uploads cannot switch the index. HTML is copied even when its bytes match, so its cache metadata is refreshed. The local receipt never reaches the bucket.

Normal uploads retain old assets. An older cached index therefore continues to find the matching JS, CSS, atlas and audio while a new index is published. The new build always references a coherent set of assets; no in-place overwriting of a shared `app.js` or `jungle.png` is needed.

## Cleanup and deployment order

`--clean` publishes the new build, then waits **360 seconds**: the 300-second index TTL plus a 60-second loading grace period. It then compares the current remote index with the release being uploaded and verifies the local snapshot again. If the index changed, cleanup aborts. Otherwise [gcloud rsync deletion](https://docs.cloud.google.com/sdk/gcloud/reference/storage/rsync) removes files absent from this release, strictly under the selected `jungle-dev/` or `jungle/` prefix. `index.html` is excluded from that synchronization so it retains its separate cache policy. Old unversioned artifacts from previous builds are also removed.

Stopping the script during the wait leaves a published site with extra old assets; it does not take the site down. Only use `--clean` when you want to discard old releases. Very slow/background clients that defer their initial asset loads beyond the grace period may need to refresh; indefinite old-version support requires retaining old assets instead.

**Serialize deployments to each environment.** The remote-index check detects another completed publish during the wait, but is not a distributed lock: a concurrent upload that has not published its index yet could still race pruning. Dev and prod use separate prefixes and may be deployed independently. There is no bucket-wide deletion and no recursive delete of the live directory before uploading.

## Local checks

```sh
npm run check
BASE_PATH=/jungle-dev/ PORT=4180 npm run serve:cached
# Open http://localhost:4180/jungle-dev/?seed=42
```

`npm run serve` remains an uncached development preview. `serve:cached` uses deployment-equivalent response headers, including non-cached errors. `BASE_PATH` mounts the build at a real subdirectory and redirects its slashless URL to the trailing-slash form while preserving the query. The production host must likewise route directory URLs to `index.html` or provide a redirect.

`tests/deployment.test.mjs` runs real esbuild fixtures for hash propagation, deterministic rebuilds, source-map changes, CSS image links, subdirectory loading and corruption detection. A recording-only cloud CLI exercises upload order, TTL flags, environment isolation, the cleanup delay, invalid arguments, build/transfer failures and a competing remote index. It makes no cloud writes. Live cloud response headers are only verified when an upload is explicitly requested and performed.
