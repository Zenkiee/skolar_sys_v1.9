document.addEventListener("DOMContentLoaded", () => {
  const DEFAULT_VISIBLE = 5;
  let bookings = [];

  loadProfile();
  loadBookings();
  loadReviews();
  displayCurrentDate();
  initializeSidebar();

  async function loadProfile() {
    try {
      const response = await fetch("/Home/Me");
      if (!response.ok) return;
      const user = await response.json();
      const welcomeHeading = document.getElementById("welcomeHeading");
      if (welcomeHeading) {
        const firstName = String(user.name || "Tutor").trim().split(/\s+/)[0];
        welcomeHeading.textContent = `Welcome Back, ${firstName}`;
      }
    } catch (error) {
      console.error("Could not load tutor profile.", error);
    }
  }

  async function loadBookings() {
    try {
      const response = await fetch("/Tutor/MyBookings");
      if (!response.ok) throw new Error("Could not load bookings.");
      const data = await response.json();

      bookings = data.map(booking => ({
        id: booking.id,
        name: booking.learnerName || "Learner",
        subject: booking.subject || "Session",
        status: getDashboardBookingStatus(booking),
        initials: createInitials(booking.learnerName),
        avatar: "avatar-blue"
      }));

      setText("statTotal", bookings.length);
      setText("statPending", bookings.filter(item => item.status === "pending").length);
      setText("statConfirmed", bookings.filter(item => item.status === "confirmed" || item.status === "awaiting").length);
      renderBookings(bookings, DEFAULT_VISIBLE);
    } catch (error) {
      renderBookings([], DEFAULT_VISIBLE);
      console.error(error);
    }
  }

  async function loadReviews() {
    const reviewsContainer = document.getElementById("reviewsContainer");

    try {
      const response = await fetch("/Tutor/MyReviews");
      if (!response.ok) throw new Error("Could not load reviews.");
      const reviews = await response.json();

      setText("statReviews", reviews.length);
      setText("statReviewsLabel", reviews.length === 1 ? "Published review" : "Published reviews");

      const latestReview = [...reviews]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];

      renderLatestReview(latestReview);
    } catch (error) {
      setText("statReviews", 0);
      setText("statReviewsLabel", "Published reviews");
      if (reviewsContainer) {
        reviewsContainer.innerHTML = '<p class="review-empty">Could not load reviews.</p>';
      }
      console.error(error);
    }
  }

  function displayCurrentDate() {
    const dateEl = document.getElementById("currentDate");
    if (!dateEl) return;

    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function renderBookings(data, limit) {
    const bookingsBody = document.getElementById("bookingsBody");
    if (!bookingsBody) return;

    const visibleData = limit ? data.slice(0, limit) : data;
    if (visibleData.length === 0) {
      bookingsBody.innerHTML = '<tr><td colspan="3" class="no-results">No bookings found</td></tr>';
      return;
    }

    bookingsBody.innerHTML = visibleData.map(booking => `
      <tr>
        <td>
          <div class="student-cell">
            <div class="student-avatar ${escapeHtml(booking.avatar)}">${escapeHtml(booking.initials)}</div>
            ${escapeHtml(booking.name)}
          </div>
        </td>
        <td>${escapeHtml(booking.subject)}</td>
        <td><span class="badge badge-${escapeHtml(booking.status)}">${escapeHtml(capitalize(booking.status))}</span></td>
      </tr>
    `).join("");
  }

  function renderLatestReview(review) {
    const reviewsContainer = document.getElementById("reviewsContainer");
    if (!reviewsContainer) return;

    if (!review) {
      reviewsContainer.innerHTML = '<p class="review-empty">No published reviews yet.</p>';
      return;
    }

    const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
    const stars = Array.from({ length: 5 }, (_, index) => {
      const filled = index < rating;
      return `<svg viewBox="0 0 24 24" width="14" height="14" fill="${filled ? "#F5A623" : "none"}" stroke="${filled ? "#F5A623" : "#8DA4B0"}" stroke-width="2">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>`;
    }).join("");

    reviewsContainer.innerHTML = `
      <article class="review-card">
        <div class="review-top">
          <div class="review-user">
            <div class="review-avatar rv-1">${escapeHtml(createInitials(review.learnerName))}</div>
            <span class="review-name">${escapeHtml(review.learnerName || "Learner")}</span>
          </div>
          <span class="badge badge-published">Published</span>
        </div>
        <div class="review-stars" aria-label="${rating} out of 5 stars">${stars}</div>
        <p class="review-text">${escapeHtml(review.comment || "No written comment.")}</p>
        <p class="review-date">${escapeHtml(formatReviewDate(review.createdAt))}</p>
      </article>`;
  }

  function initializeSidebar() {
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
      if (event.key === "Escape") closeSidebar();
    });
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function createInitials(name) {
    const initials = String(name || "Learner")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return initials || "L";
  }

  function getDashboardBookingStatus(booking) {
    const status = String(booking.status || "pending").toLowerCase();
    if (status === "completed") return "done";
    if (status === "disputed" || booking.completionIssueReportedAt) return "disputed";
    if (status === "confirmed" && booking.tutorMarkedDoneAt) return "awaiting";
    return status;
  }

  function capitalize(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function formatReviewDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
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
});
