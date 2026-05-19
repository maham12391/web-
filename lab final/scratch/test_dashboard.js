const loginUrl = 'http://localhost:3000/login';
const salesUrl = 'http://localhost:3000/sales';
const apiUrl = 'http://localhost:3000/api/sales-data';

async function runTest() {
    console.log('Sending login request...');
    const loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'email=admin%40daraz.com&password=admin123',
        redirect: 'manual' // Prevent automatic redirect follow to inspect headers
    });

    console.log('Login Response Status:', loginRes.status);
    console.log('Login Headers Location:', loginRes.headers.get('location'));
    const cookies = loginRes.headers.get('set-cookie');
    console.log('Cookies received:', cookies);

    if (!cookies) {
        console.error('Failed to log in, no cookie returned.');
        process.exit(1);
    }

    console.log('\n--- Fetching /sales Dashboard HTML ---');
    const salesRes = await fetch(salesUrl, {
        headers: {
            'cookie': cookies
        },
        redirect: 'manual'
    });
    console.log('Sales Page Status:', salesRes.status);
    console.log('Sales Headers Location:', salesRes.headers.get('location'));
    
    const salesHtml = await salesRes.text();
    console.log('Sales Page HTML Snippet:', salesHtml.substring(0, 500));

    console.log('\n--- Fetching /api/sales-data JSON ---');
    const apiRes = await fetch(apiUrl, {
        headers: {
            'cookie': cookies
        },
        redirect: 'manual'
    });
    console.log('API Response Status:', apiRes.status);
    console.log('API Headers Location:', apiRes.headers.get('location'));
    
    const apiText = await apiRes.text();
    console.log('API Response Text Snippet:', apiText.substring(0, 500));

    process.exit(0);
}

runTest().catch(err => {
    console.error('Test Error:', err);
    process.exit(1);
});
