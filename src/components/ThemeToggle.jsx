import { useState, useEffect } from "react";

const ThemeToggle = () => {
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  return (
    <span onClick={toggleTheme} className="theme-toggle-link text-dynamic">
  {theme === "dark" ? "Light Mode" : "Dark Mode"}
</span>
  );
};

export default ThemeToggle;
