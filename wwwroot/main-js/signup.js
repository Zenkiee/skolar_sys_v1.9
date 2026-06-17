const params = new URLSearchParams(window.location.search);
const requestedRole = params.get("role");
const selectedRole = requestedRole === "tutor" ? "tutor" : "learner";

const roleTitle = document.getElementById("roleTitle");
const accountMessage = document.getElementById("accountMessage");
const goToLogin = document.getElementById("goToLogin");
const signupBox = document.getElementById("signupBox");
const basicSignupForm = document.getElementById("basicSignupForm");
const learnerProfileForm = document.getElementById("learnerProfileForm");
const tutorProfileForm = document.getElementById("tutorProfileForm");
const signupOtpForm = document.getElementById("signupOtpForm");
const signupOtp = document.getElementById("signupOtp");
const signupMaskedEmail = document.getElementById("signupMaskedEmail");
const resendSignupOtp = document.getElementById("resendSignupOtp");
const backToProfile = document.getElementById("backToProfile");
const stepOneCircle = document.getElementById("stepOneCircle");
const stepTwoCircle = document.getElementById("stepTwoCircle");
const stepThreeCircle = document.getElementById("stepThreeCircle");
const stepLabel = document.getElementById("stepLabel");
const allowedYearLevels = ["Preschool", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
let tempAccount = null;
let pendingRedirectUrl = "";
let resendTimer = null;

initializePage();

function initializePage() {
    roleTitle.textContent = selectedRole === "tutor" ? "Tutor Sign Up" : "Learner Sign Up";
    goToLogin.href = `/Home/Account?role=${selectedRole}`;

    const termsLink = document.getElementById("termsLink");
    termsLink.href = selectedRole === "tutor" ? "/Home/TermsTutor" : "/Home/TermsLearner";

    setBirthdayLimit();
    initializePasswordToggles();
    initializeValidationEvents();
    initializePhoneInputs();
    initializeSubjectDropdown();
    initializeBioCounter();

    document.querySelectorAll("[data-back-to-account]").forEach(button => {
        button.addEventListener("click", goBackToSignup);
    });

    basicSignupForm.addEventListener("submit", handleBasicSignup);
    learnerProfileForm.addEventListener("submit", handleLearnerSignup);
    tutorProfileForm.addEventListener("submit", handleTutorSignup);
    signupOtpForm.addEventListener("submit", handleSignupOtpVerification);
    resendSignupOtp.addEventListener("click", handleSignupOtpResend);
    backToProfile.addEventListener("click", showProfileStep);
    signupOtp.addEventListener("input", () => {
        signupOtp.value = signupOtp.value.replace(/\D/g, "").slice(0, 6);
        clearFieldError("signupOtp");
    });
}

function showProfileStep() {
    stopResendCountdown();
    clearMessage();
    basicSignupForm.classList.remove("active");
    learnerProfileForm.classList.remove("active");
    tutorProfileForm.classList.remove("active");
    signupOtpForm.classList.remove("active");
    stepOneCircle.classList.add("done");
    stepTwoCircle.classList.add("active");
    stepTwoCircle.classList.remove("done");
    stepThreeCircle.classList.remove("active", "done");
    stepLabel.textContent = "Create Profile";
    signupBox.classList.add("profile-mode");

    if (selectedRole === "tutor") {
        tutorProfileForm.classList.add("active");
        roleTitle.textContent = "Create Tutor Profile";
        document.getElementById("tutorName").focus();
    } else {
        learnerProfileForm.classList.add("active");
        roleTitle.textContent = "Create Learner Profile";
        document.getElementById("learnerName").focus();
    }
}

function goBackToSignup() {
    stopResendCountdown();
    learnerProfileForm.classList.remove("active");
    tutorProfileForm.classList.remove("active");
    signupOtpForm.classList.remove("active");
    basicSignupForm.classList.add("active");
    stepOneCircle.classList.remove("done");
    stepTwoCircle.classList.remove("active", "done");
    stepThreeCircle.classList.remove("active", "done");
    stepLabel.textContent = "Basic Account";
    signupBox.classList.remove("profile-mode");
    roleTitle.textContent = selectedRole === "tutor" ? "Tutor Sign Up" : "Learner Sign Up";
    clearMessage();
    document.getElementById("signupEmail").focus();
}

function showVerificationStep(maskedEmail, redirectUrl, resendAfterSeconds = 60) {
    basicSignupForm.classList.remove("active");
    learnerProfileForm.classList.remove("active");
    tutorProfileForm.classList.remove("active");
    signupOtpForm.classList.add("active");

    stepOneCircle.classList.add("done");
    stepTwoCircle.classList.remove("active");
    stepTwoCircle.classList.add("done");
    stepThreeCircle.classList.add("active");
    stepLabel.textContent = "Email Verification";
    roleTitle.textContent = "Verify Your Email";
    signupBox.classList.remove("profile-mode");

    pendingRedirectUrl = redirectUrl;
    signupMaskedEmail.textContent = maskedEmail || tempAccount?.email || "your email";
    signupOtp.value = "";
    clearFieldError("signupOtp");
    clearMessage();
    startResendCountdown(resendAfterSeconds);
    signupOtp.focus();
}

function startResendCountdown(seconds) {
    stopResendCountdown();
    let remaining = Math.max(0, Number(seconds) || 0);

    const update = () => {
        if (remaining <= 0) {
            resendSignupOtp.disabled = false;
            resendSignupOtp.textContent = "Resend code";
            stopResendCountdown();
            return;
        }

        resendSignupOtp.disabled = true;
        resendSignupOtp.textContent = `Resend in ${remaining}s`;
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

function handleBasicSignup(event) {
    event.preventDefault();
    clearMessage();
    clearFormErrors(basicSignupForm);

    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const acceptedTerms = document.getElementById("agreeTerms").checked;

    let valid = true;
    valid = validateEmail(email) && valid;
    valid = validatePassword(password) && valid;
    valid = validateConfirmPassword(password, confirmPassword) && valid;

    if (!acceptedTerms) {
        setFieldError("agreeTerms", "You must accept the Terms and Conditions.");
        valid = false;
    }

    if (!valid) {
        focusFirstInvalid(basicSignupForm);
        return;
    }

    tempAccount = { email, password, acceptedTerms };
    showProfileStep();
}

async function handleLearnerSignup(event) {
    event.preventDefault();
    clearMessage();
    clearFormErrors(learnerProfileForm);

    const name = document.getElementById("learnerName").value.trim();
    const gradeLevel = document.getElementById("yearLevel").value;
    const school = document.getElementById("school").value.trim();
    const birthday = document.getElementById("birthday").value;

    let valid = true;
    valid = validateName("learnerName", name, "Learner name") && valid;

    if (!allowedYearLevels.includes(gradeLevel)) {
        setFieldError("yearLevel", "Select a valid year level.");
        valid = false;
    }

    if (school.length > 100) {
        setFieldError("school", "School must be 100 characters or fewer.");
        valid = false;
    }

    if (!validateBirthday(birthday)) valid = false;

    if (!valid) {
        focusFirstInvalid(learnerProfileForm);
        return;
    }

    await submitSignup(learnerProfileForm, {
        name,
        email: tempAccount.email,
        password: tempAccount.password,
        role: "learner",
        acceptedTerms: tempAccount.acceptedTerms,
        learnerProfile: { gradeLevel, school, birthday }
    }, "/Learner/LearnerPortal");
}

async function handleTutorSignup(event) {
    event.preventDefault();
    clearMessage();
    clearFormErrors(tutorProfileForm);

    const name = document.getElementById("tutorName").value.trim();
    const rate = Number(document.getElementById("rate").value);
    const education = document.getElementById("education").value.trim();
    const contactNumber = toPhilippinePhoneNumber(document.getElementById("contactNumber").value);
    const bio = document.getElementById("bio").value.trim();
    const subjects = getSelectedSubjects();

    let valid = true;
    valid = validateName("tutorName", name, "Tutor name") && valid;

    if (!Number.isFinite(rate) || rate < 1 || rate > 10000) {
        setFieldError("rate", "Enter a rate from ₱1 to ₱10,000 per hour.");
        valid = false;
    }

    if (education.length < 3 || education.length > 120) {
        setFieldError("education", "Education must be 3 to 120 characters.");
        valid = false;
    }

    if (!isValidLocalPhoneNumber(document.getElementById("contactNumber").value)) {
        setFieldError("contactNumber", "Enter the 10 digits after +63.");
        valid = false;
    }

    if (bio.length < 20 || bio.length > 500) {
        setFieldError("bio", "Bio must be 20 to 500 characters.");
        valid = false;
    }

    if (subjects.length < 1) {
        setFieldError("subjectDropdownTrigger", "Choose at least one subject.");
        valid = false;
    }

    if (!valid) {
        focusFirstInvalid(tutorProfileForm);
        return;
    }

    await submitSignup(tutorProfileForm, {
        name,
        email: tempAccount.email,
        password: tempAccount.password,
        role: "tutor",
        acceptedTerms: tempAccount.acceptedTerms,
        tutorProfile: {
            rate,
            education,
            contactNumber,
            bio,
            subjects
        }
    }, "/Tutor/IdentityVerification");
}

function toLocalPhoneDigits(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("63")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("09")) digits = digits.slice(1);
    return digits.slice(0, 10);
}

function isValidLocalPhoneNumber(value) {
    return /^9\d{9}$/.test(toLocalPhoneDigits(value));
}

function toPhilippinePhoneNumber(value) {
    const localDigits = toLocalPhoneDigits(value);
    return /^9\d{9}$/.test(localDigits) ? `+63${localDigits}` : "";
}

function initializePhoneInputs() {
    document.querySelectorAll(".phone-prefix-field input").forEach(input => {
        input.value = toLocalPhoneDigits(input.value);
        input.addEventListener("input", () => {
            input.value = toLocalPhoneDigits(input.value);
            clearFieldError(input.id);
        });
    });
}

async function submitSignup(form, payload, redirectUrl) {
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";
    setSubmitting(form, true);

    try {
        const response = await fetch("/Home/Signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": token
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            handleServerError(data);
            return;
        }

        showVerificationStep(
            data.maskedEmail,
            redirectUrl,
            data.resendAfterSeconds || 60);
        showMessage("Verification code sent.", "success");
    } catch (error) {
        showMessage("Something went wrong. Please try again.", "error");
    } finally {
        setSubmitting(form, false);
    }
}

async function handleSignupOtpVerification(event) {
    event.preventDefault();
    clearMessage();
    clearFieldError("signupOtp");

    const otp = signupOtp.value.replace(/\D/g, "");
    if (otp.length !== 6) {
        setFieldError("signupOtp", "Enter the complete six-digit verification code.");
        signupOtp.focus();
        return;
    }

    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";
    setSubmitting(signupOtpForm, true, "Verifying...");

    try {
        const response = await fetch("/Home/VerifySignupOtp", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": token
            },
            body: JSON.stringify({ otp })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showMessage(data.error || "Verification failed.", "error");
            return;
        }

        showMessage("Email verified. Account created!", "success");
        window.setTimeout(() => {
            window.location.href = pendingRedirectUrl || (
                data.role === "tutor"
                    ? "/Tutor/IdentityVerification"
                    : "/Learner/LearnerPortal");
        }, 600);
    } catch (error) {
        console.error(error);
        showMessage("Something went wrong. Please try again.", "error");
    } finally {
        setSubmitting(signupOtpForm, false, "Verify and create account");
    }
}

async function handleSignupOtpResend() {
    clearMessage();
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value || "";
    resendSignupOtp.disabled = true;

    try {
        const response = await fetch("/Home/ResendSignupOtp", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN": token
            },
            body: "{}"
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            showMessage(data.error || "Unable to resend the code.", "error");
            startResendCountdown(data.resendAfterSeconds || 0);
            return;
        }

        signupOtp.value = "";
        signupOtp.focus();
        showMessage(data.message || "A new code was sent.", "success");
        startResendCountdown(data.resendAfterSeconds || 60);
    } catch (error) {
        console.error(error);
        showMessage("Unable to resend the code. Please try again.", "error");
        resendSignupOtp.disabled = false;
    }
}

