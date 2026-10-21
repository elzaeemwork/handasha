/**
 * calculator.js - الحاسبة الهندسية والعلمية
 * Safe mathematical AST expression evaluator (zero eval), plus telecom & unit conversion tools.
 * @module modules/calculator
 */

import { icon } from '../utils/icons.js';
import { toast } from '../utils/ui.js';
import { sanitizeHTML } from '../utils/validation.js';

// ──────────────────────────────────────────────
// Safe Math Expression Evaluator (Shunting-Yard)
// ──────────────────────────────────────────────
function evaluateExpression(expr, isDegree = true) {
  // Clean expression and replace visual symbols
  let s = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'PI')
    .replace(/\s+/g, '');

  if (!s) return 0;

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    // Numbers
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < s.length && /[0-9.]/.test(s[i])) {
        numStr += s[i];
        i++;
      }
      tokens.push({ type: 'num', value: parseFloat(numStr) });
      continue;
    }

    // Identifiers (functions or constants)
    if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < s.length && /[a-zA-Z]/.test(s[i])) {
        name += s[i];
        i++;
      }
      name = name.toLowerCase();
      if (name === 'pi') {
        tokens.push({ type: 'num', value: Math.PI });
      } else if (name === 'e') {
        tokens.push({ type: 'num', value: Math.E });
      } else if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', 'sqrt', 'abs', 'exp'].includes(name)) {
        tokens.push({ type: 'fn', value: name });
      } else {
        throw new Error(`دالة غير معروفة: ${name}`);
      }
      continue;
    }

    // Operators and Parentheses
    if ('+-*/^%()'.includes(ch)) {
      // Handle unary minus: if '-' is preceded by start of expr or '(', '+', '-', '*', '/', '^'
      if (ch === '-') {
        const prev = tokens[tokens.length - 1];
        if (!prev || prev.type === 'op' || (prev.type === 'paren' && prev.value === '(')) {
          tokens.push({ type: 'num', value: 0 }); // 0 - x
        }
      }
      if (ch === '(' || ch === ')') {
        tokens.push({ type: 'paren', value: ch });
      } else {
        tokens.push({ type: 'op', value: ch });
      }
      i++;
      continue;
    }

    throw new Error(`رمز غير صالح: ${ch}`);
  }

  // Shunting-Yard to RPN
  const opPrecedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
  const outputQueue = [];
  const opStack = [];

  for (const token of tokens) {
    if (token.type === 'num') {
      outputQueue.push(token);
    } else if (token.type === 'fn') {
      opStack.push(token);
    } else if (token.type === 'op') {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1].type === 'op' &&
        opPrecedence[opStack[opStack.length - 1].value] >= opPrecedence[token.value]
      ) {
        outputQueue.push(opStack.pop());
      }
      opStack.push(token);
    } else if (token.type === 'paren' && token.value === '(') {
      opStack.push(token);
    } else if (token.type === 'paren' && token.value === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1].value !== '(') {
        outputQueue.push(opStack.pop());
      }
      if (opStack.length === 0) throw new Error('أقواس غير متطابقة');
      opStack.pop(); // discard '('
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'fn') {
        outputQueue.push(opStack.pop());
      }
    }
  }

  while (opStack.length > 0) {
    const top = opStack.pop();
    if (top.type === 'paren') throw new Error('أقواس غير متطابقة');
    outputQueue.push(top);
  }

  // Evaluate RPN
  const evalStack = [];
  for (const token of outputQueue) {
    if (token.type === 'num') {
      evalStack.push(token.value);
    } else if (token.type === 'op') {
      if (evalStack.length < 2) throw new Error('صيغة المعادلة غير مكتملة');
      const b = evalStack.pop();
      const a = evalStack.pop();
      let res = 0;
      if (token.value === '+') res = a + b;
      else if (token.value === '-') res = a - b;
      else if (token.value === '*') res = a * b;
      else if (token.value === '/') {
        if (b === 0) throw new Error('لا يمكن القسمة على صفر');
        res = a / b;
      } else if (token.value === '%') res = a % b;
      else if (token.value === '^') res = Math.pow(a, b);
      evalStack.push(res);
    } else if (token.type === 'fn') {
      if (evalStack.length < 1) throw new Error('صيغة الدالة غير مكتملة');
      let val = evalStack.pop();
      let res = 0;
      const degToRad = (d) => (d * Math.PI) / 180;
      const radToDeg = (r) => (r * 180) / Math.PI;

      if (token.value === 'sin') res = Math.sin(isDegree ? degToRad(val) : val);
      else if (token.value === 'cos') res = Math.cos(isDegree ? degToRad(val) : val);
      else if (token.value === 'tan') res = Math.tan(isDegree ? degToRad(val) : val);
      else if (token.value === 'asin') res = isDegree ? radToDeg(Math.asin(val)) : Math.asin(val);
      else if (token.value === 'acos') res = isDegree ? radToDeg(Math.acos(val)) : Math.acos(val);
      else if (token.value === 'atan') res = isDegree ? radToDeg(Math.atan(val)) : Math.atan(val);
      else if (token.value === 'log') {
        if (val <= 0) throw new Error('قيمة اللوغاريتم يجب أن تكون موجبة');
        res = Math.log10(val);
      } else if (token.value === 'ln') {
        if (val <= 0) throw new Error('قيمة اللوغاريتم الطبيعي يجب أن تكون موجبة');
        res = Math.log(val);
      } else if (token.value === 'sqrt') {
        if (val < 0) throw new Error('الجذر التربيعي لعدد سالب غير معرف');
        res = Math.sqrt(val);
      } else if (token.value === 'abs') res = Math.abs(val);
      else if (token.value === 'exp') res = Math.exp(val);

      evalStack.push(res);
    }
  }

  if (evalStack.length !== 1 || isNaN(evalStack[0])) {
    throw new Error('تعبير رياضي غير صالح');
  }

  return evalStack[0];
}

