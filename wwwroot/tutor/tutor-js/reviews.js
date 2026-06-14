document.addEventListener("DOMContentLoaded", () => {
  let reviewsData = [];

  const reviewsList = document.getElementById("reviewsList");
  const reportModal = document.getElementById("reportModal");
  const reportForm = document.getElementById("reportForm");
  const reportReviewId = document.getElementById("reportReviewId");
  const reportReason = document.getElementById("reportReason");
  const reportDetails = document.getElementById("reportDetails");
  const reportError = document.getElementById("reportError");
  const submitReport = document.getElementById("submitReport");

  // Reviews
  async function loadReviews() {
    try {
      const response = await fetch("/Tutor/MyReviews");
      if (!response.ok) throw new Error("Could not load reviews.");

      const data = await response.json();
      reviewsData = data.map(review => ({
        id: review.id,
        student: review.learnerName || "Learner",
        stars: review.rating,
        text: review.comment || "",
        subject: review.subject || "",
        sessionDate: review.sessionDate ? formatDate(review.sessionDate) : "",
        sessionTime: review.sessionTime || "",
        reviewedDate: formatDate(review.createdAt),
        isReported: Boolean(review.isReported)
      }));

      renderReviews();
    } catch (error) {
      if (reviewsList) {
        reviewsList.innerHTML = '<p style="padding:20px;color:#888">Could not load reviews.</p>';
      }
      console.error(error);
    }
  }

  function renderReviews() {
    if (!reviewsList) return;

    if (reviewsData.length === 0) {
      reviewsList.innerHTML = `
        <div class="rv-empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
          </svg>
          <p>No reviews found</p>
        </div>`;
      return;
    }

    reviewsList.innerHTML = reviewsData.map(review => {
      const sessionDetails = [review.subject, review.sessionDate, review.sessionTime]
        .filter(Boolean)
        .join(" · ");

      const reportAction = review.isReported
        ? '<span class="rv-reported-badge">Reported</span>'
        : `<button type="button" class="rv-report-btn" data-review-id="${review.id}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 21V4m0 0h11l-1.5 4L16 12H5"/>
            </svg>
            Report
          </button>`;

      return `
        <article class="rv-card">
          <div class="rv-card-header">
            <h3 class="rv-student">${escapeHtml(review.student)}</h3>
            <div class="rv-card-status">
              <span class="rv-published-badge">Published</span>
              ${reportAction}
            </div>
          </div>
          <div class="rv-session">${escapeHtml(sessionDetails || "Previous learner review")}</div>
          <div class="rv-date">Reviewed ${escapeHtml(review.reviewedDate)}</div>
          ${renderStars(review.stars)}
          <p class="rv-text">${escapeHtml(review.text)}</p>
        </article>`;
    }).join("");
  }

  function renderStars(count) {
    let stars = '<div class="rv-stars">';
    for (let index = 1; index <= 5; index++) {
      const fill = index <= count ? "#F5A623" : "#E0E5EC";
      stars += `<svg viewBox="0 0 24 24" width="18" height="18" fill="${fill}">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>`;
    }
    return `${stars}</div>`;
  }

  // Report
  function openReportModal(reviewId) {
    if (!reportModal || !reportReviewId) return;
    reportReviewId.value = String(reviewId);
    if (reportReason) reportReason.value = "";
    if (reportDetails) reportDetails.value = "";
    if (reportError) reportError.textContent = "";
    reportModal.classList.add("show");
    reportModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("rv-modal-open");
    reportReason?.focus();
  }

  function closeReportModal() {
    if (!reportModal) return;
    reportModal.classList.remove("show");
    reportModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("rv-modal-open");
  }

  reviewsList?.addEventListener("click", event => {
    const button = event.target.closest(".rv-report-btn");
    if (!button) return;
    openReportModal(Number(button.dataset.reviewId));
  });

  document.getElementById("closeReportModal")?.addEventListener("click", closeReportModal);
  document.getElementById("cancelReport")?.addEventListener("click", closeReportModal);

  reportModal?.addEventListener("click", event => {
    if (event.target === reportModal) closeReportModal();
  });

  reportForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const reviewId = Number(reportReviewId?.value);
    const reason = reportReason?.value.trim() || "";
    const details = reportDetails?.value.trim() || "";

    if (!reviewId || !reason) {
      if (reportError) reportError.textContent = "Select a reason for the report.";
      return;
    }

    if (reason === "Other" && !details) {
      if (reportError) reportError.textContent = "Explain why you are reporting this review.";
      return;
    }

    if (submitReport) submitReport.disabled = true;
    if (reportError) reportError.textContent = "";

    try {
      const response = await fetch("/Tutor/ReportReview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, reason, details })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(result.message || "Could not submit the report.");

      const review = reviewsData.find(item => item.id === reviewId);
      if (review) review.isReported = true;
      closeReportModal();
      renderReviews();
      showToast(result.message || "Review reported for moderation.");
    } catch (error) {
      if (reportError) reportError.textContent = error.message;
    } finally {
      if (submitReport) submitReport.disabled = false;
    }
  });

  function showToast(message) {
    const oldToast = document.querySelector(".rv-toast");
    oldToast?.remove();

    const toast = document.createElement("div");
    toast.className = "rv-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, 4000);
  }

  // Page
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
      closeReportModal();
    }
  });

  loadReviews();
});

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
