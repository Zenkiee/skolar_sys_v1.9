const params = new URLSearchParams(window.location.search);
const requestedRole = params.get("role") || "learner";
const selectedRole = ["learner", "tutor", "admin"].includes(requestedRole) ? requestedRole : "learner";

const roleTitle = document.getElementById("roleTitle");
const accountMessage = document.getElementById("accountMessage");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const goToSignup = document.getElementById("goToSignup");
const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");

const passwordVisibleIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>`;
const passwordHiddenIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10.7 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9 7 9 7a15.5 15.5 0 0 1-4.1 4.8"></path>
        <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9"></path>
        <path d="M6.6 6.6C4.1 8.3 3 12 3 12s3.5 7 9 7a10.7 10.7 0 0 0 4.4-.9"></path>
        <path d="M3 3l18 18"></path>
    </svg>`;

function setPasswordToggleIcon(button, passwordVisible) {
    if (!button) return;
    button.innerHTML = passwordVisible ? passwordHiddenIcon : passwordVisibleIcon;
    button.setAttribute("aria-label", passwordVisible ? "Hide password" : "Show password");
}

if (selectedRole === "admin" && loginUsername) {
    loginUsername.value = "skolartutors.ph@gmail.com";
    loginUsername.readOnly = true;
}

if (roleTitle) {
    roleTitle.textContent = selectedRole === "admin"
        ? "Administrator Login"
        : selectedRole === "tutor"
            ? "Tutor Login"
            : "Learner Login";
}

if (forgotPasswordLink) {
    if (selectedRole === "admin") {
        forgotPasswordLink.hidden = true;
    } else {
        forgotPasswordLink.href = `/Home/ForgotPassword?role=${selectedRole}`;
    }
}

if (goToSignup) {
    const switchText = goToSignup.closest(".switch-text");
    if (selectedRole === "admin") {
        if (switchText) switchText.hidden = true;
    } else {
        goToSignup.href = `/Home/Signup?role=${selectedRole}`;
    }
}


function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const passwordVisible = input.type === "password";
    input.type = passwordVisible ? "text" : "password";
    setPasswordToggleIcon(button, passwordVisible);
}

document.querySelectorAll(".eye-btn").forEach(button => setPasswordToggleIcon(button, false));

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = document.getElementById("loginUsername").value.trim().toLowerCase();
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await fetch("/Home/Login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role: selectedRole })
            });

            const data = await response.json();

            if (!response.ok) {
                accountMessage.textContent = data.error || "Invalid email or password";
                accountMessage.style.color = "#ffb3b3";
                return;
            }

            accountMessage.textContent = "Login successful!";
            accountMessage.style.color = "#b6ffb6";

            setTimeout(() => {
                redirectByRole(data.role);
            }, 800);

        } catch (err) {
            accountMessage.textContent = "Something went wrong. Please try again.";
            accountMessage.style.color = "#ffb3b3";
        }
    });
}

function redirectByRole(role) {
    if (role === "admin") {
        window.location.href = "/Admin/Issues";
    } else if (role === "tutor") {
        window.location.href = "/Tutor/TutorDashboard";
    } else {
        window.location.href = "/Learner/LearnerPortal";
    }
}
