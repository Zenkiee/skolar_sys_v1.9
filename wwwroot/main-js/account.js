const params = new URLSearchParams(window.location.search);
const requestedRole = params.get("role") || "learner";
const selectedRole = ["learner", "tutor", "admin"].includes(requestedRole)
    ? requestedRole
    : "learner";

const roleTitle = document.getElementById("roleTitle");
const accountMessage = document.getElementById("accountMessage");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const goToSignup = document.getElementById("goToSignup");
const loginForm = document.getElementById("loginForm");
const loginOtpForm = document.getElementById("loginOtpForm");
const loginUsername = document.getElementById("loginUsername");
const loginOtp = document.getElementById("loginOtp");
const loginMaskedEmail = document.getElementById("loginMaskedEmail");
const resendLoginOtp = document.getElementById("resendLoginOtp");
const backToLogin = document.getElementById("backToLogin");
const csrfToken = document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";

let resendTimer = null;

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

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const passwordVisible = input.type === "password";
    input.type = passwordVisible ? "text" : "password";
    setPasswordToggleIcon(button, passwordVisible);
}

function setMessage(message, type = "error") {
    accountMessage.textContent = message;
    accountMessage.style.color = type === "success" ? "#b6ffb6" : "#ffb3b3";
}

function clearMessage() {
    accountMessage.textContent = "";
}

function setFormSubmitting(form, submitting, busyText) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (submitting) {
        button.dataset.originalText = button.textContent;
        button.textContent = busyText;
    } else {
        button.textContent = button.dataset.originalText || button.textContent;
    }

    button.disabled = submitting;
}

async function postJson(url, body = null) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": csrfToken
        },
        body: body === null ? "{}" : JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
}

function showOtpStep(maskedEmail, resendAfterSeconds = 60) {
    loginForm.classList.remove("active");
    loginOtpForm.classList.add("active");
    roleTitle.textContent = "Verify Your Email";
    loginMaskedEmail.textContent = maskedEmail || "your email";
    loginOtp.value = "";
    clearMessage();
    startResendCountdown(resendAfterSeconds);
    loginOtp.focus();
}

function showLoginStep() {
    loginOtpForm.classList.remove("active");
    loginForm.classList.add("active");
    roleTitle.textContent = selectedRole === "admin"
        ? "Administrator Login"
        : selectedRole === "tutor"
            ? "Tutor Login"
            : "Learner Login";
    clearMessage();
    stopResendCountdown();
    document.getElementById("loginPassword").focus();
}

function startResendCountdown(seconds) {
    stopResendCountdown();
    let remaining = Math.max(0, Number(seconds) || 0);

    const update = () => {
        if (remaining <= 0) {
            resendLoginOtp.disabled = false;
            resendLoginOtp.textContent = "Resend code";
            stopResendCountdown();
            return;
        }

        resendLoginOtp.disabled = true;
        resendLoginOtp.textContent = `Resend in ${remaining}s`;
        remaining -= 1;
    };

    update();
    resendTimer = window.setInterval(update, 1000);
}

function stopResendCountdown() {
    if (resendTimer !== null) {
        window.clearInterval(resendTimer);
        resendTimer = null;
    }
}

if (selectedRole === "admin" && loginUsername) {
    loginUsername.value = "skolartutors.ph@gmail.com";
    loginUsername.readOnly = true;
}

showLoginStep();

document.querySelectorAll(".eye-btn").forEach(button => {
    setPasswordToggleIcon(button, false);
});

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

loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();

    const email = loginUsername.value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;
    setFormSubmitting(loginForm, true, "Sending code...");

    try {
        const { response, data } = await postJson("/Home/Login", {
            email,
            password,
            role: selectedRole
        });

        if (!response.ok) {
            setMessage(data.error || "Invalid email or password.");
            return;
        }

        showOtpStep(data.maskedEmail, data.resendAfterSeconds);
        setMessage("Verification code sent.", "success");
    } catch (error) {
        console.error(error);
        setMessage("Something went wrong. Please try again.");
    } finally {
        setFormSubmitting(loginForm, false, "Log in");
    }
});

loginOtp?.addEventListener("input", () => {
    loginOtp.value = loginOtp.value.replace(/\D/g, "").slice(0, 6);
});

loginOtpForm?.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();

    const otp = loginOtp.value.replace(/\D/g, "");
    if (otp.length !== 6) {
        setMessage("Enter the complete six-digit verification code.");
        loginOtp.focus();
        return;
    }

    setFormSubmitting(loginOtpForm, true, "Verifying...");

    try {
        const { response, data } = await postJson("/Home/VerifyLoginOtp", { otp });

        if (!response.ok) {
            setMessage(data.error || "Verification failed.");
            return;
        }

        setMessage("Email verified. Redirecting...", "success");
        window.setTimeout(() => {
            redirectByRole(data.role, data.identityVerificationStatus);
        }, 500);
    } catch (error) {
        console.error(error);
        setMessage("Something went wrong. Please try again.");
    } finally {
        setFormSubmitting(loginOtpForm, false, "Verify and continue");
    }
});

resendLoginOtp?.addEventListener("click", async () => {
    clearMessage();
    resendLoginOtp.disabled = true;

    try {
        const { response, data } = await postJson("/Home/ResendLoginOtp");
        if (!response.ok) {
            setMessage(data.error || "Unable to resend the code.");
            startResendCountdown(data.resendAfterSeconds || 0);
            return;
        }

        loginOtp.value = "";
        loginOtp.focus();
        setMessage(data.message || "A new code was sent.", "success");
        startResendCountdown(data.resendAfterSeconds || 60);
    } catch (error) {
        console.error(error);
        setMessage("Unable to resend the code. Please try again.");
        resendLoginOtp.disabled = false;
    }
});

backToLogin?.addEventListener("click", showLoginStep);

function redirectByRole(role, identityVerificationStatus) {
    if (role === "admin") {
        window.location.href = "/Admin/Issues";
    } else if (role === "tutor") {
        window.location.href = identityVerificationStatus === "Pending" || identityVerificationStatus === "Rejected"
            ? "/Tutor/IdentityVerification"
            : "/Tutor/TutorDashboard";
    } else {
        window.location.href = "/Learner/LearnerPortal";
    }
}
