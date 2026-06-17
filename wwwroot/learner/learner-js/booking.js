const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const today = new Date();
let availabilityByDate = {};
let availableDatesFlat = [];
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let calendarReady = false;
let bookingType = "Single";
let selectedDate = null;
let rangeStart = null;
let rangeEnd = null;
let selectedDates = [];
let currentTutorRate = 0;
let currentBookingGroupId = null;
let currentCheckoutUrl = null;

// Calendar
function renderCalendar() {
    if (!calendarReady) return;

    const monthLabel = document.getElementById("calendarMonth");
    const calendar = document.getElementById("calendarDays");
    monthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    calendar.innerHTML = "";

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const previousMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let index = startOffset - 1; index >= 0; index--) {
        const filler = document.createElement("span");
        filler.className = "muted";
        filler.textContent = previousMonthDays - index;
        calendar.appendChild(filler);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObject = new Date(currentYear, currentMonth, day);
        const dateValue = toDateKey(dateObject);
        const isPast = dateObject < todayStart;
        const isAvailable = Boolean(availabilityByDate[dateValue]?.length);
        const isToday = dateObject.getTime() === todayStart.getTime();
        const isRangeBoundary = dateValue === rangeStart || dateValue === rangeEnd;
        const isSelectedSession = selectedDates.includes(dateValue);
        const dayElement = document.createElement("span");

        dayElement.textContent = day;
        if (isPast) dayElement.classList.add("unavailable");
        if (isAvailable && !isPast) dayElement.classList.add("available");
        if (isToday) dayElement.classList.add("today");

        if (bookingType === "Single" && selectedDate === dateValue) {
            dayElement.classList.add("selected");
        }

        if (bookingType === "Range" && !isPast) {
            dayElement.classList.add("range-selectable");
            if (isSelectedSession) dayElement.classList.add("range-selected");
            if (isRangeBoundary) dayElement.classList.add("range-edge");
        }

        const canSelect = !isPast && (bookingType === "Range" || isAvailable);
        if (canSelect) {
            dayElement.addEventListener("click", () => selectDate(dateValue));
        }

        calendar.appendChild(dayElement);
    }

    const totalCells = calendar.children.length;
    const targetCells = totalCells <= 35 ? 35 : 42;
    const remainingCells = targetCells - totalCells;

    for (let day = 1; day <= remainingCells; day++) {
        const filler = document.createElement("span");
        filler.className = "muted";
        filler.textContent = day;
        calendar.appendChild(filler);
    }
}

function changeMonth(direction) {
    currentMonth += direction;

    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }

    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }

    renderCalendar();
}

function selectDate(date) {
    if (bookingType === "Single") {
        selectedDate = date;
        rangeStart = null;
        rangeEnd = null;
        selectedDates = [date];
    } else if (!rangeStart || rangeEnd) {
        selectedDate = null;
        rangeStart = date;
        rangeEnd = null;
        selectedDates = availabilityByDate[date]?.length ? [date] : [];
    } else {
        const start = date < rangeStart ? date : rangeStart;
        const end = date < rangeStart ? rangeStart : date;
        rangeStart = start;
        rangeEnd = end;
        selectedDates = availableDatesFlat
            .filter(availableDate => availableDate >= start && availableDate <= end)
            .sort();
    }

    updateSelectionUI();
    renderCalendar();
}

function setBookingType(type) {
    bookingType = type;
    selectedDate = null;
    rangeStart = null;
    rangeEnd = null;
    selectedDates = [];

    document.querySelectorAll(".booking-type-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.bookingType === type);
    });

    document.getElementById("selectionGuide").textContent = type === "Single"
        ? "Choose one available date."
        : "Choose a start and end date. Unavailable dates inside the range will be skipped.";

    document.getElementById("summaryBookingType").textContent = type === "Single"
        ? "Single Day"
        : "Date Range";

    updateSelectionUI();
    renderCalendar();
}

