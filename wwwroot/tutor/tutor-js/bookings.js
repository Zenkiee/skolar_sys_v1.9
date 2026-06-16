let bookingGroups = [];
let activeFilter = "all";
let pendingCompletion = null;
let completionTrigger = null;
let pendingIssueResponse = null;
let issueResponseTrigger = null;
let toastTimer = null;
let pendingTutorCancellation = null;
let tutorCancellationTrigger = null;

// Bookings
async function fetchBookings() {
    const response = await fetch("/Tutor/MyBookings", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load bookings.");

    bookingGroups = groupBookings(await response.json());
    renderTable();
}

function groupBookings(bookings) {
    const groups = new Map();

    bookings.forEach(booking => {
        const groupKey = booking.bookingGroupId || `booking-${booking.id}`;
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                groupKey,
                id: booking.id,
                name: booking.learnerName || "Learner",
                subject: booking.subject || "Session",
                email: booking.learnerEmail || "",
                contact: booking.learnerContact || "",
                bookingType: booking.bookingType || "Single",
                createdAt: booking.createdAt,
                sessions: []
            });
        }

        groups.get(groupKey).sessions.push({
            id: booking.id,
            date: booking.date,
            time: booking.time,
            createdAt: booking.createdAt,
            status: normalizeStatus(booking.status),
            tutorMarkedDoneAt: booking.tutorMarkedDoneAt,
            learnerConfirmedDoneAt: booking.learnerConfirmedDoneAt,
            completionIssueReportedAt: booking.completionIssueReportedAt,
            completionIssueReason: booking.completionIssueReason || "",
            completionIssueStatus: booking.completionIssueStatus || "",
            tutorIssueResponse: booking.tutorIssueResponse || "",
            tutorIssueRespondedAt: booking.tutorIssueRespondedAt,
            adminIssueResolution: booking.adminIssueResolution || "",
            adminIssueResolutionNote: booking.adminIssueResolutionNote || "",
            adminIssueResolvedAt: booking.adminIssueResolvedAt,
            paymentStatus: booking.paymentStatus || "Unpaid",
            sessionAmount: Number(booking.sessionAmount || 0),
            refund: booking.refund || null,
            canTutorMarkDone: Boolean(booking.canTutorMarkDone),
            canTutorRespondToIssue: Boolean(booking.canTutorRespondToIssue)
        });
    });

    return [...groups.values()]
        .map(group => {
            group.sessions.sort((first, second) => new Date(first.date) - new Date(second.date));
            const createdDates = group.sessions
                .map(session => getValidDate(session.createdAt))
                .filter(Boolean)
                .sort((firstDate, secondDate) => firstDate - secondDate);
            group.createdAt = createdDates[0] || getValidDate(group.createdAt);
            const states = [...new Set(group.sessions.map(getSessionState))];
            group.status = states.length === 1 ? states[0] : "mixed";
            group.schedule = formatGroupSchedule(group.sessions);
            group.paymentStatus = group.sessions.every(session => session.paymentStatus === group.sessions[0]?.paymentStatus)
                ? group.sessions[0]?.paymentStatus || "Unpaid"
                : "Mixed";
            group.initials = group.name
                .split(" ")
                .filter(Boolean)
                .map(word => word[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
            return group;
        })
        .sort((first, second) => new Date(first.sessions[0]?.date) - new Date(second.sessions[0]?.date));
}

async function updateStatus(id, status) {
    const response = await fetch("/Tutor/UpdateBookingStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        SkolarDialog.alert(error?.message || "Could not update the booking request.");
        return false;
    }

    await fetchBookings();
    return true;
}

async function markSessionDone(bookingId) {
    const response = await fetch("/Tutor/MarkSessionDone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        showBookingToast(result.message || "Could not mark the session done.", "error");
        return false;
    }

    await fetchBookings();
    showBookingToast(result.message || "Session marked as done. Waiting for learner confirmation.", "success");
    return true;
}

function renderTable() {
    const tableBody = document.getElementById("bookingsTableBody");
    if (!tableBody) return;

    const data = getFilteredData();
    if (data.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="bk-no-results">
                    <div class="bk-empty-state">
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="M21 21l-4.35-4.35"></path>
                            <path d="M8 11h6"></path>
                        </svg>
                        <span>No bookings found</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = data.map(group => {
        const requestLabel = group.bookingType.toLowerCase() === "range" ? "Date Range" : "Single Day";
        const singleSession = group.sessions.length === 1 ? group.sessions[0] : null;
        const actionHtml = buildGroupAction(group, singleSession);

        return `
            <tr>
                <td>
                    <div class="student-cell">
                        <div class="student-avatar avatar-blue">${escapeHtml(group.initials)}</div>
                        <span>${escapeHtml(group.name)}</span>
                    </div>
                </td>
                <td>${escapeHtml(group.subject)}</td>
                <td>
                    <div class="bk-schedule-cell">
                        <strong>${escapeHtml(group.schedule)}</strong>
                        <span>${escapeHtml(group.sessions[0]?.time || "")}</span>
                    </div>
                </td>
                <td>
                    <div class="bk-session-cell">
                        <span class="bk-session-count">${group.sessions.length}</span>
                        <span>${requestLabel}</span>
                        ${group.sessions.length > 1 ? `<button type="button" class="bk-view-dates-btn" data-group-key="${escapeHtml(group.groupKey)}">View dates</button>` : ""}
                    </div>
                </td>
                <td>
                    <div class="bk-created-cell">
                        <strong>${escapeHtml(formatBookingCreatedDate(group.createdAt))}</strong>
                        <span>${escapeHtml(formatBookingCreatedTime(group.createdAt))}</span>
                    </div>
                </td>
                <td>${escapeHtml(group.email)}</td>
                <td>${escapeHtml(group.contact)}</td>
                <td><span class="badge badge-${escapeHtml(group.status)}">${escapeHtml(getStatusLabel(group.status))}</span></td>
                <td><span class="badge badge-${escapeHtml(String(group.paymentStatus).toLowerCase())}">${escapeHtml(getPaymentStatusLabel(group.paymentStatus))}</span></td>
                <td><div class="bk-action-group">${actionHtml}</div></td>
            </tr>`;
    }).join("");
}

function buildGroupAction(group, singleSession) {
    if (group.status === "pending") {
        return `
            <button type="button" class="bk-action-btn confirm" data-booking-id="${group.id}" data-status="Confirmed">Confirm All</button>
            <button type="button" class="bk-action-btn reject" data-booking-id="${group.id}" data-status="Rejected">Reject All</button>`;
    }

    if (!singleSession) return "—";

    const state = getSessionState(singleSession);
    if (canMarkSessionDone(singleSession)) {
        return `<button type="button" class="bk-complete-session-btn" data-booking-id="${singleSession.id}">Mark Session Done</button>${canTutorCancel(singleSession) ? `<button type="button" class="bk-cancel-session-btn" data-booking-id="${singleSession.id}">Cancel Session</button>` : ""}`;
    }

    if (canTutorCancel(singleSession)) {
        return `<button type="button" class="bk-cancel-session-btn" data-booking-id="${singleSession.id}">Cancel Session</button>`;
    }

    if (state === "awaiting") {
        return `<span class="bk-action-note">Waiting for learner</span>`;
    }

    if (state === "disputed" || state === "underreview") {
        if (singleSession.canTutorRespondToIssue) {
            const label = singleSession.tutorIssueResponse ? "Edit Response" : "Respond to Issue";
            return `<button type="button" class="bk-respond-issue-btn" data-booking-id="${singleSession.id}">${label}</button>`;
        }
        return `<span class="bk-action-note disputed">${escapeHtml(getStatusLabel(state))}</span>`;
    }

    if (singleSession.adminIssueResolution) {
        return `<span class="bk-action-note">Resolved: ${escapeHtml(singleSession.adminIssueResolution)}</span>`;
    }

    return "—";
}

function getFilteredData() {
    const query = document.getElementById("bookingsSearch")?.value.toLowerCase().trim() || "";

    return bookingGroups.filter(group => {
        const matchesFilter = activeFilter === "all" ||
            group.status === activeFilter ||
            (activeFilter === "confirmed" && group.status === "awaiting") ||
            (activeFilter === "issue" && ["disputed", "underreview", "mixed"].includes(group.status) &&
                group.sessions.some(session => Boolean(session.completionIssueReportedAt)));
        const searchableText = [
            group.name,
            group.subject,
            group.email,
            group.schedule,
            ...group.sessions.map(session => formatDate(session.date))
        ].join(" ").toLowerCase();

        return matchesFilter && (!query || searchableText.includes(query));
    });
}

// Session Details
function openDatesModal(groupKey) {
    const group = bookingGroups.find(item => item.groupKey === groupKey);
    if (!group) return;

    const modal = document.getElementById("bookingDatesModal");
    const list = document.getElementById("bookingDatesList");
    document.getElementById("bookingDatesSummary").textContent = `${group.sessions.length} sessions · ${group.subject} · ${group.sessions[0]?.time || ""}`;

    list.innerHTML = group.sessions.map((session, index) => {
        const state = getSessionState(session);
        const cancellationButton = canTutorCancel(session)
            ? `<button type="button" class="bk-cancel-session-btn" data-booking-id="${session.id}" data-group-key="${escapeHtml(group.groupKey)}">Cancel Session</button>`
            : "";
        const action = session.adminIssueResolution
            ? `<small class="bk-issue-copy">Resolved: ${escapeHtml(session.adminIssueResolution)}</small>`
            : canMarkSessionDone(session)
                ? `<button type="button" class="bk-complete-session-btn" data-booking-id="${session.id}" data-group-key="${escapeHtml(group.groupKey)}">Mark Session Done</button>${cancellationButton}`
                : state === "confirmed" && cancellationButton
                    ? cancellationButton
                : state === "awaiting"
                    ? `<small class="bk-auto-complete">Auto-completes ${escapeHtml(formatAutoComplete(session.tutorMarkedDoneAt))}</small>`
                    : state === "disputed" || state === "underreview"
                        ? session.canTutorRespondToIssue
                            ? `<button type="button" class="bk-respond-issue-btn" data-booking-id="${session.id}" data-group-key="${escapeHtml(group.groupKey)}">${session.tutorIssueResponse ? "Edit Response" : "Respond to Issue"}</button>`
                            : `<small class="bk-issue-copy">${escapeHtml(session.completionIssueStatus || "Issue under review")}</small>`
                        : "";

        return `
            <div class="bk-modal-date-item">
                <span>${index + 1}</span>
                <div class="bk-modal-date-copy">
                    <strong>${escapeHtml(formatDate(session.date))}</strong>
                    <small>${escapeHtml(session.time)}</small>
                    <small>Requested ${escapeHtml(formatBookingCreatedCompact(session.createdAt))}</small>
                </div>
                <div class="bk-modal-date-actions">
                    <span class="bk-session-status bk-session-status-${escapeHtml(state)}">${escapeHtml(getStatusLabel(state))}</span>
                    ${action}
                </div>
            </div>`;
    }).join("");

    modal.hidden = false;
    syncModalState();
}

function closeDatesModal() {
    const modal = document.getElementById("bookingDatesModal");
    if (modal) modal.hidden = true;
    syncModalState();
}

function findBookingSession(bookingId) {
    for (const group of bookingGroups) {
        const session = group.sessions.find(item => item.id === bookingId);
        if (session) return { group, session };
    }
    return null;
}

function openCompleteSessionModal(bookingId, groupKey = "", trigger = null) {
    const match = findBookingSession(bookingId);
    if (!match) {
        showBookingToast("Session details could not be found.", "error");
        return;
    }

    const modal = document.getElementById("completeSessionModal");
    const details = document.getElementById("completeSessionDetails");
    if (!modal || !details) return;

    pendingCompletion = { bookingId, groupKey };
    completionTrigger = trigger;
    details.innerHTML = `
        <div><span>Learner</span><strong>${escapeHtml(match.group.name)}</strong></div>
        <div><span>Subject</span><strong>${escapeHtml(match.group.subject)}</strong></div>
        <div><span>Schedule</span><strong>${escapeHtml(formatDate(match.session.date))} · ${escapeHtml(match.session.time)}</strong></div>`;

    modal.hidden = false;
    syncModalState();
    requestAnimationFrame(() => document.getElementById("confirmCompleteSessionBtn")?.focus());
}

function closeCompleteSessionModal() {
    const modal = document.getElementById("completeSessionModal");
    if (modal) modal.hidden = true;
    pendingCompletion = null;
    syncModalState();
    completionTrigger?.focus();
    completionTrigger = null;
}

async function confirmCompleteSession() {
    if (!pendingCompletion) return;

    const button = document.getElementById("confirmCompleteSessionBtn");
    const { bookingId, groupKey } = pendingCompletion;
    if (button) {
        button.disabled = true;
        button.textContent = "Marking...";
    }

    const updated = await markSessionDone(bookingId);

    if (button) {
        button.disabled = false;
        button.textContent = "Mark as Done";
    }

    if (!updated) return;

    closeCompleteSessionModal();
    if (groupKey) openDatesModal(groupKey);
}

function openIssueResponseModal(bookingId, groupKey = "", trigger = null) {
    const match = findBookingSession(bookingId);
    const modal = document.getElementById("issueResponseModal");
    if (!match || !modal) {
        showBookingToast("Issue details could not be found.", "error");
        return;
    }

    pendingIssueResponse = { bookingId, groupKey };
    issueResponseTrigger = trigger;
    document.getElementById("issueResponseSession").innerHTML = `
        <div><span>Learner</span><strong>${escapeHtml(match.group.name)}</strong></div>
        <div><span>Subject</span><strong>${escapeHtml(match.group.subject)}</strong></div>
        <div><span>Schedule</span><strong>${escapeHtml(formatDate(match.session.date))} · ${escapeHtml(match.session.time)}</strong></div>`;
    document.getElementById("issueResponseLearnerReason").textContent = match.session.completionIssueReason || "No details provided.";
    const input = document.getElementById("issueResponseText");
    input.value = match.session.tutorIssueResponse || "";
    document.getElementById("issueResponseError").textContent = "";
    updateIssueResponseCount();
    document.getElementById("submitIssueResponseBtn").textContent = match.session.tutorIssueResponse ? "Update Response" : "Submit Response";
    modal.hidden = false;
    syncModalState();
    requestAnimationFrame(() => input.focus());
}

function closeIssueResponseModal() {
    const modal = document.getElementById("issueResponseModal");
    if (modal) modal.hidden = true;
    pendingIssueResponse = null;
    syncModalState();
    issueResponseTrigger?.focus();
    issueResponseTrigger = null;
}

function updateIssueResponseCount() {
    const input = document.getElementById("issueResponseText");
    const count = document.getElementById("issueResponseCount");
    if (input && count) count.textContent = `${input.value.length}/1000`;
}

async function submitIssueResponse() {
    if (!pendingIssueResponse) return;

    const input = document.getElementById("issueResponseText");
    const error = document.getElementById("issueResponseError");
    const button = document.getElementById("submitIssueResponseBtn");
    const responseText = input?.value.trim() || "";

    if (responseText.length < 10 || responseText.length > 1000) {
        error.textContent = "Response must be 10 to 1,000 characters.";
        return;
    }

    button.disabled = true;
    button.textContent = "Submitting...";
    error.textContent = "";

    try {
        const response = await fetch("/Tutor/RespondToSessionIssue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: pendingIssueResponse.bookingId, response: responseText })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not submit your response.");

        const groupKey = pendingIssueResponse.groupKey;
        closeIssueResponseModal();
        await fetchBookings();
        showBookingToast(result.message || "Response submitted for review.");
        if (groupKey) openDatesModal(groupKey);
    } catch (requestError) {
        error.textContent = requestError.message;
    } finally {
        button.disabled = false;
        button.textContent = "Submit Response";
    }
}

function canTutorCancel(session) {
    if (session.status !== "confirmed" || !isSessionPaymentReady(session.paymentStatus)) return false;
    const start = getTutorSessionStart(session);
    return start && start > new Date();
}

function isSessionPaymentReady(status) {
    return status === "Paid" || status === "PendingIntegration";
}

function getPaymentStatusLabel(status) {
    const labels = {
        PendingIntegration: "API Not Connected",
        NotProcessed: "Not Processed"
    };
    return labels[status] || status || "Unpaid";
}

function getTutorSessionStart(session) {
    const date = new Date(session.date);
    const startText = String(session.time || "").split(" - ")[0];
    const match = startText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return date;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour === 12) hour = 0;
    if (match[3].toUpperCase() === "PM") hour += 12;
    date.setHours(hour, minute, 0, 0);
    return date;
}

async function openTutorCancellationModal(bookingId, groupKey = "", trigger = null) {
    const modal = document.getElementById("tutorCancellationModal");
    const details = document.getElementById("tutorCancellationDetails");
    const error = document.getElementById("tutorCancellationError");
    if (!modal || !details || !error) return;

    pendingTutorCancellation = { bookingId, groupKey };
    tutorCancellationTrigger = trigger;
    details.innerHTML = "<p>Calculating refund and policy consequences...</p>";
    error.textContent = "";
    modal.hidden = false;
    syncModalState();

    try {
        const response = await fetch(`/Payment/CancellationPreview?bookingId=${bookingId}`, { cache: "no-store" });
        const quote = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(quote.message || "Could not calculate the cancellation.");

        details.innerHTML = quote.paymentRequired === false
            ? `<div><span>Session</span><strong>${escapeHtml(quote.subject)} · ${escapeHtml(formatDate(quote.date))} · ${escapeHtml(quote.time)}</strong></div>
               <div><span>Payment</span><strong>Not processed</strong></div>
               <div><span>Refund</span><strong>Not required</strong></div>`
            : `<div><span>Session</span><strong>${escapeHtml(quote.subject)} · ${escapeHtml(formatDate(quote.date))} · ${escapeHtml(quote.time)}</strong></div>
               <div><span>Notice provided</span><strong>${Number(quote.hoursBeforeSession).toFixed(1)} hours</strong></div>
               <div><span>Learner refund</span><strong>₱${Number(quote.refundAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} (${Number(quote.refundPercentage)}%)</strong></div>
               ${Number(quote.voucherPercentage) > 0 ? `<div><span>Learner voucher</span><strong>${Number(quote.voucherPercentage)}% credit</strong></div>` : ""}
               ${Number(quote.tutorFinePercentage) > 0 ? `<div><span>Tutor penalty</span><strong>${Number(quote.tutorFinePercentage)}% of next completed session gross</strong></div>` : ""}
               ${quote.warningIssued ? '<div><span>Account consequence</span><strong>1 official warning</strong></div>' : '<div><span>Account consequence</span><strong>No warning</strong></div>'}`;
    } catch (requestError) {
        error.textContent = getFriendlyCancellationError(requestError.message);
    }
}

function closeTutorCancellationModal() {
    const modal = document.getElementById("tutorCancellationModal");
    if (modal) modal.hidden = true;
    pendingTutorCancellation = null;
    syncModalState();
    tutorCancellationTrigger?.focus();
    tutorCancellationTrigger = null;
}

async function confirmTutorCancellation() {
    if (!pendingTutorCancellation) return;
    const { bookingId, groupKey } = pendingTutorCancellation;
    const button = document.getElementById("confirmTutorCancellationBtn");
    const error = document.getElementById("tutorCancellationError");
    button.disabled = true;
    button.textContent = "Requesting refund...";
    error.textContent = "";

    try {
        const response = await fetch("/Payment/CancelSession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not cancel the session.");
        closeTutorCancellationModal();
        await fetchBookings();
        showBookingToast(result.amount > 0 ? `${result.message} Learner refund: ₱${Number(result.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}.` : result.message);
        if (groupKey) openDatesModal(groupKey);
    } catch (requestError) {
        error.textContent = requestError.message;
    } finally {
        button.disabled = false;
        button.textContent = "Confirm Cancellation";
    }
}

function getFriendlyCancellationError(message) {
    const text = String(message || "").trim();
    if (!text) return "Cancellation could not be completed right now. Please try again later.";
    if (/paymongo|api|badrequest|payment_intent|parameter_invalid|source pointer/i.test(text)) {
        return "Cancellation could not be completed right now. Please try again later or contact support.";
    }
    return text;
}

function syncModalState() {
    const hasOpenModal = [...document.querySelectorAll(".bk-modal")].some(modal => !modal.hidden);
    document.body.classList.toggle("modal-open", hasOpenModal);
}

function showBookingToast(message, type = "success") {
    const toast = document.getElementById("bookingToast");
    if (!toast) return;

    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `bk-toast ${type}`;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 180);
    }, 3600);
}

