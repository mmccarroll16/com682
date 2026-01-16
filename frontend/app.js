// app.js - Restaurants CRUD + Reviews (image upload)
// ✅ SAFE AppInsights tracking (won't break site if blocked)
// ✅ Works with BOTH layouts:
//    - Restaurants container: #restaurantsList OR #gallery
//    - Load button: #loadRestaurantsBtn OR #refreshBtn
//    - Status text: #status OR #loadStatus
//    - Upload status: #uploadStatus OR #status
//    - File input: #fileInput OR #file
// ✅ Includes optional "Create restaurant" form if present: #createRestaurantForm
// ✅ Delete persistence: if backend returns 200 but record still appears, we hide it locally

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

/* ---------------- SAFE App Insights helpers ---------------- */
function ai() {
  return window.appInsights || null;
}
function trackEvent(name, props = {}) {
  try {
    ai()?.trackEvent?.({ name }, { ...props, app: "LocalBitesMedia", host: location.host });
  } catch {}
}
function trackError(err, props = {}) {
  try {
    ai()?.trackException?.(
      { exception: err instanceof Error ? err : new Error(String(err)) },
      { ...props, app: "LocalBitesMedia", host: location.host }
    );
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

/* ---------------- Small polyfills ---------------- */
if (!window.CSS) window.CSS = {};
if (!CSS.escape) {
  CSS.escape = (s) => String(s).replace(/[^\w-]/g, (c) => "\\" + c);
}

/* ---------------- DOM: supports both layouts ---------------- */
const uploadForm = document.getElementById("uploadForm");
const createRestaurantForm = document.getElementById("createRestaurantForm"); // optional

const loadBtn =
  document.getElementById("loadRestaurantsBtn") || document.getElementById("refreshBtn");

const container =
  document.getElementById("restaurantsList") || document.getElementById("gallery");

const statusEl =
  document.getElementById("loadStatus") || document.getElementById("status");

const uploadStatusEl =
  document.getElementById("uploadStatus") || document.getElementById("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || "";
}
function setUploadStatus(msg) {
  if (uploadStatusEl) uploadStatusEl.textContent = msg || "";
}

/* ---------------- LocalStorage ---------------- */
const REVIEWS_KEY = "localbites_reviews_v4";
const DELETED_KEY = "localbites_deleted_restaurants_v1";

const safeStr = (v) => (v === null || v === undefined ? "" : String(v));

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ("r_" + Math.random().toString(16).slice(2) + "_" + Date.now());
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

function loadReviewsMap() {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY)) || {};
  } catch {
    return {};
  }
}
function saveReviewsMap(map) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(map));
}
function addReviewToStore(restaurantId, review) {
  const map = loadReviewsMap();
  const rid = String(restaurantId);
  if (!map[rid]) map[rid] = [];
  map[rid].push(review);
  saveReviewsMap(map);
}
function updateReviewInStore(restaurantId, reviewId, patch) {
  const map = loadReviewsMap();
  const rid = String(restaurantId);
  map[rid] = (map[rid] || []).map((r) =>
    r.id === reviewId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
  );
  saveReviewsMap(map);
}
function deleteReviewFromStore(restaurantId, reviewId) {
  const map = loadReviewsMap();
  const rid = String(restaurantId);
  map[rid] = (map[rid] || []).filter((r) => r.id !== reviewId);
  saveReviewsMap(map);
}
function getReviewsFor(restaurantId) {
  const map = loadReviewsMap();
  return map[String(restaurantId)] || [];
}

/* ---------------- Helpers ---------------- */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

/* ---------------- API ---------------- */
async function fetchAllRestaurants() {
  return timed("Restaurants.ReadAll", {}, async () => {
    const res = await fetch(API.RAA_READ_ALL, { method: "GET" });
    const { text, json } = await readTextOrJson(res);
    console.log("GET restaurants", res.status, text);
    if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);
    return Array.isArray(json) ? json : [];
  });
}