function updateSelectionUI() {
    const scheduleText = getScheduleText();
    const sessionText = selectedDates.length === 1
        ? "1 session"
        : `${selectedDates.length} sessions`;
    const rangeCard = document.getElementById("rangeSelectionCard");
    const selectedList = document.getElementById("selectedDatesList");

    document.getElementById("summaryDate").textContent = scheduleText || "Not selected";
    document.getElementById("summarySessions").textContent = selectedDates.length ? sessionText : "Not selected";

    if (bookingType === "Range") {
        rangeCard.hidden = false;
        document.getElementById("rangeSelectionText").textContent = getRangeSelectionText();
        document.getElementById("selectedSessionCount").textContent = sessionText;
    } else {
        rangeCard.hidden = true;
    }

    selectedList.innerHTML = "";
    selectedList.hidden = selectedDates.length === 0;
    selectedDates.forEach(date => {
        const item = document.createElement("span");
        item.textContent = formatDate(date);
        selectedList.appendChild(item);
    });

    populateTimeSlots();
    updatePricingSummary();
}

function getRangeSelectionText() {
    if (!rangeStart) return "Choose a start date";
    if (!rangeEnd) return `Start: ${formatDate(rangeStart)} — choose an end date`;
    return `${formatDate(rangeStart)} to ${formatDate(rangeEnd)}`;
}

function getScheduleText() {
    if (bookingType === "Single") {
        return selectedDate ? formatDate(selectedDate) : "";
    }

    if (!rangeStart) return "";
    if (!rangeEnd) return `${formatDate(rangeStart)} — select end date`;
    return `${formatShortDate(rangeStart)} – ${formatDate(rangeEnd)}`;
}

function getCommonTimeSlots() {
    if (selectedDates.length === 0) return [];

    let commonSlots = [...(availabilityByDate[selectedDates[0]] || [])];
    selectedDates.slice(1).forEach(date => {
        const slots = new Set(availabilityByDate[date] || []);
        commonSlots = commonSlots.filter(slot => slots.has(slot));
    });

    return commonSlots;
}

function populateTimeSlots() {
    const select = document.getElementById("time");
    const help = document.getElementById("timeHelp");
    const slots = getCommonTimeSlots();

    select.innerHTML = "";
    document.getElementById("summaryTime").textContent = "Not selected";

    if (selectedDates.length === 0) {
        select.disabled = true;
        select.innerHTML = '<option value="">Select a schedule first</option>';
        help.textContent = "Times are set by the tutor for your selected schedule.";
        return;
    }

    if (slots.length === 0) {
        select.disabled = true;
        select.innerHTML = '<option value="">No shared time available</option>';
        help.textContent = bookingType === "Range"
            ? "Choose a shorter range. The selected dates do not share one open time slot."
            : "The tutor has no open time slots for this date.";
        return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">Choose time slot</option>';
    slots.forEach(slot => {
        const option = document.createElement("option");
        option.value = slot;
        option.textContent = slot;
        select.appendChild(option);
    });

    help.textContent = bookingType === "Range"
        ? `${slots.length} shared time slot${slots.length === 1 ? "" : "s"} across ${selectedDates.length} dates.`
        : `${slots.length} available time slot${slots.length === 1 ? "" : "s"}.`;
}

function goToDetails() {
    if (bookingType === "Single" && selectedDates.length !== 1) {
        SkolarDialog.alert("Please select an available date first.");
        return;
    }

    if (bookingType === "Range" && (!rangeStart || !rangeEnd)) {
        SkolarDialog.alert("Please select both a start date and an end date.");
        return;
    }

    if (bookingType === "Range" && selectedDates.length < 2) {
        SkolarDialog.alert("The selected range must contain at least two available dates.");
        return;
    }

    if (getCommonTimeSlots().length === 0) {
        SkolarDialog.alert("The selected dates do not share an available time slot.");
        return;
    }

    showStep("detailsStep");
}

function showStep(stepId) {
    document.querySelectorAll(".booking-step").forEach(step => step.classList.remove("active"));
    document.getElementById(stepId).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDate(dateString) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function formatShortDate(dateString) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    });
}

