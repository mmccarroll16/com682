// app.js - Restaurants CRUD + Reviews (image upload)
// ✅ Added: SAFE Azure Application Insights tracking (won't break site if blocked)
// ✅ Fix: file input id mismatch (#fileInput in HTML, not #file)
// ✅ Fix: null-safe DOM hooks (your HTML doesn't have createRestaurantForm/refreshBtn/gallery/loadStatus)
// ✅ Fix: uses #restaurantsList as the container (matches your index.html)
// ✅ Fix: delete persistence (if backend delete returns 200 but item still comes back, we hide it locally)

const API = {
  CIA_CREATE:
    "https://prod-02.italynorth.logic.azure.com/workflows/438f49f8253b4c6899482f6ac1bfa072/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=eqZYTEoJrYYYR7-JwgT12Kq9O-So9-KbilcscE3qL9E",

  RAA_READ_ALL:
    "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",

  UIA_UPDATE_TEMPLATE:
    "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",

  DIA_DELETE_TEMPLATE:
    "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",

  CIA_IMAGES_UPLOAD:
    "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8",
};

// ---------------- SAFE App Insights helpers ----------------
function ai() {
  // index.html creates window.appInsights (either real instance or stub)
  return window.appInsights || null;
}
function trackEvent(name, props = {}) {
  try {
    ai()?.trackEvent?.({ name }, { ...props, app: "LocalBitesMedia", host: location.host });
  } catch {}
}
function trackError(err, props = {}) {
  try {
    ai()?.trackException?.({ exception: err instanceof Error ? err : new Error(String(err)) }, props);
  } catch {}
}
async function timed(name, props, fn) {
  const start = performance.now();
  try {
    const out = await fn();
    trackEvent(name, { ...props, ok: true, ms: Math.round(performance.now() - start) });
    return out;
  } catch (e) {
    trackError(e, { ...props, ok: false, ms: Math.round(performance.now() - start), where: name });
    throw e;
  }
}
window.addEventListener("error", (e) => trackError(e.error || e.message, { type: "window.error" }));
window.addEventListener("unhandledrejection", (e) => trackError(e.reason, { type: "unhandledrejection" }));

// ---------------- DOM (matches your index.html) ----------------
const uploadForm = document.getElementById("uploadForm");
const loadBtn = document.getElementById("loadRestaurantsBtn");
const restaurantsList = document.getElementById("restaurantsList");
const statusEl = document.getElementById("status");
const uploadStatusEl = document.getElementById("uploadStatus");

// ---------------- LocalStorage ----------------
const REVIEWS_KEY = "localbites_reviews_v4";
const DELETED_KEY = "localbites_deleted_restaurants_v1";

const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ("r_" + Math.random().toString(16).slice(2) + "_" + Date.now());
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

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}
function setUploadStatus(msg) {
  if (uploadStatusEl) uploadStatusEl.textContent = msg || "";
}

function getDeletedIds() {
  try {
    return new Set((JSON.parse(localStorage.getItem(DELETED_KEY)) || []).map(String));
  } catch {
    return new Set();
  }
}
function addDeletedId(id) {
  const s = getDeletedIds();
  s.add(String(id));
  localStorage.setItem(DELETED_KEY, JSON.stringify([...s]));
}
function isDeleted(id) {
  return getDeletedIds().has(String(id));
}

function loadReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveReviews(map) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(map));
}
function addReviewToStore(restaurantId, review) {
  const map = loadReviews();
  const rid = String(restaurantId);
  if (!map[rid]) map[rid] = [];
  map[rid].push(review);
  saveReviews(map);
}
function updateReviewInStore(restaurantId, reviewId, patch) {
  const map = loadReviews();
  const rid = String(restaurantId);
  map[rid] = (map[rid] || []).map((r) => (r.id === reviewId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
  saveReviews(map);
}
function deleteReviewFromStore(restaurantId, reviewId) {
  const map = loadReviews();
  const rid = String(restaurantId);
  map[rid] = (map[rid] || []).filter((r) => r.id !== reviewId);
  saveReviews(map);
}
function getReviewsFor(restaurantId) {
  const map = loadReviews();
  return map[String(restaurantId)] || [];
}

// ---------------- API ----------------
async function fetchAllRestaurants() {
  return timed("Restaurants.ReadAll", {}, async () => {
    const res = await fetch(API.RAA_READ_ALL, { method: "GET" });
    const { text, json } = await readTextOrJson(res);
    console.log("GET restaurants", res.status, text);
    if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);
    return Array.isArray(json) ? json : [];
  });
}

async function updateRestaurant(id, payload) {
  return timed("Restaurants.Update", { restaurantId: String(id) }, async () => {
    const url = buildUrl(API.UIA_UPDATE_TEMPLATE, id);
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const { text } = await readTextOrJson(res);
    console.log("PUT update", res.status, text);
    if (!res.ok) throw new Error(`Update failed: ${res.status} ${text}`);
  });
}

async function deleteRestaurant(id) {
  return timed("Restaurants.Delete", { restaurantId: String(id) }, async () => {
    const url = buildUrl(API.DIA_DELETE_TEMPLATE, id);

    // ✅ no body on DELETE
    const res = await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
    const { text } = await readTextOrJson(res);
    console.log("DELETE", url, res.status, text);

    if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
  });
}

async function uploadReviewWithImage() {
  return timed("Reviews.UploadImage", {}, async () => {
    const restaurantId = document.getElementById("restaurantId")?.value?.trim() || "";
    const userID = document.getElementById("userID")?.value?.trim() || "";
    const userName = document.getElementById("userName")?.value?.trim() || "";
    const rating = document.getElementById("rating")?.value?.trim() || "";
    const comment = document.getElementById("comment")?.value?.trim() || "";
    const file = document.getElementById("fileInput")?.files?.[0];

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
    const { text } = await readTextOrJson(res);
    console.log("POST upload", res.status, text);
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);

    trackEvent("Reviews.UploadImage.Meta", { restaurantId, fileName: file.name, rating });

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
    };
  });
}

