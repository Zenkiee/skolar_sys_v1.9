let learnerSessions = [];
let learnerToastTimer = null;

const pageTitles = {
    dashboard: "Dashboard",
    sessions: "My Sessions",
    tutors: "Find Tutors",
    reviews: "Reviews",
    profile: "Profile"
};

document.addEventListener("DOMContentLoaded", () => {
    const dateEl = document.getElementById("currentDate");

    if (dateEl) {
        const now = new Date();

        const options = {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        };

        dateEl.textContent = now.toLocaleDateString("en-US", options);
    } else {
        console.error('Element with ID "currentDate" was not found.');
    }
});

function showPage(pageId, button, updateHash = true) {
    const page = document.getElementById(pageId);
    if (!page || !pageTitles[pageId]) return;

    document.querySelectorAll(".page").forEach(item => {
        item.classList.remove("active");
    });

    document.querySelectorAll(".menu-link").forEach(link => {
        link.classList.remove("active");
    });

    page.classList.add("active");

    const activeButton = button || document.querySelector(`[data-page="${pageId}"]`);
    if (activeButton) activeButton.classList.add("active");

    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = pageTitles[pageId];

    if (updateHash && window.location.hash !== `#${pageId}`) {
        history.replaceState(null, "", `#${pageId}`);
    }

    if (pageId === "sessions") loadSessions();
    if (pageId === "reviews") loadReviewSessions();
    if (pageId === "tutors") loadTutors();
}

function openPageFromHash() {
    const pageId = window.location.hash.replace("#", "") || "dashboard";
    const validPageId = pageTitles[pageId] ? pageId : "dashboard";
    showPage(validPageId, null, false);
}

window.addEventListener("hashchange", openPageFromHash);
document.addEventListener("DOMContentLoaded", openPageFromHash);

function logoutLearner() {
    if (typeof logoutUser === "function") {
        logoutUser();
    } else {
        localStorage.removeItem("currentUser");
        window.location.href = "/Learner/LearnerPortal";
    }
}

