/** The colour key shared by the 3D scenes. */
export function Legend3D({ weights = false }: { weights?: boolean }) {
  return (
    <>
      <span><i style={{ background: 'linear-gradient(90deg, var(--signal), var(--sunk))' }} />negative value</span>
      <span><i style={{ background: 'linear-gradient(90deg, var(--sunk), var(--accent))' }} />positive value</span>
      {weights && <span><i style={{ background: 'linear-gradient(90deg, var(--sunk), var(--sim))' }} />attention weight, 0 to 1</span>}
      <span>Faint blocks are earlier steps.</span>
    </>
  )
}