async function createRestaurant(payload) {
  return timed("Restaurants.Create", {}, async () => {
    const res = await fetch(API.CIA_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const { text } = await readTextOrJson(res);
    console.log("POST create", res.status, text);
    if (!res.ok) throw new Error(`Create failed: ${res.status} ${text}`);
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

    // ✅ supports both: <input id="fileInput"> or <input id="file">
    const fileEl = document.getElementById("fileInput") || document.getElementById("file");
    const file = fileEl?.files?.[0];

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

/* ---------------- Rendering ---------------- */
function renderRestaurants(restaurants) {
  if (!container) return;

  container.innerHTML = "";

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
      <div><b>restaurantID:</b> ${escapeHtml(restaurantId)}</div>
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

    container.appendChild(card);
    renderReviewsForRestaurant(restaurantId);
  });

  trackEvent("UI.RenderRestaurants", { count: String(restaurants.length) });
}

function renderReviewsForRestaurant(restaurantId) {
  if (!container) return;

  const rid = String(restaurantId);
  const card = container.querySelector(`.item[data-restaurant-id="${CSS.escape(rid)}"]`);
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

/* ---------------- Main load ---------------- */
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

/* ---------------- Events ---------------- */
if (loadBtn) {
  loadBtn.addEventListener("click", () => {
    trackEvent("UI.Click", { button: loadBtn.id || "load" });
    loadRestaurants();
  });
}

if (createRestaurantForm) {
  createRestaurantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    trackEvent("UI.Submit", { form: "createRestaurantForm" });

    const name = document.getElementById("newName")?.value?.trim() || "";
    const address = document.getElementById("newAddress")?.value?.trim() || "";
    const city = document.getElementById("newCity")?.value?.trim() || "";

    try {
      if (!name || !address || !city) throw new Error("Fill in name, address, and city");
      await createRestaurant({ RestaurantName: name, Address: address, City: city });
      createRestaurantForm.reset();
      await loadRestaurants();
    } catch (err) {
      console.error(err);
      alert(err.message);
      trackError(err, { where: "createRestaurant" });
    }
  });
}

if (uploadForm) {
  uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setUploadStatus("Uploading...");
    trackEvent("UI.Submit", { form: "uploadForm" });

    try {
      const review = await uploadReviewWithImage();

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

if (container) {
  container.addEventListener("click", async (e) => {
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
        trackEvent("UI.Click", { action: "edit_restaurant", restaurantId });
        return;
      }

      if (btn.classList.contains("cancel-btn")) {
        editForm.style.display = "none";
        actions.style.display = "";
        trackEvent("UI.Click", { action: "cancel_edit_restaurant", restaurantId });
        return;
      }

      if (btn.classList.contains("save-btn")) {
        const payload = {
          RestaurantName: card.querySelector(".edit-name")?.value || "",
          Address: card.querySelector(".edit-address")?.value || "",
          City: card.querySelector(".edit-city")?.value || "",
        };
        await updateRestaurant(restaurantId, payload);
        await loadRestaurants();
        trackEvent("UI.Click", { action: "save_restaurant", restaurantId });
        return;
      }

      if (btn.classList.contains("delete-btn")) {
        if (!confirm(`Delete restaurant ${restaurantId}?`)) return;

        await deleteRestaurant(restaurantId);

        // remove immediately
        card.remove();

        // persist "deleted" locally so it doesn't come back if backend is delayed/broken
        addDeletedId(restaurantId);

        // delete local reviews for this restaurant
        const map = loadReviewsMap();
        delete map[String(restaurantId)];
        saveReviewsMap(map);

        await loadRestaurants();
        trackEvent("UI.Click", { action: "delete_restaurant", restaurantId });
        return;
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
      trackError(err, { where: "restaurant_click" });
      return;
    }

    // ---- Review CRUD ----
    const reviewBox = e.target.closest(".review-box");
    if (!reviewBox) return;

    const reviewId = reviewBox.dataset.reviewId;
    const view = reviewBox.querySelector(".review-view");
    const edit = reviewBox.querySelector(".review-edit");

    if (btn.classList.contains("review-edit-btn")) {
      view.style.display = "none";
      edit.style.display = "";
      trackEvent("UI.Click", { action: "edit_review", restaurantId, reviewId });
      return;
    }

    if (btn.classList.contains("review-cancel-btn")) {
      edit.style.display = "none";
      view.style.display = "";
      trackEvent("UI.Click", { action: "cancel_edit_review", restaurantId, reviewId });
      return;
    }

    if (btn.classList.contains("review-save-btn")) {
      const newUser = reviewBox.querySelector(".rev-edit-user")?.value?.trim() || "";
      const newRating = reviewBox.querySelector(".rev-edit-rating")?.value?.trim() || "";
      const newComment = reviewBox.querySelector(".rev-edit-comment")?.value?.trim() || "";

      updateReviewInStore(restaurantId, reviewId, {
        userName: newUser,
        rating: newRating,
        comment: newComment,
      });

      renderReviewsForRestaurant(restaurantId);
      trackEvent("UI.Click", { action: "save_review", restaurantId, reviewId });
      return;
    }

    if (btn.classList.contains("review-delete-btn")) {
      if (!confirm("Delete this review?")) return;
      deleteReviewFromStore(restaurantId, reviewId);
      renderReviewsForRestaurant(restaurantId);
      trackEvent("UI.Click", { action: "delete_review", restaurantId, reviewId });
      return;
    }
  });
}

/* ---------------- Initial load ---------------- */
loadRestaurants().catch((e) => trackError(e, { where: "initial_load" }));
