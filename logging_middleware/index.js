const s = ["backend", "frontend"]
const l = ["debug", "info", "warn", "error", "fatal"]
const p = ["cache", "controller", "cron_job", "db", "domain", "handler", "repository", "route", "service", "auth", "config", "middleware", "utils"]

async function Log(stack, lvl, pkg, msg) {
    if(!s.includes(stack) || !l.includes(lvl) || !p.includes(pkg)) {
        return
    }

    let payload = { stack: stack, level: lvl, package: pkg, message: msg }

    try {
        let req = await fetch("http://20.207.122.201/evaluation-service/logs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.TOKEN}`
            },
            body: JSON.stringify(payload)
        })
        return await req.json()
    } catch(e) {
    }
}

module.exports = { Log }
