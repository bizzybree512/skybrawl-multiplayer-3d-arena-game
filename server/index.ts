import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import { BotBrain } from '../src/game/bots.ts'
import { Simulation, TICK, IDLE_INPUT, MAX_PLAYERS } from '../src/game/sim.ts'
import type { GameEvent, GameState, PlayerInput, PlayerSeat } from '../src/game/sim.ts'

type Client = { ws: WebSocket; id: string; name: string; color: string; roomCode?: string; ready: boolean }
type Room = { code: string; hostId: string; clients: Map<string, Client>; started: boolean; sim?: Simulation; bots: Map<string, BotBrain>; lastEvents: GameEvent[]; timer?: NodeJS.Timeout }
const clients = new Map<WebSocket, Client>()
const rooms = new Map<string, Room>()
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const port = Number(process.env.PORT || 10000)
const http = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return }
  res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Skybrawl multiplayer server')
})
const wss = new WebSocketServer({ server: http })
const send = (c: Client, data: unknown) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(data)) }
function code() { let s=''; do { s=''; for(let i=0;i<4;i++) s+=alphabet[Math.floor(Math.random()*alphabet.length)] } while(rooms.has(s)); return s }
function roster(r: Room) {
  return [...r.clients.values()].map(c=>({id:c.id,name:c.name,color:c.color,isBot:false,isHost:c.id===r.hostId,ready:c.ready}))
}
function lobby(r: Room) { for(const c of r.clients.values()) send(c,{type:'lobby',code:r.code,hostId:r.hostId,started:r.started,players:roster(r)}) }
function seatList(r: Room): PlayerSeat[] {
  const seats: PlayerSeat[] = [...r.clients.values()].map(c=>({id:c.id,name:c.name,color:c.color,isBot:false}))
  const palette=['#22e4ff','#ff2bd6','#b4ff2e','#ffb02e']
  const botNames=['GLITCH','NEONIX','BYTEBOY','ZAPPA']
  let i=0
  while(seats.length<Math.min(2,MAX_PLAYERS)) { seats.push({id:'bot-'+i,name:botNames[i%4],color:palette[(seats.length)%4],isBot:true}); i++ }
  // In a public room, fill unused seats with server-run bots after all human drivers have joined.
  while(seats.length<MAX_PLAYERS) { seats.push({id:'bot-'+i,name:botNames[i%4],color:palette[seats.length%4],isBot:true}); i++ }
  return seats
}
function start(r: Room) {
  if(r.started) return
  r.started=true
  r.sim=new Simulation(seatList(r), Math.floor(Math.random()*0x7fffffff))
  r.bots.clear()
  for(const s of r.sim.state.cars) if(s.isBot) r.bots.set(s.id,new BotBrain(s.id,0.7))
  lobby(r)
  r.timer=setInterval(()=>{
    if(!r.sim) return
    const inputs: Record<string,PlayerInput>={}
    for(const [id,brain] of r.bots) inputs[id]=brain.think(r.sim.state)
    for(const c of r.clients.values()) inputs[c.id]=cInput.get(c.id) ?? IDLE_INPUT
    r.sim.step(inputs)
    r.lastEvents=r.sim.drainEvents()
    const state=r.sim.state
    for(const c of r.clients.values()) send(c,{type:'state',state,events:r.lastEvents})
    if(state.phase==='matchEnd') { clearInterval(r.timer); r.timer=undefined }
  }, TICK*1000)
}
const cInput = new Map<string,PlayerInput>()
function leave(c: Client) {
  cInput.delete(c.id)
  if(!c.roomCode) return
  const r=rooms.get(c.roomCode); if(!r) return
  r.clients.delete(c.id)
  if(r.clients.size===0) { if(r.timer) clearInterval(r.timer); rooms.delete(r.code); return }
  if(r.hostId===c.id) r.hostId=r.clients.keys().next().value as string
  lobby(r)
}
function handle(c: Client, msg: any) {
  if(!msg || typeof msg.type!=='string') return
  if(msg.type==='create') {
    leave(c)
    c.name=String(msg.name||'DRIVER').toUpperCase().slice(0,12)
    c.color=String(msg.color||'#22e4ff')
    const r:Room={code:code(),hostId:c.id,clients:new Map([[c.id,c]]),started:false,bots:new Map(),lastEvents:[]}
    c.roomCode=r.code;c.ready=true;rooms.set(r.code,r);lobby(r);return
  }
  if(msg.type==='join') {
    const roomCode=String(msg.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)
    const r=rooms.get(roomCode)
    if(!r) { send(c,{type:'error',message:'Room not found. Check the code and try again.'});return }
    if(r.started) { send(c,{type:'error',message:'This match has already started.'});return }
    if(r.clients.size>=MAX_PLAYERS) { send(c,{type:'error',message:'Room is full.'});return }
    leave(c); c.name=String(msg.name||'DRIVER').toUpperCase().slice(0,12);c.color=String(msg.color||'#ff2bd6');c.roomCode=roomCode;c.ready=false;r.clients.set(c.id,c);lobby(r);return
  }
  if(!c.roomCode) { send(c,{type:'error',message:'Create or join a room first.'});return }
  const r=rooms.get(c.roomCode);if(!r)return
  if(msg.type==='ready') { c.ready=!!msg.ready;lobby(r);return }
  if(msg.type==='start') { if(c.id!==r.hostId){send(c,{type:'error',message:'Only the host can start the match.'});return} if(r.clients.size<2){send(c,{type:'error',message:'At least two real players are needed.'});return} start(r);return }
  if(msg.type==='input' && r.started && r.sim) {
    const i=msg.input||{}
    cInput.set(c.id,{throttle:Math.max(-1,Math.min(1,Number(i.throttle)||0)),steer:Math.max(-1,Math.min(1,Number(i.steer)||0)),boost:!!i.boost,dash:!!i.dash});return
  }
  if(msg.type==='rematch' && r.started && c.id===r.hostId && r.sim) { r.sim.rematch();if(!r.timer) startLoopAgain(r);return }
}
function startLoopAgain(r:Room) {
  if(!r.sim)return
  r.timer=setInterval(()=>{
    if(!r.sim)return
    const inputs:Record<string,PlayerInput>={}
    for(const [id,brain] of r.bots) inputs[id]=brain.think(r.sim.state)
    for(const c of r.clients.values()) inputs[c.id]=cInput.get(c.id)??IDLE_INPUT
    r.sim.step(inputs);const events=r.sim.drainEvents()
    for(const c of r.clients.values())send(c,{type:'state',state:r.sim!.state,events})
    if(r.sim.state.phase==='matchEnd'){clearInterval(r.timer);r.timer=undefined}
  },TICK*1000)
}
wss.on('connection',ws=>{
  const c:Client={ws,id:randomUUID(),name:'DRIVER',color:'#22e4ff',ready:false}
  clients.set(ws,c);send(c,{type:'connected',id:c.id})
  ws.on('message',raw=>{try{handle(c,JSON.parse(raw.toString()))}catch{send(c,{type:'error',message:'Invalid server message.'})}})
  ws.on('close',()=>{clients.delete(ws);leave(c)})
})
http.listen(port,'0.0.0.0',()=>console.log('Skybrawl multiplayer listening on '+port))
