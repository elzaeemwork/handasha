const { spawn } = require('child_process');
const http = require('http');

const ROUTES_TO_TEST = [
  '/home',
  '/subjects',
  '/calendar',
  '/schedule',
  '/tasks',
  '/exams',
  '/more',
  '/notes',
  '/focus-timer',
  '/flashcards',
  '/quizzes',
  '/mindmaps',
  '/calculator',
  '/statistics',
  '/backup',
  '/settings',
  '/notifications',
  '/onboarding'
];

async function runTest() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:8080/index.html'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const listData = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/list', (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });

  const page = listData.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const exceptions = [];
  const logs = [];

  ws.onopen = () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails);
      console.error('EXCEPTION:', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const text = msg.params.args.map(a => a.value || a.description).join(' ');
      console.error('CONSOLE ERROR:', text);
      exceptions.push(text);
    }
  };

  // Wait 2s for home to load
  await new Promise(r => setTimeout(r, 2000));

  for (const route of ROUTES_TO_TEST) {
    console.log(`\n--- Testing route: ${route} ---`);
    ws.send(JSON.stringify({
      id: 100,
      method: 'Runtime.evaluate',
      params: { expression: `window.location.hash = '#${route}';` }
    }));
    await new Promise(r => setTimeout(r, 1000));

    // Check innerHTML length
    const evalPromise = new Promise((resolve) => {
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === 200) {
          ws.removeEventListener('message', handler);
          resolve(msg.result?.result?.value);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({
        id: 200,
        method: 'Runtime.evaluate',
        params: { expression: `document.getElementById('app-content').innerHTML.length` }
      }));
    });

    const len = await evalPromise;
    console.log(`Route ${route} rendered with innerHTML length: ${len}`);
    if (len < 50) {
      console.error(`WARNING: Route ${route} seems empty!`);
    }
  }

  ws.close();
  chromeProc.kill();
  console.log(`\n============================`);
  console.log(`Test complete! Total exceptions/errors: ${exceptions.length}`);
}

runTest().catch(console.error);
