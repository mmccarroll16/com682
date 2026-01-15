// Logic App endpoints (all provided)
const CIA_URL = "https://prod-02.italynorth.logic.azure.com/workflows/438f49f8253b4c6899482f6ac1bfa072/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=eqZYTEoJrYYYR7-JwgT12Kq9O-So9-KbilcscE3qL9E";
const CIA_IMAGES_URL = "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8";
// Delete endpoint (use assets path; Logic App trigger expects POST)
const DIA_URL = "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/%7Bid%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM";
const RAA_URL = "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs";
const RIA_URL = "https://prod-00.italynorth.logic.azure.com/workflows/d0af0d70328d47a8ad27f7c25e035de9/triggers/When_an_HTTP_request_is_received/paths/invoke/rests/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=xrq9bm3gWPRFCBQJ0ete6qnfTf9KK5PySeme7YzwprE";
const RIA_IMAGES_URL = "https://prod-06.italynorth.logic.azure.com:443/workflows/7699903ea01b48f3adb9fc50033dd1c8/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=CUwD8epstITJInT-mbEJ1RnOeX5_Cz-vfciUlDbb46E";
const UIA_URL = "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c";

// Active endpoints in use
const LIST_ASSETS_URL = RIA_IMAGES_URL; // returns image records with base64 fields
const UPLOAD_URL = CIA_IMAGES_URL; // upload metadata + image
const DELETE_URL = DIA_URL;

// Blob storage config
const BLOB_BASE = "https://localbitesblob.blob.core.windows.net";
const CONTAINER = "localbitesimages";

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

const getPublicBlobUrl = (record) => {
  if (!record) return "";

  // a) use filePath if it already contains container/blobName
  if (record.filePath) {
    let fp = String(record.filePath).trim();
    if (fp.startsWith("/")) fp = fp.slice(1);
    return `${BLOB_BASE}/${fp}`;
  }

  // b) else use fileLocator as blob name
  if (record.fileLocator) {
    const locator = String(record.fileLocator).replace(/^\//, "");
    return `${BLOB_BASE}/${CONTAINER}/${locator}`;
  }

  // c) last resort: fileName (only if that is the blob name)
  if (record.fileName) {
    const name = String(record.fileName).replace(/^\//, "");
    return `${BLOB_BASE}/${CONTAINER}/${name}`;
  }

  return "";
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
    path: decodeMaybeBase64(d.path || d.filePath || d.fileLocator || "")
  }));
}

async function deleteAsset({ id, restaurantId }) {
  const targetId = restaurantId || id;
  const url = DELETE_URL.replace("{id}", encodeURIComponent(targetId));

  console.log("DELETE request", { method: "DELETE", url, targetId });

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json"
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed: ${res.status} ${text}`);
  }
}

async function updateAsset(record, updates) {
  const restaurantId = record.restaurantId || record.restaurantID;
  if (!restaurantId) throw new Error("Missing restaurantId for update");

  const url = UIA_URL.replace("{id}", encodeURIComponent(restaurantId));
  const payload = {
    RestaurantName: updates.RestaurantName,
    Address: updates.Address,
    City: updates.City
  };

  console.log("UPDATE request", { url, body: payload });

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  console.log("UPDATE response", { status: res.status, body: text });

  if (!res.ok) {
    throw new Error(`Update failed: ${res.status} ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
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

    const toStr = (v) => {
      if (v === undefined || v === null) return "";
      return typeof v === "object" ? JSON.stringify(v) : String(v);
    };

    for (const d of docs) {
      const imgUrl = USE_MEDIA_URL ? d?.media?.url : getPublicBlobUrl(d);
      const div = document.createElement("div");
      div.className = "item";

      // Prefer restaurantId; do NOT fall back to blob id
      const restaurantId = toStr(d.restaurantId ?? d.RestaurantId ?? d.restaurantID);
      const restaurantName = toStr(d.restaurantName ?? d.RestaurantName);
      const address = toStr(d.address ?? d.Address);
      const city = toStr(d.city ?? d.City);
      const rating = toStr(d.rating ?? d.Rating);
      const comment = toStr(d.comment ?? d.Comment);
      const pathVal = toStr(d.path ?? d.filePath ?? d.fileLocator);
      const idVal = toStr(d.id);

      div.dataset.restaurantId = restaurantId;

      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = d.fileName ?? "image";
      img.onerror = () => console.error("Blob load failed", { url: imgUrl, record: d });

      div.appendChild(img);
      div.innerHTML += `
        <div class="small"><b>File:</b> ${d.fileName ?? ""}</div>
        <div class="small"><b>Restaurant:</b> ${restaurantId}</div>
        <div class="small"><b>User:</b> ${d.userName ?? ""} (${d.userID ?? ""})</div>
        <div class="small"><b>Rating:</b> ${rating}</div>
        <div class="small"><b>Comment:</b> ${comment}</div>
        <div class="small"><b>Path:</b> ${pathVal}</div>
        <div class="small"><b>ID:</b> ${idVal}</div>
        <button type="button" class="delete-btn">Delete</button>
        <button type="button" class="edit-btn"
          data-name="${restaurantName}"
          data-address="${address}"
          data-city="${city}"
        >Edit</button>
      `;
      $("gallery").appendChild(div);
    }
  } catch (err) {
    $("loadStatus").textContent = `Failed to load: ${err.message}`;
  }
}

$("refreshBtn").addEventListener("click", renderAssets);

$("gallery").addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;

  const card = e.target.closest(".item");
  const restaurantId = card?.dataset.restaurantId;

  if (e.target.classList.contains("edit-btn")) {
    if (!restaurantId) {
      alert("Cannot edit: missing restaurantId on this record.");
      console.log("Edit missing restaurantId", { card, target: e.target });
      return;
    }

    const currentName = e.target.dataset.name || "";
    const currentAddress = e.target.dataset.address || "";
    const currentCity = e.target.dataset.city || "";

    const newName = prompt("Restaurant name:", currentName);
    if (newName === null) return;
    const newAddress = prompt("Address:", currentAddress);
    if (newAddress === null) return;
    const newCity = prompt("City:", currentCity);
    if (newCity === null) return;

    try {
      await updateAsset({ restaurantId }, {
        RestaurantName: newName,
        Address: newAddress,
        City: newCity
      });
      await renderAssets();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  if (e.target.classList.contains("delete-btn")) {
    if (!restaurantId) {
      alert("Cannot delete: missing restaurantId on this record.");
      console.log("Delete missing restaurantId", { card, target: e.target });
      return;
    }
    if (!confirm("Delete this image?")) return;
    try {
      console.log("Delete click restaurantId", restaurantId);
      await deleteAsset({ restaurantId });
      card.remove();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
    return;
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