// ── SESSIONS ─────────────────────────────────
async function loadSessions() {
    let sessions = [];
    try {
        const response = await fetch("/Learner/MySessions", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load sessions.");
        sessions = await response.json();
        learnerSessions = sessions;
    } catch (error) {
        console.error(error);
    }

    const total = sessions.length;
    const pending = sessions.filter(session => String(session.status).toLowerCase() === "pending").length;
    const confirmed = sessions.filter(session => String(session.status).toLowerCase() === "confirmed").length;
    const completed = sessions.filter(session => String(session.status).toLowerCase() === "completed").length;

    setSessionStat("statTotal", total);
    setSessionStat("statPending", pending);
    setSessionStat("statConfirmed", confirmed);
    setSessionStat("statCompleted", completed);
    updateLearningSummary(sessions);

    const awaitingSessions = sessions.filter(session => getLearnerSessionState(session) === "awaiting");
    const notice = document.getElementById("sessionCompletionNotice");
    if (notice) {
        notice.hidden = awaitingSessions.length === 0;
        notice.textContent = awaitingSessions.length === 1
            ? "A tutor marked 1 session done. Please confirm it below."
            : `Tutors marked ${awaitingSessions.length} sessions done. Please confirm them below.`;
    }

    const list = document.getElementById("sessionList");
    if (list) {
        if (sessions.length === 0) {
            list.innerHTML = `<p class="session-empty">No sessions found.</p>`;
        } else {
            list.innerHTML = groupLearnerSessions(sessions).map(renderLearnerSessionGroup).join("");
        }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = sessions
        .filter(session => {
            const status = String(session.status || "").toLowerCase();
            const date = new Date(session.date);
            date.setHours(0, 0, 0, 0);
            return (status === "confirmed" || status === "pending") &&
                !session.tutorMarkedDoneAt &&
                date >= today;
        })
        .sort((first, second) => new Date(first.date) - new Date(second.date))[0];

    const upcomingDiv = document.getElementById("upcomingSession");
    const upcomingBadge = document.getElementById("upcomingStatusBadge");
    if (upcomingDiv) {
        if (upcoming) {
            upcomingDiv.innerHTML = `
                <h3>${escapeTutorText(upcoming.subject || "Session")} Tutoring</h3>
                <p>With ${escapeTutorText(upcoming.tutorName || "Tutor")}</p>
                <p>${escapeTutorText(formatSessionSchedule(upcoming))}</p>`;
            if (upcomingBadge) {
                upcomingBadge.textContent = upcoming.status;
                upcomingBadge.className = `status ${String(upcoming.status).toLowerCase()}`;
                upcomingBadge.style.display = "";
            }
        } else {
            upcomingDiv.innerHTML = `<p class="session-empty">No upcoming sessions.</p>`;
            if (upcomingBadge) upcomingBadge.style.display = "none";
        }
    }
}

function updateLearningSummary(sessions) {
    const now = new Date();
    const completedSessions = sessions.filter(session =>
        String(session.status || "").toLowerCase() === "completed"
    );
    const upcomingSessions = sessions.filter(session => {
        const status = String(session.status || "").toLowerCase();
        const sessionDate = new Date(session.date);
        return (status === "pending" || status === "confirmed") &&
            !session.tutorMarkedDoneAt &&
            !Number.isNaN(sessionDate.getTime()) &&
            sessionDate >= now;
    });
    const reviewedSessions = sessions.filter(session => session.hasReview).length;
    const subjects = [...new Set(
        completedSessions
            .map(session => String(session.subject || "").trim())
            .filter(Boolean)
    )];

    setSessionStat("summaryCompleted", completedSessions.length);
    setSessionStat("summaryUpcoming", upcomingSessions.length);
    setSessionStat("summaryReviews", reviewedSessions);

    const subjectsElement = document.getElementById("summarySubjects");
    if (subjectsElement) {
        subjectsElement.textContent = subjects.length > 0
            ? subjects.join(", ")
            : "No subjects yet";
    }
}

function groupLearnerSessions(sessions) {
    const groups = new Map();

    sessions.forEach(session => {
        const isRange = String(session.bookingType || "").toLowerCase() === "range" && session.bookingGroupId;
        const key = isRange ? `range:${session.bookingGroupId}` : `single:${session.id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(session);
    });

    return [...groups.entries()]
        .map(([key, items]) => ({
            key,
            isRange: key.startsWith("range:") && items.length > 1,
            sessions: items.sort((first, second) => new Date(first.date) - new Date(second.date))
        }))
        .sort((first, second) => new Date(first.sessions[0]?.date) - new Date(second.sessions[0]?.date));
}

function renderLearnerSessionGroup(group) {
    if (!group.isRange) return renderLearnerSession(group.sessions[0]);

    const first = group.sessions[0];
    const state = getLearnerGroupState(group.sessions);
    const safeId = String(first.bookingGroupId || first.id).replace(/[^a-zA-Z0-9_-]/g, "-");
    const detailId = `learnerSessionGroup-${safeId}`;
    const completedCount = group.sessions.filter(session => getLearnerSessionState(session) === "done").length;
    const attentionCount = group.sessions.filter(session => ["awaiting", "disputed", "underreview"].includes(getLearnerSessionState(session))).length;
    const summaryParts = [`${group.sessions.length} sessions`, `${completedCount} completed`];
    if (attentionCount > 0) summaryParts.push(`${attentionCount} need attention`);

    return `
        <article class="session-range-card ${attentionCount > 0 ? "needs-attention" : ""}">
            <div class="session-range-summary">
                <div class="session-range-main">
                    <span class="session-range-label">Date-range booking</span>
                    <h3>${escapeTutorText(first.subject || "Session")}</h3>
                    <p>${escapeTutorText(formatGroupDateRange(group.sessions))}</p>
                    <p class="session-range-meta">${escapeTutorText(first.time || "")} · ${escapeTutorText(summaryParts.join(" · "))}</p>
                </div>
                <div class="session-range-side">
                    <p>${escapeTutorText(first.tutorName || "Tutor")}</p>
                    <span class="status ${state}">${escapeTutorText(getLearnerStatusLabel(state))}</span>
                    <button type="button" class="session-range-toggle" aria-expanded="false" aria-controls="${detailId}" onclick="toggleLearnerSessionGroup('${detailId}', this)">
                        <span>View session dates</span>
                        <span class="session-range-chevron" aria-hidden="true">⌄</span>
                    </button>
                </div>
            </div>
            <div class="session-range-details" id="${detailId}" hidden>
                ${group.sessions.map(session => renderLearnerSession(session, true)).join("")}
            </div>
        </article>`;
}

function toggleLearnerSessionGroup(detailId, button) {
    const details = document.getElementById(detailId);
    if (!details) return;
    const willOpen = details.hidden;
    details.hidden = !willOpen;
    button?.setAttribute("aria-expanded", String(willOpen));
    const label = button?.querySelector("span:first-child");
    if (label) label.textContent = willOpen ? "Hide session dates" : "View session dates";
}

function getLearnerGroupState(sessions) {
    const states = sessions.map(getLearnerSessionState);
    const priority = ["disputed", "underreview", "awaiting", "pending", "confirmed"];
    for (const state of priority) {
        if (states.includes(state)) return state;
    }
    if (states.every(state => state === "done")) return "done";
    if (states.every(state => state === "cancelled")) return "cancelled";
    return "inprogress";
}

function formatGroupDateRange(sessions) {
    const dates = sessions
        .map(session => new Date(session.date))
        .filter(date => !Number.isNaN(date.getTime()))
        .sort((first, second) => first - second);
    if (dates.length === 0) return "Schedule unavailable";

    const first = dates[0];
    const last = dates[dates.length - 1];
    const firstText = first.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const lastText = last.toLocaleDateString("en-US", {
        month: first.getMonth() === last.getMonth() ? undefined : "long",
        day: "numeric",
        year: "numeric"
    });
    return `${firstText} – ${lastText}`;
}

function renderLearnerSession(session, compact = false) {
    const state = getLearnerSessionState(session);
    const waiting = state === "awaiting";
    const issueDetails = buildSessionIssueDetails(session, state);
    const completionActions = waiting ? `
        <div class="session-completion-actions">
            <button type="button" class="session-confirm-btn" onclick="openConfirmSessionModal(${Number(session.id)}, this)">Confirm Session Done</button>
            <button type="button" class="session-report-btn" onclick="openSessionIssueModal(${Number(session.id)})">Report an Issue</button>
            <small>Automatically completes ${escapeTutorText(formatAutoCompleteDate(session.autoCompletesAt))}</small>
        </div>` : "";
    const cancellationAction = canCancelSession(session) ? `
        <button type="button" class="session-cancel-booking-btn" onclick="openLearnerCancellationModal(${Number(session.id)}, this)">Cancel Session</button>` : "";
    const refundDetails = session.refund ? `
        <div class="session-refund-note">
            <strong>Refund ${escapeTutorText(session.refund.status)}</strong>
            <span>₱${Number(session.refund.amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        </div>` : "";

    return `
        <article class="session-item ${compact ? "session-item-compact" : ""} ${waiting ? "needs-confirmation" : ""}">
            <div>
                <h3>${escapeTutorText(session.subject || "Session")}</h3>
                <p>${escapeTutorText(formatSessionSchedule(session))}</p>
                <p class="session-payment-line">Payment: ${escapeTutorText(getLearnerPaymentStatusLabel(session.paymentStatus))} · ₱${Number(session.sessionAmount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                ${refundDetails}
                ${issueDetails}
            </div>
            <div class="session-item-side">
                <p>${escapeTutorText(session.tutorName || "Tutor")}</p>
                <span class="status ${state}">${escapeTutorText(getLearnerStatusLabel(state))}</span>
                ${completionActions}
                ${cancellationAction}
            </div>
        </article>`;
}

function canCancelSession(session) {
    const status = String(session.status || "").toLowerCase();
    if (!['pending', 'confirmed'].includes(status) || !isLearnerSessionPaymentReady(session.paymentStatus)) return false;
    const start = getSessionStartDate(session);
    return start && start > new Date();
}

function isLearnerSessionPaymentReady(status) {
    return status === "Paid" || status === "PendingIntegration";
}

function getLearnerPaymentStatusLabel(status) {
    const labels = {
        PendingIntegration: "API Not Connected",
        NotProcessed: "Not Processed"
    };
    return labels[status] || status || "Unpaid";
}

function getSessionStartDate(session) {
    if (!session.date || !session.time) return null;
    const startText = String(session.time).split(' - ')[0];
    const match = startText.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return new Date(session.date);
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (hour === 12) hour = 0;
    if (period === 'PM') hour += 12;
    const date = new Date(session.date);
    date.setHours(hour, minute, 0, 0);
    return date;
}

function buildSessionIssueDetails(session, state) {
    if (!session.completionIssueReportedAt) return "";

    const tutorResponse = session.tutorIssueResponse
        ? `<div class="session-issue-response"><strong>Tutor response</strong><p>${escapeTutorText(session.tutorIssueResponse)}</p></div>`
        : `<div class="session-issue-response pending"><strong>Tutor response</strong><p>Waiting for the tutor to respond.</p></div>`;

    const adminResolution = session.adminIssueResolution
        ? `<div class="session-admin-resolution"><strong>${escapeTutorText(session.completionIssueStatus || session.adminIssueResolution)}</strong>${session.adminIssueResolutionNote ? `<p>${escapeTutorText(session.adminIssueResolutionNote)}</p>` : ""}</div>`
        : state === "underreview"
            ? `<div class="session-admin-resolution pending"><strong>Administrative review</strong><p>The issue is being reviewed by Skolar Administration.</p></div>`
            : "";

    return `
        <div class="session-issue-details">
            <div class="session-issue-report"><strong>Your report</strong><p>${escapeTutorText(session.completionIssueReason || "No details provided.")}</p></div>
            ${tutorResponse}
            ${adminResolution}
        </div>`;
}

function getLearnerSessionState(session) {
    const status = String(session.status || "pending").toLowerCase();
    if (status === "completed") return "done";
    if (status === "cancelled") return "cancelled";
    if (status === "underreview") return "underreview";
    if (status === "disputed" || session.completionIssueReportedAt) return "disputed";
    if (status === "confirmed" && session.tutorMarkedDoneAt) return "awaiting";
    return status;
}

function getLearnerStatusLabel(state) {
    const labels = {
        done: "Completed",
        awaiting: "Waiting for your confirmation",
        disputed: "Awaiting tutor response",
        underreview: "Under administrative review",
        cancelled: "Cancelled",
        rejected: "Rejected",
        awaitingpayment: "Awaiting payment",
        paymentfailed: "Payment failed",
        paymentcancelled: "Payment cancelled",
        inprogress: "In progress"
    };
    return labels[state] || state.charAt(0).toUpperCase() + state.slice(1);
}

function formatSessionSchedule(session) {
    if (!session.date) return "";
    return `${new Date(session.date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    })} · ${session.time || ""}`;
}

function formatAutoCompleteDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "after 24 hours";
    return `on ${date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    })}`;
}

function setSessionStat(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
}

let pendingLearnerCompletionId = null;
let learnerCompletionTrigger = null;

function openConfirmSessionModal(bookingId, trigger = null) {
    const session = learnerSessions.find(item => Number(item.id) === Number(bookingId));
    const modal = document.getElementById("learnerCompleteSessionModal");
    const details = document.getElementById("learnerCompleteSessionDetails");
    if (!session || !modal || !details) {
        showLearnerToast("Session details could not be found.", "error");
        return;
    }

    pendingLearnerCompletionId = Number(bookingId);
    learnerCompletionTrigger = trigger;
    details.innerHTML = `
        <div><span>Tutor</span><strong>${escapeTutorText(session.tutorName || "Tutor")}</strong></div>
        <div><span>Subject</span><strong>${escapeTutorText(session.subject || "Session")}</strong></div>
        <div><span>Schedule</span><strong>${escapeTutorText(formatSessionSchedule(session))}</strong></div>`;

    modal.hidden = false;
    syncLearnerModalState();
    requestAnimationFrame(() => document.getElementById("confirmLearnerSessionBtn")?.focus());
}

function closeConfirmSessionModal() {
    const modal = document.getElementById("learnerCompleteSessionModal");
    if (modal) modal.hidden = true;
    pendingLearnerCompletionId = null;
    syncLearnerModalState();
    learnerCompletionTrigger?.focus();
    learnerCompletionTrigger = null;
}

async function confirmSessionDone() {
    if (!pendingLearnerCompletionId) return;

    const button = document.getElementById("confirmLearnerSessionBtn");
    if (button) {
        button.disabled = true;
        button.textContent = "Confirming...";
    }

    try {
        const response = await fetch("/Learner/ConfirmSessionDone", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: pendingLearnerCompletionId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not complete the session.");

        closeConfirmSessionModal();
        showLearnerToast(result.message || "Session confirmed as completed.");
        await loadSessions();
        loadReviewSessions();
    } catch (error) {
        showLearnerToast(error.message, "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Confirm Session Done";
        }
    }
}

let pendingCancellationId = null;
let learnerCancellationTrigger = null;

async function openLearnerCancellationModal(bookingId, trigger = null) {
    const modal = document.getElementById("learnerCancellationModal");
    const details = document.getElementById("learnerCancellationDetails");
    const error = document.getElementById("learnerCancellationError");
    if (!modal || !details || !error) return;

    pendingCancellationId = Number(bookingId);
    learnerCancellationTrigger = trigger;
    details.innerHTML = '<p>Calculating your refund...</p>';
    error.textContent = '';
    modal.hidden = false;
    syncLearnerModalState();

    try {
        const response = await fetch(`/Payment/CancellationPreview?bookingId=${bookingId}`, { cache: "no-store" });
        const quote = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(quote.message || "Could not calculate the refund.");

        details.innerHTML = `
            <div><span>Session</span><strong>${escapeTutorText(quote.subject)} · ${escapeTutorText(formatSessionSchedule(quote))}</strong></div>
            <div><span>Session amount</span><strong>₱${Number(quote.sessionAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div>
            <div><span>Notice provided</span><strong>${Number(quote.hoursBeforeSession).toFixed(1)} hours</strong></div>
            <div><span>Refund percentage</span><strong>${Number(quote.refundPercentage)}%</strong></div>
            <div class="refund-highlight"><span>Expected refund</span><strong>₱${Number(quote.refundAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div>
            ${Number(quote.tutorCompensationAmount) > 0 ? `<div><span>Tutor compensation</span><strong>₱${Number(quote.tutorCompensationAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div>` : ''}
            ${quote.warningIssued ? '<p class="cancellation-warning">This cancellation records an advanced-cancellation warning under the learner policy.</p>' : ''}`;
    } catch (requestError) {
        error.textContent = requestError.message;
    }
}

function closeLearnerCancellationModal() {
    const modal = document.getElementById("learnerCancellationModal");
    if (modal) modal.hidden = true;
    pendingCancellationId = null;
    syncLearnerModalState();
    learnerCancellationTrigger?.focus();
    learnerCancellationTrigger = null;
}

async function confirmLearnerCancellation() {
    if (!pendingCancellationId) return;
    const button = document.getElementById("confirmLearnerCancellationBtn");
    const error = document.getElementById("learnerCancellationError");
    button.disabled = true;
    button.textContent = "Submitting refund...";
    error.textContent = "";

    try {
        const response = await fetch("/Payment/CancelSession", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: pendingCancellationId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not cancel the session.");
        closeLearnerCancellationModal();
        showLearnerToast(`${result.message} Refund: ₱${Number(result.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`);
        await loadSessions();
    } catch (requestError) {
        error.textContent = requestError.message;
    } finally {
        button.disabled = false;
        button.textContent = "Confirm Cancellation";
    }
}

function syncLearnerModalState() {
    const hasOpenModal = [...document.querySelectorAll(".learner-session-modal")]
        .some(modal => !modal.hidden);
    document.body.classList.toggle("modal-open", hasOpenModal);
}

function showLearnerToast(message, type = "success") {
    const toast = document.getElementById("learnerSessionToast");
    if (!toast) return;

    clearTimeout(learnerToastTimer);
    toast.textContent = message;
    toast.className = `learner-session-toast ${type}`;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));

    learnerToastTimer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 180);
    }, 3600);
}

function openSessionIssueModal(bookingId) {
    const modal = document.getElementById("sessionIssueModal");
    const input = document.getElementById("sessionIssueReason");
    if (!modal || !input) return;

    modal.dataset.bookingId = String(bookingId);
    input.value = "";
    document.getElementById("sessionIssueError").textContent = "";
    modal.hidden = false;
    syncLearnerModalState();
    input.focus();
}

function closeSessionIssueModal() {
    const modal = document.getElementById("sessionIssueModal");
    if (modal) modal.hidden = true;
    syncLearnerModalState();
}

async function submitSessionIssue() {
    const modal = document.getElementById("sessionIssueModal");
    const input = document.getElementById("sessionIssueReason");
    const error = document.getElementById("sessionIssueError");
    const bookingId = Number(modal?.dataset.bookingId);
    const reason = input?.value.trim() || "";

    if (reason.length < 5 || reason.length > 500) {
        error.textContent = "Explain the issue in 5 to 500 characters.";
        return;
    }

    const submitButton = document.getElementById("submitSessionIssueBtn");
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
    }

    try {
        const response = await fetch("/Learner/ReportSessionIssue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, reason })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not report the issue.");

        closeSessionIssueModal();
        showLearnerToast(result.message || "Issue reported. Session completion is paused for review.");
        await loadSessions();
    } catch (requestError) {
        error.textContent = requestError.message;
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Report";
        }
    }
}

function updateLearnerSidebarIdentity(name, photoUrl) {
    const safeName = String(name || "Learner").trim() || "Learner";
    const initialText = safeName.charAt(0).toUpperCase();
    const nameElement = document.getElementById("learnerName");
    const greetingElement = document.getElementById("learnerGreeting");
    const image = document.getElementById("learnerSidebarPhoto");
    const initial = document.getElementById("learnerInitial");

    if (nameElement) nameElement.textContent = safeName;
    if (greetingElement) greetingElement.textContent = `Welcome back, ${safeName}!`;
    if (initial) initial.textContent = initialText;

    if (!image || !initial) return;

    const showInitial = () => {
        image.hidden = true;
        image.removeAttribute("src");
        initial.hidden = false;
        initial.textContent = initialText;
    };

    showInitial();

    if (!photoUrl) {
        return;
    }

    image.onerror = showInitial;
    image.onload = () => {
        image.hidden = false;
        initial.hidden = true;
    };
    image.src = photoUrl;
}

(async () => {
    const res = await fetch("/Home/Me");
    const user = res.ok ? await res.json() : null;

    if (!user) return;

    // FIX 3: Store user id and name on window so loadReviewTutors()
    // and submitReview() can read them — sessionStorage was never populated.
    window._currentUserId = user.id;
    window._currentUserName = user.name;

    // Sidebar
    updateLearnerSidebarIdentity(user.name, user.profilePhoto);

    // Profile fields
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    if (profileName) profileName.value = user.name;
    if (profileEmail) profileEmail.value = user.email ?? "";

    // Load sessions using the real user id
    await loadSessions();
})();

function togglePortalMenu() {
    document.getElementById("portalSidebar").classList.toggle("active");
    document.getElementById("sidebarOverlay").classList.toggle("active");
}

function closePortalMenu() {
    document.getElementById("portalSidebar").classList.remove("active");
    document.getElementById("sidebarOverlay").classList.remove("active");
}

// ── FIND TUTORS ──────────────────────────────
function escapeTutorText(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadTutors(filter = "") {
    const grid = document.getElementById("tutorGrid");
    if (!grid) return;

    grid.innerHTML = `<p class="tutor-grid-message">Loading tutors...</p>`;

    try {
        const response = await fetch("/Tutor/List", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load tutors.");

        const tutors = await response.json();
        const normalizedFilter = filter.toLowerCase().trim();
        const filtered = tutors.filter(t => {
            const name = String(t.tutorName ?? "").toLowerCase();
            const subjects = String(t.subjects ?? "").toLowerCase();
            const education = String(t.education ?? "").toLowerCase();
            return name.includes(normalizedFilter) ||
                subjects.includes(normalizedFilter) ||
                education.includes(normalizedFilter);
        });

        if (filtered.length === 0) {
            grid.innerHTML = `<p class="tutor-grid-message">No tutors found.</p>`;
            return;
        }

        grid.innerHTML = filtered.map(t => {
            const tutorName = escapeTutorText(t.tutorName || "Tutor");
            const rate = escapeTutorText(t.rate || "Not specified");
            const education = escapeTutorText(t.education || "Not specified");
            const bio = escapeTutorText(t.bio || "No information provided.");
            const tutorId = Number(t.id);
            const subjects = String(t.subjects ?? "")
                .split(",")
                .map(subject => subject.trim())
                .filter(Boolean)
                .map(subject => `<span>${escapeTutorText(subject)}</span>`)
                .join("");
            const subjectContent = subjects || '<span class="subject-empty">Not specified</span>';
            const initial = tutorName.charAt(0).toUpperCase();
            const profilePhoto = String(t.profilePhoto ?? "");
            const avatarHtml = profilePhoto
                ? `<img src="${escapeTutorText(profilePhoto)}" alt="${tutorName}">`
                : `<div class="empty-avatar">${initial}</div>`;
            const availabilityText = t.isAvailable ? "Available" : "No open slots";
            const availabilityClass = t.isAvailable ? "available" : "unavailable";

            return `
                <article class="tutor-card">
                    <div class="tutor-card-header">
                        ${avatarHtml}
                        <h3 class="tutor-name">${tutorName}</h3>
                    </div>

                    <div class="tutor-details">
                        <div class="tutor-detail-row">
                            <span class="tutor-detail-label">Rate per hour:</span>
                            <span class="tutor-detail-value">${rate}</span>
                        </div>
                        <div class="tutor-detail-row tutor-subject-row">
                            <span class="tutor-detail-label">Subjects:</span>
                            <div class="subject-tags">${subjectContent}</div>
                        </div>
                        <div class="tutor-detail-row">
                            <span class="tutor-detail-label">Education:</span>
                            <span class="tutor-detail-value">${education}</span>
                        </div>
                        <div class="tutor-detail-row">
                            <span class="tutor-detail-label">Availability:</span>
                            <span class="availability-badge ${availabilityClass}">${availabilityText}</span>
                        </div>
                        <div class="tutor-detail-row tutor-about-row">
                            <span class="tutor-detail-label">About:</span>
                            <span class="tutor-detail-value tutor-bio">${bio}</span>
                        </div>
                    </div>

                    <div class="tutor-actions">
                        <a href="/Learner/TutorProfile?id=${tutorId}">View Profile</a>
                        <a href="/Learner/Booking?tutorId=${tutorId}&tutorName=${encodeURIComponent(t.tutorName || "Tutor")}">Book Session</a>
                    </div>
                </article>
            `;
        }).join("");
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="tutor-grid-message">Could not load tutors. Please try again.</p>`;
    }
}

const tutorSearchInput = document.getElementById("tutorSearch");
if (tutorSearchInput) {
    tutorSearchInput.addEventListener("input", event => {
        loadTutors(event.target.value);
    });
}

const findTutorsBtn = document.querySelector('[onclick*="tutors"]');
if (findTutorsBtn) {
    const original = findTutorsBtn.getAttribute("onclick");
    findTutorsBtn.setAttribute("onclick", `${original}; loadTutors();`);
}

// ── REVIEWS ──────────────────────────────────
function loadReviewSessions() {
    const select = document.getElementById('reviewSessionSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Loading completed sessions...</option>';

    fetch('/Learner/GetReviewableSessions')
        .then(async response => {
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.message || 'Could not load completed sessions.');
            }
            return response.json();
        })
        .then(sessions => {
            select.innerHTML = '<option value="">Select a completed session</option>';

            if (sessions.length === 0) {
                select.innerHTML += '<option disabled>No completed sessions available for review</option>';
                return;
            }

            sessions.forEach(session => {
                const date = new Date(session.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });
                const option = document.createElement('option');
                option.value = session.bookingId;
                option.textContent = `${session.tutorName} · ${session.subject} · ${date} · ${session.time}`;
                select.appendChild(option);
            });
        })
        .catch(error => {
            select.innerHTML = `<option disabled>${error.message}</option>`;
        });
}

async function submitReview() {
    const bookingId = Number(document.getElementById('reviewSessionSelect')?.value);
    const rating = Number(document.getElementById('reviewRating')?.value);
    const commentInput = document.getElementById('reviewComment');
    const comment = commentInput?.value.trim() || '';
    const message = document.getElementById('reviewMsg');

    if (message) {
        message.textContent = '';
        message.className = 'review-message';
    }

    if (!bookingId || !rating || !comment) {
        if (message) {
            message.textContent = 'Please select a completed session, rating, and write your review.';
            message.classList.add('error');
        }
        return;
    }

    try {
        const response = await fetch('/Learner/SubmitReview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, rating, comment })
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.message || 'Could not submit the review.');
        }

        if (message) {
            message.textContent = result.message || 'Review submitted and published.';
            message.classList.add('success');
        }

        if (commentInput) commentInput.value = '';
        document.getElementById('reviewRating').value = '';
        loadReviewSessions();
    } catch (error) {
        if (message) {
            message.textContent = error.message;
            message.classList.add('error');
        }
    }
}

// Page
loadTutors();

document.querySelectorAll("[data-close-session-issue]").forEach(element => {
    element.addEventListener("click", closeSessionIssueModal);
});

document.querySelectorAll("[data-close-learner-completion]").forEach(element => {
    element.addEventListener("click", closeConfirmSessionModal);
});

document.getElementById("confirmLearnerSessionBtn")?.addEventListener("click", confirmSessionDone);
document.getElementById("confirmLearnerCancellationBtn")?.addEventListener("click", confirmLearnerCancellation);
document.querySelectorAll("[data-close-learner-cancellation]").forEach(element => {
    element.addEventListener("click", closeLearnerCancellationModal);
});

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    closeConfirmSessionModal();
    closeSessionIssueModal();
});