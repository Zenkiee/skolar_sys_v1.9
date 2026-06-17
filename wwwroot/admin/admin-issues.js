let adminIssues = [];
let adminReviewReports = [];
let adminTutorVerifications = [];
let adminTutorWithdrawals = [];
let selectedAdminIssueId = null;
let adminToastTimer = null;

// Data
async function loadAdminData() {
    const [issueResponse, reviewResponse, verificationResponse, withdrawalResponse] = await Promise.all([
        fetch("/Admin/SessionIssues", { cache: "no-store" }),
        fetch("/Admin/ReviewReports", { cache: "no-store" }),
        fetch("/Admin/TutorVerifications", { cache: "no-store" }),
        fetch("/Admin/TutorWithdrawals", { cache: "no-store" })
    ]);

    if (!issueResponse.ok) throw new Error("Could not load session issues.");
    if (!reviewResponse.ok) throw new Error("Could not load reported reviews.");
    if (!verificationResponse.ok) throw new Error("Could not load tutor verifications.");
    if (!withdrawalResponse.ok) throw new Error("Could not load tutor withdrawals.");

    adminIssues = await issueResponse.json();
    adminReviewReports = await reviewResponse.json();
    adminTutorVerifications = await verificationResponse.json();
    adminTutorWithdrawals = await withdrawalResponse.json();

    updateAdminSummary();
    renderAdminIssues();
    renderReviewReports();
    renderTutorVerifications();
    renderTutorWithdrawals();
}

function updateAdminSummary() {
    const openIssues = adminIssues.filter(issue => !issue.adminIssueResolvedAt);
    const pendingReviews = adminReviewReports.filter(report => report.status === "Pending");
    const pendingVerifications = adminTutorVerifications.filter(item => item.identityVerificationStatus !== "Verified");
    const pendingWithdrawals = adminTutorWithdrawals.filter(item => item.status === "Requested" || item.status === "Processing");
    const resolvedIssues = adminIssues.filter(issue => Boolean(issue.adminIssueResolvedAt));
    const resolvedReviews = adminReviewReports.filter(report => report.status !== "Pending");
    const resolvedWithdrawals = adminTutorWithdrawals.filter(item => item.status === "Released" || item.status === "Rejected");

    setAdminText("openIssueCount", openIssues.length);
    setAdminText("pendingReviewCount", pendingReviews.length);
    setAdminText("pendingVerificationCount", pendingVerifications.length);
    setAdminText("pendingWithdrawalCount", pendingWithdrawals.length);
    setAdminText("resolvedItemCount", resolvedIssues.length + resolvedReviews.length + resolvedWithdrawals.length);
}

