let availableWithdrawalAmount = 0;

document.addEventListener("DOMContentLoaded", () => {
    setupPhoneInputs();
    setupWithdrawalForm();
    setupFinanceSidebar();
    loadTutorFinance();
});

async function loadTutorFinance() {
    const payoutList = document.getElementById("payoutList");
    try {
        const response = await fetch("/Payment/TutorFinanceData", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not load payout records.");
        renderFinanceSummary(data.summary || {});
        renderWithdrawals(data.withdrawals || []);
        renderPayouts(data.payouts || []);
        renderPenalties(data.penalties || []);
    } catch (error) {
        payoutList.innerHTML = `<div class="history-empty">${escapeFinanceText(error.message)}</div>`;
    }
}

function renderFinanceSummary(summary) {
    availableWithdrawalAmount = Number(summary.availableAmount || 0);
    setFinanceText("financeGross", money(summary.grossAmount));
    setFinanceText("financePlatformFees", money(summary.platformFeeAmount));
    setFinanceText("financeCompensation", money(summary.compensationAmount));
    setFinanceText("financeFines", money(summary.fineAmount));
    setFinanceText("financeNet", money(summary.netAmount));
    setFinanceText("financeAvailable", money(summary.availableAmount));
    setFinanceText("financeHeld", money(summary.heldAmount));
    setFinanceText("financeRequested", money(summary.requestedAmount));
    setFinanceText("financeHoursTaught", `${Number(summary.totalHoursTaught || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })} hrs`);
    setFinanceText("financeFeeRate", `${Number(summary.platformFeePercentage || 35)}%`);
    setFinanceText("financePendingPenalties", Number(summary.pendingPenalties || 0));
    setFinanceText("financeWarnings", Number(summary.warnings || 0));

    const button = document.getElementById("withdrawalButton");
    if (button) {
        button.disabled = availableWithdrawalAmount <= 0;
        button.textContent = availableWithdrawalAmount > 0
            ? `Request ${money(availableWithdrawalAmount)}`
            : "No balance available";
    }
}

function renderWithdrawals(withdrawals) {
    const list = document.getElementById("withdrawalList");
    if (!list) return;

    if (!withdrawals.length) {
        list.innerHTML = '<div class="history-empty">No withdrawal requests yet.</div>';
        return;
    }

    list.innerHTML = withdrawals.map(item => `
        <article class="transaction-card">
            <div class="transaction-head">
                <div><h2>${money(item.amount)}</h2><p>${escapeFinanceText(item.method)} - Requested ${formatFinanceDate(item.requestedAt)}</p></div>
                <span class="status-chip ${String(item.status).toLowerCase()}">${escapeFinanceText(item.status)}</span>
            </div>
            <div class="withdrawal-details">
                <span>GCash account</span>
                <strong>${escapeFinanceText(item.gCashAccountName)} - ${escapeFinanceText(item.gCashAccountNumber)}</strong>
                ${item.adminNote ? `<p>${escapeFinanceText(item.adminNote)}</p>` : ""}
            </div>
        </article>`).join("");
}

function renderPayouts(payouts) {
    const list = document.getElementById("payoutList");
    if (!payouts.length) {
        list.innerHTML = '<div class="history-empty">No payout records yet. Complete a paid session or receive cancellation compensation to create one.</div>';
        return;
    }

    list.innerHTML = payouts.map(item => `
        <article class="transaction-card">
            <div class="transaction-head">
                <div><h2>${escapeFinanceText(item.subject)}</h2><p>${escapeFinanceText(item.learnerName)} - ${formatFinanceDate(item.date)} - ${escapeFinanceText(item.time)}</p></div>
                <span class="status-chip ${String(item.status).toLowerCase()}">${escapeFinanceText(item.status)}</span>
            </div>
            <div class="transaction-meta finance-row">
                <div><span>Gross</span><strong>${money(item.grossAmount)}</strong></div>
                <div><span>Platform fee</span><strong>-${money(item.platformFeeAmount)}</strong></div>
                <div><span>Compensation</span><strong>${money(item.compensationAmount)}</strong></div>
                <div><span>Fine</span><strong>-${money(item.fineAmount)}</strong></div>
                <div><span>Net</span><strong>${money(item.netAmount)}</strong></div>
            </div>
        </article>`).join("");
}

function renderPenalties(penalties) {
    const list = document.getElementById("penaltyList");
    if (!penalties.length) {
        list.innerHTML = '<div class="history-empty">No tutor financial penalties recorded.</div>';
        return;
    }

    list.innerHTML = `<article class="transaction-card"><div class="transaction-head"><div><h2>Tutor penalty ledger</h2><p>Same-day cancellation fines are applied to the next completed session.</p></div></div>${penalties.map(item => `
        <div class="penalty-ledger-row">
            <div><strong>${Number(item.percentage)}% next-session fine</strong><br><small>Source session #${item.sourceBookingId}</small></div>
            <span>${item.status === "Applied" ? `Applied: ${money(item.appliedAmount)}` : "Waiting for next completed session"}</span>
            <span class="status-chip ${String(item.status).toLowerCase()}">${escapeFinanceText(item.status)}</span>
        </div>`).join("")}</article>`;
}

function setupWithdrawalForm() {
    const form = document.getElementById("withdrawalForm");
    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (availableWithdrawalAmount <= 0) {
            showFinanceToast("There are no available earnings to withdraw yet.", true);
            return;
        }

        const method = document.getElementById("withdrawalMethod")?.value.trim() || "";
        const gCashAccountName = document.getElementById("withdrawalAccountName")?.value.trim() || "";
        const gCashAccountNumber = toPhilippinePhoneNumber(document.getElementById("withdrawalAccountNumber")?.value || "");
        const button = document.getElementById("withdrawalButton");

        if (!gCashAccountNumber) {
            showFinanceToast("Enter the 10 digits after +63 for the GCash mobile number.", true);
            return;
        }

        button.disabled = true;
        button.textContent = "Submitting...";

        try {
            const response = await fetch("/Payment/RequestTutorWithdrawal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ method, gCashAccountName, gCashAccountNumber })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "Could not request withdrawal.");

            form.reset();
            showFinanceToast(result.message || "Withdrawal request submitted.");
            await loadTutorFinance();
        } catch (error) {
            showFinanceToast(error.message, true);
            button.disabled = availableWithdrawalAmount <= 0;
            button.textContent = availableWithdrawalAmount > 0
                ? `Request ${money(availableWithdrawalAmount)}`
                : "No balance available";
        }
    });
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

function setupPhoneInputs() {
    document.querySelectorAll(".phone-prefix-field input").forEach(input => {
        input.value = toLocalPhoneDigits(input.value);
        input.addEventListener("input", () => {
            input.value = toLocalPhoneDigits(input.value);
        });
    });
}

function setFinanceText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function money(value) {
    return `PHP ${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFinanceDate(value) {
    if (!value) return "Cancellation compensation";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-PH", { dateStyle: "medium" });
}

function escapeFinanceText(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
}

function showFinanceToast(message, isError = false) {
    const toast = document.getElementById("paymentToast");
    if (!toast) return;

    toast.textContent = message;
    toast.hidden = false;
    toast.classList.toggle("error", isError);
    requestAnimationFrame(() => toast.classList.add("show"));

    clearTimeout(showFinanceToast.timer);
    showFinanceToast.timer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 200);
    }, 3200);
}

function setupFinanceSidebar() {
    const sidebar = document.getElementById("sidebar");
    const hamburger = document.getElementById("hamburger");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    function closeSidebar() {
        sidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("show");
    }

    hamburger?.addEventListener("click", () => {
        sidebar?.classList.toggle("open");
        sidebarOverlay?.classList.toggle("show");
    });

    sidebarOverlay?.addEventListener("click", closeSidebar);
}
