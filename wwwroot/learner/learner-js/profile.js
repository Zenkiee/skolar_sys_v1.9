let selectedProfilePhoto = null;

// Elements
const learnerProfileForm = document.getElementById("learnerProfileForm");
const profilePhotoInput = document.getElementById("profilePhotoInput");
const uploadProfilePhotoButton = document.getElementById("uploadProfilePhotoButton");
const removeProfilePhotoButton = document.getElementById("removeProfilePhotoButton");
const profileAccountManager = document.getElementById("profileAccountManager");
const guardianFields = document.getElementById("guardianFields");
const profileLearningGoals = document.getElementById("profileLearningGoals");
const learningGoalsCount = document.getElementById("learningGoalsCount");

// Profile
async function loadLearnerProfile() {
    try {
        const response = await fetch("/Learner/GetProfile", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load the learner profile.");

        const profile = await response.json();

        setProfileValue("profileName", profile.name);
        setProfileValue("profileEmail", profile.email);
        setProfileValue("profileBirthday", profile.birthday);
        setProfileValue("profileGradeLevel", profile.gradeLevel);
        setProfileValue("profileSchool", profile.school);
        setProfileValue("profileContact", profile.contactNumber);
        setProfileValue("profileAccountManager", profile.accountManager || "Learner");
        setProfileValue("guardianName", profile.guardianName);
        setProfileValue("guardianRelationship", profile.guardianRelationship);
        setProfileValue("guardianEmail", profile.guardianEmail);
        setProfileValue("guardianContact", profile.guardianContactNumber);
        setProfileValue("profilePreferredSchedule", profile.preferredSchedule);
        setProfileValue("profileLearningGoals", profile.learningGoals);

        document.querySelectorAll("#profileSubjects input[type='checkbox']").forEach(input => {
            input.checked = (profile.subjects || []).includes(input.value);
        });

        updateAccountManagerFields();
        updateLearningGoalsCount();
        updateLearnerIdentity(profile.name, profile.profilePhoto);
    } catch (error) {
        setProfileMessage(error.message, "error");
    }
}

async function saveLearnerProfile(event) {
    event.preventDefault();
    clearProfileErrors();

    const request = getProfileRequest();
    const validation = validateProfile(request);

    if (!validation.valid) {
        showProfileError(validation.field, validation.message);
        return;
    }

    const saveButton = document.getElementById("saveProfileButton");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        const response = await fetch("/Learner/SaveProfile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (result.field) showProfileError(result.field, result.message || "Check this field.");
            throw new Error(result.message || "Could not save the profile.");
        }

        updateLearnerIdentity(result.name || request.name, result.profilePhoto || "");
        setProfileMessage(result.message || "Profile updated successfully.", "success");
    } catch (error) {
        setProfileMessage(error.message, "error");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}

function getProfileRequest() {
    return {
        name: getProfileValue("profileName"),
        gradeLevel: getProfileValue("profileGradeLevel"),
        school: getProfileValue("profileSchool"),
        birthday: getProfileValue("profileBirthday"),
        contactNumber: getProfileValue("profileContact"),
        accountManager: getProfileValue("profileAccountManager"),
        guardianName: getProfileValue("guardianName"),
        guardianRelationship: getProfileValue("guardianRelationship"),
        guardianEmail: getProfileValue("guardianEmail"),
        guardianContactNumber: getProfileValue("guardianContact"),
        subjects: Array.from(document.querySelectorAll("#profileSubjects input:checked"))
            .map(input => input.value),
        learningGoals: getProfileValue("profileLearningGoals"),
        preferredSchedule: getProfileValue("profilePreferredSchedule")
    };
}

function validateProfile(profile) {
    if (profile.name.length < 2 || profile.name.length > 60 || !/[A-Za-z]/.test(profile.name)) {
        return { valid: false, field: "profileName", message: "Name must be 2 to 60 characters and contain a letter." };
    }

    if (!profile.birthday) {
        return { valid: false, field: "profileBirthday", message: "Enter the learner's birthdate." };
    }

    const birthday = new Date(`${profile.birthday}T00:00:00`);
    if (Number.isNaN(birthday.getTime()) || birthday > new Date()) {
        return { valid: false, field: "profileBirthday", message: "Birthdate cannot be in the future." };
    }

    if (!profile.gradeLevel) {
        return { valid: false, field: "profileGradeLevel", message: "Select the learner's year level." };
    }

    if (profile.school.length > 100) {
        return { valid: false, field: "profileSchool", message: "School must be 100 characters or fewer." };
    }

    if (profile.contactNumber && !isValidPhilippineContact(profile.contactNumber)) {
        return { valid: false, field: "profileContact", message: "Use 09XXXXXXXXX or +639XXXXXXXXX." };
    }

    if (profile.accountManager === "Guardian") {
        if (profile.guardianName.length < 2) {
            return { valid: false, field: "guardianName", message: "Enter the parent or guardian's name." };
        }

        if (profile.guardianRelationship.length < 2) {
            return { valid: false, field: "guardianRelationship", message: "Enter the relationship to the learner." };
        }

        if (!isValidEmail(profile.guardianEmail)) {
            return { valid: false, field: "guardianEmail", message: "Enter a valid parent or guardian email." };
        }

        if (!isValidPhilippineContact(profile.guardianContactNumber)) {
            return { valid: false, field: "guardianContact", message: "Use 09XXXXXXXXX or +639XXXXXXXXX." };
        }
    }

    if (profile.subjects.length > 5) {
        return { valid: false, field: "profileSubjects", message: "Choose up to five subjects." };
    }

    if (profile.learningGoals.length > 500) {
        return { valid: false, field: "profileLearningGoals", message: "Learning goals must be 500 characters or fewer." };
    }

    return { valid: true };
}

// Photo
function previewProfilePhoto() {
    const file = profilePhotoInput.files[0];
    selectedProfilePhoto = null;
    setProfilePhotoError("");

    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        profilePhotoInput.value = "";
        setProfilePhotoError("Use a JPG, PNG, or WebP image.");
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        profilePhotoInput.value = "";
        setProfilePhotoError("Profile image must be 5 MB or smaller.");
        return;
    }

    selectedProfilePhoto = file;
    const reader = new FileReader();

    reader.addEventListener("load", () => {
        setProfilePhoto(reader.result);
    });

    reader.readAsDataURL(file);
}

