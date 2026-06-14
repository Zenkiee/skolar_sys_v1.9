const params = new URLSearchParams(window.location.search);
const selectedRole = params.get("role") || "learner";

const forgotTitle = document.getElementById("forgotTitle");
const backToLogin = document.getElementById("backToLogin");
const backToLoginTwo = document.getElementById("backToLoginTwo");
const forgotMessage = document.getElementById("forgotMessage");

const emailForm = document.getElementById("emailForm");
const resetForm = document.getElementById("resetForm");

let selectedUserEmail = null;

if (forgotTitle) {
    forgotTitle.textContent = selectedRole === "tutor"
        ? "Forgot Tutor Password"
        : "Forgot Learner Password";
}

if (backToLogin) {
    backToLogin.href = `/Home/Account?role=${selectedRole}`;
}

if (backToLoginTwo) {
    backToLoginTwo.href = `/Home/Account?role=${selectedRole}`;
}

function getUsers() {
    return JSON.parse(localStorage.getItem("users")) || [];
}

function saveUsers(users) {
    localStorage.setItem("users", JSON.stringify(users));
}

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);

    if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
    } else {
        input.type = "password";
        button.textContent = "👁";
    }
}

/* STEP 1: VERIFY EMAIL */
emailForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("resetEmail").value.trim().toLowerCase();
    const users = getUsers();

    const user = users.find(user => {
        return user.email === email && user.role === selectedRole;
    });

    if (!user) {
        forgotMessage.textContent = "No account found with this email.";
        forgotMessage.style.color = "#ffb3b3";
        return;
    }

    selectedUserEmail = email;

    forgotMessage.textContent = "Email verified. Please enter your new password.";
    forgotMessage.style.color = "#b6ffb6";

    emailForm.classList.remove("active");
    resetForm.classList.add("active");
});

/* STEP 2: RESET PASSWORD */
resetForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword = document.getElementById("confirmNewPassword").value;

    if (newPassword !== confirmNewPassword) {
        forgotMessage.textContent = "Passwords do not match.";
        forgotMessage.style.color = "#ffb3b3";
        return;
    }

    const users = getUsers();

    const updatedUsers = users.map(user => {
        if (user.email === selectedUserEmail && user.role === selectedRole) {
            return {
                ...user,
                password: newPassword
            };
        }

        return user;
    });

    saveUsers(updatedUsers);

    forgotMessage.textContent = "Password reset successful! Redirecting to login...";
    forgotMessage.style.color = "#b6ffb6";

    setTimeout(() => {
        window.location.href = `/Home/Account?role=${selectedRole}`;
    }, 1200);
});