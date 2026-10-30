# Mobile release requirement

The user requires a user-facing changelog for **every** mobile update. Preserve the existing update popup and restart/download actions; include the changes in that popup.

- Before any Shorebird patch, APK release or mobile web update, write clear Malay notes in `cloudflare/src/mobile-release-notes.json`. Use the exact release/build and patch number, date, and concrete changes users will notice. Patch `0` is a native release. Do not invent changes or reuse a generic message.
- Keep old entries so users who skip patches can read the intervening changes. Never show notes from a different build or a patch newer than the one actually downloaded.
- Deploy the Worker containing the notes before publishing the matching Android update. For patches, run `python3 tool/check_release_notes.py RELEASE --next-patch --live` before the Shorebird publish command. For a native release use `--patch 0 --live`.
- Confirm the resulting patch number and stable track after publication. Avoid concurrent patch publications for the same release.
- `tool/publish_patch.sh` also sends an update broadcast. Use it only when that broadcast is explicitly authorized; otherwise run the changelog check and Shorebird patch command separately.
- See `docs/mobile-releases.md` at the repository root for the release procedure and first-upgrade limitation.