async function uploadProfilePhoto() {
    if (!selectedProfilePhoto) {
        setProfilePhotoError("Choose a profile image first.");
        return;
    }

    const formData = new FormData();
    formData.append("photo", selectedProfilePhoto);

    uploadProfilePhotoButton.disabled = true;
    uploadProfilePhotoButton.textContent = "Uploading...";

    try {
        const response = await fetch("/Learner/UploadProfilePhoto", {
            method: "POST",
            body: formData
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not upload the profile photo.");

        selectedProfilePhoto = null;
        profilePhotoInput.value = "";
        setProfilePhoto(result.photoUrl);
        setSidebarPhoto(result.photoUrl);
        setProfileMessage(result.message || "Profile photo updated.", "success");
    } catch (error) {
        setProfilePhotoError(error.message);
    } finally {
        uploadProfilePhotoButton.disabled = false;
        uploadProfilePhotoButton.textContent = "Upload Photo";
    }
}

async function removeProfilePhoto() {
    const confirmed = await SkolarDialog.confirm(
        "Remove your current profile photo and use your name initial instead?",
        {
            title: "Remove profile photo?",
            type: "danger",
            confirmText: "Remove Photo"
        }
    );

    if (!confirmed) return;

    removeProfilePhotoButton.disabled = true;
    removeProfilePhotoButton.textContent = "Removing...";

    try {
        const response = await fetch("/Learner/RemoveProfilePhoto", { method: "POST" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not remove the profile photo.");

        selectedProfilePhoto = null;
        profilePhotoInput.value = "";
        updateLearnerIdentity(getProfileValue("profileName") || "Learner", "");
        setProfilePhotoError("");
        setProfileMessage(result.message || "Profile photo removed.", "success");
    } catch (error) {
        setProfilePhotoError(error.message);
    } finally {
        removeProfilePhotoButton.disabled = false;
        removeProfilePhotoButton.textContent = "Remove Photo";
    }
}

// Helpers
function updateAccountManagerFields() {
    if (!guardianFields || !profileAccountManager) return;
    guardianFields.hidden = profileAccountManager.value !== "Guardian";
}

function updateLearningGoalsCount() {
    if (!profileLearningGoals || !learningGoalsCount) return;
    learningGoalsCount.textContent = profileLearningGoals.value.length;
}

function updateLearnerIdentity(name, photoUrl) {
    const safeName = name || "Learner";
    const learnerName = document.getElementById("learnerName");
    const learnerGreeting = document.getElementById("learnerGreeting");
    const profilePhotoInitial = document.getElementById("profilePhotoInitial");
    const initial = safeName.charAt(0).toUpperCase();

    if (learnerName) learnerName.textContent = safeName;
    if (learnerGreeting) learnerGreeting.textContent = `Welcome back, ${safeName}!`;
    if (profilePhotoInitial) profilePhotoInitial.textContent = initial;

    window._currentUserName = safeName;

    if (photoUrl) {
        setProfilePhoto(photoUrl);
        setSidebarPhoto(photoUrl);
    } else {
        clearProfilePhoto(initial);
        clearSidebarPhoto(initial);
    }
}

function setProfilePhoto(photoUrl) {
    const image = document.getElementById("profilePhotoImage");
    const initial = document.getElementById("profilePhotoInitial");
    if (!image || !initial) return;

    const fallbackInitial = getProfileInitial();
    clearProfilePhoto(fallbackInitial);
    image.onerror = () => clearProfilePhoto(fallbackInitial);
    image.onload = () => {
        image.hidden = false;
        initial.hidden = true;
    };
    image.src = photoUrl;
}

function clearProfilePhoto(initialText) {
    const image = document.getElementById("profilePhotoImage");
    const initial = document.getElementById("profilePhotoInitial");
    if (!image || !initial) return;

    image.hidden = true;
    image.removeAttribute("src");
    initial.hidden = false;
    initial.textContent = initialText;
}

function setSidebarPhoto(photoUrl) {
    const image = document.getElementById("learnerSidebarPhoto");
    const initial = document.getElementById("learnerInitial");
    if (!image || !initial) return;

    const fallbackInitial = getProfileInitial();
    clearSidebarPhoto(fallbackInitial);
    image.onerror = () => clearSidebarPhoto(fallbackInitial);
    image.onload = () => {
        image.hidden = false;
        initial.hidden = true;
    };
    image.src = photoUrl;
}

function getProfileInitial() {
    const name = document.getElementById("profileName")?.value.trim() ||
        document.getElementById("learnerName")?.textContent.trim() ||
        "Learner";
    return name.charAt(0).toUpperCase();
}

function clearSidebarPhoto(initialText) {
    const image = document.getElementById("learnerSidebarPhoto");
    const initial = document.getElementById("learnerInitial");
    if (!image || !initial) return;

    image.hidden = true;
    image.removeAttribute("src");
    initial.hidden = false;
    initial.textContent = initialText;
}

function setProfileValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? "";
}

function getProfileValue(id) {
    return document.getElementById(id)?.value.trim() ?? "";
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhilippineContact(value) {
    const contact = value.replace(/[\s-]/g, "");
    return /^09\d{9}$/.test(contact) || /^\+639\d{9}$/.test(contact);
}

function clearProfileErrors() {
    document.querySelectorAll(".profile-field").forEach(field => {
        field.classList.remove("has-error");
    });

    document.querySelectorAll("[data-error-for]").forEach(error => {
        error.textContent = "";
    });

    setProfileMessage("", "");
}

function showProfileError(fieldId, message) {
    const error = document.querySelector(`[data-error-for="${fieldId}"]`);
    const field = document.getElementById(fieldId);

    if (error) error.textContent = message;
    if (field) {
        field.closest(".profile-field")?.classList.add("has-error");
        field.focus();
    }

    setProfileMessage(message, "error");
}

function setProfileMessage(message, type) {
    const element = document.getElementById("profileMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `profile-message${type ? ` ${type}` : ""}`;
}

function setProfilePhotoError(message) {
    const error = document.getElementById("profilePhotoError");
    if (error) error.textContent = message;
}

// Events
if (learnerProfileForm) {
    learnerProfileForm.addEventListener("submit", saveLearnerProfile);
}

if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", previewProfilePhoto);
}

if (uploadProfilePhotoButton) {
    uploadProfilePhotoButton.addEventListener("click", uploadProfilePhoto);
}

if (removeProfilePhotoButton) {
    removeProfilePhotoButton.addEventListener("click", removeProfilePhoto);
}

if (profileAccountManager) {
    profileAccountManager.addEventListener("change", updateAccountManagerFields);
}

if (profileLearningGoals) {
    profileLearningGoals.addEventListener("input", updateLearningGoalsCount);
}

const profileNameInput = document.getElementById("profileName");
if (profileNameInput) {
    profileNameInput.addEventListener("input", () => {
        const initial = profileNameInput.value.trim().charAt(0).toUpperCase() || "L";
        const profileImage = document.getElementById("profilePhotoImage");
        const sidebarImage = document.getElementById("learnerSidebarPhoto");

        if (!profileImage || profileImage.hidden) {
            const profileInitial = document.getElementById("profilePhotoInitial");
            if (profileInitial) profileInitial.textContent = initial;
        }

        if (!sidebarImage || sidebarImage.hidden) {
            const sidebarInitial = document.getElementById("learnerInitial");
            if (sidebarInitial) sidebarInitial.textContent = initial;
        }
    });
}

document.querySelectorAll("#profileSubjects input[type='checkbox']").forEach(input => {
    input.addEventListener("change", () => {
        const selected = document.querySelectorAll("#profileSubjects input:checked");
        if (selected.length > 5) {
            input.checked = false;
            showProfileError("profileSubjects", "Choose up to five subjects.");
        } else {
            const error = document.querySelector('[data-error-for="profileSubjects"]');
            if (error) error.textContent = "";
        }
    });
});

document.addEventListener("DOMContentLoaded", loadLearnerProfile);
