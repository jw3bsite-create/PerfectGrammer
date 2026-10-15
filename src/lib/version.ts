// Stand der App, sichtbar in der Seitenleiste und in den Einstellungen.
// So lässt sich prüfen, ob ein Update angekommen ist.

declare const __APP_COMMIT__: string;

/** Datum der letzten inhaltlichen Änderung; bei jeder Änderung mitziehen. */
export const APP_STAND = '15.10.2026';

/** Kurzkennung der Version (aus Git oder aus der Datei des Windows-Starts). */
export const APP_COMMIT = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : '';

export const APP_VERSION_TEXT = `Stand ${APP_STAND}${APP_COMMIT ? ` · ${APP_COMMIT}` : ''}`;
