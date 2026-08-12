export function initMobileMenu(menu: HTMLElement, toggle: HTMLElement): void {
  const close = () => {
    menu.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
  };
  const open = () => {
    menu.classList.remove("hidden");
    toggle.setAttribute("aria-expanded", "true");
  };

  toggle.addEventListener("click", () => {
    if (menu.classList.contains("hidden")) open();
    else close();
  });

  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}
