// Algebra Climb: question generators, one set per level.
// Every generator returns a fresh random question:
// { lead, expr, kind: 'num'|'mc', ans, ansH, frac, choices, hint, steps, diag(v) }
(function () {
  'use strict';

  // ---------- helpers ----------
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const nz = (a, b) => { let n; do { n = ri(a, b); } while (n === 0); return n; };
  const nz2 = (a, b) => { let n; do { n = ri(a, b); } while (n === 0 || n === 1 || n === -1); return n; };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; };
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  const abs = Math.abs;

  const X = '<i>x</i>';
  const Y = '<i>y</i>';
  const T = '<i>t</i>';
  const X2 = '<i>x</i><sup>2</sup>';
  const N = (n) => (n < 0 ? '−' + abs(n) : '' + n);          // number with a real minus sign
  const P = (n) => (n < 0 ? '(' + N(n) + ')' : N(n));        // parenthesize negatives
  const sgn = (n) => (n < 0 ? '−' : '+');                     // operator for a following term
  const fmt = (v) => { const r = Math.round(v * 100) / 100; return N(r); };

  // stacked fraction, not simplified, signs shown as given
  const frRaw = (n, d) => `<span class="fr"><span>${N(n)}</span><span>${N(d)}</span></span>`;
  // simplified fraction html
  function fr(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d); n /= g; d /= g;
    if (d === 1) return N(n);
    return (n < 0 ? '−' : '') + `<span class="fr"><span>${abs(n)}</span><span>${d}</span></span>`;
  }
  // polynomial from [coef, variableHtml] terms, in order, skipping zeros
  function poly(ts) {
    let s = '';
    for (const [c, vp] of ts) {
      if (c === 0) continue;
      const a = abs(c);
      const body = vp ? (a === 1 ? '' : a) + vp : '' + a;
      if (s === '') s = (c < 0 ? '−' : '') + body;
      else s += (c < 0 ? ' − ' : ' + ') + body;
    }
    return s || '0';
  }
  const near = (a, b) => abs(a - b) < 1e-9;

  function mc(correct, ds) {
    const seen = new Set([correct]);
    const opts = [{ h: correct, ok: true }];
    for (const [h, why] of ds) {
      if (!seen.has(h) && opts.length < 4) { seen.add(h); opts.push({ h, ok: false, why }); }
    }
    return shuffle(opts);
  }

  // "Plug it in" check for equations: shows her what her answer does.
  const plugIn = (fl, fr_) => (v) => {
    const L = fl(v), R = fr_(v);
    return `Let's check your answer. If ${X} = ${fmt(v)}, the left side is ${fmt(L)} but the right side is ${fmt(R)}. They need to be equal.`;
  };

  // ---------- Level 1: Integers and order of operations ----------
  function g_addsub() {
    let a = nz(-15, 15), b = nz(-15, 15);
    if (a > 0 && b > 0) b = -b;
    const sub = Math.random() < 0.5;
    const ans = sub ? a - b : a + b;
    const expr = `${N(a)} ${sub ? '−' : '+'} ${P(b)}`;
    let hint, steps;
    if (sub && b < 0) {
      hint = 'Subtracting a negative is the same as adding a positive. Rewrite it as addition first.';
      steps = [`“− ${P(b)}” turns into “+ ${abs(b)}”, so this is ${N(a)} + ${abs(b)}.`, `${N(a)} + ${abs(b)} = ${N(ans)}`];
    } else if (sub) {
      hint = 'Subtracting a positive number means moving left on the number line.';
      steps = [`Start at ${N(a)} and move ${b} to the left.`, `You land on ${N(ans)}.`];
    } else if (b < 0) {
      hint = 'Adding a negative number is the same as subtracting. Move left on the number line.';
      steps = [`${N(a)} + ${P(b)} is the same as ${N(a)} − ${abs(b)}.`, `${N(a)} − ${abs(b)} = ${N(ans)}`];
    } else {
      hint = 'Adding a positive number means moving right on the number line.';
      steps = [`Start at ${N(a)} and move ${b} to the right.`, `You land on ${N(ans)}.`];
    }
    return { lead: 'Work it out.', expr, kind: 'num', ans, ansH: N(ans), hint, steps };
  }

  function g_muldiv() {
    let a = nz(-12, 12), b = (Math.random() < 0.5 ? -1 : 1) * ri(2, 12);
    if (a > 0 && b > 0) { if (Math.random() < 0.5) a = -a; else b = -b; }
    const div = Math.random() < 0.45;
    let expr, ans, x, y, op;
    if (div) { const p = a * b; ans = a; x = p; y = b; op = '÷'; expr = `${N(p)} ÷ ${P(b)}`; }
    else { ans = a * b; x = a; y = b; op = '×'; expr = `${N(a)} × ${P(b)}`; }
    const same = (x < 0) === (y < 0);
    return {
      lead: 'Work it out.', expr, kind: 'num', ans, ansH: N(ans),
      hint: 'Same signs give a positive answer. Different signs give a negative answer.',
      steps: [`Ignore the signs first: ${abs(x)} ${op} ${abs(y)} = ${abs(ans)}.`, `The signs are ${same ? 'the same, so the answer is positive' : 'different, so the answer is negative'}: ${N(ans)}.`]
    };
  }

  function g_order() {
    const t = ri(1, 3);
    if (t === 1) {
      const a = nz(-10, 10), b = nz2(-6, 6), c = ri(2, 6);
      const ans = a + b * c;
      return {
        lead: 'Use the order of operations.', expr: `${N(a)} + ${P(b)} × ${c}`, kind: 'num', ans, ansH: N(ans),
        hint: 'Multiply and divide before you add and subtract.',
        steps: [`Multiply first: ${P(b)} × ${c} = ${N(b * c)}.`, `Then add: ${N(a)} + ${P(b * c)} = ${N(ans)}.`],
        diag: (v) => near(v, (a + b) * c) ? 'It looks like you added first. Multiplication comes before addition.' : null
      };
    }
    if (t === 2) {
      const a = ri(-5, 9); let b = ri(2, 9); if (b === a) b++;
      const c = nz2(-5, 5);
      const ans = (a - b) * c;
      return {
        lead: 'Use the order of operations.', expr: `(${N(a)} − ${b}) × ${P(c)}`, kind: 'num', ans, ansH: N(ans),
        hint: 'Always work inside the parentheses first.',
        steps: [`Parentheses first: ${N(a)} − ${b} = ${N(a - b)}.`, `Then multiply: ${P(a - b)} × ${P(c)} = ${N(ans)}.`],
        diag: (v) => near(v, a - b * c) ? 'It looks like you multiplied before finishing the parentheses. Parentheses come first.' : null
      };
    }
    const a = ri(-10, 20), b = ri(2, 5);
    const ans = a - b * b;
    return {
      lead: 'Use the order of operations.', expr: `${N(a)} − ${b}<sup>2</sup>`, kind: 'num', ans, ansH: N(ans),
      hint: 'Exponents come before subtraction. And remember, a number squared means that number times itself.',
      steps: [`Exponent first: ${b}<sup>2</sup> = ${b} × ${b} = ${b * b}.`, `Then subtract: ${N(a)} − ${b * b} = ${N(ans)}.`],
      diag: (v) => near(v, a - 2 * b) ? `${b}<sup>2</sup> means ${b} × ${b}, not ${b} × 2.` : near(v, (a - b) * (a - b)) ? 'Do the exponent before you subtract.' : null
    };
  }

  // ---------- Level 2: Fractions, decimals, percents ----------
  function g_fracAdd() {
    const ds = [2, 3, 4, 5, 6, 8, 10, 12];
    const b = pick(ds); let d = pick(ds); while (d === b) d = pick(ds);
    const a = ri(1, b - 1), c = ri(1, d - 1);
    const sub = Math.random() < 0.4;
    const L = lcm(b, d), n1 = a * L / b, n2 = c * L / d;
    const num = sub ? n1 - n2 : n1 + n2;
    const op = sub ? '−' : '+';
    const steps = [
      `A common denominator for ${b} and ${d} is ${L}.`,
      `Rewrite: ${frRaw(a, b)} = ${frRaw(n1, L)} and ${frRaw(c, d)} = ${frRaw(n2, L)}.`,
      `${op === '+' ? 'Add' : 'Subtract'} the numerators: ${frRaw(n1, L)} ${op} ${frRaw(n2, L)} = ${frRaw(num, L)}.`
    ];
    if (gcd(num, L) > 1) steps.push(`Simplify: ${fr(num, L)}.`);
    return {
      lead: 'Work it out. Type a fraction like 5/6.', expr: `${frRaw(a, b)} ${op} ${frRaw(c, d)}`, kind: 'num', frac: true,
      ans: num / L, ansH: fr(num, L),
      hint: 'You can only add or subtract fractions with the same denominator. Find a common denominator, then combine the numerators.',
      steps,
      diag: (v) => near(v, (sub ? a - c : a + c) / (b + d)) ? 'It looks like you combined the tops and the bottoms straight across. Get a common denominator first.' : null
    };
  }

  function g_fracMul() {
    const a = ri(1, 9), b = ri(2, 9), c = ri(1, 9), d = ri(2, 9);
    const div = Math.random() < 0.45;
    if (div) {
      const n = a * d, m = b * c;
      return {
        lead: 'Work it out. Type a fraction like 5/6.', expr: `${frRaw(a, b)} ÷ ${frRaw(c, d)}`, kind: 'num', frac: true,
        ans: n / m, ansH: fr(n, m),
        hint: 'To divide by a fraction, flip the second fraction and multiply (keep, change, flip).',
        steps: [`Keep ${frRaw(a, b)}, change ÷ to ×, flip ${frRaw(c, d)} to ${frRaw(d, c)}.`, `Multiply: ${frRaw(a, b)} × ${frRaw(d, c)} = ${frRaw(n, m)}.`].concat(gcd(n, m) > 1 || m === 1 ? [`Simplify: ${fr(n, m)}.`] : []),
        diag: (v) => near(v, (a * c) / (b * d)) ? 'That is what you get from multiplying. For division, flip the second fraction first.' : null
      };
    }
    const n = a * c, m = b * d;
    return {
      lead: 'Work it out. Type a fraction like 5/6.', expr: `${frRaw(a, b)} × ${frRaw(c, d)}`, kind: 'num', frac: true,
      ans: n / m, ansH: fr(n, m),
      hint: 'Multiply the tops together and the bottoms together, then simplify. No common denominator needed.',
      steps: [`Tops: ${a} × ${c} = ${n}. Bottoms: ${b} × ${d} = ${m}.`, `That gives ${frRaw(n, m)}.`].concat(gcd(n, m) > 1 ? [`Simplify: ${fr(n, m)}.`] : [])
    };
  }

  function g_percent() {
    const p = pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]);
    const unit = 100 / gcd(p, 100);
    const n = unit * ri(1, Math.max(2, Math.floor(240 / unit)));
    const ans = p * n / 100;
    const dec = p / 100;
    return {
      lead: 'Find the value.', expr: `${p}% of ${n}`, kind: 'num', ans, ansH: N(ans),
      hint: `Percent means “out of 100.” Change ${p}% to a decimal (divide by 100), then multiply.`,
      steps: [`${p}% = ${dec}`, `${dec} × ${n} = ${ans}`],
      diag: (v) => near(v, p * n) ? 'Remember to divide by 100 to turn the percent into a decimal.' : null
    };
  }

  function g_decimal() {
    if (Math.random() < 0.5) {
      const a10 = ri(12, 95), k = ri(2, 9);
      const a = a10 / 10, ans = Math.round(a10 * k) / 10;
      return {
        lead: 'Work it out.', expr: `${a} × ${k}`, kind: 'num', ans, ansH: N(ans),
        hint: 'Multiply as if there were no decimal point, then put back one decimal place.',
        steps: [`Ignore the decimal: ${a10} × ${k} = ${a10 * k}.`, `${a} has one decimal place, so the answer does too: ${ans}.`]
      };
    }
    const a10 = ri(10, 99), b100 = ri(101, 999);
    const ans = Math.round(a10 * 10 + b100) / 100;
    const a = (a10 / 10).toFixed(1), b = (b100 / 100).toFixed(2);
    return {
      lead: 'Work it out.', expr: `${a} + ${b}`, kind: 'num', ans, ansH: N(ans),
      hint: 'Line up the decimal points. It helps to write the first number with two decimal places.',
      steps: [`Write ${a} as ${(a10 / 10).toFixed(2)}.`, `${(a10 / 10).toFixed(2)} + ${b} = ${ans.toFixed(2)}`]
    };
  }

  // ---------- Level 3: Expressions ----------
  function g_eval() {
    const x0 = nz(-5, 5);
    if (Math.random() < 0.55) {
      const a = nz2(-6, 6), b = nz(-10, 10);
      const ans = a * x0 + b;
      return {
        lead: `Find the value when ${X} = ${N(x0)}.`, expr: poly([[a, X], [b, '']]), kind: 'num', ans, ansH: N(ans),
        hint: `Replace ${X} with ${P(x0)} (use parentheses), then multiply before you add.`,
        steps: [`Plug in: ${N(a)} · ${P(x0)} ${sgn(b)} ${abs(b)}`, `= ${N(a * x0)} ${sgn(b)} ${abs(b)}`, `= ${N(ans)}`]
      };
    }
    const a = nz(-5, 5);
    const ans = x0 * x0 + a * x0;
    return {
      lead: `Find the value when ${X} = ${N(x0)}.`, expr: poly([[1, X2], [a, X]]), kind: 'num', ans, ansH: N(ans),
      hint: `Replace each ${X} with ${P(x0)}. Do the exponent first.`,
      steps: [`Plug in: ${P(x0)}<sup>2</sup> ${sgn(a)} ${abs(a)} · ${P(x0)}`, `= ${x0 * x0} ${sgn(a * x0)} ${abs(a * x0)}`, `= ${N(ans)}`],
      diag: (v) => (x0 < 0 && near(v, -x0 * x0 + a * x0)) ? `A negative number squared is positive: ${P(x0)}<sup>2</sup> = ${x0 * x0}.` : null
    };
  }

  function g_combine() {
    let a, c, b, d;
    do { a = nz(-6, 8); c = nz(-6, 8); } while (a + c === 0);
    do { b = nz(-9, 9); d = nz(-9, 9); } while (b + d === 0);
    const expr = poly([[a, X], [b, ''], [c, X], [d, '']]);
    const correct = poly([[a + c, X], [b + d, '']]);
    const signMsg = 'Watch the sign in front of each term. The sign belongs to the term right after it.';
    return {
      lead: 'Simplify by combining like terms.', expr, kind: 'mc',
      choices: mc(correct, [
        [poly([[a - c, X], [b + d, '']]), signMsg],
        [poly([[a + c, X], [b - d, '']]), signMsg],
        [poly([[a + c + b + d, X]]), `${X} terms and plain numbers are not like terms, so they can't be combined into one term.`],
        [poly([[a + c, X2], [b + d, '']]), `Adding ${X} terms doesn't change the exponent. For example, 3${X} + 2${X} = 5${X}, not 5${X2}.`]
      ]),
      ansH: correct,
      hint: `Like terms have the same variable part. Group the ${X} terms together and the plain numbers together.`,
      steps: [`${X} terms: ${N(a)} ${sgn(c)} ${abs(c)} = ${N(a + c)}, so ${poly([[a + c, X]])}.`, `Numbers: ${N(b)} ${sgn(d)} ${abs(d)} = ${N(b + d)}.`, `Together: ${correct}`]
    };
  }

  function g_distribute() {
    const k = nz2(-5, 6), m = nz(-9, 9);
    const correct = poly([[k, X], [k * m, '']]);
    return {
      lead: 'Use the distributive property to simplify.', expr: `${N(k)}(${poly([[1, X], [m, '']])})`, kind: 'mc',
      choices: mc(correct, [
        [poly([[k, X], [m, '']]), 'Multiply the outside number by every term inside, including the plain number.'],
        [poly([[k, X], [-k * m, '']]), `Check the sign: ${N(k)} × ${P(m)} = ${N(k * m)}.`],
        [poly([[1, X], [k * m, '']]), `The ${X} term also gets multiplied by the outside number.`],
        [poly([[k, X], [k + m, '']]), 'Multiply, don\'t add, the outside number with each term.']
      ]),
      ansH: correct,
      hint: 'Multiply the number outside the parentheses by each term inside.',
      steps: [`${N(k)} × ${X} = ${poly([[k, X]])}`, `${N(k)} × ${P(m)} = ${N(k * m)}`, `Together: ${correct}`]
    };
  }

  // ---------- Level 4: One- and two-step equations ----------
  function g_oneStep() {
    const t = ri(1, 3);
    if (t === 1) {
      const x = nz(-12, 15), a = nz(-15, 15), b = x + a;
      return {
        lead: `Solve for ${X}.`, expr: `${poly([[1, X], [a, '']])} = ${N(b)}`, kind: 'num', ans: x, ansH: N(x),
        hint: `Do the opposite to both sides to get ${X} by itself.`,
        steps: [`Undo ${a < 0 ? 'subtracting' : 'adding'} ${abs(a)}: ${a < 0 ? 'add' : 'subtract'} ${abs(a)} on both sides.`, `${X} = ${N(b)} ${a < 0 ? '+' : '−'} ${abs(a)} = ${N(x)}`],
        diag: plugIn((v) => v + a, () => b)
      };
    }
    if (t === 2) {
      const x = nz(-12, 12), a = nz2(-9, 9), b = a * x;
      return {
        lead: `Solve for ${X}.`, expr: `${poly([[a, X]])} = ${N(b)}`, kind: 'num', ans: x, ansH: N(x),
        hint: `${N(a)}${X} means ${N(a)} times ${X}. Undo multiplying by dividing both sides.`,
        steps: [`Divide both sides by ${N(a)}.`, `${X} = ${N(b)} ÷ ${P(a)} = ${N(x)}`],
        diag: plugIn((v) => a * v, () => b)
      };
    }
    const a = ri(2, 6), q = nz(-9, 9), x = a * q;
    return {
      lead: `Solve for ${X}.`, expr: `<span class="fr"><span>${X}</span><span>${a}</span></span> = ${N(q)}`, kind: 'num', ans: x, ansH: N(x),
      hint: `${X} is being divided by ${a}. Undo it by multiplying both sides by ${a}.`,
      steps: [`Multiply both sides by ${a}.`, `${X} = ${N(q)} × ${a} = ${N(x)}`],
      diag: plugIn((v) => v / a, () => q)
    };
  }

  function g_twoStep() {
    const x = nz(-10, 12), a = nz2(-7, 9), b = nz(-15, 15), c = a * x + b;
    return {
      lead: `Solve for ${X}.`, expr: `${poly([[a, X], [b, '']])} = ${N(c)}`, kind: 'num', ans: x, ansH: N(x),
      hint: 'Undo the adding or subtracting first. Then undo the multiplying.',
      steps: [`${b < 0 ? 'Add' : 'Subtract'} ${abs(b)} ${b < 0 ? 'to' : 'from'} both sides: ${poly([[a, X]])} = ${N(c - b)}`, `Divide both sides by ${N(a)}: ${X} = ${N(c - b)} ÷ ${P(a)} = ${N(x)}`],
      diag: (v) => near(v, (c + b) / a) ? `Close! When you moved the ${abs(b)}, you went the wrong direction. To undo ${b < 0 ? 'subtracting' : 'adding'}, ${b < 0 ? 'add' : 'subtract'}.` : plugIn((u) => a * u + b, () => c)(v)
    };
  }

  function g_twoStepFrac() {
    const a = ri(2, 5), q = nz(-6, 6), x = a * q, b = nz(-9, 9), c = q + b;
    return {
      lead: `Solve for ${X}.`, expr: `<span class="fr"><span>${X}</span><span>${a}</span></span> ${sgn(b)} ${abs(b)} = ${N(c)}`, kind: 'num', ans: x, ansH: N(x),
      hint: `First undo the ${b < 0 ? 'subtraction' : 'addition'}. Then multiply both sides by ${a}.`,
      steps: [`${b < 0 ? 'Add' : 'Subtract'} ${abs(b)} on both sides: <span class="fr"><span>${X}</span><span>${a}</span></span> = ${N(q)}`, `Multiply both sides by ${a}: ${X} = ${N(x)}`],
      diag: plugIn((v) => v / a + b, () => c)
    };
  }

  // ---------- Level 5: Multi-step equations ----------
  function g_distEq() {
    const x = nz(-8, 10), a = pick([2, 3, 4, 5, 6, -2, -3]), b = nz(-8, 8), c = a * (x + b);
    const steps = [`Distribute: ${poly([[a, X], [a * b, '']])} = ${N(c)}`, `${a * b < 0 ? 'Add' : 'Subtract'} ${abs(a * b)} on both sides: ${poly([[a, X]])} = ${N(c - a * b)}`, `Divide by ${N(a)}: ${X} = ${N(x)}`];
    return {
      lead: `Solve for ${X}.`, expr: `${N(a)}(${poly([[1, X], [b, '']])}) = ${N(c)}`, kind: 'num', ans: x, ansH: N(x),
      hint: 'Distribute first: multiply the outside number by both terms inside. Then solve it like a two-step equation.',
      steps,
      diag: (v) => near(v, (c - b) / a) ? 'Remember to multiply the outside number by both terms inside the parentheses.' : plugIn((u) => a * (u + b), () => c)(v)
    };
  }

  function g_bothSides() {
    const x = nz(-9, 10); let a, c;
    do { a = nz(-6, 9); c = nz(-6, 9); } while (a === c);
    const b = nz(-12, 12), d = a * x + b - c * x, k = a - c;
    const steps = [`Get the ${X} terms on one side. ${c < 0 ? 'Add' : 'Subtract'} ${poly([[abs(c), X]])} on both sides: ${poly([[k, X], [b, '']])} = ${N(d)}`, `${b < 0 ? 'Add' : 'Subtract'} ${abs(b)} on both sides: ${poly([[k, X]])} = ${N(d - b)}`];
    if (k !== 1) steps.push(`Divide by ${N(k)}: ${X} = ${N(x)}`);
    return {
      lead: `Solve for ${X}.`, expr: `${poly([[a, X], [b, '']])} = ${poly([[c, X], [d, '']])}`, kind: 'num', ans: x, ansH: N(x),
      hint: `Move all the ${X} terms to one side and all the plain numbers to the other side. Then divide.`,
      steps,
      diag: plugIn((u) => a * u + b, (u) => c * u + d)
    };
  }

  function g_combineSolve() {
    const x = nz(-8, 10); let a, c;
    do { a = nz(-5, 8); c = nz(-5, 8); } while (a + c === 0 || a + c === 1);
    const b = nz(-10, 10), d = (a + c) * x + b;
    return {
      lead: `Solve for ${X}.`, expr: `${poly([[a, X], [b, ''], [c, X]])} = ${N(d)}`, kind: 'num', ans: x, ansH: N(x),
      hint: `Combine the ${X} terms on the left side first. Then solve the two-step equation.`,
      steps: [`Combine like terms: ${poly([[a + c, X], [b, '']])} = ${N(d)}`, `${b < 0 ? 'Add' : 'Subtract'} ${abs(b)}: ${poly([[a + c, X]])} = ${N(d - b)}`, `Divide by ${N(a + c)}: ${X} = ${N(x)}`],
      diag: plugIn((u) => (a + c) * u + b, () => d)
    };
  }

  // ---------- Level 6: Inequalities ----------
  const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };
  function g_ineq() {
    const k = nz(-8, 9), a = nz2(-6, 7), b = nz(-12, 12), c = a * k + b, s = pick(['<', '>', '≤', '≥']);
    const fin = a < 0 ? FLIP[s] : s;
    const correct = `${X} ${fin} ${N(k)}`;
    return {
      lead: 'Solve the inequality.', expr: `${poly([[a, X], [b, '']])} ${s} ${N(c)}`, kind: 'mc',
      choices: mc(correct, [
        [`${X} ${a < 0 ? s : FLIP[s]} ${N(k)}`, a < 0 ? 'You divided by a negative number, so the inequality sign has to flip.' : 'Only flip the sign when you multiply or divide by a negative. Here you divided by a positive number.'],
        [`${X} ${fin} ${fr(c + b, a)}`, `Undo the ${b < 0 ? 'subtraction' : 'addition'} with the opposite operation: ${b < 0 ? 'add' : 'subtract'} ${abs(b)}.`],
        [`${X} ${fin} ${N(-k)}`, 'Check the sign of your number when you divide.'],
        [`${X} = ${N(k)}`, 'An inequality has lots of solutions, so the answer keeps an inequality sign.']
      ]),
      ansH: correct,
      hint: 'Solve it like an equation. If you multiply or divide both sides by a negative number, flip the inequality sign.',
      steps: [`${b < 0 ? 'Add' : 'Subtract'} ${abs(b)} on both sides: ${poly([[a, X]])} ${s} ${N(c - b)}`, `Divide both sides by ${N(a)}${a < 0 ? '. It\'s negative, so flip the sign' : ''}: ${correct}`]
    };
  }

  const STORIES = [
    ['Jordan', 'the county fair', 'entry', 'ride ticket'],
    ['Priya', 'the arcade', 'a game card', 'game token'],
    ['Sam', 'the skating rink', 'skate rental', 'hour of skating'],
    ['Ava', 'the art store', 'a sketchbook', 'paint tube']
  ];
  function g_ineqWord() {
    const [who, where, once, each] = pick(STORIES);
    const price = ri(3, 12), fee = ri(2, 10), budget = price * ri(3, 9) + fee + ri(0, price - 1);
    const correct = `${price}${T} + ${fee} ≤ ${budget}`;
    return {
      lead: `${who} has $${budget} to spend at ${where}. ${once[0].toUpperCase() + once.slice(1)} costs $${fee}, and each ${each} costs $${price}. Which inequality shows how many (${T}) ${who} can buy?`,
      expr: '', kind: 'mc',
      choices: mc(correct, [
        [`${price}${T} + ${fee} ≥ ${budget}`, `The total has to be at most $${budget}, so use “less than or equal to.”`],
        [`${fee}${T} + ${price} ≤ ${budget}`, `The cost that repeats goes with ${T}. The one-time cost stands alone.`],
        [`${price}${T} ≤ ${budget}`, `Don't forget the one-time cost of $${fee}.`]
      ]),
      ansH: correct,
      hint: `Total cost = (cost of each one × ${T}) + the one-time cost. The total can't be more than the money.`,
      steps: [`Each ${each} is $${price}, so ${T} of them cost ${price}${T}.`, `Add the one-time $${fee}: ${price}${T} + ${fee}.`, `The total must be at most $${budget}: ${correct}`]
    };
  }

  function g_ineqMax() {
    const [who, where, once, each] = pick(STORIES);
    const price = ri(3, 12), fee = ri(2, 10), n = ri(3, 9), budget = price * n + fee + ri(0, price - 1);
    return {
      lead: `${who} has $${budget} at ${where}. ${once[0].toUpperCase() + once.slice(1)} costs $${fee}, and each ${each} costs $${price}. What's the most ${each}s ${who} can buy?`,
      expr: `${price}${T} + ${fee} ≤ ${budget}`, kind: 'num', ans: n, ansH: N(n),
      hint: `Solve the inequality for ${T}, then round down to a whole number (you can't buy part of one).`,
      steps: [`Subtract ${fee}: ${price}${T} ≤ ${budget - fee}`, `Divide by ${price}: ${T} ≤ ${fmt((budget - fee) / price)}`, `Round down to a whole number: ${n}`],
      diag: (v) => near(v, n + 1) ? `Check it: ${n + 1} would cost ${price * (n + 1) + fee} dollars, which is more than $${budget}. Round down.` : null
    };
  }

  // ---------- Level 7: Slope and functions ----------
  function g_slope() {
    let x1, x2, y1, y2;
    do { x1 = ri(-6, 6); x2 = ri(-6, 6); y1 = ri(-8, 8); y2 = ri(-8, 8); } while (x1 === x2 || y1 === y2);
    const dy = y2 - y1, dx = x2 - x1;
    return {
      lead: 'Find the slope of the line through these two points. Type a fraction like −3/4 if you need one.',
      expr: `(${N(x1)}, ${N(y1)}) and (${N(x2)}, ${N(y2)})`, kind: 'num', frac: true, ans: dy / dx, ansH: fr(dy, dx),
      hint: 'Slope is rise over run: (change in y) ÷ (change in x). Subtract in the same order on top and bottom.',
      steps: [`Change in y: ${N(y2)} − ${P(y1)} = ${N(dy)}`, `Change in x: ${N(x2)} − ${P(x1)} = ${N(dx)}`, `Slope = ${frRaw(dy, dx)} = ${fr(dy, dx)}`],
      diag: (v) => near(v, dx / dy) ? 'That is run over rise. Slope puts the change in y on top.' : near(v, -dy / dx) ? 'Check your signs. Subtract the points in the same order on top and bottom.' : null
    };
  }

  function g_readLine() {
    const m = nz(-6, 6), b = nz(-9, 9), askSlope = Math.random() < 0.5, flipped = Math.random() < 0.35;
    const rhs = flipped ? `${N(b)} ${sgn(m)} ${abs(m) === 1 ? '' : abs(m)}${X}` : poly([[m, X], [b, '']]);
    return {
      lead: `What is the ${askSlope ? 'slope' : 'y-intercept'} of this line?`, expr: `${Y} = ${rhs}`, kind: 'num',
      ans: askSlope ? m : b, ansH: N(askSlope ? m : b),
      hint: `In ${Y} = m${X} + b, the slope m is the number multiplied by ${X}. The y-intercept b is the number on its own.`,
      steps: askSlope ? [`The number multiplied by ${X} is ${N(m)} (keep its sign).`, `Slope = ${N(m)}`] : [`The number on its own is ${N(b)} (keep its sign).`, `y-intercept = ${N(b)}`],
      diag: (v) => (askSlope && near(v, b)) ? 'That is the y-intercept. The slope is the number with x.' : (!askSlope && near(v, m)) ? 'That is the slope. The y-intercept is the number on its own.' : null
    };
  }

  function g_func() {
    const a = nz2(-5, 6), b = nz(-10, 10), f = '<i>f</i>';
    const def = `${f}(${X}) = ${poly([[a, X], [b, '']])}`;
    if (Math.random() < 0.5) {
      const n = nz(-6, 6), ans = a * n + b;
      return {
        lead: `Find ${f}(${N(n)}).`, expr: def, kind: 'num', ans, ansH: N(ans),
        hint: `${f}(${N(n)}) means: put ${N(n)} in for ${X}.`,
        steps: [`${f}(${N(n)}) = ${N(a)} · ${P(n)} ${sgn(b)} ${abs(b)}`, `= ${N(a * n)} ${sgn(b)} ${abs(b)} = ${N(ans)}`]
      };
    }
    const x = nz(-8, 8), c = a * x + b;
    return {
      lead: `Find ${X} when ${f}(${X}) = ${N(c)}.`, expr: def, kind: 'num', ans: x, ansH: N(x),
      hint: `Set the rule equal to ${N(c)} and solve: ${poly([[a, X], [b, '']])} = ${N(c)}.`,
      steps: [`${poly([[a, X], [b, '']])} = ${N(c)}`, `${b < 0 ? 'Add' : 'Subtract'} ${abs(b)}: ${poly([[a, X]])} = ${N(c - b)}`, `Divide by ${N(a)}: ${X} = ${N(x)}`],
      diag: (v) => near(v, a * c + b) ? `That's ${f}(${N(c)}). This question gives you the output and asks for the input.` : plugIn((u) => a * u + b, () => c)(v)
    };
  }

  // ---------- Level 8: Lines and systems ----------
  function g_lineThrough() {
    const m = nz(-4, 5), x1 = nz(-5, 5), y1 = ri(-8, 8), b = y1 - m * x1;
    const line = (mm, bb) => `${Y} = ${poly([[mm, X], [bb, '']])}`;
    const correct = line(m, b);
    return {
      lead: `Which line has slope ${N(m)} and passes through (${N(x1)}, ${N(y1)})?`, expr: '', kind: 'mc',
      choices: mc(correct, [
        [line(m, y1), `The y-intercept is where ${X} = 0, not the y-value of any point. Plug the point in to find b.`],
        [line(m, y1 + m * x1), 'Check your signs when you solve for b: b = y − m·x.'],
        [line(-m, b), 'Check the sign of the slope.'],
        [line(b, m), `The slope goes with ${X}, and b stands alone.`]
      ]),
      ansH: correct,
      hint: `Start with ${Y} = m${X} + b. Put in the slope and the point, then solve for b.`,
      steps: [`${N(y1)} = ${N(m)} · ${P(x1)} + b`, `${N(y1)} = ${N(m * x1)} + b`, `b = ${N(b)}`, `So ${correct}`]
    };
  }

  function g_sysSub() {
    const x = nz(-6, 6); let a, c;
    do { a = nz(-4, 5); c = nz(-4, 5); } while (a === c);
    const b = ri(-9, 9), y = a * x + b, d = y - c * x;
    const steps = [`Both equal ${Y}, so set them equal: ${poly([[a, X], [b, '']])} = ${poly([[c, X], [d, '']])}`, `Get ${X} alone on one side: ${poly([[a - c, X]])} = ${N(d - b)}`];
    if (a - c !== 1) steps.push(`Divide: ${X} = ${N(x)}`);
    steps.push(`(Bonus: then ${Y} = ${N(y)}.)`);
    return {
      lead: `Solve the system. What is ${X}?`,
      expr: `<span class="sys"><span>${Y} = ${poly([[a, X], [b, '']])}</span><span>${Y} = ${poly([[c, X], [d, '']])}</span></span>`,
      kind: 'num', ans: x, ansH: N(x),
      hint: `Both equations equal ${Y}, so the right sides must equal each other. Set them equal and solve for ${X}.`,
      steps,
      diag: (v) => near(v, y) && !near(y, x) ? `That's the ${Y}-value. The question asks for ${X}.` : null
    };
  }

  function g_sysElim() {
    const x = nz(-6, 7), y = nz(-6, 7), a = ri(1, 4), d = ri(1, 4), b = ri(1, 4);
    const c = a * x + b * y, e = d * x - b * y, askX = Math.random() < 0.5;
    const steps = [`Add the two equations. The ${Y} terms cancel: ${poly([[a + d, X]])} = ${N(c + e)}`, `Divide: ${X} = ${N(x)}`];
    if (!askX) steps.push(`Put ${X} = ${N(x)} into the first equation: ${N(a * x)} + ${poly([[b, Y]])} = ${N(c)}`, `So ${poly([[b, Y]])} = ${N(c - a * x)}, and ${Y} = ${N(y)}`);
    return {
      lead: `Solve the system. What is ${askX ? X : Y}?`,
      expr: `<span class="sys"><span>${poly([[a, X], [b, Y]])} = ${N(c)}</span><span>${poly([[d, X], [-b, Y]])} = ${N(e)}</span></span>`,
      kind: 'num', ans: askX ? x : y, ansH: N(askX ? x : y),
      hint: `Add the two equations together. The ${Y} terms cancel out, leaving an equation with just ${X}.`,
      steps,
      diag: (v) => (askX && near(v, y) && x !== y) ? `That's ${Y}. The question asks for ${X}.` : (!askX && near(v, x) && x !== y) ? `That's ${X}. The question asks for ${Y}.` : null
    };
  }

  // ---------- Level 9: Exponents and polynomials ----------
  function g_expRule() {
    const t = ri(1, 3); let m = ri(2, 9), n = ri(2, 8);
    const box = '<sup class="box">?</sup>';
    if (t === 1) return {
      lead: 'What is the missing exponent?', expr: `${X}<sup>${m}</sup> · ${X}<sup>${n}</sup> = ${X}${box}`, kind: 'num', ans: m + n, ansH: N(m + n),
      hint: 'When you multiply powers with the same base, add the exponents.',
      steps: [`${X}<sup>${m}</sup> · ${X}<sup>${n}</sup> = ${X}<sup>${m} + ${n}</sup>`, `= ${X}<sup>${m + n}</sup>`],
      diag: (v) => near(v, m * n) ? 'For multiplying powers, add the exponents. You multiply them only for a power of a power, like (x³)².' : null
    };
    if (t === 2) { n = ri(2, 5); return {
      lead: 'What is the missing exponent?', expr: `(${X}<sup>${m}</sup>)<sup>${n}</sup> = ${X}${box}`, kind: 'num', ans: m * n, ansH: N(m * n),
      hint: 'A power raised to another power: multiply the exponents.',
      steps: [`(${X}<sup>${m}</sup>)<sup>${n}</sup> means ${X}<sup>${m}</sup> multiplied by itself ${n} times.`, `${m} × ${n} = ${m * n}, so ${X}<sup>${m * n}</sup>`],
      diag: (v) => near(v, m + n) ? 'For a power of a power, multiply the exponents instead of adding them.' : null
    }; }
    if (m <= n) m = n + ri(1, 5);
    return {
      lead: 'What is the missing exponent?', expr: `${X}<sup>${m}</sup> ÷ ${X}<sup>${n}</sup> = ${X}${box}`, kind: 'num', ans: m - n, ansH: N(m - n),
      hint: 'When you divide powers with the same base, subtract the exponents.',
      steps: [`${X}<sup>${m}</sup> ÷ ${X}<sup>${n}</sup> = ${X}<sup>${m} − ${n}</sup>`, `= ${X}<sup>${m - n}</sup>`],
      diag: (v) => near(v, m / n) ? 'For dividing powers, subtract the exponents instead of dividing them.' : null
    };
  }

  function g_powers() {
    const t = ri(1, 4), a = ri(2, 6);
    if (t === 1) return { lead: 'Evaluate.', expr: `(−${a})<sup>2</sup>`, kind: 'num', ans: a * a, ansH: N(a * a),
      hint: 'The parentheses mean the negative sign is part of what gets squared.',
      steps: [`(−${a})<sup>2</sup> = (−${a}) × (−${a})`, `Negative times negative is positive: ${a * a}`] };
    if (t === 2) return { lead: 'Evaluate.', expr: `−${a}<sup>2</sup>`, kind: 'num', ans: -a * a, ansH: N(-a * a),
      hint: `With no parentheses, only the ${a} is squared. The negative sign waits outside.`,
      steps: [`Square first: ${a}<sup>2</sup> = ${a * a}`, `Then apply the negative: −${a * a}`],
      diag: (v) => near(v, a * a) ? `Without parentheses, the negative isn't squared. −${a}<sup>2</sup> means −(${a} × ${a}).` : null };
    if (t === 3) { const b = ri(2, 4); return { lead: 'Evaluate.', expr: `(−${b})<sup>3</sup>`, kind: 'num', ans: -b * b * b, ansH: N(-b * b * b),
      hint: 'Write it out as three factors. An odd number of negatives multiplies to a negative.',
      steps: [`(−${b}) × (−${b}) × (−${b})`, `${b * b} × (−${b}) = ${N(-b * b * b)}`],
      diag: (v) => near(v, b * b * b) ? 'Three negatives multiply to a negative.' : near(v, -3 * b) ? `The exponent 3 means multiply ${b} by itself three times, not ${b} × 3.` : null }; }
    const b = ri(2, 5), e = ri(2, 4);
    return { lead: 'Evaluate.', expr: `${b}<sup>${e}</sup>`, kind: 'num', ans: Math.pow(b, e), ansH: N(Math.pow(b, e)),
      hint: `${b}<sup>${e}</sup> means ${b} multiplied by itself ${e} times.`,
      steps: [`${Array(e).fill(b).join(' × ')} = ${Math.pow(b, e)}`],
      diag: (v) => near(v, b * e) ? `The exponent means repeated multiplication: ${Array(e).fill(b).join(' × ')}, not ${b} × ${e}.` : null };
  }

  function g_foil() {
    let p, q;
    do { p = nz(-7, 7); q = nz(-7, 7); } while (p + q === 0 || p === q);
    const correct = poly([[1, X2], [p + q, X], [p * q, '']]);
    return {
      lead: 'Multiply.', expr: `(${poly([[1, X], [p, '']])})(${poly([[1, X], [q, '']])})`, kind: 'mc',
      choices: mc(correct, [
        [poly([[1, X2], [p * q, '']]), 'You multiplied the first terms and the last terms but skipped the middle (outer and inner) terms.'],
        [poly([[1, X2], [p * q, X], [p + q, '']]), 'Mixed up. The middle term comes from adding outer + inner. The last term comes from multiplying.'],
        [poly([[1, X2], [p + q, X], [-p * q, '']]), `Check the sign of the last term: ${P(p)} × ${P(q)} = ${N(p * q)}.`],
        [poly([[1, X2], [p - q, X], [p * q, '']]), `Check the middle term: ${poly([[q, X]])} ${sgn(p)} ${poly([[abs(p), X]])} = ${poly([[p + q, X]])}.`]
      ]),
      ansH: correct,
      hint: 'Multiply each term in the first parentheses by each term in the second: First, Outer, Inner, Last. Then combine like terms.',
      steps: [`First: ${X} · ${X} = ${X2}`, `Outer: ${X} · ${P(q)} = ${poly([[q, X]])}`, `Inner: ${P(p)} · ${X} = ${poly([[p, X]])}`, `Last: ${P(p)} · ${P(q)} = ${N(p * q)}`, `Combine: ${correct}`]
    };
  }

  function g_polySub() {
    const a = ri(2, 7), b = nz(-6, 6), c = nz(-9, 9), d = ri(1, 5), e = nz(-6, 6), f = nz(-9, 9);
    const correct = poly([[a - d, X2], [b - e, X], [c - f, '']]);
    return {
      lead: 'Simplify.', expr: `(${poly([[a, X2], [b, X], [c, '']])}) − (${poly([[d, X2], [e, X], [f, '']])})`, kind: 'mc',
      choices: mc(correct, [
        [poly([[a - d, X2], [b + e, X], [c + f, '']]), 'The minus sign in front of the parentheses changes the sign of every term inside, not just the first one.'],
        [poly([[a + d, X2], [b + e, X], [c + f, '']]), 'This is subtraction, so subtract each matching term.'],
        [poly([[a - d, X2], [b - e, X], [c + f, '']]), 'Check the plain numbers. The minus sign applies to them too.'],
        [poly([[a - d, X], [b - e, X], [c - f, '']]), `Keep the ${X2} terms separate from the ${X} terms.`]
      ]),
      ansH: correct,
      hint: 'Subtracting means adding the opposite. Flip the sign of every term in the second parentheses, then combine like terms.',
      steps: [`Flip every sign in the second group: ${poly([[a, X2], [b, X], [c, '']])} + (${poly([[-d, X2], [-e, X], [-f, '']])})`, `${X2} terms: ${a} − ${d} = ${N(a - d)}`, `${X} terms: ${N(b)} − ${P(e)} = ${N(b - e)}`, `Numbers: ${N(c)} − ${P(f)} = ${N(c - f)}`, `Answer: ${correct}`]
    };
  }

  // ---------- Level 10: Factoring and quadratics ----------
  const fs = (r, s) => `(${poly([[1, X], [r, '']])})(${poly([[1, X], [s, '']])})`;
  function g_factor() {
    let p, q;
    do { p = nz(-9, 9); q = nz(-9, 9); } while (p === q || p === -q);
    const B = p + q, C = p * q, correct = fs(p, q);
    return {
      lead: 'Factor.', expr: poly([[1, X2], [B, X], [C, '']]), kind: 'mc',
      choices: mc(correct, [
        [fs(-p, -q), `Check the signs. The two numbers must add to ${N(B)}, not ${N(-B)}.`],
        [fs(p, -q), `The two numbers must multiply to ${N(C)}. These multiply to ${N(-C)}.`],
        [fs(-p, q), `The two numbers must multiply to ${N(C)} and add to ${N(B)}.`]
      ]),
      ansH: correct,
      hint: `Find two numbers that multiply to ${N(C)} and add to ${N(B)}.`,
      steps: [`We need two numbers that multiply to ${N(C)} and add to ${N(B)}.`, `${N(p)} and ${N(q)} work: ${N(p)} × ${P(q)} = ${N(C)} and ${N(p)} + ${P(q)} = ${N(B)}.`, `So ${correct}`]
    };
  }

  function g_solveQuad() {
    let r, s;
    do { r = nz(-9, 9); s = nz(-9, 9); } while (r === s || r === -s);
    const sol = (a, b) => `${X} = ${N(Math.min(a, b))} or ${X} = ${N(Math.max(a, b))}`;
    const correct = sol(r, s);
    return {
      lead: 'Solve.', expr: `${poly([[1, X2], [-(r + s), X], [r * s, '']])} = 0`, kind: 'mc',
      choices: mc(correct, [
        [sol(-r, -s), `Those are the numbers inside the factors. Set each factor equal to zero: ${X} ${sgn(-r)} ${abs(r)} = 0 gives ${X} = ${N(r)}.`],
        [sol(r, -s), 'Plug each answer back in. Both should make the equation equal 0.'],
        [sol(-r, s), 'Plug each answer back in. Both should make the equation equal 0.']
      ]),
      ansH: correct,
      hint: 'Factor the left side. Then set each factor equal to zero.',
      steps: [`Factor: ${fs(-r, -s)} = 0`, `Set each factor to 0: ${poly([[1, X], [-r, '']])} = 0 or ${poly([[1, X], [-s, '']])} = 0`, `So ${correct}`]
    };
  }

  function g_gcf() {
    const g = ri(2, 6); let a, b;
    do { a = ri(1, 5); b = nz(-7, 7); } while (gcd(a, b) !== 1);
    const correct = `${g}${X}(${poly([[a, X], [b, '']])})`;
    return {
      lead: 'Factor out the greatest common factor.', expr: poly([[g * a, X2], [g * b, X]]), kind: 'mc',
      choices: mc(correct, [
        [`${g}(${poly([[a, X2], [b, X]])})`, `Both terms also have an ${X}, so you can pull that out too.`],
        [`${X}(${poly([[g * a, X], [g * b, '']])})`, `Both numbers also share a factor of ${g}.`],
        [`${g}${X}(${poly([[a, X], [-b, '']])})`, 'Check the sign inside the parentheses.'],
        [`${g}${X}(${poly([[a, X2], [b, X]])})`, `Dividing ${X2} by ${X} leaves ${X}, not ${X2}.`]
      ]),
      ansH: correct,
      hint: `Find the biggest number that divides both coefficients, and see if both terms share an ${X}. Pull those out front.`,
      steps: [`${g * a} and ${abs(g * b)} share a factor of ${g}. Both terms have an ${X}.`, `GCF = ${g}${X}. Divide each term by it: ${poly([[g * a, X2]])} ÷ ${g}${X} = ${poly([[a, X]])}, and ${poly([[g * b, X]])} ÷ ${g}${X} = ${N(b)}.`, `So ${correct}`]
    };
  }

  function g_dos() {
    const k = ri(2, 12), correct = `(${X} + ${k})(${X} − ${k})`;
    return {
      lead: 'Factor.', expr: `${X2} − ${k * k}`, kind: 'mc',
      choices: mc(correct, [
        [`(${X} − ${k})(${X} − ${k})`, 'Multiplying that out gives a middle term. A difference of squares needs one plus and one minus.'],
        [`(${X} + ${k})(${X} + ${k})`, 'Multiplying that out gives a middle term. A difference of squares needs one plus and one minus.'],
        [`(${X} − ${k * k})(${X} + 1)`, `Notice that ${k * k} is a perfect square: ${k} × ${k}.`]
      ]),
      ansH: correct,
      hint: `${k * k} is a perfect square (${k}<sup>2</sup>). Use the pattern a<sup>2</sup> − b<sup>2</sup> = (a + b)(a − b).`,
      steps: [`${X2} − ${k * k} = ${X2} − ${k}<sup>2</sup>`, `Use a<sup>2</sup> − b<sup>2</sup> = (a + b)(a − b) with a = ${X}, b = ${k}.`, `So ${correct}`]
    };
  }

  // ---------- Levels with their lesson cards ----------
  const LEVELS = [
    { n: 1, name: 'Integers & order of operations', short: 'Integers', gens: [g_addsub, g_muldiv, g_order],
      card: { idea: 'Negative numbers follow a few simple rules. Subtracting a negative is the same as adding. When you multiply or divide, same signs make a positive and different signs make a negative. And always work in this order: parentheses, exponents, multiply and divide, then add and subtract.',
        ex: ['7 − (−3) = 7 + 3 = 10', '(−4) × 6 = −24 (different signs)', '2 + 3 × 4 = 2 + 12 = 14 (multiply first)'], tip: 'Picture a number line. Adding a negative moves left.' } },
    { n: 2, name: 'Fractions, decimals & percents', short: 'Fractions', gens: [g_fracAdd, g_fracMul, g_percent, g_decimal],
      card: { idea: 'To add or subtract fractions, they need the same denominator. To multiply, go straight across. To divide, flip the second fraction and multiply. A percent is just a number out of 100.',
        ex: ['1/2 + 1/3 = 3/6 + 2/6 = 5/6', '2/3 × 3/5 = 6/15 = 2/5', '20% of 45 = 0.20 × 45 = 9'], tip: 'Type fractions with the / key, like 5/6.' } },
    { n: 3, name: 'Expressions', short: 'Expressions', gens: [g_eval, g_combine, g_distribute],
      card: { idea: 'An expression is a math phrase with a variable, like 3x + 2. You can plug in a number for x, combine like terms (x terms with x terms, numbers with numbers), and distribute a number across parentheses.',
        ex: ['If x = −2: 3x + 5 = 3(−2) + 5 = −1', '4x + 3 − 2x + 5 = 2x + 8', '3(x − 4) = 3x − 12'], tip: 'Put plugged-in negatives inside parentheses so the signs stay right.' } },
    { n: 4, name: 'One- and two-step equations', short: 'Equations', gens: [g_oneStep, g_twoStep, g_twoStepFrac],
      card: { idea: 'Solving an equation means getting x by itself. Whatever you do to one side, do to the other. Undo adding and subtracting first, then undo multiplying and dividing.',
        ex: ['3x + 5 = 20', 'Subtract 5 from both sides: 3x = 15', 'Divide both sides by 3: x = 5'], tip: 'Check by plugging your answer back in: 3(5) + 5 = 20. It works!' } },
    { n: 5, name: 'Multi-step equations', short: 'Multi-step', gens: [g_distEq, g_bothSides, g_combineSolve],
      card: { idea: 'Bigger equations just need a cleanup first. Distribute any parentheses, combine like terms, and move all the x terms to one side. Then it\'s a two-step equation.',
        ex: ['5x − 4 = 2x + 11', 'Subtract 2x from both sides: 3x − 4 = 11', 'Add 4: 3x = 15, so x = 5'], tip: 'Move the smaller x term so you usually stay with a positive number of x\'s.' } },
    { n: 6, name: 'Inequalities', short: 'Inequalities', gens: [g_ineq, g_ineq, g_ineqWord, g_ineqMax],
      card: { idea: 'Inequalities use <, >, ≤ or ≥ and are solved just like equations, with one special rule: if you multiply or divide both sides by a negative number, flip the sign.',
        ex: ['−2x + 3 > 11', 'Subtract 3: −2x > 8', 'Divide by −2 and flip: x < −4'], tip: '≤ means "at most." ≥ means "at least."' } },
    { n: 7, name: 'Slope & functions', short: 'Slope', gens: [g_slope, g_readLine, g_func],
      card: { idea: 'Slope tells you how steep a line is: rise over run, or the change in y divided by the change in x. In y = mx + b, m is the slope and b is where the line crosses the y-axis. A function f(x) is a rule: put in x, get out a value.',
        ex: ['Through (1, 2) and (3, 8): slope = (8 − 2)/(3 − 1) = 6/2 = 3', 'y = −2x + 7: slope −2, y-intercept 7', 'f(x) = 3x − 1, so f(4) = 11'], tip: 'Subtract in the same order on top and bottom.' } },
    { n: 8, name: 'Lines & systems', short: 'Systems', gens: [g_lineThrough, g_sysSub, g_sysElim],
      card: { idea: 'To write a line, plug its slope and a point into y = mx + b and solve for b. A system is two equations at once, and the solution is the point where both are true. Substitute one into the other, or add the equations to cancel a variable.',
        ex: ['y = 2x + 1 and y = −x + 7', 'Set equal: 2x + 1 = −x + 7', '3x = 6, so x = 2 (and y = 5)'], tip: 'When one equation has +y and the other −y, adding them makes y disappear.' } },
    { n: 9, name: 'Exponents & polynomials', short: 'Polynomials', gens: [g_expRule, g_powers, g_foil, g_polySub],
      card: { idea: 'Exponent rules: multiply powers, add the exponents. Divide powers, subtract them. Power of a power, multiply them. To multiply two binomials, multiply every term by every term (First, Outer, Inner, Last).',
        ex: ['x³ · x⁴ = x⁷', '(−3)² = 9, but −3² = −9', '(x + 2)(x + 5) = x² + 7x + 10'], tip: 'Subtracting a polynomial flips the sign of every term in it.' } },
    { n: 10, name: 'Factoring & quadratics', short: 'Quadratics', gens: [g_factor, g_solveQuad, g_gcf, g_dos],
      card: { idea: 'Factoring is multiplying in reverse. For x² + bx + c, find two numbers that multiply to c and add to b. To solve a quadratic equal to 0, factor it and set each factor equal to zero.',
        ex: ['x² + 7x + 12 = (x + 3)(x + 4)', 'x² − x − 6 = 0 → (x − 3)(x + 2) = 0', 'x = 3 or x = −2'], tip: 'Always check for a common factor first, like 3x² + 6x = 3x(x + 2).' } }
  ];

  function generate(level, seen) {
    const L = LEVELS[Math.max(1, Math.min(10, level)) - 1];
    let q;
    for (let i = 0; i < 12; i++) {
      q = pick(L.gens)();
      const key = q.lead + '|' + q.expr;
      if (!seen || !seen.has(key)) { if (seen) seen.add(key); break; }
    }
    q.level = L.n;
    q.skill = L.name;
    return q;
  }

  window.ALG = { LEVELS, generate, gcd, N, fr };
})();
