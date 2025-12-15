import { NavLink } from "react-router-dom";
import "@styles/sidebar.css";

export function Sidebar({ links }) {
  return (
    <nav className="sidebar">
      <ul>
        {links.map((link) => (
          <li key={link.path}>
            <NavLink
              to={link.path}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
