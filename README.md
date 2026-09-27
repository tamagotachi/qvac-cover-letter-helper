# Cover Letter Helper (QVAC)

Paste a job ad and your **real** experience, choose a tone and length, and an **on-device AI** drafts a tailored cover letter that connects your experience to what the job asks for. A **keyword checker** lists the key words from the ad and shows, as you edit, which ones your letter covers (green) and which it doesn't yet (orange).

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `completion` (streaming), with the `LLAMA_3_2_1B_INST_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-cover-letter-helper.git
cd qvac-cover-letter-helper
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3072** (the address, not the HTML file). The first start downloads the model.
While it loads, a simple draft built from your own bullet points is used instead.

## How it works

- `server.js` streams the letter from `completion` with strict rules: use only the experience you gave, and **never invent skills, degrees, numbers or employers**.
- The keyword checker is plain code: it finds the most frequent meaningful words in the ad and checks whether your letter mentions them. Only add the ones that are true for you!
- Your job ad, notes and letter are saved in your browser (and never sent to the internet).
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT
