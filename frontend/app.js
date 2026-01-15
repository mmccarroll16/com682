// app.js - vanilla JS, production-ready for LocalBites static site

// --- API endpoints (provided) ---
const API = {
  READ_ALL: "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",
  CREATE: "https://prod-02.italynorth.logic.azure.com/workflows/438f49f8253b4c6899482f6ac1bfa072/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=eqZYTEoJrYYYR7-JwgT12Kq9O-So9-KbilcscE3qL9E",
  UPDATE_TEMPLATE: "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",
  DELETE_TEMPLATE: "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",
  UPLOAD: "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8"
};

// --- DOM helpers ---
const $ = (sel) => document.querySelector(sel);
const gallery = $("#gallery") || createContainer("gallery");
const loadBtn = $("#loadAll") || createButton("loadAll", "Load all");
const uploadForm = $("#uploadForm") || createUploadForm();

function createContainer(id) {
  const div = document.createElement("div");
  div.id = id;
  document.body.appendChild(div);
  return div;
}
function createButton(id, text) {
  const btn = document.createElement("button");
  btn.id = id;
  btn.textContent = text;
  document.body.appendChild(btn);
  return btn;
}
function createUploadForm() {
  const form = document.createElement("form");
  form.id = "uploadForm";
  form.innerHTML = `
    <h3>Upload review + image</h3>
    <label>Restaurant ID <input name="restaurantId" required /></label>
    <label>User ID <input name="userID" required /></label>
    <label>User Name <input name="userName" required /></label>
    <label>Rating (1-5) <input type="number" name="rating" min="1" max="5" required /></label>
    <label>Comment <input name="comment" required /></label>
    <label>Filename (optional) <input name="fileName" /></label>
    <label>Choose Image <input type="file" name="file" accept="image/*" required /></label>
    <button type="submit">Upload</button>
    <p id="status"></p>
  `;
  document.body.appendChild(form);
  return form;
}

// --- Utility helpers ---
const safe = (v) => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};
const decodeMaybeBase64Obj = (v) => {
  if (v && typeof v === "object" && "$content" in v) {
    try {
      return atob(v.$content);
    } catch {
      return v.$content;
    }
  }
  return v;
};
const buildUrlWithId = (template, id) =>
  template.includes("{id}")
    ? template.replace("{id}", encodeURIComponent(id))
    : (() => {
        const [base, qs] = template.split("?");
        const cleaned = base.replace(/\/$/, "");
        return `${cleaned}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
      })();

// --- API calls ---
async function fetchAll() {
  console.log("GET", API.READ_ALL);
  const res = await fetch(API.READ_ALL, { method: "GET" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = [];
  }
  console.log("GET response", res.status, text);
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);
  const docs = Array.isArray(data) ? data : data.Documents ?? data.documents ?? [];
  return docs;
}

async function createAsset(formData) {
  console.log("POST upload", API.UPLOAD);
  const res = await fetch(API.UPLOAD, { method: "POST", body: formData });
  const text = await res.text();
  console.log("POST response", res.status, text);
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);
  return text;
}

async function updateAsset(id, payload) {
  const url = buildUrlWithId(API.UPDATE_TEMPLATE, id);
  console.log("PUT", { url, id, body: payload });
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  console.log("PUT response", res.status, text);
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${text}`);
  return text;
}

async function deleteAsset(id) {
  const url = buildUrlWithId(API.DELETE_TEMPLATE, id);
  console.log("DELETE", { url, id });
  const res = await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
  const text = await res.text();
  console.log("DELETE response", res.status, text);
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
  return text;
}

// --- Blob URL builder ---
const BLOB_BASE = "https://localbitesblob.blob.core.windows.net";
const CONTAINER = "localbitesimages";
function buildBlobUrl(record) {
  if (!record) return "";
  const rawPath = record.path || record.filePath || "";
  const file = record.fileName || "";
  let path = rawPath.trim();
  if (path.startsWith("/")) path = path.slice(1);
  if (path.toLowerCase().startsWith(CONTAINER.toLowerCase() + "/")) {
    path = path.slice(CONTAINER.length + 1);
  }
  if (path.endsWith("/")) path = path.slice(0, -1);
  const hasFileInPath = file && path.toLowerCase().endsWith(file.toLowerCase());
  const blobName = hasFileInPath ? path : [path, file].filter(Boolean).join("/");
  if (!blobName) return "";
  return `${BLOB_BASE}/${CONTAINER}/${blobName}`;
}

// --- UI rendering ---
function renderList(items) {
  gallery.innerHTML = "";
  items.forEach((item) => {
    const card = createCard(item);
    gallery.appendChild(card);
  });
}

