// app.js - vanilla JS, static frontend for LocalBites Media
// Fixes:
// - Removes duplicates (by restaurantID)
// - DELETE 400 fix: correct path is /rest/v1/assets/{id} (NOT assests)
// - After delete, restaurant stays deleted even after reload (localStorage tombstone)
// - Reviews: add/edit/delete locally + show under restaurant + can also upload review+image from top form

const API = {
  READ_ALL:
    "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",

  UPDATE:
    "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",

  // ✅ FIX: assets (not assests) + {id} placeholder (not %7Bid%7D)
  DELETE:
    "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",

  UPLOAD:
    "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8"
};

const $ = (sel) => document.querySelector(sel);

const statusEl = $("#status");
const restaurantsList = $("#restaurantsList");
const loadBtn = $("#loadRestaurantsBtn");
const topReviewForm = $("#reviewForm");
const uploadStatus = $("#uploadStatus");

const LS_REVIEWS_KEY = "localbites_reviews_v1";
const LS_DELETED_KEY = "localbites_deleted_restaurants_v1";

const safe = (v) =>
  v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);

const decodeMaybeBase64Obj = (v) => {
  if (v && typeof v === "object" && "$content" in v) {
    try {
      return atob(v.$content || "");
    } catch {
      return v.$content || "";
    }
  }
  return v;
};

function pickRestaurantId(obj) {
  // Your READ_ALL response uses restaurantID (lowercase r + capital ID)
  return safe(
    obj.restaurantID ??
      obj.RestaurantID ??
      obj.restaurantId ??
      obj.RestaurantId ??
      obj.id ??
      obj.Id ??
      obj.pk
  );
}

/* -------------------- localStorage helpers -------------------- */

function getDeletedIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_DELETED_KEY));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function addDeletedId(id) {
  const current = new Set(getDeletedIds());
  current.add(String(id));
  localStorage.setItem(LS_DELETED_KEY, JSON.stringify([...current]));
}

function getReviewsMap() {
  try {
    const map = JSON.parse(localStorage.getItem(LS_REVIEWS_KEY));
    return map && typeof map === "object" ? map : {};
  } catch {
    return {};
  }
}
function setReviewsMap(map) {
  localStorage.setItem(LS_REVIEWS_KEY, JSON.stringify(map));
}

function loadReviews(restaurantId) {
  const map = getReviewsMap();
  return Array.isArray(map[String(restaurantId)]) ? map[String(restaurantId)] : [];
}
function saveReviews(restaurantId, reviews) {
  const map = getReviewsMap();
  map[String(restaurantId)] = reviews;
  setReviewsMap(map);
}
function addLocalReview(restaurantId, review) {
  const reviews = loadReviews(restaurantId);
  reviews.push(review);
  saveReviews(restaurantId, reviews);
}
function editLocalReview(restaurantId, reviewId, patch) {
  const reviews = loadReviews(restaurantId).map((r) => (r.id === reviewId ? { ...r, ...patch } : r));
  saveReviews(restaurantId, reviews);
}
function deleteLocalReview(restaurantId, reviewId) {
  const reviews = loadReviews(restaurantId).filter((r) => r.id !== reviewId);
  saveReviews(restaurantId, reviews);
}

/* -------------------- API calls -------------------- */

async function fetchRestaurants() {
  console.log("GET", API.READ_ALL);
  const res = await fetch(API.READ_ALL, { method: "GET" });
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = [];
  }

  console.log("GET response", res.status, data);
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);

  const docs = Array.isArray(data) ? data : data.Documents ?? data.documents ?? [];
  return Array.isArray(docs) ? docs : [];
}

async function updateRestaurant(id, payload) {
  const url = API.UPDATE.replace("{id}", encodeURIComponent(id));
  console.log("PUT", url, payload);

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
  // IMPORTANT: no body with DELETE
  const url = API.DELETE.replace("{id}", encodeURIComponent(id));
  console.log("DELETE", url);

  const res = await fetch(url, { method: "DELETE" });
  const text = await res.text();
  console.log("DELETE response", res.status, text);

  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
  return text;
}

async function uploadReviewImage(formData) {
  // formData should include: Filename, userID, userName, restaurantId, rating, comment, file
  console.log("POST upload", API.UPLOAD);
  const res = await fetch(API.UPLOAD, { method: "POST", body: formData });
  const text = await res.text();
  console.log("UPLOAD response", res.status, text);

  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);

  // Logic app returns JSON (from your Postman screenshot)
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return { raw: text, json };
}

