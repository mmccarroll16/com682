// Logic App endpoints (all provided)
const CIA_URL = "https://prod-02.italynorth.logic.azure.com/workflows/438f49f8253b4c6899482f6ac1bfa072/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=eqZYTEoJrYYYR7-JwgT12Kq9O-So9-KbilcscE3qL9E";
const CIA_IMAGES_URL = "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8";
const DIA_URL = "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM";
const RAA_URL = "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs";
const RIA_URL = "https://prod-00.italynorth.logic.azure.com/workflows/d0af0d70328d47a8ad27f7c25e035de9/triggers/When_an_HTTP_request_is_received/paths/invoke/rests/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=xrq9bm3gWPRFCBQJ0ete6qnfTf9KK5PySeme7YzwprE";
const RIA_IMAGES_URL = "https://prod-06.italynorth.logic.azure.com:443/workflows/7699903ea01b48f3adb9fc50033dd1c8/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=CUwD8epstITJInT-mbEJ1RnOeX5_Cz-vfciUlDbb46E";
const UIA_URL = "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c";

// Active endpoints in use
const LIST_ASSETS_URL = RIA_IMAGES_URL; // returns image records with base64 fields
const UPLOAD_URL = CIA_IMAGES_URL; // upload metadata + image
const DELETE_URL = DIA_URL;

// Set the blob base URL so images render (container path is included in filePath)
const IMAGE_BASE_URL = "https://localbitestorageaccount.blob.core.windows.net";

// If Logic App stores a media.url, set true to render from it (not the case with RIA_IMAGES)
const USE_MEDIA_URL = false;

const $ = (id) => document.getElementById(id);

const decodeMaybeBase64 = (val) => {
  if (val && typeof val === "object" && "$content" in val) {
    try {
      return atob(val["$content"]);
    } catch (e) {
      return val["$content"];
    }
  }
  return val;
};

async function fetchAllAssets() {
  const res = await fetch(LIST_ASSETS_URL);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  const docs = Array.isArray(data) ? data : (data.Documents ?? data.documents ?? []);
  return docs.map((d) => ({
    ...d,
    fileName: decodeMaybeBase64(d.fileName),
    userID: decodeMaybeBase64(d.userID),
    userName: decodeMaybeBase64(d.userName),
    rating: decodeMaybeBase64(d.rating),
    comment: decodeMaybeBase64(d.comment),
    restaurantId: decodeMaybeBase64(d.restaurantId ?? d.restaurantID),
    restaurantName: decodeMaybeBase64(d.restaurantName ?? d.RestaurantName)
  }));
}

async function deleteAsset(id) {
  const url = DELETE_URL.replace("{id}", encodeURIComponent(id));
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}

async function renderAssets() {
  $("gallery").innerHTML = "";
  $("loadStatus").textContent = "Loading...";
  try {
    const docs = await fetchAllAssets();
    $("loadStatus").textContent = "";

    if (!docs.length) {
      $("gallery").innerHTML = "<p>No images yet.</p>";
      return;
    }

    for (const d of docs) {
      const urlFromMedia = USE_MEDIA_URL ? d?.media?.url : null;
      const path = d.filePath || d.fileLocator || "";
      const file = d.fileName || "";
      const combinedPath = (() => {
        if (!path) return "";
        const trimmed = path.startsWith("/") ? path.slice(1) : path;
        // If file name is not already part of the path, append it
        if (file && !trimmed.endsWith(file)) {
          return `${trimmed}/${file}`;
        }
        return trimmed;
      })();
      const urlFromPath =
        IMAGE_BASE_URL && combinedPath
          ? `${IMAGE_BASE_URL}/${combinedPath}`
          : null;
      const imgUrl = urlFromMedia ?? urlFromPath ?? "";
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <img src="${imgUrl}" alt="${d.fileName ?? "image"}" />
        <div class="small"><b>Restaurant:</b> ${d.restaurantId ?? d.restaurantID ?? ""}</div>
        <div class="small"><b>User:</b> ${d.userName ?? ""} (${d.userID ?? ""})</div>
        <div class="small"><b>Rating:</b> ${d.rating ?? ""}</div>
        <div class="small"><b>Comment:</b> ${d.comment ?? ""}</div>
        <div class="small"><b>Path:</b> ${d.filePath ?? d.fileLocator ?? ""}</div>
        <div class="small"><b>ID:</b> ${d.id ?? ""}</div>
        <button type="button" data-id="${d.id}">Delete</button>
      `;
      $("gallery").appendChild(div);
    }
  } catch (err) {
    $("loadStatus").textContent = `Failed to load: ${err.message}`;
  }
}

$("refreshBtn").addEventListener("click", renderAssets);

$("gallery").addEventListener("click", async (e) => {
  if (e.target.tagName === "BUTTON" && e.target.dataset.id) {
    const id = e.target.dataset.id;
    if (!confirm("Delete this image?")) return;
    try {
      await deleteAsset(id);
      await renderAssets();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }
});

$("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("status").textContent = "Uploading...";

  const file = $("file").files[0];
  if (!file) {
    $("status").textContent = "Pick an image first.";
    return;
  }

  const fd = new FormData();
  fd.append("restaurantId", $("restaurantId").value);
  fd.append("userID", $("userID").value);
  fd.append("userName", $("userName").value);
  fd.append("rating", $("rating").value);
  fd.append("comment", $("comment").value);
  fd.append("FileName", file.name);
  fd.append("File", file);

  try {
    const res = await fetch(UPLOAD_URL, { method: "POST", body: fd });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`${res.status} ${t}`);
    }
    $("status").textContent = "Upload successful.";
    $("uploadForm").reset();
    await renderAssets();
  } catch (err) {
    $("status").textContent = `Upload failed: ${err.message}`;
  }
});

// Initial load
renderAssets();
