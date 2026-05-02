stage 1

core api actions:
- fetch all the notifs for someone
- mark one as read
- get the real time ones

1. fetch api
endpoint: GET /api/v1/notifs
header: Authorization: Bearer <token>
res:
{ "notifications": [ { "id": "123", "type": "Result", "message": "mid-sem", "isRead": false, "createdAt": "2026-04-22T17:50:30Z" } ] }

2. mark as read
endpoint: PATCH /api/v1/notifs/:id/read
header: Authorization: Bearer <token>

realtime stuff:
ill just use server sent events (SSE). we dont really need websockets since notifications only go one way (server to frontend). its way easier to scale up.


stage 2

db choice: mongodb. 
notifs dont need complex relational stuff and mongo handles huge amounts of writes way better out of the box.

schema:
{
  "_id": "ObjectId",
  "studentId": "some string",
  "type": "Event | Result | Placement",
  "message": "text",
  "isRead": false,
  "createdAt": "date"
}

scaling problem:
if HR does "notify all", saving millions of docs at once will freeze the primary node. 
fix: shard the db using studentId. and setup read replicas so fetching doesnt get blocked by the huge writes.

query:
db.notifs.find({ studentId: "1234", isRead: false }).sort({ createdAt: -1 }).limit(20)


stage 3

critique:
SELECT * FROM notifications WHERE studentID = 1042 AND isRead = false ORDER BY createdAt DESC;

is it accurate? yeah the logic is fine.
why is it slow? full table scan. it has no composite index so it checks every single row in the db to sort them.
fix: just add an index on (studentID, isRead, createdAt DESC). makes it super fast.

indexing every column? terrible idea. whenever u insert a new record the db has to pause and update every single index. inserts will become incredibly slow.

recent placements query:
SELECT DISTINCT student_id FROM notifications WHERE type = 'Placement' AND created_at >= NOW() - INTERVAL '7 days';


stage 4

page load issue
if we fetch on page load the db is gonna die.

fixes:
1. put redis in front. cache the top recent notifs for active users so the db doesnt even get hit.
2. push updates via SSE (from stage 1) so the frontend doesnt need to refresh or poll the db constantly.

tradeoffs:
redis makes it fast but adds pain of cache invalidation.
sse reduces db hits but keeping thousands of tcp connections open uses alot of server memory.


stage 5

pseudocode problems:
its synchronous. if send_email takes 1 sec, 50k students takes hours. also if it crashes on the 200th user, the loop breaks and 49,800 people get nothing.

should db save and email happen together?
no. emails fail all the time bcos of network. if u tie them to the db save, the db locks up waiting for the email to finish.

new pseudocode:
use a message queue like rabbitmq.

function notify_all(ids, msg):
    events = []
    for id in ids: events.append({"studentId": id, "text": msg})
    bulk_save_to_db(events) # save all at once fast
    push_to_queue("emails", events) # send to background queue

function email_worker(event):
    try: send_email(event.studentId, event.text)
    except: requeue_later(event)


stage 6

efficient top 10:
sorting the whole db every time a new notif arrives is way too slow.
instead just keep a Min-Heap (priority queue) of size 10 in the backend memory.
when a new one comes:
1. calc score (weight + time)
2. compare to the root of the min heap (the worst item currently in the top 10)
3. if its better, pop the root and push the new one.
since the heap is capped at size 10, inserting takes O(1) time basically. so it can handle crazy amounts of incoming notifs without lagging.