function handleServerError(data) {
    const field = data.field || "";
    const message = data.error || "Signup failed.";
    const basicFields = new Set(["signupEmail", "signupPassword", "confirmPassword", "agreeTerms"]);

    if (field && basicFields.has(field) && !basicSignupForm.classList.contains("active")) {
        goBackToSignup();
    }

    if (field && document.getElementById(field)) {
        setFieldError(field, message);
        document.getElementById(field).focus();
    } else {
        showMessage(message, "error");
    }
}

function validateEmail(email) {
    const emailInput = document.getElementById("signupEmail");
    emailInput.value = email;

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError("signupEmail", "Enter a valid email address.");
        return false;
    }

    clearFieldError("signupEmail");
    return true;
}

function validatePassword(password) {
    updatePasswordRules(password);

    if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setFieldError("signupPassword", "Password must be 8–64 characters and include a letter and number.");
        return false;
    }

    clearFieldError("signupPassword");
    return true;
}

function validateConfirmPassword(password, confirmation) {
    if (!confirmation || confirmation !== password) {
        setFieldError("confirmPassword", "Passwords do not match.");
        return false;
    }

    clearFieldError("confirmPassword");
    return true;
}

function validateName(fieldId, name, label) {
    if (name.length < 2 || name.length > 60 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name)) {
        setFieldError(fieldId, `${label} must be 2 to 60 characters and contain a letter.`);
        return false;
    }

    clearFieldError(fieldId);
    return true;
}

