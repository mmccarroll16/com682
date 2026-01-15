// Logic App endpoints (replace with your RAA URLs)
const RESTAURANTS_GET_URL = "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs"; // GET all restaurants
const RESTAURANTS_UPDATE_URL_TEMPLATE = "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/16?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c";
const RESTAURANTS_DELETE_URL_TEMPLATE = "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/%7Bid%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM";

// Delete endpoint (DELETE /rest/v1/assets/{id})
const DELETE_URL = RESTAURANTS_DELETE_URL_TEMPLATE;
// Update endpoint (PUT /rest/assets/{id})
const UIA_URL = RESTAURANTS_UPDATE_URL_TEMPLATE;

// Blob storage config
const BLOB_BASE = "https://localbitesblob.blob.core.windows.net";
const CONTAINER = "localbitesimages";
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
  if (record.filePath) {
    let fp = String(record.filePath).trim();
    if (fp.startsWith("/")) fp = fp.slice(1);
    return `${BLOB_BASE}/${fp}`;
  }
  if (record.fileLocator) {
    const locator = String(record.fileLocator).replace(/^\//, "");
    return `${BLOB_BASE}/${CONTAINER}/${locator}`;
  }
  if (record.fileName) {
    const name = String(record.fileName).replace(/^\//, "");
    return `${BLOB_BASE}/${CONTAINER}/${name}`;
  }
  return "";
};

// Fetch restaurants
async function fetchAllAssets() {
  try {
    console.log("GET", RESTAURANTS_GET_URL);
    const res = await fetch(RESTAURANTS_GET_URL, { method: "GET" });
    if (!res.ok) throw new Error(`Failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const docs = Array.isArray(data) ? data : (data.Documents ?? data.documents ?? []);
    return docs;
  } catch (err) {
    alert("Failed to load restaurants");
    console.error(err);
    return [];
  }
}

// Build URLs with id in path
function buildUrlWithId(template, id) {
  if (template.includes("{id}")) return template.replace("{id}", encodeURIComponent(id));
  const [base, qs] = template.split("?");
  const cleaned = base.replace(/\/$/, "");
  return `${cleaned}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
}

// Delete restaurant
async function deleteAsset(id) {
  if (!id) throw new Error("Missing id for delete");
  const url = buildUrlWithId(DELETE_URL, id);
  console.log("DELETE request", { method: "DELETE", url, id });
  const res = await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
  return text;
}

// Update restaurant
async function updateAsset(id, updates) {
  if (!id) throw new Error("Missing id for update");
  const url = buildUrlWithId(UIA_URL, id);
  const payload = {
    RestaurantName: updates.RestaurantName,
    Address: updates.Address,
    City: updates.City
  };
  console.log("UPDATE request", { method: "PUT", url, id, body: payload });
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log("UPDATE response", { status: res.status, body: text });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Render list
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

      const assetId = toStr(decodeMaybeBase64(d.RestaurantId ?? d.restaurantId ?? d.restaurantID ?? d.id ?? d.ID));
      const restaurantName = toStr(decodeMaybeBase64(d.restaurantName ?? d.RestaurantName));
      const address = toStr(decodeMaybeBase64(d.address ?? d.Address));
      const city = toStr(decodeMaybeBase64(d.city ?? d.City));
      const rating = toStr(decodeMaybeBase64(d.rating ?? d.Rating));
      const comment = toStr(decodeMaybeBase64(d.comment ?? d.Comment));
      const pathVal = toStr(decodeMaybeBase64(d.path ?? d.filePath ?? d.fileLocator));
      const idVal = toStr(decodeMaybeBase64(d.id ?? d.ID));
      const userName = toStr(decodeMaybeBase64(d.userName ?? d.user ?? d.User));
      const userID = toStr(decodeMaybeBase64(d.userID ?? d.UserID));

      div.dataset.restaurantid = assetId;
      div.dataset.assetId = assetId;

      const img = document.createElement("img");
      img.src = imgUrl;
      img.alt = d.fileName ?? "image";
      img.onerror = () => console.error("Blob load failed", { url: imgUrl, record: d });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-btn";
      deleteBtn.dataset.restaurantid = assetId;
      deleteBtn.dataset.assetId = assetId;
      deleteBtn.textContent = "Delete";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit-btn";
      editBtn.dataset.restaurantid = assetId;
      editBtn.dataset.assetId = assetId;
      editBtn.dataset.name = restaurantName;
      editBtn.dataset.address = address;
      editBtn.dataset.city = city;
      editBtn.textContent = "Edit";

      div.appendChild(img);
      div.innerHTML += `
        <div class="small"><b>File:</b> ${d.fileName ?? ""}</div>
        <div class="small"><b>Restaurant:</b> ${assetId}</div>
        <div class="small"><b>User:</b> ${userName} (${userID})</div>
        <div class="small"><b>Rating:</b> ${rating}</div>
        <div class="small"><b>Comment:</b> ${comment}</div>
        <div class="small"><b>Path:</b> ${pathVal}</div>
        <div class="small"><b>ID:</b> ${idVal}</div>
      `;
      div.appendChild(deleteBtn);
      div.appendChild(editBtn);
      $("gallery").appendChild(div);
    }
  } catch (err) {
    $("loadStatus").textContent = `Failed to load: ${err.message}`;
  }
}

$("refreshBtn").addEventListener("click", renderAssets);

$("gallery").addEventListener("click", async (e) => {
  if (e.target.tagName !== "BUTTON") return;
  e.preventDefault();

  const card = e.target.closest(".item");
  const assetId = e.target.dataset.assetId || card?.dataset.assetId;
  if (!assetId) {
    alert("Missing id for delete/edit");
    console.log("Missing id", { card, target: e.target });
    return;
  }

  if (e.target.classList.contains("edit-btn")) {
    const newName = prompt("Restaurant name:", e.target.dataset.name || "");
    if (newName === null) return;
    const newAddress = prompt("Address:", e.target.dataset.address || "");
    if (newAddress === null) return;
    const newCity = prompt("City:", e.target.dataset.city || "");
    if (newCity === null) return;

    try {
      await updateAsset(assetId, {
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
    if (!confirm("Delete this image?")) return;
    try {
      await deleteAsset(assetId);
      card.remove();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  }
});

// Initial load
renderAssets();
