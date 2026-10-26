# LIE OR LEGEND

A real-time, room-code bluffing party game for 2–8 players. Built with Node.js, Express, and Socket.IO.

## Run locally

Requirements: Node.js 18+

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser. To test multiplayer, open separate browser windows or devices on the same network (for LAN, use the host computer's local IP and allow port 3000 through its firewall).

## Deploy a public URL (Render)

1. Create a GitHub repository and upload these project files.
2. Sign in to Render and choose **New → Web Service**.
3. Connect your repository.
4. Set **Build Command** to `npm install`.
5. Set **Start Command** to `npm start`.
6. Deploy. Render will provide a public `https://...onrender.com` URL that players can open.
7. Test with at least two devices using that public URL.

The server uses WebSockets through Socket.IO. Render's Node web services support long-lived connections; use a persistent service rather than a static-site-only host. Free-tier services may sleep when idle, so the first connection after inactivity may be delayed. For reliable ongoing play, select a hosting plan appropriate to expected traffic.

## Important implementation notes

- Room state and scoring live on the server; clients cannot award themselves points.
- The host starts the game and advances between rounds.
- Each answer phase and vote phase is 30 seconds.
- Five random questions are selected from the question bank per game.
- A 2-player room includes a secret decoy answer.
- Correct truth guesses earn +2; each vote received by a player's bluff earns that bluffer +1.
- A tied top score is a shared victory.

## Scope and limitations

This is a functional starter project, not a hosted deployment. A public URL is created only after you deploy it to a hosting provider. The included server stores rooms in memory, so rooms are lost if the server restarts; it is designed for one server instance. For multi-instance scaling, add a shared Socket.IO adapter and persistent room state. If a player disconnects, they are currently removed from the room; reconnect/resume by stable player token is a future improvement.
