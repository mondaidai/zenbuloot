import "./QuickActions.css";
// components/QuickActions.jsx
export function QuickActions({ onBuyClick, onSellClick, isLoading = false }) {
  const handleClick = (fn) => (e) => {
    if (isLoading) return;
    fn?.(e);
  };

  return (
    <div className="quick-actions">
      <div 
        role="button" 
        className={`quick-box ${isLoading ? 'disabled' : ''}`}
        onClick={handleClick(onBuyClick)}
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && handleClick(onBuyClick)()}
        aria-disabled={isLoading}
      >
        {isLoading ? <span>Loading…</span> : <strong>Buy ZKN</strong>}
      </div>
      <div 
        role="button" 
        className={`quick-box quick-box--alt ${isLoading ? 'disabled' : ''}`}
        onClick={handleClick(onSellClick)}
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && handleClick(onSellClick)()}
        aria-disabled={isLoading}
      >
        {isLoading ? <span>Loading…</span> : <strong>Sell ZKN</strong>}
      </div>
    </div>
  );
}