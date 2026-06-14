async function requireRole(requiredRole) {
    try {
        const response = await fetch("/Home/Me");

        if (!response.ok) {
            window.location.href = `/Home/Account?role=${requiredRole}`;
            return;
        }

        const user = await response.json();

        if (user.role !== requiredRole) {
            await SkolarDialog.alert("You are not allowed to access this page.", { title: "Access denied", type: "danger" });
            window.location.href = "/";
        }

    } catch (err) {
        window.location.href = `/Home/Account?role=${requiredRole}`;
    }
}

async function logoutUser() {
    await fetch("/Home/Logout", { method: "POST" });
    window.location.href = "/";
}