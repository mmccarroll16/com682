// app.js - vanilla JS, static frontend for LocalBites Media
const API = {
  READ_ALL: "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs",
  UPDATE: "https://prod-09.italynorth.logic.azure.com/workflows/33da03811d18412db6e949fd7859b51b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=aQ5q3EGKjL4wdj_SHE4KVEQl98wPXpOJGP1DwjF8D0c",
  DELETE: "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM",
  UPLOAD: "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8"
};

const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");
const restaurantsList = $("#restaurantsList");
const loadBtn = $("#loadRestaurantsBtn");
const reviewForm = $("#reviewForm");
const uploadStatus = $("#uploadStatus");

const LS_REVIEWS_KEY = "localbites_reviews";
const LS_DELETED_KEY = "deletedRestaurantIds";

const safe = (v) => (v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const decodeMaybeBase64Obj = (v) => (v && typeof v === "object" && "$content" in v ? atob(v.$content || "") : v);
const pickId = (obj) => safe(obj.restaurantID ?? obj.RestaurantID ?? obj.restaurantId ?? obj.restaurantID ?? obj.id ?? obj.Id);

function getDeletedIds() {
  try {
    return JSON.parse(localStorage.getItem(LS_DELETED_KEY)) || [];
  } catch {
    return [];
  }
}
function setDeletedIds(arr) {
  localStorage.setItem(LS_DELETED_KEY, JSON.stringify(arr));
}

function getReviewsMap() {
  try {
    return JSON.parse(localStorage.getItem(LS_REVIEWS_KEY)) || {};
  } catch {
    return {};
  }
}
function setReviewsMap(map) {
  localStorage.setItem(LS_REVIEWS_KEY, JSON.stringify(map));
}

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
  console.log("GET response", res.status, text);
  if (!res.ok) throw new Error(`GET failed: ${res.status} ${text}`);
  const docs = Array.isArray(data) ? data : data.Documents ?? data.documents ?? [];
  return docs;
}

function renderRestaurants(items) {
  restaurantsList.innerHTML = "";
  const deleted = new Set(getDeletedIds());
  const seen = new Set();
  items.forEach((item) => {
    const id = pickId(item);
    if (!id || deleted.has(id) || seen.has(id)) return;
    seen.add(id);
    restaurantsList.appendChild(createRestaurantCard(item));
  });
}

function createRestaurantCard(item) {
  const card = document.createElement("div");
  card.className = "card item";
  const id = pickId(item);
  const name = safe(decodeMaybeBase64Obj(item.RestaurantName ?? item.restaurantName));
  const address = safe(decodeMaybeBase64Obj(item.Address ?? item.address));
  const city = safe(decodeMaybeBase64Obj(item.City ?? item.city));
  card.dataset.restaurantId = id;

  card.innerHTML = `
    <div><b>restaurantID:</b> ${safe(item.restaurantID ?? item.RestaurantID)}</div>
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
      <div class="edit-actions">
        <button type="button" class="save-btn">Save</button>
        <button type="button" class="cancel-btn">Cancel</button>
      </div>
    </div>
    <div class="reviews">
      <h4>Reviews</h4>
      <form class="add-review-form">
        <label>Name <input name="userName" required></label>
        <label>Rating (1-5) <input name="rating" type="number" min="1" max="5" required></label>
        <label>Comment <input name="comment" required></label>
        <label>Photo <input name="file" type="file" accept="image/*"></label>
        <button type="submit">Add review</button>
      </form>
      <div class="review-list"></div>
    </div>
  `;

  wireRestaurantActions(card, item);
  renderReviews(id, card.querySelector(".review-list"));
  return card;
}

function wireRestaurantActions(card, item) {
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
      const deleted = getDeletedIds();
      deleted.push(id);
      setDeletedIds(deleted);
      card.remove();
    } catch (err) {
      alert(err.message);
    }
  });

  // Add review form
  const reviewForm = card.querySelector(".add-review-form");
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(reviewForm);
    const userName = formData.get("userName");
    const rating = formData.get("rating");
    const comment = formData.get("comment");
    const file = formData.get("file");
    const hasFile = file && file instanceof File && file.name;
    const timestamp = new Date().toISOString();

    // build review object to persist locally
    const review = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      userName,
      rating,
      comment,
      timestamp
    };

    if (hasFile) {
      const uploadFd = new FormData();
      uploadFd.set("restaurantId", id);
      uploadFd.set("userID", "1");
      uploadFd.set("userName", userName);
      uploadFd.set("rating", rating);
      uploadFd.set("comment", comment);
      uploadFd.set("Filename", file.name);
      uploadFd.set("file", file);
      try {
        const res = await fetch(API.UPLOAD, { method: "POST", body: uploadFd });
        const text = await res.text();
        console.log("UPLOAD response", res.status, text);
        if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);
        const json = JSON.parse(text);
        review.mediaUrl = json.media?.url || "";
      } catch (err) {
        alert(err.message);
        return;
      }
    }

    // Persist locally
    addLocalReview(id, review);
    renderReviews(id, card.querySelector(".review-list"));
    reviewForm.reset();
  });
}

