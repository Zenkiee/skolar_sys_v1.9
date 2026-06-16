document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("identityForm");
  const statusBox = document.getElementById("identityStatus");
  const message = document.getElementById("identityMessage");
  const submitButton = document.getElementById("submitIdentity");
  const birthdateInput = document.getElementById("birthdate");
  const documentFile = document.getElementById("documentFile");
  const selfieFile = document.getElementById("selfieFile");
  const documentFileState = document.getElementById("documentFileState");
  const selfieFileState = document.getElementById("selfieFileState");
  let currentStatus = "Pending";

  const allowedTypes = new Set([
    "National ID",
    "Passport",
    "Driver's License",
    "UMID",
    "PRC ID",
    "School ID"
  ]);

  if (birthdateInput) birthdateInput.max = formatDateInput(new Date());

  loadVerification();

  form?.addEventListener("submit", submitVerification);
  documentFile?.addEventListener("change", () => updateFileState(documentFile, documentFileState));
  selfieFile?.addEventListener("change", () => updateFileState(selfieFile, selfieFileState));

  async function loadVerification() {
    try {
      const response = await fetch("/Tutor/MyIdentityVerification", { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      setValue("legalName", data.identityLegalName);
      setValue("birthdate", data.identityBirthdate);
      setValue("documentType", data.identityDocumentType);
      setValue("documentNumber", data.identityDocumentNumber);

      if (data.hasDocumentFile) documentFileState.textContent = "ID document already uploaded.";
      if (data.hasSelfieFile) selfieFileState.textContent = "Verification selfie already uploaded.";

      renderStatus(data.identityVerificationStatus);
      if (data.identityVerificationStatus === "Rejected" && data.identityVerificationNote) {
        setMessage(data.identityVerificationNote, true);
      }
    } catch (error) {
      setMessage("Could not load verification status.", true);
    }
  }

  async function submitVerification(event) {
    event.preventDefault();
    clearErrors();
    setMessage("", false);

    if (isFormLocked()) {
      setMessage(
        currentStatus === "Verified"
          ? "Your identity verification is already approved."
          : "Your identity verification is already under admin review. Please wait for the admin decision before resubmitting.",
        currentStatus !== "Verified");
      return;
    }

    const validation = validateForm();
    if (validation) {
      setFieldError(validation.field, validation.message);
      document.getElementById(validation.field)?.focus();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
      const response = await fetch("/Tutor/SubmitIdentityVerification", {
        method: "POST",
        body: new FormData(form)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.field) setFieldError(result.field, result.message || "Check this field.");
        setMessage(result.message || "Could not submit verification.", true);
        return;
      }

      renderStatus(result.status);
      setMessage(result.message || "Identity verification submitted for review.", false);
      window.setTimeout(() => {
        window.location.href = "/Tutor/TutorDashboard";
      }, 900);
    } catch (error) {
      setMessage("Something went wrong. Please try again.", true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit Verification";
    }
  }

  function validateForm() {
    const legalName = getValue("legalName");
    const birthdate = getValue("birthdate");
    const documentType = getValue("documentType");
    const documentNumber = getValue("documentNumber");

    if (legalName.length < 2 || legalName.length > 120 || !/[A-Za-z]/.test(legalName)) {
      return { field: "legalName", message: "Enter your full legal name." };
    }

    const parsedBirthdate = parseLocalDate(birthdate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!parsedBirthdate || parsedBirthdate > today) {
      return { field: "birthdate", message: "Enter a valid birthdate." };
    }

    if (!allowedTypes.has(documentType)) {
      return { field: "documentType", message: "Choose a valid ID type." };
    }

    if (documentNumber.length < 4 || documentNumber.length > 40) {
      return { field: "documentNumber", message: "Enter a valid ID number." };
    }

    const documentValidation = validateFile(documentFile, ["jpg", "jpeg", "png", "webp", "pdf"]);
    if (documentValidation) return { field: "documentFile", message: documentValidation };

    const selfieValidation = validateFile(selfieFile, ["jpg", "jpeg", "png", "webp"]);
    if (selfieValidation) return { field: "selfieFile", message: selfieValidation };

    return null;
  }

  function validateFile(input, extensions) {
    const file = input?.files?.[0];
    if (!file) return "";

    if (file.size > 8 * 1024 * 1024) return "Files must be 8 MB or smaller.";

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!extensions.includes(extension)) {
      return `Use ${extensions.join(", ").toUpperCase()} files only.`;
    }

    return "";
  }

  function renderStatus(status) {
    currentStatus = status || "Pending";
    const verified = status === "Verified";
    statusBox.classList.toggle("verified", verified);
    if (verified) {
      statusBox.textContent = "Identity verified. Your tutor profile can now appear in learner search.";
    } else if (status === "Under Review") {
      statusBox.textContent = "Identity verification is under admin review. Your tutor profile is not publicly shown yet.";
    } else if (status === "Rejected") {
      statusBox.textContent = "Identity verification needs resubmission before your tutor profile can appear in learner search.";
    } else {
      statusBox.textContent = "Identity verification is required before your tutor profile appears in learner search.";
    }

    setFormLocked(status === "Under Review" || verified);
  }

  function setFormLocked(locked) {
    form?.querySelectorAll("input, select").forEach(field => {
      field.disabled = locked;
    });

    if (!submitButton) return;
    submitButton.disabled = locked;
    submitButton.hidden = locked;
    submitButton.textContent = locked ? "Submitted for Review" : "Submit Verification";
  }

  function isFormLocked() {
    return currentStatus === "Under Review" || currentStatus === "Verified";
  }

  function updateFileState(input, target) {
    const file = input?.files?.[0];
    if (!target || !file) return;
    target.textContent = `${file.name} selected.`;
    clearFieldError(input.id);
  }

  function setFieldError(fieldId, text) {
    const field = document.getElementById(fieldId);
    const error = document.querySelector(`[data-error-for="${fieldId}"]`);
    field?.classList.add("input-invalid");
    field?.setAttribute("aria-invalid", "true");
    if (error) error.textContent = text;
  }

  function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const error = document.querySelector(`[data-error-for="${fieldId}"]`);
    field?.classList.remove("input-invalid");
    field?.removeAttribute("aria-invalid");
    if (error) error.textContent = "";
  }

  function clearErrors() {
    form.querySelectorAll(".input-invalid").forEach(field => {
      field.classList.remove("input-invalid");
      field.removeAttribute("aria-invalid");
    });
    form.querySelectorAll(".identity-error").forEach(error => {
      error.textContent = "";
    });
  }

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || "";
  }

  function getValue(id) {
    return document.getElementById(id)?.value.trim() || "";
  }

  function parseLocalDate(value) {
    const parts = value.split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function formatDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
});
