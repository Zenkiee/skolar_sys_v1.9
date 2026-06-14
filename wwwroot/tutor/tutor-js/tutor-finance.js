document.addEventListener("DOMContentLoaded", loadTutorFinance);

async function loadTutorFinance() {
    const payoutList = document.getElementById("payoutList");
    try {
        const response = await fetch("/Payment/TutorFinanceData", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not load payout records.");
        renderFinanceSummary(data.summary || {});
        renderPayouts(data.payouts || []);
        renderPenalties(data.penalties || []);
    } catch (error) {
        payoutList.innerHTML = `<div class="history-empty">${escapeFinanceText(error.message)}</div>`;
    }
}

function renderFinanceSummary(summary) {
    setFinanceText("financeGross", money(summary.grossAmount));
    setFinanceText("financeCompensation", money(summary.compensationAmount));
    setFinanceText("financeFines", money(summary.fineAmount));
    setFinanceText("financeNet", money(summary.netAmount));
    setFinanceText("financePendingPenalties", Number(summary.pendingPenalties || 0));
    setFinanceText("financeWarnings", Number(summary.warnings || 0));
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
                <div><h2>${escapeFinanceText(item.subject)}</h2><p>${escapeFinanceText(item.learnerName)} · ${formatFinanceDate(item.date)} · ${escapeFinanceText(item.time)}</p></div>
                <span class="status-chip ${String(item.status).toLowerCase()}">${escapeFinanceText(item.status)}</span>
            </div>
            <div class="transaction-meta finance-row">
                <div><span>Gross</span><strong>${money(item.grossAmount)}</strong></div>
                <div><span>Compensation</span><strong>${money(item.compensationAmount)}</strong></div>
                <div><span>Fine</span><strong>−${money(item.fineAmount)}</strong></div>
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

function setFinanceText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function money(value) {
    return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatFinanceDate(value) {
    if (!value) return "Cancellation compensation";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PH", { dateStyle: "medium" });
}

function escapeFinanceText(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
}


// Sidebar
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

document.addEventListener("DOMContentLoaded", setupFinanceSidebar);
