// A COMPLETELY DIFFERENT index.ts — no relation to the root auth module.
// Used to test Bug #2: when CIS runs on the root index.ts (sourceBase='index'),
// the importer regex also matches files that import from THIS services/index.ts.

export function getUser(id: string): { id: string; name: string } {
    return { id, name: 'Unknown' };
}

export function deleteUser(id: string): boolean {
    console.log('delete', id);
    return true;
}
