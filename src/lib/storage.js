// Storage adapter.
//
// Phase 1: browser localStorage (no accounts, no backend).
// Phase 4: swap the body of these three functions to call /api/pins with the
//          signed-in user's token. Nothing else in the app changes.

const PREFIX = "playfinder:";

export async function get(key) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("storage.get failed", err);
    return null;
  }
}

export async function set(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn("storage.set failed", err);
    return false;
  }
}

export async function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
    return true;
  } catch (err) {
    console.warn("storage.remove failed", err);
    return false;
  }
}
