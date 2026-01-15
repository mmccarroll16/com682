// app.js - Restaurants CRUD + Reviews (global text form + image upload)
// Fixes: delete URL replacement + no-body DELETE, editable reviews

const API = {
  CIA_CREATE:
    "https://prod-02.italynorth.logic.azure.com/workflows/438f49f8253b4c6899482f6ac1bfa072/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=eqZYTEoJrYYYR7-JwgT12Kq9O-So9-KbilcscE3qL9E",

  RAA_READ_ALL:
    "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",

  UIA_UPDATE_TEMPLATE:
    "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",

  // NOTE: if your actual URL includes %7Bid%7D, buildUrl() below will still replace it.
  DIA_DELETE_TEMPLATE:
    "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",

  CIA_IMAGES_UPLOAD:
    "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8",
};

// ---------------- DOM ----------------
const createRestaurantForm = document.getElementById("createRestaurantForm");
const createStatus = document.getElementById("createStatus");

const textReviewForm = document.getElementById("textReviewForm");
const textReviewStatus = document.getElementById("textReviewStatus");

const uploadForm = document.getElementById("uploadForm");
const refreshBtn = document.getElementById("refreshBtn");
const gallery = document.getElementById("gallery");

const statusEl = document.getElementById("status");
const loadStatusEl = document.getElementById("loadStatus");

// ---------------- Reviews storage ----------------
const REVIEWS_KEY = "localbites_reviews_v3";
let reviewsByRestaurantId = loadReviews();

// ---------------- Helpers ----------------
const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

