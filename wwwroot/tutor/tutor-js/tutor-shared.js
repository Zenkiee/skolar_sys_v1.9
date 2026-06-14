document.addEventListener("DOMContentLoaded", () => {
  const notificationButton = document.getElementById("notifBtn");
  const notificationDropdown = document.getElementById("notifDropdown");
  const notificationList = document.getElementById("notifList");
  const notificationDot = document.getElementById("notifDot");
  const notificationCount = document.getElementById("notifUnreadCount");
  let pollingTimer = null;

  // Profile
  function initialsFromName(name) {
    return String(name || "Tutor")
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function applyAvatar(element, name, photoUrl) {
    if (!element) return;

    element.style.backgroundImage = "";
    element.classList.remove("has-photo");
    element.textContent = initialsFromName(name);

    if (photoUrl) {
      const separator = photoUrl.includes("?") ? "&" : "?";
      element.textContent = "";
      element.style.backgroundImage = `url("${photoUrl}${separator}v=${Date.now()}")`;
      element.classList.add("has-photo");
    }
  }

  async function loadProfile() {
    try {
      const response = await fetch("/Tutor/MyPortalProfile", { cache: "no-store" });
      if (!response.ok) return;

      const profile = await response.json();
      const name = profile.tutorName || "Tutor";
      const role = profile.education || "Tutor";
      const sidebarName = document.getElementById("sidebarName");
      const sidebarRole = document.querySelector(".profile-card .profile-role");

      if (sidebarName) sidebarName.textContent = name;
      if (sidebarRole) sidebarRole.textContent = role;

      applyAvatar(document.getElementById("sidebarInitials"), name, profile.profilePhoto);
      applyAvatar(document.getElementById("topbarAvatar"), name, profile.profilePhoto);
    } catch (error) {
      console.error("Could not load tutor profile.", error);
    }
  }

  // Notifications
  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function relativeTime(value) {
    const timestamp = new Date(value).getTime();
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days === 1 ? "" : "s"} ago`;
    }

    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function renderNotifications(data) {
    const items = Array.isArray(data.items) ? data.items : [];
    const unreadCount = Number(data.unreadCount || 0);

    if (notificationDot) notificationDot.hidden = unreadCount === 0;
    if (notificationCount) notificationCount.textContent = unreadCount > 0 ? `${unreadCount} new` : "";

    if (!notificationList) return;

    if (items.length === 0) {
      notificationList.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
      return;
    }

    notificationList.innerHTML = items.map(item => `
      <div class="notif-dropdown-item" role="link" tabindex="0" data-url="${escapeHtml(item.url)}">
        <div class="notif-item-icon notif-item-${escapeHtml(item.type)}">
          ${item.type === "review" ? "★" : "●"}
        </div>
        <div class="notif-item-copy">
          <div class="notif-dropdown-title">${escapeHtml(item.title)}</div>
          <div class="notif-dropdown-message">${escapeHtml(item.message)}</div>
          <div class="notif-dropdown-time">${relativeTime(item.createdAt)}</div>
        </div>
      </div>
    `).join("");
  }

  async function showBrowserAlerts(data) {
    if (!data.pushNotificationsEnabled || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) return;

    const storageKey = "tutorPushNotificationBaseline";
    const previousValue = sessionStorage.getItem(storageKey);
    const latestTimestamp = Math.max(...items.map(item => new Date(item.createdAt).getTime()));

    if (!previousValue) {
      sessionStorage.setItem(storageKey, String(latestTimestamp));
      return;
    }

    const previousTimestamp = Number(previousValue);
    const newItems = items
      .filter(item => new Date(item.createdAt).getTime() > previousTimestamp)
      .sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt))
      .slice(-3);

    newItems.forEach(item => {
      const alert = new Notification(item.title, {
        body: item.message,
        icon: "/assets/img/skolar-logo-colored.png",
        tag: item.id
      });

      alert.onclick = () => {
        window.focus();
        window.location.href = item.url;
      };
    });

    sessionStorage.setItem(storageKey, String(latestTimestamp));
  }

  async function loadNotifications() {
    try {
      const response = await fetch("/Tutor/Notifications", { cache: "no-store" });
      if (!response.ok) return;

      const data = await response.json();
      renderNotifications(data);
      await showBrowserAlerts(data);
    } catch (error) {
      if (notificationList) {
        notificationList.innerHTML = '<div class="notif-empty">Could not load notifications.</div>';
      }
      console.error("Could not load tutor notifications.", error);
    }
  }

  async function markNotificationsRead() {
    try {
      const response = await fetch("/Tutor/MarkNotificationsRead", { method: "POST" });
      if (!response.ok) return;

      if (notificationDot) notificationDot.hidden = true;
      if (notificationCount) notificationCount.textContent = "";
    } catch (error) {
      console.error("Could not mark notifications as read.", error);
    }
  }

  function setPushBaseline() {
    sessionStorage.setItem("tutorPushNotificationBaseline", String(Date.now()));
  }

  notificationButton?.addEventListener("click", async event => {
    event.stopPropagation();
    const isOpening = !notificationDropdown?.classList.contains("show");
    notificationDropdown?.classList.toggle("show");
    notificationButton.setAttribute("aria-expanded", String(isOpening));
    if (isOpening) await markNotificationsRead();
  });

  document.addEventListener("click", event => {
    if (notificationButton?.contains(event.target) || notificationDropdown?.contains(event.target)) return;
    notificationDropdown?.classList.remove("show");
    notificationButton?.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    notificationDropdown?.classList.remove("show");
    notificationButton?.setAttribute("aria-expanded", "false");
  });

  notificationList?.addEventListener("click", event => {
    const item = event.target.closest(".notif-dropdown-item[data-url]");
    if (!item) return;
    event.stopPropagation();
    window.location.href = item.dataset.url;
  });

  notificationList?.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest(".notif-dropdown-item[data-url]");
    if (!item) return;
    event.preventDefault();
    window.location.href = item.dataset.url;
  });

  window.addEventListener("tutor:profile-photo-updated", event => {
    const photoUrl = event.detail?.photoUrl || "";
    const name = document.getElementById("sidebarName")?.textContent || "Tutor";
    applyAvatar(document.getElementById("sidebarInitials"), name, photoUrl);
    applyAvatar(document.getElementById("topbarAvatar"), name, photoUrl);
  });

  window.TutorPortal = {
    refreshProfile: loadProfile,
    refreshNotifications: loadNotifications,
    setPushBaseline
  };

  loadProfile();
  loadNotifications();
  pollingTimer = window.setInterval(loadNotifications, 30000);

  window.addEventListener("beforeunload", () => {
    if (pollingTimer) window.clearInterval(pollingTimer);
  });
});
