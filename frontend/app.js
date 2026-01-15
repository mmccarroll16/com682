// 7) Put your Logic App URLs here
const RAI_URL = "https://prod-00.italynorth.logic.azure.com/workflows/d0af0d70328d47a8ad27f7c25e035de9/triggers/When_an_HTTP_request_is_received/paths/invoke/rests/assets/%7Bid%7D?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=xrq9bm3gWPRFCBQJ0ete6qnfTf9KK5PySeme7YzwprE";
const IUPS_URL = "https://prod-12.italynorth.logic.azure.com:443/workflows/2200a2abcb2d4b72916e5903b8009c15/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ogcc4lng3zhf4SOs6dVE15c9o3fXcPkjNC6q0MZrFR8";
const RAA_URL = "https://prod-03.italynorth.logic.azure.com/workflows/60d0ac063b2b4b719b11d3682a9a9a0c/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assets?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=kkJoDMv_3TUZ3YRMdFMxZ-i0FZTsxcRt3GvbPAoDNEs"
const DELETE_URL = "https://prod-06.italynorth.logic.azure.com/workflows/66f84f42ed204cad8460e53e61c91a2b/triggers/When_an_HTTP_request_is_received/paths/invoke/rest/v1/assests/{id}?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=6kY1LTq8-39mk8ePr1LddlF6qcnv1gxarAVYet0GNRM"

// If you stored full media.url in Cosmos, set this true
const USE_MEDIA_URL = true;

// Helpers
const $ = (id) => document.getElementById(id);

async function fetchAllImages() {
  const res = await fetch(RAA_URL);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.Documents ?? data.documents ?? []);
}

async function deleteImage(id) {
  const url = DELETE_URL.replace("{id}", id);
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

async function fetchImages() {
  $("gallery").innerHTML = "Loading...";
  try {
    const docs = await fetchAllImages();

  $("gallery").innerHTML = "";
  if (!docs.length) {
    $("gallery").innerHTML = "<p>No images yet.</p>";
    return;
  }

  for (const d of docs) {
    const url = USE_MEDIA_URL ? d?.media?.url : null;

    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <img src="${url ?? ""}" alt="${d.fileName ?? "image"}" />
      <div class="small"><b>Restaurant:</b> ${d.restaurantId ?? ""}</div>
      <div class="small"><b>User:</b> ${d.userName ?? ""} (${d.userID ?? ""})</div>
      <div class="small"><b>Rating:</b> ${d.rating ?? ""}</div>
      <div class="small"><b>Comment:</b> ${d.comment ?? ""}</div>
      <div class="small"><b>ID:</b> ${d.id ?? ""}</div>
      <button onclick="handleDelete('${d.id}')">Delete</button>
    `;
    $("gallery").appendChild(div);
  }
  } catch (err) {
    $("gallery").innerHTML = `Failed to load: ${err.message}`;
  }
}

$("refreshBtn").addEventListener("click", fetchImages);

async function handleDelete(id) {
  if (!confirm("Delete this image?")) return;
  try {
    await deleteImage(id);
    await fetchImages();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

$("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("status").textContent = "Uploading...";

  const fd = new FormData();
  fd.append("restaurantId", $("restaurantId").value);
  fd.append("userID", $("userID").value);
  fd.append("userName", $("userName").value);
  fd.append("rating", $("rating").value);
  fd.append("comment", $("comment").value);
  fd.append("FileName", $("file").files[0].name);
  fd.append("File", $("file").files[0]); // MUST be File

  const res = await fetch(IUPS_URL, {
    method: "POST",
    body: fd
  });

  if (!res.ok) {
    const t = await res.text();
    $("status").textContent = `Upload failed: ${res.status} ${t}`;
    return;
  }

  $("status").textContent = "Upload successful ✅";
  $("uploadForm").reset();
  await fetchImages();
});

// Load on start
fetchImages();
