// 블로그 발행 슬롯 시각(KST) 계산 유틸
//
// 슬롯 정의:
//   - economy: 07:30 (morning), 17:00 (evening)
//   - fruit:   18:00
//
// ISO 문자열 형식: YYYY-MM-DDTHH:MM:00+09:00 (KST 표기)
// Blogger API /publish?publishDate= 에 그대로 전달 가능

const SLOTS = {
  economy: [
    { name: 'morning', hour: 7,  minute: 30 },
    { name: 'evening', hour: 17, minute: 0  },
  ],
  fruit: [
    { name: 'fruit',   hour: 18, minute: 0  },
  ],
};

// 현재 KST 기준 날짜 + offsetDays → YYYY-MM-DD 문자열
function kstDayStr(offsetDays = 0) {
  const kstMs = Date.now() + 9 * 3600 * 1000;
  const kstDate = new Date(kstMs);
  kstDate.setUTCDate(kstDate.getUTCDate() + offsetDays);
  const y = kstDate.getUTCFullYear();
  const m = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kstDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 특정 날짜(offset)의 특정 슬롯 ISO 문자열 생성
function slotToISO(slot, offsetDays = 0) {
  const day = kstDayStr(offsetDays);
  const hh = String(slot.hour).padStart(2, '0');
  const mm = String(slot.minute).padStart(2, '0');
  return `${day}T${hh}:${mm}:00+09:00`;
}

// 현재 KST 시각 이후 가장 가까운 미래 슬롯
// minOffset = 0이면 오늘도 포함 (아직 오늘 슬롯이 안 지났으면 오늘)
function nextFutureSlot(kind, { minOffset = 0 } = {}) {
  const slots = SLOTS[kind];
  if (!slots) throw new Error(`Unknown slot kind: ${kind}`);
  const now = Date.now();
  for (let offset = minOffset; offset < 60; offset++) {
    for (const s of slots) {
      const iso = slotToISO(s, offset);
      if (new Date(iso).getTime() > now) {
        return { iso, slot: s.name, offsetDays: offset };
      }
    }
  }
  throw new Error('No future slot within 60 days');
}

// offset일 뒤의 첫 슬롯 (economy는 morning 고정)
function slotAtOffset(kind, offsetDays) {
  const slots = SLOTS[kind];
  if (!slots) throw new Error(`Unknown slot kind: ${kind}`);
  const s = slots[0];
  return { iso: slotToISO(s, offsetDays), slot: s.name, offsetDays };
}

// N개의 DRAFT를 순차 배정할 슬롯 목록 생성 (오늘/내일/모레/...)
// economy: 하루 2슬롯 (morning, evening 번갈아) → N개면 Math.ceil(N/2)일 소요
// fruit: 하루 1슬롯 → N일 소요
// startOffset = 0 (오늘부터)
function allocateSlotsForCount(kind, count, { startOffset = 0 } = {}) {
  const slots = SLOTS[kind];
  if (!slots) throw new Error(`Unknown slot kind: ${kind}`);
  const result = [];
  const now = Date.now();
  let offset = startOffset;
  let slotIdx = 0;

  while (result.length < count) {
    const s = slots[slotIdx];
    const iso = slotToISO(s, offset);
    const ms = new Date(iso).getTime();
    if (ms > now) {
      result.push({ iso, slot: s.name, offsetDays: offset, index: result.length });
    }
    slotIdx++;
    if (slotIdx >= slots.length) {
      slotIdx = 0;
      offset++;
    }
  }
  return result;
}

// 사람이 읽기 좋은 KST 표기 (텔레그램 등)
function formatSlotKorean(iso) {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const da = String(kst.getUTCDate()).padStart(2, '0');
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mi = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mo}/${da} ${hh}:${mi} KST`;
}

module.exports = {
  SLOTS,
  kstDayStr,
  slotToISO,
  nextFutureSlot,
  slotAtOffset,
  allocateSlotsForCount,
  formatSlotKorean,
};
