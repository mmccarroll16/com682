// app.js - Restaurants CRUD + Reviews (text-only + photo upload)

const API = {
  // Create restaurant (Insert row)
  CIA_CREATE:
    "https://prod-02.italynorth.logic.azure.com/workflows/438f49f8253b4c6899482f6ac1bfa072/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=eqZYTEoJrYYYR7-JwgT12Kq9O-So9-KbilcscE3qL9E",

  // Read all restaurants
  RAA_READ_ALL:
    "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",

  // Update restaurant by ID
  UIA_UPDATE_TEMPLATE:
    "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",

  // Delete restaurant by ID (IMPORTANT: expects body restaurantId too)
  DIA_DELETE_TEMPLATE:
    "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",

  // Upload review + image
  CIA_IMAGES_UPLOAD:
    "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8",
};

// ---------------- DOM ----------------
const createRestaurantForm = document.getElementById("createRestaurantForm");
const createStatus = document.getElementById("createStatus");

const uploadForm = document.getElementById("uploadForm");
const refreshBtn = document.getElementById("refreshBtn");
const gallery = document.getElementById("gallery");

const statusEl = document.getElementById("status");
const loadStatusEl = document.getElementById("loadStatus");

// ---------------- Reviews storage (client-side) ----------------
// (Your backend upload is working, but it doesn’t provide a public blob URL because your container is private.
// So we show a local preview + keep reviews in localStorage for marking/demo.)
const REVIEWS_KEY = "localbites_reviews_v2";
let reviewsByRestaurantId = loadReviews();

// ---------------- Helpers ----------------
const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildUrl(template, id) {
  return template.replace("{id}", encodeURIComponent(String(id)));
}

async function readTextOrJson(res) {
  const text = await res.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

function setLoadStatus(msg) {
  loadStatusEl.textContent = msg || "";
}
function setUploadStatus(msg) {
  statusEl.textContent = msg || "";
}
function setCreateStatus(msg) {
  createStatus.textContent = msg || "";
}

function loadReviews() {
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveReviews() {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviewsByRestaurantId));
}

function addReviewToStore(restaurantId, review) {
  const rid = String(restaurantId);
  if (!reviewsByRestaurantId[rid]) reviewsByRestaurantId[rid] = [];
  reviewsByRestaurantId[rid].push(review);
  saveReviews();
}

// ---------------- API ----------------
async function fetchAllRestaurants() {
  const res = await fetch(API.RAA_READ_ALL, { method: "GET" });
  const { text, json } = await readTextOrJson(res);

  console.log("GET restaurants", res.status, text);
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);

  return Array.isArray(json) ? json : [];
}

async function createRestaurant(payload) {
  const res = await fetch(API.CIA_CREATE, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const { text } = await readTextOrJson(res);
  console.log("POST create", res.status, text);

  if (!res.ok) throw new Error(`Create failed: ${res.status} ${text}`);
}

async function updateRestaurant(id, payload) {
  const url = buildUrl(API.UIA_UPDATE_TEMPLATE, id);

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  const { text } = await readTextOrJson(res);
  console.log("PUT update", res.status, text);

  if (!res.ok) throw new Error(`Update failed: ${res.status} ${text}`);
}

async function deleteRestaurant(id) {
  const url = buildUrl(API.DIA_DELETE_TEMPLATE, id);

  // IMPORTANT FIX:
  // Your delete Logic App trigger schema requires restaurantId in the JSON body.
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ restaurantId: Number(id) }),
  });

  const { text } = await readTextOrJson(res);
  console.log("DELETE", res.status, text);

  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
}

