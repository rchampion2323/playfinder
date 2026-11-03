// Contact form: posts JSON to data-endpoint (Formspree, Web3Forms, an Azure
// Function...) when one is set; otherwise opens the visitor's email app.
document.querySelectorAll("form[data-email]").forEach((form) => {
  const status = form.querySelector("[role=status]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      const body = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join("\n");
      location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(form.dataset.subject || "Website enquiry")}&body=${encodeURIComponent(body)}`;
      status.textContent = "Opening your email app…";
      return;
    }
    status.textContent = "Sending…";
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      status.textContent = "Thanks — we'll be in touch soon.";
    } catch {
      status.textContent = `Something went wrong. Please email ${form.dataset.email}.`;
    }
  });
});
