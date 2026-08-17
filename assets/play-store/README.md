# Google Play listing assets

These are the current generated listing images for the two Android apps:

- `client/`: `com.riderguy.client`
- `rider/`: `com.riderguy.rider`

Regenerate them with the matching `scripts/play-upload-*-graphics.js` script.
The scripts read raw device captures from the ignored `.artifacts/mobile/`
directory and write the final, publishable images here.

Service-account JSON files remain local and must never be committed.
