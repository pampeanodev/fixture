import type { FixtureState } from "../types";

/**
 * Decide si auto-disparar el tour "overview" la primera vez que entra el usuario.
 *
 * Criterio: el usuario ya cargó al menos **1 grupo completo** (los 6 partidos
 * del mismo grupo tienen predicción). Si lo hizo, ya entendió el juego y no
 * necesita tour auto. Igual puede lanzarlo a demanda con el botón `?`.
 *
 * Solo se invoca cuando localStorage NO tiene `fixture.tourSeen`, es decir
 * en el primer ingreso del usuario al app.
 *
 * @returns true  => mostrar el overview automáticamente
 *          false => no mostrarlo (el usuario ya tiene experiencia)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function shouldAutoStart(_state: FixtureState): boolean {
  // Cada grupo ("A" a "L") tiene 6 partidos. Usá state.groupMatches:
  //   { id, group, prediction: Score | null, ... }
  //
  // Devolvé false si ≥1 grupo tiene los 6 partidos con prediction != null.
  // Devolvé true en caso contrario.
  //
  // TODO: implementá (≈5 líneas).
  return true;
}
