# Share via Device

Share via Device adds a file action to Nextcloud Files. It creates a fresh,
read-only public link for every selected file or folder and hands the links to
the browser's system share sheet.

The share destinations come from the operating system. For example, KakaoTalk
can appear when the operating system/browser exposes it as a share target. This
app does not integrate with or depend on a Kakao SDK.

## Features

- Select any number of files and folders; there is no app-defined selection cap.
- Create a separate new public link for every item, even when another link exists.
- Process large selections in bounded internal batches to avoid oversized requests.
- Pause and automatically resume very large jobs when the authenticated bulk
  endpoint reaches its server-side safety throttle.
- Use the server's default link-expiration policy. If the server has no default,
  the links do not expire automatically.
- Roll back all links created by the current operation when creation fails.
- Remove the current operation's links when the system share sheet or dialog is
  cancelled.
- Copy all links when the Web Share API is unavailable.
- Korean and English UI.

## Requirements and policy behavior

- Nextcloud 33, 34, or 35
- PHP 8.2 or newer
- Public-link sharing enabled for the current user
- A secure browser context (HTTPS) for the system share sheet

If the server requires passwords for public links, this app does not bypass the
policy or invent a password. Use Nextcloud's standard Share panel instead.

The actual number of links that can be processed is still subject to the
Nextcloud server, reverse proxy, PHP memory/time limits, browser message limits,
and operating-system share-target limits.

## Development

```console
npm ci
npm test
npm run lint
npm run typecheck
npm run build
```

The built entry point is `js/share-via-device-main.js`.

## Packaging

On Windows PowerShell:

```powershell
./scripts/package.ps1
```

The archive is written to `build/artifacts/` and contains exactly one top-level
folder named `share_via_device`.

## Publishing

Nextcloud App Store publishing requires a certificate scoped to the app ID
`share_via_device` and a signature made with its private key. Never commit the
private key. See `docs/PUBLISHING.md` for the owner-only steps.

## License

AGPL-3.0-or-later
