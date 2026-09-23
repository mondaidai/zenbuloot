import { Sidebar } from "@components/Sidebar";
import "@styles/layout.css";
const mainLinks = [
  { path: "/", label: "Home" },
  { path: "/item-shop", label: "Item Shop" },
  { path: "/my-items", label: "My Items" },
  { path: "/history", label: "History" },
  { path: "/about", label: "About" },
];

const gamesLinks = [
  { path: "/pick-a-chance", label: "Pick-a-Chance" },
  // add other games here later
];

export function Layout({ children, showGamesSidebar = false }) {
  return (
    <div className="layout-container">
      <div className="sidebar-column">
        <Sidebar links={mainLinks} />
        {showGamesSidebar && <Sidebar links={gamesLinks} />}
      </div>
      <div className="layout-main">{children}</div>
    </div>
  );
}
