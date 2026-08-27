# Publishing `share_via_device`

The source and release archive can be prepared locally. The remaining steps
must be performed by the GitHub/App Store owner because they require account
authentication and the private signing key.

## 1. Publish the source repository

Create the public repository and push this project:

```console
git remote add origin https://github.com/lee-soda/share_via_device.git
git push -u origin main
```

## 2. Request the Nextcloud certificate

Generate the private key and CSR outside the repository:

```console
openssl req -nodes -newkey rsa:4096 \
  -keyout share_via_device.key \
  -out share_via_device.csr \
  -subj "/CN=share_via_device"
```

Keep `share_via_device.key` secret. Submit the CSR to
<https://github.com/nextcloud/app-certificate-requests> together with the public
repository URL. Save the returned `share_via_device.crt` beside the private key.

## 3. Build the release archive

```powershell
./scripts/package.ps1
```

The result is `build/artifacts/share_via_device-v1.0.0.tar.gz`.

## 4. Sign and register

Use the private key and signed certificate to register the app ID in the
Nextcloud App Store. Sign the exact release archive; rebuilding it changes the
signature.

```console
openssl dgst -sha512 -sign share_via_device.key \
  build/artifacts/share_via_device-v1.0.0.tar.gz | openssl base64
```

Upload the archive to the GitHub v1.0.0 release, then submit its direct download
URL and the base64 signature to the Nextcloud App Store.