function createCard(item) {
  const card = document.createElement("div");
  card.className = "item";
  const img = document.createElement("img");
  const url = item.media?.url || buildBlobUrl(item);
  img.src = url;
  img.alt = safe(item.fileName) || "image";
  img.onerror = () => console.error("Blob load failed", { url, record: item });

  const id = safe(item.id ?? item.Id);
  card.dataset.restaurantId = id;

  const fileName = safe(item.fileName);
  const restaurantId = safe(item.restaurantId ?? item.RestaurantId);
  const userName = safe(item.userName ?? item.UserName);
  const userID = safe(item.userID ?? item.UserID);
  const rating = safe(item.rating ?? item.Rating);
  const comment = safe(item.comment ?? item.Comment);
  const path = safe(item.filePath ?? item.path ?? item.fileLocator);
  const pk = safe(item.pk);

  card.innerHTML = "";
  card.appendChild(img);
  card.innerHTML += `
    <div class="small"><b>File name:</b> ${fileName}</div>
    <div class="small"><b>RestaurantId:</b> ${restaurantId}</div>
    <div class="small"><b>User:</b> ${userName} (${userID})</div>
    <div class="small"><b>Rating:</b> ${rating}</div>
    <div class="small"><b>Comment:</b> ${comment}</div>
    <div class="small"><b>Path:</b> ${path}</div>
    <div class="small"><b>pk:</b> ${pk}</div>
    <div class="small"><b>ID:</b> ${id}</div>
  `;

  const actions = document.createElement("div");
  actions.className = "actions";
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "edit-btn";
  editBtn.textContent = "Edit";
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  actions.append(editBtn, deleteBtn);
  card.appendChild(actions);

  // Inline edit UI (rating/comment as a minimal editable set)
  const editForm = document.createElement("div");
  editForm.className = "edit-form";
  editForm.style.display = "none";
  editForm.innerHTML = `
    <label>Rating <input type="number" min="1" max="5" name="rating" value="${rating}"></label>
    <label>Comment <input type="text" name="comment" value="${comment}"></label>
    <label>RestaurantName <input type="text" name="RestaurantName" value="${safe(item.RestaurantName ?? item.restaurantName)}"></label>
    <label>Address <input type="text" name="Address" value="${safe(item.Address ?? item.address)}"></label>
    <label>City <input type="text" name="City" value="${safe(item.City ?? item.city)}"></label>
    <button type="button" class="save-btn">Save</button>
    <button type="button" class="cancel-btn">Cancel</button>
  `;
  card.appendChild(editForm);

  editBtn.addEventListener("click", () => {
    editForm.style.display = "";
    card.querySelector(".actions").style.display = "none";
  });
  editForm.querySelector(".cancel-btn").addEventListener("click", () => {
    editForm.style.display = "none";
    card.querySelector(".actions").style.display = "";
  });
  editForm.querySelector(".save-btn").addEventListener("click", async () => {
    const payload = {
      RestaurantName: editForm.querySelector('input[name="RestaurantName"]').value,
      Address: editForm.querySelector('input[name="Address"]').value,
      City: editForm.querySelector('input[name="City"]').value,
      rating: editForm.querySelector('input[name="rating"]').value,
      comment: editForm.querySelector('input[name="comment"]').value
    };
    try {
      await updateAsset(id, payload);
      await loadAndRender();
    } catch (err) {
      alert(err.message);
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm("Delete this item?")) return;
    try {
      await deleteAsset(id);
      card.remove();
    } catch (err) {
      alert(err.message);
    }
  });

  return card;
}

// --- Upload review + image ---
async function handleUploadReview(e) {
  e.preventDefault();
  const fd = new FormData(uploadForm);
  const fileInput = uploadForm.querySelector('input[name="file"]');
  if (!fileInput.files.length) {
    alert("Please choose a file");
    return;
  }
  // Ensure Filename field falls back to file.name
  const fileNameInput = uploadForm.querySelector('input[name="fileName"]');
  if (!fileNameInput.value) {
    fd.set("Filename", fileInput.files[0].name);
  } else {
    fd.set("Filename", fileNameInput.value);
  }
  fd.set("File", fileInput.files[0]);
  try {
    await createAsset(fd);
    alert("Upload successful");
    uploadForm.reset();
    await loadAndRender();
  } catch (err) {
    alert(err.message);
  }
}

// --- Event bindings ---
loadBtn.addEventListener("click", loadAndRender);
uploadForm.addEventListener("submit", handleUploadReview);

// --- Load + render helper ---
async function loadAndRender() {
  try {
    const items = await fetchAll();
    renderList(items);
  } catch (err) {
    alert(err.message);
  }
}

// Initial load
loadAndRender();
