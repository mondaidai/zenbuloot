// ShopLoadingState.jsx
import "./ShopLoadingState.css";
// components/ShopLoadingState.jsx
export function ShopLoadingState() {
  return (
    <div className="shop-state-wrapper">
      <h1 className="shop-title">Item Shop</h1>
      <div className="loading-state">
        <div className="loading-spinner"></div>
        Loading items...
      </div>
    </div>
  );
}

// ShopErrorState.jsx
export function ShopErrorState({ error }) {
  return (
    <div className="shop-state-wrapper">
      <h1 className="shop-title">Item Shop</h1>
      <div className="error-state">
        <div className="error-icon">⚠️</div>
        Error loading items: {error}
        <button
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// EmptyShopState.jsx
export function EmptyShopState() {
  return (
    <div className="shop-state-wrapper">
      <div className="empty-state">
        <div className="empty-icon">📦</div>
        No items available in the shop right now.
        <div className="empty-subtitle">Check back later for new items!</div>
      </div>
    </div>
  );
}
