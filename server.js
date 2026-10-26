const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true, game: "LIE OR LEGEND" }));

const QUESTIONS = [
  { q: "Which animal has fingerprints so similar to humans that they can confuse investigators?", a: "Koala", fact: "Koala fingerprints can look remarkably similar to human fingerprints." },
  { q: "What was the first food eaten on the Moon?", a: "Peach", fact: "Apollo 11 astronauts ate peach, bacon squares, sugar-cookie cubes and other foods; peach dessert was among the foods." },
  { q: "Which planet rains diamonds deep inside its atmosphere, according to scientific models?", a: "Neptune", fact: "High-pressure conditions on ice giants may form diamond precipitation." },
  { q: "What is a group of flamingos commonly called?", a: "A flamboyance", fact: "A group of flamingos is often called a flamboyance." },
  { q: "Which sea creature has three hearts?", a: "Octopus", fact: "Octopuses have three hearts and blue blood." },
  { q: "What is the only mammal capable of true sustained flight?", a: "Bat", fact: "Bats are the only mammals capable of sustained powered flight." },
  { q: "Which fruit is botanically a berry, while a strawberry is not?", a: "Banana", fact: "Botanically, bananas are berries; strawberries are aggregate accessory fruits." },
  { q: "What do wombats produce that is famously cube-shaped?", a: "Poop", fact: "Wombat droppings are cube-shaped, helping them stay in place when marking territory." },
  { q: "Which animal can sleep while standing up and also lie down for deep sleep?", a: "Horse", fact: "Horses can doze standing but lie down for some deeper sleep stages." },
  { q: "What is the name for the fear of long words, often joked about?", a: "Hippopotomonstrosesquipedaliophobia", fact: "The comically long term is commonly used for fear of long words." },
  { q: "Which bird can fly backwards?", a: "Hummingbird", fact: "Hummingbirds can hover and fly backwards." },
  { q: "Which animal's teeth can continue growing throughout its life?", a: "Rabbit", fact: "Rabbit teeth grow continuously and are worn down by chewing." },
  { q: "What is the dot over a lowercase i or j called?", a: "Tittle", fact: "The small dot is called a tittle." },
  { q: "Which animal is known for having rectangular pupils?", a: "Goat", fact: "Goats and many other grazing animals have horizontal rectangular pupils." },
  { q: "What is the world's largest species of penguin?", a: "Emperor penguin", fact: "The emperor penguin is the tallest and heaviest living penguin species." },
  { q: "Which insect tastes with its feet?", a: "Butterfly", fact: "Butterflies have taste receptors on their feet." },
  { q: "What is the only continent with no native ants?", a: "Antarctica", fact: "Ants are not native to Antarctica." },
  { q: "Which animal can regenerate lost arms?", a: "Starfish", fact: "Many sea stars can regenerate lost arms, and some can regrow much of their body." },
  { q: "What is the name of the world's largest living lizard?", a: "Komodo dragon", fact: "The Komodo dragon is the largest living lizard." },
  { q: "Which animal's heart can weigh as much as a small car?", a: "Blue whale", fact: "A blue whale's heart can weigh hundreds of kilograms, around the size of a small car in popular comparisons." }
];
const rooms = new Map();
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  let code;
  do { code = Array.from({length:6}, () => alphabet[Math.floor(Math.random()*alphabet.length)]).join(""); }
  while (rooms.has(code));
  return code;
}
function cleanName(s) { return String(s || "Player").trim().replace(/[<>]/g, "").slice(0,18) || "Player"; }
function cleanAnswer(s) { return String(s || "").trim().replace(/[<>]/g, "").slice(0,100); }
function publicRoom(room) {
  return { code: room.code, phase: room.phase, round: room.roundIndex + 1, maxRounds: 5,
    players: [...room.players.values()].map(p => ({id:p.id,name:p.name,score:p.score,host:p.id===room.hostId,submitted:!!room.answers[p.id],voted:!!room.votes[p.id]})),
    question: room.current ? room.current.q : null, deadline: room.deadline,
    answers: room.phase === "vote" ? room.displayAnswers.map(x => ({id:x.id,text:x.text})) : [],
    reveal: room.phase === "reveal" || room.phase === "finished" ? room.reveal : null,
    lastScores: room.lastScores || null };
}
function emitRoom(room) { io.to(room.code).emit("state", publicRoom(room)); }
function stopTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; }
function setPhase(room, phase, seconds) {
  stopTimer(room); room.phase = phase; room.deadline = seconds ? Date.now()+seconds*1000 : null;
  if (seconds) room.timer = setTimeout(() => onTimeout(room.code, phase), seconds*1000);
}
function onTimeout(code, phase) {
  const room=rooms.get(code); if (!room || room.phase!==phase) return;
  if (phase==="answer") beginVoting(room);
  else if (phase==="vote") revealRound(room);
}
function startRound(room) {
  if (room.roundIndex >= 5) { finishGame(room); return; }
  room.current = room.deck[room.roundIndex];
  room.answers = {}; room.votes = {}; room.reveal = null; room.lastScores = null;
  room.phase = "answer"; room.displayAnswers = [];
  setPhase(room, "answer", 30); emitRoom(room);
}
function beginVoting(room) {
  stopTimer(room);
  const submitted = [...room.players.values()].filter(p=>room.answers[p.id]);
  // Keep each player's bluff and add the truth. In 2-player mode, include a secret decoy.
  const choices = submitted.map(p=>({id:"a_"+p.id,text:room.answers[p.id],ownerId:p.id}));
  choices.push({id:"truth",text:room.current.a,ownerId:null});
  if (room.players.size===2) choices.push({id:"decoy",text:makeDecoy(room.current.a),ownerId:null});
  room.displayAnswers = shuffle(choices);
  room.phase="vote"; room.deadline=Date.now()+30000;
  room.timer=setTimeout(()=>onTimeout(room.code,"vote"),30000);
  emitRoom(room);
}
function makeDecoy(answer) {
  const decoys = ["A very confident pigeon","The Moon's secret twin","A tiny invisible horse","The ancient art of sandwiching","A sleepy sea cucumber","Professor Wobblebottom"];
  let d=decoys[Math.floor(Math.random()*decoys.length)];
  if(d.toLowerCase()===answer.toLowerCase()) d="A confused penguin";
  return d;
}
function shuffle(a) { return a.map(x=>({x,r:Math.random()})).sort((u,v)=>u.r-v.r).map(o=>o.x); }
function revealRound(room) {
  stopTimer(room);
  const points = {};
  for (const p of room.players.values()) points[p.id]=0;
  for (const [voterId, answerId] of Object.entries(room.votes)) {
    const voter=room.players.get(voterId);
    if (!voter) continue;
    if (answerId==="truth") { points[voterId]+=2; }
    else {
      const chosen=room.displayAnswers.find(x=>x.id===answerId);
      if (chosen && chosen.ownerId && chosen.ownerId!==voterId) points[chosen.ownerId]+=1;
    }
  }
  for (const p of room.players.values()) p.score += points[p.id] || 0;
  room.lastScores = [...room.players.values()].map(p=>({id:p.id,name:p.name,points:points[p.id]||0,total:p.score}));
  room.reveal = {truth:room.current.a,fact:room.current.fact,answers:room.displayAnswers.map(x=>({id:x.id,text:x.text,ownerId:x.ownerId,ownerName:x.ownerId?room.players.get(x.ownerId)?.name:null,voters:Object.entries(room.votes).filter(([,aid])=>aid===x.id).map(([pid])=>room.players.get(pid)?.name).filter(Boolean)})),scores:room.lastScores};
  room.phase = room.roundIndex===4 ? "finished" : "reveal";
  room.deadline=null; emitRoom(room);
}
function finishGame(room) {
  stopTimer(room); room.phase="finished"; room.deadline=null;
  room.reveal = room.reveal || {truth:room.current?.a,fact:room.current?.fact,answers:[],scores:[]};
  room.winners=[...room.players.values()].sort((a,b)=>b.score-a.score).filter(p=>p.score===[...room.players.values()].reduce((m,x)=>Math.max(m,x.score),0)).map(p=>({id:p.id,name:p.name,score:p.score}));
  emitRoom(room);
}
function nextRound(room) { room.roundIndex++; startRound(room); }
io.on("connection", socket => {
  socket.on("createRoom", ({name}={}) => {
    const code=makeCode(), id=socket.id;
    const deck=shuffle(QUESTIONS).slice(0,5);
    const room={code,hostId:id,players:new Map([[id,{id,name:cleanName(name),score:0}]]),phase:"lobby",roundIndex:-1,deck,current:null,answers:{},votes:{},displayAnswers:[],reveal:null,lastScores:null,timer:null,deadline:null};
    rooms.set(code,room); socket.join(code); socket.data.room=code; socket.data.player=id;
    socket.emit("created",{code}); emitRoom(room);
  });
  socket.on("joinRoom", ({code,name}={}) => {
    code=String(code||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
    const room=rooms.get(code);
    if (!room) return socket.emit("errorMessage","Room code not found. Check it and try again.");
    if (room.phase!=="lobby") return socket.emit("errorMessage","This game has already started.");
    if (room.players.size>=8) return socket.emit("errorMessage","This room is full (8 players maximum).");
    const id=socket.id;
    room.players.set(id,{id,name:cleanName(name),score:0}); socket.join(code); socket.data.room=code; socket.data.player=id;
    emitRoom(room);
  });
  socket.on("startGame", () => {
    const room=rooms.get(socket.data.room);
    if (!room || socket.id!==room.hostId) return;
    if (room.players.size<2) return socket.emit("errorMessage","At least 2 players are needed to start.");
    room.roundIndex=0; startRound(room);
  });
  socket.on("submitAnswer", ({answer}={}) => {
    const room=rooms.get(socket.data.room); if(!room || room.phase!=="answer") return;
    const player=room.players.get(socket.id); const val=cleanAnswer(answer);
    if(!player || !val || room.answers[socket.id]) return;
    if(val.toLowerCase()===room.current.a.toLowerCase()) return socket.emit("errorMessage","Try a fake answer—not the real one!");
    room.answers[socket.id]=val; emitRoom(room);
    if([...room.players.keys()].every(id=>room.answers[id])) beginVoting(room);
  });
  socket.on("vote", ({answerId}={}) => {
    const room=rooms.get(socket.data.room); if(!room || room.phase!=="vote" || room.votes[socket.id]) return;
    const option=room.displayAnswers.find(x=>x.id===answerId);
    if(!option || option.ownerId===socket.id) return socket.emit("errorMessage","You can't vote for your own bluff.");
    room.votes[socket.id]=answerId; emitRoom(room);
    if([...room.players.keys()].every(id=>room.votes[id])) revealRound(room);
  });
  socket.on("nextRound", () => {
    const room=rooms.get(socket.data.room); if(!room || socket.id!==room.hostId || room.phase!=="reveal") return;
    nextRound(room);
  });
  socket.on("playAgain", () => {
    const room=rooms.get(socket.data.room); if(!room || socket.id!==room.hostId || room.phase!=="finished") return;
    room.players.forEach(p=>p.score=0); room.roundIndex=0; room.deck=shuffle(QUESTIONS).slice(0,5); room.winners=null; startRound(room);
  });
  socket.on("disconnect", () => {
    const code=socket.data.room, room=rooms.get(code); if(!room) return;
    room.players.delete(socket.id); delete room.answers[socket.id]; delete room.votes[socket.id];
    if(room.players.size===0){stopTimer(room);rooms.delete(code);return;}
    if(room.hostId===socket.id) room.hostId=room.players.keys().next().value;
    emitRoom(room);
  });
});
server.listen(PORT, () => console.log(`LIE OR LEGEND running on port ${PORT}`));
