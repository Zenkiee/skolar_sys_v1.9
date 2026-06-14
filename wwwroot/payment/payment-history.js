document.addEventListener("DOMContentLoaded", async () => {
    await loadPaymentLearner();
    await loadPaymentHistory();
});

// Learner
async function loadPaymentLearner() {
    try {
        const response = await fetch("/Home/Me", { cache: "no-store" });
        if (!response.ok) return;

        const user = await response.json();
        const name = String(user.name || "Learner");
        const learnerName = document.getElementById("learnerName");
        const learnerInitial = document.getElementById("learnerInitial");
        const learnerPhoto = document.getElementById("learnerSidebarPhoto");
        const initialText = name.charAt(0).toUpperCase();

        if (learnerName) learnerName.textContent = name;
        if (learnerInitial) learnerInitial.textContent = initialText;

        if (learnerPhoto && learnerInitial) {
            const showInitial = () => {
                learnerPhoto.hidden = true;
                learnerPhoto.removeAttribute("src");
                learnerInitial.hidden = false;
                learnerInitial.textContent = initialText;
            };

            showInitial();

            if (user.profilePhoto) {
                learnerPhoto.onerror = showInitial;
                learnerPhoto.onload = () => {
                    learnerPhoto.hidden = false;
                    learnerInitial.hidden = true;
                };
                learnerPhoto.src = user.profilePhoto;
            } else {
                showInitial();
            }
        }
    } catch (error) {
        console.error(error);
    }
}

function togglePaymentMenu() {
    document.getElementById("portalSidebar")?.classList.toggle("active");
    document.getElementById("sidebarOverlay")?.classList.toggle("active");
}

function closePaymentMenu() {
    document.getElementById("portalSidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");
}

async function logoutLearnerFromPayment() {
    if (typeof logoutUser === "function") {
        await logoutUser();
        return;
    }

    window.location.href = "/";
}

async function loadPaymentHistory() {
    const list = document.getElementById("transactionList");
    try {
        const response = await fetch("/Payment/MyTransactions");
        if (!response.ok) throw new Error("Could not load payment records.");
        const data = await response.json();
        renderVouchers(data.vouchers || []);
        renderTransactions(data.transactions || []);
    } catch (error) {
        list.innerHTML = `<div class="history-empty">${escapePaymentText(error.message)}</div>`;
    }
}

function renderTransactions(transactions) {
    const list = document.getElementById("transactionList");
    if (transactions.length === 0) {
        list.innerHTML = '<div class="history-empty">No payment transactions yet.</div>';
        return;
    }

    list.innerHTML = transactions.map(transaction => `
        <article class="transaction-card">
            <div class="transaction-head">
                <div>
                    <h2>${escapePaymentText(transaction.checkoutReference)}</h2>
                    <p>${formatPaymentDate(transaction.createdAt)}</p>
                </div>
                <span class="status-chip ${String(transaction.status).toLowerCase()}">${escapePaymentText(transaction.status)}</span>
            </div>
            <div class="transaction-meta">
                <div><span>Checkout amount</span><strong>₱${Number(transaction.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></div>
                <div><span>Sessions</span><strong>${transaction.sessions.length}</strong></div>
                <div><span>Refund requests</span><strong>${transaction.refunds.length}</strong></div>
            </div>
            <div>
                ${transaction.sessions.map(session => `
                    <div class="session-payment-row">
                        <div><strong>${escapePaymentText(session.subject)}</strong><br><small>${escapePaymentText(session.tutorName)}</small></div>
                        <span>${formatPaymentDate(session.date)}<br><small>${escapePaymentText(session.time)}</small></span>
                        <strong>₱${Number(session.sessionAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
                        <span class="status-chip ${String(session.paymentStatus).toLowerCase()}">${escapePaymentText(session.paymentStatus)}</span>
                    </div>`).join("")}
            </div>
            ${transaction.refunds.map(refund => renderRefund(refund)).join("")}
        </article>`).join("");

}

function renderRefund(refund) {
    return `
        <div class="refund-row">
            <div><strong>Refund ${escapePaymentText(refund.externalRefundId || "Pending reference")}</strong><br><small>${escapePaymentText(refund.reason)}</small></div>
            <span>₱${Number(refund.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            <span class="status-chip ${String(refund.status).toLowerCase()}">${escapePaymentText(refund.status)}</span>
        </div>`;
}

function showPaymentToast(message, type = "success") {
    const toast = document.getElementById("paymentToast");
    if (!toast) return;
    toast.textContent = message;
    toast.className = `payment-toast ${type} show`;
    toast.hidden = false;
    clearTimeout(showPaymentToast.timer);
    showPaymentToast.timer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 180);
    }, 3200);
}

function renderVouchers(vouchers) {
    const section = document.getElementById("voucherSection");
    const grid = document.getElementById("voucherGrid");
    section.hidden = vouchers.length === 0;
    grid.innerHTML = vouchers.map(voucher => `
        <div class="voucher-card">
            <span>${escapePaymentText(voucher.status)}</span>
            <strong>${Number(voucher.percentage)}% OFF</strong>
            <code>${escapePaymentText(voucher.code)}</code>
            <p>Maximum value: ₱${Number(voucher.maximumAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
        </div>`).join("");
}

function formatPaymentDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function escapePaymentText(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
}
