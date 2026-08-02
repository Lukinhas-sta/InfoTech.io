document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector(".menu-mobile");
  const menu = document.querySelector(".menu");

  if (menuButton && menu) {
    const closeMenu = () => {
      menu.classList.remove("ativo");
      menuButton.setAttribute("aria-expanded", "false");
    };

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = menu.classList.toggle("ativo");
      menuButton.setAttribute("aria-expanded", String(isOpen));
    });

    menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("click", (event) => {
      if (!menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  const header = document.querySelector(".site-header");
  const updateHeader = () => header?.classList.toggle("scrolled", window.scrollY > 18);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealElements = document.querySelectorAll(
    ".section-heading, .feature-card, .project-card, .trust-grid article, .steps-grid article, .servico-card, .passos article, .faq details, .cta, .page-hero, .servico-top, .sobre-conteudo, .contact-note"
  );

  revealElements.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px" });
    revealElements.forEach((element) => revealObserver.observe(element));
  }

  const counters = document.querySelectorAll("[data-counter]");
  const animateCounter = (element) => {
    const target = Number(element.dataset.counter || 0);
    if (!Number.isFinite(target)) return;
    if (reduceMotion) {
      element.textContent = String(target);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window && !reduceMotion) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach((counter) => {
      counter.textContent = "0";
      counterObserver.observe(counter);
    });
  } else {
    counters.forEach(animateCounter);
  }
});