// ---------------- Rendering ----------------
function renderRestaurants(restaurants) {
  if (!restaurantsList) return;
  restaurantsList.innerHTML = "";

  const deleted = getDeletedIds();
  const seen = new Set();

  restaurants.forEach((r) => {
    const restaurantId = safeStr(r.restaurantID ?? r.restaurantId ?? r.RestaurantID ?? r.id);
    if (!restaurantId) return;
    if (deleted.has(String(restaurantId))) return;
    if (seen.has(String(restaurantId))) return;
    seen.add(String(restaurantId));

    const name = safeStr(r.RestaurantName ?? r.restaurantName);
    const address = safeStr(r.Address ?? r.address);
    const city = safeStr(r.City ?? r.city);

    const card = document.createElement("div");
    card.className = "item";
    card.dataset.restaurantId = restaurantId;

    card.innerHTML = `
      <div><b>restaurantID:</b> ${restaurantId}</div>
      <div><b>RestaurantName:</b> <span class="view-name">${escapeHtml(name)}</span></div>
      <div><b>Address:</b> <span class="view-address">${escapeHtml(address)}</span></div>
      <div><b>City:</b> <span class="view-city">${escapeHtml(city)}</span></div>

      <div class="actions" style="margin-top:10px;">
        <button type="button" class="edit-btn">Edit</button>
        <button type="button" class="delete-btn">Delete</button>
      </div>

      <div class="edit-form" style="display:none; margin-top:10px;">
        <label>Name <input class="edit-name" type="text" value="${escapeHtml(name)}"></label><br/>
        <label>Address <input class="edit-address" type="text" value="${escapeHtml(address)}"></label><br/>
        <label>City <input class="edit-city" type="text" value="${escapeHtml(city)}"></label><br/>
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

    restaurantsList.appendChild(card);
    renderReviewsForRestaurant(restaurantId);
  });

  trackEvent("UI.RenderRestaurants", { count: String(restaurants.length) });
}

function renderReviewsForRestaurant(restaurantId) {
  const rid = String(restaurantId);
  const card = restaurantsList.querySelector(`.item[data-restaurant-id="${CSS.escape(rid)}"]`);
  if (!card) return;

  const listEl = card.querySelector(".review-list");
  const countEl = card.querySelector(".review-count");

  const reviews = getReviewsFor(rid);
  countEl.textContent = reviews.length ? `${reviews.length} review(s)` : "No reviews yet";
  listEl.innerHTML = "";

  reviews
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .forEach((rev) => {
      const box = document.createElement("div");
      box.className = "review-box";
      box.dataset.reviewId = rev.id;

      const created = safeStr(rev.createdAt);
      const updated = rev.updatedAt ? ` (edited ${safeStr(rev.updatedAt)})` : "";

      box.style.border = "1px solid #eee";
      box.style.borderRadius = "10px";
      box.style.padding = "10px";
      box.style.marginTop = "8px";

      box.innerHTML = `
        <div class="review-view">
          <div><b>User:</b> ${escapeHtml(safeStr(rev.userName))} ${rev.userID ? `(${escapeHtml(safeStr(rev.userID))})` : ""}</div>
          <div><b>Rating:</b> ${escapeHtml(safeStr(rev.rating))}</div>
          <div><b>Comment:</b> ${escapeHtml(safeStr(rev.comment))}</div>
          ${rev.fileName ? `<div><b>File:</b> ${escapeHtml(safeStr(rev.fileName))}</div>` : ""}
          ${rev.previewUrl ? `<img src="${rev.previewUrl}" style="margin-top:8px; max-width:100%; border-radius:10px;" />` : ""}
          <div class="small" style="opacity:.7; margin-top:6px;">${escapeHtml(created)}${escapeHtml(updated)}</div>

          <div style="margin-top:8px;">
            <button type="button" class="review-edit-btn">Edit review</button>
            <button type="button" class="review-delete-btn">Delete review</button>
          </div>
        </div>

        <div class="review-edit" style="display:none; margin-top:8px;">
          <label>Your name <input class="rev-edit-user" value="${escapeHtml(safeStr(rev.userName))}" /></label><br/>
          <label>Rating 1-5 <input class="rev-edit-rating" type="number" min="1" max="5" value="${escapeHtml(safeStr(rev.rating))}" /></label><br/>
          <label>Comment <input class="rev-edit-comment" value="${escapeHtml(safeStr(rev.comment))}" /></label><br/>
          <button type="button" class="review-save-btn">Save</button>
          <button type="button" class="review-cancel-btn">Cancel</button>
        </div>
      `;

      listEl.appendChild(box);
    });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------- Main load ----------------
async function loadRestaurants() {
  try {
    setStatus("Loading restaurants...");
    const restaurants = await fetchAllRestaurants();
    renderRestaurants(restaurants);
    setStatus(`Loaded ${restaurants.length} restaurants ✅`);
  } catch (err) {
    console.error(err);
    setStatus(`Load failed: ${err.message}`);
    alert(err.message);
  }
}

// ---------------- Events ----------------
if (loadBtn) {
  loadBtn.addEventListener("click", () => {
    trackEvent("UI.Click", { button: "loadRestaurantsBtn" });
    loadRestaurants();
  });
}

if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setUploadStatus("Uploading...");
    trackEvent("UI.Submit", { form: "uploadForm" });

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
}

if (restaurantsList) {
  restaurantsList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const card = e.target.closest(".item");
    if (!card) return;

    const restaurantId = card.dataset.restaurantId;
    const actions = card.querySelector(".actions");
    const editForm = card.querySelector(".edit-form");

    try {
      if (btn.classList.contains("edit-btn")) {
        trackEvent("UI.Click", { action: "edit_restaurant", restaurantId });
        editForm.style.display = "";
        actions.style.display = "none";
        return;
      }

      if (btn.classList.contains("cancel-btn")) {
        trackEvent("UI.Click", { action: "cancel_edit_restaurant", restaurantId });
        editForm.style.display = "none";
        actions.style.display = "";
        return;
      }

      if (btn.classList.contains("save-btn")) {
        trackEvent("UI.Click", { action: "save_restaurant", restaurantId });
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
        trackEvent("UI.Click", { action: "delete_restaurant", restaurantId });
        if (!confirm(`Delete restaurant ${restaurantId}?`)) return;

        await deleteRestaurant(restaurantId);

        // ✅ remove from UI immediately
        card.remove();

        // ✅ persist "deleted" locally so it doesn't come back even if backend delete is delayed/broken
        addDeletedId(restaurantId);

        // optional: remove stored reviews for it
        const map = loadReviews();
        delete map[String(restaurantId)];
        saveReviews(map);

        // reload view
        await loadRestaurants();
        return;
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
      return;
    }

    // ---- Review CRUD ----
    const reviewBox = e.target.closest(".review-box");
    if (!reviewBox) return;

    const reviewId = reviewBox.dataset.reviewId;
    const view = reviewBox.querySelector(".review-view");
    const edit = reviewBox.querySelector(".review-edit");

    if (btn.classList.contains("review-edit-btn")) {
      trackEvent("UI.Click", { action: "edit_review", restaurantId, reviewId });
      view.style.display = "none";
      edit.style.display = "";
      return;
    }

    if (btn.classList.contains("review-cancel-btn")) {
      trackEvent("UI.Click", { action: "cancel_edit_review", restaurantId, reviewId });
      edit.style.display = "none";
      view.style.display = "";
      return;
    }

    if (btn.classList.contains("review-save-btn")) {
      trackEvent("UI.Click", { action: "save_review", restaurantId, reviewId });
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
      trackEvent("UI.Click", { action: "delete_review", restaurantId, reviewId });
      if (!confirm("Delete this review?")) return;
      deleteReviewFromStore(restaurantId, reviewId);
      renderReviewsForRestaurant(restaurantId);
      return;
    }
  });
}

// Initial load
loadRestaurants().catch((e) => trackError(e, { where: "initial_load" }));
