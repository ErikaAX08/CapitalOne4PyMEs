// The four precomputed states of PRD 5.4.
//
// They are imported from apps/web/public/states/ rather than copied here
// because that directory is what services/engine/scripts/generate_states.py
// writes, and CI's data gate checks the files reproduce byte for byte with seed
// 42. A copy would be a number with no engine run behind it.
//
// They are bundled, not fetched: PRD 5.5 requires the base state to render on
// load without waiting for the network, and the degradation path must work when
// the network is exactly what failed.
import base from "../../../../public/states/base.json";
import crisis from "../../../../public/states/crisis.json";
import reinforced from "../../../../public/states/reinforced.json";
import tension from "../../../../public/states/tension.json";
import type { StateDocument } from "../model/types";

export const FALLBACK_STATES = [
  base,
  tension,
  crisis,
  reinforced,
] as unknown as StateDocument[];

/** The state the interface opens on, before any request is made. */
export const INITIAL_STATE = base as unknown as StateDocument;
