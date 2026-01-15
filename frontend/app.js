// app.js - vanilla JS, static frontend for LocalBites restaurants + review upload
// Expects existing HTML elements: #loadRestaurantsBtn, #restaurantsList, #reviewForm
// and inputs: #restaurantIdInput, #userIdInput, #userNameInput, #ratingInput, #commentInput, #fileInput

// --- API endpoints (provided) ---
const API = {
  READ_ALL: "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",
  UPDATE_TEMPLATE: "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",
  DELETE_TEMPLATE: "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",
  UPLOAD: "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8"
};

// --- DOM references (create if missing) ---
const loadBtn = document.querySelector("#loadRestaurantsBtn") || createButton("loadRestaurantsBtn", "Load all");
const listEl = document.querySelector("#restaurantsList") || createContainer("restaurantsList");
const reviewForm = document.querySelector("#reviewForm") || createReviewForm();

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
function createReviewForm() {
  const form = document.createElement("form");
  form.id = "reviewForm";
  form.innerHTML = `
    <h3>Upload review + image</h3>
    <label>Restaurant ID <input id="restaurantIdInput" name="restaurantId" required></label>
    <label>User ID <input id="userIdInput" name="userID" required></label>
    <label>User Name <input id="userNameInput" name="userName" required></label>
    <label>Rating (1-5) <input id="ratingInput" name="rating" type="number" min="1" max="5" required></label>
    <label>Comment <input id="commentInput" name="comment" required></label>
    <label>Filename (optional) <input id="fileNameInput" name="Filename"></label>
    <label>Choose Image <input id="fileInput" name="file" type="file" accept="image/*" required></label>
    <button type="submit">Upload</button>
    <p id="status"></p>
  `;
  document.body.appendChild(form);
  return form;
}

// --- Helpers ---
const safe = (v) => {
  if (v === undefined || v === null) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
};
const decodeMaybeBase64Obj = (v) => {
  if (v && typeof v === "object" && "$content" in v) {
    try { return atob(v.$content); } catch { return v.$content; }
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
  try { data = JSON.parse(text); } catch { data = []; }
  console.log("GET response", res.status, text);
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);
  return Array.isArray(data) ? data : (data.Documents ?? data.documents ?? []);
}

async function updateRestaurant(id, payload) {
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

async function deleteRestaurant(id) {
  const url = buildUrlWithId(API.DELETE_TEMPLATE, id);
  console.log("DELETE", { url, id });
  const res = await fetch(url, { method: "DELETE" });
  const text = await res.text();
  console.log("DELETE response", res.status, text);
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
  return text;
}

async function uploadReview(formEl) {
  const fd = new FormData(formEl);
  const fileInput = formEl.querySelector("#fileInput");
  if (!fileInput.files.length) throw new Error("File is required");
  const fileNameInput = formEl.querySelector("#fileNameInput");
  if (!fileNameInput.value) fd.set("Filename", fileInput.files[0].name);
  fd.set("file", fileInput.files[0]);
  console.log("POST upload", API.UPLOAD);
  const res = await fetch(API.UPLOAD, { method: "POST", body: fd });
  const text = await res.text();
  console.log("POST response", res.status, text);
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);
  return text;
}

// --- Rendering ---
function renderList(items) {
  listEl.innerHTML = "";
  items.forEach((item) => listEl.appendChild(createCard(item)));
}

function createCard(item) {
  const card = document.createElement("div");
  card.className = "item";

  // Use restaurantID (capital D) as primary ID
  const restaurantId = safe(item.restaurantID ?? item.restaurantId ?? item.RestaurantID ?? item.RestaurantId ?? item.id ?? item.Id);

  const name = safe(decodeMaybeBase64Obj(item.RestaurantName ?? item.restaurantName));
  const address = safe(decodeMaybeBase64Obj(item.Address ?? item.address));
  const city = safe(decodeMaybeBase64Obj(item.City ?? item.city));

  card.dataset.restaurantId = restaurantId;

  card.innerHTML = `
    <div><b>RestaurantId:</b> ${restaurantId}</div>
    <div><b>RestaurantName:</b> ${name}</div>
    <div><b>Address:</b> ${address}</div>
    <div><b>City:</b> ${city}</div>
    <div class="actions">
      <button type="button" class="edit-btn">Edit</button>
      <button type="button" class="delete-btn">Delete</button>
    </div>
    <div class="edit-form" style="display:none;">
      <label>Name <input type="text" name="RestaurantName" value="${name}"></label>
      <label>Address <input type="text" name="Address" value="${address}"></label>
      <label>City <input type="text" name="City" value="${city}"></label>
      <button type="button" class="save-btn">Save</button>
      <button type="button" class="cancel-btn">Cancel</button>
    </div>
  `;

  const editBtn = card.querySelector(".edit-btn");
  const deleteBtn = card.querySelector(".delete-btn");
  const editForm = card.querySelector(".edit-form");
  const actions = card.querySelector(".actions");

  editBtn.addEventListener("click", () => {
    editForm.style.display = "";
    actions.style.display = "none";
  });
  editForm.querySelector(".cancel-btn").addEventListener("click", () => {
    editForm.style.display = "none";
    actions.style.display = "";
  });
  editForm.querySelector(".save-btn").addEventListener("click", async () => {
    const payload = {
      RestaurantName: editForm.querySelector('input[name="RestaurantName"]').value,
      Address: editForm.querySelector('input[name="Address"]').value,
      City: editForm.querySelector('input[name="City"]').value
    };
    try {
      await updateRestaurant(restaurantId, payload);
      await loadAndRender();
    } catch (err) {
      alert(err.message);
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!restaurantId) {
      alert("Missing restaurantId");
      console.error("Missing restaurantId", { item });
      return;
    }
    if (!confirm("Delete this restaurant?")) return;
    try {
      await deleteRestaurant(restaurantId);
      card.remove();
    } catch (err) {
      alert(err.message);
    }
  });

  return card;
}

// --- Event handlers ---
async function loadAndRender() {
  try {
    const items = await fetchAll();
    renderList(items);
  } catch (err) {
    alert(err.message);
  }
}

loadBtn.addEventListener("click", loadAndRender);

reviewForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = document.querySelector("#status");
  statusEl.textContent = "Uploading...";
  try {
    await uploadReview(reviewForm);
    statusEl.textContent = "Upload successful.";
    reviewForm.reset();
    await loadAndRender();
  } catch (err) {
    statusEl.textContent = `Upload failed: ${err.message}`;
    alert(err.message);
  }
});

// Initial load
loadAndRender();
