// Imports from services/index — NOT from the root index.ts.
// This file should NOT appear as an importer of root index.ts,
// but Bug #2 causes it to match because sourceBase='index' is too broad.
import { getUser, deleteUser } from './index';

export function fetchUser(id: string) {
    return getUser(id);
}

export function removeUser(id: string) {
    return deleteUser(id);
}