function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Availability
async function loadAvailability(tutorId) {
    const response = await fetch(`/Tutor/GetAvailability?tutorId=${tutorId}`);
    if (!response.ok) throw new Error("Could not load availability.");

    const availability = await response.json();
    availabilityByDate = Object.fromEntries(
        availability.map(day => [day.date, day.timeSlots || []])
    );
    availableDatesFlat = Object.keys(availabilityByDate).sort();
    calendarReady = true;

    if (bookingType === "Single" && selectedDate && !availabilityByDate[selectedDate]) {
        selectedDate = null;
        selectedDates = [];
    }

    if (bookingType === "Range" && rangeStart && rangeEnd) {
        selectedDates = availableDatesFlat.filter(date => date >= rangeStart && date <= rangeEnd);
    }

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const upcoming = availableDatesFlat
        .map(date => new Date(`${date}T00:00:00`))
        .filter(date => date >= todayStart)
        .sort((first, second) => first - second);

    if (upcoming.length > 0) {
        currentYear = upcoming[0].getFullYear();
        currentMonth = upcoming[0].getMonth();
    }

    updateSelectionUI();
    renderCalendar();
}

// Forms
function isValidBookingName(value) {
    const text = String(value || "").trim();
    return text.length >= 2 && text.length <= 60 && /[A-Za-z]/.test(text);
}

function isValidBookingEmail(value) {
    const text = String(value || "").trim();
    return text.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function isValidBookingContact(value) {
    return /^9\d{9}$/.test(toLocalPhoneDigits(value));
}

function toLocalPhoneDigits(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("63")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("09")) digits = digits.slice(1);
    return digits.slice(0, 10);
}

function toPhilippinePhoneNumber(value) {
    const localDigits = toLocalPhoneDigits(value);
    return /^9\d{9}$/.test(localDigits) ? `+63${localDigits}` : "";
}

function bindPhoneInputs() {
    document.querySelectorAll(".phone-prefix-field input").forEach(input => {
        input.value = toLocalPhoneDigits(input.value);
        input.addEventListener("input", () => {
            input.value = toLocalPhoneDigits(input.value);
        });
    });
}

function bindForms() {
    document.getElementById("detailsForm").addEventListener("submit", event => {
        event.preventDefault();

        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const email = document.getElementById("email").value.trim();
        const contact = document.getElementById("contact").value.trim();
        const subject = document.getElementById("subject").value;
        const time = document.getElementById("time").value;
        const fullName = `${firstName} ${lastName}`.trim();

        if (!isValidBookingName(firstName) || !isValidBookingName(lastName)) {
            SkolarDialog.alert("Enter a valid first and last name.");
            return;
        }

        if (!isValidBookingEmail(email)) {
            SkolarDialog.alert("Enter a valid email address.");
            return;
        }

        if (!isValidBookingContact(contact)) {
            SkolarDialog.alert("Enter the 10 digits after +63 for the contact number.");
            return;
        }

        if (!subject) {
            SkolarDialog.alert("Please choose a subject.");
            return;
        }

        if (!time) {
            SkolarDialog.alert("Please choose an available time slot.");
            return;
        }

        document.getElementById("summaryName").textContent = fullName;
        document.getElementById("summarySubject").textContent = subject;
        document.getElementById("summaryTime").textContent = time;
        document.getElementById("finalName").textContent = fullName;
        document.getElementById("finalDate").textContent = getScheduleText();
        document.getElementById("finalSessions").textContent = selectedDates.length === 1
            ? "1 session"
            : `${selectedDates.length} sessions`;
        document.getElementById("finalSubject").textContent = subject;
        document.getElementById("finalTime").textContent = time;
        document.getElementById("successPlural").textContent = selectedDates.length === 1 ? "" : "s";
        updatePricingSummary();

        showStep("paymentStep");
    });

    document.getElementById("paymentForm").addEventListener("submit", submitBooking);
}