function validateBirthday(value) {
    if (!value) {
        setFieldError("birthday", "Birthdate is required.");
        return false;
    }

    const birthday = parseLocalDate(value);
    if (!birthday || Number.isNaN(birthday.getTime())) {
        setFieldError("birthday", "Enter a valid birthdate.");
        return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (birthday > today) {
        setFieldError("birthday", "Birthdate cannot be in the future.");
        return false;
    }

    clearFieldError("birthday");
    return true;
}

function initializeValidationEvents() {
    document.getElementById("signupEmail").addEventListener("blur", event => validateEmail(event.target.value.trim().toLowerCase()));
    document.getElementById("signupPassword").addEventListener("input", event => {
        updatePasswordRules(event.target.value);
        if (event.target.classList.contains("input-invalid")) validatePassword(event.target.value);
    });
    document.getElementById("confirmPassword").addEventListener("input", event => {
        if (event.target.classList.contains("input-invalid")) {
            validateConfirmPassword(document.getElementById("signupPassword").value, event.target.value);
        }
    });

    document.querySelectorAll("input, select, textarea").forEach(input => {
        input.addEventListener("input", () => {
            if (input.id !== "signupPassword" && input.id !== "confirmPassword") clearFieldError(input.id);
        });
        input.addEventListener("change", () => clearFieldError(input.id));
    });
}

function initializePasswordToggles() {
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

    document.querySelectorAll("[data-password-target]").forEach(button => {
        button.innerHTML = passwordVisibleIcon;
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.passwordTarget);
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            button.innerHTML = showing ? passwordVisibleIcon : passwordHiddenIcon;
            button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        });
    });
}