// Session Issues
function renderAdminIssues() {
    const list = document.getElementById("adminIssueList");
    const filter = document.getElementById("issueFilter")?.value || "open";
    if (!list) return;

    const filtered = adminIssues.filter(issue => {
        const resolved = Boolean(issue.adminIssueResolvedAt);
        return filter === "all" || (filter === "resolved" ? resolved : !resolved);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="admin-empty">No ${filter === "all" ? "" : filter} session issues found.</div>`;
        return;
    }

    list.innerHTML = filtered.map(issue => {
        const resolved = Boolean(issue.adminIssueResolvedAt);
        const tutorResponse = issue.tutorIssueResponse
            ? `<div class="admin-statement"><h4>Tutor response</h4><p>${escapeAdminHtml(issue.tutorIssueResponse)}</p></div>`
            : `<div class="admin-statement empty"><h4>Tutor response</h4><p>No response submitted yet.</p></div>`;
        const resolution = issue.adminIssueResolution
            ? `<div class="admin-resolution-summary"><strong>${escapeAdminHtml(issue.adminIssueResolution)}</strong>${issue.adminIssueResolutionNote ? `<p>${escapeAdminHtml(issue.adminIssueResolutionNote)}</p>` : ""}</div>`
            : "";

        return `
            <article class="admin-issue-card">
                <div class="admin-issue-head">
                    <div>
                        <h3>${escapeAdminHtml(issue.subject || "Tutoring Session")}</h3>
                        <p>${escapeAdminHtml(formatAdminDate(issue.date))} · ${escapeAdminHtml(issue.time || "")}</p>
                        <span class="admin-issue-meta">Learner: ${escapeAdminHtml(issue.learnerName || "Learner")} · Tutor: ${escapeAdminHtml(issue.tutorName || "Tutor")}</span>
                    </div>
                    <span class="admin-status ${resolved ? "resolved" : ""}">${escapeAdminHtml(issue.completionIssueStatus || (resolved ? "Resolved" : "Open"))}</span>
                </div>
                <div class="admin-issue-body">
                    <div class="admin-statement"><h4>Learner report</h4><p>${escapeAdminHtml(issue.completionIssueReason || "No details provided.")}</p></div>
                    ${tutorResponse}
                    ${resolution}
                </div>
                ${resolved ? "" : `<div class="admin-issue-footer"><button type="button" class="admin-resolve-btn" data-issue-id="${issue.id}">Review & Resolve</button></div>`}
            </article>`;
    }).join("");
}

function openAdminResolutionModal(issueId) {
    const issue = adminIssues.find(item => Number(item.id) === Number(issueId));
    const modal = document.getElementById("adminResolutionModal");
    if (!issue || !modal) return;

    selectedAdminIssueId = Number(issueId);
    document.getElementById("adminResolutionDetails").innerHTML = `
        <strong>${escapeAdminHtml(issue.subject || "Session")}</strong><br>
        ${escapeAdminHtml(formatAdminDate(issue.date))} · ${escapeAdminHtml(issue.time || "")}<br>
        Learner: ${escapeAdminHtml(issue.learnerName || "Learner")} · Tutor: ${escapeAdminHtml(issue.tutorName || "Tutor")}`;
    document.getElementById("adminResolutionAction").value = "complete";
    document.getElementById("adminResolutionNote").value = "";
    document.getElementById("adminResolutionError").textContent = "";
    modal.hidden = false;
    document.body.style.overflow = "hidden";
}

function closeAdminResolutionModal() {
    const modal = document.getElementById("adminResolutionModal");
    if (modal) modal.hidden = true;
    selectedAdminIssueId = null;
    document.body.style.overflow = "";
}

async function submitAdminResolution() {
    if (!selectedAdminIssueId) return;

    const action = document.getElementById("adminResolutionAction").value;
    const note = document.getElementById("adminResolutionNote").value.trim();
    const error = document.getElementById("adminResolutionError");
    const button = document.getElementById("submitAdminResolution");

    if (action === "requestinfo" && note.length < 5) {
        error.textContent = "Explain what additional information is required.";
        return;
    }

    button.disabled = true;
    button.textContent = "Submitting...";
    error.textContent = "";

    try {
        const response = await fetch("/Admin/ResolveSessionIssue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId: selectedAdminIssueId, action, note })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not resolve the issue.");
        closeAdminResolutionModal();
        showAdminToast(result.message || "Issue updated.");
        await loadAdminData();
    } catch (requestError) {
        error.textContent = requestError.message;
    } finally {
        button.disabled = false;
        button.textContent = "Submit Decision";
    }
}

// Review Reports
function renderReviewReports() {
    const list = document.getElementById("adminReviewList");
    const filter = document.getElementById("reviewReportFilter")?.value || "pending";
    if (!list) return;

    const filtered = adminReviewReports.filter(report => {
        const pending = report.status === "Pending";
        return filter === "all" || (filter === "resolved" ? !pending : pending);
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="admin-empty">No ${filter === "all" ? "" : filter} review reports found.</div>`;
        return;
    }

    list.innerHTML = filtered.map(report => {
        const pending = report.status === "Pending";
        const stars = "★".repeat(Math.max(0, Math.min(5, Number(report.rating || 0)))) +
            "☆".repeat(Math.max(0, 5 - Number(report.rating || 0)));
        const session = report.subject
            ? `${escapeAdminHtml(report.subject)} · ${escapeAdminHtml(formatAdminDate(report.sessionDate))} ${escapeAdminHtml(report.sessionTime || "")}`
            : "Previous learner review";

        return `
            <article class="admin-issue-card admin-review-card">
                <div class="admin-issue-head">
                    <div>
                        <h3>${escapeAdminHtml(report.learnerName || "Learner")} → ${escapeAdminHtml(report.tutorName || "Tutor")}</h3>
                        <p>${session}</p>
                        <span class="admin-review-stars" aria-label="${report.rating} out of 5 stars">${stars}</span>
                    </div>
                    <span class="admin-status ${pending ? "" : "resolved"}">${escapeAdminHtml(report.status)}</span>
                </div>
                <div class="admin-issue-body">
                    <div class="admin-statement">
                        <h4>Published review</h4>
                        <p>${escapeAdminHtml(report.comment || "No review text.")}</p>
                    </div>
                    <div class="admin-statement">
                        <h4>Report from tutor</h4>
                        <p><strong>${escapeAdminHtml(report.reason || "No reason")}</strong></p>
                        <p>${escapeAdminHtml(report.details || "No additional details provided.")}</p>
                    </div>
                </div>
                ${pending ? `
                    <div class="admin-issue-footer admin-review-actions">
                        <button type="button" class="admin-secondary-btn admin-review-decision" data-report-id="${report.id}" data-action="keep">Keep Published</button>
                        <button type="button" class="admin-danger-btn admin-review-decision" data-report-id="${report.id}" data-action="remove">Remove Review</button>
                    </div>` : ""}
            </article>`;
    }).join("");
}

async function resolveReviewReport(reportId, action) {
    const removing = action === "remove";
    const confirmed = await SkolarDialog.confirm(
        removing
            ? "Remove this review from the platform?"
            : "Dismiss this report and keep the review published?",
        {
            title: removing ? "Remove reported review?" : "Keep review published?",
            type: removing ? "danger" : "warning",
            confirmText: removing ? "Remove Review" : "Keep Published"
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch("/Admin/ResolveReviewReport", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportId, action })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not decide the review report.");
        showAdminToast(result.message || "Review report updated.");
        await loadAdminData();
    } catch (error) {
        showAdminToast(error.message, "error");
    }
}

// Tutor Verifications
function renderTutorVerifications() {
    const list = document.getElementById("adminVerificationList");
    const filter = document.getElementById("verificationFilter")?.value || "all";
    if (!list) return;

    const filtered = adminTutorVerifications.filter(item => {
        const status = item.identityVerificationStatus || "Pending";
        if (filter === "all") return true;
        if (filter === "rejected") return status === "Rejected";
        return status === "Under Review" || status === "Pending";
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="admin-empty">No ${filter === "all" ? "" : filter} tutor verifications found.</div>`;
        return;
    }

    list.innerHTML = filtered.map(item => {
        const status = item.identityVerificationStatus || "Pending";
        const readyForDecision = status === "Under Review";
        const birthdate = item.identityBirthdate || "Not provided";
        const documentLink = item.identityDocumentFile
            ? `<a href="${escapeAdminHtml(item.identityDocumentFile)}" target="_blank" rel="noopener">Open ID document</a>`
            : `<span>Missing ID document</span>`;
        const selfieLink = item.identitySelfieFile
            ? `<a href="${escapeAdminHtml(item.identitySelfieFile)}" target="_blank" rel="noopener">Open selfie</a>`
            : `<span>Missing selfie</span>`;

        return `
            <article class="admin-issue-card admin-verification-card">
                <div class="admin-issue-head">
                    <div>
                        <h3>${escapeAdminHtml(item.tutorName || "Tutor")}</h3>
                        <p>${escapeAdminHtml(item.email || "No email")} · ${escapeAdminHtml(item.contactNumber || "No contact")}</p>
                        <span class="admin-issue-meta">${escapeAdminHtml(item.education || "No display title")}</span>
                    </div>
                    <span class="admin-status ${status === "Rejected" ? "danger" : ""}">${escapeAdminHtml(status)}</span>
                </div>
                <div class="admin-issue-body">
                    <div class="admin-statement">
                        <h4>Identity details</h4>
                        <p><strong>${escapeAdminHtml(item.identityLegalName || "No legal name")}</strong></p>
                        <p>Birthdate: ${escapeAdminHtml(birthdate)}</p>
                        <p>${escapeAdminHtml(item.identityDocumentType || "ID")} · ${escapeAdminHtml(item.identityDocumentNumber || "No ID number")}</p>
                    </div>
                    <div class="admin-statement admin-verification-files">
                        <h4>Submitted files</h4>
                        <p>${documentLink}</p>
                        <p>${selfieLink}</p>
                    </div>
                    ${item.identityVerificationNote ? `
                        <div class="admin-resolution-summary">
                            <strong>Latest note</strong>
                            <p>${escapeAdminHtml(item.identityVerificationNote)}</p>
                        </div>` : ""}
                </div>
                ${readyForDecision ? `
                    <div class="admin-issue-footer admin-review-actions">
                        <button type="button" class="admin-secondary-btn admin-verification-decision" data-tutor-id="${item.id}" data-action="approve">Approve</button>
                        <button type="button" class="admin-danger-btn admin-verification-decision" data-tutor-id="${item.id}" data-action="reject">Reject</button>
                    </div>` : ""}
            </article>`;
    }).join("");
}

async function resolveTutorVerification(tutorId, action) {
    const approving = action === "approve";
    const note = "";

    const confirmed = await SkolarDialog.confirm(
        approving
            ? "Approve this tutor identity verification?"
            : "Send this verification back for resubmission?",
        {
            title: approving ? "Approve tutor?" : "Reject verification?",
            type: approving ? "warning" : "danger",
            confirmText: approving ? "Approve" : "Reject"
        }
    );

    if (!confirmed) return;

    try {
        const response = await fetch("/Admin/ResolveTutorVerification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tutorId, action, note })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not decide the verification.");
        showAdminToast(result.message || "Tutor verification updated.");
        await loadAdminData();
    } catch (error) {
        showAdminToast(error.message, "error");
    }
}

// Tutor Withdrawals
function renderTutorWithdrawals() {
    const list = document.getElementById("adminWithdrawalList");
    const filter = document.getElementById("withdrawalFilter")?.value || "open";
    if (!list) return;

    const filtered = adminTutorWithdrawals.filter(item => {
        if (filter === "all") return true;
        if (filter === "released") return item.status === "Released";
        if (filter === "rejected") return item.status === "Rejected";
        return item.status === "Requested" || item.status === "Processing";
    });

    if (filtered.length === 0) {
        list.innerHTML = `<div class="admin-empty">No ${filter === "all" ? "" : filter} tutor withdrawals found.</div>`;
        return;
    }

    list.innerHTML = filtered.map(item => {
        const open = item.status === "Requested" || item.status === "Processing";
        return `
            <article class="admin-issue-card admin-withdrawal-card">
                <div class="admin-issue-head">
                    <div>
                        <h3>${escapeAdminHtml(item.tutorName || "Tutor")} - ${formatAdminMoney(item.amount)}</h3>
                        <p>${escapeAdminHtml(item.method || "GCash")} - Requested ${escapeAdminHtml(formatAdminDate(item.requestedAt))}</p>
                        <span class="admin-issue-meta">${escapeAdminHtml(item.tutorEmail || "No email")} - ${Number(item.totalHoursTaught || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })} taught hours</span>
                    </div>
                    <span class="admin-status ${item.status === "Rejected" ? "danger" : item.status === "Released" ? "resolved" : ""}">${escapeAdminHtml(item.status)}</span>
                </div>
                <div class="admin-issue-body admin-withdrawal-body">
                    <div class="admin-statement">
                        <h4>GCash details</h4>
                        <p><strong>Account name:</strong> ${escapeAdminHtml(item.gCashAccountName || "No account name")}</p>
                        <p><strong>Account number:</strong> ${escapeAdminHtml(item.gCashAccountNumber || "No account number")}</p>
                        <p><strong>Contact:</strong> ${escapeAdminHtml(item.tutorContact || "No contact")}</p>
                    </div>
                    <div class="admin-statement">
                        <h4>Payout breakdown</h4>
                        <p><strong>${formatAdminMoney(item.netAmount)}</strong> net from ${Number(item.payoutCount || 0)} payout record(s)</p>
                        <p>Gross: ${formatAdminMoney(item.grossAmount)} | Fees: ${formatAdminMoney(item.platformFeeAmount)} | Fines: ${formatAdminMoney(item.fineAmount)}</p>
                    </div>
                    ${item.adminNote ? `
                        <div class="admin-resolution-summary">
                            <strong>Admin note / reference</strong>
                            <p>${escapeAdminHtml(item.adminNote)}</p>
                        </div>` : ""}
                </div>
                ${open ? `
                    <div class="admin-issue-footer admin-review-actions">
                        <button type="button" class="admin-secondary-btn admin-withdrawal-decision" data-withdrawal-id="${item.id}" data-action="processing">Mark Processing</button>
                        <button type="button" class="admin-primary-btn admin-withdrawal-decision" data-withdrawal-id="${item.id}" data-action="release">Mark Released</button>
                        <button type="button" class="admin-danger-btn admin-withdrawal-decision" data-withdrawal-id="${item.id}" data-action="reject">Reject</button>
                    </div>` : ""}
            </article>`;
    }).join("");
}

async function resolveTutorWithdrawal(withdrawalId, action) {
    const labels = {
        processing: "Mark this withdrawal as processing?",
        release: "Mark this GCash withdrawal as released?",
        reject: "Reject this withdrawal and return the earnings to the tutor balance?"
    };
    const notePrompt = action === "release"
        ? "Enter GCash reference number or release note:"
        : action === "reject"
            ? "Enter the rejection reason:"
            : "Optional processing note:";
    const note = window.prompt(notePrompt, "");
    if (note === null) return;

    if ((action === "release" || action === "reject") && note.trim().length < 3) {
        showAdminToast("Add a short note or reference before finalizing.", "error");
        return;
    }

    const confirmed = await SkolarDialog.confirm(labels[action] || "Update this withdrawal?", {
        title: "Update withdrawal?",
        type: action === "reject" ? "danger" : "warning",
        confirmText: action === "release" ? "Mark Released" : action === "reject" ? "Reject" : "Mark Processing"
    });

    if (!confirmed) return;

    try {
        const response = await fetch("/Admin/ResolveTutorWithdrawal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ withdrawalId, action, note: note.trim() })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not update the withdrawal.");
        showAdminToast(result.message || "Withdrawal updated.");
        await loadAdminData();
    } catch (error) {
        showAdminToast(error.message, "error");
    }
}

// Navigation
function switchAdminTab(tabName) {
    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.adminTab === tabName);
    });

    document.getElementById("sessionIssuesPanel").hidden = tabName !== "sessions";
    document.getElementById("reviewReportsPanel").hidden = tabName !== "reviews";
    document.getElementById("tutorVerificationsPanel").hidden = tabName !== "verifications";
    document.getElementById("tutorWithdrawalsPanel").hidden = tabName !== "withdrawals";
}

// Helpers
function showAdminToast(message, type = "success") {
    const toast = document.getElementById("adminToast");
    if (!toast) return;
    clearTimeout(adminToastTimer);
    toast.textContent = message;
    toast.className = `admin-toast ${type}`;
    toast.hidden = false;
    adminToastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function setAdminText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
}

function formatAdminDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Unknown date"
        : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatAdminMoney(value) {
    return `PHP ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeAdminHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Events
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab));
    });

    document.getElementById("issueFilter")?.addEventListener("change", renderAdminIssues);
    document.getElementById("reviewReportFilter")?.addEventListener("change", renderReviewReports);
    document.getElementById("verificationFilter")?.addEventListener("change", renderTutorVerifications);
    document.getElementById("withdrawalFilter")?.addEventListener("change", renderTutorWithdrawals);

    document.getElementById("adminIssueList")?.addEventListener("click", event => {
        const button = event.target.closest(".admin-resolve-btn");
        if (button) openAdminResolutionModal(Number(button.dataset.issueId));
    });

    document.getElementById("adminReviewList")?.addEventListener("click", event => {
        const button = event.target.closest(".admin-review-decision");
        if (button) resolveReviewReport(Number(button.dataset.reportId), button.dataset.action);
    });

    document.getElementById("adminVerificationList")?.addEventListener("click", event => {
        const button = event.target.closest(".admin-verification-decision");
        if (button) resolveTutorVerification(Number(button.dataset.tutorId), button.dataset.action);
    });

    document.getElementById("adminWithdrawalList")?.addEventListener("click", event => {
        const button = event.target.closest(".admin-withdrawal-decision");
        if (button) resolveTutorWithdrawal(Number(button.dataset.withdrawalId), button.dataset.action);
    });

    document.querySelectorAll("[data-close-admin-modal]").forEach(element => {
        element.addEventListener("click", closeAdminResolutionModal);
    });

    document.getElementById("submitAdminResolution")?.addEventListener("click", submitAdminResolution);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeAdminResolutionModal();
    });

    loadAdminData().catch(error => {
        const issueList = document.getElementById("adminIssueList");
        const reviewList = document.getElementById("adminReviewList");
        const verificationList = document.getElementById("adminVerificationList");
        const withdrawalList = document.getElementById("adminWithdrawalList");
        if (issueList) issueList.innerHTML = `<div class="admin-empty">${escapeAdminHtml(error.message)}</div>`;
        if (reviewList) reviewList.innerHTML = `<div class="admin-empty">${escapeAdminHtml(error.message)}</div>`;
        if (verificationList) verificationList.innerHTML = `<div class="admin-empty">${escapeAdminHtml(error.message)}</div>`;
        if (withdrawalList) withdrawalList.innerHTML = `<div class="admin-empty">${escapeAdminHtml(error.message)}</div>`;
    });
});
