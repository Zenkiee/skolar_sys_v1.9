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
const stepOneCircle = document.getElementById("stepOneCircle");
const stepTwoCircle = document.getElementById("stepTwoCircle");
const stepLabel = document.getElementById("stepLabel");
const allowedYearLevels = ["Preschool", "Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
let tempAccount = null;

initializePage();

function initializePage() {
    roleTitle.textContent = selectedRole === "tutor" ? "Tutor Sign Up" : "Learner Sign Up";
    goToLogin.href = `/Home/Account?role=${selectedRole}`;

    const termsLink = document.getElementById("termsLink");
    termsLink.href = selectedRole === "tutor" ? "/Home/TermsTutor" : "/Home/TermsLearner";

    setBirthdayLimit();
    initializePasswordToggles();
    initializeValidationEvents();
    initializeSubjectDropdown();
    initializeBioCounter();

    document.querySelectorAll("[data-back-to-account]").forEach(button => {
        button.addEventListener("click", goBackToSignup);
    });

    basicSignupForm.addEventListener("submit", handleBasicSignup);
    learnerProfileForm.addEventListener("submit", handleLearnerSignup);
    tutorProfileForm.addEventListener("submit", handleTutorSignup);
}

function showProfileStep() {
    clearMessage();
    basicSignupForm.classList.remove("active");
    learnerProfileForm.classList.remove("active");
    tutorProfileForm.classList.remove("active");
    stepOneCircle.classList.add("done");
    stepTwoCircle.classList.add("active");
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
    learnerProfileForm.classList.remove("active");
    tutorProfileForm.classList.remove("active");
    basicSignupForm.classList.add("active");
    stepOneCircle.classList.remove("done");
    stepTwoCircle.classList.remove("active");
    stepLabel.textContent = "Basic Account";
    signupBox.classList.remove("profile-mode");
    roleTitle.textContent = selectedRole === "tutor" ? "Tutor Sign Up" : "Learner Sign Up";
    clearMessage();
    document.getElementById("signupEmail").focus();
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
    const contactNumber = document.getElementById("contactNumber").value.trim().replace(/[\s-]/g, "");
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

    if (!/^(09\d{9}|\+639\d{9})$/.test(contactNumber)) {
        setFieldError("contactNumber", "Use 09XXXXXXXXX or +639XXXXXXXXX.");
        valid = false;
    }

    if (bio.length < 20 || bio.length > 500) {
        setFieldError("bio", "Bio must be 20 to 500 characters.");
        valid = false;
    }

    if (subjects.length < 1 || subjects.length > 5) {
        setFieldError("subjectDropdownTrigger", "Choose 1 to 5 subjects.");
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
    }, "/Tutor/TutorDashboard");
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

        showMessage("Profile created successfully!", "success");
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 700);
    } catch (error) {
        showMessage("Something went wrong. Please try again.", "error");
    } finally {
        setSubmitting(form, false);
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
    document.querySelectorAll("[data-password-target]").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.passwordTarget);
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            button.textContent = showing ? "👁" : "🙈";
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
        const selected = getSelectedSubjects();
        if (selected.length > 5) {
            event.target.checked = false;
            setFieldError("subjectDropdownTrigger", "You can select up to 5 subjects.");
        } else {
            clearFieldError("subjectDropdownTrigger");
        }

        const current = getSelectedSubjects();
        label.textContent = current.length ? current.join(", ") : "Select subjects you teach";
        label.classList.toggle("has-value", current.length > 0);
    });
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

function setSubmitting(form, submitting) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (submitting) {
        button.dataset.originalText = button.textContent;
        button.textContent = "Creating account...";
    } else {
        button.textContent = button.dataset.originalText || "Create Profile";
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
