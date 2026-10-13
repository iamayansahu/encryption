(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_PACKAGE_BYTES = 35 * 1024 * 1024;
  const PBKDF2_ITERATIONS = 310000;
  let selectedImage = null, encryptedPackage = null, recoveredBlob = null;
  let visualFile = null, toastTimer = null, previewUrls = [];

  function status(id, message, kind = "") {
    const el = $(id); el.textContent = message; el.className = "status-message" + (kind ? " " + kind : "");
  }
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }
  function b64(bytes) {
    let binary = ""; const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    for (let i=0; i<arr.length; i+=0x8000) binary += String.fromCharCode(...arr.subarray(i, i+0x8000));
    return btoa(binary);
  }
  function unb64(value) {
    if (typeof value !== "string" || value.length > 50_000_000) throw new Error("Invalid encoded data.");
    const binary = atob(value), bytes = new Uint8Array(binary.length);
    for (let i=0; i<binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function randomBytes(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function makeUrl(blob) { const url = URL.createObjectURL(blob); previewUrls.push(url); return url; }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function safeName(name) { return String(name || "recovered-image").replace(/[\\/:*?"<>|]/g, "_").slice(0,180) || "recovered-image"; }
  function validateImage(file) {
    if (!file) throw new Error("Choose an image file first.");
    if (!file.type.startsWith("image/")) throw new Error("That file is not recognized as an image.");
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Please choose an image smaller than 20 MB.");
  }
  function validatePassword(pw) {
    if (!pw || pw.length < 12) throw new Error("Use a passphrase with at least 12 characters.");
    if (pw.length > 1024) throw new Error("Passphrase is too long.");
  }
  async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2", salt, iterations, hash:"SHA-256"}, material, {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"]);
  }
  function toggleVisibility(inputId, buttonId) {
    const input = $(inputId), btn = $(buttonId);
    btn.addEventListener("click", () => { const show = input.type === "password"; input.type = show ? "text" : "password"; btn.textContent = show ? "Hide" : "Show"; });
  }
  function switchView(viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === viewId));
    document.querySelectorAll(".side-link").forEach(b => b.classList.toggle("active", b.dataset.view === viewId));
    if (window.innerWidth < 650) $("workspace")?.scrollIntoView({behavior:"smooth", block:"start"});
  }
  document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => switchView(b.dataset.view)));
  document.querySelectorAll("[data-jump]").forEach(b => b.addEventListener("click", () => { switchView(b.dataset.jump); document.querySelector(".workspace").scrollIntoView({behavior:"smooth"}); }));
  $("themeToggle").addEventListener("click", () => { document.body.classList.toggle("light"); $("themeToggle").textContent = document.body.classList.contains("light") ? "☾" : "☼"; });
  toggleVisibility("password","togglePassword"); toggleVisibility("decryptPassword","toggleDecryptPassword");

  function setSelectedImage(file) {
    if (!file) return;
    try { validateImage(file); } catch(e) { toast(e.message); return; }
    selectedImage = file;
    $("selectedImagePreview").src = makeUrl(file);
    $("selectedName").textContent = file.name;
    $("selectedDetails").textContent = `${file.type || "Image"} · ${(file.size/1024).toFixed(1)} KB`;
    $("selectedPreview").classList.remove("hidden"); $("encryptedPanel").classList.add("hidden");
    status("encryptStatus", "");
  }
  $("imageInput").addEventListener("change", e => setSelectedImage(e.target.files[0]));
  $("removeImage").addEventListener("click", () => { selectedImage = null; $("imageInput").value = ""; $("selectedPreview").classList.add("hidden"); $("encryptedPanel").classList.add("hidden"); status("encryptStatus",""); });
  const dropzone = $("dropzone");
  ["dragenter","dragover"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add("dragover"); }));
  ["dragleave","drop"].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
  dropzone.addEventListener("drop", e => setSelectedImage(e.dataTransfer.files[0]));

  function passStrength(pw) {
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.min(4, score);
  }
  $("password").addEventListener("input", () => {
    const pw = $("password").value, score = passStrength(pw), bar = $("strengthBar");
    bar.style.width = `${score*25}%`;
    bar.style.background = score <= 1 ? "#ff8c9c" : score <= 2 ? "#e9b86a" : "#8df2c7";
    $("strengthLabel").textContent = !pw ? "Passphrase strength" : ["Very weak","Weak","Fair","Strong","Very strong"][score];
  });
  $("generatePassword").addEventListener("click", () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_";
    const values = randomBytes(24); let password = "";
    for (const n of values) password += alphabet[n % alphabet.length];
    $("password").value = password; $("confirmPassword").value = password;
    $("password").type = "text"; $("togglePassword").textContent = "Hide";
    $("password").dispatchEvent(new Event("input")); toast("Generated a strong passphrase. Save it securely.");
  });

  $("encryptBtn").addEventListener("click", async () => {
    const btn = $("encryptBtn");
    try {
      validateImage(selectedImage);
      const pw = $("password").value; validatePassword(pw);
      if (pw !== $("confirmPassword").value) throw new Error("The passphrases do not match.");
      if (!crypto.subtle) throw new Error("Web Crypto is unavailable. Use localhost or an HTTPS website.");
      btn.disabled = true; $("encryptProgress").classList.remove("hidden");
      $("progressText").textContent = "Reading image…"; $("progressPercent").textContent = "10%"; $("progressFill").style.width = "10%";
      const plain = await selectedImage.arrayBuffer();
      const salt = randomBytes(16), iv = randomBytes(12);
      $("progressText").textContent = "Deriving secure key…"; $("progressPercent").textContent = "35%"; $("progressFill").style.width = "35%";
      const key = await deriveKey(pw, salt);
      $("progressText").textContent = "Encrypting image bytes…"; $("progressPercent").textContent = "70%"; $("progressFill").style.width = "70%";
      const ciphertext = await crypto.subtle.encrypt({name:"AES-GCM", iv, tagLength:128}, key, plain);
      encryptedPackage = {
        format:"pixelvault-package-v1", algorithm:"AES-256-GCM", kdf:"PBKDF2-SHA-256",
        iterations:PBKDF2_ITERATIONS, salt:b64(salt), iv:b64(iv),
        filename:safeName(selectedImage.name), mimeType:selectedImage.type || "application/octet-stream",
        ciphertext:b64(ciphertext)
      };
      const json = JSON.stringify(encryptedPackage, null, 2);
      $("packageSize").textContent = `${(new Blob([json]).size/1024).toFixed(1)} KB`;
      $("progressText").textContent = "Complete"; $("progressPercent").textContent = "100%"; $("progressFill").style.width = "100%";
      $("encryptedPanel").classList.remove("hidden"); status("encryptStatus","Image encrypted in this browser. No upload was made.","ok");
      toast("Encryption complete.");
    } catch(e) { status("encryptStatus", e.message || "Encryption failed.", "error"); }
    finally { btn.disabled = false; setTimeout(() => $("encryptProgress").classList.add("hidden"), 900); }
  });
  $("downloadPackage").addEventListener("click", () => {
    if (!encryptedPackage) return;
    const base = safeName(selectedImage?.name || "image").replace(/\.[^.]+$/, "");
    download(new Blob([JSON.stringify(encryptedPackage, null, 2)], {type:"application/json"}), `${base}.pixelvault.json`);
    toast("Encrypted package downloaded.");
  });

  $("packageInput").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    $("packageLabel").textContent = f.name; $("packageDetails").textContent = `${(f.size/1024).toFixed(1)} KB · selected`;
    $("decryptedPanel").classList.add("hidden"); status("decryptStatus","");
  });
  $("decryptBtn").addEventListener("click", async () => {
    const btn = $("decryptBtn");
    try {
      const file = $("packageInput").files[0]; if (!file) throw new Error("Choose the encrypted JSON package first.");
      if (file.size > MAX_PACKAGE_BYTES) throw new Error("Package is too large for this demo.");
      const pw = $("decryptPassword").value; validatePassword(pw);
      if (!crypto.subtle) throw new Error("Web Crypto is unavailable. Use localhost or HTTPS.");
      btn.disabled = true; status("decryptStatus","Reading package and verifying authentication…");
      const pkg = JSON.parse(await file.text());
      if (pkg.format !== "pixelvault-package-v1" || pkg.algorithm !== "AES-256-GCM" || pkg.kdf !== "PBKDF2-SHA-256") throw new Error("Unsupported or invalid PixelVault package.");
      if (!Number.isInteger(pkg.iterations) || pkg.iterations < 100000 || pkg.iterations > 1000000) throw new Error("Invalid key derivation settings.");
      const salt = unb64(pkg.salt), iv = unb64(pkg.iv), ciphertext = unb64(pkg.ciphertext);
      if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error("Package is incomplete or malformed.");
      const key = await deriveKey(pw, salt, pkg.iterations);
      const plain = await crypto.subtle.decrypt({name:"AES-GCM", iv, tagLength:128}, key, ciphertext);
      const mime = typeof pkg.mimeType === "string" && pkg.mimeType.startsWith("image/") ? pkg.mimeType : "application/octet-stream";
      recoveredBlob = new Blob([plain], {type:mime});
      $("decryptedPreview").src = makeUrl(recoveredBlob);
      $("recoveredName").textContent = safeName(pkg.filename || "recovered-image");
      $("recoveredDetails").textContent = `${mime} · ${(recoveredBlob.size/1024).toFixed(1)} KB`;
      $("decryptedPanel").classList.remove("hidden"); status("decryptStatus","Decryption and AES-GCM authentication succeeded.","ok"); toast("Image recovered successfully.");
    } catch(e) {
      const msg = e.name === "OperationError" ? "Authentication failed. The password may be wrong or the package may have been modified." : (e instanceof SyntaxError ? "The selected file is not valid JSON." : (e.message || "Decryption failed."));
      status("decryptStatus",msg,"error"); $("decryptedPanel").classList.add("hidden");
    } finally { btn.disabled = false; }
  });
  $("downloadRecovered").addEventListener("click", () => {
    if (recoveredBlob) { download(recoveredBlob, safeName($("recoveredName").textContent)); toast("Recovered image downloaded."); }
  });

  $("visualInput").addEventListener("change", e => setVisualFile(e.target.files[0]));
  function setVisualFile(file) {
    if (!file) return;
    try { validateImage(file); } catch(e) { toast(e.message); return; }
    visualFile = file; $("visualPreview").src = makeUrl(file); $("visualName").textContent = file.name;
    $("visualDetails").textContent = `${file.type} · ${(file.size/1024).toFixed(1)} KB`;
    $("visualFileInfo").classList.remove("hidden"); $("visualDropzone").classList.add("hidden"); $("sharesPanel").classList.add("hidden"); status("visualStatus","");
  }
  $("removeVisual").addEventListener("click", () => { visualFile = null; $("visualInput").value = ""; $("visualFileInfo").classList.add("hidden"); $("visualDropzone").classList.remove("hidden"); $("sharesPanel").classList.add("hidden"); status("visualStatus",""); });
  $("threshold").addEventListener("input", () => { $("thresholdOutput").value = $("threshold").value; $("thresholdOutput").textContent = $("threshold").value; });
  function putPixel(imageData, width, x, y, black) {
    const i = (y*width+x)*4, v = black ? 0 : 255;
    imageData.data[i]=v; imageData.data[i+1]=v; imageData.data[i+2]=v; imageData.data[i+3]=255;
  }
  $("makeShares").addEventListener("click", async () => {
    const btn = $("makeShares");
    try {
      validateImage(visualFile); btn.disabled = true; status("visualStatus","Generating shares in your browser…");
      const image = new Image(), url = URL.createObjectURL(visualFile);
      await new Promise((resolve,reject) => { image.onload=resolve; image.onerror=reject; image.src=url; });
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 320/image.naturalWidth, 240/image.naturalHeight);
      const w=Math.max(1,Math.floor(image.naturalWidth*scale)), h=Math.max(1,Math.floor(image.naturalHeight*scale)), outW=w*2;
      const src=document.createElement("canvas"); src.width=w; src.height=h;
      const sctx=src.getContext("2d",{willReadFrequently:true}); sctx.drawImage(image,0,0,w,h);
      const pixels=sctx.getImageData(0,0,w,h).data, threshold=Number($("threshold").value);
      for (const id of ["shareA","shareB","combinedShare"]) { $(id).width=outW; $(id).height=h; }
      const a=$("shareA").getContext("2d"), b=$("shareB").getContext("2d"), c=$("combinedShare").getContext("2d");
      const ai=a.createImageData(outW,h), bi=b.createImageData(outW,h), ci=c.createImageData(outW,h);
      const random=randomBytes(w*h);
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        const pi=(y*w+x)*4, gray=.299*pixels[pi]+.587*pixels[pi+1]+.114*pixels[pi+2], isBlack=gray<threshold;
        const bit=(random[y*w+x]&1)===1, a0=bit, a1=!bit;
        // White source: identical subpixel patterns. Black source: complementary patterns.
        const b0=isBlack?!a0:a0, b1=isBlack?!a1:a1;
        putPixel(ai,outW,2*x,y,a0); putPixel(ai,outW,2*x+1,y,a1);
        putPixel(bi,outW,2*x,y,b0); putPixel(bi,outW,2*x+1,y,b1);
        putPixel(ci,outW,2*x,y,a0||b0); putPixel(ci,outW,2*x+1,y,a1||b1);
      }
      a.putImageData(ai,0,0); b.putImageData(bi,0,0); c.putImageData(ci,0,0);
      $("sharesPanel").classList.remove("hidden"); status("visualStatus","Both shares and the combined result are ready to preview or download.","ok"); toast("Visual shares generated.");
    } catch(e) { status("visualStatus",e.message || "Could not generate visual shares.","error"); }
    finally { btn.disabled=false; }
  });
  document.querySelectorAll(".shareDownload").forEach(btn => btn.addEventListener("click", () => {
    $(btn.dataset.canvas).toBlob(blob => { if(blob) { download(blob,btn.dataset.name); toast("Share image downloaded."); } }, "image/png");
  }));
  if (!window.crypto || !crypto.subtle) {
    status("encryptStatus","Web Crypto is not available in this context. Open the project using localhost or HTTPS.","error");
  }
})();