/* -------------------- Rendering -------------------- */

function renderRestaurants(items) {
  restaurantsList.innerHTML = "";

  const deleted = new Set(getDeletedIds().map(String));
  const seen = new Set();

  items.forEach((item) => {
    const id = pickRestaurantId(item);
    if (!id) return;
    if (deleted.has(String(id))) return;
    if (seen.has(String(id))) return;
    seen.add(String(id));

    restaurantsList.appendChild(createRestaurantCard(item));
  });
}

function createRestaurantCard(item) {
  const card = document.createElement("div");
  card.className = "card item";

  const id = pickRestaurantId(item);
  const name = safe(decodeMaybeBase64Obj(item.RestaurantName ?? item.restaurantName));
  const address = safe(decodeMaybeBase64Obj(item.Address ?? item.address));
  const city = safe(decodeMaybeBase64Obj(item.City ?? item.city));

  card.dataset.restaurantId = String(id);

  card.innerHTML = `
    <div><b>restaurantID:</b> ${safe(item.restaurantID ?? item.RestaurantID ?? id)}</div>
    <div><b>RestaurantName:</b> ${name}</div>
    <div><b>Address:</b> ${address}</div>
    <div><b>City:</b> ${city}</div>

    <div class="actions">
      <button type="button" class="edit-btn">Edit</button>
      <button type="button" class="delete-btn">Delete</button>
    </div>

    <div class="edit-form" style="display:none;">
      <label>Name <input type="text" name="RestaurantName" value="${escapeAttr(name)}"></label>
      <label>Address <input type="text" name="Address" value="${escapeAttr(address)}"></label>
      <label>City <input type="text" name="City" value="${escapeAttr(city)}"></label>
      <div class="edit-actions">
        <button type="button" class="save-btn">Save</button>
        <button type="button" class="cancel-btn">Cancel</button>
      </div>
    </div>

    <div class="reviews">
      <h4>Reviews <span class="review-count"></span></h4>

      <div class="review-list"></div>
    </div>
  `;

  wireRestaurantActions(card);
  renderReviewsForCard(card);
  return card;
}

function wireRestaurantActions(card) {
  const id = card.dataset.restaurantId;

  const actions = card.querySelector(".actions");
  const editForm = card.querySelector(".edit-form");

  card.querySelector(".edit-btn").addEventListener("click", () => {
    editForm.style.display = "";
    actions.style.display = "none";
  });

  card.querySelector(".cancel-btn").addEventListener("click", () => {
    editForm.style.display = "none";
    actions.style.display = "";
  });

  card.querySelector(".save-btn").addEventListener("click", async () => {
    const payload = {
      RestaurantName: editForm.querySelector('input[name="RestaurantName"]').value,
      Address: editForm.querySelector('input[name="Address"]').value,
      City: editForm.querySelector('input[name="City"]').value
    };

    try {
      await updateRestaurant(id, payload);
      await loadAndRender();
    } catch (err) {
      alert(err.message);
    }
  });

  card.querySelector(".delete-btn").addEventListener("click", async () => {
    if (!confirm("Delete this restaurant?")) return;

    try {
      await deleteRestaurant(id);

      // ✅ Persist tombstone so it stays gone after reload
      addDeletedId(id);

      // Remove immediately from UI
      card.remove();
    } catch (err) {
      alert(err.message);
    }
  });
}

function renderReviewsForCard(card) {
  const restaurantId = card.dataset.restaurantId;
  const list = card.querySelector(".review-list");
  const count = card.querySelector(".review-count");

  const reviews = loadReviews(restaurantId);
  count.textContent = `(${reviews.length})`;

  list.innerHTML = "";
  reviews.forEach((rev) => list.appendChild(createReviewItem(card, rev)));
}