function renderReviews(restaurantId, container) {
  container.innerHTML = "";
  const reviews = loadReviews(restaurantId);
  reviews.forEach((rev) => {
    const div = document.createElement("div");
    div.className = "review-item";
    div.dataset.reviewId = rev.id;
    div.innerHTML = `
      <div><b>Name:</b> ${safe(rev.userName)}</div>
      <div><b>Rating:</b> ${safe(rev.rating)}</div>
      <div><b>Comment:</b> ${safe(rev.comment)}</div>
      <div><b>Timestamp:</b> ${safe(rev.timestamp)}</div>
      ${rev.mediaUrl ? `<img src="${rev.mediaUrl}" alt="review image">` : ""}
      <div class="review-actions">
        <button type="button" class="edit-review-btn">Edit</button>
        <button type="button" class="delete-review-btn">Delete</button>
      </div>
      <div class="edit-review-form" style="display:none;">
        <label>Name <input name="userName" value="${safe(rev.userName)}"></label>
        <label>Rating <input name="rating" type="number" min="1" max="5" value="${safe(rev.rating)}"></label>
        <label>Comment <input name="comment" value="${safe(rev.comment)}"></label>
        <button type="button" class="save-review-btn">Save</button>
        <button type="button" class="cancel-review-btn">Cancel</button>
      </div>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(".edit-review-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const parent = btn.closest(".review-item");
      parent.querySelector(".edit-review-form").style.display = "";
      parent.querySelector(".review-actions").style.display = "none";
    })
  );
  container.querySelectorAll(".cancel-review-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const parent = btn.closest(".review-item");
      parent.querySelector(".edit-review-form").style.display = "none";
      parent.querySelector(".review-actions").style.display = "";
    })
  );
  container.querySelectorAll(".save-review-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const parent = btn.closest(".review-item");
      const restaurantId = parent.closest(".card").dataset.restaurantId;
      const reviewId = parent.dataset.reviewId;
      const form = parent.querySelector(".edit-review-form");
      const updated = {
        userName: form.querySelector('input[name="userName"]').value,
        rating: form.querySelector('input[name="rating"]').value,
        comment: form.querySelector('input[name="comment"]').value,
        timestamp: new Date().toISOString()
      };
      editLocalReview(restaurantId, reviewId, updated);
      renderReviews(restaurantId, container);
    })
  );
  container.querySelectorAll(".delete-review-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const parent = btn.closest(".review-item");
      const restaurantId = parent.closest(".card").dataset.restaurantId;
      const reviewId = parent.dataset.reviewId;
      deleteLocalReview(restaurantId, reviewId);
      renderReviews(restaurantId, container);
    })
  );
}

// --- LocalStorage reviews helpers ---
function loadReviews(restaurantId) {
  const map = getReviewsMap();
  return map[restaurantId] || [];
}
function saveReviews(restaurantId, reviews) {
  const map = getReviewsMap();
  map[restaurantId] = reviews;
  setReviewsMap(map);
}
function addLocalReview(restaurantId, review) {
  const reviews = loadReviews(restaurantId);
  reviews.push(review);
  saveReviews(restaurantId, reviews);
}
function editLocalReview(restaurantId, reviewId, updated) {
  const reviews = loadReviews(restaurantId).map((r) =>
    r.id === reviewId ? { ...r, ...updated } : r
  );
  saveReviews(restaurantId, reviews);
}
function deleteLocalReview(restaurantId, reviewId) {
  const reviews = loadReviews(restaurantId).filter((r) => r.id !== reviewId);
  saveReviews(restaurantId, reviews);
}

// --- Restaurant CRUD helpers ---
async function updateRestaurant(id, payload) {
  const url = API.UPDATE.replace("{id}", encodeURIComponent(id));
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
  const url = API.DELETE.replace("{id}", encodeURIComponent(id));
  console.log("DELETE", { url, id });
  const res = await fetch(url, { method: "DELETE" });
  const text = await res.text();
  console.log("DELETE response", res.status, text);
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${text}`);
  return text;
}

// --- Upload review form handler ---
reviewForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadStatus.textContent = "Uploading...";
  try {
    const fd = new FormData(reviewForm);
    const fileInput = reviewForm.querySelector("#fileInput");
    if (fileInput.files.length) {
      const file = fileInput.files[0];
      if (!fd.get("Filename")) fd.set("Filename", file.name);
      fd.set("file", file);
    }
    console.log("POST upload", API.UPLOAD);
    const res = await fetch(API.UPLOAD, { method: "POST", body: fd });
    const text = await res.text();
    console.log("POST response", res.status, text);
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${text}`);
    uploadStatus.textContent = "Upload successful.";
    reviewForm.reset();
    await loadAndRender(); // refresh list
  } catch (err) {
    uploadStatus.textContent = `Upload failed: ${err.message}`;
    alert(err.message);
  }
});

// --- Load and render ---
async function loadAndRender() {
  statusEl.textContent = "Loading...";
  try {
    const items = await fetchRestaurants();
    renderRestaurants(items);
    statusEl.textContent = "Loaded.";
  } catch (err) {
    statusEl.textContent = "Error loading.";
    alert(err.message);
  }
}

loadBtn.addEventListener("click", loadAndRender);
window.addEventListener("DOMContentLoaded", loadAndRender);
