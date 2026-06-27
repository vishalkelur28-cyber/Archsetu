import { detectFunctions, findFunctionEnd, SKIP_KEYWORDS } from '../parser/FunctionParser';

function parse(code: string) {
    const lines = code.split('\n');
    return { fns: detectFunctions(code, lines), lines };
}

describe('FunctionParser — detectFunctions', () => {

    // ── Pattern 1: Named declarations ────────────────────────────────────────

    it('detects a basic named function', () => {
        const { fns } = parse('function myFunc() {\n  return 1;\n}');
        expect(fns).toHaveLength(1);
        expect(fns[0].name).toBe('myFunc');
        expect(fns[0].line).toBe(0);
    });

    it('detects an exported named function', () => {
        const { fns } = parse('export function fetchData() {\n  return [];\n}');
        expect(fns[0].name).toBe('fetchData');
    });

    it('detects an exported async named function', () => {
        const { fns } = parse('export async function loadUser() {\n  return null;\n}');
        expect(fns[0].name).toBe('loadUser');
    });

    it('detects a default export function', () => {
        const { fns } = parse('export default function handler() {}');
        expect(fns[0].name).toBe('handler');
    });

    // ── Pattern 2: Arrow functions ────────────────────────────────────────────

    it('detects a const arrow function', () => {
        const { fns } = parse('const myArrow = () => {\n  return 1;\n}');
        expect(fns).toHaveLength(1);
        expect(fns[0].name).toBe('myArrow');
    });

    it('detects an async arrow function', () => {
        const { fns } = parse('const fetchUser = async (id: string) => {\n  return null;\n}');
        expect(fns[0].name).toBe('fetchUser');
    });

    it('detects an exported const arrow function', () => {
        const { fns } = parse('export const validate = (x: string) => x.length > 0;');
        expect(fns[0].name).toBe('validate');
    });

    // ── Pattern 3: Function expressions ──────────────────────────────────────

    it('detects a function expression', () => {
        const { fns } = parse('const myFunc = function() {\n  return 1;\n}');
        expect(fns[0].name).toBe('myFunc');
    });

    it('detects an async function expression', () => {
        const { fns } = parse('const load = async function(id: string) {\n  return null;\n}');
        expect(fns[0].name).toBe('load');
    });

    // ── Pattern 4: Class methods ──────────────────────────────────────────────

    it('detects a public class method', () => {
        const { fns } = parse('class MyClass {\n  public myMethod() {\n    return 1;\n  }\n}');
        expect(fns).toHaveLength(1);
        expect(fns[0].name).toBe('myMethod');
    });

    it('detects a private async class method', () => {
        const { fns } = parse('class Svc {\n  private async process(id: string) {\n    return null;\n  }\n}');
        expect(fns[0].name).toBe('process');
    });

    it('detects a method with a return type annotation', () => {
        const { fns } = parse('class A {\n  getUser(id: string): User {\n    return {} as User;\n  }\n}');
        expect(fns[0].name).toBe('getUser');
    });

    // ── Empty / no-function files ─────────────────────────────────────────────

    it('returns an empty array for a file with no functions', () => {
        expect(parse('const x = 1;\nconst y = 2;\n').fns).toHaveLength(0);
    });

    it('returns an empty array for an empty file', () => {
        expect(detectFunctions('', [])).toHaveLength(0);
    });

    // ── SKIP_KEYWORDS filter ──────────────────────────────────────────────────

    it('does not detect control-flow keywords as functions', () => {
        const code = 'for (const item of items) {}\nif (condition) {}\nwhile (true) {}';
        expect(parse(code).fns).toHaveLength(0);
    });

    it('does not detect "return" as a function', () => {
        const { fns } = parse('function foo() { return(1); }');
        expect(fns.map(f => f.name)).not.toContain('return');
    });

    // ── Multiple functions ────────────────────────────────────────────────────

    it('detects multiple functions in correct line order', () => {
        const code = 'function alpha() {}\nfunction beta() {}\nfunction gamma() {}';
        const { fns } = parse(code);
        expect(fns.map(f => f.name)).toEqual(['alpha', 'beta', 'gamma']);
    });

    // ── endLine calculation ───────────────────────────────────────────────────

    it('sets endLine = startLine for a single-line function', () => {
        const { fns } = parse('function foo() { return 1; }');
        expect(fns[0].endLine).toBe(0);
    });

    it('sets correct endLine for a multi-line function', () => {
        const code = 'function foo() {\n  const x = 1;\n  return x;\n}';
        expect(parse(code).fns[0].endLine).toBe(3);
    });

    it('does not count a brace inside a double-quoted string', () => {
        const code = 'function foo() {\n  const s = "{";\n  return s;\n}';
        expect(parse(code).fns[0].endLine).toBe(3);
    });

    it('does not count a brace inside a single-quoted string', () => {
        const code = "function foo() {\n  const s = '{';\n  return s;\n}";
        expect(parse(code).fns[0].endLine).toBe(3);
    });

    it('does not count a brace inside a line comment', () => {
        const code = 'function foo() {\n  // fake { brace\n  return 1;\n}';
        expect(parse(code).fns[0].endLine).toBe(3);
    });

    it('does not count a brace inside a block comment', () => {
        const code = 'function foo() {\n  /* fake { brace } */\n  return 1;\n}';
        expect(parse(code).fns[0].endLine).toBe(3);
    });

    it('handles template literals that span lines', () => {
        const code = 'function foo() {\n  const s = `hello\n  world`;\n  return s;\n}';
        expect(parse(code).fns[0].endLine).toBe(4);
    });

    it('handles template literal expressions with braces on one line', () => {
        const code = "function foo() {\n  return `${condition ? 'yes' : 'no'}`;\n}";
        expect(parse(code).fns[0].endLine).toBe(2);
    });

    // ── character position ────────────────────────────────────────────────────

    it('reports the correct column of the function name', () => {
        // "  function myFunc() {}" — 'myFunc' starts at char 11
        const { fns } = parse('  function myFunc() {}');
        expect(fns[0].character).toBe(11);
    });

    // ── Known limitations (document current behaviour) ────────────────────────

    it('LIMITATION: multiline arrow-param list is not detected', () => {
        // const fn = (\n  a: string\n) => {}  — regex requires params on same line
        const code = 'const fn = (\n  a: string,\n  b: number\n) => {\n  return a;\n}';
        expect(parse(code).fns).toHaveLength(0); // known gap
    });

    it('typed arrow with a type annotation IS detected (parser handles this correctly)', () => {
        // const handler: RequestHandler = async (req, res) => {}
        // The [^=\n]* part of the arrow regex matches ': RequestHandler ', stopping
        // before the '=', so the pattern correctly picks up the name.
        const code = 'const handler: RequestHandler = async (req, res) => {\n  res.send();\n}';
        const { fns } = parse(code);
        expect(fns).toHaveLength(1);
        expect(fns[0].name).toBe('handler');
    });
});

describe('FunctionParser — SKIP_KEYWORDS', () => {
    it('contains common control-flow words', () => {
        (['if', 'for', 'while', 'return', 'switch', 'catch', 'typeof'] as const)
            .forEach(kw => expect(SKIP_KEYWORDS.has(kw)).toBe(true));
    });

    it('does not contain ordinary function-name words', () => {
        (['validate', 'fetch', 'create', 'load', 'process'] as const)
            .forEach(name => expect(SKIP_KEYWORDS.has(name)).toBe(false));
    });
});

describe('FunctionParser — findFunctionEnd', () => {
    it('finds the closing brace of a simple function', () => {
        const lines = ['function foo() {', '  return 1;', '}'];
        expect(findFunctionEnd(lines, 0)).toBe(2);
    });

    it('falls through to last line when no closing brace exists', () => {
        const lines = ['function foo() {', '  return 1;'];
        expect(findFunctionEnd(lines, 0)).toBe(1); // lines.length - 1
    });
});