export async function render(container) {
  let activeTab = 'scientific'; // 'scientific' or 'engineering'
  let expression = '';
  let result = '0';
  let isDegree = true;
  let history = JSON.parse(localStorage.getItem('calc_history') || '[]');

  function saveHistory(expr, res) {
    history.unshift({ expr, res, time: Date.now() });
    if (history.length > 20) history.pop();
    localStorage.setItem('calc_history', JSON.stringify(history));
  }

  function renderView() {
    container.innerHTML = `
      <div class="calc-container" style="max-width: 520px; margin: 0 auto;">
        <!-- Top Mode Tabs -->
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button id="tab-scientific" class="subject-tab-btn ${activeTab === 'scientific' ? 'active' : ''}">
            الحاسبة العلمية
          </button>
          <button id="tab-engineering" class="subject-tab-btn ${activeTab === 'engineering' ? 'active' : ''}">
            حسابات هندسة الاتصالات
          </button>
        </div>

        ${activeTab === 'scientific' ? renderScientificHTML() : renderEngineeringHTML()}
      </div>
    `;

    // Tab Listeners
    container.querySelector('#tab-scientific').addEventListener('click', () => {
      activeTab = 'scientific';
      renderView();
    });

    container.querySelector('#tab-engineering').addEventListener('click', () => {
      activeTab = 'engineering';
      renderView();
    });

    if (activeTab === 'scientific') {
      attachScientificEvents();
    } else {
      attachEngineeringEvents();
    }
  }

  function renderScientificHTML() {
    return `
      <!-- Calculator Display -->
      <div class="calc-display">
        <div class="calc-expr" id="calc-expr">${sanitizeHTML(expression || '')}</div>
        <div class="calc-res" id="calc-res">${sanitizeHTML(result)}</div>
      </div>

      <!-- Deg/Rad toggle & Clear row -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button id="btn-deg-rad" class="btn btn-secondary btn-sm" style="font-weight: 700; width: 60px;">
          ${isDegree ? 'DEG' : 'RAD'}
        </button>
        <div style="display: flex; gap: 6px;">
          <button id="btn-show-history" class="btn btn-ghost btn-sm" title="السجل">${icon('clock', 18)}</button>
          <button id="btn-backspace" class="btn btn-secondary btn-sm" title="مسح خطوة">⌫</button>
          <button id="btn-clear" class="btn btn-secondary btn-sm" style="color: var(--color-danger); font-weight: 700;">C</button>
        </div>
      </div>

      <!-- Button Grid -->
      <div class="calc-grid">
        <!-- Row 1 (Scientific functions) -->
        <button class="calc-btn op" data-insert="sin(">sin</button>
        <button class="calc-btn op" data-insert="cos(">cos</button>
        <button class="calc-btn op" data-insert="tan(">tan</button>
        <button class="calc-btn op" data-insert="^">xʸ</button>

        <!-- Row 2 -->
        <button class="calc-btn op" data-insert="log(">log</button>
        <button class="calc-btn op" data-insert="ln(">ln</button>
        <button class="calc-btn op" data-insert="sqrt(">√</button>
        <button class="calc-btn op" data-insert="/">÷</button>

        <!-- Row 3 -->
        <button class="calc-btn" data-insert="7">7</button>
        <button class="calc-btn" data-insert="8">8</button>
        <button class="calc-btn" data-insert="9">9</button>
        <button class="calc-btn op" data-insert="*">×</button>

        <!-- Row 4 -->
        <button class="calc-btn" data-insert="4">4</button>
        <button class="calc-btn" data-insert="5">5</button>
        <button class="calc-btn" data-insert="6">6</button>
        <button class="calc-btn op" data-insert="-">−</button>

        <!-- Row 5 -->
        <button class="calc-btn" data-insert="1">1</button>
        <button class="calc-btn" data-insert="2">2</button>
        <button class="calc-btn" data-insert="3">3</button>
        <button class="calc-btn op" data-insert="+">+</button>

        <!-- Row 6 -->
        <button class="calc-btn op" data-insert="(">(</button>
        <button class="calc-btn" data-insert="0">0</button>
        <button class="calc-btn" data-insert=".">.</button>
        <button class="calc-btn primary" id="btn-equals">=</button>
      </div>

      <!-- Row 7 (Constants) -->
      <div style="display: flex; gap: 8px; margin-top: 4px;">
        <button class="calc-btn op" style="flex: 1;" data-insert="π">π (3.1415)</button>
        <button class="calc-btn op" style="flex: 1;" data-insert="e">e (2.7182)</button>
        <button class="calc-btn op" style="flex: 1;" data-insert=")">)</button>
      </div>
    `;
  }

  function renderEngineeringHTML() {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- 1. dBm to mW Converter -->
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--color-primary);">1. تحويل القدرة (dBm ⟷ mW)</h4>
          <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0;">P(mW) = 10^(P(dBm)/10) • P(dBm) = 10·log₁₀(P(mW))</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="font-size: 12px; font-weight: 600;">القدرة (dBm)</label>
              <input type="number" id="eng-dbm" placeholder="مثال: 20" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--color-border); font-size: 14px;" />
            </div>
            <div>
              <label style="font-size: 12px; font-weight: 600;">القدرة (mW)</label>
              <input type="number" id="eng-mw" placeholder="مثال: 100" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--color-border); font-size: 14px;" />
            </div>
          </div>
        </div>

        <!-- 2. Frequency & Wavelength Converter -->
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--color-primary);">2. التردد والطول الموجي (f ⟷ λ)</h4>
          <p style="font-size: 12px; color: var(--color-text-secondary); margin: 0;">c = 3 × 10⁸ m/s • λ = c / f</p>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
            <input type="number" id="eng-freq" placeholder="قيمة التردد" style="padding: 8px; border-radius: 6px; border: 1px solid var(--color-border); font-size: 14px;" />
            <select id="eng-freq-unit" style="padding: 8px; border-radius: 6px; border: 1px solid var(--color-border); font-size: 13px;">
              <option value="1">Hz</option>
              <option value="1000">kHz</option>
              <option value="1000000" selected>MHz</option>
              <option value="1000000000">GHz</option>
            </select>
          </div>
          <div id="eng-lambda-res" style="background: var(--color-bg); padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center;">
            الطول الموجي: --
          </div>
        </div>

        <!-- 3. Free Space Path Loss (FSPL) & Link Budget -->
        <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--color-primary);">3. ميزانية الوصلة (Link Budget)</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div>
              <label>قدرة الإرسال Pt (dBm)</label>
              <input type="number" id="eng-pt" value="20" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--color-border);" />
            </div>
            <div>
              <label>ربح هوائي الإرسال Gt (dBi)</label>
              <input type="number" id="eng-gt" value="14" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--color-border);" />
            </div>
            <div>
              <label>ربح هوائي الاستقبال Gr (dBi)</label>
              <input type="number" id="eng-gr" value="14" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--color-border);" />
            </div>
            <div>
              <label>المسافة (km)</label>
              <input type="number" id="eng-dist" value="5" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--color-border);" />
            </div>
            <div>
              <label>التردد (MHz)</label>
              <input type="number" id="eng-f-mhz" value="2400" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--color-border);" />
            </div>
            <div>
              <label>خسائر الكيبلات (dB)</label>
              <input type="number" id="eng-losses" value="2" style="width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--color-border);" />
            </div>
          </div>
          <button id="btn-calc-link" class="btn btn-primary btn-sm" style="margin-top: 4px;">حساب القدرة المستقبلة</button>
          <div id="eng-link-res" style="background: var(--color-bg); padding: 10px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center;">
            القدرة المستقبلة Prx: --
          </div>
        </div>
      </div>
    `;
  }

  function attachScientificEvents() {
    const exprEl = container.querySelector('#calc-expr');
    const resEl = container.querySelector('#calc-res');

    container.querySelectorAll('.calc-btn[data-insert]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.insert;
        expression += val;
        exprEl.textContent = expression;
      });
    });

    container.querySelector('#btn-clear').addEventListener('click', () => {
      expression = '';
      result = '0';
      exprEl.textContent = '';
      resEl.textContent = '0';
    });

    container.querySelector('#btn-backspace').addEventListener('click', () => {
      expression = expression.slice(0, -1);
      exprEl.textContent = expression;
    });

    container.querySelector('#btn-deg-rad').addEventListener('click', (e) => {
      isDegree = !isDegree;
      e.target.textContent = isDegree ? 'DEG' : 'RAD';
      toast(`تم التبديل إلى ${isDegree ? 'الدرجات (DEG)' : 'الراديان (RAD)'}`, 'info', 1500);
    });

    container.querySelector('#btn-equals').addEventListener('click', () => {
      if (!expression) return;
      try {
        const val = evaluateExpression(expression, isDegree);
        // Format to sensible decimal places
        result = Number.isInteger(val) ? String(val) : String(parseFloat(val.toFixed(8)));
        resEl.textContent = result;
        saveHistory(expression, result);
      } catch (err) {
        result = 'خطأ رياضي';
        resEl.textContent = result;
        toast(err.message || 'خطأ في التعبير الرياضي', 'error');
      }
    });

    container.querySelector('#btn-show-history').addEventListener('click', () => {
      if (history.length === 0) {
        toast('لا توجد عمليات حسابية سابقة في السجل', 'info');
        return;
      }
      const historyHTML = `
        <div style="max-height: 50vh; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${history
            .map(
              (h) => `
            <div style="padding: 8px; border-radius: 6px; background: var(--color-bg); font-family: monospace; font-size: 13px;">
              <div style="color: var(--color-text-secondary); direction: ltr; text-align: left;">${sanitizeHTML(h.expr)}</div>
              <div style="color: var(--color-primary); font-weight: 700; direction: ltr; text-align: left; font-size: 15px;">= ${sanitizeHTML(h.res)}</div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
      import('../utils/ui.js').then(({ modal }) => {
        modal('سجل العمليات الحسابية', historyHTML, [
          {
            text: 'مسح السجل',
            className: 'btn btn-secondary',
            onClick: (closeFn) => {
              history = [];
              localStorage.removeItem('calc_history');
              toast('تم مسح السجل', 'info');
              closeFn();
            },
          },
        ]);
      });
    });
  }

  function attachEngineeringEvents() {
    const dbmInput = container.querySelector('#eng-dbm');
    const mwInput = container.querySelector('#eng-mw');

    if (dbmInput && mwInput) {
      dbmInput.addEventListener('input', () => {
        const val = parseFloat(dbmInput.value);
        if (!isNaN(val)) {
          mwInput.value = parseFloat(Math.pow(10, val / 10).toFixed(4));
        } else {
          mwInput.value = '';
        }
      });

      mwInput.addEventListener('input', () => {
        const val = parseFloat(mwInput.value);
        if (!isNaN(val) && val > 0) {
          dbmInput.value = parseFloat((10 * Math.log10(val)).toFixed(4));
        } else {
          dbmInput.value = '';
        }
      });
    }

    const freqInput = container.querySelector('#eng-freq');
    const freqUnit = container.querySelector('#eng-freq-unit');
    const lambdaBox = container.querySelector('#eng-lambda-res');

    function updateWavelength() {
      const f = parseFloat(freqInput.value);
      const mult = parseFloat(freqUnit.value);
      if (!isNaN(f) && f > 0) {
        const freqHz = f * mult;
        const c = 299792458; // m/s
        const lambdaM = c / freqHz;
        if (lambdaM < 0.01) {
          lambdaBox.innerHTML = `الطول الموجي λ: <b>${(lambdaM * 1000).toFixed(2)} mm</b> (${(lambdaM * 100).toFixed(2)} cm)`;
        } else if (lambdaM < 1) {
          lambdaBox.innerHTML = `الطول الموجي λ: <b>${(lambdaM * 100).toFixed(2)} cm</b> (${lambdaM.toFixed(4)} m)`;
        } else {
          lambdaBox.innerHTML = `الطول الموجي λ: <b>${lambdaM.toFixed(2)} متر</b>`;
        }
      } else {
        lambdaBox.textContent = 'الطول الموجي: --';
      }
    }

    if (freqInput && freqUnit) {
      freqInput.addEventListener('input', updateWavelength);
      freqUnit.addEventListener('change', updateWavelength);
    }

    const calcLinkBtn = container.querySelector('#btn-calc-link');
    const linkResBox = container.querySelector('#eng-link-res');

    if (calcLinkBtn) {
      calcLinkBtn.addEventListener('click', () => {
        const pt = parseFloat(container.querySelector('#eng-pt').value) || 0;
        const gt = parseFloat(container.querySelector('#eng-gt').value) || 0;
        const gr = parseFloat(container.querySelector('#eng-gr').value) || 0;
        const distKm = parseFloat(container.querySelector('#eng-dist').value) || 1;
        const fMhz = parseFloat(container.querySelector('#eng-f-mhz').value) || 1;
        const losses = parseFloat(container.querySelector('#eng-losses').value) || 0;

        // FSPL(dB) = 32.44 + 20*log10(d_km) + 20*log10(f_MHz)
        const fspl = 32.44 + 20 * Math.log10(distKm) + 20 * Math.log10(fMhz);
        const prx = pt + gt + gr - fspl - losses;

        linkResBox.innerHTML = `
          <div>الخسارة في الفضاء الحر FSPL: <b>${fspl.toFixed(2)} dB</b></div>
          <div style="font-size: 15px; color: ${prx >= -85 ? 'var(--color-secondary)' : 'var(--color-danger)'}; margin-top: 4px;">
            القدرة المستقبلة Prx: <b>${prx.toFixed(2)} dBm</b> (${prx >= -85 ? 'إشارة ممتازة ✓' : 'إشارة ضعيفة ⚠️'})
          </div>
        `;
      });
    }
  }

  renderView();
}
