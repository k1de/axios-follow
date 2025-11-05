import axios from "axios"
import { axiosFollow, addFollowMethod } from '../dist/follow.js'

// Simple console formatter
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    ok: (msg) => `${c.green}✓${c.reset} ${msg}`,
    err: (msg) => `${c.red}✗${c.reset} ${msg}`,
    title: (msg) => `${c.blue}${msg}${c.reset}`,
    dim: (msg) => `${c.gray}${msg}${c.reset}`
}

let passed = 0, failed = 0

async function test(name, fn) {
    process.stdout.write(`${c.dim('→')} ${name} ... `)
    try {
        await fn()
        passed++
        console.log(c.ok('passed'))
    } catch (error) {
        failed++
        console.log(c.err('failed'))
        console.log(c.dim(`  ${error.message}`))
    }
}

// Tests
async function runTests() {
    console.log(c.title('\naxios-follow tests\n'))

    await test('axiosFollow with 3 redirects', async () => {
        const res = await axiosFollow(axios,
            { url: 'https://httpbin.org/redirect/3' },
            { maxRedirects: 3 }
        )
        console.log(c.dim(`  ${res.followChain.length} steps → ${res.status}`))
        if (res.status !== 200) throw new Error('Expected 200')
    })

    await test('addFollowMethod with cookies', async () => {
        const client = addFollowMethod(axios.create())
        const res = await client.follow({
            url: 'https://httpbin.org/cookies/set?session=test'
        })
        const hosts = Object.keys(res.cookies)
        if (!hosts.length) throw new Error('No cookies')
        console.log(c.dim(`  cookies: ${hosts.join(', ')}`))
    })

    await test('maxRedirects limit (expect fail)', async () => {
        try {
            await axiosFollow(axios,
                { url: 'https://httpbin.org/redirect/5' },
                { maxRedirects: 2 }
            )
            throw new Error('Should have thrown')
        } catch (error) {
            if (!error.message.includes('maxRedirects')) throw error
            console.log(c.dim(`  correctly limited to 2`))
        }
    })

    await test('includeResponses option', async () => {
        const res = await axiosFollow(axios,
            { url: 'https://httpbin.org/redirect/2' },
            { includeResponses: true }
        )
        const withResponse = res.followChain.filter(s => s.response).length
        console.log(c.dim(`  ${withResponse} responses included`))
        if (withResponse === 0) throw new Error('No responses')
    })

    // Summary
    console.log(`\n${c.title('Summary')}: ${c.ok(passed + ' passed')}${failed ? `, ${c.err(failed + ' failed')}` : ''}\n`)
}

runTests().catch(console.error)
