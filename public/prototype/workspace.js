const toast = document.getElementById("toast");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function showView(name, updateUrl = true) {
  const next = document.querySelector(`[data-view="${name}"]`);
  if (!next) return;

  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  next.classList.add("active");
  document.querySelectorAll("[data-view-target]").forEach((item) => {
    item.classList.toggle("active", item.dataset.viewTarget === name || (name === "project" && item.dataset.viewTarget === "projects"));
  });

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", name);
    history.replaceState({}, "", url);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view-target]").forEach((item) => {
  item.addEventListener("click", () => showView(item.dataset.viewTarget));
});

document.querySelectorAll("[data-open-project]").forEach((item) => {
  item.addEventListener("click", () => showView("project"));
});

document.querySelectorAll("[data-action]").forEach((item) => {
  item.addEventListener("click", () => showToast(item.dataset.action));
});

document.querySelectorAll(".board-tabs button, .detail-tabs button, .locale-switch button").forEach((item) => {
  item.addEventListener("click", () => {
    [...item.parentElement.children].forEach((sibling) => sibling.classList.remove("active"));
    item.classList.add("active");
    showToast(`${item.textContent.trim()} selected`);
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("command").focus();
  }
});

const initialView = new URL(window.location.href).searchParams.get("view") || "research";
showView(initialView, false);
