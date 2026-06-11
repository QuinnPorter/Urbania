import { SAVE_VERSION, type SaveCurrent, type SaveV1 } from "./serialize";

/**
 * Migration chain keyed by *from*-version: MIGRATIONS[1] upgrades v1 → v2.
 * Migrations are non-mutating (return a new object).
 */
const MIGRATIONS: Record<number, (save: unknown) => unknown> = {
  1: (raw) => {
    const v1 = raw as SaveV1;
    return {
      ...v1,
      v: 2,
      rail: "",
      subway: "",
      railLines: [],
      subwayLines: [],
    };
  },
};

export class NewerSaveError extends Error {
  constructor(version: number) {
    super(
      `This city was made in a newer version of Urbania (save v${version}). ` +
        "Update the app to open it.",
    );
  }
}

/** Run the migration chain until the save is at the current version. */
export function migrateSave(raw: unknown): SaveCurrent {
  if (typeof raw !== "object" || raw === null || !("v" in raw)) {
    throw new Error("Not a valid Urbania save");
  }
  let save = raw as { v: number };
  if (save.v > SAVE_VERSION) throw new NewerSaveError(save.v);
  while (save.v < SAVE_VERSION) {
    const migrate = MIGRATIONS[save.v];
    if (!migrate) throw new Error(`No migration from save v${save.v}`);
    save = migrate(save) as { v: number };
  }
  return save as SaveCurrent;
}
