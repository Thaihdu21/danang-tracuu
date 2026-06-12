const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

/**
 * Parse trường cot3 (chuỗi điểm chi tiết) thành object.
 * Dấu thập phân trong data gốc là dấu PHẨY → normalize sang dấu CHẤM.
 */
function parseCot3(raw) {
  if (!raw) return {};

  const normalize = (str) =>
    str ? parseFloat(str.trim().replace(",", ".")) || null : null;

  const extract = (label) => {
    // Khớp "- Label: VALUE" — VALUE kết thúc bởi ";" hoặc cuối chuỗi
    const re = new RegExp(
      `-\\s*${label}[^:]*:\\s*([^;]*)`,
      "i"
    );
    const m = raw.match(re);
    return m ? m[1].trim() : null;
  };

  const ngu_van     = normalize(extract("Ngữ văn"));
  const ngoai_ngu   = normalize(extract("Ngoại ngữ"));
  const toan        = normalize(extract("Toán"));
  const mon_chuyen  = normalize(extract("Môn chuyên"));
  const diem_quy_doi = normalize(extract("Điểm quy đổi kết quả HT-RL"));
  const diem_uu_tien = normalize(extract("Điểm ưu tiên"));
  const diem_kk      = normalize(extract("Điểm khuyến khích"));
  const tong_chuyen  = normalize(extract("Tổng điểm xét tuyển CHUYÊN"));
  const tong_ptdtnt  = normalize(extract("Tổng điểm xét tuyển PTDTNT THPT Quảng Nam"));
  const tong_dai_tra = normalize(extract("Tổng điểm xét tuyển THPT đại trà"));

  return {
    ngu_van,
    ngoai_ngu,
    toan,
    mon_chuyen,
    diem_quy_doi,
    diem_uu_tien,
    diem_kk,
    tong_chuyen,
    tong_ptdtnt,
    tong_dai_tra,
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });

  const { so_bao_danh, captcha_token } = req.query;

  if (!so_bao_danh || !captcha_token) {
    return res.status(400).json({
      success: false,
      message: "Thiếu số báo danh hoặc mã captcha.",
    });
  }

  const PROXY_URL  = process.env.API_GATEWAY_URL;
  const KY_THI_ID  = process.env.KY_THI_ID || "119";

  const url = new URL(`${PROXY_URL}/tracuu/public/diemthi`);
  url.searchParams.set("capt", captcha_token);
  url.searchParams.set("cot1", so_bao_danh);
  url.searchParams.set("cot2", "");
  url.searchParams.set("cot3", "");
  url.searchParams.set("cot4", "");
  url.searchParams.set("cot5", "");
  url.searchParams.set("cot6", "");
  url.searchParams.set("cot7", "");
  url.searchParams.set("page", "0");
  url.searchParams.set("size", "3");
  url.searchParams.set("kyThiId", KY_THI_ID);

  try {
    const upstream = await fetch(url.toString(), { method: "GET" });
    const json     = await upstream.json();

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({ success: false, message: json?.message || "Lỗi từ server gốc." });
    }

    const items = json?.content ?? [];
    if (items.length === 0) {
      return res.status(200).json({
        success: false,
        message: "Không tìm thấy kết quả. Vui lòng kiểm tra số báo danh và mã captcha.",
      });
    }

    const item = items[0];
    const diem = parseCot3(item.cot3);

    return res.status(200).json({
      success: true,
      data: {
        so_bao_danh: item.cot1,
        ho_ten: item.cot2,
        diem,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Lỗi hệ thống: " + err.message });
  }
}
