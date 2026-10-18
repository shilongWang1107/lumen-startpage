# LUMEN · 光屿 — Privacy Policy / 隐私政策

_Last updated: 2026-10-18_

LUMEN is a local-first Chrome new tab extension. It does not collect, transmit, sell, or share personal data with the developer.

## What is stored

All of the following data stays inside your browser, on your device:

- appearance preferences (wallpaper, blur, dim, motion, grain, parallax, dock settings);
- quick notes you create;
- custom dock shortcuts and their URLs/icons;
- custom background images you upload;
- the currently selected search engine and recent local search text;
- focus-timer preferences and daily completion count.

LUMEN uses the browser's `localStorage`. It does not use a developer-operated backend, account system, analytics SDK, advertising SDK, or telemetry.

## Network requests

- **Weather:** when the weather widget loads, the page requests current conditions and the daily high/low from `https://api.open-meteo.com`, using one of four fixed city coordinates (Beijing, Shanghai, Chengdu, Shenzhen). No geolocation permission is requested and no user identifier is sent. Open-Meteo may receive ordinary request metadata such as your IP address under [its own privacy policy](https://open-meteo.com/en/terms).
- **Outbound links:** clicking a search result, dock shortcut, or other link opens the selected third-party website. Those websites have their own privacy policies.

LUMEN itself does not make any other network requests. The extension requests **no Chrome permissions** (`permissions` / `host_permissions` are empty).

## Data deletion

Clear the LUMEN site/extension data from Chrome, or remove the extension, to delete locally stored notes, preferences, and backgrounds. There is no server-side copy to delete.

## Contact

For privacy questions, open an issue in this repository.

---

LUMEN 优先在本地运行：扩展不会收集、上传、出售或分享个人数据。备忘、设置、自定义背景和程序坞配置都只保存在当前浏览器的 Local Storage 中；唯一的公网请求是向 Open-Meteo 获取天气（使用四个固定城市的坐标，不请求定位权限）。扩展不申请任何 Chrome 权限，也没有远程代码、账号、分析统计或广告。删除扩展或清除站点数据即可清空本地数据。
