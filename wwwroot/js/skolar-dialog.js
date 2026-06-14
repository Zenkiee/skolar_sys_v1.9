(() => {
    let activeResolver = null;
    let lastFocusedElement = null;
    let toastTimer = null;

    function ensureDialog() {
        let root = document.getElementById("skolarDialogRoot");
        if (root) return root;

        root = document.createElement("div");
        root.id = "skolarDialogRoot";
        root.className = "skolar-dialog-root";
        root.hidden = true;
        root.innerHTML = `
            <div class="skolar-dialog-backdrop" data-skolar-dialog-close></div>
            <section class="skolar-dialog-card" role="dialog" aria-modal="true" aria-labelledby="skolarDialogTitle" aria-describedby="skolarDialogMessage">
                <button type="button" class="skolar-dialog-close" data-skolar-dialog-close aria-label="Close">×</button>
                <div class="skolar-dialog-icon" id="skolarDialogIcon" aria-hidden="true">!</div>
                <h2 id="skolarDialogTitle">Notice</h2>
                <p id="skolarDialogMessage"></p>
                <div class="skolar-dialog-actions">
                    <button type="button" class="skolar-dialog-secondary" id="skolarDialogCancel">Cancel</button>
                    <button type="button" class="skolar-dialog-primary" id="skolarDialogConfirm">OK</button>
                </div>
            </section>`;

        document.body.appendChild(root);
        root.querySelectorAll("[data-skolar-dialog-close]").forEach(element => {
            element.addEventListener("click", () => closeDialog(false));
        });
        root.querySelector("#skolarDialogCancel").addEventListener("click", () => closeDialog(false));
        root.querySelector("#skolarDialogConfirm").addEventListener("click", () => closeDialog(true));
        document.addEventListener("keydown", event => {
            if (!root.hidden && event.key === "Escape") closeDialog(false);
        });

        return root;
    }

    function closeDialog(result) {
        const root = document.getElementById("skolarDialogRoot");
        if (!root || root.hidden) return;
        root.hidden = true;
        document.body.classList.remove("skolar-dialog-open");
        if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
        if (activeResolver) activeResolver(result);
        activeResolver = null;
    }

    function openDialog(message, options = {}) {
        const root = ensureDialog();
        const type = options.type || "info";
        const isConfirm = options.mode === "confirm";
        const icons = { info: "i", success: "✓", warning: "!", danger: "!" };

        lastFocusedElement = document.activeElement;
        root.className = `skolar-dialog-root is-${type}`;
        root.querySelector("#skolarDialogTitle").textContent = options.title || (isConfirm ? "Please confirm" : "Notice");
        root.querySelector("#skolarDialogMessage").textContent = String(message || "");
        root.querySelector("#skolarDialogIcon").textContent = icons[type] || "i";

        const cancelButton = root.querySelector("#skolarDialogCancel");
        const confirmButton = root.querySelector("#skolarDialogConfirm");
        cancelButton.hidden = !isConfirm;
        cancelButton.textContent = options.cancelText || "Cancel";
        confirmButton.textContent = options.confirmText || (isConfirm ? "Confirm" : "OK");
        confirmButton.classList.toggle("danger", type === "danger");

        root.hidden = false;
        document.body.classList.add("skolar-dialog-open");
        setTimeout(() => confirmButton.focus(), 0);

        return new Promise(resolve => {
            activeResolver = resolve;
        });
    }

    function ensureToast() {
        let toast = document.getElementById("skolarGlobalToast");
        if (toast) return toast;
        toast = document.createElement("div");
        toast.id = "skolarGlobalToast";
        toast.className = "skolar-global-toast";
        toast.hidden = true;
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
        return toast;
    }

    window.SkolarDialog = {
        alert(message, options = {}) {
            return openDialog(message, { ...options, mode: "alert" });
        },
        confirm(message, options = {}) {
            return openDialog(message, { ...options, mode: "confirm" });
        },
        toast(message, type = "success") {
            const toast = ensureToast();
            clearTimeout(toastTimer);
            toast.className = `skolar-global-toast is-${type}`;
            toast.textContent = String(message || "");
            toast.hidden = false;
            requestAnimationFrame(() => toast.classList.add("show"));
            toastTimer = setTimeout(() => {
                toast.classList.remove("show");
                setTimeout(() => { toast.hidden = true; }, 220);
            }, 3200);
        }
    };
})();
