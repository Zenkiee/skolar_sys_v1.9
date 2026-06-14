const params = new URLSearchParams(window.location.search);
const selectedRole = params.get("role") || "learner";

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

let tempAccount = null;

roleTitle.textContent = selectedRole === "tutor" ? "Tutor Sign Up" : "Learner Sign Up";

if (goToLogin) {
    goToLogin.href = `/Home/Account?role=${selectedRole}`;
}

const termsLink = document.getElementById("termsLink");
if (termsLink) {
    termsLink.href = selectedRole === "tutor"
        ? "/Home/TermsTutor"
        : "/Home/TermsLearner";
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

function showProfileStep() {
    basicSignupForm.classList.remove("active");

    stepOneCircle.classList.add("done");
    stepTwoCircle.classList.add("active");
    stepLabel.textContent = "Create Profile";

    signupBox.classList.add("profile-mode");

    if (selectedRole === "tutor") {
        tutorProfileForm.classList.add("active");
        roleTitle.textContent = "Create Tutor Profile";
    } else {
        learnerProfileForm.classList.add("active");
        roleTitle.textContent = "Create Learner Profile";
    }

    accountMessage.textContent = "";
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
    accountMessage.textContent = "";
}

/* STEP 1: BASIC SIGN UP */
basicSignupForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        accountMessage.textContent = "Passwords do not match.";
        accountMessage.style.color = "#ffb3b3";
        return;
    }

    tempAccount = { email, password };
    showProfileStep();
});

/* STEP 2A: LEARNER PROFILE */
if (learnerProfileForm) {
    learnerProfileForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const name = document.getElementById("learnerName").value.trim();

        try {
            const response = await fetch("/Home/Signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name,
                    email: tempAccount.email,
                    password: tempAccount.password,
                    role: "learner",
                    learnerProfile: {
                        gradeLevel: document.getElementById("yearLevel").value,
                        school: document.getElementById("school").value,
                        birthday: document.getElementById("birthday").value
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                accountMessage.textContent = data.error || "Signup failed.";
                accountMessage.style.color = "#ffb3b3";
                return;
            }

            accountMessage.textContent = "Profile created successfully!";
            accountMessage.style.color = "#b6ffb6";

            setTimeout(() => {
                window.location.href = "/Learner/LearnerPortal";
            }, 800);

        } catch (err) {
            accountMessage.textContent = "Something went wrong. Please try again.";
            accountMessage.style.color = "#ffb3b3";
        }
    });
}

/* STEP 2B: TUTOR PROFILE */
tutorProfileForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const tutorProfile = {
        rate: document.getElementById("rate").value.trim(),
        education: document.getElementById("education").value.trim(),
        contactNumber: document.getElementById("contactNumber").value.trim(),
        bio: document.getElementById("bio").value.trim(),
        subjects: document.getElementById("tutorSubjects")?.value.trim() || ""
    };

    try {
        const response = await fetch("/Home/Signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("tutorName").value.trim(),
                email: tempAccount.email,
                password: tempAccount.password,
                role: "tutor",
                tutorProfile: tutorProfile
            })
        });

        const data = await response.json();

        if (!response.ok) {
            accountMessage.textContent = data.error || "Signup failed.";
            accountMessage.style.color = "#ffb3b3";
            return;
        }

        accountMessage.textContent = "Profile created successfully!";
        accountMessage.style.color = "#b6ffb6";

        setTimeout(() => {
            window.location.href = "/Tutor/TutorDashboard";
        }, 800);

    } catch (err) {
        accountMessage.textContent = "Something went wrong. Please try again.";
        accountMessage.style.color = "#ffb3b3";
    }
});