async function uploadReviewWithImage() {
  const restaurantId = document.getElementById("restaurantId").value.trim();
  const userID = document.getElementById("userID").value.trim();
  const userName = document.getElementById("userName").value.trim();
  const rating = document.getElementById("rating").value.trim();
  const comment = document.getElementById("comment").value.trim();
  const file = document.getElementById("file").files?.[0];

  if (!restaurantId) throw new Error("Restaurant ID is required");
  if (!userID) throw new Error("User ID is required");
  if (!userName) throw new Error("User Name is required");
  if (!rating) throw new Error("Rating is required");
  if (!comment) throw new Error("Comment is required");
  if (!file) throw new Error("Image file is required");

  // local preview (storage is private so blob URL may not be accessible)
  const previewUrl = URL.createObjectURL(file);

  const fd = new FormData();
  fd.append("Filename", file.name);
  fd.append("userID", userID);
  fd.append("userName", userName);
  fd.append("restaurantId", restaurantId);
  fd.append("rating", rating);
  fd.append("comment", comment);
  fd.append("file", file);

  const res = await fetch(API.CIA_IMAGES_UPLOAD, { method: "POST", body: fd });
  const { text, json } = await readTextOrJson(res);

  console.log("POST upload", res.status, text);
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);

  return {
    restaurantId: String(restaurantId),
    userID,
    userName,
    rating,
    comment,
    fileName: file.name,
    previewUrl,
    createdAt: new Date().toISOString(),
    backend: json || text,
  };
}

// ---------------- Rendering ----------------
function renderRestaurants(restaurants) {
  // Always clear first => prevents duplicates
  gallery.innerHTML = "";

  restaurants.forEach((r) => {
    const restaurantId = safeStr(r.restaurantID);
    const name = safeStr(r.RestaurantName);
    const address = safeStr(r.Address);
    const city = safeStr(r.City);

    const card = document.createElement("div");
    card.className = "item";
    card.dataset.restaurantId = restaurantId;

    card.innerHTML = `
      <div><b>restaurantID:</b> ${restaurantId}</div>
      <div><b>RestaurantName:</b> <span class="view-name">${name}</span></div>
      <div><b>Address:</b> <span class="view-address">${address}</span></div>
      <div><b>City:</b> <span class="view-city">${city}</span></div>

      <div class="actions" style="margin-top:10px;">
        <button type="button" class="edit-btn">Edit</button>
        <button type="button" class="delete-btn">Delete</button>
      </div>

      <div class="edit-form" style="display:none; margin-top:10px;">
        <label>Name <input class="edit-name" type="text" value="${name}"></label><br/>
        <label>Address <input class="edit-address" type="text" value="${address}"></label><br/>
        <label>City <input class="edit-city" type="text" value="${city}"></label><br/>
        <button type="button" class="save-btn">Save</button>
        <button type="button" class="cancel-btn">Cancel</button>
      </div>

      <div class="reviews" style="margin-top:14px; border-top:1px solid #ddd; padding-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Reviews</h3>
          <span class="review-count small"></span>
        </div>

        <form class="quick-review" style="margin-top:8px;">
          <div class="small" style="opacity:.8;">Add a review (text-only)</div>
          <input class="qr-user" placeholder="Your name" required />
          <input class="qr-rating" type="number" min="1" max="5" placeholder="Rating 1-5" required />
          <input class="qr-comment" placeholder="Comment" required />
          <button type="submit">Add review</button>
        </form>

        <div class="review-list"></div>
      </div>
    `;

    gallery.appendChild(card);
    renderReviewsForRestaurant(restaurantId);
  });
}

function renderReviewsForRestaurant(restaurantId) {
  const rid = String(restaurantId);
  const card = gallery.querySelector(`.item[data-restaurant-id="${CSS.escape(rid)}"]`);
  if (!card) return;

  const listEl = card.querySelector(".review-list");
  const countEl = card.querySelector(".review-count");

  const reviews = reviewsByRestaurantId[rid] || [];
  countEl.textContent = reviews.length ? `${reviews.length} review(s)` : "No reviews yet";

  listEl.innerHTML = "";
  reviews
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .forEach((rev) => {
      const box = document.createElement("div");
      box.style.border = "1px solid #eee";
      box.style.borderRadius = "10px";
      box.style.padding = "10px";
      box.style.marginTop = "8px";

      box.innerHTML = `
        <div><b>User:</b> ${safeStr(rev.userName)} ${rev.userID ? `(${safeStr(rev.userID)})` : ""}</div>
        <div><b>Rating:</b> ${safeStr(rev.rating)}</div>
        <div><b>Comment:</b> ${safeStr(rev.comment)}</div>
        ${rev.fileName ? `<div><b>File:</b> ${safeStr(rev.fileName)}</div>` : ""}
        ${rev.previewUrl ? `<img src="${rev.previewUrl}" style="margin-top:8px; max-width:100%; border-radius:10px;" />` : ""}
        <div class="small" style="opacity:.7; margin-top:6px;">${safeStr(rev.createdAt)}</div>
      `;

      listEl.appendChild(box);
    });
}