async function submitBooking(event) {
    event.preventDefault();

    const submitButton = document.getElementById("proceedPaymentBtn");
    const user = await fetch("/Home/Me").then(response => response.ok ? response.json() : null);
    const tutorId = parseInt(new URLSearchParams(window.location.search).get("tutorId") || "0");
    const tutorName = document.getElementById("summaryTutorName")?.textContent || "";
    const formData = new FormData();

    formData.append("LearnerId", String(user?.id || 0));
    formData.append("TutorId", String(tutorId));
    formData.append("LearnerName", document.getElementById("summaryName").textContent);
    formData.append("LearnerEmail", document.getElementById("email").value);
    formData.append("LearnerContact", toPhilippinePhoneNumber(document.getElementById("contact").value));
    formData.append("Subject", document.getElementById("summarySubject").textContent);
    formData.append("TutorName", tutorName);
    formData.append("BookingType", bookingType);
    formData.append("Date", selectedDates[0] || "");
    selectedDates.forEach(date => formData.append("Dates", date));
    formData.append("Time", document.getElementById("summaryTime").textContent);

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
        const response = await fetch("/Learner/SubmitBooking", {
            method: "POST",
            body: formData
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(result.message || "Booking failed. Please try again.");

        currentBookingGroupId = result.bookingGroupId;
        currentCheckoutUrl = result.checkoutUrl;

        submitButton.textContent = "Redirecting...";
        window.location.href = result.checkoutUrl;
    } catch (error) {
        SkolarDialog.alert(error.message);
        submitButton.disabled = false;
        submitButton.textContent = "Proceed to Payment";

        if (String(error.message).includes("reserved") || String(error.message).includes("available")) {
            await loadAvailability(tutorId);
            showStep("dateStep");
        }
    }
}

async function cancelUnpaidBookingFlow() {
    if (!currentBookingGroupId) return;

    try {
        const response = await fetch("/Learner/CancelUnpaidBooking", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ bookingGroupId: currentBookingGroupId })
        });
        if (response.ok) {
            window.location.href = "/Learner/LearnerPortal";
        } else {
            SkolarDialog.alert("Could not cancel the booking request.");
        }
    } catch (err) {
        SkolarDialog.alert("Error cancelling booking: " + err.message);
    }
}

function parseTutorRate(value) {
    const numeric = String(value || "").replace(/[^0-9.]/g, "");
    return Number.parseFloat(numeric) || 0;
}

function getSelectedDurationHours() {
    const slot = document.getElementById("time")?.value || "";
    const parts = slot.split(" - ");
    if (parts.length !== 2) return 0;

    const start = parseClockTime(parts[0]);
    const end = parseClockTime(parts[1]);
    if (start === null || end === null || end <= start) return 0;
    return (end - start) / 60;
}

function parseClockTime(value) {
    const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3].toUpperCase();
    if (hours === 12) hours = 0;
    if (period === "PM") hours += 12;
    return hours * 60 + minutes;
}

