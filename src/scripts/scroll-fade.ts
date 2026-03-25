// Enable scroll-fade animations only when JS is available
// Content stays visible without JS (no opacity:0 by default)
document.documentElement.classList.add('scroll-fade-ready');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  { threshold: 0.1 },
);

document.querySelectorAll('.scroll-fade').forEach((el) => observer.observe(el));