// ---------------- Main load ----------------
async function loadRestaurants() {
  try {
    setLoadStatus("Loading restaurants...");
    const restaurants = await fetchAllRestaurants();
    renderRestaurants(restaurants);
    setLoadStatus(`Loaded ${restaurants.length} restaurants ✅`);
  } catch (err) {
    console.error(err);
    setLoadStatus(`Load failed: ${err.message}`);
    alert(err.message);
  }
}

// Retry reload after delete (handles any slight lag)
async function loadRestaurantsUntilDeleted(deletedId, tries = 3) {
  const target = String(deletedId);

  for (let i = 0; i < tries; i++) {
    await loadRestaurants();
    const stillThere = !!gallery.querySelector(`.item[data-restaurant-id="${CSS.escape(target)}"]`);
    if (!stillThere) return;
    await sleep(400);
  }
}

// ---------------- Events ----------------
refreshBtn.addEventListener("click", loadRestaurants);

// CREATE restaurant
createRestaurantForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setCreateStatus("Creating...");

  try {
    const payload = {
      RestaurantName: document.getElementById("newName").value.trim(),
      Address: document.getElementById("newAddress").value.trim(),
      City: document.getElementById("newCity").value.trim(),
    };

    await createRestaurant(payload);
    setCreateStatus("Created ✅");
    createRestaurantForm.reset();
    await loadRestaurants();
  } catch (err) {
    console.error(err);
    setCreateStatus(`Create failed: ${err.message}`);
    alert(err.message);
  }
});

// UPLOAD review+image
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setUploadStatus("Uploading...");

  try {
    const review = await uploadReviewWithImage();

    // store locally so you SEE reviews under the restaurant (your blob container is private)
    addReviewToStore(review.restaurantId, {
      userName: review.userName,
      userID: review.userID,
      rating: review.rating,
      comment: review.comment,
      fileName: review.fileName,
      previewUrl: review.previewUrl,
      createdAt: review.createdAt,
    });

    // show immediately
    renderReviewsForRestaurant(review.restaurantId);

    setUploadStatus("Upload successful ✅");
    uploadForm.reset();
  } catch (err) {
    console.error(err);
    setUploadStatus(`Upload failed: ${err.message}`);
    alert(err.message);
  }
});

// Delegated clicks + review forms inside each restaurant
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
      const payload = {
        RestaurantName: card.querySelector(".edit-name").value,
        Address: card.querySelector(".edit-address").value,
        City: card.querySelector(".edit-city").value,
      };
      await updateRestaurant(restaurantId, payload);
      await loadRestaurants();
      return;
    }

    if (btn.classList.contains("delete-btn")) {
      if (!confirm(`Delete restaurant ${restaurantId}?`)) return;

      await deleteRestaurant(restaurantId);

      // remove from UI immediately
      card.remove();

      // also remove stored reviews for it
      delete reviewsByRestaurantId[String(restaurantId)];
      saveReviews();

      // reload (and retry) so it DOESN'T COME BACK
      await loadRestaurantsUntilDeleted(restaurantId, 3);
      return;
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
});

// Handle "Add review (text-only)" form submissions per card
gallery.addEventListener("submit", (e) => {
  const form = e.target.closest(".quick-review");
  if (!form) return;

  e.preventDefault();
  const card = form.closest(".item");
  const restaurantId = card.dataset.restaurantId;

  const userName = form.querySelector(".qr-user").value.trim();
  const rating = form.querySelector(".qr-rating").value.trim();
  const comment = form.querySelector(".qr-comment").value.trim();

  addReviewToStore(restaurantId, {
    userName,
    userID: "", // text-only
    rating,
    comment,
    fileName: "",
    previewUrl: "",
    createdAt: new Date().toISOString(),
  });

  form.reset();
  renderReviewsForRestaurant(restaurantId);
});

// Initial load
loadRestaurants();
