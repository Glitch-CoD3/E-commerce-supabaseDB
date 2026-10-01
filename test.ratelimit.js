const URL = 'http://localhost:3001/api/v1/auth/login';
const BODY = JSON.stringify({
    email: 'juelr5351@gmail.com',
    password: '1234',
},);

async function send(i) {
    const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: BODY,
    },
);
    const retry = res.headers.get('retry-after');
    console.log(`Request ${i}: ${res.status}${retry ? ` (Retry-After: ${retry}s)` : ''}`);
}

// Fire 10 requests at the same time
Promise.all(Array.from({ length: 10 }, (_, i) => send(i + 1)));