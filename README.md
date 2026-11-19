# 😈 TrollForShare — by Mr.Troll

Same WiFi par devices ke darmiyan text, images aur files foran share karein. Is mein na login chahiye, na koi app.

## Files
```
index.html      → website (frontend)
api/_lib.js     → helpers (same-WiFi detection, storage)
api/items.js    → shared items ki list
api/send.js     → text / image bhejna
api/file.js     → image / file download
api/clear.js    → delete / clear all
package.json
```

## Vercel par host karne ka tareeqa

### Step 1: GitHub par upload karein
1. github.com par login karein, phir **New repository** par click karein. Naam rakhein `trollforshare`, phir **Create**.
2. **"uploading an existing file"** link par click karein.
3. Zip ko pehle **extract (unzip)** karein. Phir us ke **andar ki saari files aur `api` folder** drag karke upload karein. Zip file khud upload na karein, GitHub use khol nahi sakta.
4. Check karein ke repo ke main page par `index.html`, `package.json` aur `api/` folder nazar aa rahe hon, kisi aur folder ke andar nahi.
5. **Commit changes** par click karein.

### Step 2: Vercel par deploy karein
1. vercel.com par jayein aur **Continue with GitHub** se login karein.
2. **Add New → Project** par jayein, apni `trollforshare` repo ke saamne **Import** dabayein.
3. Framework Preset: **Other**. Baaki settings waisi hi chhor dein, phir **Deploy**.

### Step 3: Storage connect karein (zaroori, free)
Is step ke baghair devices ek doosre ko cheezein nahi bhej payenge.
1. Vercel mein apne project mein jayein, upar **Storage** tab kholein.
2. **Create Database** (ya Marketplace) mein **Upstash for Redis** chunein, **Free** plan lein, phir **Create**.
3. Is database ko apne `trollforshare` project se **Connect** karein. Keys khud ba khud add ho jati hain.
4. **Deployments** tab mein latest deployment ke **⋯** par click karke **Redeploy** karein.

Ho gaya. Ab apni `.vercel.app` link do devices par same WiFi pe kholein aur test karein.

## Features
- Same WiFi wale devices khud ba khud ek "room" mein aa jate hain (IPv4 aur IPv6 dono).
- Text, images (paste / drag & drop bhi) aur 3 MB tak ki files.
- Bari photos khud compress ho jati hain.
- 🔒 **Private code**: dono devices par same code daal kar share karein, mobile data ya alag network par bhi.
- Copy, Download, Delete aur Clear all.
- Har cheez 24 ghante baad khud delete ho jati hai.

## Customize
- **Naam / text:** `index.html` mein "TrollForShare" search karke badlein.
- **Rang:** `index.html` ke upar `--brand` aur `--brand2` colors.
- **24 ghante ka time / 3 MB limit:** `api/_lib.js` mein `TTL` aur `MAX_FILE_BYTES`.

## Note
Office ya university jaise bare networks par sab log ek hi IP share karte hain, is liye wahan **Private code** use karein. Public WiFi par passwords ya private documents share na karein.