// Helpers
function normalizeStatus(status) {
    const value = String(status || "pending").toLowerCase();
    return value === "completed" ? "done" : value;
}

function getSessionState(session) {
    if (session.status === "done") return "done";
    if (session.status === "underreview") return "underreview";
    if (session.status === "disputed" || session.completionIssueReportedAt) return "disputed";
    if (session.status === "confirmed" && session.tutorMarkedDoneAt) return "awaiting";
    return session.status;
}

function getStatusLabel(status) {
    const labels = {
        done: "Completed",
        awaiting: "Waiting for learner",
        disputed: "Awaiting tutor response",
        underreview: "Under review",
        cancelled: "Cancelled",
        awaitingpayment: "Awaiting learner payment",
        paymentfailed: "Payment failed",
        paymentcancelled: "Payment cancelled",
        mixed: "Mixed status"
    };
    return labels[status] || capitalize(status);
}

function canMarkSessionDone(session) {
    return session.status === "confirmed" &&
        !session.tutorMarkedDoneAt &&
        !session.completionIssueReportedAt &&
        session.canTutorMarkDone &&
        hasSessionEnded(session.date, session.time);
}

function hasSessionEnded(dateValue, timeValue) {
    const sessionDate = new Date(dateValue);
    if (Number.isNaN(sessionDate.getTime())) return false;

    const endText = String(timeValue || "").split(" - ")[1];
    if (!endText) {
        sessionDate.setHours(23, 59, 59, 999);
        return new Date() >= sessionDate;
    }

    const match = endText.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return false;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;

    sessionDate.setHours(hour, minute, 0, 0);
    return new Date() >= sessionDate;
}

