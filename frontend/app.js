// app.js - FIXED (no duplicates, uses your existing HTML only)

// --- API endpoints ---
const API = {
  READ_ALL:
    "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",

  UPDATE_TEMPLATE:
    "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",

  DELETE_TEMPLATE:
    "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",

  UPLOAD:
    "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8",
};

// --- DOM (use existing HTML; do NOT create duplicates) ---
const uploadForm = document.getElementById("uploadForm");
const refreshBtn = document.getElementById("refreshBtn");
const gallery = document.getElementById("gallery");
const statusEl = document.getElementById("status");
const loadStatusEl = document.getElementById("loadStatus");

if (!uploadForm || !refreshBtn || !gallery || !statusEl || !loadStatusEl) {
  console.error("Missing required HTML elements. Check IDs in index.html.");
}

// --- helpers ---
const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

const buildUrlWithId = (template, id) =>
  template.replace("{id}", encodeURIComponent(String(id)));

function setLoadStatus(msg) {
  loadStatusEl.textContent = msg || "";
}
function setUploadStatus(msg) {
  statusEl.textContent = msg || "";
}

async function readTextOrJson(res) {
  const text = await res.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

// --- API calls ---
async function fetchAllRestaurants() {
  console.log("GET", API.READ_ALL);
  const res = await fetch(API.READ_ALL, { method: "GET" });
  const { text, json } = await readTextOrJson(res);
  console.log("GET response", res.status, text);

  if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);

  // RAA returns an array of restaurants
  if (Array.isArray(json)) return json;
  return [];
}

async function updateRestaurant(id, payload) {
  const url = buildUrlWithId(API.UPDATE_TEMPLATE, id);
  console.log("PUT", url, payload);

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const { text } = await readTextOrJson(res);
  console.log("PUT response", res.status, text);

  if (!res.ok) throw new Error(`Update failed: ${res.status} ${text}`);
}

async function deleteRestaurant(id) {
  const url = buildUrlWithId(API.DELETE_TEMPLATE, id);
  console.log("DELETE", url);

  const res = await fetch(url, { method: "DELETE" });
  const { text } = await readTextOrJson(res);
  console.log("DELETE response", res.status, text);

  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
}

async function uploadReviewWithImage() {
  // IMPORTANT: your inputs have no "name" attributes, so FormData(form) is unreliable.
  // Build FormData manually with the exact key names Logic Apps expects.
  const restaurantId = document.getElementById("restaurantId").value.trim();
  const userID = document.getElementById("userID").value.trim();
  const userName = document.getElementById("userName").value.trim();
  const rating = document.getElementById("rating").value.trim();
  const comment = document.getElementById("comment").value.trim();
  const fileInput = document.getElementById("file");
  const file = fileInput.files && fileInput.files[0];

  if (!restaurantId) throw new Error("Restaurant ID is required");
  if (!userID) throw new Error("User ID is required");
  if (!userName) throw new Error("User Name is required");
  if (!rating) throw new Error("Rating is required");
  if (!comment) throw new Error("Comment is required");
  if (!file) throw new Error("Image file is required");

  const fd = new FormData();
  fd.append("Filename", file.name);
  fd.append("userID", userID);
  fd.append("userName", userName);
  fd.append("restaurantId", restaurantId);
  fd.append("rating", rating);
  fd.append("comment", comment);
  fd.append("file", file);

  console.log("POST upload", API.UPLOAD);
  const res = await fetch(API.UPLOAD, { method: "POST", body: fd });
  const { text } = await readTextOrJson(res);
  console.log("POST response", res.status, text);

  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);
}

// --- rendering ---
function renderRestaurants(restaurants) {
  // Clear FIRST to prevent duplicates
  gallery.innerHTML = "";

  restaurants.forEach((r) => {
    // match Postman keys: restaurantID, RestaurantName, Address, City
    const id = r.restaurantID;
    const name = safeStr(r.RestaurantName);
    const address = safeStr(r.Address);
    const city = safeStr(r.City);

    const card = document.createElement("div");
    card.className = "item";
    card.dataset.restaurantId = id;

    // No blob/image loading here (restaurants don’t have image urls)
    card.innerHTML = `
      <div><b>restaurantID:</b> ${id}</div>
      <div><b>RestaurantName:</b> <span class="view-name">${name}</span></div>
      <div><b>Address:</b> <span class="view-address">${address}</span></div>
      <div><b>City:</b> <span class="view-city">${city}</span></div>

      <div class="actions">
        <button type="button" class="edit-btn">Edit</button>
        <button type="button" class="delete-btn">Delete</button>
      </div>

      <div class="edit-form" style="display:none; margin-top:8px;">
        <label>Name <input class="edit-name" type="text" value="${name}"></label><br/>
        <label>Address <input class="edit-address" type="text" value="${address}"></label><br/>
        <label>City <input class="edit-city" type="text" value="${city}"></label><br/>
        <button type="button" class="save-btn">Save</button>
        <button type="button" class="cancel-btn">Cancel</button>
      </div>
    `;

    gallery.appendChild(card);
  });
}

// --- event delegation for edit/delete/save/cancel ---
gallery.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const card = e.target.closest(".item");
  if (!card) return;

  const restaurantId = card.dataset.restaurantId;

  const actions = card.querySelector(".actions");
  const editForm = card.querySelector(".edit-form");

  try {
    if (btn.classList.contains("edit-btn")) {
      editForm.style.display = "";
      actions.style.display = "none";
      return;
    }

    if (btn.classList.contains("cancel-btn")) {
      editForm.style.display = "none";
      actions.style.display = "";
      return;
    }

    if (btn.classList.contains("save-btn")) {
      if (!restaurantId) throw new Error("Missing restaurantID on card");

      const payload = {
        RestaurantName: card.querySelector(".edit-name").value,
        Address: card.querySelector(".edit-address").value,
        City: card.querySelector(".edit-city").value,
      };

      await updateRestaurant(restaurantId, payload);
      setLoadStatus("Updated successfully ✅");
      await loadRestaurants();
      return;
    }

    if (btn.classList.contains("delete-btn")) {
      if (!restaurantId) throw new Error("Missing restaurantID on card");
      if (!confirm(`Delete restaurant ${restaurantId}?`)) return;

      await deleteRestaurant(restaurantId);
      setLoadStatus("Deleted successfully ✅");
      await loadRestaurants();
      return;
    }
  } catch (err) {
    alert(err.message);
    console.error(err);
  }
});

// --- main actions ---
async function loadRestaurants() {
  try {
    setLoadStatus("Loading restaurants...");
    const restaurants = await fetchAllRestaurants();
    renderRestaurants(restaurants);
    setLoadStatus(`Loaded ${restaurants.length} restaurants ✅`);
  } catch (err) {
    setLoadStatus(`Load failed: ${err.message}`);
    console.error(err);
    alert(err.message);
  }
}

// Load button
refreshBtn.addEventListener("click", loadRestaurants);

// Upload form
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setUploadStatus("Uploading...");

  try {
    await uploadReviewWithImage();
    setUploadStatus("Upload successful ✅");
    uploadForm.reset();
    // optional: refresh restaurants after upload
    await loadRestaurants();
  } catch (err) {
    setUploadStatus(`Upload failed: ${err.message}`);
    console.error(err);
    alert(err.message);
  }
});

// Initial load
loadRestaurants();