function createReviewItem(card, rev) {
  const item = document.createElement("div");
  item.className = "review-item";
  item.dataset.reviewId = rev.id;

  item.innerHTML = `
    <div><b>Name:</b> ${escapeHtml(safe(rev.userName))}</div>
    <div><b>Rating:</b> ${escapeHtml(safe(rev.rating))}</div>
    <div><b>Comment:</b> ${escapeHtml(safe(rev.comment))}</div>
    <div class="small"><b>Timestamp:</b> ${escapeHtml(safe(rev.timestamp))}</div>
    ${rev.mediaUrl ? `<img src="${escapeAttr(rev.mediaUrl)}" alt="review image" style="max-width:100%;height:auto;margin-top:8px;border-radius:6px;">` : ""}
    <div class="review-actions" style="margin-top:8px;">
      <button type="button" class="edit-review-btn">Edit</button>
      <button type="button" class="delete-review-btn">Delete</button>
    </div>
    <div class="edit-review-form" style="display:none;margin-top:8px;">
      <label>Name <input name="userName" value="${escapeAttr(safe(rev.userName))}"></label>
      <label>Rating <input name="rating" type="number" min="1" max="5" value="${escapeAttr(safe(rev.rating))}"></label>
      <label>Comment <input name="comment" value="${escapeAttr(safe(rev.comment))}"></label>
      <button type="button" class="save-review-btn">Save</button>
      <button type="button" class="cancel-review-btn">Cancel</button>
    </div>
  `;

  const restaurantId = card.dataset.restaurantId;

  item.querySelector(".edit-review-btn").addEventListener("click", () => {
    item.querySelector(".edit-review-form").style.display = "";
    item.querySelector(".review-actions").style.display = "none";
  });

  item.querySelector(".cancel-review-btn").addEventListener("click", () => {
    item.querySelector(".edit-review-form").style.display = "none";
    item.querySelector(".review-actions").style.display = "";
  });

  item.querySelector(".save-review-btn").addEventListener("click", () => {
    const form = item.querySelector(".edit-review-form");
    const patch = {
      userName: form.querySelector('input[name="userName"]').value,
      rating: form.querySelector('input[name="rating"]').value,
      comment: form.querySelector('input[name="comment"]').value,
      timestamp: new Date().toISOString()
    };

    editLocalReview(restaurantId, rev.id, patch);
    renderReviewsForCard(card);
  });

  item.querySelector(".delete-review-btn").addEventListener("click", () => {
    deleteLocalReview(restaurantId, rev.id);
    renderReviewsForCard(card);
  });

  return item;
}

/* -------------------- Top upload form (review + image) -------------------- */

if (topReviewForm) {
  topReviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (uploadStatus) uploadStatus.textContent = "Uploading...";

    try {
      // Your HTML uses these ids:
      // restaurantId, userID, userName, rating, comment, file
      const restaurantId = $("#restaurantId")?.value?.trim();
      const userID = $("#userID")?.value?.trim();
      const userName = $("#userName")?.value?.trim();
      const rating = $("#rating")?.value?.trim();
      const comment = $("#comment")?.value?.trim();
      const fileInput = $("#file");

      if (!restaurantId) throw new Error("restaurantId is required");
      if (!userID) throw new Error("userID is required");
      if (!userName) throw new Error("userName is required");
      if (!rating) throw new Error("rating is required");
      if (!comment) throw new Error("comment is required");
      if (!fileInput || !fileInput.files || !fileInput.files.length) throw new Error("image file is required");

      const file = fileInput.files[0];

      const fd = new FormData();
      // Match your Postman keys
      fd.set("Filename", file.name);
      fd.set("userID", userID);
      fd.set("userName", userName);
      fd.set("file", file);
      fd.set("restaurantId", restaurantId);
      fd.set("rating", rating);
      fd.set("comment", comment);

      const { json } = await uploadReviewImage(fd);

      // ✅ Save review locally so it appears under the restaurant
      const review = {
        id: (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now()),
        userName,
        rating,
        comment,
        timestamp: new Date().toISOString(),
        mediaUrl: json?.media?.url || ""
      };
      addLocalReview(String(restaurantId), review);

      if (uploadStatus) uploadStatus.textContent = "Upload successful.";
      topReviewForm.reset();

      // refresh list so you see it on the right restaurant card
      await loadAndRender();
    } catch (err) {
      if (uploadStatus) uploadStatus.textContent = `Upload failed: ${err.message}`;
      alert(err.message);
    }
  });
}

/* -------------------- Load / Refresh -------------------- */

async function loadAndRender() {
  if (statusEl) statusEl.textContent = "Loading...";
  try {
    const items = await fetchRestaurants();
    renderRestaurants(items);

    // After restaurants render, attach reviews
    // (cards already call renderReviewsForCard, so no extra loop needed)

    if (statusEl) statusEl.textContent = `Loaded ${restaurantsList?.children?.length || 0} restaurants ✅`;
  } catch (err) {
    if (statusEl) statusEl.textContent = "Error loading.";
    alert(err.message);
  }
}

if (loadBtn) loadBtn.addEventListener("click", loadAndRender);
window.addEventListener("DOMContentLoaded", loadAndRender);

/* -------------------- tiny safety helpers -------------------- */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ").replaceAll("\r", " ");
}
