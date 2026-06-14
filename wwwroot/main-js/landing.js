function toggleLandingMenu() {
    const navMenu = document.getElementById("navMenu");
    navMenu.classList.toggle("active");
}

function toggleFaq(button) {
    const faqItem = button.parentElement;

    document.querySelectorAll(".faq-item").forEach(item => {
        if (item !== faqItem) {
            item.classList.remove("active");
        }
    });

    faqItem.classList.toggle("active");
}