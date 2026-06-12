// ─── Captcha ──────────────────────────────────────────────────────────────────
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ I O 0 1
let currentCaptcha = "";

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCaptchaText(len = 4) {
  return Array.from({ length: len }, () =>
    CAPTCHA_CHARS[randInt(0, CAPTCHA_CHARS.length - 1)]
  ).join("");
}

function drawCaptcha() {
  const canvas = document.getElementById("captchaCanvas");
  const ctx    = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;

  currentCaptcha = generateCaptchaText();

  // Nền
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#f0f4ff";
  ctx.fillRect(0, 0, W, H);

  // Nhiễu — đường ngẫu nhiên
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `hsl(${randInt(0, 360)},60%,70%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(randInt(0, W), randInt(0, H));
    ctx.bezierCurveTo(
      randInt(0, W), randInt(0, H),
      randInt(0, W), randInt(0, H),
      randInt(0, W), randInt(0, H)
    );
    ctx.stroke();
  }

  // Nhiễu — chấm
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `hsl(${randInt(0,360)},50%,60%)`;
    ctx.beginPath();
    ctx.arc(randInt(0,W), randInt(0,H), 1.5, 0, Math.PI*2);
    ctx.fill();
  }

  // Vẽ ký tự
  const colors = ["#1d4ed8","#dc2626","#15803d","#7c3aed","#b45309"];
  currentCaptcha.split("").forEach((ch, i) => {
    ctx.save();
    ctx.font = `bold ${randInt(22,28)}px 'Courier New', monospace`;
    ctx.fillStyle = colors[i % colors.length];
    ctx.translate(14 + i * 28, H / 2 + 9);
    ctx.rotate(((randInt(-15, 15)) * Math.PI) / 180);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

// ─── Keep-alive ping (Render free tier) ──────────────────────────────────────
const PROXY_HEALTH = ""; // để trống — Vercel /api/tra-cuu đã giữ kết nối
// Ping /api/tra-cuu sẽ lỗi nhưng Render vẫn wake up
setInterval(() => {
  fetch("/api/tra-cuu?so_bao_danh=ping&captcha_token=ping").catch(() => {});
}, 10 * 60 * 1000); // mỗi 10 phút

// ─── Xử lý form ──────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  drawCaptcha();

  document.getElementById("btnRefreshCaptcha").addEventListener("click", () => {
    drawCaptcha();
    document.getElementById("captchaInput").value = "";
    hideResult();
  });

  document.getElementById("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await doSearch();
  });
});

function hideResult() {
  document.getElementById("resultSection").classList.add("hidden");
  document.getElementById("errorSection").classList.add("hidden");
}

function showError(msg) {
  const el = document.getElementById("errorSection");
  el.textContent = msg;
  el.classList.remove("hidden");
  document.getElementById("resultSection").classList.add("hidden");
}

function fmt(val) {
  if (val === null || val === undefined) return "—";
  return String(val).replace(".", ","); // hiển thị lại dấu phẩy VN
}

async function doSearch() {
  const sbd   = document.getElementById("sbdInput").value.trim();
  const capt  = document.getElementById("captchaInput").value.trim().toUpperCase();

  hideResult();

  if (!sbd) return showError("Vui lòng nhập số báo danh.");
  if (!capt) return showError("Vui lòng nhập mã xác nhận.");
  if (capt !== currentCaptcha) {
    drawCaptcha();
    document.getElementById("captchaInput").value = "";
    return showError("Mã xác nhận không đúng. Vui lòng thử lại.");
  }

  const btn = document.getElementById("btnSearch");
  btn.disabled = true;
  btn.textContent = "Đang tra cứu…";

  try {
    const params = new URLSearchParams({ so_bao_danh: sbd, captcha_token: currentCaptcha });
    const res    = await fetch(`/api/tra-cuu?${params}`);
    const json   = await res.json();

    if (!json.success) {
      drawCaptcha();
      document.getElementById("captchaInput").value = "";
      return showError(json.message || "Có lỗi xảy ra.");
    }

    renderResult(json.data);
  } catch (err) {
    showError("Lỗi kết nối. Vui lòng thử lại sau.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Tra cứu";
    drawCaptcha();
    document.getElementById("captchaInput").value = "";
  }
}

function renderResult({ so_bao_danh, ho_ten, diem }) {
  document.getElementById("resSBD").textContent    = so_bao_danh ?? "—";
  document.getElementById("resHoTen").textContent  = ho_ten ?? "—";

  const rows = [
    { label: "Ngữ văn",               val: diem.ngu_van },
    { label: "Ngoại ngữ",             val: diem.ngoai_ngu },
    { label: "Toán",                   val: diem.toan },
    { label: "Môn chuyên (nếu có)",   val: diem.mon_chuyen },
    { label: "Điểm quy đổi HT-RL 4 năm THCS", val: diem.diem_quy_doi },
    { label: "Điểm ưu tiên",          val: diem.diem_uu_tien },
    { label: "Điểm khuyến khích",     val: diem.diem_kk },
  ];

  const tbody = document.getElementById("diemBody");
  tbody.innerHTML = rows
    .map(
      ({ label, val }) => `
      <tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-2 pr-4 text-gray-600 text-sm">${label}</td>
        <td class="py-2 text-right font-semibold text-gray-800">${fmt(val)}</td>
      </tr>`
    )
    .join("");

  // Tổng điểm đại trà (highlight)
  document.getElementById("tongDaiTra").textContent = fmt(diem.tong_dai_tra);

  // Tổng chuyên / PTDTNT — chỉ hiện nếu có giá trị
  const secChuyen   = document.getElementById("secChuyen");
  const secPtdtnt   = document.getElementById("secPtdtnt");

  if (diem.tong_chuyen !== null) {
    document.getElementById("tongChuyen").textContent = fmt(diem.tong_chuyen);
    secChuyen.classList.remove("hidden");
  } else {
    secChuyen.classList.add("hidden");
  }

  if (diem.tong_ptdtnt !== null) {
    document.getElementById("tongPtdtnt").textContent = fmt(diem.tong_ptdtnt);
    secPtdtnt.classList.remove("hidden");
  } else {
    secPtdtnt.classList.add("hidden");
  }

  document.getElementById("resultSection").classList.remove("hidden");
  document.getElementById("resultSection").scrollIntoView({ behavior: "smooth" });
}
