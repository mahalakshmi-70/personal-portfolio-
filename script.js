const isLocalPage = window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = window.OFFICIAL_API_BASE_URL ||
    (isLocalPage ? "http://127.0.0.1:5000" : window.location.origin);
window.PORTFOLIO_API_BASE = API_BASE;
const contactForm = document.querySelector("#contactForm");
const contactResult = document.querySelector("#result");
const healthStatus = document.querySelector("#healthStatus");
const currentYear = document.querySelector("[data-current-year]");
const nameField = document.querySelector("#name");
const emailField = document.querySelector("#email");
const phoneField = document.querySelector("#phone");
const messageField = document.querySelector("#message");

// Quick connectivity check so failures are visible immediately
if (contactResult instanceof HTMLElement) {
  fetch(`${API_BASE}/api/health`)
    .then((r) => r.json())
    .then((d) => {
      if (d && d.status === "ok") {
        if (healthStatus instanceof HTMLElement) {
          healthStatus.textContent = d.emailEnabled
            ? "Backend connected and email is configured."
            : "Backend connected. Messages will be saved, but email is not configured.";
        }
      } else {
        if (healthStatus instanceof HTMLElement) {
          healthStatus.textContent = "Backend responded but is not healthy.";
        }
      }
    })
    .catch(() => {
      if (healthStatus instanceof HTMLElement) {
        healthStatus.textContent = `Backend not reachable. Start the Flask server at ${API_BASE} and refresh.`;
      }
    });
}

if (currentYear instanceof HTMLElement) {
    currentYear.textContent = String(new Date().getFullYear());
}

if (contactForm instanceof HTMLFormElement && contactResult instanceof HTMLElement) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        contactResult.textContent = "Sending...";
        try {
            const res = await fetch(`${API_BASE}/api/contact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nameField ? nameField.value.trim() : "",
                    email: emailField ? emailField.value.trim() : "",
                    phone: phoneField ? phoneField.value.trim() : "",
                    message: messageField ? messageField.value.trim() : "",
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                contactResult.textContent = data.message;
                contactForm.reset();
            } else {
                contactResult.textContent = data.error || "Failed to send message.";
            }
        } catch (err) {
            contactResult.textContent = "Network error. Is the backend running?";
        }
    });
}
