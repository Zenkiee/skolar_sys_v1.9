const agreeCheckbox = document.getElementById("agreeCheckbox");
const continueBtn = document.getElementById("continueBtn");

agreeCheckbox.addEventListener("change", function () {
    continueBtn.disabled = !agreeCheckbox.checked;
});

continueBtn.addEventListener("click", function () {
    localStorage.setItem("contractAccepted", "true");
    window.location.href = "/Learner/LearnerPortal";
});