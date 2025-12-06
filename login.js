const API_URL = "https://panchawati-cafe-ea183bf57462.herokuapp.com/api/v1";

const loginForm = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const errorMessage = document.getElementById("error-message");

// Check if already logged in
if (localStorage.getItem("token")) {
  window.location.href = "index.html";
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value;
  const password = passwordInput.value;

  if (!email || !password) return;

  setLoading(true);
  hideError();

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("Login response:", data);

    if (data.success) {
      // Save token and user info
      if (data.data && data.data.token) {
        localStorage.setItem("token", data.data.token);
        localStorage.setItem("user", JSON.stringify(data.data.user));
        console.log("Token saved:", data.data.token);
        // Redirect
        window.location.href = "index.html";
      } else {
        console.error("Token missing in response data", data);
        showError("Login failed: Invalid server response");
      }
    } else {
      showError(data.message || "Login failed");
    }
  } catch (error) {
    console.error("Login error:", error);
    showError("Connection failed. Please try again.");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  if (isLoading) {
    loginBtn.disabled = true;
    loginBtn.innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...';
    loginBtn.classList.add("opacity-75", "cursor-not-allowed");
  } else {
    loginBtn.disabled = false;
    loginBtn.innerHTML =
      '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';
    loginBtn.classList.remove("opacity-75", "cursor-not-allowed");
  }
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  errorMessage.classList.add("hidden");
}
