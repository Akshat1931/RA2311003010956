require('dotenv').config({path: '../.env'})
const { Log } = require('../logging_middleware')
const express = require('express')
const app = express()

app.use(express.json())

// helper to fetch data from the provided apis
async function fetchApi(url) {
    let req = await fetch(url, { headers: { "Authorization": "Bearer " + process.env.TOKEN }})
    return await req.json()
}

// 0/1 knapsack logic to get max impact within the hour budget
function solve(budget, arr) {
    let len = arr.length
    // 2d array for dp
    let dp = Array(len + 1).fill().map(() => Array(budget + 1).fill(0))

    for(let i=1; i<=len; i++) {
        let curr = arr[i-1]
        for(let w=0; w<=budget; w++) {
            if(curr.Duration <= w) {
                dp[i][w] = Math.max(dp[i-1][w], dp[i-1][w - curr.Duration] + curr.Impact)
            } else {
                dp[i][w] = dp[i-1][w]
            }
        }
    }

    // traceback to find which tasks we picked
    let ans = []
    let currW = budget
    for(let i=len; i>0 && currW>0; i--) {
        if(dp[i][currW] !== dp[i-1][currW]) {
            ans.push(arr[i-1])
            currW -= arr[i-1].Duration
        }
    }

    return { max: dp[len][budget], selected: ans }
}

app.get('/schedule', async (req, res) => {
    await Log("backend", "info", "route", "scheduling req")
    
    try {
        let dData = await fetchApi("http://20.207.122.201/evaluation-service/depots")
        let vData = await fetchApi("http://20.207.122.201/evaluation-service/vehicles")
        await Log("backend", "info", "db", "got data from api")

        let out = []
        for(let depot of dData.depots) {
            let resObj = solve(depot.MechanicHours, vData.vehicles)
            out.push({
                depotId: depot.ID,
                budget: depot.MechanicHours,
                impact: resObj.max,
                total: resObj.selected.length,
                tasks: resObj.selected
            })
            await Log("backend", "info", "handler", "did knapsack for " + depot.ID)
        }
        
        await Log("backend", "info", "service", "done")
        res.json({ results: out })
    } catch(err) {
        await Log("backend", "error", "handler", "failed")
        res.status(500).json({ err: "error" })
    }
})

app.listen(3000, async () => {
    await Log("backend", "info", "service", "started on 3000")
})
