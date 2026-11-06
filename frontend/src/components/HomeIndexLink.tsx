type HomeIndexLinkProps = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function HomeIndexLink({ label, onClick, disabled = false }: HomeIndexLinkProps) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="home-index-row">
      <span className="home-index-label">{label}</span>
    </button>
  );
}