function initializeSubjectDropdown() {
    const trigger = document.getElementById("subjectDropdownTrigger");
    const menu = document.getElementById("subjectDropdownMenu");
    const label = document.getElementById("subjectDropdownLabel");

    trigger.addEventListener("click", () => {
        const open = menu.classList.toggle("open");
        trigger.setAttribute("aria-expanded", String(open));
    });

    document.addEventListener("click", event => {
        if (!trigger.contains(event.target) && !menu.contains(event.target)) {
            menu.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
        }
    });

    menu.addEventListener("change", event => {
        const current = getSelectedSubjects();
        clearFieldError("subjectDropdownTrigger");
        label.textContent = formatSelectedSubjectLabel(current);
        label.classList.toggle("has-value", current.length > 0);
    });
}

function formatSelectedSubjectLabel(subjects) {
    if (!subjects.length) return "Select subjects you teach";
    if (subjects.length <= 3) return subjects.join(", ");
    return `${subjects.length} subjects selected`;
}

function initializeBioCounter() {
    const bio = document.getElementById("bio");
    const counter = document.getElementById("bioCounter");
    const update = () => {
        counter.textContent = `${bio.value.length}/500`;
    };
    bio.addEventListener("input", update);
    update();
}

function updatePasswordRules(password) {
    const rules = {
        length: password.length >= 8 && password.length <= 64,
        letter: /[A-Za-z]/.test(password),
        number: /\d/.test(password)
    };

    Object.entries(rules).forEach(([name, valid]) => {
        document.querySelector(`[data-rule="${name}"]`)?.classList.toggle("valid", valid);
    });
}

function getSelectedSubjects() {
    return Array.from(document.querySelectorAll("#subjectDropdownMenu input[type='checkbox']:checked"))
        .map(checkbox => checkbox.value);
}

function setBirthdayLimit() {
    const birthday = document.getElementById("birthday");
    birthday.max = formatDateInput(new Date());
    birthday.removeAttribute("min");
}

function parseLocalDate(value) {
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const error = document.querySelector(`[data-error-for="${fieldId}"]`);
    field?.classList.add("input-invalid");
    field?.setAttribute("aria-invalid", "true");
    if (error) error.textContent = message;
}

function clearFieldError(fieldId) {
    if (!fieldId) return;
    const field = document.getElementById(fieldId);
    const error = document.querySelector(`[data-error-for="${fieldId}"]`);
    field?.classList.remove("input-invalid");
    field?.removeAttribute("aria-invalid");
    if (error) error.textContent = "";
}

function clearFormErrors(form) {
    form.querySelectorAll(".input-invalid").forEach(field => {
        field.classList.remove("input-invalid");
        field.removeAttribute("aria-invalid");
    });
    form.querySelectorAll(".field-error").forEach(error => {
        error.textContent = "";
    });
}

function focusFirstInvalid(form) {
    form.querySelector(".input-invalid")?.focus();
}

function setSubmitting(form, submitting, busyText = "Creating account...") {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (submitting) {
        button.dataset.originalText = button.textContent;
        button.textContent = busyText;
    } else {
        button.textContent = button.dataset.originalText || "Submit";
    }

    button.disabled = submitting;
}

function showMessage(message, type) {
    accountMessage.textContent = message;
    accountMessage.className = type === "success" ? "message-success" : "message-error";
}

function clearMessage() {
    accountMessage.textContent = "";
    accountMessage.className = "";
}
