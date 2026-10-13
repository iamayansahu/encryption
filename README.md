# PixelVault — Interactive Client-Side Image Security

A responsive, interactive static website for a student project on **Client-Side End-to-End Image Encryption and Secure Transmission using Visual Cryptography**.

## Folder structure

```text
PixelVault_Interactive/
├── index.html
├── README.md
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── assets/
    └── favicon.svg
```

## Features
- Interactive responsive UI with navigation between Encrypt & Decrypt, Visual Cryptography, and Project Guide.
- Light/dark theme toggle.
- Drag-and-drop image selection and preview.
- Password strength indicator and generated passphrase helper.
- AES-256-GCM encryption using Web Crypto API.
- PBKDF2-SHA-256 key derivation with random salt and fresh random IV.
- Downloadable `.pixelvault.json` encrypted package.
- Package import, authenticated decryption, recovered-image preview and download.
- Visual cryptography demo with two share canvases, threshold slider, and downloadable shares.
- Project architecture, security notes, and an interactive testing checklist.
- All image encryption/decryption runs locally in the browser; no backend is included.

## Run locally
1. Extract the ZIP.
2. Open a terminal in this folder.
3. Run:
   ```bash
   python -m http.server 8000
   ```
4. Visit `http://localhost:8000`.

The Web Crypto API requires a secure context; localhost and HTTPS are supported by modern browsers. Do not simply open the HTML with `file://` if crypto is unavailable.

## Host online with GitHub Pages
1. Create a GitHub repository, e.g. `pixelvault-image-security`.
2. Upload the folder contents to the repository root (upload `index.html`, `css/`, `js/`, `assets/` and `README.md`, not just the ZIP).
3. Open **Settings → Pages**.
4. Choose deployment from the `main` branch and `/ (root)`.
5. Save and visit the HTTPS URL provided by GitHub Pages.

Cloudflare Pages and other static HTTPS hosts also work.

## Important security notes
- This is an educational prototype, not an audited security product.
- Use a long, unique passphrase. Share it via a different channel from the encrypted package.
- AES-GCM provides confidentiality and tamper detection. If decryption fails, check the password and package integrity.
- The browser doesn't upload image data in this implementation, but a compromised hosting account could deliver malicious JavaScript. Static hosting alone does not prove strong end-to-end security.
- The visual cryptography implementation is a simplified, lossy, black-and-white teaching demonstration. It does not preserve full color/detail and is not a substitute for AES-GCM.
- Test with non-sensitive images first.
