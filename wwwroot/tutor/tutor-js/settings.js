document.addEventListener("DOMContentLoaded", () => {
  const pushToggle = document.getElementById("pushNotifications");
  const reviewToggle = document.getElementById("newReviewAlerts");
  const signoutButton = document.getElementById("stSignout");
  const toast = document.getElementById("stToast");

  let isLoading = true;

  // Accordion
  document.querySelectorAll(".st-header").forEach(header => {
    header.addEventListener("click", () => {
      const selectedItem = header.parentElement;
      const selectedContent = header.nextElementSibling;
      const wasOpen = selectedItem.classList.contains("open");

      document.querySelectorAll(".st-item").forEach(item => {
        item.classList.remove("open");

        const content = item.querySelector(".st-content");

        if (content) {
          content.style.maxHeight = null;
        }
      });

      if (!wasOpen) {
        selectedItem.classList.add("open");

        if (selectedContent) {
          selectedContent.style.maxHeight =
            `${selectedContent.scrollHeight}px`;
        }
      }
    });
  });

  // Notification settings
  async function loadSettings() {
    try {
      const response = await fetch(
        "/Tutor/GetNotificationSettings",
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Could not load notification settings."
        );
      }

      const settings = await response.json();

      if (pushToggle) {
        pushToggle.checked =
          Boolean(settings.pushNotificationsEnabled);
      }

      if (reviewToggle) {
        reviewToggle.checked =
          Boolean(settings.newReviewAlertsEnabled);
      }
    } catch (error) {
      showToast(
        "Could not load notification settings.",
        "info"
      );

      console.error(error);
    } finally {
      isLoading = false;
    }
  }

  async function saveSettings(message) {
    if (isLoading) {
      return;
    }

    try {
      const response = await fetch(
        "/Tutor/UpdateNotificationSettings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pushNotificationsEnabled:
              Boolean(pushToggle?.checked),

            newReviewAlertsEnabled:
              Boolean(reviewToggle?.checked)
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          "Could not save notification settings."
        );
      }

      showToast(message, "success");

      window.TutorPortal?.refreshNotifications();
    } catch (error) {
      showToast(
        "Could not save notification settings.",
        "info"
      );

      console.error(error);
    }
  }

  reviewToggle?.addEventListener("change", () => {
    const status = reviewToggle.checked
      ? "enabled"
      : "disabled";

    saveSettings(
      `New review alerts ${status}.`
    );
  });

  pushToggle?.addEventListener("change", async () => {
    if (!pushToggle.checked) {
      await saveSettings(
        "Push notifications disabled."
      );

      return;
    }

    if (!("Notification" in window)) {
      pushToggle.checked = false;

      await saveSettings(
        "Push notifications are unavailable in this browser."
      );

      return;
    }

    const permission =
      await Notification.requestPermission();

    if (permission !== "granted") {
      pushToggle.checked = false;

      await saveSettings(
        "Browser notification permission was not granted."
      );

      return;
    }

    window.TutorPortal?.setPushBaseline();

    await saveSettings(
      "Push notifications enabled."
    );
  });

  // Sign out
  signoutButton?.addEventListener("click", () => {
    showToast("Signing out...", "info");

    window.setTimeout(() => {
      if (typeof logoutUser === "function") {
        logoutUser();
      } else {
        localStorage.removeItem("currentUser");
        window.location.href = "/";
      }
    }, 500);
  });

  // Toast
  function showToast(message, type) {
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.className = "st-toast show";

    toast.classList.add(
      type === "success"
        ? "st-toast-success"
        : "st-toast-info"
    );

    window.setTimeout(() => {
      toast.classList.remove("show");
    }, 2500);
  }

  // Sidebar
  const sidebar =
    document.getElementById("sidebar");

  const hamburger =
    document.getElementById("hamburger");

  const sidebarOverlay =
    document.getElementById("sidebarOverlay");

  function closeSidebar() {
    sidebar?.classList.remove("open");
    sidebarOverlay?.classList.remove("show");
  }

  hamburger?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
    sidebarOverlay?.classList.toggle("show");
  });

  sidebarOverlay?.addEventListener(
    "click",
    closeSidebar
  );

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") {
      return;
    }

    closeSidebar();
  });

  loadSettings();
});