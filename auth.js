(() => {
    const apiBase = window.PORTFOLIO_API_BASE ||
        (["localhost", "127.0.0.1"].includes(window.location.hostname)
            ? "http://127.0.0.1:5000"
            : window.location.origin);
    const tokenKey = "portfolioAdminToken";
    const loginForm = document.querySelector("#loginForm");
    const registerForm = document.querySelector("#registerForm");
    const adminDashboard = document.querySelector("#adminDashboard");

    async function readResponse(response) {
        try {
            return await response.json();
        } catch {
            return {};
        }
    }

    if (loginForm instanceof HTMLFormElement) {
        if (sessionStorage.getItem(tokenKey)) {
            window.location.replace("admin.html");
        }

        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const result = document.querySelector("#loginResult");
            const username = document.querySelector("#loginUser").value.trim();
            const password = document.querySelector("#loginPass").value;
            result.textContent = "Signing in...";

            try {
                const response = await fetch(`${apiBase}/api/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username, password }),
                });
                const data = await readResponse(response);
                if (!response.ok || !data.success || !data.token) {
                    result.textContent = data.error || "Unable to sign in.";
                    return;
                }
                sessionStorage.setItem(tokenKey, data.token);
                window.location.assign("admin.html");
            } catch {
                result.textContent = "Could not connect to the Flask backend.";
            }
        });
    }

    if (registerForm instanceof HTMLFormElement) {
        const result = document.querySelector("#registerResult");
        const info = document.querySelector("#registerInfo");
        const submitButton = registerForm.querySelector('button[type="submit"]');

        fetch(`${apiBase}/api/register/status`)
            .then(readResponse)
            .then((data) => {
                if (!data.registrationAvailable) {
                    info.textContent = "An admin account already exists. Please sign in instead.";
                    if (submitButton instanceof HTMLButtonElement) {
                        submitButton.disabled = true;
                    }
                } else {
                    info.textContent = "This setup page is available only until the first admin account is created.";
                }
            })
            .catch(() => {
                info.textContent = "Could not check registration availability. Start the Flask backend and refresh.";
            });

        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            result.textContent = "Creating account...";
            const body = {
                name: document.querySelector("#regName").value.trim(),
                email: document.querySelector("#regEmail").value.trim(),
                password: document.querySelector("#regPassword").value,
                setupKey: document.querySelector("#setupKey").value,
            };

            try {
                const response = await fetch(`${apiBase}/api/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                const data = await readResponse(response);
                if (!response.ok || !data.success) {
                    result.textContent = data.error || "Unable to create the account.";
                    return;
                }
                result.textContent = "Admin account created. Redirecting to sign in...";
                window.setTimeout(() => window.location.assign("login.html"), 1000);
            } catch {
                result.textContent = "Could not connect to the Flask backend.";
            }
        });
    }

    if (adminDashboard instanceof HTMLElement) {
        const status = document.querySelector("#adminStatus");
        const messageList = document.querySelector("#messageList");
        const token = sessionStorage.getItem(tokenKey);

        if (!token) {
            window.location.replace("login.html");
            return;
        }

        fetch(`${apiBase}/api/messages`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(async (response) => {
                const data = await readResponse(response);
                if (response.status === 401) {
                    sessionStorage.removeItem(tokenKey);
                    window.location.replace("login.html");
                    return;
                }
                if (!response.ok || !Array.isArray(data)) {
                    throw new Error(data.error || "Unable to load contact messages.");
                }
                messageList.replaceChildren();
                if (data.length === 0) {
                    status.textContent = "There are no messages yet.";
                    return;
                }

                status.textContent = `${data.length} message${data.length === 1 ? "" : "s"}`;
                data.slice().reverse().forEach((message) => {
                    const card = document.createElement("article");
                    card.className = "card";

                    const title = document.createElement("h2");
                    title.textContent = message.name || "No name";
                    const details = document.createElement("p");
                    details.textContent = [
                        message.email || "No email",
                        message.phone ? `Phone: ${message.phone}` : "",
                        message.createdAt || "",
                    ].filter(Boolean).join(" · ");
                    const content = document.createElement("p");
                    content.textContent = message.message || "";

                    card.append(title, details, content);
                    messageList.append(card);
                });
            })
            .catch((error) => {
                status.textContent = error.message;
            });

        document.querySelector("#logoutButton").addEventListener("click", async () => {
            try {
                await fetch(`${apiBase}/api/logout`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch (error) {
                console.error("Logout request failed:", error);
            } finally {
                sessionStorage.removeItem(tokenKey);
                window.location.replace("login.html");
            }
        });
    }
})();
