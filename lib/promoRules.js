const PROMO_TIME_ZONE = "Asia/Jerusalem";

function partsAreValid(parts) {
  if (!parts) return false;

  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );

  return (
    date.getUTCFullYear() === parts.year &&
    date.getUTCMonth() === parts.month - 1 &&
    date.getUTCDate() === parts.day &&
    date.getUTCHours() === parts.hour &&
    date.getUTCMinutes() === parts.minute &&
    date.getUTCSeconds() === parts.second
  );
}

function createParts(year, month, day, hour = 0, minute = 0, second = 0) {
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };

  return partsAreValid(parts) ? parts : null;
}

function getDateTimePartsInTimeZone(date, timeZone = PROMO_TIME_ZONE) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value])
  );

  return createParts(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
}

function parseGoogleVisualizationDate(value) {
  const match = String(value)
    .trim()
    .match(
      /^(?:Date|DateTime)\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+)(?:,\s*(\d+)(?:,\s*(\d+))?)?)?\)$/i
    );

  if (!match) return null;

  return createParts(
    match[1],
    Number(match[2]) + 1,
    match[3],
    match[4] || 0,
    match[5] || 0,
    match[6] || 0
  );
}

function parsePlainDateTime(value) {
  const match = String(value)
    .trim()
    .match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

  if (!match) return null;

  return createParts(
    match[1],
    match[2],
    match[3],
    match[4] || 0,
    match[5] || 0,
    match[6] || 0
  );
}

function parsePromoDateTime(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return getDateTimePartsInTimeZone(value);

  if (typeof value === "number" && Number.isFinite(value)) {
    // Google Sheets serial dates use 1899-12-30 as day zero.
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return getDateTimePartsInTimeZone(date);
  }

  const text = String(value).trim();
  if (!text) return null;

  const googleDate = parseGoogleVisualizationDate(text);
  if (googleDate) return googleDate;

  const plainDateTime = parsePlainDateTime(text);
  if (plainDateTime) return plainDateTime;

  const parsed = new Date(text);
  return getDateTimePartsInTimeZone(parsed);
}

function hasPromoDateTimeValue(value) {
  return !(
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function compareDateTimeParts(left, right) {
  const leftValues = [
    left.year,
    left.month,
    left.day,
    left.hour,
    left.minute,
    left.second,
  ];
  const rightValues = [
    right.year,
    right.month,
    right.day,
    right.hour,
    right.minute,
    right.second,
  ];

  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] < rightValues[index]) return -1;
    if (leftValues[index] > rightValues[index]) return 1;
  }

  return 0;
}

function appliesToRegion(promo, region) {
  if (region === "US") return promo.applyToUS === true;
  if (region === "Israel") return promo.applyToIsrael === true;
  return false;
}

function isPromoEligible(promo, region, now = new Date()) {
  if (!promo || promo.active !== true || !appliesToRegion(promo, region)) {
    return false;
  }

  const current = getDateTimePartsInTimeZone(now);
  const start = parsePromoDateTime(promo.startDateTime);
  const end = parsePromoDateTime(promo.endDateTime);
  const hasStart = hasPromoDateTimeValue(promo.startDateTime);
  const hasEnd = hasPromoDateTimeValue(promo.endDateTime);

  if (!current) return false;
  if ((hasStart && !start) || (hasEnd && !end)) return false;
  if (start && end && compareDateTimeParts(start, end) > 0) return false;
  if (start && compareDateTimeParts(current, start) < 0) return false;
  if (end && compareDateTimeParts(current, end) > 0) return false;

  return true;
}

module.exports = {
  PROMO_TIME_ZONE,
  compareDateTimeParts,
  isPromoEligible,
  parsePromoDateTime,
};
