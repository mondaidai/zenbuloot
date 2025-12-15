import "@styles/home.css";
import { Link } from "react-router-dom";

const menu = [
  { id: 1, name: "Item shop", path: "/item-shop", image: "/images/menu/zkn_coins.png"},
  { id: 2, name: "Pick-a-Chance", path: "/pick-a-chance", image: "/images/menu/pick-a-chance.png" },
  { id: 3, name: "My Items", path: "/my-items", image: "/images/menu/my_items.png" },
  { id: 4, name: "History", path: "/history", image: "/images/menu/history.png" },
  { id: 5, name: "About", path: "/about", image: "/images/menu/about.png" },
];
const games = [];

export function Home() {
  const placeholderImage = "/images/menu/placeholder.png";

  return (
    <div className="home-container">
      <div className="home-inner">

        {/* Menu section */}
        <h1 className="title">Menu</h1>
        <div className="game-list">
          {menu.map(item => (
            <Link key={item.id} className="game-card" to={item.path}>
              <img
                src={item.image || placeholderImage}
                alt={item.name}
                className="game-card-image"
              />
              <span className="game-card-title">{item.name}</span>
            </Link>
          ))}
        </div>

        {/* Games section */}
        <div className="game-list">
          {games.map(game => (
            <Link key={game.id} className="game-card" to={game.path}>
              <img
                src={game.image || placeholderImage}
                alt={game.name}
                className="game-card-image"
              />
              <span className="game-card-title">{game.name}</span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
