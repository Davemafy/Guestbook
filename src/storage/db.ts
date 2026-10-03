import Dexie, { type Table } from "dexie";
import type { Observation } from "../domain/observation";

export class GuestbookDB extends Dexie {
  observations!: Table<Observation, string>;

  constructor() {
    super("guestbook");
    this.version(1).stores({
      observations: "id, visitId, createdAt, source, language",
    });
    this.version(2).stores({
      observations: "id, visitId, createdAt, source, language, status, isDemo",
    });
  }
}

export const db = new GuestbookDB();
