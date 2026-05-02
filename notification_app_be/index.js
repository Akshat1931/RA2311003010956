require('dotenv').config({path: '../.env'})
const { Log } = require('../logging_middleware')
const express = require('express')
const mongoose = require('mongoose')
const app = express()

app.use(express.json())

// weights based on importance
const wts = { "Placement": 3, "Result": 2, "Event": 1 }

async function getNotifs() {
    let req = await fetch("http://20.207.122.201/evaluation-service/notifications", {
        headers: { "Authorization": "Bearer " + process.env.TOKEN }
    })
    let d = await req.json()
    return d.notifications
}

// sorts by weight first, then breaks ties using timestamp recency
function getTop(arr, limit) {
    arr.sort((a, b) => {
        let wa = wts[a.Type] || 0
        let wb = wts[b.Type] || 0
        if(wa !== wb) return wb - wa
        let t1 = new Date(a.Timestamp).getTime()
        let t2 = new Date(b.Timestamp).getTime()
        return t2 - t1 // descending order
    })
    return arr.slice(0, limit)
}

app.get('/priority-inbox', async (req, res) => {
    await Log("backend", "info", "route", "priority inbox req")
    
    mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/notif_test").then(c => {
        // connected db successfully
    }).catch(err => {
        Log("backend", "error", "db", "failed mongo conn")
    })

    try {
        let raw = await getNotifs()
        await Log("backend", "info", "db", "got notifs")
        
        let top = getTop(raw, 10)
        
        await Log("backend", "info", "service", "generated top 10")
        res.json({ data: top })
    } catch(err) {
        await Log("backend", "error", "handler", "inbox error")
        res.status(500).json({ err: "failed" })
    }
})

app.listen(3001, async () => {
    await Log("backend", "info", "service", "started on 3001")
})
