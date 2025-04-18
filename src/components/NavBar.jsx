import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";

const NavBar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`navbar ${scrolled ? "scrolled" : "not-scrolled"}`}>
      <div className="inner">
        <a href="#hero" className="logo">
          Modern Tech Works
        </a>

        <div className="flex items-center gap-4 " >
          <ThemeToggle />
          <a href="#contact" className="contact-btn group">
            <div className="inner">
              <span>Contact Us</span>
            </div>
          </a>
        </div>
      </div>
    </header>
  );
};

export default NavBar;