function uid() {
  return "r_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ✅ replaces BOTH {id} and %7Bid%7D
function buildUrl(template, id) {
  const enc = encodeURIComponent(String(id));
  return template
    .replaceAll("{id}", enc)
    .replaceAll("%7Bid%7D", enc)
    .replaceAll("%7BID%7D", enc);
}

async function readTextOrJson(res) {
  const text = await res.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

function setLoadStatus(msg) { loadStatusEl.textContent = msg || ""; }
function setUploadStatus(msg) { statusEl.textContent = msg || ""; }
function setCreateStatus(msg) { createStatus.textContent = msg || ""; }
function setTextReviewStatus(msg) { textReviewStatus.textContent = msg || ""; }

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
function updateReviewInStore(restaurantId, reviewId, patch) {
  const rid = String(restaurantId);
  const arr = reviewsByRestaurantId[rid] || [];
  const idx = arr.findIndex((r) => r.id === reviewId);
  if (idx === -1) return;
  arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
  saveReviews();
}
function deleteReviewFromStore(restaurantId, reviewId) {
  const rid = String(restaurantId);
  reviewsByRestaurantId[rid] = (reviewsByRestaurantId[rid] || []).filter((r) => r.id !== reviewId);
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

  // ✅ IMPORTANT FIX: DO NOT SEND BODY ON DELETE (your trigger rejects it)
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const { text } = await readTextOrJson(res);
  console.log("DELETE", url, res.status, text);

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
    id: uid(),
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
  gallery.innerHTML = ""; // ✅ prevents duplicates

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
      box.className = "review-box";
      box.dataset.reviewId = rev.id;

      box.style.border = "1px solid #eee";
      box.style.borderRadius = "10px";
      box.style.padding = "10px";
      box.style.marginTop = "8px";

      const created = safeStr(rev.createdAt);
      const updated = rev.updatedAt ? ` (edited ${safeStr(rev.updatedAt)})` : "";

      box.innerHTML = `
        <div class="review-view">
          <div><b>User:</b> ${safeStr(rev.userName)} ${rev.userID ? `(${safeStr(rev.userID)})` : ""}</div>
          <div><b>Rating:</b> ${safeStr(rev.rating)}</div>
          <div><b>Comment:</b> ${safeStr(rev.comment)}</div>
          ${rev.fileName ? `<div><b>File:</b> ${safeStr(rev.fileName)}</div>` : ""}
          ${rev.previewUrl ? `<img src="${rev.previewUrl}" style="margin-top:8px; max-width:100%; border-radius:10px;" />` : ""}
          <div class="small" style="opacity:.7; margin-top:6px;">${created}${updated}</div>

          <div style="margin-top:8px;">
            <button type="button" class="review-edit-btn">Edit review</button>
            <button type="button" class="review-delete-btn">Delete review</button>
          </div>
        </div>

        <div class="review-edit" style="display:none; margin-top:8px;">
          <label>Your name <input class="rev-edit-user" value="${safeStr(rev.userName)}" /></label><br/>
          <label>Rating 1-5 <input class="rev-edit-rating" type="number" min="1" max="5" value="${safeStr(rev.rating)}" /></label><br/>
          <label>Comment <input class="rev-edit-comment" value="${safeStr(rev.comment)}" /></label><br/>
          <button type="button" class="review-save-btn">Save</button>
          <button type="button" class="review-cancel-btn">Cancel</button>
        </div>
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

// ✅ GLOBAL TEXT-ONLY REVIEW FORM
textReviewForm.addEventListener("submit", (e) => {
  e.preventDefault();
  setTextReviewStatus("");

  const restaurantId = document.getElementById("reviewRestaurantId").value.trim();
  const userName = document.getElementById("reviewUserName").value.trim();
  const rating = document.getElementById("reviewRating").value.trim();
  const comment = document.getElementById("reviewComment").value.trim();

  if (!restaurantId) return setTextReviewStatus("Restaurant ID required");
  if (!userName) return setTextReviewStatus("Name required");
  if (!rating) return setTextReviewStatus("Rating required");
  if (!comment) return setTextReviewStatus("Comment required");

  addReviewToStore(restaurantId, {
    id: uid(),
    userName,
    userID: "",
    rating,
    comment,
    fileName: "",
    previewUrl: "",
    createdAt: new Date().toISOString(),
  });

  textReviewForm.reset();
  setTextReviewStatus("Review added ✅");

  // show under that restaurant (if loaded)
  renderReviewsForRestaurant(restaurantId);
});

// UPLOAD review+image
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setUploadStatus("Uploading...");

  try {
    const review = await uploadReviewWithImage();

    // store locally so it appears under restaurant immediately
    addReviewToStore(review.restaurantId, {
      id: review.id,
      userName: review.userName,
      userID: review.userID,
      rating: review.rating,
      comment: review.comment,
      fileName: review.fileName,
      previewUrl: review.previewUrl,
      createdAt: review.createdAt,
    });

    renderReviewsForRestaurant(review.restaurantId);

    setUploadStatus("Upload successful ✅");
    uploadForm.reset();
  } catch (err) {
    console.error(err);
    setUploadStatus(`Upload failed: ${err.message}`);
    alert(err.message);
  }
});

// Delegated restaurant buttons + review edit buttons
gallery.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const card = e.target.closest(".item");
  if (!card) return;

  const restaurantId = card.dataset.restaurantId;
  const actions = card.querySelector(".actions");
  const editForm = card.querySelector(".edit-form");

  // ---- Restaurant CRUD ----
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

      // optional: remove stored reviews for it
      delete reviewsByRestaurantId[String(restaurantId)];
      saveReviews();

      // reload so it doesn't come back
      await loadRestaurantsUntilDeleted(restaurantId, 3);
      return;
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
    return;
  }

  // ---- Review CRUD (edit after created) ----
  const reviewBox = e.target.closest(".review-box");
  if (!reviewBox) return;

  const reviewId = reviewBox.dataset.reviewId;
  const view = reviewBox.querySelector(".review-view");
  const edit = reviewBox.querySelector(".review-edit");

  if (btn.classList.contains("review-edit-btn")) {
    view.style.display = "none";
    edit.style.display = "";
    return;
  }

  if (btn.classList.contains("review-cancel-btn")) {
    edit.style.display = "none";
    view.style.display = "";
    return;
  }

  if (btn.classList.contains("review-save-btn")) {
    const newUser = reviewBox.querySelector(".rev-edit-user").value.trim();
    const newRating = reviewBox.querySelector(".rev-edit-rating").value.trim();
    const newComment = reviewBox.querySelector(".rev-edit-comment").value.trim();

    updateReviewInStore(restaurantId, reviewId, {
      userName: newUser,
      rating: newRating,
      comment: newComment,
    });

    renderReviewsForRestaurant(restaurantId);
    return;
  }

  if (btn.classList.contains("review-delete-btn")) {
    if (!confirm("Delete this review?")) return;
    deleteReviewFromStore(restaurantId, reviewId);
    renderReviewsForRestaurant(restaurantId);
    return;
  }
});

// Initial load
loadRestaurants();
