const socket = io();
const $ = id => document.getElementById(id);
let state=null, myId=null, myBluff="", soundOn=true, audioCtx=null, timerInterval=null, toastTimeout=null;
const faces=["🦊","🐸","🦄","🐙","🦝","🐥","🐼","🦖"];
function tone(freq=660,duration=.09,type="sine"){if(!soundOn)return;try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.value=.055;o.connect(g);g.connect(audioCtx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.stop(audioCtx.currentTime+duration)}catch(e){}}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove("show"),3000)}
function showHome(){ $("home").classList.remove("hidden");$("game").classList.add("hidden");state=null;clearInterval(timerInterval)}
function showGame(){ $("home").classList.add("hidden");$("game").classList.remove("hidden")}
function tab(which){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===which));$("createForm").classList.toggle("hidden",which!=="create");$("joinForm").classList.toggle("hidden",which!=="join")}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>tab(b.dataset.tab)));
$("createForm").addEventListener("submit",e=>{e.preventDefault();socket.emit("createRoom",{name:$("hostName").value})});
$("joinForm").addEventListener("submit",e=>{e.preventDefault();socket.emit("joinRoom",{name:$("joinName").value,code:$("roomCode").value})});
$("roomCode").addEventListener("input",e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6));
$("copyCode").addEventListener("click",async()=>{if(!state)return;try{await navigator.clipboard.writeText(state.code);toast("Room code copied!");tone(880)}catch(e){toast("Room code: "+state.code)}});
$("startBtn").addEventListener("click",()=>socket.emit("startGame"));
$("leaveBtn").addEventListener("click",()=>{socket.disconnect();socket.connect();showHome();toast("You left the room.")});
$("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"🔊":"🔇";if(soundOn)tone(740)});
$("answerForm").addEventListener("submit",e=>{e.preventDefault();const answer=$("fakeAnswer").value.trim();if(!answer)return;myBluff=answer;socket.emit("submitAnswer",{answer});$("fakeAnswer").value=""});
$("nextBtn").addEventListener("click",()=>socket.emit("nextRound"));
$("againBtn").addEventListener("click",()=>socket.emit("playAgain"));
socket.on("connect",()=>{myId=socket.id});
socket.on("created",({code})=>{showGame();toast("Room "+code+" created! Share your code.");tone(660,.1);setTimeout(()=>tone(880,.12),110)});
socket.on("errorMessage",msg=>toast(msg));
socket.on("state",s=>{const old=state;if(!old||old.round!==s.round)myBluff="";state=s;showGame();render(s,old)});
function render(s,old){
 $("copyCode").innerHTML=`${s.code} <span>▢</span>`;
 $("playerCount").textContent=s.players.length;
 $("roundLabel").textContent=s.phase==="lobby"?"WAITING ROOM":s.phase==="finished"?"GAME OVER":`ROUND ${s.round} / 5`;
 $("lobby").classList.toggle("hidden",s.phase!=="lobby");
 $("roundView").classList.toggle("hidden",s.phase==="lobby");
 $("startBtn").disabled=s.players.length<2;
 $("startBtn").textContent=s.players.length<2?"Waiting for players…":"Start game →";
 $("playerGrid").innerHTML=s.players.map((p,i)=>`<div class="player-chip"><span class="avatar">${faces[i%faces.length]}</span><div><strong>${esc(p.name)}${p.id===myId?" (you)":""}</strong>${p.host?'<span class="host-tag">★ HOST</span>':""}</div></div>`).join("");
 renderLeaderboard(s.players);
 if(s.phase!=="lobby"){
   $("question").textContent=s.question||"The next mystery awaits…";
   $("phaseTag").textContent=s.phase==="answer"?"✍️ WRITE A BLUFF":s.phase==="vote"?"🕵️ FIND THE TRUTH":s.phase==="reveal"?"✨ THE REVEAL": "🏁 FINAL RESULTS";
   $("answerArea").classList.toggle("hidden",s.phase!=="answer");
   $("voteArea").classList.toggle("hidden",s.phase!=="vote");
   $("waitingArea").classList.add("hidden");$("revealArea").classList.toggle("hidden",s.phase!=="reveal");$("finalArea").classList.toggle("hidden",s.phase!=="finished");
   if(s.phase==="answer"){
     const me=s.players.find(p=>p.id===myId);const done=!!me?.submitted;
     $("answerForm").classList.toggle("hidden",done);$("submittedState").classList.toggle("hidden",!done);
     if(done){$("waitingArea").classList.remove("hidden");$("waitingTitle").textContent="Bluff submitted!";$("waitingText").textContent="Waiting for everyone else to submit…";renderProgress(s,"submitted")}
   } else if(s.phase==="vote"){
     const me=s.players.find(p=>p.id===myId);const done=!!me?.voted;
     $("answerChoices").innerHTML=s.answers.map((a,i)=>`<button class="answer-choice" data-id="${a.id}" ${a.text===myBluff||done?"disabled":""}><span class="choice-letter">${String.fromCharCode(65+i)}</span><span>${esc(a.text)}${a.text===myBluff?'<small style="display:block;color:#ff7ac8">Your bluff</small>':""}</span></button>`).join("");
     document.querySelectorAll(".answer-choice").forEach(b=>b.addEventListener("click",()=>{socket.emit("vote",{answerId:b.dataset.id});tone(540)}));
     $("votedState").classList.toggle("hidden",!done);
     if(done){$("waitingArea").classList.remove("hidden");$("waitingTitle").textContent="Vote locked!";$("waitingText").textContent="Let's see who got fooled…";renderProgress(s,"voted")}
   } else if(s.phase==="reveal"){renderReveal(s);$("nextBtn").classList.toggle("hidden",!s.players.find(p=>p.id===myId)?.host);if(old?.phase!=="reveal")tone(780,.15,"triangle")}
   else if(s.phase==="finished"){renderReveal(s);renderFinal(s);if(old?.phase!=="finished"){tone(660,.12);setTimeout(()=>tone(830,.12),150);setTimeout(()=>tone(990,.2),300)}}
   if(s.phase==="answer"||s.phase==="vote")startTimer(s.deadline);
   else {clearInterval(timerInterval);$("timer").textContent="—";$("timerBar").style.width="0%"}
 }
}
function renderProgress(s,field){$("submissionList").innerHTML=s.players.map(p=>`<span class="submission-badge">${p[field]?"✓":"◷"} ${esc(p.name)}</span>`).join("")}
function renderLeaderboard(players){const sorted=[...players].sort((a,b)=>b.score-a.score);$("leaderboardRows").innerHTML=sorted.map((p,i)=>`<div class="leader-row"><span class="rank ${i===0?"top":""}">${i===0?"♛":String(i+1).padStart(2,"0")}</span><span class="leader-name">${esc(p.name)}${p.id===myId?" (you)":""}</span><span class="leader-score">${p.score} pts</span></div>`).join("")||'<p class="muted">Waiting for players…</p>'}
function renderReveal(s){const r=s.reveal;if(!r)return;$("truthAnswer").textContent=r.truth||"The truth was hiding!";$("truthFact").textContent=r.fact||"";$("roundScore").innerHTML=(r.scores||[]).slice().sort((a,b)=>b.points-a.points).map(p=>`<div class="score-line"><span class="person">${esc(p.name)}</span><span class="points">+${p.points} pts</span><span>${p.total} total</span></div>`).join("");$("revealAnswers").innerHTML=(r.answers||[]).map(a=>{const truth=a.id==="truth";return `<div class="reveal-answer ${truth?"truth":""}">${truth?'<span class="result-tag">✓ REAL ANSWER</span>':""}<strong>${esc(a.text)}</strong>${a.ownerName?`<span class="owner">Bluff by ${esc(a.ownerName)} · fooled: ${a.voters.length? a.voters.map(esc).join(", "):"nobody"}</span>`:a.id==="decoy"?'<span class="owner">Secret decoy answer</span>':""}</div>`}).join("")}
function renderFinal(s){const players=[...s.players].sort((a,b)=>b.score-a.score);const max=players[0]?.score??0;const winners=players.filter(p=>p.score===max);$("winnerTitle").textContent=winners.length>1?"It's a shared victory!":`${winners[0]?.name||"Someone"} is a LEGEND!`;$("winnerSubtitle").textContent=winners.length>1?`${winners.map(p=>p.name).join(" and ")} tied with ${max} points. Legends together.`:`${max} points. The lies were strong with this one.`;$("finalScores").innerHTML=players.map((p,i)=>`<div class="score-line"><span>${["🥇","🥈","🥉"][i]||"✦"}</span><span class="person">${esc(p.name)}</span><span class="points">${p.score} pts</span></div>`).join("");$("againBtn").classList.toggle("hidden",!players.find(p=>p.id===myId)?.host)}
function startTimer(deadline){clearInterval(timerInterval);const tick=()=>{const remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));$("timer").textContent=remaining;$("timerBar").style.width=(remaining/30*100)+"%";if(remaining<=5&&remaining>0)tone(440,.035,"square");if(remaining<=0)clearInterval(timerInterval)};tick();timerInterval=setInterval(tick,200)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