function updatePricingSummary() {
    const duration = getSelectedDurationHours();
    const sessionAmount = currentTutorRate * duration;
    const total = sessionAmount * selectedDates.length;
    const money = value => `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const values = {
        paymentRate: `${money(currentTutorRate)} / hour`,
        paymentDuration: `${duration || 0} hour${duration === 1 ? "" : "s"}`,
        paymentSessionCount: String(selectedDates.length),
        paymentSessionAmount: money(sessionAmount),
        paymentTotal: money(total),
        summaryTotal: money(total)
    };

    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

// Page
async function initializePage() {
    bindForms();
    bindPhoneInputs();

    document.querySelectorAll(".booking-type-btn").forEach(button => {
        button.addEventListener("click", () => setBookingType(button.dataset.bookingType));
    });

    const timeSelect = document.getElementById("time");
    timeSelect.addEventListener("change", () => {
        document.getElementById("summaryTime").textContent = timeSelect.value || "Not selected";
        updatePricingSummary();
    });

    const params = new URLSearchParams(window.location.search);
    const tutorName = params.get("tutorName");
    const tutorId = parseInt(params.get("tutorId") || "0");
    const subjectSelect = document.getElementById("subject");

    if (tutorName) document.getElementById("summaryTutorName").textContent = tutorName;

    if (tutorId) {
        try {
            const tutors = await fetch("/Tutor/List").then(response => response.json());
            const tutor = tutors.find(item => item.id === tutorId);
            currentTutorRate = parseTutorRate(tutor?.rate);
            updatePricingSummary();
            subjectSelect.innerHTML = "";

            if (!tutor?.subjects) {
                subjectSelect.innerHTML = '<option value="">No subjects available</option>';
            } else {
                subjectSelect.innerHTML = '<option value="">Choose subject</option>';
                tutor.subjects.split(",").map(subject => subject.trim()).filter(Boolean).forEach(subject => {
                    const option = document.createElement("option");
                    option.value = subject;
                    option.textContent = subject;
                    subjectSelect.appendChild(option);
                });
            }
        } catch {
            subjectSelect.innerHTML = '<option value="">Could not load subjects</option>';
        }

        fetch(`/Tutor/GetProfile?id=${tutorId}`)
            .then(response => response.ok ? response.json() : null)
            .then(tutor => {
                const image = document.getElementById("summaryTutorPhoto");
                if (image && tutor?.profilePhoto) image.src = tutor.profilePhoto;
            });

        try {
            await loadAvailability(tutorId);
        } catch {
            calendarReady = true;
            renderCalendar();
        }
    } else {
        calendarReady = true;
        renderCalendar();
    }

    document.getElementById("btnPayNow")?.addEventListener("click", () => {
        if (currentCheckoutUrl) {
            window.location.href = currentCheckoutUrl;
        } else {
            SkolarDialog.alert("Payment checkout URL not found. Please try booking again.");
        }
    });

    const bookingGroupIdParam = params.get("bookingGroupId");
    const statusParam = params.get("status");

    if (bookingGroupIdParam) {
        currentBookingGroupId = bookingGroupIdParam;
        try {
            const response = await fetch(`/Learner/GetBookingGroupDetails?bookingGroupId=${bookingGroupIdParam}`);
            if (response.ok) {
                const data = await response.json();
                currentCheckoutUrl = data.checkoutUrl;

                // Populate Step 4 (Payment) elements
                document.getElementById("payRefText").textContent = data.bookingGroupId;
                document.getElementById("payAmountText").textContent = `₱${data.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                document.getElementById("payStatusText").textContent = "Awaiting Payment";
                document.getElementById("payStatusText").className = "pending-text";

                // Populate sidebar summary details
                document.getElementById("summaryTutorName").textContent = data.tutorName;
                document.getElementById("summaryBookingType").textContent = data.bookingType === "Range" ? "Date Range" : "Single Day";
                
                const scheduleText = data.bookingType === "Range" 
                    ? `${formatShortDate(data.dates[0])} – ${formatDate(data.dates[data.dates.length - 1])}`
                    : formatDate(data.dates[0]);

                document.getElementById("summaryDate").textContent = scheduleText;
                document.getElementById("summarySessions").textContent = data.dates.length === 1 ? "1 session" : `${data.dates.length} sessions`;
                document.getElementById("summarySubject").textContent = data.subject;
                document.getElementById("summaryTime").textContent = data.time;
                document.getElementById("summaryName").textContent = data.learnerName;
                document.getElementById("summaryTotal").textContent = `₱${data.totalAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                // Also populate final summary in Done step
                document.getElementById("finalName").textContent = data.learnerName;
                document.getElementById("finalDate").textContent = scheduleText;
                document.getElementById("finalSessions").textContent = data.dates.length === 1 ? "1 session" : `${data.dates.length} sessions`;
                document.getElementById("finalSubject").textContent = data.subject;
                document.getElementById("finalTime").textContent = data.time;
                document.getElementById("successPlural").textContent = data.dates.length === 1 ? "" : "s";

                // Fetch tutor avatar if possible
                fetch(`/Tutor/GetProfile?id=${data.tutorId}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(t => {
                        const image = document.getElementById("summaryTutorPhoto");
                        if (image && t?.profilePhoto) image.src = t.profilePhoto;
                    });

                if (statusParam === "declined") {
                    SkolarDialog.alert("Your payment was declined. Please verify your payment details and try again.");
                    showStep("summaryStep");
                    return; // prevent overwriting step with availability loads
                } else if (statusParam === "confirmed") {
                    showStep("confirmStep");
                    return; // prevent overwriting step
                }
            }
        } catch (err) {
            console.error("Error loading booking group details: ", err);
        }
    }

    updateSelectionUI();
}

document.addEventListener("DOMContentLoaded", initializePage);