function formatAutoComplete(markedAt) {
    if (!markedAt) return "automatically after 24 hours";
    const date = new Date(markedAt);
    if (Number.isNaN(date.getTime())) return "automatically after 24 hours";
    date.setHours(date.getHours() + 24);
    return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatGroupSchedule(sessions) {
    if (sessions.length === 0) return "No schedule";
    if (sessions.length === 1) return formatDate(sessions[0].date);

    const first = new Date(sessions[0].date);
    const last = new Date(sessions[sessions.length - 1].date);
    const firstText = first.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const lastText = last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${firstText} – ${lastText}`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function getValidDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatBookingCreatedDate(value) {
    const date = value instanceof Date ? value : getValidDate(value);
    if (!date) return "Unavailable";
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function formatBookingCreatedTime(value) {
    const date = value instanceof Date ? value : getValidDate(value);
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatBookingCreatedCompact(value) {
    const date = value instanceof Date ? value : getValidDate(value);
    if (!date) return "unavailable";
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function capitalize(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Page
function bindPage() {
    document.getElementById("bookingsSearch")?.addEventListener("input", renderTable);

    document.querySelectorAll(".filter-btn").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            activeFilter = button.dataset.filter;
            renderTable();
        });
    });

    document.getElementById("bookingsTableBody")?.addEventListener("click", async event => {
        const datesButton = event.target.closest(".bk-view-dates-btn");
        if (datesButton) {
            openDatesModal(datesButton.dataset.groupKey);
            return;
        }

        const actionButton = event.target.closest(".bk-action-btn");
        if (actionButton) {
            await updateStatus(Number(actionButton.dataset.bookingId), actionButton.dataset.status);
            return;
        }

        const completeButton = event.target.closest(".bk-complete-session-btn");
        if (completeButton) {
            openCompleteSessionModal(Number(completeButton.dataset.bookingId), "", completeButton);
            return;
        }

        const issueButton = event.target.closest(".bk-respond-issue-btn");
        if (issueButton) {
            openIssueResponseModal(Number(issueButton.dataset.bookingId), "", issueButton);
            return;
        }

        const cancelButton = event.target.closest(".bk-cancel-session-btn");
        if (cancelButton) {
            openTutorCancellationModal(Number(cancelButton.dataset.bookingId), "", cancelButton);
        }
    });

    document.getElementById("bookingDatesList")?.addEventListener("click", event => {
        const completeButton = event.target.closest(".bk-complete-session-btn");
        if (completeButton) {
            openCompleteSessionModal(
                Number(completeButton.dataset.bookingId),
                completeButton.dataset.groupKey || "",
                completeButton
            );
            return;
        }

        const issueButton = event.target.closest(".bk-respond-issue-btn");
        if (issueButton) {
            openIssueResponseModal(
                Number(issueButton.dataset.bookingId),
                issueButton.dataset.groupKey || "",
                issueButton
            );
            return;
        }

        const cancelButton = event.target.closest(".bk-cancel-session-btn");
        if (cancelButton) {
            openTutorCancellationModal(
                Number(cancelButton.dataset.bookingId),
                cancelButton.dataset.groupKey || "",
                cancelButton
            );
        }
    });

    document.querySelectorAll("[data-close-booking-modal]").forEach(element => {
        element.addEventListener("click", closeDatesModal);
    });

    document.querySelectorAll("[data-close-completion-modal]").forEach(element => {
        element.addEventListener("click", closeCompleteSessionModal);
    });

    document.getElementById("confirmCompleteSessionBtn")?.addEventListener("click", confirmCompleteSession);
    document.getElementById("confirmTutorCancellationBtn")?.addEventListener("click", confirmTutorCancellation);
    document.querySelectorAll("[data-close-tutor-cancellation]").forEach(element => {
        element.addEventListener("click", closeTutorCancellationModal);
    });
    document.querySelectorAll("[data-close-issue-response-modal]").forEach(element => {
        element.addEventListener("click", closeIssueResponseModal);
    });
    document.getElementById("submitIssueResponseBtn")?.addEventListener("click", submitIssueResponse);
    document.getElementById("issueResponseText")?.addEventListener("input", updateIssueResponseCount);

    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const sidebarOverlay = document.getElementById("sidebarOverlay");
    const closeSidebar = () => {
        sidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("show");
    };

    hamburger?.addEventListener("click", () => {
        sidebar?.classList.toggle("open");
        sidebarOverlay?.classList.toggle("show");
    });
    sidebarOverlay?.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSidebar();
            if (!document.getElementById("tutorCancellationModal")?.hidden) {
                closeTutorCancellationModal();
            } else if (!document.getElementById("issueResponseModal")?.hidden) {
                closeIssueResponseModal();
            } else if (!document.getElementById("completeSessionModal")?.hidden) {
                closeCompleteSessionModal();
            } else {
                closeDatesModal();
            }
        }
    });

    fetchBookings().catch(() => renderTable());
}

document.addEventListener("DOMContentLoaded", bindPage);
