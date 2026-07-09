const SITE_CONFIG = {
  leadEndpoint: "https://script.google.com/macros/s/AKfycbz7VZk4b0mYI0RDQfqzFwCo4W7nkFPpQwHL2qrUAJuET5pS-q-DDVUV_EIMoTMtsH5F/exec",
  smsPrefill: "Hi! I'd like a free quote for my home.",
  maxPhotoBytesForEmail: 7 * 1024 * 1024
};

const header = document.querySelector("[data-header]");
const form = document.querySelector("[data-signup-form]");
const message = document.querySelector("[data-form-message]");
const confirmation = document.querySelector("[data-confirmation]");
const customerFirstName = document.querySelector("[data-customer-first-name]");
const returnHome = document.querySelector("[data-return-home]");
const quoteSection = document.querySelector("#quote");

const updateHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 12);
};

const readPhotoUpload = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    const result = String(reader.result || "");
    const base64 = result.includes(",") ? result.split(",")[1] : result;

    resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      base64
    });
  });

  reader.addEventListener("error", () => reject(reader.error));
  reader.readAsDataURL(file);
});

const collectPhotoUploads = async () => {
  const files = Array.from(form.querySelector("input[type='file']")?.files || []);
  let totalBytes = 0;
  const accepted = [];
  const skipped = [];

  for (const file of files) {
    if (totalBytes + file.size > SITE_CONFIG.maxPhotoBytesForEmail) {
      skipped.push(file.name);
      continue;
    }

    accepted.push(await readPhotoUpload(file));
    totalBytes += file.size;
  }

  return { accepted, skipped, files };
};

const buildLeadFromForm = async () => {
  const data = new FormData(form);
  const firstName = data.get("firstName")?.trim() || "";
  const lastName = data.get("lastName")?.trim() || "";
  const photoUploads = await collectPhotoUploads();

  return {
    createdAt: new Date().toLocaleString(),
    status: "New",
    source: "Elevate Exterior Website",
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    phone: data.get("phone")?.trim() || "",
    email: data.get("email")?.trim() || "",
    address: data.get("address")?.trim() || "",
    services: data.getAll("services").join(", "),
    photoCount: String(photoUploads.files.length),
    photoNames: photoUploads.files.map((photo) => photo.name).join(", "),
    skippedPhotoNames: photoUploads.skipped.join(", "),
    photos: JSON.stringify(photoUploads.accepted),
    notes: data.get("notes")?.trim() || ""
  };
};

const postLeadToNotificationEndpoint = async (lead) => {
  if (!SITE_CONFIG.leadEndpoint || SITE_CONFIG.leadEndpoint.includes("PASTE_YOUR")) {
    throw new Error("Lead endpoint is missing.");
  }

  const body = new URLSearchParams();

  Object.entries(lead).forEach(([name, value]) => {
    body.append(name, value || "");
  });

  if ("fetch" in window) {
    await fetch(SITE_CONFIG.leadEndpoint, {
      method: "POST",
      mode: "no-cors",
      body
    });
    return;
  }

  await new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", SITE_CONFIG.leadEndpoint, true);
    request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
    request.addEventListener("load", resolve);
    request.addEventListener("error", reject);
    request.send(body.toString());
  });
};

const queueFutureSmsNotification = async () => {
  // Future hook: call Twilio, Zapier, Make, CRM, or another SMS automation endpoint here.
};

const showConfirmation = (firstName) => {
  customerFirstName.textContent = firstName || "there";
  quoteSection.classList.add("is-hidden");
  confirmation.hidden = false;
  confirmation.scrollIntoView({ behavior: "smooth", block: "start" });
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";
  message.textContent = "";

  try {
    const lead = await buildLeadFromForm();
    await postLeadToNotificationEndpoint(lead);
    await queueFutureSmsNotification(lead);
    form.reset();
    showConfirmation(lead.firstName);
  } catch {
    message.textContent = "The form is ready, but the quote notification connection needs to be configured.";
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Request";
  }
});

returnHome?.addEventListener("click", () => {
  confirmation.hidden = true;
  quoteSection.classList.remove("is-hidden");
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();
