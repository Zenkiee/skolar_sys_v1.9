const params = new URLSearchParams(window.location.search);

const selectedRole =
    params.get("role") === "tutor"
        ? "tutor"
        : "learner";

const forgotTitle = document.getElementById("forgotTitle");
const backToLogin = document.getElementById("backToLogin");
const backToLoginTwo = document.getElementById("backToLoginTwo");
const forgotMessage = document.getElementById("forgotMessage");

const emailForm = document.getElementById("emailForm");
const resetForm = document.getElementById("resetForm");

initializeForgotPasswordPage();

function initializeForgotPasswordPage() {
    if (forgotTitle) {
        forgotTitle.textContent =
            selectedRole === "tutor"
                ? "Forgot Tutor Password"
                : "Forgot Learner Password";
    }

    const loginUrl = `/Home/Account?role=${selectedRole}`;

    if (backToLogin) {
        backToLogin.href = loginUrl;
    }

    if (backToLoginTwo) {
        backToLoginTwo.href = loginUrl;
    }

    if (emailForm) {
        emailForm.addEventListener(
            "submit",
            handleEmailSubmit
        );
    }

    if (resetForm) {
        resetForm.addEventListener(
            "submit",
            handlePasswordReset
        );
    }
}

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);

    if (!input) {
        return;
    }

    if (input.type === "password") {
        input.type = "text";
        button.textContent = "🙈";
    } else {
        input.type = "password";
        button.textContent = "👁";
    }
}

/* STEP 1: CHECK ACCOUNT IN SQLITE DATABASE */
async function handleEmailSubmit(event) {
    event.preventDefault();

    clearMessage();

    const emailInput =
        document.getElementById("resetEmail");

    if (!emailInput) {
        showMessage(
            "The email field could not be found.",
            "error"
        );

        return;
    }

    const email =
        emailInput.value.trim().toLowerCase();

    if (!email) {
        showMessage(
            "Enter your registered email address.",
            "error"
        );

        emailInput.focus();
        return;
    }

    setFormBusy(emailForm, true);

    try {
        const data = await postJson(
            "/Home/VerifyResetAccount",
            {
                email: email,
                role: selectedRole
            }
        );

        showMessage(
            data.message ||
                "Account found. Create a new password.",
            "success"
        );

        emailForm.classList.remove("active");
        resetForm.classList.add("active");

        const newPasswordInput =
            document.getElementById("newPassword");

        if (newPasswordInput) {
            newPasswordInput.focus();
        }
    } catch (error) {
        showMessage(
            error.message,
            "error"
        );
    } finally {
        setFormBusy(emailForm, false);
    }
}

/* STEP 2: UPDATE PASSWORD IN SQLITE DATABASE */
async function handlePasswordReset(event) {
    event.preventDefault();

    clearMessage();

    const newPasswordInput =
        document.getElementById("newPassword");

    const confirmPasswordInput =
        document.getElementById("confirmNewPassword");

    if (!newPasswordInput || !confirmPasswordInput) {
        showMessage(
            "The password fields could not be found.",
            "error"
        );

        return;
    }

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (
        newPassword.length < 8 ||
        newPassword.length > 64 ||
        !/[A-Za-z]/.test(newPassword) ||
        !/\d/.test(newPassword)
    ) {
        showMessage(
            "Password must be 8–64 characters and include a letter and number.",
            "error"
        );

        newPasswordInput.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage(
            "Passwords do not match.",
            "error"
        );

        confirmPasswordInput.focus();
        return;
    }

    setFormBusy(resetForm, true);

    try {
        const data = await postJson(
            "/Home/ResetPassword",
            {
                newPassword: newPassword,
                confirmPassword: confirmPassword
            }
        );

        showMessage(
            `${data.message} Redirecting to login...`,
            "success"
        );

        setTimeout(() => {
            window.location.href =
                `/Home/Account?role=${selectedRole}`;
        }, 1200);
    } catch (error) {
        showMessage(
            error.message,
            "error"
        );
    } finally {
        setFormBusy(resetForm, false);
    }
}

async function postJson(url, payload) {
    const antiForgeryToken =
        document.querySelector(
            'input[name="__RequestVerificationToken"]'
        )?.value || "";

    const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": antiForgeryToken
        },
        body: JSON.stringify(payload)
    });

    const data = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.error ||
                "Something went wrong. Please try again."
        );
    }

    return data;
}

function setFormBusy(form, isBusy) {
    if (!form) {
        return;
    }

    const submitButton =
        form.querySelector('button[type="submit"]');

    if (!submitButton) {
        return;
    }

    submitButton.disabled = isBusy;

    if (isBusy) {
        submitButton.dataset.originalText =
            submitButton.textContent;

        submitButton.textContent = "Please wait...";
    } else {
        submitButton.textContent =
            submitButton.dataset.originalText ||
            submitButton.textContent;
    }
}

function showMessage(message, type) {
    if (!forgotMessage) {
        return;
    }

    forgotMessage.textContent = message;

    forgotMessage.style.color =
        type === "success"
            ? "#b6ffb6"
            : "#ffb3b3";
}

function clearMessage() {
    if (forgotMessage) {
        forgotMessage.textContent = "";
    }
}