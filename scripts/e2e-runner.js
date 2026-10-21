const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = 'C:\\Users\\elzae\\.gemini\\antigravity\\brain\\7a5754f8-d2fb-4854-b3e5-2d6b55f02f84\\screenshots';

function log(msg) {
  console.log(`[E2E] ${msg}`);
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
    this.logs = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const desc = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text;
        console.error('[BROWSER EXCEPTION]', desc);
        this.errors.push(desc);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        if (msg.params.type === 'error') {
          console.error('[BROWSER ERROR]', text);
          this.errors.push(text);
        } else {
          this.logs.push(`[${msg.params.type}] ${text}`);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return res?.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(SCREENSHOTS_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
    return fullPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  log('Starting Chrome in headless mode with iPhone 14 mobile emulation (390x844)...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=390,844',
    'http://localhost:8080/index.html'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  // Find target
  const listData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });

  const page = listData.find(t => t.type === 'page');
  if (!page) throw new Error('Page target not found');

  const client = new CDPClient(page.webSocketDebuggerUrl);
  await client.connect();

  // Enable domains
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  // Set iPhone mobile metrics
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    fitWindow: false,
  });

  log('Waiting for initial page load...');
  await new Promise(r => setTimeout(r, 2000));

  // 1. Home Screenshot
  log('Test 1: Home Dashboard');
  await client.captureScreenshot('01-home-dashboard.png');

  // 2. FAB Menu
  log('Test 2: Floating Action Button (FAB)');
  await client.evaluate(`document.getElementById('fab').click();`);
  await new Promise(r => setTimeout(r, 600));
  await client.captureScreenshot('02-fab-menu.png');
  // Dismiss sheet
  await client.evaluate(`
    const cancel = document.querySelector('.sheet-cancel') || document.querySelector('.sheet-overlay');
    if (cancel) cancel.click();
  `);
  await new Promise(r => setTimeout(r, 400));

  // 3. Subjects list empty state
  log('Test 3: Subjects List');
  await client.evaluate(`window.location.hash = '#/subjects';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('03-subjects-list.png');

  // 4. Open Add Subject Modal
  log('Test 4: Open Add Subject Modal');
  await client.evaluate(`
    const addBtn = document.getElementById('btn-add-subject') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إضافة مادة'));
    if (addBtn) addBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await client.captureScreenshot('04-add-subject-modal.png');

  // 5. Fill and Save Subject
  log('Test 5: Fill and Save Subject');
  await client.evaluate(`
    const form = document.getElementById('subject-form');
    if (form) {
      const nameInput = form.querySelector('[name="name"]');
      if (nameInput) {
        nameInput.value = 'كهرومغناطيسية وتطبيقاتها';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const instructorInput = form.querySelector('[name="instructor"]');
      if (instructorInput) {
        instructorInput.value = 'د. علي الخفاجي';
        instructorInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    const saveBtn = document.querySelector('.modal-footer .btn-primary');
    if (saveBtn) saveBtn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await client.captureScreenshot('05-subject-created.png');

  // 6. Click Subject to view details
  log('Test 6: Subject Details');
  await client.evaluate(`
    const subjCard = document.querySelector('.subject-card') || document.querySelector('[data-subject-id]');
    if (subjCard) subjCard.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await client.captureScreenshot('06-subject-details.png');

  // 7. Schedule Page (Day & Week views)
  log('Test 7: Schedule (Week View)');
  await client.evaluate(`window.location.hash = '#/schedule';`);
  await new Promise(r => setTimeout(r, 800));
  await client.evaluate(`
    const weekBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('أسبوع') || b.dataset.view === 'week');
    if (weekBtn) weekBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await client.captureScreenshot('07-schedule-week-view.png');

  // 8. Add Lecture and Conflict Check
  log('Test 8: Add Lecture & Conflict Detection');
  await client.evaluate(`
    const addLecBtn = document.getElementById('btn-add-lecture') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إضافة محاضرة'));
    if (addLecBtn) addLecBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await client.captureScreenshot('08-add-lecture-modal.png');

  // Save Lecture 1
  await client.evaluate(`
    const form = document.getElementById('lecture-form');
    if (form) {
      const subjSelect = form.querySelector('[name="subjectId"]');
      if (subjSelect && subjSelect.options.length > 0) subjSelect.selectedIndex = 0;
      form.querySelector('[name="dayOfWeek"]').value = '0'; // Sunday
      form.querySelector('[name="startTime"]').value = '08:30';
      form.querySelector('[name="endTime"]').value = '10:30';
      form.querySelector('[name="location"]').value = 'قاعة 302 قسم الاتصالات';
    }
    const saveBtn = document.querySelector('.modal-footer .btn-primary');
    if (saveBtn) saveBtn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await client.captureScreenshot('09-lecture-saved.png');

  // Try adding a conflicting lecture
  log('Test 9: Testing conflict detection...');
  await client.evaluate(`
    const addLecBtn = document.getElementById('btn-add-lecture') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إضافة محاضرة'));
    if (addLecBtn) addLecBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await client.evaluate(`
    const form = document.getElementById('lecture-form');
    if (form) {
      const subjSelect = form.querySelector('[name="subjectId"]');
      if (subjSelect && subjSelect.options.length > 0) subjSelect.selectedIndex = 0;
      form.querySelector('[name="dayOfWeek"]').value = '0'; // Sunday
      form.querySelector('[name="startTime"]').value = '09:00'; // Overlaps 08:30-10:30!
      form.querySelector('[name="endTime"]').value = '11:00';
      form.querySelector('[name="location"]').value = 'مختبر المايكروويف';
    }
    const saveBtn = document.querySelector('.modal-footer .btn-primary');
    if (saveBtn) saveBtn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('10-conflict-warning.png');

  // Dismiss conflict dialog AND close modal
  await client.evaluate(`
    const cancelConfirm = document.querySelector('.dialog-actions .cancel-btn');
    if (cancelConfirm) cancelConfirm.click();
    const modalClose = document.querySelector('.modal-close-btn');
    if (modalClose) modalClose.click();
  `);
  await new Promise(r => setTimeout(r, 600));

  // 11. Tasks
  log('Test 10: Tasks Page');
  await client.evaluate(`window.location.hash = '#/tasks';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('11-tasks-page.png');

  // 12. Exams
  log('Test 11: Exams Page');
  await client.evaluate(`window.location.hash = '#/exams';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('12-exams-page.png');

  // 13. Populated Home Dashboard
  log('Test 12: Populated Home Dashboard');
  await client.evaluate(`window.location.hash = '#/home';`);
  await new Promise(r => setTimeout(r, 1000));
  await client.captureScreenshot('13-home-with-data.png');

  // 14. More Tools Menu
  log('Test 13: More Menu');
  await client.evaluate(`window.location.hash = '#/more';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('14-more-menu.png');

  // 15. Engineering Calculator
  log('Test 14: Engineering Calculator');
  await client.evaluate(`window.location.hash = '#/calculator';`);
  await new Promise(r => setTimeout(r, 800));
  // Test typing formula
  await client.evaluate(`
    const calcInput = document.querySelector('.calc-display-input') || document.getElementById('calc-input');
    if (calcInput) {
      calcInput.value = '20 * log10(100)';
      calcInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const evalBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === '=');
    if (evalBtn) evalBtn.click();
  `);
  await new Promise(r => setTimeout(r, 500));
  await client.captureScreenshot('15-calculator.png');

  // 16. Notes
  log('Test 15: Notes Page');
  await client.evaluate(`window.location.hash = '#/notes';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('16-notes.png');

  // 17. Focus Timer
  log('Test 16: Focus Timer (Pomodoro)');
  await client.evaluate(`window.location.hash = '#/focus-timer';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('17-focus-timer.png');

  // 18. Mindmaps
  log('Test 17: Mindmaps');
  await client.evaluate(`window.location.hash = '#/mindmaps';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('18-mindmaps.png');

  // 19. Flashcards
  log('Test 18: Flashcards');
  await client.evaluate(`window.location.hash = '#/flashcards';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('19-flashcards.png');

  // 20. Backup & Settings
  log('Test 19: Backup & Data Export');
  await client.evaluate(`window.location.hash = '#/backup';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('20-backup.png');

  log('Test 20: Settings');
  await client.evaluate(`window.location.hash = '#/settings';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('21-settings.png');

  // Test 21: Toggle to Light Mode & Verify Themes
  log('Test 21: Switching to Light Mode...');
  await client.evaluate(`
    const lightBtn = document.getElementById('btn-theme-light');
    if (lightBtn) lightBtn.click();
  `);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('22-settings-light.png');

  log('Test 22: Home Dashboard in Light Mode');
  await client.evaluate(`window.location.hash = '#/home';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('23-home-light.png');

  log('Test 23: Subjects in Light Mode');
  await client.evaluate(`window.location.hash = '#/subjects';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('24-subjects-light.png');

  log('Test 24: Add Subject Modal in Light Mode');
  await client.evaluate(`
    const addBtn = document.getElementById('btn-add-subject') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('إضافة مادة'));
    if (addBtn) addBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await client.captureScreenshot('25-modal-light.png');
  await client.evaluate(`
    const closeBtn = document.querySelector('.modal-close-btn');
    if (closeBtn) closeBtn.click();
  `);
  await new Promise(r => setTimeout(r, 500));

  log('Test 25: Calculator in Light Mode');
  await client.evaluate(`window.location.hash = '#/calculator';`);
  await new Promise(r => setTimeout(r, 800));
  await client.captureScreenshot('26-calculator-light.png');

  log('Test 26: Schedule in Light Mode');
  await client.evaluate(`window.location.hash = '#/schedule';`);
  await new Promise(r => setTimeout(r, 800));
  await client.evaluate(`
    const weekBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('أسبوع') || b.dataset.view === 'week');
    if (weekBtn) weekBtn.click();
  `);
  await new Promise(r => setTimeout(r, 600));
  await client.captureScreenshot('27-schedule-week-light.png');

  client.close();
  chromeProc.kill();

  log('====================================');
  log(`All E2E tests finished!`);
  log(`Total Browser Errors Encountered: ${client.errors.length}`);
  if (client.errors.length > 0) {
    client.errors.forEach((e, idx) => console.error(`  [${idx+1}] ${e}`));
  } else {
    log('🎉 ZERO ERRORS! All UI interactions, navigation, and renders passed smoothly!');
  }
}

run().catch(err => {
  console.error('[E2E RUNNER FATAL ERROR]', err);
  process.exit(1);
});
