// Regression tests for the Blast Radius false-positive bug:
// function/method declarations were being counted as call sites.
//
// ROOT CAUSE:
//   findCallSites() matched `\bname\s*(` across ALL lines including the
//   declaration line (`export function validateUser(user: User) {`).
//   This meant Blast Radius always showed at least one "self" call site
//   even when the function had zero real callers.
//
// FIX: isDeclarationLine() filters out lines that are declarations before
//   they are added to the call-site list.

import { isDeclarationLine } from '../analysis/CallSiteAnalyzer';

// =============================================================================
// isDeclarationLine — lines that must be EXCLUDED from call sites
// =============================================================================

describe('isDeclarationLine — declaration lines are excluded', () => {

    // Named function declarations
    it('excludes: export function NAME(', () => {
        expect(isDeclarationLine('export function validateUser(user: User): boolean {', 'validateUser')).toBe(true);
    });

    it('excludes: export async function NAME(', () => {
        expect(isDeclarationLine('export async function savePayment(amount: number): Promise<boolean> {', 'savePayment')).toBe(true);
    });

    it('excludes: export default function NAME(', () => {
        expect(isDeclarationLine('export default function handler(req: Request): Response {', 'handler')).toBe(true);
    });

    it('excludes: bare function NAME(', () => {
        expect(isDeclarationLine('function processPayment(user: User) {', 'processPayment')).toBe(true);
    });

    it('excludes: async function NAME(', () => {
        expect(isDeclarationLine('async function fetchData(url: string) {', 'fetchData')).toBe(true);
    });

    // Arrow / expression function where the SYMBOL is the variable being declared
    it('excludes: const NAME = (...) =>', () => {
        expect(isDeclarationLine('const formatDate = (d: Date): string => d.toISOString()', 'formatDate')).toBe(true);
    });

    it('excludes: export const NAME = async (...) =>', () => {
        expect(isDeclarationLine('export const deadArrow = () => { return "dead"; }', 'deadArrow')).toBe(true);
    });

    it('excludes: const NAME: Type = function(', () => {
        expect(isDeclarationLine('const fn: RequestHandler = function(req, res) {', 'fn')).toBe(true);
    });

    // Class method declarations with access modifiers
    it('excludes: public async NAME(', () => {
        expect(isDeclarationLine('public async processPayment(amount: number): Promise<boolean> {', 'processPayment')).toBe(true);
    });

    it('excludes: private NAME(', () => {
        expect(isDeclarationLine('private validateToken(token: string): boolean {', 'validateToken')).toBe(true);
    });

    it('excludes: protected static NAME(', () => {
        expect(isDeclarationLine('protected static getInstance(): Auth {', 'getInstance')).toBe(true);
    });

    it('excludes: static readonly NAME(', () => {
        expect(isDeclarationLine('static readonly getDefault()', 'getDefault')).toBe(true);
    });

    // Type-level declarations
    it('excludes: type NAME = ...', () => {
        expect(isDeclarationLine('type Handler = (req: Request) => Response', 'Handler')).toBe(true);
    });

    it('excludes: interface NAME {', () => {
        expect(isDeclarationLine('interface UserService {', 'UserService')).toBe(true);
    });

    it('excludes: class NAME {', () => {
        expect(isDeclarationLine('class PaymentService {', 'PaymentService')).toBe(true);
    });

    it('excludes: abstract class NAME {', () => {
        expect(isDeclarationLine('abstract class BaseService {', 'BaseService')).toBe(true);
    });

    it('excludes: declare function NAME(', () => {
        expect(isDeclarationLine('declare function doSomething(x: number): void', 'doSomething')).toBe(true);
    });

    it('excludes: enum NAME {', () => {
        expect(isDeclarationLine('enum Status { Active, Inactive }', 'Status')).toBe(true);
    });

    // Import statements
    it('excludes: import { NAME } from ...', () => {
        expect(isDeclarationLine("import { validateUser } from './auth'", 'validateUser')).toBe(true);
    });

    it('excludes: import * as NAME from ...', () => {
        expect(isDeclarationLine("import * as auth from './auth'", 'auth')).toBe(true);
    });

    // Export type/class statements
    it('excludes: export interface NAME', () => {
        expect(isDeclarationLine('export interface UserService {', 'UserService')).toBe(true);
    });

    it('excludes: export class NAME', () => {
        expect(isDeclarationLine('export class PaymentService {', 'PaymentService')).toBe(true);
    });

    it('excludes: export abstract class NAME', () => {
        expect(isDeclarationLine('export abstract class BaseService {', 'BaseService')).toBe(true);
    });
});

// =============================================================================
// isDeclarationLine — lines that must be KEPT as call sites
// =============================================================================

describe('isDeclarationLine — call-site lines are kept', () => {

    it('keeps: const x = NAME(arg)', () => {
        expect(isDeclarationLine('const ok = validateUser(req.body.email, req.body.password)', 'validateUser')).toBe(false);
    });

    it('keeps: return NAME(arg)', () => {
        expect(isDeclarationLine('return processPayment(user, amount)', 'processPayment')).toBe(false);
    });

    it('keeps: NAME(arg) standalone statement', () => {
        expect(isDeclarationLine('validateUser(token)', 'validateUser')).toBe(false);
    });

    it('keeps: if (NAME(arg))', () => {
        expect(isDeclarationLine('if (!validateUser(req.user)) { throw new Error(); }', 'validateUser')).toBe(false);
    });

    it('keeps: await NAME(arg)', () => {
        expect(isDeclarationLine('const result = await savePayment(100)', 'savePayment')).toBe(false);
    });

    it('keeps: method call this.NAME(arg)', () => {
        expect(isDeclarationLine('const val = this.processPayment(order)', 'processPayment')).toBe(false);
    });

    it('keeps: chained call x.NAME(arg)', () => {
        expect(isDeclarationLine('const d = service.formatDate(new Date())', 'formatDate')).toBe(false);
    });

    it('keeps: callback () => NAME(arg)', () => {
        expect(isDeclarationLine('arr.map(item => validateUser(item))', 'validateUser')).toBe(false);
    });

    it('does NOT exclude: const OTHER = NAME(arg) (OTHER is declared, not NAME)', () => {
        // The variable being declared is `ok`, not `validateUser`
        expect(isDeclarationLine('const ok = validateUser(req.body)', 'validateUser')).toBe(false);
    });

    it('does NOT exclude: let result = NAME(arg)', () => {
        expect(isDeclarationLine('let result = calculateDiscount(100)', 'calculateDiscount')).toBe(false);
    });

    it('keeps: ternary with NAME()', () => {
        expect(isDeclarationLine('const x = isValid ? validateUser(u) : null', 'validateUser')).toBe(false);
    });
});
