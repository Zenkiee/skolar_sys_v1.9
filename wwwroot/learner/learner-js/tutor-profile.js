const params = new URLSearchParams(window.location.search);
const tutorId = parseInt(params.get("id"));

const profilePanel = document.getElementById("profilePanel");
const calendarMonth = document.getElementById("calendarMonth");
const calendarDays = document.getElementById("calendarDays");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const bookSessionBtn = document.getElementById("bookSessionBtn");

let tutor = null;
let selectedDate = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Load tutor data from your existing /Tutor/GetProfile?id= endpoint
async function loadTutor() {
    const res = await fetch(`/Tutor/GetProfile?id=${tutorId}`);
    if (!res.ok) {
        profilePanel.innerHTML = `<p style="color:red">Tutor not found.</p>`;
        return;
    }
    tutor = await res.json();

    // Set calendar to first available date if any
    if (tutor.availableDates && tutor.availableDates.length > 0) {
        const parts = tutor.availableDates[0].split("-");
        currentYear = parseInt(parts[0]);
        currentMonth = parseInt(parts[1]) - 1;
    }

    // Wire Book Session button
    bookSessionBtn.href = `/Learner/Booking?tutorId=${tutor.id}&tutorName=${encodeURIComponent(tutor.tutorName)}`;

    renderTutorProfile();
    renderCalendar();
}

function renderTutorProfile() {
    const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
    const avgRating = tutor.reviews && tutor.reviews.length > 0
        ? Math.round(tutor.reviews.reduce((sum, r) => sum + r.rating, 0) / tutor.reviews.length)
        : 5;

    const subjectRows = (tutor.subjects || "").split(",").map(s =>
        `<tr><td>${s.trim()}</td><td>${tutor.rate}</td></tr>`
    ).join("");

    const reviewsHtml = (tutor.reviews || []).map(r => `
        <div class="review-item">
            <div class="review-avatar">${r.learnerName?.charAt(0) ?? "U"}</div>
            <div class="review-content">
                <strong>${r.learnerName}</strong>
                <small>${new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</small>
                <p class="review-stars">${stars(r.rating)}</p>
                <p>${r.comment}</p>
            </div>
        </div>
    `).join("");

    // ← THE ONLY CHANGE: use tutor.profilePhoto if it exists, otherwise fall back to default
    const tutorName =
            String(tutor.tutorName || "Tutor").trim();

    const tutorInitial =
        tutorName.charAt(0).toUpperCase() || "T";

    const profilePhoto =
        String(tutor.profilePhoto || "").trim();

    const avatarHtml = profilePhoto
        ? `
            <img
                src="${profilePhoto}"
                alt="${tutorName}"
                class="tutor-avatar">
        `
        : `
            <div
                class="tutor-avatar tutor-avatar-initial"
                aria-label="${tutorName}">
                ${tutorInitial}
            </div>
        `;

    profilePanel.innerHTML = `
        <div class="profile-top">
            <div class="profile-main">
                ${avatarHtml}
                <div class="profile-details">
                    <h2>${tutor.tutorName}</h2>
                    <p>${tutor.education ?? ""}</p>
                    <p>✉ ${tutor.email ?? ""}</p>
                    <p>☎ ${tutor.contactNumber ?? ""}</p>
                </div>
            </div>
            <p class="profile-rate">${tutor.rate}</p>
        </div>
        <div class="stars">${stars(avgRating)}</div>
        <span class="completed-lessons">${tutor.completedLessons ?? 0} Completed Lessons</span>
        <div class="info-section">
            <h3>About Me</h3>
            <p>${tutor.bio}</p>
        </div>
        <div class="info-section">
            <h3>Ratings & Reviews</h3>
            <div class="rating-summary">
                <span class="rating-number">${avgRating}</span>
                <div>
                    <div class="stars">${stars(avgRating)}</div>
                    <strong>${tutor.reviews?.length ?? 0} reviews</strong>
                </div>
            </div>
            ${reviewsHtml}
        </div>
        <div class="info-section">
            <h3>General Availability</h3>
            <p>🗓 Monday - Friday</p>
            <p>⏰ Flexible Hours</p>
        </div>
        <div class="info-section">
            <h3>Subjects Offered</h3>
            <table class="subject-table">
                <thead><tr><th>Subjects</th><th>Price</th></tr></thead>
                <tbody>${subjectRows}</tbody>
            </table>
        </div>
    `;
}

function renderCalendar() {
    const monthNames = ["January","February","March","April","May","June",
        "July","August","September","October","November","December"];
    calendarMonth.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    calendarDays.innerHTML = "";

    const availableDates = tutor?.availableDates ?? [];
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    let startDay = firstDay.getDay();
    startDay = startDay === 0 ? 6 : startDay - 1;
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

    for (let i = startDay - 1; i >= 0; i--) {
        const btn = document.createElement("button");
        btn.textContent = prevMonthLastDay - i;
        btn.className = "muted";
        calendarDays.appendChild(btn);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const dateStr = formatDateKey(currentYear, currentMonth, day);
        const btn = document.createElement("button");
        btn.textContent = day;
        if (availableDates.includes(dateStr)) {
            btn.classList.add("available");
            btn.addEventListener("click", () => { selectedDate = dateStr; renderCalendar(); });
        }
        if (selectedDate === dateStr) {
            btn.classList.remove("available");
            btn.classList.add("selected");
        }
        calendarDays.appendChild(btn);
    }

    const remaining = 42 - calendarDays.children.length;
    for (let day = 1; day <= remaining; day++) {
        const btn = document.createElement("button");
        btn.textContent = day;
        btn.className = "muted";
        calendarDays.appendChild(btn);
    }
}

prevMonthBtn.addEventListener("click", () => {
    currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar();
});
nextMonthBtn.addEventListener("click", () => {
    currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar();
});

function formatDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

loadTutor();