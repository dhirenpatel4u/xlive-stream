export default function ControlButton({label, icon, onClick, title, disabled=false}) {
  return <button className="control-btn" onClick={onClick} title={title || label} aria-label={title || label} disabled={disabled}>
    {icon ? <img src={icon} alt="" /> : label}
  </button>
}
