// Barrel file — re-exports from auth.
// Used to test Bug #2: when sourceFilePath is index.ts,
// the basename 'index' also matches imports of services/index.ts.
export { validateUser, formatDate, AuthService } from './auth';

export function main(): void {
    console.log('ArchSetu fixture entry point');
}
