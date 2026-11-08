document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginNotice = document.getElementById("login-notice");

  const userIcon = document.getElementById("user-icon");
  const userDropdown = document.getElementById("user-dropdown");
  const userStatus = document.getElementById("user-status");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const loginCancel = document.getElementById("login-cancel");

  const TOKEN_KEY = "teacherToken";
  let currentTeacher = null;

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const loggedIn = currentTeacher !== null;
    userStatus.textContent = loggedIn
      ? `Logged in as ${currentTeacher.display_name}`
      : "Not logged in";
    loginBtn.classList.toggle("hidden", loggedIn);
    logoutBtn.classList.toggle("hidden", !loggedIn);
    signupForm.classList.toggle("hidden", !loggedIn);
    loginNotice.classList.toggle("hidden", loggedIn);
    userIcon.classList.toggle("logged-in", loggedIn);
  }

  function handleSessionExpired() {
    sessionStorage.removeItem(TOKEN_KEY);
    currentTeacher = null;
    updateAuthUI();
    fetchActivities();
  }

  async function restoreSession() {
    if (!getToken()) {
      updateAuthUI();
      return;
    }
    try {
      const response = await fetch("/auth/me", { headers: authHeaders() });
      if (response.ok) {
        currentTeacher = await response.json();
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
        currentTeacher = null;
      }
    } catch (error) {
      console.error("Error restoring session:", error);
    }
    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message and previous dropdown options
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      const isTeacher = currentTeacher !== null;

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Delete buttons are only shown to logged-in teachers
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${escapeHTML(email)}</span>${
                        isTeacher
                          ? `<button class="delete-btn" data-activity="${escapeHTML(name)}" data-email="${escapeHTML(email)}" title="Unregister">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${escapeHTML(name)}</h4>
          <p>${escapeHTML(details.description)}</p>
          <p><strong>Schedule:</strong> ${escapeHTML(details.schedule)}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        if (response.status === 401) handleSessionExpired();
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        if (response.status === 401) handleSessionExpired();
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // User menu
  function closeUserDropdown() {
    userDropdown.classList.add("hidden");
    userIcon.setAttribute("aria-expanded", "false");
  }

  userIcon.addEventListener("click", (event) => {
    event.stopPropagation();
    const isHidden = userDropdown.classList.toggle("hidden");
    userIcon.setAttribute("aria-expanded", String(!isHidden));
  });

  document.addEventListener("click", (event) => {
    if (!userDropdown.contains(event.target)) closeUserDropdown();
  });

  // Login modal
  function openLoginModal() {
    closeUserDropdown();
    loginForm.reset();
    loginError.classList.add("hidden");
    loginModal.classList.remove("hidden");
    document.getElementById("username").focus();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
  }

  loginBtn.addEventListener("click", openLoginModal);
  loginCancel.addEventListener("click", closeLoginModal);
  loginModal.addEventListener("click", (event) => {
    if (event.target === loginModal) closeLoginModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLoginModal();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (response.ok) {
        sessionStorage.setItem(TOKEN_KEY, result.token);
        currentTeacher = {
          username: result.username,
          display_name: result.display_name,
        };
        closeLoginModal();
        updateAuthUI();
        fetchActivities();
        showMessage(`Welcome, ${result.display_name}!`, "success");
      } else {
        loginError.textContent = result.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch (error) {
      loginError.textContent = "Login failed. Please try again.";
      loginError.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    closeUserDropdown();
    try {
      await fetch("/auth/logout", { method: "POST", headers: authHeaders() });
    } catch (error) {
      console.error("Error logging out:", error);
    }
    sessionStorage.removeItem(TOKEN_KEY);
    currentTeacher = null;
    updateAuthUI();
    fetchActivities();
    showMessage("You have been logged out.", "info");
  });

  // Initialize app
  restoreSession().then(fetchActivities);
});
